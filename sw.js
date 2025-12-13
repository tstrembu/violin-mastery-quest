// ===================================
// VMQ SERVICE WORKER v3.0.0 - ML-ENHANCED
// Predictive Prefetching • Offline Analytics • Background Sync
// ===================================

const VMQ_VERSION = '3.0.0';
const CACHE_CORE = `vmq-core-v${VMQ_VERSION}`;
const CACHE_MODULES = `vmq-modules-v${VMQ_VERSION}`;
const CACHE_RUNTIME = `vmq-runtime-v${VMQ_VERSION}`;
const CACHE_ML = `vmq-ml-v${VMQ_VERSION}`;
const OFFLINE_URL = './offline.html';

// IDB for offline analytics queue
const IDB_NAME = 'vmq-offline';
const IDB_VERSION = 1;
const STORE_ANALYTICS = 'analytics-queue';
const STORE_SYNC = 'sync-queue';
const STORE_ML_PREDICTIONS = 'ml-predictions';

// 🎯 VMQ CORE FILES
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './js/App.js',
  './js/bootstrap.js',
  
  // CSS
  './css/base.css',
  './css/components.css',
  './css/themes.css',
  './css/animations.css',
  
  // Config
  './js/config/constants.js',
  './js/config/storage.js',
  './js/config/repertoirePlans.js',
  './js/config/version.js',
  
  // Contexts
  './js/contexts/AppContext.js',
  
  // Icons
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  
  // Utils
  './js/utils/helpers.js',
  './js/utils/keyboard.js',
  './js/utils/router.js',
  
  // React
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
];

// 🎯 COMPLETE MODULE LIST
const MODULE_FILES = [
  // Engines
  './js/engines/audioEngine.js',
  './js/engines/spacedRepetition.js',
  './js/engines/gamification.js',
  './js/engines/analytics.js',
  './js/engines/coachEngine.js',
  './js/engines/pedagogyEngine.js',
  './js/engines/sessionTracker.js',
  './js/engines/difficultyAdapter.js',

  // Components
  './js/components/Toast.js',
  './js/components/MainMenu.js',
  './js/components/Dashboard.js',
  './js/components/Analytics.js',
  './js/components/Settings.js',
  './js/components/Welcome.js',
  './js/components/Intervals.js',
  './js/components/KeySignatures.js',
  './js/components/Rhythm.js',
  './js/components/Bieler.js',
  './js/components/Fingerboard.js',
  './js/components/ScalesLab.js',
  './js/components/PositionCharts.js',
  './js/components/IntervalEarTester.js',
  './js/components/IntervalSprint.js',
  './js/components/KeyTester.js',
  './js/components/RhythmDrills.js',
  './js/components/BielerLab.js',
  './js/components/TempoTrainer.js',
  './js/components/CoachPanel.js',
  './js/components/DailyGoals.js',
  './js/components/Achievements.js',
  './js/components/PracticePlanner.js',
  './js/components/PracticeJournal.js',
  './js/components/StatsVisualizer.js',
  './js/components/SpeedDrill.js',
  './js/components/Snapshot.js',
  './js/components/NoteLocator.js',
  './js/components/CustomDrill.js',
  './js/components/Flashcards.js',
  './js/components/DataManager.js',
  './js/components/ReferenceLibrary.js',
  './js/components/Testers.js'
];

// 🎯 ML STATE
let mlState = {
  navigationHistory: [],
  prefetchQueue: [],
  cacheHitRate: 0,
  lastPredictionTime: 0,
  userPatterns: null,
  isOnline: true
};

// ===================================
// INDEXEDDB SETUP
// ===================================
function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_ANALYTICS)) {
        const analyticsStore = db.createObjectStore(STORE_ANALYTICS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
        analyticsStore.createIndex('synced', 'synced', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORE_SYNC)) {
        const syncStore = db.createObjectStore(STORE_SYNC, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORE_ML_PREDICTIONS)) {
        db.createObjectStore(STORE_ML_PREDICTIONS, { keyPath: 'key' });
      }
    };
  });
}

