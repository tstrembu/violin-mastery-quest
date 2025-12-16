// sw.js
// ===================================
// VMQ SERVICE WORKER v3.0.4 (Drop-in replacement)
// Offline-first • Stale-While-Revalidate • Safe ML-ish Prefetching (best-effort)
// Background Sync harmonized with index.html tags
//
// Key fixes vs provided draft:
// - Removes unsupported setInterval in SW (will not reliably run / can be terminated)
// - Adds idbReq() helper + proper IDB transaction completion handling
// - Fixes base-path correctness for GitHub Pages (/violin-mastery-quest/)
// - Avoids caching a non-existent ./js/bootstrap.js (your index.html uses inline bootstrap)
// - Makes "predicted route -> component file" mapping safe by caching explicit URLs
// - Navigation handler returns cached index.html, not request URL (SPA shell)
// - Runtime caching uses request keys, not './index.html' string mismatches
// - Background sync tags match index.html: sync-analytics, sync-sm2, check-due-items
// - Uses safe cache cleanup and robust fetch fallbacks
// ===================================

/* global self, caches, indexedDB */

const VMQ_VERSION = '3.0.4';

const BASE_PATH = '/violin-mastery-quest/'; // GitHub Pages repo path
const ORIGIN = self.location.origin;

const CACHE_CORE    = `vmq-core-v${VMQ_VERSION}`;
const CACHE_MODULES = `vmq-modules-v${VMQ_VERSION}`; // optional bucket (on-demand)
const CACHE_RUNTIME = `vmq-runtime-v${VMQ_VERSION}`;
const CACHE_ML      = `vmq-ml-v${VMQ_VERSION}`;

const OFFLINE_URL = `${BASE_PATH}offline.html`;
const INDEX_URL   = `${BASE_PATH}index.html`;

// ------------------------------------------------------------
// IndexedDB (offline queues + light ML state)
// ------------------------------------------------------------
const IDB_NAME = 'vmq-offline';
const IDB_VERSION = 1;

const STORE_ANALYTICS = 'analytics-queue';
const STORE_SYNC = 'sync-queue';
const STORE_ML = 'ml-predictions';

// Promisify IDBRequest
function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Wait for transaction completion
function idbTxDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('IDB tx aborted'));
    tx.onerror = () => reject(tx.error || new Error('IDB tx error'));
  });
}

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_ANALYTICS)) {
        const s = db.createObjectStore(STORE_ANALYTICS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('timestamp', 'timestamp', { unique: false });
        s.createIndex('synced', 'synced', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SYNC)) {
        const s = db.createObjectStore(STORE_SYNC, { keyPath: 'id', autoIncrement: true });
        s.createIndex('type', 'type', { unique: false });
        s.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_ML)) {
        db.createObjectStore(STORE_ML, { keyPath: 'key' });
      }
    };
  });
}

// ------------------------------------------------------------
// Core assets (cache what’s safe + stable)
// IMPORTANT: keep list conservative to avoid install failures.
// Modules are cached on-demand.
// ------------------------------------------------------------
const CORE_FILES = [
  `${BASE_PATH}`,
  INDEX_URL,
  OFFLINE_URL,
  `${BASE_PATH}manifest.json`,

  `${BASE_PATH}css/base.css`,
  `${BASE_PATH}css/components.css`,
  `${BASE_PATH}css/themes.css`,
  `${BASE_PATH}css/animations.css`,

  `${BASE_PATH}js/App.js`,
  `${BASE_PATH}js/config/routeManifest.js`,
  `${BASE_PATH}js/config/constants.js`,
  `${BASE_PATH}js/config/storage.js`,

  `${BASE_PATH}js/utils/helpers.js`,
  `${BASE_PATH}js/utils/keyboard.js`,
  `${BASE_PATH}js/utils/router.js`,
  `${BASE_PATH}js/contexts/AppContext.js`,

  `${BASE_PATH}icons/icon-192.png`,
  `${BASE_PATH}icons/icon-512.png`,

  // UMD libs (network-first fallback if these fail, but try to cache)
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
];

