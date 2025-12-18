// js/App.js
// ======================================================
// VMQ App.js — Boot-Proof Shell + Route Aliases (GH Pages/iOS safe)
// Key goals:
// - Never fail to mount because of a missing NAMED export
// - Never blank-screen because an optional module import fails
// - Route aliases so UI buttons don't hit NotFound
// - Built-in hash router (so router.js export drift can't brick boot)
// ======================================================

import * as Constants from './config/constants.js';
import * as Storage from './config/storage.js';

// Core components (use namespace import to avoid "missing default export" crashes)
import * as MainMenuMod from './components/MainMenu.js';
import * as DashboardMod from './components/Dashboard.js';
import * as CoachPanelMod from './components/CoachPanel.js';
import * as PracticeJournalMod from './components/PracticeJournal.js';
import * as AnalyticsMod from './components/Analytics.js';
import * as SettingsMod from './components/Settings.js';
import * as ToastMod from './components/Toast.js';

// React globals (UMD provided by index.html)
const { createElement: h, useEffect, useMemo, useState } = React;

// --------- helpers: safe module extraction ---------
function pickComponent(mod, fallbackName = 'Component') {
  if (mod?.default) return mod.default;
  // If there is exactly one named export, use it as a best-effort fallback.
  const keys = mod ? Object.keys(mod) : [];
  if (keys.length === 1) return mod[keys[0]];
  return function Fallback() {
    return h('div', { className: 'card card-error', style: { padding: 'var(--space-xl)' } },
      h('h2', null, `${fallbackName} missing export`),
      h('p', { className: 'text-muted' }, 'Module loaded but exports did not match expected shape.')
    );
  };
}

const VMQ_VERSION =
  Constants?.VMQ_VERSION ||
  Constants?.VERSION ||
  (Constants?.default && (Constants.default.VMQ_VERSION || Constants.default.VERSION)) ||
  '0.0.0';

const STORAGE_KEYS =
  Storage?.STORAGE_KEYS ||
  (Storage?.default && Storage.default.STORAGE_KEYS) ||
  { SETTINGS: 'vmq-settings-v1' };

const loadJSON =
  Storage?.loadJSON ||
  (Storage?.default && Storage.default.loadJSON) ||
  ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

const saveJSON =
  Storage?.saveJSON ||
  (Storage?.default && Storage.default.saveJSON) ||
  ((key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  });

const MainMenu = pickComponent(MainMenuMod, 'MainMenu');
const Dashboard = pickComponent(DashboardMod, 'Dashboard');
const CoachPanel = pickComponent(CoachPanelMod, 'CoachPanel');
const PracticeJournal = pickComponent(PracticeJournalMod, 'PracticeJournal');
const Analytics = pickComponent(AnalyticsMod, 'Analytics');

// Settings is frequently the one that breaks due to path/case/SW staleness,
// so we keep it loadable but non-fatal.
const SettingsEager = pickComponent(SettingsMod, 'Settings');

// Toast system is optional; if it doesn't resolve cleanly, we no-op it.
const ToastSystem =
  ToastMod?.default ||
  ToastMod?.ToastSystem ||
  function ToastNoop() { return null; };

// --------- SafeLazy for optional modules ---------
async function importFirst(paths) {
  const attempts = [];
  for (const p of paths) {
    const url = `${p}${p.includes('?') ? '' : `?v=${encodeURIComponent(VMQ_VERSION)}`}`;
    try {
      const mod = await import(url);
      return { mod, used: url };
    } catch (e) {
      attempts.push({ url, message: e?.message || String(e) });
    }
  }
  const err = new Error('All candidate imports failed');
  err.attempts = attempts;
  throw err;
}

