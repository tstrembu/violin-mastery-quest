// sw.js
// ===================================
// VMQ SERVICE WORKER v3.0.6 (Drop-in replacement)
// Offline-first • Stale-While-Revalidate • Safe Prefetching (best-effort)
// Base-path derived from registration.scope (no hardcoding)
//
// HARD FIXES:
// ✅ offline.html is ONLY used for NAVIGATION requests
// ✅ NEVER return HTML for destination: "script" / "style" / "worker"
//     (prevents "Importing a module script failed" due to HTML cache poisoning)
// ✅ SPA-safe navigation fallback (index.html) without serving HTML to JS/CSS/worker requests
// ===================================

/* global self, caches, indexedDB */

const VMQ_VERSION = '3.0.6';

const SCOPE_URL = new URL(self.registration.scope); // e.g. https://host/violin-mastery-quest/
const BASE_URL  = SCOPE_URL.href;                   // must end with "/"
const BASE_PATH = SCOPE_URL.pathname;               // e.g. "/violin-mastery-quest/"
const ORIGIN    = self.location.origin;

const CACHE_CORE    = `vmq-core-v${VMQ_VERSION}`;
const CACHE_MODULES = `vmq-modules-v${VMQ_VERSION}`;
const CACHE_RUNTIME = `vmq-runtime-v${VMQ_VERSION}`;
const CACHE_ML      = `vmq-ml-v${VMQ_VERSION}`;

const OFFLINE_URL = new URL('./offline.html', BASE_URL).href;
const INDEX_URL   = new URL('./index.html',   BASE_URL).href;

// ------------------------------------------------------------
// IndexedDB
// ------------------------------------------------------------
const IDB_NAME = 'vmq-offline';
const IDB_VERSION = 1;

const STORE_ANALYTICS = 'analytics-queue';
const STORE_SYNC = 'sync-queue';
const STORE_ML = 'ml-predictions';

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

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
// Core files (absolute URLs)
// ------------------------------------------------------------
const CORE_FILES = [
  BASE_URL,
  INDEX_URL,
  OFFLINE_URL,
  new URL('./manifest.json', BASE_URL).href,

  new URL('./css/base.css', BASE_URL).href,
  new URL('./css/components.css', BASE_URL).href,
  new URL('./css/themes.css', BASE_URL).href,
  new URL('./css/animations.css', BASE_URL).href,

  new URL('./js/App.js', BASE_URL).href,
  new URL('./js/config/routeManifest.js', BASE_URL).href,
  new URL('./js/config/constants.js', BASE_URL).href,
  new URL('./js/config/storage.js', BASE_URL).href,

  new URL('./js/utils/keyboard.js', BASE_URL).href,
  new URL('./js/utils/router.js', BASE_URL).href,
  new URL('./js/contexts/AppContext.js', BASE_URL).href,

  new URL('./icons/icon-192.png', BASE_URL).href,
  new URL('./icons/icon-512.png', BASE_URL).href,

  // UMD externals (opaque ok)
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
];

// ------------------------------------------------------------
// Lightweight state + metrics
// ------------------------------------------------------------
let mlState = {
  navigationHistory: [],
  cacheHitRate: 0,
  lastPredictionTime: 0,
  isOnline: true
};

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

async function manageCacheQuota() {
  try {
    const storage = self.navigator?.storage;
    if (!storage?.estimate) return;

    const estimate = await storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    if (!quota) return;

    const usagePct = (usage / quota) * 100;

    if (usagePct > 80) {
      const cache = await caches.open(CACHE_ML);
      const keys = await cache.keys();
      const toDelete = keys.slice(0, Math.floor(keys.length / 2));
      await Promise.all(toDelete.map(req => cache.delete(req)));
    }
  } catch {}
}

function isSameOrigin(url) {
  try { return new URL(url).origin === ORIGIN; } catch { return false; }
}

function isCacheableResponse(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default' || response.type === 'cors' || response.type === 'opaque');
}

function contentType(res) {
  try { return (res.headers.get('content-type') || '').toLowerCase(); } catch { return ''; }
}

function isHtmlResponse(res) {
  const ct = contentType(res);
  return ct.includes('text/html');
}

function isBlockedHtmlDestination(request) {
  // Hard requirement: never return HTML for these
  const d = request.destination || '';
  return d === 'script' || d === 'style' || d === 'worker';
}