// ------------------------------------------------------------
// Lightweight “ML” state (best effort, SW can be killed anytime)
// ------------------------------------------------------------
let mlState = {
  navigationHistory: [],
  cacheHitRate: 0,
  lastPredictionTime: 0,
  isOnline: true
};

// Performance metrics
const perf = {
  cacheHits: 0,
  cacheMisses: 0,
  prefetchHits: 0,
  totalRequests: 0
};

function recordHit(fromPrefetch = false) {
  perf.cacheHits++;
  perf.totalRequests++;
  if (fromPrefetch) perf.prefetchHits++;
  mlState.cacheHitRate = perf.totalRequests ? (perf.cacheHits / perf.totalRequests) : 0;
}

function recordMiss() {
  perf.cacheMisses++;
  perf.totalRequests++;
  mlState.cacheHitRate = perf.totalRequests ? (perf.cacheHits / perf.totalRequests) : 0;
}

async function reportPerformanceMetrics() {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const hitRate = mlState.cacheHitRate || 0;
  const prefetchAccuracy = perf.cacheHits ? (perf.prefetchHits / perf.cacheHits) : 0;

  for (const client of clientList) {
    client.postMessage({
      type: 'SW_PERFORMANCE_METRICS',
      metrics: { ...perf, cacheHitRate: hitRate, prefetchAccuracy }
    });
  }
}

// ------------------------------------------------------------
// Cache quota management (best effort)
// ------------------------------------------------------------
async function manageCacheQuota() {
  // navigator.storage is not always available in SW; guard tightly.
  try {
    const storage = self.navigator?.storage;
    if (!storage?.estimate) return;

    const estimate = await storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    if (!quota) return;

    const usagePct = (usage / quota) * 100;

    // If over 80%, evict oldest 50% of ML cache entries
    if (usagePct > 80) {
      const cache = await caches.open(CACHE_ML);
      const keys = await cache.keys();
      const toDelete = keys.slice(0, Math.floor(keys.length / 2));
      await Promise.all(toDelete.map(req => cache.delete(req)));
    }
  } catch (e) {
    // Silent: quota mgmt is optional
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function isSameOrigin(url) {
  try {
    const u = new URL(url);
    return u.origin === ORIGIN;
  } catch {
    return false;
  }
}

function isCacheableResponse(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default' || response.type === 'cors');
}

function shouldCacheRuntime(request, response) {
  if (request.method !== 'GET') return false;
  if (!isCacheableResponse(response)) return false;

  // Cache same-origin by default; allow unpkg UMD files in core cache only
  const url = request.url;
  if (isSameOrigin(url)) return true;

  // For runtime cache, skip cross-origin to avoid opaque+quota churn
  return false;
}

// Find request in multiple caches (core/modules/ml/runtime)
async function matchAnyCache(request) {
  const cacheNames = [CACHE_CORE, CACHE_MODULES, CACHE_ML, CACHE_RUNTIME];
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const hit = await cache.match(request);
    if (hit) return { response: hit, cacheName: name };
  }
  return { response: null, cacheName: null };
}

// ------------------------------------------------------------
// ML-ish predictive prefetching (best effort)
// IMPORTANT: We cannot safely map "route" -> file name without the app manifest.
// So we accept either:
// 1) explicit URLs from the client (WARM_CACHE), or
// 2) extremely conservative heuristic: if route looks like a filename, use it.
// ------------------------------------------------------------
async function loadNavHistoryIfNeeded() {
  if (mlState.navigationHistory.length) return;

  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_ML, 'readonly');
    const store = tx.objectStore(STORE_ML);
    const rec = await idbReq(store.get('navigationHistory'));
    if (rec?.data && Array.isArray(rec.data)) mlState.navigationHistory = rec.data;
    await idbTxDone(tx);
  } catch {
    // ignore
  }
}

async function saveNavHistory() {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_ML, 'readwrite');
    const store = tx.objectStore(STORE_ML);
    store.put({ key: 'navigationHistory', data: mlState.navigationHistory });
    await idbTxDone(tx);
  } catch {
    // ignore
  }
}

