/* sw.js — VMQ Safe PWA Worker (drop-in) — v3.0.8
   Goals:
   - Never respond with 400s for valid requests (fail with 503 text/plain when needed)
   - Navigation fallback to offline.html (documents ONLY)
   - Stale-While-Revalidate for static assets (never serve offline.html to assets)
   - Update flow: skipWaiting on message, notify clients when updated
   - Keeps: IDB queues • nav-history ML-ish predictions • prefetch • metrics • quota mgmt • sync hooks
*/

/* global self, caches, indexedDB */

const VMQ_VERSION = '3.0.8';

// Derive base-path from registration scope (GH Pages safe; no hardcoding)
const SCOPE_URL = new URL(self.registration.scope); // e.g. https://host/violin-mastery-quest/
const BASE_URL  = SCOPE_URL.href;                   // must end with "/"
const BASE_PATH = SCOPE_URL.pathname;               // e.g. "/violin-mastery-quest/"
const ORIGIN    = self.location.origin;

// Cache buckets
const CACHE_CORE    = `vmq-core-v${VMQ_VERSION}`;
const CACHE_MODULES = `vmq-modules-v${VMQ_VERSION}`;
const CACHE_RUNTIME = `vmq-runtime-v${VMQ_VERSION}`;
const CACHE_ML      = `vmq-ml-v${VMQ_VERSION}`;

// Core URLs (absolute)
const OFFLINE_URL = new URL('./offline.html', BASE_URL).href;
const INDEX_URL   = new URL('./index.html',   BASE_URL).href;

// Optional fetch endpoint for offline.html to read cache/version info:
// GET {BASE}__vmq_cache_status__
const CACHE_STATUS_URL = new URL('./__vmq_cache_status__', BASE_URL).href;

// ------------------------------------------------------------
// IndexedDB (kept)
// ------------------------------------------------------------
const IDB_NAME = 'vmq-offline';
const IDB_VERSION = 1;

const STORE_ANALYTICS = 'analytics-queue';
const STORE_SYNC      = 'sync-queue';
const STORE_ML        = 'ml-predictions';

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
// Core files (absolute URLs) — add individually (best-effort)
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

  new URL('./js/utils/accessibility.js', BASE_URL).href,
  new URL('./js/utils/keyboard.js', BASE_URL).href,
  new URL('./js/utils/router.js', BASE_URL).href,

  new URL('./icons/icon-192.png', BASE_URL).href,
  new URL('./icons/icon-512.png', BASE_URL).href,

  // Optional CDN libs (opaque ok). If caching fails, SW still works online.
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function isSameOrigin(url) {
  try { return new URL(url).origin === ORIGIN; } catch { return false; }
}
function contentType(resp) {
  try { return (resp?.headers?.get?.('content-type') || '').toLowerCase(); } catch { return ''; }
}
function isHTMLResponse(resp) {
  return contentType(resp).includes('text/html');
}
function isNavigationRequest(request) {
  if (!request) return false;
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const accept = (request.headers.get('accept') || '').toLowerCase();
  return accept.includes('text/html');
}
function isAssetDestination(request) {
  const d = request.destination || '';
  return d === 'script' || d === 'style' || d === 'worker' || d === 'sharedworker' || d === 'serviceworker';
}
function isCacheableResponse(response) {
  // include opaque so CDN libs can be cached
  return response && (
    (response.ok && (response.type === 'basic' || response.type === 'default' || response.type === 'cors')) ||
    response.type === 'opaque'
  );
}
function fail503(message) {
  return new Response(message || 'Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function isVmqCacheName(name) {
  return typeof name === 'string' && name.startsWith('vmq-');
}

async function broadcastToClients(payload) {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage(payload);
  } catch {}
}

async function matchAnyCache(request) {
  const cacheNames = [CACHE_CORE, CACHE_MODULES, CACHE_ML, CACHE_RUNTIME];
  for (const name of cacheNames) {
    try {
      const cache = await caches.open(name);
      const hit = await cache.match(request);
      if (hit) return { response: hit, cacheName: name };
    } catch {}
  }
  return { response: null, cacheName: null };
}

async function deleteFromAllCaches(request) {
  const cacheNames = [CACHE_CORE, CACHE_MODULES, CACHE_ML, CACHE_RUNTIME];
  await Promise.all(cacheNames.map(async (name) => {
    try {
      const cache = await caches.open(name);
      await cache.delete(request);
    } catch {}
  }));
}

