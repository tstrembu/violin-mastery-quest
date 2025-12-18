// js/App.js
// ======================================
// VMQ ROOT APP v3.0.4+ (Route-Alias + SafeLazy Hardened)
// Fixes:
// - ✅ Supports routes used by UI: achievements, spaced-rep, review, planner
// - ✅ SafeLazy loader shows exact attempted URLs + real error (no more “Unknown error”)
// - ✅ Adds route aliases so old/new route keys both work
// - ✅ Keeps existing features: ML, PWA messaging, analytics, gamification, bootstrap signals
// ======================================

// --------------------------------------
// Core imports (MUST be first in ESM)
// --------------------------------------
import { VMQ_VERSION, FEATURES } from './config/constants.js';
import { STORAGE_KEYS, loadJSON, saveJSON } from './config/storage.js';

import { audioEngine } from './engines/audioEngine.js';
import { loadXP, updateStreak, getLevel, addXP, unlockAchievement } from './engines/gamification.js';
import { sessionTracker } from './engines/sessionTracker.js';
import { keyboard } from './utils/keyboard.js';
import { a11y } from './accessibility.js';
import { useVMQRouter, VMQ_ROUTES } from './utils/router.js';

import { generateMLRecommendations } from './engines/analytics.js';
import { getAdaptiveConfig } from './engines/difficultyAdapter.js';
import { getDueItems } from './engines/spacedRepetition.js';

// --------------------------------------
// UI components
// --------------------------------------
import ToastSystem from './components/Toast.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import Loading from './components/Loading.js';

// Core components (keep these eager so the shell always renders)
import MainMenu from './components/MainMenu.js';
import Dashboard from './components/Dashboard.js';
import Analytics from './components/Analytics.js';
import Welcome from './components/Welcome.js';
import CoachPanel from './components/CoachPanel.js';

// --------------------------------------
// React globals (UMD provided by index.html)
// --------------------------------------
const {
  createElement: h,
  useState,
  useEffect,
  useCallback,
  useRef,
} = React;

// --------------------------------------
// SafeLazy (critical for GH Pages + iOS debugging)
// --------------------------------------
const MODULE_QS = `?v=${encodeURIComponent(VMQ_VERSION)}`;

function withVersionQS(p) {
  const s = String(p || '').trim();
  if (!s) return s;
  return s.includes('?') ? s : `${s}${MODULE_QS}`;
}

async function importFirstAvailable(paths) {
  const attempts = [];
  for (const raw of paths) {
    const path = withVersionQS(raw);
    try {
      const mod = await import(path);
      return { mod, used: path };
    } catch (e) {
      attempts.push({
        path,
        message: e?.message || String(e),
        name: e?.name || 'Error',
      });
    }
  }
  const err = new Error('All candidate imports failed');
  err.attempts = attempts;
  throw err;
}

function MissingModuleCard({ title, err }) {
  const attempts = err?.attempts || [];
  const topMsg = attempts?.[0]?.message || err?.message || 'Unknown error';

  return h(
    'div',
    { className: 'module-container' },
    h(
      'div',
      { className: 'card card-error elevated', style: { padding: 'var(--space-2xl)' } },
      h('div', { style: { fontSize: 'clamp(3rem, 10vw, 5rem)', textAlign: 'center' } }, '⚠️'),
      h('h2', { style: { textAlign: 'center', marginBottom: 'var(--space-sm)' } }, 'Module failed to load'),
      h('p', { className: 'text-muted', style: { textAlign: 'center', marginBottom: 'var(--space-lg)' } }, `${title} missing`),
      h('div', { style: { marginBottom: 'var(--space-lg)' } },
        h('div', { className: 'text-muted', style: { marginBottom: 'var(--space-xs)' } }, 'Error'),
        h('pre', { style: { overflow: 'auto', fontSize: 'var(--font-size-xs)' } }, topMsg)
      ),
      attempts?.length
        ? h('div', null,
            h('div', { className: 'text-muted', style: { marginBottom: 'var(--space-xs)' } }, 'Attempted URLs'),
            h(
              'pre',
              { style: { overflow: 'auto', fontSize: 'var(--font-size-xs)' } },
              attempts.map(a => `- ${a.path}\n  ${a.name}: ${a.message}`).join('\n')
            )
          )
        : null,
      h('hr', { style: { margin: 'var(--space-lg) 0', opacity: 0.2 } }),
      h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-xs)' } },
        `App URL: ${window.location.href}\n` +
        `Base: ${new URL('.', import.meta.url).href}\n` +
        `VMQ: v${VMQ_VERSION}\n\n` +
        `Most common GH Pages cause: filename case mismatch (e.g., Settings.js vs settings.js) or stale SW cache.`
      ),
      h('div', { style: { display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-xl)' } },
        h('button', { className: 'btn btn-primary', onClick: () => window.location.reload() }, '🔄 Reload'),
        h('button', { className: 'btn btn-secondary', onClick: () => { window.location.hash = '#menu'; } }, '🏠 Back to Menu')
      )
    )
  );
}