async function updateNavigationHistory(route) {
  if (!route) return;

  mlState.navigationHistory.push({
    route: String(route),
    timestamp: Date.now(),
    hour: new Date().getHours()
  });

  if (mlState.navigationHistory.length > 50) {
    mlState.navigationHistory.splice(0, mlState.navigationHistory.length - 50);
  }

  await saveNavHistory();
}

async function predictNextRoutes(currentRoute) {
  await loadNavHistoryIfNeeded();

  const hourNow = new Date().getHours();
  const scores = Object.create(null);

  for (let i = 0; i < mlState.navigationHistory.length - 1; i++) {
    const nav = mlState.navigationHistory[i];
    const next = mlState.navigationHistory[i + 1];
    if (!nav || !next) continue;

    if (nav.route === currentRoute) {
      const r = next.route;
      scores[r] = (scores[r] || 0) + 1;
      if (Math.abs((nav.hour ?? hourNow) - hourNow) <= 1) scores[r] += 0.5;
    }
  }

  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([route, score]) => ({ route, score }));

  mlState.lastPredictionTime = Date.now();
  return sorted;
}

// Conservative URL resolver:
// - If client sends explicit URLs: prefetch them.
// - If route looks like a component id (e.g., "Intervals"), do NOT guess file name.
// - If route ends with ".js", treat it as a relative URL under BASE_PATH.
function resolvePrefetchURL(routeOrUrl) {
  if (!routeOrUrl) return null;
  const raw = String(routeOrUrl).trim();
  if (!raw) return null;

  // Explicit absolute URL
  if (/^https?:\/\//i.test(raw)) return raw;

  // Absolute-from-origin
  if (raw.startsWith('/')) return `${ORIGIN}${raw}`;

  // If it already looks like a JS path, anchor to BASE_PATH
  if (raw.endsWith('.js')) {
    // allow "js/components/X.js" or "./js/components/X.js"
    const cleaned = raw.replace(/^\.\//, '');
    return `${ORIGIN}${BASE_PATH}${cleaned}`;
  }

  // Otherwise: don't guess (avoid caching wrong file names)
  return null;
}

async function prefetchURLs(urls) {
  if (!Array.isArray(urls) || !urls.length) return;

  const cache = await caches.open(CACHE_ML);

  for (const u of urls) {
    const url = resolvePrefetchURL(u);
    if (!url) continue;

    const req = new Request(url, { method: 'GET', mode: 'cors', credentials: 'omit' });

    // Skip if already cached anywhere
    const existing = await caches.match(req);
    if (existing) continue;

    try {
      const resp = await fetch(req);
      if (isCacheableResponse(resp)) {
        await cache.put(req, resp.clone());
      }
    } catch {
      // ignore
    }
  }
}

// ------------------------------------------------------------
// Offline analytics queue
// ------------------------------------------------------------
async function queueAnalyticsEvent(evt) {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_ANALYTICS, 'readwrite');
    const store = tx.objectStore(STORE_ANALYTICS);

    store.add({
      ...(evt || {}),
      timestamp: Date.now(),
      synced: false
    });

    await idbTxDone(tx);
  } catch {
    // ignore
  }
}

async function syncAnalyticsQueue() {
  if (!mlState.isOnline) return;

  try {
    const db = await openIDB();

    // Read unsynced
    const tx = db.transaction(STORE_ANALYTICS, 'readonly');
    const store = tx.objectStore(STORE_ANALYTICS);
    const idx = store.index('synced');
    const unsynced = await idbReq(idx.getAll(false));
    await idbTxDone(tx);

    if (!unsynced?.length) return;

    // Broadcast to windows; app decides how/if to persist remotely
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      client.postMessage({ type: 'SYNC_ANALYTICS', events: unsynced });
    }

    // Mark as synced
    const tx2 = db.transaction(STORE_ANALYTICS, 'readwrite');
    const store2 = tx2.objectStore(STORE_ANALYTICS);
    for (const e of unsynced) {
      e.synced = true;
      store2.put(e);
    }
    await idbTxDone(tx2);
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------
// INSTALL
// ------------------------------------------------------------
self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil((async () => {
    // IDB first (doesn't block caching, but primes stores)
    try { await openIDB(); } catch {}

    const cache = await caches.open(CACHE_CORE);

    // Cache core files individually so one failure doesn't break install.
    await Promise.all(CORE_FILES.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // Ignore individual failures (e.g., offline during install, or unpkg hiccup)
      }
    }));
  })());
});

