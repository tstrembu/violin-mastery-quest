// VMQ SERVICE WORKER v2.1.1 - GitHub Pages Optimized
const VMQ_VERSION = '2.1.1';
const BUILD_DATE = '2024-12-06';
const CACHE_NAME = `vmq-v${VMQ_VERSION}-${BUILD_DATE}`;

// Dynamic base path detection
const getBasePath = () => self.location.pathname.replace('/sw.js', '');
const BASE = getBasePath();

// Helper for full paths
const p = (path) => {
  if (path.startsWith('http')) return path;
  return `${BASE}/${path.replace(/^\.?\//, '')}`.replace(/\/+/g, '/');
};

// Core files (always needed)
const CORE_FILES = [
  '', 'index.html', 'manifest.json', 'offline.html',
  'css/base.css', 'css/components.css', 'css/themes.css', 'css/animations.css',
  'js/App.js', 'js/config/constants.js', 'js/config/storage.js', 'js/config/version.js',
  'js/utils/helpers.js', 'js/utils/keyboard.js', 'js/utils/router.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
].map(p);

// All 50+ module files (learning components)
const MODULE_FILES = [
  // Engines
  'js/engines/audioEngine.js', 'js/engines/spacedRepetition.js',
  'js/engines/gamification.js', 'js/engines/sessionTracker.js',
  'js/engines/difficultyAdapter.js',
  
  // Core UI
  'js/components/Toast.js', 'js/components/MainMenu.js',
  'js/components/Dashboard.js', 'js/components/Settings.js',
  'js/components/Welcome.js', 'js/components/Analytics.js',
  
  // Music Theory
  'js/components/Intervals.js', 'js/components/KeySignatures.js',
  'js/components/Rhythm.js', 'js/components/Bieler.js',
  'js/components/Fingerboard.js', 'js/components/ScalesLab.js',
  'js/components/PositionCharts.js',
  
  // Ear Training
  'js/components/IntervalEarTester.js', 'js/components/IntervalSprint.js',
  'js/components/KeyTester.js',
  
  // Drills
  'js/components/RhythmDrills.js', 'js/components/SpeedDrill.js',
  'js/components/TempoTrainer.js', 'js/components/CustomDrill.js',
  'js/components/Snapshot.js', 'js/components/NoteLocator.js',
  
  // Gamification
  'js/components/CoachPanel.js', 'js/components/DailyGoals.js',
  'js/components/Achievements.js', 'js/components/PracticeJournal.js',
  'js/components/PracticePlanner.js', 'js/components/StatsVisualizer.js',
  
  // Advanced
  'js/components/Flashcards.js', 'js/components/DataManager.js',
  'js/components/ReferenceLibrary.js'
].map(p);

const ALL_FILES = [...CORE_FILES, ...MODULE_FILES];

// Install - cache everything
self.addEventListener('install', event => {
  console.log(`[VMQ SW] Installing v${VMQ_VERSION}...`);
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ALL_FILES))
      .then(() => console.log(`[VMQ SW] ✅ Cached ${ALL_FILES.length} files`))
      .catch(err => {
        console.warn('[VMQ SW] ⚠️ Cache failed (partial):', err);
        // Continue anyway - some files may still work
      })
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', event => {
  console.log(`[VMQ SW] Activating v${VMQ_VERSION}...`);
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(n => n.startsWith('vmq-') && n !== CACHE_NAME)
          .map(n => {
            console.log('[VMQ SW] 🗑️ Deleting old cache:', n);
            return caches.delete(n);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch - stale-while-revalidate strategy
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external resources (except React CDN)
  if (!url.startsWith(self.location.origin) && 
      !url.includes('unpkg.com/react')) {
    return;
  }
  
  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(p('index.html'))
        .then(cached => cached || fetch(event.request))
        .catch(() => caches.match(p('offline.html')))
    );
    return;
  }
  
  // Stale-while-revalidate for all other requests
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response.ok) {
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, response.clone()));
            }
            return response;
          })
          .catch(() => cached);
        
        return cached || fetchPromise;
      })
  );
});

// Message handling
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_STATUS') {
    event.ports[0]?.postMessage({
      version: VMQ_VERSION,
      cacheSize: ALL_FILES.length,
      basePath: BASE
    });
  }
});