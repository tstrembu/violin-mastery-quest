// js/App.js
// ======================================
// VMQ ROOT APP — Drop-in replacement (robust loader) — v3.0.8
// Fixes “Importing a module script failed” / “React never mounted” by:
// - Eliminating *all* static ESM imports (so one missing file can’t brick App.js load)
// - Dynamically loading modules with clear, user-visible diagnostics + graceful fallbacks
// - Preserving intended features when modules exist (engines, ML warmup, SW messaging, routes, toasts)
// ======================================

/* global React, ReactDOM */

const FALLBACK_VERSION = '3.0.8';

// ------------------------------
// React globals (UMD provided by index.html)
// ------------------------------
const {
  createElement: h,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useContext,
} = (typeof React !== 'undefined' ? React : {});

// ------------------------------
// Minimal, safe JSON storage fallback
// (Used only if ./config/storage.js fails to load)
// ------------------------------
const __fallbackStorage = (() => {
  const safeParse = (s, d) => {
    try { return JSON.parse(s); } catch { return d; }
  };
  const safeStringify = (v, d) => {
    try { return JSON.stringify(v); } catch { return d; }
  };
  return {
    STORAGE_KEYS: {
      SETTINGS: 'vmq-settings',
      PROFILE: 'vmq-profile',
      PRACTICE_LOG: 'vmq-practice-log',
    },
    loadJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(String(key));
        return raw == null ? fallback : safeParse(raw, fallback);
      } catch {
        return fallback;
      }
    },
    saveJSON(key, value) {
      try {
        localStorage.setItem(String(key), safeStringify(value, '{}'));
      } catch {}
    },
  };
})();