// ------------------------------------------------------------
// ACTIVATE
// ------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean old caches
    const keys = await caches.keys();
    const valid = new Set([CACHE_CORE, CACHE_MODULES, CACHE_RUNTIME, CACHE_ML]);

    await Promise.all(keys.map((k) => {
      if (k.startsWith('vmq-') && !valid.has(k)) return caches.delete(k);
      return Promise.resolve(false);
    }));

    await self.clients.claim();

    // Best effort: quota management + analytics sync
    await manageCacheQuota();
    await syncAnalyticsQueue();
  })());
});

// ------------------------------------------------------------
// FETCH
// Strategy:
// - Navigation: network-first -> fallback to cached INDEX_URL -> OFFLINE_URL
// - Assets:
//   - Cache-first for same-origin (core/modules/ml/runtime), then network,
//     then cache runtime if appropriate.
//   - For same-origin JS/CSS/etc: stale-while-revalidate.
// ------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET
  if (request.method !== 'GET') return;

  // SPA navigations
  if (request.mode === 'navigate' || (request.destination === 'document' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith((async () => {
      try {
        const net = await fetch(request);
        mlState.isOnline = true;

        // Update cached shell for offline
        if (net && net.ok) {
          const runtime = await caches.open(CACHE_RUNTIME);
          // Always store under INDEX_URL so we can serve as SPA shell later.
          runtime.put(INDEX_URL, net.clone()).catch(() => {});
          return net;
        }
      } catch {
        mlState.isOnline = false;
      }

      // Fallback to cached index shell
      const cachedIndex = await caches.match(INDEX_URL);
      if (cachedIndex) return cachedIndex;

      // Then offline page
      const offline = await caches.match(OFFLINE_URL);
      return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }

  // Non-navigation requests
  event.respondWith((async () => {
    // Try cache(s) first
    const { response: cached, cacheName } = await matchAnyCache(request);
    if (cached) {
      recordHit(cacheName === CACHE_ML);

      // Stale-while-revalidate for same-origin assets
      if (isSameOrigin(request.url)) {
        event.waitUntil((async () => {
          try {
            const net = await fetch(request);
            mlState.isOnline = true;
            if (shouldCacheRuntime(request, net)) {
              const runtime = await caches.open(CACHE_RUNTIME);
              await runtime.put(request, net.clone());
            }
          } catch {
            mlState.isOnline = false;
          }
        })());
      }

      return cached;
    }

    recordMiss();

    // Network fallback
    try {
      const net = await fetch(request);
      mlState.isOnline = true;

      if (shouldCacheRuntime(request, net)) {
        const runtime = await caches.open(CACHE_RUNTIME);
        runtime.put(request, net.clone()).catch(() => {});
      }

      return net;
    } catch {
      mlState.isOnline = false;

      // If this was a document request, try offline page
      if (request.destination === 'document') {
        const offline = await caches.match(OFFLINE_URL);
        return offline || new Response('Offline', { status: 503 });
      }

      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});

// ------------------------------------------------------------
// MESSAGE HANDLING
// ------------------------------------------------------------
self.addEventListener('message', (event) => {
  const data = event.data || {};

  // Reply port helper
  const reply = (payload) => {
    if (event.ports && event.ports[0]) {
      try { event.ports[0].postMessage(payload); } catch {}
    }
  };

  // Cache status
  if (data.type === 'CACHE_STATUS') {
    reply({
      type: 'CACHE_STATUS_REPLY',
      version: VMQ_VERSION,
      status: 'active',
      caches: [CACHE_CORE, CACHE_MODULES, CACHE_RUNTIME, CACHE_ML],
      mlState: {
        cacheHitRate: mlState.cacheHitRate,
        isOnline: mlState.isOnline,
        navigationHistorySize: mlState.navigationHistory.length
      }
    });
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Navigation event for prediction (route string)
  if (data.type === 'NAVIGATION') {
    const route = data.route;
    event.waitUntil((async () => {
      await updateNavigationHistory(route);
      const preds = await predictNextRoutes(String(route || ''));
      // Only prefetch if route items are explicit URLs or ".js" paths (safe)
      await prefetchURLs(preds.map(p => p.route));
    })());
    return;
  }

  // Analytics event (queue if offline)
  if (data.type === 'ANALYTICS_EVENT') {
    const evt = data.event;
    if (mlState.isOnline) {
      event.waitUntil((async () => {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({ type: 'ANALYTICS_EVENT', event: evt });
        }
      })());
    } else {
      event.waitUntil(queueAnalyticsEvent(evt));
    }
    return;
  }

  // Share payload forwarding (app-level handling)
  if (data.type === 'HANDLE_SHARE') {
    event.waitUntil((async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: 'HANDLE_SHARE',
          payload: {
            title: data.title,
            text: data.text,
            url: data.url,
            timestamp: Date.now()
          }
        });
      }
    })());
    return;
  }

  // Request metrics
  if (data.type === 'REQUEST_METRICS') {
    event.waitUntil(reportPerformanceMetrics());
    return;
  }

  // Manual cache warming: accept explicit JS URLs or ".js" paths
  if (data.type === 'WARM_CACHE') {
    const routesOrUrls = data.routes;
    event.waitUntil(prefetchURLs(routesOrUrls));
    return;
  }
});

// ------------------------------------------------------------
// BACKGROUND SYNC (harmonized with index.html)
// ------------------------------------------------------------
self.addEventListener('sync', (event) => {
  const tag = event.tag;

  // index.html registers: sync-analytics, sync-sm2
  if (tag === 'sync-analytics') {
    event.waitUntil(syncAnalyticsQueue());
    return;
  }

  if (tag === 'sync-sm2') {
    event.waitUntil((async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: 'SYNC_SM2', timestamp: Date.now() });
      }
    })());
    return;
  }

  // Legacy compatibility
  if (tag === 'analytics-sync' || tag === 'offline-data-sync') {
    event.waitUntil(syncAnalyticsQueue());
  }
});