function SafeLazy(title, candidatePaths) {
  return React.lazy(async () => {
    try {
      const { mod } = await importFirstAvailable(candidatePaths);
      return mod;
    } catch (err) {
      return {
        default: function MissingModule() {
          return h(MissingModuleCard, { title, err });
        },
      };
    }
  });
}

// --------------------------------------
// Lazy modules (keep aligned to real files)
// --------------------------------------
const Intervals     = React.lazy(() => import('./components/Intervals.js'));
const KeySignatures = React.lazy(() => import('./components/KeySignatures.js'));
const Rhythm        = React.lazy(() => import('./components/Rhythm.js'));
const Bieler        = React.lazy(() => import('./components/Bieler.js'));
const Fingerboard   = React.lazy(() => import('./components/Fingerboard.js'));
const ScalesLab     = React.lazy(() => import('./components/ScalesLab.js'));
const Flashcards    = React.lazy(() => import('./components/Flashcards.js'));

// Hardened optional modules (these are the ones your screenshots show failing)
const Settings = SafeLazy('Settings', [
  './components/Settings.js',
  './components/settings.js',
]);

const PracticeJournal = SafeLazy('Practice Journal / Planner', [
  './components/PracticeJournal.js',
  './components/Planner.js',
  './components/PracticePlanner.js',
]);

const Achievements = SafeLazy('Achievements', [
  './components/Achievements.js',
  './components/achievements.js',
  './components/AchievementsView.js',
]);

const Planner = SafeLazy('Planner', [
  './components/Planner.js',
  './components/PracticePlanner.js',
  './components/PracticeJournal.js',
]);

// --------------------------------------
// Defaults
// --------------------------------------
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

// --------------------------------------
// ML Context Provider
// --------------------------------------
const MLContext = React.createContext({
  predictions: null,
  confidence: 0,
  lastUpdated: null,
  isWarmingUp: true,
  dueItems: 0,
  weakAreas: [],
  error: null,
});