// Promisify IDBRequest results (native IndexedDB API is callback-based)
function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ===================================
// ML PREDICTIVE PREFETCHING
// ===================================
async function updateNavigationHistory(route) {
  mlState.navigationHistory.push({
    route,
    timestamp: Date.now(),
    hour: new Date().getHours()
  });
  
  // Keep last 50 navigations
  if (mlState.navigationHistory.length > 50) {
    mlState.navigationHistory.shift();
  }
  
  // Save to IDB
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_ML_PREDICTIONS, 'readwrite');
    const store = tx.objectStore(STORE_ML_PREDICTIONS);
    await idbReq(store.put({
      key: 'navigationHistory',
       data: mlState.navigationHistory
    }));
  } catch (e) {
    console.warn('[SW ML] Failed to save nav history:', e);
  }
}

async function predictNextRoutes(currentRoute) {
  // Load navigation history from IDB if needed
  if (mlState.navigationHistory.length === 0) {
    try {
      const db = await openIDB();
      const tx = db.transaction(STORE_ML_PREDICTIONS, 'readonly');
      const store = tx.objectStore(STORE_ML_PREDICTIONS);
      const result = await idbReq(store.get('navigationHistory'));
      if (result && result.data) {
        mlState.navigationHistory = result.data;
      }
    } catch (e) {
      console.warn('[SW ML] Failed to load nav history:', e);
    }
  }
  
  const currentHour = new Date().getHours();
  const predictions = {};
  
  // Analyze navigation patterns
  mlState.navigationHistory.forEach((nav, index) => {
    if (nav.route === currentRoute && index < mlState.navigationHistory.length - 1) {
      const nextRoute = mlState.navigationHistory[index + 1].route;
      predictions[nextRoute] = (predictions[nextRoute] || 0) + 1;
      
      // Boost weight if same hour
      if (Math.abs(nav.hour - currentHour) <= 1) {
        predictions[nextRoute] += 0.5;
      }
    }
  });
  
  // Sort by probability
  const sorted = Object.entries(predictions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([route, score]) => ({ route, score }));
  
  mlState.lastPredictionTime = Date.now();
  
  console.log('[SW ML] Predicted next routes:', sorted);
  return sorted;
}

async function prefetchPredictedRoutes(predictions) {
  for (const prediction of predictions) {
    const moduleUrl = `./js/components/${prediction.route}.js`;
    
    // Check if already cached
    const cached = await caches.match(moduleUrl);
    if (cached) continue;
    
    // Prefetch
    try {
      console.log(`[SW ML] Prefetching ${moduleUrl}`);
      const response = await fetch(moduleUrl);
      if (response.ok) {
        const cache = await caches.open(CACHE_ML);
        cache.put(moduleUrl, response);
      }
    } catch (e) {
      console.warn(`[SW ML] Prefetch failed for ${moduleUrl}:`, e);
    }
  }
}

// ===================================
// OFFLINE ANALYTICS QUEUE
// ===================================
async function queueAnalyticsEvent(event) {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_ANALYTICS, 'readwrite');
    const store = tx.objectStore(STORE_ANALYTICS);
    
    await idbReq(store.add({
      ...event,
      timestamp: Date.now(),
      synced: false
    }));
    
    console.log('[SW Analytics] Event queued for offline sync');
  } catch (e) {
    console.error('[SW Analytics] Failed to queue event:', e);
  }
}

async function syncAnalyticsQueue() {
  if (!mlState.isOnline) return;
  
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_ANALYTICS, 'readwrite');
    const store = tx.objectStore(STORE_ANALYTICS);
    const index = store.index('synced');
    const unsyncedEvents = await idbReq(index.getAll(false));
    
    if (unsyncedEvents.length === 0) {
      console.log('[SW Analytics] No events to sync');
      return;
    }
    
    console.log(`[SW Analytics] Syncing ${unsyncedEvents.length} queued events`);
    
    // Send to all connected clients
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ANALYTICS',
        events: unsyncedEvents
      });
    });
    
    // Mark as synced
    const updateTx = db.transaction(STORE_ANALYTICS, 'readwrite');
    const updateStore = updateTx.objectStore(STORE_ANALYTICS);
    
    for (const event of unsyncedEvents) {
      event.synced = true;
      await idbReq(updateStore.put(event));
    }
    
    console.log('[SW Analytics] Queue synced successfully');
  } catch (e) {
    console.error('[SW Analytics] Sync failed:', e);
  }
}