function shouldCacheRuntime(request, response) {
  if (request.method !== 'GET') return false;
  if (!isCacheableResponse(response)) return false;
  if (!isSameOrigin(request.url)) return false;

  // Never cache HTML as a "module asset" response to avoid poisoning
  // (Nav HTML is handled separately via INDEX_URL runtime)
  if (isHtmlResponse(response) && !isNavigationRequest(request)) return false;

  return true;
}

function isNavigationRequest(request) {
  if (!request) return false;
  if (request.mode === 'navigate') return true;

  // Some browsers: destination === 'document' with HTML accept header
  const accept = (request.headers.get('accept') || '').toLowerCase();
  return request.destination === 'document' && accept.includes('text/html');
}

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
// ML-ish nav history
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
  } catch {}
}

async function saveNavHistory() {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_ML, 'readwrite');
    const store = tx.objectStore(STORE_ML);
    store.put({ key: 'navigationHistory', data: mlState.navigationHistory });
    await idbTxDone(tx);
  } catch {}
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

function resolvePrefetchURL(routeOrUrl) {
  if (!routeOrUrl) return null;
  const raw = String(routeOrUrl).trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${ORIGIN}${raw}`;

  // Allow explicit JS file prefetch
  if (raw.endsWith('.js')) {
    const cleaned = raw.replace(/^\.\//, '');
    return new URL(`./${cleaned}`, BASE_URL).href;
  }

  return null;
}

async function prefetchURLs(urls) {
  if (!Array.isArray(urls) || !urls.length) return;

  const cache = await caches.open(CACHE_ML);

  for (const u of urls) {
    const url = resolvePrefetchURL(u);
    if (!url) continue;

    const req = new Request(url, { method: 'GET', mode: 'cors', credentials: 'omit' });

    // Search across caches to avoid duplicates
    const existing = await caches.match(req);
    if (existing) continue;

    try {
      const resp = await fetch(req);
      if (isCacheableResponse(resp)) await cache.put(req, resp.clone());
    } catch {}
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

    store.add({ ...(evt || {}), timestamp: Date.now(), synced: false });
    await idbTxDone(tx);
  } catch {}
}

async function syncAnalyticsQueue() {
  if (!mlState.isOnline) return;

  try {
    const db = await openIDB();

    const tx = db.transaction(STORE_ANALYTICS, 'readonly');
    const store = tx.objectStore(STORE_ANALYTICS);
    const idx = store.index('synced');
    const unsynced = await idbReq(idx.getAll(false));
    await idbTxDone(tx);

    if (!unsynced?.length) return;

    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) client.postMessage({ type: 'SYNC_ANALYTICS', events: unsynced });

    const tx2 = db.transaction(STORE_ANALYTICS, 'readwrite');
    const store2 = tx2.objectStore(STORE_ANALYTICS);
    for (const e of unsynced) { e.synced = true; store2.put(e); }
    await idbTxDone(tx2);
  } catch {}
}

// ------------------------------------------------------------
// INSTALL
// ------------------------------------------------------------
self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil((async () => {
    try { await openIDB(); } catch {}

    const cache = await caches.open(CACHE_CORE);

    // Add individually so one failure doesn't break install
    await Promise.all(CORE_FILES.map(async (url) => {
      try { await cache.add(url); } catch {}
    }));

    // Ensure offline + index are always present
    try { await cache.add(OFFLINE_URL); } catch {}
    try { await cache.add(INDEX_URL); } catch {}
  })());
});

// ------------------------------------------------------------
// ACTIVATE
// ------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const valid = new Set([CACHE_CORE, CACHE_MODULES, CACHE_RUNTIME, CACHE_ML]);

    await Promise.all(keys.map((k) => {
      if (k.startsWith('vmq-') && !valid.has(k)) return caches.delete(k);
      return Promise.resolve(false);
    }));

    await self.clients.claim();
    await manageCacheQuota();
    await syncAnalyticsQueue();
  })());
});

// ------------------------------------------------------------
// FETCH
// ------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Do not interfere outside our scope/origin for runtime logic
  // (still allows cached UMD externals to be served if requested)
  const inScope = url.href.startsWith(BASE_URL) || url.origin !== ORIGIN ? true : (url.pathname.startsWith(BASE_PATH));

  // --- NAVIGATION (documents) ---
  if (isNavigationRequest(request)) {
    event.respondWith((async () => {
      // Network-first for navigations (fresh when online)
      try {
        const net = await fetch(request);
        mlState.isOnline = true;

        // Only accept HTML as a navigation response
        if (net && net.ok && isHtmlResponse(net)) {
          // Update cached INDEX_URL (SPA shell) so offline works reliably
          try {
            const runtime = await caches.open(CACHE_RUNTIME);
            await runtime.put(INDEX_URL, net.clone());
          } catch {}
          return net;
        }
      } catch {
        mlState.isOnline = false;
      }

      // Offline fallback: serve cached INDEX_URL first (SPA shell)
      const cachedIndex = await caches.match(INDEX_URL);
      if (cachedIndex) return cachedIndex;

      // Final fallback for nav only
      const offline = await caches.match(OFFLINE_URL);
      return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }

  // --- NON-NAV (assets / modules) ---
  event.respondWith((async () => {
    // If not in scope and not a known cached external, just pass through
    if (!inScope && url.origin === ORIGIN) {
      try { return await fetch(request); } catch {
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    }

    // Cache-first
    const { response: cached, cacheName } = await matchAnyCache(request);

    // HARD GUARANTEE: never return HTML for script/style/worker
    if (cached && isBlockedHtmlDestination(request) && isHtmlResponse(cached)) {
      // Treat as poisoned cache: ignore cached HTML and go to network
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
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    }

    if (cached) {
      recordHit(cacheName === CACHE_ML);

      // SWR background update for same-origin assets
      if (isSameOrigin(request.url)) {
        event.waitUntil((async () => {
          try {
            const net = await fetch(request);
            mlState.isOnline = true;

            // Do not poison caches with HTML for JS/CSS/worker
            if (isBlockedHtmlDestination(request) && isHtmlResponse(net)) return;

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

    // Cache miss → network
    recordMiss();

    try {
      const net = await fetch(request);
      mlState.isOnline = true;

      // Never accept HTML as response for script/style/worker
      if (isBlockedHtmlDestination(request) && isHtmlResponse(net)) {
        return new Response('Module load blocked (HTML returned for asset request)', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      if (shouldCacheRuntime(request, net)) {
        const runtime = await caches.open(CACHE_RUNTIME);
        runtime.put(request, net.clone()).catch(() => {});
      }

      return net;
    } catch {
      mlState.isOnline = false;

      // For non-nav requests, NEVER return offline.html (hard requirement)
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});

// ------------------------------------------------------------
// MESSAGE
// ------------------------------------------------------------
self.addEventListener('message', (event) => {
  const data = event.data || {};
  const reply = (payload) => {
    if (event.ports && event.ports[0]) {
      try { event.ports[0].postMessage(payload); } catch {}
    }
  };

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

  if (data.type === 'NAVIGATION') {
    const route = data.route;
    event.waitUntil((async () => {
      await updateNavigationHistory(route);
      const preds = await predictNextRoutes(String(route || ''));
      // Best-effort (kept intentionally conservative)
      await prefetchURLs(preds.map(p => p.route));
    })());
    return;
  }

  if (data.type === 'ANALYTICS_EVENT') {
    const evt = data.event;
    if (mlState.isOnline) {
      event.waitUntil((async () => {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) client.postMessage({ type: 'ANALYTICS_EVENT', event: evt });
      })());
    } else {
      event.waitUntil(queueAnalyticsEvent(evt));
    }
    return;
  }

  if (data.type === 'REQUEST_METRICS') {
    event.waitUntil(reportPerformanceMetrics());
    return;
  }

  if (data.type === 'WARM_CACHE') {
    event.waitUntil(prefetchURLs(data.routes));
  }
});

// ------------------------------------------------------------
// BACKGROUND SYNC
// ------------------------------------------------------------
self.addEventListener('sync', (event) => {
  const tag = event.tag;

  if (tag === 'sync-analytics') {
    event.waitUntil(syncAnalyticsQueue());
    return;
  }

  if (tag === 'sync-sm2') {
    event.waitUntil((async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) client.postMessage({ type: 'SYNC_SM2', timestamp: Date.now() });
    })());
    return;
  }
});

// ------------------------------------------------------------
// PERIODIC SYNC
// ------------------------------------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-due-items') {
    event.waitUntil((async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) client.postMessage({ type: 'CHECK_DUE_ITEMS', timestamp: Date.now() });
    })());
  }
});

console.log(`[SW v${VMQ_VERSION}] 🎻 VMQ Service Worker loaded (scope: ${BASE_PATH})`);