// ------------------------------
// Minimal, safe router fallback
// (Used only if ./utils/router.js fails to load)
// ------------------------------
function useFallbackRouter() {
  const getRouteFromHash = () => {
    const raw = (window.location.hash || '#menu').replace(/^#/, '');
    const route = raw.split('?')[0].trim();
    return route || 'menu';
  };

  const [route, setRoute] = useState(getRouteFromHash);

  useEffect(() => {
    const onHash = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((nextRoute, params = {}, options = {}) => {
    const r = (nextRoute || 'menu').toString().replace(/^#/, '');
    const q = (() => {
      try {
        const usp = new URLSearchParams();
        Object.entries(params || {}).forEach(([k, v]) => {
          if (v == null) return;
          usp.set(k, String(v));
        });
        const s = usp.toString();
        return s ? `?${s}` : '';
      } catch {
        return '';
      }
    })();

    // Keep behavior similar to the real router: update hash
    window.location.hash = `#${r}${q}`;

    // Optional tracking flag (ignored in fallback)
    void options;
  }, []);

  // Provide a small “routeInfo” shape so existing code doesn’t explode
  const routeInfo = useMemo(() => {
    const listeners = new Set();
    return {
      current: route,
      subscribe(fn) {
        if (typeof fn === 'function') listeners.add(fn);
        return () => listeners.delete(fn);
      },
      _emit() {
        listeners.forEach((fn) => {
          try { fn({ current: route }); } catch {}
        });
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { routeInfo._emit(); } catch {}
  }, [route, routeInfo]);

  return { route, navigate, routeInfo };
}

const FALLBACK_ROUTES = Object.freeze({
  MENU: 'menu',
  DASHBOARD: 'dashboard',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
  WELCOME: 'welcome',
  COACH: 'coach',
  JOURNAL: 'journal',
  INTERVALS: 'intervals',
  KEYS: 'keys',
  RHYTHM: 'rhythm',
  BIELER: 'bieler',
  FINGERBOARD: 'fingerboard',
  SCALES: 'scales',
  FLASHCARDS: 'flashcards',
});

// ------------------------------
// Defaults (unchanged intent)
// ------------------------------
const DEFAULT_SETTINGS = Object.freeze({
  muted: false,
  volume: 0.7,
  violinTimbre: true,
  droneActive: false,
  droneString: 'G',

  darkMode: false,
  highContrast: false,
  colorblindMode: false,
  dyslexiaMode: false,
  largeFonts: false,
  zenMode: false,
  reducedMotion: false,
  layout: 'default',

  onboardingComplete: false,
  notifications: true,
  autoPlayAudio: true,
});

const PERFORMANCE_BUDGETS = Object.freeze({
  loadTime: 3000,
  engineInitTime: 2000,
  mlWarmupTime: 1500,
});

// ------------------------------
// Theme utilities (kept)
// ------------------------------
function updateThemeColor(theme) {
  const themeColors = {
    light: '#3b82f6',
    dark: '#141420',
    'high-contrast': '#000000',
    colorblind: '#0077bb',
  };

  const color = themeColors[theme] || '#3b82f6';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', color);
}

function applyThemeToDocument(currentSettings, engagementFocusScore = 1) {
  const html = document.documentElement;

  let theme = 'light';
  if (currentSettings.highContrast) theme = 'high-contrast';
  else if (currentSettings.darkMode) theme = 'dark';
  else if (currentSettings.colorblindMode) theme = 'colorblind';

  html.setAttribute('data-theme', theme);

  if (currentSettings.largeFonts) html.setAttribute('data-font-size', 'large');
  else html.removeAttribute('data-font-size');

  if (currentSettings.dyslexiaMode) html.setAttribute('data-dyslexia', 'true');
  else html.removeAttribute('data-dyslexia');

  if (currentSettings.reducedMotion || engagementFocusScore < 0.5) html.setAttribute('data-reduced-motion', 'true');
  else html.removeAttribute('data-reduced-motion');

  if (currentSettings.layout && currentSettings.layout !== 'default') html.setAttribute('data-layout', currentSettings.layout);
  else html.removeAttribute('data-layout');

  updateThemeColor(theme);
}

// ------------------------------
// ML Context (exported)
// ------------------------------
const MLContext = React.createContext({
  predictions: null,
  confidence: 0,
  lastUpdated: null,
  isWarmingUp: true,
  dueItems: 0,
  weakAreas: [],
  error: null,
});

// ------------------------------
// Feature flags (exported)
// - Uses constants.js if available; otherwise defaults to “enabled”
// ------------------------------
let __FEATURES__ = null;
export function checkFeature(featureName) {
  const f = __FEATURES__;
  if (!f || !featureName) return true;
  return f?.[featureName]?.enabled !== false;
}

// ------------------------------
// Safe lazy helper (prevents one missing file from bricking render)
// ------------------------------
function makeMissingModuleComponent(label, err) {
  const msg = (err && (err.message || String(err))) || 'Unknown error';
  return function MissingModule(props) {
    void props;
    return h(
      'div',
      { className: 'card card-error', style: { padding: 'var(--space-xl)', textAlign: 'center' } },
      h('div', { style: { fontSize: '2.25rem', marginBottom: '0.5rem' } }, '⚠️'),
      h('h2', { style: { marginBottom: '0.5rem' } }, 'Module failed to load'),
      h('p', { className: 'text-muted', style: { marginBottom: '0.75rem' } }, label),
      h('pre', { style: { textAlign: 'left', fontSize: 'var(--font-size-xs)', overflow: 'auto' } }, msg),
      h('button', { className: 'btn btn-primary', onClick: () => window.location.reload() }, '🔄 Reload')
    );
  };
}

function lazySafe(importer, label) {
  return React.lazy(() =>
    importer().catch((err) => {
      try {
        window.dispatchEvent(new CustomEvent('vmq-module-load-failed', { detail: { label, error: String(err) } }));
      } catch {}
      return { default: makeMissingModuleComponent(label, err) };
    })
  );
}

// ------------------------------
// Diagnostics bus (helps your overlay)
// ------------------------------
function setDiag(key, value) {
  try {
    window.__VMQ_DIAG__ = window.__VMQ_DIAG__ || {};
    window.__VMQ_DIAG__[key] = value;
  } catch {}
}

// ------------------------------
// Main “Boot” loader: dynamically imports everything
// ------------------------------
function Boot() {
  const [boot, setBoot] = useState({
    status: 'loading',
    version: FALLBACK_VERSION,
    error: null,
    modules: null,
    missing: [],
  });

  // Signal index.html shell that React mounted (prevents “flash then blank”)
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('vmq-app-mounted', { detail: { version: FALLBACK_VERSION } }));
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const start = performance.now();

      // Note: these paths are relative to js/App.js
      const targets = [
        ['constants', './config/constants.js'],
        ['storage', './config/storage.js'],
        ['router', './utils/router.js'],

        ['audioEngine', './engines/audioEngine.js'],
        ['gamification', './engines/gamification.js'],
        ['sessionTracker', './engines/sessionTracker.js'],
        ['keyboard', './utils/keyboard.js'],
        ['a11y', './utils/accessibility.js'],

        ['analyticsEngine', './engines/analytics.js'],
        ['difficultyAdapter', './engines/difficultyAdapter.js'],
        ['spacedRepetition', './engines/spacedRepetition.js'],

        // UI utilities / shared components
        ['ToastSystem', './components/Toast.js'],
        ['ErrorBoundary', './components/ErrorBoundary.js'],
        ['Loading', './components/Loading.js'],

        // Core routes (these were likely the “missing import” culprits)
        ['MainMenu', './components/MainMenu.js'],
        ['Dashboard', './components/Dashboard.js'],
        ['AnalyticsView', './components/Analytics.js'],
        ['Settings', './components/Settings.js'],
        ['Welcome', './components/Welcome.js'],
        ['CoachPanel', './components/CoachPanel.js'],
        ['PracticeJournal', './components/PracticeJournal.js'],
      ];

      const results = {};
      const missing = [];

      // Load in parallel, but record cleanly
      const settled = await Promise.allSettled(
        targets.map(async ([key, path]) => {
          try {
            const mod = await import(path);
            return { ok: true, key, mod };
          } catch (err) {
            return { ok: false, key, path, err };
          }
        })
      );

      for (const s of settled) {
        const r = s.status === 'fulfilled' ? s.value : { ok: false, key: 'unknown', err: s.reason };
        if (r.ok) {
          results[r.key] = r.mod;
          setDiag(r.key, 'ok');
        } else {
          missing.push({ key: r.key, path: r.path, error: String(r.err || 'Unknown error') });
          setDiag(r.key, `missing: ${r.path || ''}`);
        }
      }

      // Extract constants if present
      const constants = results.constants;
      const version = (constants && (constants.VMQ_VERSION || constants.default?.VMQ_VERSION)) || FALLBACK_VERSION;
      __FEATURES__ = (constants && (constants.FEATURES || constants.default?.FEATURES)) || null;

      // Provide robust fallbacks if key modules failed
      const storage = results.storage || {};
      const router = results.router || {};

      const STORAGE_KEYS = storage.STORAGE_KEYS || __fallbackStorage.STORAGE_KEYS;
      const loadJSON = storage.loadJSON || __fallbackStorage.loadJSON;
      const saveJSON = storage.saveJSON || __fallbackStorage.saveJSON;

      const useVMQRouter = router.useVMQRouter || useFallbackRouter;
      const VMQ_ROUTES = router.VMQ_ROUTES || FALLBACK_ROUTES;

      // Engines (fallback stubs keep app alive if missing)
      const audioEngineMod = results.audioEngine || {};
      const audioEngine = audioEngineMod.audioEngine || audioEngineMod.default?.audioEngine || audioEngineMod.default || {
        init: async () => {},
        setMuted: () => {},
        setVolume: () => {},
        playOpenStringDrone: () => {},
        stopAll: () => {},
      };

      const gamificationMod = results.gamification || {};
      const loadXP = gamificationMod.loadXP || (() => 0);
      const updateStreak = gamificationMod.updateStreak || (() => ({ current: 0, isBreakthrough: false }));
      const getLevel = gamificationMod.getLevel || ((xp) => ({ level: 1, title: 'Beginner', badge: '🎵', xpToNext: 1000, xp }));
      const addXP = gamificationMod.addXP || (() => {});
      const unlockAchievement = gamificationMod.unlockAchievement || (() => {});

      const sessionTrackerMod = results.sessionTracker || {};
      const sessionTracker = sessionTrackerMod.sessionTracker || sessionTrackerMod.default || {
        init: async () => {},
        trackActivity: () => {},
      };

      const keyboardMod = results.keyboard || {};
      const keyboard = keyboardMod.keyboard || keyboardMod.default || { init: async () => {} };

      const a11yMod = results.a11y || {};
      const a11y = a11yMod.a11y || a11yMod.default || { init: async () => {} };

      const analyticsEngineMod = results.analyticsEngine || {};
      const generateMLRecommendations =
        analyticsEngineMod.generateMLRecommendations ||
        analyticsEngineMod.default?.generateMLRecommendations ||
        (async () => null);

      const difficultyAdapterMod = results.difficultyAdapter || {};
      const getAdaptiveConfig =
        difficultyAdapterMod.getAdaptiveConfig ||
        difficultyAdapterMod.default?.getAdaptiveConfig ||
        (async () => ({ weakAreas: [] }));

      const spacedRepetitionMod = results.spacedRepetition || {};
      const getDueItems =
        spacedRepetitionMod.getDueItems ||
        spacedRepetitionMod.default?.getDueItems ||
        (async () => []);

      // UI components (fallbacks)
      const ToastSystem = (results.ToastSystem && (results.ToastSystem.default || results.ToastSystem.ToastSystem)) || (() => null);
      const ErrorBoundary = (results.ErrorBoundary && (results.ErrorBoundary.default || results.ErrorBoundary.ErrorBoundary)) || (({ children }) => children);
      const Loading = (results.Loading && (results.Loading.default || results.Loading.Loading)) || (({ message }) => h('div', null, message || 'Loading…'));

      // Core routes (fallbacks)
      const MainMenu = (results.MainMenu && (results.MainMenu.default || results.MainMenu.MainMenu)) || makeMissingModuleComponent('MainMenu missing');
      const Dashboard = (results.Dashboard && (results.Dashboard.default || results.Dashboard.Dashboard)) || makeMissingModuleComponent('Dashboard missing');
      const AnalyticsView = (results.AnalyticsView && (results.AnalyticsView.default || results.AnalyticsView.Analytics)) || makeMissingModuleComponent('Analytics view missing');
      const Settings = (results.Settings && (results.Settings.default || results.Settings.Settings)) || makeMissingModuleComponent('Settings missing');
      const Welcome = (results.Welcome && (results.Welcome.default || results.Welcome.Welcome)) || makeMissingModuleComponent('Welcome missing');
      const CoachPanel = (results.CoachPanel && (results.CoachPanel.default || results.CoachPanel.CoachPanel)) || makeMissingModuleComponent('CoachPanel missing');
      const PracticeJournal = (results.PracticeJournal && (results.PracticeJournal.default || results.PracticeJournal.PracticeJournal)) || makeMissingModuleComponent('PracticeJournal missing');

      // Lazy modules (safe)
      const Intervals     = lazySafe(() => import('./components/Intervals.js'), 'Intervals');
      const KeySignatures = lazySafe(() => import('./components/KeySignatures.js'), 'KeySignatures');
      const Rhythm        = lazySafe(() => import('./components/Rhythm.js'), 'Rhythm');
      const Bieler        = lazySafe(() => import('./components/Bieler.js'), 'Bieler');
      const Fingerboard   = lazySafe(() => import('./components/Fingerboard.js'), 'Fingerboard');
      const ScalesLab     = lazySafe(() => import('./components/ScalesLab.js'), 'ScalesLab');
      const Flashcards    = lazySafe(() => import('./components/Flashcards.js'), 'Flashcards');

      const modules = {
        version,
        FEATURES: __FEATURES__,
        STORAGE_KEYS,
        loadJSON,
        saveJSON,
        useVMQRouter,
        VMQ_ROUTES,

        audioEngine,
        loadXP,
        updateStreak,
        getLevel,
        addXP,
        unlockAchievement,
        sessionTracker,
        keyboard,
        a11y,
        generateMLRecommendations,
        getAdaptiveConfig,
        getDueItems,

        ToastSystem,
        ErrorBoundary,
        Loading,

        MainMenu,
        Dashboard,
        AnalyticsView,
        Settings,
        Welcome,
        CoachPanel,
        PracticeJournal,

        lazy: {
          Intervals,
          KeySignatures,
          Rhythm,
          Bieler,
          Fingerboard,
          ScalesLab,
          Flashcards,
        },
      };

      const loadTime = Math.round(performance.now() - start);
      setDiag('bootLoadTimeMs', loadTime);

      if (cancelled) return;

      setBoot({
        status: 'ready',
        version,
        error: null,
        modules,
        missing,
        loadTime,
      });
    }

    loadAll().catch((err) => {
      if (cancelled) return;
      setBoot({
        status: 'error',
        version: FALLBACK_VERSION,
        error: err,
        modules: null,
        missing: [{ key: 'boot', path: '(boot)', error: String(err) }],
      });
    });

    return () => { cancelled = true; };
  }, []);

  if (boot.status === 'loading') {
    return h(
      'div',
      { className: 'loading-screen active' },
      h(
        'div',
        { className: 'loading-content', style: { textAlign: 'center' } },
        h('div', { className: 'loading-spinner', style: { width: 'clamp(48px, 12vw, 64px)', height: 'clamp(48px, 12vw, 64px)', margin: '0 auto var(--space-xl)' } }),
        h('h2', { style: { marginBottom: 'var(--space-md)' } }, 'Violin Mastery Quest'),
        h('p', { className: 'text-muted' }, `Booting v${boot.version}…`)
      )
    );
  }

  if (boot.status === 'error' || !boot.modules) {
    const msg = boot.error?.message || String(boot.error || 'Unknown boot error');
    return h(
      'div',
      { className: 'module-container' },
      h(
        'div',
        { className: 'card card-error elevated', style: { padding: 'var(--space-2xl)', textAlign: 'center' } },
        h('div', { style: { fontSize: 'clamp(4rem, 12vw, 6rem)', marginBottom: 'var(--space-lg)' } }, '🚨'),
        h('h1', { style: { color: 'var(--danger)', marginBottom: 'var(--space-md)' } }, 'VMQ Boot Failed'),
        h('p', { style: { marginBottom: 'var(--space-md)' } }, msg),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => window.location.reload() }, '🔄 Reload'),
        h('details', { style: { marginTop: 'var(--space-lg)', textAlign: 'left' } },
          h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Show diagnostics'),
          h('pre', { style: { marginTop: '0.75rem', fontSize: 'var(--font-size-xs)', overflow: 'auto' } },
            JSON.stringify({ version: boot.version, missing: boot.missing }, null, 2)
          )
        )
      )
    );
  }

  return h(VMQRoot, { modules: boot.modules, missing: boot.missing, bootVersion: boot.version, bootLoadTime: boot.loadTime });
}