function MissingModuleCard({ title, err }) {
  const attempts = err?.attempts || [];
  return h('div', { className: 'module-container' },
    h('div', { className: 'card card-error elevated', style: { padding: 'var(--space-2xl)' } },
      h('h2', null, '⚠️ Module failed to load'),
      h('p', { className: 'text-muted' }, title),
      attempts.length
        ? h('pre', { style: { overflow: 'auto', fontSize: 'var(--font-size-xs)' } },
            attempts.map(a => `- ${a.url}\n  ${a.message}`).join('\n\n')
          )
        : h('pre', { style: { overflow: 'auto', fontSize: 'var(--font-size-xs)' } },
            err?.message || 'Unknown error'
          ),
      h('div', { style: { marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)' } },
        h('button', { className: 'btn btn-primary', onClick: () => window.location.reload() }, '🔄 Reload'),
        h('button', { className: 'btn btn-secondary', onClick: () => { window.location.hash = '#menu'; } }, '🏠 Back to Menu')
      ),
      h('p', { className: 'text-muted', style: { marginTop: 'var(--space-lg)', fontSize: 'var(--font-size-xs)' } },
        `VMQ v${VMQ_VERSION} • URL: ${window.location.href}`
      )
    )
  );
}

function SafeLazy(title, candidatePaths, fallbackComponent = null) {
  return React.lazy(async () => {
    try {
      const { mod } = await importFirst(candidatePaths);
      // Prefer default export; otherwise best-effort first named export.
      const Comp = mod?.default || (Object.keys(mod).length ? mod[Object.keys(mod)[0]] : null);
      if (Comp) return { default: Comp };
      return { default: fallbackComponent || (() => h(MissingModuleCard, { title, err: new Error('No component export found') })) };
    } catch (err) {
      return { default: () => h(MissingModuleCard, { title, err }) };
    }
  });
}

// Optional modules (only load when routed)
const Achievements = SafeLazy('Achievements', [
  './components/Achievements.js',
  './components/achievements.js',
], () => h('div', { className: 'card', style: { padding: 'var(--space-xl)' } },
  h('h2', null, 'Achievements'),
  h('p', { className: 'text-muted' }, 'Coming soon.')
));

const Flashcards = SafeLazy('Review / Flashcards', [
  './components/Flashcards.js',
  './components/Review.js',
  './components/SpacedRep.js',
]);

const Planner = SafeLazy('Planner', [
  './components/Planner.js',
  './components/PracticePlanner.js',
  './components/PracticeJournal.js',
]);

// --------- Route aliases (fixes your screenshots) ---------
const ROUTE_ALIASES = Object.freeze({
  // quick actions / legacy
  'spaced-rep': 'review',
  spacedrep: 'review',
  review: 'review',

  // UI buttons often mismatch naming
  achievements: 'achievements',
  planner: 'planner',
  plan: 'planner',

  // safety
  home: 'menu',
});

// Canonical routes
const ROUTES = Object.freeze({
  menu: MainMenu,
  dashboard: Dashboard,
  coach: CoachPanel,
  journal: PracticeJournal,
  analytics: Analytics,
  settings: SettingsEager,

  // optional/extra
  achievements: Achievements,
  review: Flashcards,
  planner: Planner,
});

// --------- Minimal hash router (debug-safe) ---------
function parseHash() {
  const raw = (window.location.hash || '#menu').slice(1).trim();
  const route = raw.split('?')[0].split('&')[0] || 'menu';
  return route;
}

function normalizeRoute(route) {
  const r = (route || 'menu').trim();
  return ROUTE_ALIASES[r] || r;
}

function navigate(route) {
  const r = normalizeRoute(route);
  window.location.hash = `#${r}`;
}

// --------- App shell ---------
function NotFound({ route }) {
  const known = Object.keys(ROUTES).sort().join(', ');
  return h('div', { className: 'module-container' },
    h('div', { className: 'card card-error elevated', style: { padding: 'var(--space-2xl)', textAlign: 'center' } },
      h('h2', null, '🚫 Route Not Found'),
      h('p', { className: 'text-muted' }, `"${route}" doesn't exist in VMQ`),
      h('p', { className: 'text-muted', style: { fontSize: 'var(--font-size-xs)' } }, `Known: ${known}`),
      h('button', { className: 'btn btn-primary', onClick: () => navigate('menu') }, '🏠 Back to Menu')
    )
  );
}

function Loading({ message = 'Loading…' }) {
  return h('div', { className: 'loading-screen active' },
    h('div', { className: 'loading-content', style: { textAlign: 'center' } },
      h('div', { className: 'loading-spinner', style: { width: 'clamp(48px, 12vw, 64px)', height: 'clamp(48px, 12vw, 64px)', margin: '0 auto var(--space-xl)' } }),
      h('h2', null, 'Violin Mastery Quest'),
      h('p', { className: 'text-muted' }, message),
      h('p', { className: 'text-muted', style: { fontSize: 'var(--font-size-xs)' } }, `v${VMQ_VERSION}`)
    )
  );
}

export default function App() {
  const [route, setRoute] = useState(() => normalizeRoute(parseHash()));

  const settings = useMemo(() => {
    const defaults = { darkMode: false, zenMode: false };
    return loadJSON(STORAGE_KEYS.SETTINGS, defaults) || defaults;
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(normalizeRoute(parseHash()));
    window.addEventListener('hashchange', onHash);
    // Ensure a valid starting hash
    if (!window.location.hash) window.location.hash = '#menu';
    onHash();

    // Signal index.html boot guard
    window.dispatchEvent(new CustomEvent('vmq-app-mounted', { detail: { version: VMQ_VERSION } }));

    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const Component = ROUTES[route] || null;

  return h('div', { className: 'vmq-app', role: 'application', 'aria-label': 'Violin Mastery Quest' },
    !settings.zenMode && h('header', { className: 'app-header', role: 'banner' },
      h('div', { className: 'header-grid' },
        h('button', { className: 'logo-btn', onClick: () => navigate('menu'), 'aria-label': 'VMQ Home' }, '🎻 VMQ'),
        h('div', { className: 'header-stats' },
          h('span', null, `v${VMQ_VERSION}`)
        ),
        h('nav', { className: 'header-nav', role: 'navigation', 'aria-label': 'Main navigation' },
          h('button', { className: 'nav-btn', onClick: () => navigate('dashboard'), 'aria-label': 'Dashboard' }, '📊'),
          h('button', { className: 'nav-btn', onClick: () => navigate('coach'), 'aria-label': 'AI Coach' }, '🎯'),
          h('button', { className: 'nav-btn', onClick: () => navigate('settings'), 'aria-label': 'Settings' }, '⚙️')
        )
      )
    ),

    h('main', { id: 'main', className: 'app-main', role: 'main', tabIndex: -1 },
      Component
        ? h(React.Suspense, { fallback: h(Loading, { message: 'Loading module…' }) },
            h(Component, {
              onNavigate: (r) => navigate(r),
              onBack: () => navigate('menu'),
              route,
              settings,
              saveSettings: (next) => saveJSON(STORAGE_KEYS.SETTINGS, next),
            })
          )
        : h(NotFound, { route })
    ),

    h(ToastSystem, null)
  );
}

// Bootstrap (ensures render even if index.html uses module entry)
(function bootstrap() {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  try {
    const container = ReactDOM.createRoot(rootEl);
    container.render(h(App));
  } catch (e) {
    rootEl.innerHTML = `
      <div class="error-fallback">
        <h1>🚫 VMQ Render Error</h1>
        <pre style="white-space:pre-wrap">${(e && e.message) ? e.message : String(e)}</pre>
        <button onclick="location.reload()" class="btn btn-primary">Reload</button>
      </div>`;
  }
})();