// ===================================
// CACHE MANAGEMENT
// ===================================
async function shouldCacheRuntime(request, response) {
  if (request.method !== 'GET') return false;
  if (!response || response.status !== 200) return false;
  
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (response.type !== 'basic' && response.type !== 'default') return false;
  
  return true;
}

async function manageCacheQuota() {
  if (!navigator.storage || !navigator.storage.estimate) return;
  
  try {
    const estimate = await navigator.storage.estimate();
    const usagePercent = (estimate.usage / estimate.quota) * 100;
    
    console.log(`[SW Cache] Usage: ${usagePercent.toFixed(2)}%`);
    
    // If over 80% quota, evict least-used ML cache entries
    if (usagePercent > 80) {
      console.log('[SW Cache] Quota exceeded, evicting ML cache');
      const cache = await caches.open(CACHE_ML);
      const keys = await cache.keys();
      
      // Delete oldest 50%
      const toDelete = keys.slice(0, Math.floor(keys.length / 2));
      for (const request of toDelete) {
        await cache.delete(request);
      }
    }
  } catch (e) {
    console.warn('[SW Cache] Quota management failed:', e);
  }
}

// ===================================
// PERFORMANCE MONITORING
// ===================================
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  prefetchHits: 0,
  totalRequests: 0
};

function recordCacheHit(fromPrefetch = false) {
  performanceMetrics.cacheHits++;
  performanceMetrics.totalRequests++;
  if (fromPrefetch) performanceMetrics.prefetchHits++;
  
  mlState.cacheHitRate = performanceMetrics.cacheHits / performanceMetrics.totalRequests;
}

function recordCacheMiss() {
  performanceMetrics.cacheMisses++;
  performanceMetrics.totalRequests++;
  mlState.cacheHitRate = performanceMetrics.cacheHits / performanceMetrics.totalRequests;
}

async function reportPerformanceMetrics() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'SW_PERFORMANCE_METRICS',
      metrics: {
        ...performanceMetrics,
        cacheHitRate: mlState.cacheHitRate,
        prefetchAccuracy: performanceMetrics.prefetchHits / performanceMetrics.cacheHits
      }
    });
  });
}

// ===================================
// INSTALL
// ===================================
self.addEventListener('install', event => {
  console.log(`[SW v${VMQ_VERSION}] Installing with ML enhancements...`);
  self.skipWaiting();
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_CORE).then(cache => cache.addAll(CORE_FILES)),
      caches.open(CACHE_MODULES).then(cache => cache.addAll(MODULE_FILES)),
      openIDB() // Initialize IDB
    ])
      .then(() => {
        console.log(`[SW v${VMQ_VERSION}] ✓ Core+modules cached, IDB ready`);
      })
      .catch(err => {
        console.error('[SW] Caching during install failed:', err);
      })
  );
});

// ===================================
// ACTIVATE
// ===================================
self.addEventListener('activate', event => {
  console.log(`[SW v${VMQ_VERSION}] Activating...`);
  
  event.waitUntil(
    Promise.all([
      // Cleanup old caches
      caches.keys().then(cacheNames => {
        const validCaches = [CACHE_CORE, CACHE_MODULES, CACHE_RUNTIME, CACHE_ML];
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.startsWith('vmq-') && !validCaches.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      }),
      
      // Claim clients
      self.clients.claim(),
      
      // Manage cache quota
      manageCacheQuota(),
      
      // Sync analytics queue if online
      syncAnalyticsQueue()
    ]).then(() => {
      console.log(`[SW v${VMQ_VERSION}] ✓ Active with ML predictive caching`);
    })
  );
});