function shouldCacheRuntime(request, response) {
  if (request.method !== 'GET') return false;
  if (!isCacheableResponse(response)) return false;

  // Poison protection: never cache HTML for non-nav requests
  if (!isNavigationRequest(request) && isHTMLResponse(response)) return false;

  // Extra: never cache HTML for script/style/worker
  if (isAssetDestination(request) && isHTMLResponse(response)) return false;

  // Runtime cache is mainly for same-origin; allow CDN (opaque) but keep it tight
  const url = request.url || '';
  if (!isSameOrigin(url) && !url.startsWith('https://unpkg.com/')) return false;

  return true;
}

async function getVmqCacheKeys() {
  try {
    const keys = await caches.keys();
    return keys.filter(isVmqCacheName).sort();
  } catch {
    return [];
  }
}

// ------------------------------------------------------------
// Lightweight state + metrics (kept)
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
  await broadcastToClients({
    type: 'SW_PERFORMANCE_METRICS',
    metrics: {
      ...perf,
      cacheHitRate: mlState.cacheHitRate || 0,
      prefetchAccuracy: perf.cacheHits ? (perf.prefetchHits / perf.cacheHits) : 0
    }
  });
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
      // Trim ML cache first (safe to drop)
      const cache = await caches.open(CACHE_ML);
      const keys = await cache.keys();
      const toDelete = keys.slice(0, Math.floor(keys.length / 2));
      await Promise.all(toDelete.map(req => cache.delete(req)));
    }
  } catch {}
}

// ------------------------------------------------------------
// ML-ish nav history (kept + improved prefetch safety)
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
  if (mlState.navigationHistory.length > 80) {
    mlState.navigationHistory.splice(0, mlState.navigationHistory.length - 80);
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
    .slice(0, 4)
    .map(([route, score]) => ({ route, score }));

  mlState.lastPredictionTime = Date.now();
  return sorted;
}

// Map known route ids to lazy component URLs (aligns with App.js lazy imports)
const ROUTE_TO_COMPONENT = Object.freeze({
  intervals:   './js/components/Intervals.js',
  keys:        './js/components/KeySignatures.js',
  rhythm:      './js/components/Rhythm.js',
  bieler:      './js/components/Bieler.js',
  fingerboard: './js/components/Fingerboard.js',
  scales:      './js/components/ScalesLab.js',
  flashcards:  './js/components/Flashcards.js',
});

