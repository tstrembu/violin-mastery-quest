// ======================================
// VMQ SERVICE WORKER v3.0.0 - PRODUCTION
// ======================================

const VMQ_VERSION = '3.0.0';
const CACHE_CORE = `vmq-core-v${VMQ_VERSION}`;
const CACHE_MODULES = `vmq-modules-v${VMQ_VERSION}`;
const CACHE_RUNTIME = `vmq-runtime-v${VMQ_VERSION}`;
const OFFLINE_URL = './offline.html';

// 🎯 VMQ CORE FILES
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/components.css',
  './css/themes.css',
  './css/animations.css',
  './js/App.js',
  './js/bootstrap.js',
  './js/config/constants.js',
  './js/config/storage.js',
  './js/config/repertoirePlans.js',
  './js/utils/helpers.js',
  './js/utils/keyboard.js',
  './js/utils/router.js',
  './js/contexts/AppContext.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // React CDN fallback (if you keep using CDN)
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

  // Components - Core
  './js/components/Toast.js',
  './js/components/MainMenu.js',
  './js/components/Dashboard.js',
  './js/components/Analytics.js',
  './js/components/Settings.js',
  './js/components/Welcome.js',

  // Components - Learning
  './js/components/Intervals.js',
  './js/components/KeySignatures.js',
  './js/components/Rhythm.js',
  './js/components/Bieler.js',
  './js/components/Fingerboard.js',
  './js/components/ScalesLab.js',
  './js/components/PositionCharts.js',

  // Components - Ear Training & Drills
  './js/components/IntervalEarTester.js',
  './js/components/IntervalSprint.js',
  './js/components/KeyTester.js',
  './js/components/RhythmDrills.js',
  './js/components/BielerLab.js',
  './js/components/TempoTrainer.js',

  // Components - Advanced
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

// Utility: only cache safe same‑origin GETs
function shouldCacheRuntime(request, response) {
  if (request.method !== 'GET') return false;
  if (!response || response.status !== 200) return false;
  // Do not cache cross‑origin except React CDNs already in CORE
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (response.type !== 'basic' && response.type !== 'default') return false;
  return true;
}

// 🎯 INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_CORE).then(cache => cache.addAll(CORE_FILES)),
      caches.open(CACHE_MODULES).then(cache => cache.addAll(MODULE_FILES))
    ])
      .then(() => {
        console.log('[SW] VMQ core+modules cached v' + VMQ_VERSION);
      })
      .catch(err => {
        console.error('[SW] Caching during install failed:', err);
      })
  );
});

// 🎯 ACTIVATE (Cleanup)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const validCaches = [CACHE_CORE, CACHE_MODULES, CACHE_RUNTIME];
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.startsWith('vmq-') && !validCaches.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 🎯 FETCH (Stale‑While‑Revalidate + offline.html for navigation)
self.addEventListener('fetch', event => {
  const { request } = event;

  // Navigation requests → HTML shell or offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first to get latest shell
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_RUNTIME);
            cache.put('./index.html', networkResponse.clone());
            return networkResponse;
          }
          const cachedIndex = await caches.match('./index.html');
          return cachedIndex || (await caches.match(OFFLINE_URL));
        } catch {
          const cachedIndex = await caches.match('./index.html');
          return cachedIndex || (await caches.match(OFFLINE_URL));
        }
      })()
    );
    return;
  }

  // Static/assets: stale‑while‑revalidate
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Update in background
        fetch(request)
          .then(networkResponse => {
            if (shouldCacheRuntime(request, networkResponse)) {
              caches.open(CACHE_RUNTIME).then(cache => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Not in cache → network, then optionally cache
      return fetch(request)
        .then(networkResponse => {
          if (shouldCacheRuntime(request, networkResponse)) {
            const clone = networkResponse.clone();
            caches.open(CACHE_RUNTIME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback for navigations already handled above
          if (request.destination === 'document') {
            return (await caches.match(OFFLINE_URL)) || Response.error();
          }
          return Response.error();
        });
    })
  );
});

// 🎯 APP COMMUNICATION / ANALYTICS HOOKS
self.addEventListener('message', event => {
  const data = event.data || {};

  if (data.type === 'CACHE_STATUS' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      type: 'CACHE_STATUS_REPLY',
      version: VMQ_VERSION,
      status: 'active',
      caches: [CACHE_CORE, CACHE_MODULES, CACHE_RUNTIME]
    });
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Used by share.html to attach extra metadata to IndexedDB/local storage via clients
  if (data.type === 'HANDLE_SHARE') {
    // Broadcast to all clients; App/bootstrap can route into analytics/storage engines.
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
});