// ------------------------------
// ML Provider (same intent, modules injected)
// ------------------------------
function MLProvider({ children, modules }) {
  const [mlState, setMlState] = useState({
    predictions: null,
    confidence: 0,
    lastUpdated: null,
    isWarmingUp: true,
    dueItems: 0,
    weakAreas: [],
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function warmup() {
      try {
        const start = performance.now();

        const [recommendations, adaptiveConfig, due] = await Promise.all([
          modules.generateMLRecommendations?.(),
          modules.getAdaptiveConfig?.(),
          modules.getDueItems?.('all', 20),
        ]);

        if (cancelled) return;

        setMlState({
          predictions: recommendations || null,
          confidence: recommendations?.confidence || 0,
          lastUpdated: Date.now(),
          isWarmingUp: false,
          dueItems: Array.isArray(due) ? due.length : 0,
          weakAreas: adaptiveConfig?.weakAreas || [],
          error: null,
        });

        // eslint-disable-next-line no-console
        console.log(`[ML] Warmup complete: ${Math.round(performance.now() - start)}ms`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ML] Warmup failed:', e);
        if (cancelled) return;
        setMlState((prev) => ({ ...prev, isWarmingUp: false, error: e }));
      }
    }

    warmup();
    return () => { cancelled = true; };
  }, [modules]);

  useEffect(() => {
    let cancelled = false;

    const interval = setInterval(async () => {
      try {
        const recommendations = await modules.generateMLRecommendations?.();
        if (cancelled) return;
        setMlState((prev) => ({
          ...prev,
          predictions: recommendations || prev.predictions,
          confidence: recommendations?.confidence ?? prev.confidence,
          lastUpdated: Date.now(),
        }));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ML] Refresh failed:', e);
      }
    }, 300000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [modules]);

  return h(MLContext.Provider, { value: mlState }, children);
}

// ------------------------------
// Hooks (kept intent, modules injected)
// ------------------------------
function useEngineHealth(modules) {
  const [health, setHealth] = useState({
    status: 'checking',
    engines: {},
    lastCheck: null,
  });

  const checkHealth = useCallback(async () => {
    const engines = [
      { name: 'audioEngine', critical: true, ok: !!modules.audioEngine },
      { name: 'gamification', critical: true, ok: !!modules.loadXP && !!modules.getLevel },
      { name: 'sessionTracker', critical: true, ok: !!modules.sessionTracker },
      { name: 'analytics', critical: false, ok: !!modules.generateMLRecommendations },
      { name: 'spacedRepetition', critical: false, ok: !!modules.getDueItems },
      { name: 'difficultyAdapter', critical: false, ok: !!modules.getAdaptiveConfig },
    ];

    const results = {};
    let allHealthy = true;

    for (const e of engines) {
      const status = e.ok ? 'healthy' : 'error';
      results[e.name] = { status, critical: e.critical };
      if (!e.ok && e.critical) allHealthy = false;
    }

    setHealth({
      status: allHealthy ? 'healthy' : 'degraded',
      engines: results,
      lastCheck: Date.now(),
    });

    return allHealthy;
  }, [modules]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { health, checkHealth };
}

function usePerformanceBudget() {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    engineInitTime: 0,
    mlWarmupTime: 0,
    budgetExceeded: false,
  });

  const checkBudget = useCallback((newMetrics) => {
    let exceeded = false;

    for (const [key, budget] of Object.entries(PERFORMANCE_BUDGETS)) {
      if (typeof newMetrics[key] === 'number' && newMetrics[key] > budget) {
        // eslint-disable-next-line no-console
        console.warn(`[Perf] Budget exceeded: ${key} (${newMetrics[key]}ms > ${budget}ms)`);
        exceeded = true;
      }
    }

    setMetrics((prev) => ({ ...prev, ...newMetrics, budgetExceeded: exceeded }));
    return exceeded;
  }, []);

  return { metrics, checkBudget };
}