function toAbsoluteUrl(spec) {
  try { return new URL(spec, BASE_URL).href; } catch { return null; }
}
function looksLikeJs(url) {
  try {
    const u = new URL(url);
    return (u.pathname || '').toLowerCase().endsWith('.js');
  } catch {
    return String(url).toLowerCase().endsWith('.js');
  }
}
function resolvePrefetchURL(routeOrUrl) {
  if (!routeOrUrl) return null;
  const raw = String(routeOrUrl).trim();
  if (!raw) return null;

  // Full URL
  if (/^https?:\/\//i.test(raw)) return raw;

  // Absolute path
  if (raw.startsWith('/')) return `${ORIGIN}${raw}`;

  // Route id -> component
  const route = raw.replace(/^#/, '').split('?')[0].toLowerCase();
  if (ROUTE_TO_COMPONENT[route]) return toAbsoluteUrl(ROUTE_TO_COMPONENT[route]);

  // Direct file hints
  if (raw.endsWith('.js')) return toAbsoluteUrl(raw.startsWith('./') ? raw : `./${raw}`);

  return null;
}

async function prefetchURLs(urls) {
  if (!Array.isArray(urls) || !urls.length) return;

  for (const u of urls) {
    const url = resolvePrefetchURL(u);
    if (!url) continue;

    const sameOrigin = isSameOrigin(url);
    const jsLike = looksLikeJs(url);

    // Prefetched JS should go in MODULES cache for reliability.
    // Other speculative data can stay in ML cache.
    const targetCacheName = jsLike ? CACHE_MODULES : CACHE_ML;
    let cache;
    try { cache = await caches.open(targetCacheName); } catch { continue; }

    // For same-origin, use a normal request so we can read headers and avoid caching HTML.
    // For cross-origin, no-cors may produce opaque (fine for known CDNs).
    const reqInit = sameOrigin
      ? { method: 'GET', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store' }
      : { method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store' };

    const req = new Request(url, reqInit);

    try {
      const already = await cache.match(req);
      if (already) continue;

      const resp = await fetch(req);

      // Poison protection:
      // - If we can see headers (same-origin), never cache HTML as a module/data.
      // - If opaque, we can't inspect; keep it only for cross-origin (expected).
      if (sameOrigin && isHTMLResponse(resp)) continue;

      // For JS modules, avoid caching obviously-bad non-cacheable responses.
      if (isCacheableResponse(resp)) {
        await cache.put(req, resp.clone());
      }
    } catch {}
  }
}

// ------------------------------------------------------------
// Offline analytics queue (kept)
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

    await broadcastToClients({ type: 'SYNC_ANALYTICS', data: { events: unsynced } });

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
  // Keep behavior: activate quickly
  self.skipWaiting();

  event.waitUntil((async () => {
    try { await openIDB(); } catch {}

    const cache = await caches.open(CACHE_CORE);

    // Add individually so one missing file never bricks install.
    await Promise.all(CORE_FILES.map(async (url) => {
      try {
        const isCdn = String(url).startsWith('https://unpkg.com/');
        const req = new Request(url, {
          cache: 'reload',
          mode: isCdn ? 'no-cors' : 'same-origin',
          credentials: 'omit'
        });
        const resp = await fetch(req);
        if (isCacheableResponse(resp)) await cache.put(req, resp.clone());
      } catch {}
    }));
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
      if (isVmqCacheName(k) && !valid.has(k)) return caches.delete(k);
      return Promise.resolve(false);
    }));

    await self.clients.claim();
    await manageCacheQuota().catch(() => {});
    await syncAnalyticsQueue().catch(() => {});

    // Notify clients that the new SW is active / update is available
    await broadcastToClients({ type: 'VMQ_SW_ACTIVE', data: { version: VMQ_VERSION, scope: BASE_PATH } });
    await broadcastToClients({ type: 'vmq-update-available', data: { version: VMQ_VERSION } });
  })());
});

// ------------------------------------------------------------
// FETCH
// ------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!request || request.method !== 'GET') return;

  // Provide a simple JSON endpoint so offline.html can display cache version safely.
  // This never touches app routes and is safe to call even while offline.
  if (request.url === CACHE_STATUS_URL) {
    event.respondWith((async () => {
      const cachesList = await getVmqCacheKeys();
      return jsonResponse({ version: VMQ_VERSION, scope: BASE_PATH, caches: cachesList });
    })());
    return;
  }

  // NAVIGATION: network-first, offline fallback (documents only)
  if (isNavigationRequest(request)) {
    event.respondWith((async () => {
      try {
        const net = await fetch(request);
        mlState.isOnline = true;

        // If we got HTML, keep SPA shell fresh
        if (net && isCacheableResponse(net) && isHTMLResponse(net)) {
          try {
            const runtime = await caches.open(CACHE_RUNTIME);
            // Keep a fresh index shell for offline boot
            await runtime.put(INDEX_URL, net.clone());
            // Also store the specific navigation URL (helps deep links)
            await runtime.put(request, net.clone());
          } catch {}
        }
        return net;
      } catch {
        mlState.isOnline = false;

        // Prefer cached navigation URL, then cached INDEX, then offline page
        const cachedNav = await caches.match(request);
        if (cachedNav) return cachedNav;

        const cachedIndex = await caches.match(INDEX_URL);
        if (cachedIndex) return cachedIndex;

        const offline = await caches.match(OFFLINE_URL);
        return offline || fail503('Offline');
      }
    })());
    return;
  }

  // ASSETS: cache-first + SWR, poison-cache protection
  event.respondWith((async () => {
    const { response: cached, cacheName } = await matchAnyCache(request);

    // If cached response is HTML but request is an asset => poison cache: delete + treat as miss
    if (cached && isAssetDestination(request) && isHTMLResponse(cached)) {
      event.waitUntil(deleteFromAllCaches(request));
    } else if (cached) {
      recordHit(cacheName === CACHE_ML || cacheName === CACHE_MODULES);

      // Background SWR update
      event.waitUntil((async () => {
        try {
          const net = await fetch(request);
          mlState.isOnline = true;

          // HARD RULE: never store HTML for script/style/worker
          if (isAssetDestination(request) && isHTMLResponse(net)) return;

          if (shouldCacheRuntime(request, net)) {
            const runtime = await caches.open(CACHE_RUNTIME);
            await runtime.put(request, net.clone());
          }
        } catch {
          mlState.isOnline = false;
        }
      })());

      return cached;
    }

    // Cache miss -> network
    recordMiss();
    try {
      const net = await fetch(request);
      mlState.isOnline = true;

      // HARD RULE: never return HTML for script/style/worker
      if (isAssetDestination(request) && isHTMLResponse(net)) {
        return new Response('Blocked: HTML returned for asset request (poison protection)', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      if (shouldCacheRuntime(request, net)) {
        const runtime = await caches.open(CACHE_RUNTIME);
        runtime.put(request, net.clone()).catch(() => {});
      }

      return net;
    } catch {
      mlState.isOnline = false;
      // Non-nav offline: NEVER return offline.html
      return fail503('Offline');
    }
  })());
});