// ------------------------------------------------------------
// PERIODIC BACKGROUND SYNC (best effort; not widely supported)
// ------------------------------------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-due-items') {
    event.waitUntil((async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: 'CHECK_DUE_ITEMS', timestamp: Date.now() });
      }
    })());
  }
});

// ------------------------------------------------------------
// PUSH NOTIFICATIONS (optional; safe defaults)
// ------------------------------------------------------------
self.addEventListener('push', (event) => {
  const data = event.data ? safeJson(event.data) : {};
  const title = data.title || 'Violin Mastery Quest';

  const options = {
    body: data.body || 'Time to practice!',
    icon: `${BASE_PATH}icons/icon-192.png`,
    badge: `${BASE_PATH}icons/icon-192.png`,
    data: data.data || {},
    tag: data.tag || 'vmq-notification',
    requireInteraction: !!data.requireInteraction
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of clientList) {
      if (client.url && client.url.startsWith(`${ORIGIN}${BASE_PATH}`) && 'focus' in client) {
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(`${ORIGIN}${BASE_PATH}`);
    }
  })());
});

function safeJson(data) {
  try { return data.json(); } catch { return {}; }
}

self.addEventListener('error', () => {});
self.addEventListener('unhandledrejection', () => {});

console.log(`[SW v${VMQ_VERSION}] 🎻 VMQ Service Worker loaded (base: ${BASE_PATH})`);