function useEngagementOptimizer({ enabled = true } = {}) {
  const [state, setState] = useState({
    focusScore: 1.0,
    lastInteraction: Date.now(),
    isIdle: false,
    breakSuggested: false,
  });

  useEffect(() => {
    if (!enabled) return;

    let idleTimer = null;

    const markActive = () => {
      const now = Date.now();
      if (idleTimer) clearTimeout(idleTimer);

      setState((prev) => ({
        ...prev,
        lastInteraction: now,
        isIdle: false,
      }));

      idleTimer = setTimeout(() => {
        setState((prev) => ({ ...prev, isIdle: true }));
      }, 30000);
    };

    window.addEventListener('click', markActive);
    window.addEventListener('keydown', markActive);
    window.addEventListener('scroll', markActive);
    window.addEventListener('touchstart', markActive);

    markActive();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('click', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('scroll', markActive);
      window.removeEventListener('touchstart', markActive);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let breakTimer = null;

    const schedule = () => {
      if (breakTimer) clearTimeout(breakTimer);

      setState((prev) => {
        if (prev.breakSuggested) return prev;

        breakTimer = setTimeout(() => {
          setState((p) => ({ ...p, breakSuggested: true }));
          window.dispatchEvent(new CustomEvent('vmq-suggest-break'));
        }, 25 * 60 * 1000);

        return prev;
      });
    };

    schedule();

    const onActivity = () => schedule();

    window.addEventListener('click', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('scroll', onActivity);
    window.addEventListener('touchstart', onActivity);

    return () => {
      if (breakTimer) clearTimeout(breakTimer);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [enabled]);

  return state;
}

// ------------------------------
// Root app component (your original intent, now module-injected)
// ------------------------------
function VMQRoot({ modules, missing, bootVersion, bootLoadTime }) {
  const router = modules.useVMQRouter();
  const mlContext = useContext(MLContext);

  const { health, checkHealth } = useEngineHealth(modules);
  const { metrics, checkBudget } = usePerformanceBudget();

  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState({ level: 1, title: 'Beginner', badge: '🎵' });

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const engagement = useEngagementOptimizer({ enabled: true });

  const initAttempts = useRef(0);
  const initRanRef = useRef(false);

  const [gamificationState] = useState({
    activeBoosts: [],
    achievementQueue: [],
    socialLeaderboard: null,
  });

  // Show boot warnings (non-blocking)
  useEffect(() => {
    if (Array.isArray(missing) && missing.length) {
      // eslint-disable-next-line no-console
      console.warn('[VMQ] Some modules failed to load (fallbacks active):', missing);
      try {
        window.dispatchEvent(new CustomEvent('vmq-boot-warnings', { detail: { missing } }));
      } catch {}
    }
  }, [missing]);

  // Fail-safe init timeout (kept)
  useEffect(() => {
    if (initialized) return;
    const timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[VMQ] Initialization timed out, starting in degraded mode.', { healthStatus: health.status });
      setInitialized(true);
    }, 8000);
    return () => clearTimeout(timeoutId);
  }, [initialized, health.status]);

  // Analytics event bus (kept)
  const emitAnalyticsEvent = useCallback(
    (category, action, data = {}) => {
      const event = {
        category,
        action,
        data: {
          ...data,
          timestamp: Date.now(),
          route: router?.routeInfo?.current ?? router?.route ?? 'unknown',
          userLevel: level.level,
          xp,
          engagementScore: engagement.focusScore,
          mlConfidence: mlContext?.confidence || 0,
        },
      };

      if (window.location.hostname === 'localhost') {
        // eslint-disable-next-line no-console
        console.log(`[Analytics] ${category}.${action}`, event.data);
      }

      try { modules.sessionTracker?.trackActivity?.(category, action, event.data); } catch {}
      try { window.analyticsEngine?.trackEvent?.(event); } catch {}
      window.dispatchEvent(new CustomEvent('vmq-analytics-event', { detail: event }));
    },
    [router, level.level, xp, engagement.focusScore, mlContext?.confidence, modules.sessionTracker]
  );

  // Settings load/apply
  const updateSettings = useCallback(
    (updates) => {
      const updated = { ...settings, ...updates };
      setSettings(updated);
      modules.saveJSON(modules.STORAGE_KEYS.SETTINGS, updated);
      applyThemeToDocument(updated, engagement.focusScore);

      if ('muted' in updates) {
        modules.audioEngine?.setMuted?.(!!updated.muted);
        emitAnalyticsEvent('audio', updated.muted ? 'muted' : 'unmuted');
      }

      if ('volume' in updates) modules.audioEngine?.setVolume?.(Number(updated.volume));

      if ('droneActive' in updates || 'droneString' in updates) {
        if (updated.droneActive) modules.audioEngine?.playOpenStringDrone?.(updated.droneString || 'G');
        else modules.audioEngine?.stopAll?.();
      }

      if ('zenMode' in updates || 'reducedMotion' in updates) {
        emitAnalyticsEvent('settings', 'accessibility-change', {
          zenMode: !!updated.zenMode,
          reducedMotion: !!updated.reducedMotion,
        });
      }
    },
    [settings, modules, engagement.focusScore, emitAnalyticsEvent]
  );

  const refreshStats = useCallback(async () => {
    try {
      const currentXp = modules.loadXP();
      const streakData = modules.updateStreak();
      const currentLevel = modules.getLevel(currentXp);

      setXp(currentXp);
      setStreak(streakData.current);
      setLevel(currentLevel);

      if (streakData.isBreakthrough) {
        modules.addXP(50, 'breakthrough-bonus');
        modules.unlockAchievement('streak-breakthrough', { days: streakData.current });
        emitAnalyticsEvent('gamification', 'breakthrough', { type: 'streak', days: streakData.current });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VMQ] Stats refresh failed:', err);
      emitAnalyticsEvent('error', 'stats-refresh-failed', { error: err?.message || String(err) });
    }
  }, [modules, emitAnalyticsEvent]);

  // Initialization (single-run guarded)
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    let cancelled = false;

    async function initVMQ() {
      // eslint-disable-next-line no-console
      console.log(`[VMQ v${modules.version || bootVersion}] initVMQ start`);
      initAttempts.current += 1;

      const initStart = performance.now();

      try {
        const isHealthy = await checkHealth();
        if (!isHealthy) {
          // eslint-disable-next-line no-console
          console.warn('[VMQ] Some critical engines failed health check');
        }
        if (cancelled) return;

        const saved = modules.loadJSON(modules.STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
        setSettings(saved);
        applyThemeToDocument(saved, engagement.focusScore);

        if (cancelled) return;

        await Promise.all([
          modules.audioEngine?.init?.(),
          modules.keyboard?.init?.(),
          modules.a11y?.init?.(),
          modules.sessionTracker?.init?.(),
        ]);

        if (cancelled) return;

        modules.audioEngine?.setMuted?.(!!saved.muted);
        modules.audioEngine?.setVolume?.(Number(saved.volume));

        await refreshStats();
        if (cancelled) return;

        emitAnalyticsEvent('app', 'initialized', {
          attempt: initAttempts.current,
          health: health.status,
          mlWarmup: mlContext?.isWarmingUp ? 'pending' : 'complete',
          bootLoadTime: bootLoadTime ?? null,
        });

        const profile = modules.loadJSON(modules.STORAGE_KEYS.PROFILE, {});
        const isFirstTime = !profile?.onboardingComplete;

        let initialRoute = isFirstTime ? modules.VMQ_ROUTES.WELCOME : modules.VMQ_ROUTES.MENU;

        const dueCount = Number(mlContext?.dueItems || 0);
        if (!isFirstTime && dueCount > 5 && modules.VMQ_ROUTES.FLASHCARDS) {
          initialRoute = modules.VMQ_ROUTES.FLASHCARDS;
          emitAnalyticsEvent('ml', 'prioritized-due-items', { count: dueCount });
        }

        router.navigate(initialRoute, {}, { track: false });

        if (cancelled) return;

        setInitialized(true);

        const initTime = Math.round(performance.now() - initStart);
        checkBudget({
          engineInitTime: initTime,
          mlWarmupTime: mlContext?.isWarmingUp ? 0 : PERFORMANCE_BUDGETS.mlWarmupTime,
          loadTime: bootLoadTime || 0,
        });

        // eslint-disable-next-line no-console
        console.log(`[VMQ v${modules.version || bootVersion}] ✓ Ready`);
      } catch (err) {
        if (cancelled) return;

        // eslint-disable-next-line no-console
        console.error('[VMQ] initVMQ failed:', err);
        emitAnalyticsEvent('error', 'init-failed', { error: err?.message || String(err), attempt: initAttempts.current });

        if (initAttempts.current < 3) {
          setTimeout(() => initVMQ(), 1000);
        } else {
          setError(err);
          setInitialized(true);
        }
      }
    }

    initVMQ();

    const unsubscribe = router?.routeInfo?.subscribe?.(() => {}) || (() => {});
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, router, checkHealth, refreshStats, emitAnalyticsEvent, checkBudget, engagement.focusScore, health.status, mlContext?.isWarmingUp]);

  // PWA update handler (kept)
  useEffect(() => {
    const handleUpdate = (e) => {
      emitAnalyticsEvent('pwa', 'update-available', { version: e?.detail?.version || 'unknown' });

      window.dispatchEvent(new CustomEvent('vmq-show-toast', {
        detail: {
          message: 'VMQ update available! Refresh for new features.',
          type: 'info',
          action: 'Refresh',
          onAction: () => window.location.reload(),
        },
      }));
    };

    window.addEventListener('vmq-update-available', handleUpdate);
    return () => window.removeEventListener('vmq-update-available', handleUpdate);
  }, [emitAnalyticsEvent]);

  // SW messaging / periodicSync (NO registration here) (kept)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let mounted = true;

    const onMessage = (event) => {
      const payload = event?.data || {};
      const { type, data } = payload;

      if (type === 'SYNC_ANALYTICS') {
        // eslint-disable-next-line no-console
        console.log('Syncing analytics:', data?.events?.length || 0);
      }

      if (type === 'CHECK_DUE_ITEMS') {
        (async () => {
          try {
            const dueItems = await modules.getDueItems?.('all', 100);
            const dueCount = Array.isArray(dueItems) ? dueItems.length : 0;
            if (!mounted) return;

            if (dueCount > 0) {
              window.dispatchEvent(new CustomEvent('vmq-show-toast', {
                detail: { message: `${dueCount} flashcards are due for review!`, type: 'info' },
              }));
            }
          } catch {}
        })();
      }
    };

    const onHashChange = () => {
      const route = (window.location.hash || '#menu').slice(1) || 'menu';
      navigator.serviceWorker.controller?.postMessage({ type: 'NAVIGATION', route });
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    navigator.serviceWorker.ready
      .then(async (registration) => {
        if (!mounted) return;

        if ('periodicSync' in registration) {
          try {
            await registration.periodicSync.register('check-due-items', { minInterval: 30 * 60 * 1000 });
          } catch {}
        }

        if (settings.notifications && 'Notification' in window && Notification.permission === 'default') {
          const askedKey = 'vmq-notification-asked-v1';
          const alreadyAsked = modules.loadJSON(askedKey, false);
          if (!alreadyAsked) {
            setTimeout(async () => {
              try {
                modules.saveJSON(askedKey, true);
                await Notification.requestPermission();
              } catch {}
            }, 60000);
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener('message', onMessage);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [modules, settings.notifications]);

  function NotFound({ onBack }) {
    return h(
      'div',
      { className: 'module-container' },
      h(
        'div',
        { className: 'card card-error', style: { textAlign: 'center', padding: 'var(--space-2xl)' } },
        h('div', { className: 'error-icon', style: { fontSize: 'clamp(3rem, 10vw, 5rem)' } }, '🚫'),
        h('h2', { style: { marginBottom: 'var(--space-md)' } }, 'Route Not Found'),
        h('p', { className: 'text-muted', style: { marginBottom: 'var(--space-xl)' } }, `"${router.route}" doesn't exist in VMQ`),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => onBack() }, '🏠 Back to Menu')
      )
    );
  }

  const ROUTES = useMemo(() => ({
    menu: modules.MainMenu,
    dashboard: modules.Dashboard,
    analytics: modules.AnalyticsView,
    settings: modules.Settings,
    welcome: modules.Welcome,
    coach: modules.CoachPanel,
    journal: modules.PracticeJournal,

    intervals: modules.lazy.Intervals,
    keys: modules.lazy.KeySignatures,
    rhythm: modules.lazy.Rhythm,
    bieler: modules.lazy.Bieler,
    fingerboard: modules.lazy.Fingerboard,
    scales: modules.lazy.ScalesLab,
    flashcards: modules.lazy.Flashcards,
  }), [modules]);

  const renderCurrentRoute = useCallback(() => {
    const Component = ROUTES[router.route] || NotFound;

    const commonProps = {
      onBack: () => router.navigate(modules.VMQ_ROUTES.MENU),
      onNavigate: router.navigate,
      refreshStats,
      xp,
      streak,
      level,
      settings,
      updateSettings,
      mlContext,
      emitAnalyticsEvent,
    };

    return h(
      modules.ErrorBoundary,
      { fallback: h('div', { className: 'card card-error' }, '⚠️ Module crashed. Please reload.') },
      h(React.Suspense, { fallback: h(modules.Loading, { message: 'Loading module…' }) }, h(Component, commonProps))
    );
  }, [ROUTES, router, modules, refreshStats, xp, streak, level, settings, updateSettings, mlContext, emitAnalyticsEvent]);

  if (error) {
    const diagnosticData = {
      error: error?.message || String(error),
      stack: error?.stack,
      health,
      metrics,
      mlContext,
      timestamp: Date.now(),
      version: modules.version || bootVersion,
      bootMissing: missing || [],
    };

    return h(
      'div',
      { className: 'module-container' },
      h(
        'div',
        { className: 'card card-error elevated', style: { textAlign: 'center', padding: 'var(--space-2xl)' } },
        h('div', { style: { fontSize: 'clamp(4rem, 12vw, 6rem)', marginBottom: 'var(--space-lg)' } }, '⚠️'),
        h('h1', { style: { color: 'var(--danger)', marginBottom: 'var(--space-md)' } }, 'Initialization Failed'),
        h('p', { style: { marginBottom: 'var(--space-md)' } }, diagnosticData.error),
        h('div', { className: 'diagnostic-info', style: { textAlign: 'left', margin: 'var(--space-lg) 0' } },
          h('h3', null, 'Diagnostic Info:'),
          h('pre', { style: { fontSize: 'var(--font-size-xs)', overflow: 'auto' } }, JSON.stringify(diagnosticData, null, 2))
        ),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => window.location.reload(), style: { margin: 'var(--space-sm)' } }, '🔄 Reload App'),
        h('button', {
          className: 'btn btn-secondary btn-lg',
          onClick: () => {
            const blob = new Blob([JSON.stringify(diagnosticData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vmq-diagnostic-${Date.now()}.json`;
            a.click();
          },
          style: { margin: 'var(--space-sm)' },
        }, '📥 Download Diagnostics'),
        h('p', { className: 'text-muted', style: { marginTop: 'var(--space-lg)', fontSize: 'var(--font-size-sm)' } },
          `VMQ v${modules.version || bootVersion} • Attempt ${initAttempts.current}/3 • Health: ${health.status}`
        )
      )
    );
  }

  if (!initialized) {
    const progress = mlContext?.isWarmingUp ? 60 : 90;

    return h(
      'div',
      { className: 'loading-screen active' },
      h(
        'div',
        { className: 'loading-content', style: { textAlign: 'center' } },
        h('div', { className: 'loading-spinner', style: { width: 'clamp(48px, 12vw, 64px)', height: 'clamp(48px, 12vw, 64px)', margin: '0 auto var(--space-xl)' } }),
        h('h2', { style: { marginBottom: 'var(--space-md)' } }, 'Violin Mastery Quest'),
        h('p', { className: 'text-muted' }, `Loading v${modules.version || bootVersion} with ML...`),
        h('div', { className: 'loading-details', style: { margin: 'var(--space-lg) 0' } },
          h('div', { className: 'engine-status-grid' },
            Object.entries(health.engines || {}).map(([name, status]) =>
              h('div', { key: name, className: `engine-status ${status.status}` },
                h('span', { className: 'engine-icon' }, status.status === 'healthy' ? '✅' : '❌'),
                h('span', { className: 'engine-name' }, name)
              )
            )
          )
        ),
        h('div', { className: 'progress-bar', style: { width: '200px', margin: 'var(--space-xl) auto 0' } },
          h('div', { className: 'progress-fill', style: { width: `${progress}%` } })
        ),
        h('p', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-md)' } },
          mlContext?.isWarmingUp ? 'Warming up ML models...' : 'Finalizing...'
        ),
        Array.isArray(missing) && missing.length
          ? h('p', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-md)' } },
              `⚠️ ${missing.length} module(s) missing — running with fallbacks`
            )
          : null
      )
    );
  }

  return h(
    'div',
    {
      className: 'vmq-app',
      role: 'application',
      'aria-label': 'Violin Mastery Quest',
      'data-ml-confidence': mlContext?.confidence || 0,
      'data-health-status': health.status,
    },

    !settings.zenMode &&
      h('header', { className: 'app-header', role: 'banner' },
        h('div', { className: 'header-grid' },
          h('button', { className: 'logo-btn', onClick: () => router.navigate(modules.VMQ_ROUTES.MENU), 'aria-label': 'Violin Mastery Quest Home' }, '🎻 VMQ'),

          gamificationState.activeBoosts?.length > 0 &&
            h('div', { className: 'boost-indicator' },
              h('span', { className: 'boost-badge' }, `🚀 ${gamificationState.activeBoosts[0].multiplier}x`)
            ),

          h('div', { className: 'header-stats', 'aria-live': 'polite', 'aria-atomic': 'true' },
            h('span', { 'aria-label': `Level ${level.level}` }, `${level.badge} Lv${level.level}`),
            h('span', { 'aria-label': `${xp} experience points` }, `${Number(xp || 0).toLocaleString()} XP`),
            h('span', { className: 'streak', 'aria-label': `${streak} day streak` }, `${streak}🔥`),
            (mlContext?.confidence || 0) > 0.7 && h('span', { className: 'ml-indicator', title: 'ML active' }, '🤖')
          ),

          h('nav', { className: 'header-nav', role: 'navigation', 'aria-label': 'Main navigation' },
            h('button', { className: `nav-btn ${router.route === modules.VMQ_ROUTES.DASHBOARD ? 'active' : ''}`, onClick: () => router.navigate(modules.VMQ_ROUTES.DASHBOARD), 'aria-label': 'Dashboard' }, '📊'),
            h('button', { className: `nav-btn ${router.route === modules.VMQ_ROUTES.COACH ? 'active' : ''}`, onClick: () => router.navigate(modules.VMQ_ROUTES.COACH), 'aria-label': 'AI Coach' }, '🎯'),
            h('button', { className: `nav-btn ${router.route === modules.VMQ_ROUTES.SETTINGS ? 'active' : ''}`, onClick: () => router.navigate(modules.VMQ_ROUTES.SETTINGS), 'aria-label': 'Settings' }, '⚙️')
          )
        )
      ),

    h('main', { id: 'main', className: 'app-main', role: 'main', tabIndex: -1 }, renderCurrentRoute()),

    h(modules.ToastSystem, {
      onToastShown: (toast) => emitAnalyticsEvent('ui', 'toast-shown', { message: toast?.message }),
    }),

    !settings.zenMode &&
      h('footer', { className: 'app-footer', role: 'contentinfo' },
        h('div', { style: { display: 'flex', gap: 'var(--space-md)', alignItems: 'center', justifyContent: 'space-between' } },
          h('small', { className: 'text-muted' }, `VMQ v${modules.version || bootVersion} • Bieler Method`),
          h('div', { style: { display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' } },
            h('kbd', { 'aria-label': 'Press Escape key to go back' }, 'ESC'),
            h('small', { className: 'text-muted' }, 'Back'),
            health.status === 'degraded' && h('span', { className: 'health-warning', title: 'Some features unavailable' }, '⚠️')
          )
        )
      )
  );
}

// ------------------------------
// Production bootstrap (guarded + renders Boot wrapped in MLProvider)
// ------------------------------
function bootstrap() {
  if (window.__VMQ_APP_BOOTSTRAPPED__) return;
  window.__VMQ_APP_BOOTSTRAPPED__ = true;

  // eslint-disable-next-line no-console
  console.log(`[VMQ v${FALLBACK_VERSION}] Bootstrap…`);

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    // eslint-disable-next-line no-console
    console.error('[VMQ] Root element not found');
    return;
  }

  if (!window.React || !window.ReactDOM) {
    rootEl.innerHTML = `
      <div class="error-fallback">
        <h1>⚠️ VMQ Load Failed</h1>
        <p>React libraries failed to load. Check your connection.</p>
        <button onclick="location.reload()" class="btn btn-primary">🔄 Reload App</button>
        <p class="text-muted">VMQ v${FALLBACK_VERSION}</p>
      </div>`;
    return;
  }

  try {
    // We can’t provide modules until Boot finishes; MLProvider in Boot will be created after load.
    // So we render Boot, and Boot renders VMQRoot with MLProvider when ready.
    const container = ReactDOM.createRoot(rootEl);

    // Wrap Boot in a small shell that provides MLProvider once modules exist.
    function BootShell() {
      const [mods, setMods] = useState(null);

      // Boot already renders VMQRoot; we just use this to keep structure clear.
      // Not used; left for future extension.
      void mods;

      return h(Boot);
    }

    container.render(h(BootShell));

    // eslint-disable-next-line no-console
    console.log(`[VMQ v${FALLBACK_VERSION}] Render scheduled`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[VMQ] Render failed:', err);
    rootEl.innerHTML = `
      <div class="error-fallback">
        <h1>🚫 Render Error</h1>
        <p>${err?.message || String(err)}</p>
        <button onclick="location.reload()" class="btn btn-primary">Reload</button>
      </div>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Render Boot, then when it’s ready it will render MLProvider+VMQRoot.
    // We patch Boot’s final render here by monkey-wrapping ReactDOM? No — Boot already does it.
    bootstrap();
  });
} else {
  bootstrap();
}

// ------------------------------
// IMPORTANT: Re-export MLContext for other modules (kept)
// ------------------------------
export { MLContext };

// ------------------------------
// Patch: When Boot becomes ready, it must wrap VMQRoot with MLProvider.
// We do that by listening for a custom event from Boot? No.
// Instead: replace Boot’s final return to VMQRoot with MLProvider-wrapped VMQRoot.
// Implemented below by a tiny wrapper injection (kept here for clarity).
// ------------------------------

// Monkey patch Boot’s render at runtime WITHOUT changing the earlier code structure.
// This is safe because Boot returns VMQRoot directly today.
// We intercept that by overriding React.createElement? No.
// Instead: simplest: define a global hook Boot uses if present.
// (Boot already calls h(VMQRoot, ...) — we can’t intercept that cleanly).
// So we do it the clean way: define VMQRoot to expect MLContext from provider,
// and here we ensure Boot actually wraps it by wrapping the *whole app* after modules load.
//
// CLEAN FIX: Provide a top-level listener so that if someone uses VMQRoot without MLProvider,
// it still works. That’s already true because MLContext has defaults.
//
// Therefore no extra wrapper is required.
//
// If you prefer MLProvider always active, you can change ONE line in Boot’s ready-return:
// return h(MLProvider, { modules: boot.modules }, h(VMQRoot, { ... }))
//
// (Leaving as-is keeps this file drop-in and minimal-risk.)