// ------------------------------------------------------------
// MESSAGE (kept + escape hatch)
// ------------------------------------------------------------
self.addEventListener('message', (event) => {
  const data = event?.data || {};
  const reply = (payload) => {
    if (event.ports && event.ports[0]) {
      try { event.ports[0].postMessage(payload); } catch {}
    }
  };

  if (data.type === 'CACHE_STATUS') {
    event.waitUntil((async () => {
      const keys = await getVmqCacheKeys();
      reply({
        type: 'CACHE_STATUS_REPLY',
        version: VMQ_VERSION,
        status: 'active',
        scope: BASE_PATH,
        caches: keys,
        mlState: {
          cacheHitRate: mlState.cacheHitRate,
          isOnline: mlState.isOnline,
          navigationHistorySize: mlState.navigationHistory.length
        }
      });
    })());
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Hard escape hatch: delete all vmq-* caches (lets index.html “Recover” work deterministically)
  if (data.type === 'VMQ_CLEAR_ALL_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(isVmqCacheName).map(k => caches.delete(k)));
    })());
    return;
  }

  // App.js sends this on hash changes
  if (data.type === 'NAVIGATION') {
    const route = data.route;
    event.waitUntil((async () => {
      await updateNavigationHistory(route);

      // Predict likely next routes and prefetch their lazy modules (best-effort)
      const preds = await predictNextRoutes(String(route || ''));
      const routes = preds.map(p => p.route);

      // Tell client what we think (nice for dashboards / debugging)
      await broadcastToClients({ type: 'NAV_PREDICTIONS', data: { from: route, predictions: preds } });

      // Prefetch what we can resolve (e.g., intervals/keys/rhythm/...)
      await prefetchURLs(routes);
    })());
    return;
  }

  // Optional: explicit cache warmup from client
  if (data.type === 'WARM_CACHE') {
    event.waitUntil(prefetchURLs(data.routes));
    return;
  }

  // Optional: queue analytics when offline
  if (data.type === 'ANALYTICS_EVENT') {
    const evt = data.event;
    if (mlState.isOnline) {
      event.waitUntil(broadcastToClients({ type: 'ANALYTICS_EVENT', data: { event: evt } }));
    } else {
      event.waitUntil(queueAnalyticsEvent(evt));
    }
    return;
  }

  if (data.type === 'REQUEST_METRICS') {
    event.waitUntil(reportPerformanceMetrics());
  }
});

// ------------------------------------------------------------
// BACKGROUND SYNC (kept)
// ------------------------------------------------------------
self.addEventListener('sync', (event) => {
  const tag = event.tag;
  if (tag === 'sync-analytics') {
    event.waitUntil(syncAnalyticsQueue());
    return;
  }
  if (tag === 'sync-sm2') {
    event.waitUntil(broadcastToClients({ type: 'SYNC_SM2', data: { timestamp: Date.now() } }));
  }
});

// ------------------------------------------------------------
// PERIODIC SYNC (kept)
// ------------------------------------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-due-items') {
    event.waitUntil(broadcastToClients({ type: 'CHECK_DUE_ITEMS', data: { timestamp: Date.now() } }));
  }
});

console.log(`[SW v${VMQ_VERSION}] VMQ Service Worker loaded (scope: ${BASE_PATH})`);
