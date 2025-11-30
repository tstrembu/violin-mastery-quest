// sw.js - Service Worker for Violin Mastery Quest
// Provides offline support and caching

const CACHE_VERSION = 'vmq-v1.0.1';
const CACHE_NAME = `vmq-cache-${CACHE_VERSION}`;

// Files to cache immediately (your app shell)
const STATIC_CACHE = [
  '/violin-mastery-quest/',
  '/violin-mastery-quest/index.html',
  '/violin-mastery-quest/404.html',
  '/violin-mastery-quest/css/base.css',
  '/violin-mastery-quest/css/components.css',
  '/violin-mastery-quest/css/themes.css',
  '/violin-mastery-quest/js/App.js',
  '/violin-mastery-quest/js/config/constants.js',
  '/violin-mastery-quest/js/config/storage.js',
  '/violin-mastery-quest/js/utils/helpers.js',
  '/violin-mastery-quest/js/engines/audioEngine.js',
  '/violin-mastery-quest/js/engines/spacedRepetition.js',
  '/violin-mastery-quest/js/engines/difficultyAdapter.js',
  '/violin-mastery-quest/js/components/MainMenu.js',
  '/violin-mastery-quest/js/components/Intervals.js',
  '/violin-mastery-quest/js/components/Flashcards.js',
  '/violin-mastery-quest/js/components/Bieler.js',
  '/violin-mastery-quest/js/components/Rhythm.js',
  '/violin-mastery-quest/js/components/KeySignatures.js',
  '/violin-mastery-quest/js/components/Fingerboard.js',
  '/violin-mastery-quest/js/components/Settings.js',
  '/violin-mastery-quest/js/components/Toast.js'
];

// External resources (cache at runtime)
const RUNTIME_CACHE_HOSTS = [
  'unpkg.com'  // React CDN
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE).catch((error) => {
        console.warn('Cache addAll failed, continuing anyway:', error);
      });
    }).then(() => {
      return self.skipWaiting(); // Activate immediately
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Don't cache range requests (for audio/video seeking)
  if (request.headers.has('range')) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(request).then((networkResponse) => {
        // Cache successful responses from allowed hosts
        if (networkResponse && networkResponse.ok) {
          const url = new URL(request.url);
          const shouldCache = 
            url.origin === self.location.origin || 
            RUNTIME_CACHE_HOSTS.some(host => url.hostname.includes(host));

          if (shouldCache) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
        }

        return networkResponse;
      }).catch(() => {
        // If both cache and network fail, return offline page for navigations
        if (request.mode === 'navigate') {
          return caches.match('/violin-mastery-quest/index.html');
        }
        return new Response('Offline', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      });
    })
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