function MLProvider({ children }) {
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
          generateMLRecommendations(),
          getAdaptiveConfig(),
          getDueItems('all', 20),
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    const interval = setInterval(async () => {
      try {
        const recommendations = await generateMLRecommendations();
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
  }, []);

  return h(MLContext.Provider, { value: mlState }, children);
}

// --------------------------------------
// Routes + aliases (fixes your screenshots)
// --------------------------------------
const ROUTE_ALIASES = Object.freeze({
  // Your UI is navigating to these, so we must support them:
  'spaced-rep': 'flashcards',
  spacedrep: 'flashcards',
  review: 'flashcards',

  // “Planner” button commonly maps to journal/planner:
  planner: 'planner',
  plan: 'planner',
  'practice-journal': 'journal',
  practicejournal: 'journal',

  // Achievements button:
  achievements: 'achievements',
});

const ROUTES = {
  // Core
  menu: MainMenu,
  dashboard: Dashboard,
  analytics: Analytics,
  settings: Settings,
  welcome: Welcome,
  coach: CoachPanel,
  journal: PracticeJournal,

  // Training modules
  intervals: Intervals,
  keys: KeySignatures,
  rhythm: Rhythm,
  bieler: Bieler,
  fingerboard: Fingerboard,
  scales: ScalesLab,
  flashcards: Flashcards,

  // Additional modules used by your UI
  achievements: Achievements,
  planner: Planner,

  // Explicit route keys (even if aliased) to eliminate “Route Not Found”
  'spaced-rep': Flashcards,
  review: Flashcards,
};

// --------------------------------------
// Feature flag helper
// --------------------------------------
export function checkFeature(featureName) {
  return FEATURES?.[featureName]?.enabled !== false;
}

// --------------------------------------
// Health monitor
// --------------------------------------
function useEngineHealth() {
  const [health, setHealth] = useState({
    status: 'checking',
    engines: {},
    lastCheck: null,
  });

  const checkHealth = useCallback(async () => {
    const engines = [
      { name: 'audioEngine', module: './engines/audioEngine.js', critical: true },
      { name: 'gamification', module: './engines/gamification.js', critical: true },
      { name: 'sessionTracker', module: './engines/sessionTracker.js', critical: true },
      { name: 'analytics', module: './engines/analytics.js', critical: false },
      { name: 'coachEngine', module: './engines/coachEngine.js', critical: false },
      { name: 'pedagogyEngine', module: './engines/pedagogyEngine.js', critical: false },
      { name: 'spacedRepetition', module: './engines/spacedRepetition.js', critical: false },
      { name: 'difficultyAdapter', module: './engines/difficultyAdapter.js', critical: false },
    ];

    const results = {};
    let allHealthy = true;

    for (const engine of engines) {
      try {
        const mod = await import(engine.module);
        const isHealthy = !!(mod && (mod.default || mod[engine.name] || Object.keys(mod).length));
        results[engine.name] = { status: isHealthy ? 'healthy' : 'failed', critical: engine.critical };
        if (!isHealthy && engine.critical) allHealthy = false;
      } catch (e) {
        results[engine.name] = { status: 'error', error: e, critical: engine.critical };
        if (engine.critical) allHealthy = false;
      }
    }

    setHealth({
      status: allHealthy ? 'healthy' : 'degraded',
      engines: results,
      lastCheck: Date.now(),
    });

    return allHealthy;
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { health, checkHealth };
}

// --------------------------------------
// Performance budget
// --------------------------------------
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

// --------------------------------------
// Engagement optimizer
// --------------------------------------
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

// --------------------------------------
// Utilities local to App.js
// --------------------------------------
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

function getUserSegment() {
  try {
    const profile = loadJSON(STORAGE_KEYS.PROFILE, {});
    const seed = String(profile?.id || profile?.name || profile?.createdAt || 'anon');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    return (Math.abs(hash) % 2) === 0 ? 'A' : 'B';
  } catch {
    return Math.random() > 0.5 ? 'A' : 'B';
  }
}

function predictTimeToNextLevel(currentXp, xpToNext) {
  const recentHistory = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []).slice(-10);
  if (!Array.isArray(recentHistory) || recentHistory.length < 3) return null;

  const avgXpPerSession =
    recentHistory.reduce((sum, s) => sum + (Number(s?.xpGained) || 0), 0) / recentHistory.length;

  if (avgXpPerSession <= 0) return null;

  const sessionsNeeded = Math.ceil((xpToNext - currentXp) / avgXpPerSession);
  const avgSessionFrequency = 1;
  return Math.ceil(sessionsNeeded / avgSessionFrequency);
}

// --------------------------------------
// App
// --------------------------------------
export default function App() {
  const router = useVMQRouter();
  const mlContext = React.useContext(MLContext);

  const { health, checkHealth } = useEngineHealth();
  const { metrics, checkBudget } = usePerformanceBudget();

  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState({ level: 1, title: 'Beginner', badge: '🎵' });

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const engagement = useEngagementOptimizer({ enabled: true });
  const initAttempts = useRef(0);

  const [gamificationState] = useState({
    activeBoosts: [],
    achievementQueue: [],
    socialLeaderboard: null,
  });

  // Fail-safe init timeout
  useEffect(() => {
    if (initialized) return;
    const timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[VMQ] Initialization timed out, starting in degraded mode.', { healthStatus: health.status });
      setInitialized(true);
    }, 8000);
    return () => clearTimeout(timeoutId);
  }, [initialized, health.status]);

  // Analytics event bus
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

      try { sessionTracker.trackActivity(category, action, event.data); } catch {}
      try { window.analyticsEngine?.trackEvent?.(event); } catch {}

      window.dispatchEvent(new CustomEvent('vmq-analytics-event', { detail: event }));
    },
    [router, level.level, xp, engagement.focusScore, mlContext?.confidence]
  );

  // Theme application
  const applyTheme = useCallback(
    (currentSettings) => {
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

      if (currentSettings.reducedMotion || engagement.focusScore < 0.5) html.setAttribute('data-reduced-motion', 'true');
      else html.removeAttribute('data-reduced-motion');

      if (currentSettings.layout && currentSettings.layout !== 'default') html.setAttribute('data-layout', currentSettings.layout);
      else html.removeAttribute('data-layout');

      updateThemeColor(theme);
    },
    [engagement.focusScore]
  );

  // Settings update
  const updateSettings = useCallback(
    (updates) => {
      const updated = { ...settings, ...updates };
      setSettings(updated);
      saveJSON(STORAGE_KEYS.SETTINGS, updated);
      applyTheme(updated);

      if ('muted' in updates) {
        audioEngine.setMuted(!!updated.muted);
        emitAnalyticsEvent('audio', updated.muted ? 'muted' : 'unmuted');
      }

      if ('volume' in updates) audioEngine.setVolume(Number(updated.volume));

      if ('droneActive' in updates || 'droneString' in updates) {
        if (updated.droneActive) audioEngine.playOpenStringDrone(updated.droneString || 'G');
        else audioEngine.stopAll();
      }

      if ('zenMode' in updates || 'reducedMotion' in updates) {
        emitAnalyticsEvent('settings', 'accessibility-change', {
          zenMode: !!updated.zenMode,
          reducedMotion: !!updated.reducedMotion,
        });
      }
    },
    [settings, applyTheme, emitAnalyticsEvent]
  );

  // Stats refresh
  const refreshStats = useCallback(async () => {
    try {
      const currentXp = loadXP();
      const streakData = updateStreak();
      const currentLevel = getLevel(currentXp);

      setXp(currentXp);
      setStreak(streakData.current);
      setLevel(currentLevel);

      if (streakData.isBreakthrough) {
        addXP(50, 'breakthrough-bonus');
        unlockAchievement('streak-breakthrough', { days: streakData.current });
        emitAnalyticsEvent('gamification', 'breakthrough', { type: 'streak', days: streakData.current });
      }

      const xpToNext = currentLevel?.xpToNext || 1000;
      const predictedTime = predictTimeToNextLevel(currentXp, xpToNext);
      setLevel((prev) => ({ ...prev, predictedTime }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VMQ] Stats refresh failed:', err);
      emitAnalyticsEvent('error', 'stats-refresh-failed', { error: err?.message || String(err) });
    }
  }, [emitAnalyticsEvent]);

  // Initialization (single-run guarded)
  const initRanRef = useRef(false);

  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    let cancelled = false;

    async function initVMQ() {
      // eslint-disable-next-line no-console
      console.log(`[VMQ v${VMQ_VERSION}] initVMQ start`);
      initAttempts.current += 1;
      const initStart = performance.now();

      try {
        const isHealthy = await checkHealth();
        if (!isHealthy) {
          // eslint-disable-next-line no-console
          console.warn('[VMQ] Some critical engines failed health check');
        }
        if (cancelled) return;

        const saved = loadJSON(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
        setSettings(saved);
        applyTheme(saved);

        if (cancelled) return;

        await Promise.all([audioEngine.init(), keyboard.init(), a11y.init(), sessionTracker.init()]);

        if (cancelled) return;

        audioEngine.setMuted(!!saved.muted);
        audioEngine.setVolume(Number(saved.volume));

        await refreshStats();
        if (cancelled) return;

        emitAnalyticsEvent('app', 'initialized', {
          attempt: initAttempts.current,
          health: health.status,
          mlWarmup: mlContext?.isWarmingUp ? 'pending' : 'complete',
        });

        const profile = loadJSON(STORAGE_KEYS.PROFILE, {});
        const isFirstTime = !profile?.onboardingComplete;

        let initialRoute = isFirstTime ? VMQ_ROUTES.WELCOME : VMQ_ROUTES.MENU;

        const dueCount = Number(mlContext?.dueItems || 0);
        if (!isFirstTime && dueCount > 5 && VMQ_ROUTES.FLASHCARDS) {
          initialRoute = VMQ_ROUTES.FLASHCARDS;
          emitAnalyticsEvent('ml', 'prioritized-due-items', { count: dueCount });
        }

        router.navigate(initialRoute, {}, { track: false });

        if (cancelled) return;

        setInitialized(true);

        const initTime = performance.now() - initStart;
        checkBudget({
          engineInitTime: Math.round(initTime),
          mlWarmupTime: mlContext?.isWarmingUp ? 0 : PERFORMANCE_BUDGETS.mlWarmupTime,
        });

        // eslint-disable-next-line no-console
        console.log(`[VMQ v${VMQ_VERSION}] ✓ Ready`);
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
  }, [checkHealth, applyTheme, refreshStats, router, emitAnalyticsEvent, checkBudget]);

  // PWA update handler
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

  // SW messaging / periodicSync (NO registration here)
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
            const dueItems = await getDueItems('all', 100);
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
          const alreadyAsked = loadJSON(askedKey, false);
          if (!alreadyAsked) {
            setTimeout(async () => {
              try {
                saveJSON(askedKey, true);
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
  }, [settings.notifications]);

  // A/B testing integration
  useEffect(() => {
    const experiments = loadJSON('vmq-experiments', {});
    const userSegment = getUserSegment();

    if (!experiments.dashboardLayout) {
      experiments.dashboardLayout = { variant: Math.random() > 0.5 ? 'A' : 'B', assigned: Date.now() };
      saveJSON('vmq-experiments', experiments);
    }

    emitAnalyticsEvent('experiment', 'assigned', {
      name: 'dashboardLayout',
      variant: experiments.dashboardLayout.variant,
      segment: userSegment,
    });
  }, [emitAnalyticsEvent]);

  function NotFound({ onBack }) {
    const known = Object.keys(ROUTES).sort();
    return h(
      'div',
      { className: 'module-container' },
      h(
        'div',
        { className: 'card card-error', style: { textAlign: 'center', padding: 'var(--space-2xl)' } },
        h('div', { className: 'error-icon', style: { fontSize: 'clamp(3rem, 10vw, 5rem)' } }, '🚫'),
        h('h2', { style: { marginBottom: 'var(--space-md)' } }, 'Route Not Found'),
        h('p', { className: 'text-muted', style: { marginBottom: 'var(--space-lg)' } }, `"${router.route}" doesn't exist in VMQ`),
        h('details', { style: { textAlign: 'left', margin: '0 auto var(--space-xl)', maxWidth: '720px' } },
          h('summary', { className: 'text-muted', style: { cursor: 'pointer' } }, 'Show known routes'),
          h('pre', { style: { overflow: 'auto', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-sm)' } }, known.join('\n'))
        ),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => onBack() }, '🏠 Back to Menu')
      )
    );
  }

  const renderCurrentRoute = useCallback(() => {
    const raw = router.route;
    const canonical = ROUTE_ALIASES[raw] || raw;
    const Component = ROUTES[raw] || ROUTES[canonical] || NotFound;

    const commonProps = {
      onBack: () => router.navigate(VMQ_ROUTES.MENU),
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
      ErrorBoundary,
      { fallback: h('div', { className: 'card card-error' }, '⚠️ Module crashed. Please reload.') },
      h(React.Suspense, { fallback: h(Loading, { message: 'Loading module…' }) }, h(Component, commonProps))
    );
  }, [router, refreshStats, xp, streak, level, settings, updateSettings, mlContext, emitAnalyticsEvent]);

  if (error) {
    const diagnosticData = {
      error: error?.message || String(error),
      stack: error?.stack,
      health,
      metrics,
      mlContext,
      timestamp: Date.now(),
      version: VMQ_VERSION,
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
          `VMQ v${VMQ_VERSION} • Attempt ${initAttempts.current}/3 • Health: ${health.status}`
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
        h('p', { className: 'text-muted' }, `Loading v${VMQ_VERSION} with ML...`),
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
        )
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
          h('button', { className: 'logo-btn', onClick: () => router.navigate(VMQ_ROUTES.MENU), 'aria-label': 'Violin Mastery Quest Home' }, '🎻 VMQ'),

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
            h('button', { className: `nav-btn ${router.route === VMQ_ROUTES.DASHBOARD ? 'active' : ''}`, onClick: () => router.navigate(VMQ_ROUTES.DASHBOARD), 'aria-label': 'Dashboard' }, '📊'),
            h('button', { className: `nav-btn ${router.route === VMQ_ROUTES.COACH ? 'active' : ''}`, onClick: () => router.navigate(VMQ_ROUTES.COACH), 'aria-label': 'AI Coach' }, '🎯'),
            h('button', { className: `nav-btn ${router.route === VMQ_ROUTES.SETTINGS ? 'active' : ''}`, onClick: () => router.navigate(VMQ_ROUTES.SETTINGS), 'aria-label': 'Settings' }, '⚙️')
          )
        )
      ),

    h('main', { id: 'main', className: 'app-main', role: 'main', tabIndex: -1 }, renderCurrentRoute()),

    h(ToastSystem, {
      onToastShown: (toast) => emitAnalyticsEvent('ui', 'toast-shown', { message: toast?.message }),
    }),

    mlContext?.predictions?.quickAction &&
      !settings.zenMode &&
      h('button', {
        className: 'fab-quick-action',
        onClick: () => {
          const action = mlContext.predictions.quickAction;
          router.navigate(action.route, action.params);
          emitAnalyticsEvent('ml', 'quick-action-clicked', action);
        },
        'aria-label': mlContext.predictions.quickAction.label,
        title: mlContext.predictions.quickAction.label,
      }, mlContext.predictions.quickAction.icon),

    !settings.zenMode &&
      h('footer', { className: 'app-footer', role: 'contentinfo' },
        h('div', { style: { display: 'flex', gap: 'var(--space-md)', alignItems: 'center', justifyContent: 'space-between' } },
          h('small', { className: 'text-muted' }, `VMQ v${VMQ_VERSION} • Bieler Method`),
          h('div', { style: { display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' } },
            h('kbd', { 'aria-label': 'Press Escape key to go back' }, 'ESC'),
            h('small', { className: 'text-muted' }, 'Back'),
            health.status === 'degraded' && h('span', { className: 'health-warning', title: 'Some features unavailable' }, '⚠️')
          )
        )
      )
  );
}

// --------------------------------------
// Production bootstrap (guarded + signals index.html)
// --------------------------------------
function bootstrap() {
  if (window.__VMQ_APP_BOOTSTRAPPED__) return;
  window.__VMQ_APP_BOOTSTRAPPED__ = true;

  // eslint-disable-next-line no-console
  console.log(`[VMQ v${VMQ_VERSION}] Production bootstrap...`);

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
        <p class="text-muted">VMQ v${VMQ_VERSION}</p>
      </div>`;
    return;
  }

  try {
    const AppWithML = h(MLProvider, null, h(App));
    const container = ReactDOM.createRoot(rootEl);
    container.render(AppWithML);

    // Signal the shell that React is alive (prevents “flash then blank”)
    window.dispatchEvent(new CustomEvent('vmq-app-mounted', { detail: { version: VMQ_VERSION } }));
    // eslint-disable-next-line no-console
    console.log(`[VMQ v${VMQ_VERSION}] ✓ Live`);
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
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

export { MLContext };