// ===================================
// FETCH (ML-Enhanced)
// ===================================
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Navigation requests → HTML shell or offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_RUNTIME);
            cache.put('./index.html', networkResponse.clone());
            return networkResponse;
          }
          const cachedIndex = await caches.match('./index.html');
          return cachedIndex || (await caches.match(OFFLINE_URL));
        } catch {
          mlState.isOnline = false;
          const cachedIndex = await caches.match('./index.html');
          return cachedIndex || (await caches.match(OFFLINE_URL));
        }
      })()
    );
    return;
  }
  
  // Static/assets: ML-enhanced stale-while-revalidate
  event.respondWith(
    (async () => {
      // Try cache first (all cache levels)
      const cacheNames = [CACHE_CORE, CACHE_MODULES, CACHE_ML, CACHE_RUNTIME];
      let cachedResponse = null;
      let cacheSource = null;
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const response = await cache.match(request);
        if (response) {
          cachedResponse = response;
          cacheSource = cacheName;
          break;
        }
      }
      
      if (cachedResponse) {
        recordCacheHit(cacheSource === CACHE_ML);
        
        // Update in background
        fetch(request)
          .then(async networkResponse => {
            mlState.isOnline = true;
            if (await shouldCacheRuntime(request, networkResponse)) {
              const cache = await caches.open(CACHE_RUNTIME);
              cache.put(request, networkResponse.clone());
            }
          })
          .catch(() => {
            mlState.isOnline = false;
          });
        
        return cachedResponse;
      }
      
      // Not in cache → network
      recordCacheMiss();
      
      try {
        const networkResponse = await fetch(request);
        mlState.isOnline = true;
        
        if (await shouldCacheRuntime(request, networkResponse)) {
          const clone = networkResponse.clone();
          const cache = await caches.open(CACHE_RUNTIME);
          cache.put(request, clone);
        }
        
        return networkResponse;
      } catch {
        mlState.isOnline = false;
        
        // Offline fallback
        if (request.destination === 'document') {
          return (await caches.match(OFFLINE_URL)) || new Response('Offline', { status: 503 });
        }
        
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});

// ===================================
// MESSAGE HANDLING (ML-Enhanced)
// ===================================
self.addEventListener('message', event => {
  const data = event.data || {};
  
  // Cache status check
  if (data.type === 'CACHE_STATUS' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({
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
  }
  
  // Skip waiting
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // ML: Navigation event for prediction
  if (data.type === 'NAVIGATION') {
    const { route } = data;
    
    updateNavigationHistory(route).then(() => {
      predictNextRoutes(route).then(predictions => {
        if (predictions.length > 0) {
          prefetchPredictedRoutes(predictions);
        }
      });
    });
  }
  
  // Analytics event (queue if offline)
  if (data.type === 'ANALYTICS_EVENT') {
    if (mlState.isOnline) {
      // Forward to clients
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'ANALYTICS_EVENT',
            event: data.event
          });
        });
      });
    } else {
      // Queue for later sync
      queueAnalyticsEvent(data.event);
    }
  }
  
  // Share target handling
  if (data.type === 'HANDLE_SHARE') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'HANDLE_SHARE',
          payload: {
            title: data.title,
            text: data.text,
            url: data.url,
            timestamp: Date.now()
          }
        });
      });
    });
  }
  
  // Request performance metrics
  if (data.type === 'REQUEST_METRICS') {
    reportPerformanceMetrics();
  }
  
  // Manual cache warming
  if (data.type === 'WARM_CACHE') {
    const { routes } = data;
    if (routes && routes.length > 0) {
      prefetchPredictedRoutes(routes.map(route => ({ route, score: 1 })));
    }
  }
});

// ===================================
// BACKGROUND SYNC
// ===================================
self.addEventListener('sync', event => {
  console.log('[SW Sync] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalyticsQueue());
  }
  
  if (event.tag === 'sync-sm2') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_SM2',
            timestamp: Date.now()
          });
        });
      })
    );
  }
});

// ===================================
// PERIODIC BACKGROUND SYNC
// ===================================
self.addEventListener('periodicsync', event => {
  console.log('[SW Periodic Sync]:', event.tag);
  
  if (event.tag === 'check-due-items') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CHECK_DUE_ITEMS',
            timestamp: Date.now()
          });
        });
      })
    );
  }
});

// ===================================
// PUSH NOTIFICATIONS
// ===================================
self.addEventListener('push', event => {
  console.log('[SW Push] Notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Violin Mastery Quest';
  const options = {
    body: data.body || 'Time to practice!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
     data: data.data || {},
    tag: data.tag || 'vmq-notification',
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[SW Push] Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window or open new one
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// ===================================
// PERIODIC TASKS
// ===================================

console.log(`[SW v${VMQ_VERSION}] 🎻 VMQ Service Worker loaded with ML enhancements`);