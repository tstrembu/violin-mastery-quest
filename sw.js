// ======================================
// VMQ SERVICE WORKER v2.1.1 - PRODUCTION READY
// ======================================

const VMQ_VERSION = '2.1.1';
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

// 🎯 INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_CORE).then(cache => {
          // We map over files to catch individual errors without failing the whole install
          // but for production, strict caching is usually better.
          return cache.addAll(CORE_FILES);
      }),
      caches.open(CACHE_MODULES).then(cache => {
          return cache.addAll(MODULE_FILES);
      })
    ]).then(() => {
        console.log('[SW] All files cached successfully');
    }).catch(err => {
        console.error('[SW] Caching failed:', err);
    })
  );
});

// 🎯 ACTIVATE (Cleanup)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      const validCaches = [CACHE_CORE, CACHE_MODULES, CACHE_RUNTIME];
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('vmq-') && !validCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 🎯 FETCH (Stale-While-Revalidate)
self.addEventListener('fetch', event => {
  // Navigation fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Asset Strategy
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Serve from cache immediately if available
      if (cachedResponse) {
        // 2. Update cache in background (Stale-While-Revalidate)
        fetch(event.request).then(networkResponse => {
          if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_RUNTIME).then(cache => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
           // Network failed, but we already served the cached version.
        });
        return cachedResponse;
      }
      
      // 3. If not in cache, go to network
      return fetch(event.request).then(response => {
         // Optionally cache new runtime requests
         return response;
      });
    }).catch(() => {
      // 4. Offline Fallback for specific file types if needed
      if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
      }
    })
  );
});

// 🎯 APP COMMUNICATION
self.addEventListener('message', event => {
  const data = event.data;
  
  if (data && data.type === 'CACHE_STATUS') {
    event.ports[0].postMessage({
      type: 'CACHE_STATUS_REPLY',
      version: VMQ_VERSION,
      status: 'active',
      caches: [CACHE_CORE, CACHE_MODULES]
    });
  }
  
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});