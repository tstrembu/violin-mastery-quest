// js/utils/router.js
// ======================================
// VMQ ROUTER v3.0.5 - ML-Enhanced Navigation (Corrected + Compatible)
// Predictive Prefetching + Robust Storage + Safer Engine Integration
// ======================================

import { AppContext } from '../contexts/AppContext.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { a11y } from '../accessibility.js';

const { useState, useEffect, useCallback, useMemo, useContext, useRef } = React;

// ------------------------------------------------------
// ROUTES (public API)
// ------------------------------------------------------
export const VMQ_ROUTES = {
  HOME: 'menu',
  DASHBOARD: 'dashboard',
  COACH: 'coach',
  GOALS: 'dailygoals',
  ACHIEVEMENTS: 'achievements',
  ANALYTICS: 'analytics',

  INTERVALS: 'intervals',
  INTERVAL_EAR: 'interval-ear',
  INTERVAL_SPRINT: 'interval-sprint',
  KEYS: 'keys',
  KEY_TESTER: 'key-tester',

  BIELER: 'bieler',
  BIELER_LAB: 'bielerlab',
  FINGERBOARD: 'fingerboard',
  NOTE_LOCATOR: 'notelocator',
  SCALES: 'scales',
  FLASHCARDS: 'flashcards',

  RHYTHM: 'rhythm',
  RHYTHM_DRILLS: 'rhythm-drills',
  TEMPO: 'tempotrainer',
  SPEED_DRILL: 'speeddrill',

  SPACED_REP: 'spaced-rep',

  DATA_MANAGER: 'datamanager',
  SETTINGS: 'settings',
  JOURNAL: 'journal',

  RECOMMENDED: 'recommended',
  PRIORITY: 'priority'
};

export const VMQROUTES = VMQ_ROUTES;

// ------------------------------------------------------
// ROUTER STORAGE KEYS
// ------------------------------------------------------
const ROUTER_STORAGE_KEYS = {
  LAST_SESSION: STORAGE_KEYS?.LAST_SESSION || 'vmq.router.lastSession',
  NAV_HISTORY:  STORAGE_KEYS?.NAV_HISTORY  || 'vmq.router.navHistory',
  NAV_PATTERNS: STORAGE_KEYS?.NAV_PATTERNS || 'vmq.router.navPatterns'
};

// ------------------------------------------------------
// ROUTE ALIASES
// ------------------------------------------------------
const ROUTE_ALIASES = {
  scaleslab: 'scales',
  practicejournal: 'journal',
};

// ------------------------------------------------------
// PREFETCH MAP: route slug -> component filename
// NOTE: Exported for shared usage / consistency.
// ------------------------------------------------------
export const ROUTE_TO_COMPONENT_FILE = {
  menu: 'MainMenu.js',
  dashboard: 'Dashboard.js',
  analytics: 'Analytics.js',
  settings: 'Settings.js',
  welcome: 'Welcome.js',

  intervals: 'Intervals.js',
  'interval-ear': 'IntervalEarTester.js',
  'interval-sprint': 'IntervalSprint.js',
  keys: 'KeySignatures.js',
  'key-tester': 'KeyTester.js',
  rhythm: 'Rhythm.js',
  'rhythm-drills': 'RhythmDrills.js',
  tempotrainer: 'TempoTrainer.js',
  speeddrill: 'SpeedDrill.js',

  bieler: 'Bieler.js',
  bielerlab: 'BielerLab.js',
  fingerboard: 'Fingerboard.js',
  notelocator: 'NoteLocator.js',
  scales: 'ScalesLab.js',

  coach: 'CoachPanel.js',
  dailygoals: 'DailyGoals.js',
  achievements: 'Achievements.js',
  practiceplanner: 'PracticePlanner.js',
  journal: 'PracticeJournal.js',
  statsvisualizer: 'StatsVisualizer.js',
  snapshot: 'Snapshot.js',
  customdrill: 'CustomDrill.js',
  flashcards: 'Flashcards.js',
  datamanager: 'DataManager.js',
  referencelibrary: 'ReferenceLibrary.js',
  testers: 'Testers.js',
  positioncharts: 'PositionCharts.js'
};

function safeDecodeURIComponent(s) {
  try { return decodeURIComponent(s); } catch { return s || ''; }
}

export function normalizeRouteSlug(route) {
  const r = (route || '').toString().trim().toLowerCase();
  return ROUTE_ALIASES[r] || r;
}

function isKnownRouteSlug(routeSlug) {
  const slug = normalizeRouteSlug(routeSlug);
  const all = new Set(Object.values(VMQ_ROUTES).map(normalizeRouteSlug));
  return all.has(slug) || slug in ROUTE_TO_COMPONENT_FILE;
}

// ------------------------------------------------------
// OPTIONAL ENGINE ACCESS (best-effort)
// ------------------------------------------------------
const engineCacheRef = { current: { gamification: null, spaced: null, difficulty: null } };

async function ensureEngine(name) {
  if (engineCacheRef.current[name]) return engineCacheRef.current[name];

  try {
    if (name === 'gamification') {
      engineCacheRef.current.gamification = await import('../engines/gamification.js');
      return engineCacheRef.current.gamification;
    }
    if (name === 'spaced') {
      engineCacheRef.current.spaced = await import('../engines/spacedRepetition.js');
      return engineCacheRef.current.spaced;
    }
    if (name === 'difficulty') {
      engineCacheRef.current.difficulty = await import('../engines/difficultyAdapter.js');
      return engineCacheRef.current.difficulty;
    }
  } catch {
    return null;
  }
  return null;
}

function getUserLevelSafe() {
  const g = engineCacheRef.current.gamification;
  try { if (g?.getUserLevel) return g.getUserLevel(); } catch {}
  return 1;
}

function getAdaptiveConfigSafe() {
  const d = engineCacheRef.current.difficulty;
  try { if (d?.getAdaptiveConfig) return d.getAdaptiveConfig(); } catch {}
  return {};
}

function getDueItemsSafe(limit = 5) {
  const s = engineCacheRef.current.spaced;
  try { if (s?.getDueItems) return s.getDueItems('all', limit) || []; } catch {}
  return [];
}

// ------------------------------------------------------
// ROUTER HOOK
// ------------------------------------------------------
export function useVMQRouter() {
  const appContext = useContext(AppContext);
  const hasMounted = useRef(false);
  const predictionConfidence = useRef(0);

  const parseHash = useCallback((hash) => {
    const raw = safeDecodeURIComponent((hash || '').startsWith('#') ? hash.slice(1) : hash).trim();
    const [routePartRaw, paramStr = ''] = raw.split('?');
    const routePart = normalizeRouteSlug(routePartRaw || VMQ_ROUTES.HOME);

    const params = new URLSearchParams(paramStr);
    return { route: routePart || VMQ_ROUTES.HOME, params: Object.fromEntries(params.entries()), raw };
  }, []);

  const [currentRoute, setCurrentRoute] = useState(() => {
    const parsed = parseHash(window.location.hash || '');
    const lastSession = loadJSON(ROUTER_STORAGE_KEYS.LAST_SESSION, null);

    if (
      lastSession?.route &&
      Date.now() - (lastSession.timestamp || 0) < 86400000 &&
      isKnownRouteSlug(lastSession.route)
    ) {
      return normalizeRouteSlug(lastSession.route);
    }

    return isKnownRouteSlug(parsed.route) ? parsed.route : VMQ_ROUTES.HOME;
  });

  const [queryParams, setQueryParams] = useState(() => {
    const parsed = parseHash(window.location.hash || '');
    return new URLSearchParams(parsed.params || {});
  });

  const [navigationHistory, setNavigationHistory] = useState(() =>
    loadJSON(ROUTER_STORAGE_KEYS.NAV_HISTORY, [])
  );

  const [predictedRoutes, setPredictedRoutes] = useState([]);

  function logDiagnostic(category, message, data = null) {
    if (window.location.search.includes('vmq-diagnostics')) {
      // eslint-disable-next-line no-console
      console.log(`%c[Router] ${category}: ${message}`, 'color: #3b82f6;', data || '');
    }
  }

  const analyzeNavigationPatterns = useCallback((history) => {
    if (!Array.isArray(history) || history.length < 5) return;

    const routeCounts = {};
    const routePairs = {};

    history.forEach((entry, i) => {
      const r = normalizeRouteSlug(entry?.route);
      if (!r) return;

      routeCounts[r] = (routeCounts[r] || 0) + 1;

      if (i > 0) {
        const prev = normalizeRouteSlug(history[i - 1]?.route);
        if (prev) {
          const pair = `${prev}→${r}`;
          routePairs[pair] = (routePairs[pair] || 0) + 1;
        }
      }
    });

    const patterns = {
      commonPaths: Object.entries(routeCounts)
        .map(([route, count]) => ({
          route,
          frequency: count,
          avgDuration: 15,
          primaryGoal: route.includes('coach') ? 'review' : 'practice'
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),

      frequentPairs: Object.entries(routePairs)
        .map(([pair, count]) => ({ pair, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),

      lastAnalyzed: Date.now()
    };

    saveJSON(ROUTER_STORAGE_KEYS.NAV_PATTERNS, patterns);
  }, []);

  const updateNavigationHistory = useCallback((route, params) => {
    const entry = {
      route: normalizeRouteSlug(route),
      params: params || {},
      timestamp: Date.now(),
      userLevel: getUserLevelSafe(),
      sessionId: sessionTracker?.getCurrentSession?.()?.id || 'unknown'
    };

    setNavigationHistory((prev) => {
      const updated = [...(Array.isArray(prev) ? prev : []), entry].slice(-100);
      saveJSON(ROUTER_STORAGE_KEYS.NAV_HISTORY, updated);
      analyzeNavigationPatterns(updated);
      return updated;
    });
  }, [analyzeNavigationPatterns]);

  const updateRoutePredictions = useCallback(async () => {
    await Promise.all([ensureEngine('gamification'), ensureEngine('spaced'), ensureEngine('difficulty')]);

    const patterns = loadJSON(ROUTER_STORAGE_KEYS.NAV_PATTERNS, { commonPaths: [] });
    const dueItems = getDueItemsSafe(5);
    const adaptiveConfig = getAdaptiveConfigSafe();

    const predictions = [];

    if (Array.isArray(patterns?.commonPaths) && patterns.commonPaths.length > 0) {
      predictions.push(...patterns.commonPaths.slice(0, 3).map((p) => normalizeRouteSlug(p.route)));
    }

    if (dueItems.length > 3) predictions.push(VMQ_ROUTES.FLASHCARDS);

    if (adaptiveConfig?.weakAreas?.length) {
      const weakModule = normalizeRouteSlug(adaptiveConfig.weakAreas[0]?.module);
      if (weakModule) predictions.push(weakModule);
    }

    const unique = [...new Set(predictions)].filter(Boolean).slice(0, 3);
    setPredictedRoutes(unique);
    predictionConfidence.current = Math.min(0.9, unique.length / 3);

    logDiagnostic('PREDICTION', `Next routes: ${unique.join(', ')}`, { confidence: predictionConfidence.current });
  }, []);

  useEffect(() => {
    let timeoutId;

    const handleHashChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const parsed = parseHash(window.location.hash || '');
        const nextRoute = isKnownRouteSlug(parsed.route) ? parsed.route : VMQ_ROUTES.HOME;

        setCurrentRoute(nextRoute);
        setQueryParams(new URLSearchParams(parsed.params || {}));

        updateNavigationHistory(nextRoute, parsed.params || {});
        try { sessionTracker?.startSession?.(nextRoute); } catch {}

        updateRoutePredictions();
      }, 50);
    };

    window.addEventListener('hashchange', handleHashChange, false);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearTimeout(timeoutId);
    };
  }, [parseHash, updateNavigationHistory, updateRoutePredictions]);

  useEffect(() => {
    if (!predictedRoutes.length) return;

    predictedRoutes.forEach((route) => {
      const slug = normalizeRouteSlug(route);
      const file = ROUTE_TO_COMPONENT_FILE[slug];
      if (!file) return;

      const href = `./js/components/${file}`;
      const existing = document.head.querySelector(`link[rel="prefetch"][href="${href}"]`);
      if (existing) return;

      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      link.as = 'script';
      document.head.appendChild(link);

      logDiagnostic('PREFETCH', `Prefetching ${slug} -> ${file}`);
    });
  }, [predictedRoutes]);

  const navigate = useCallback((route, params = {}, options = {}) => {
    const { replace = false, track = true, mlContext = null } = options;

    const targetRoute =
      typeof route === 'string'
        ? normalizeRouteSlug(VMQ_ROUTES[route.toUpperCase?.()] || route)
        : normalizeRouteSlug(route);

    const finalRoute = isKnownRouteSlug(targetRoute) ? targetRoute : VMQ_ROUTES.HOME;

    const paramStr = new URLSearchParams(params || {}).toString();
    const rawHash = paramStr ? `${finalRoute}?${paramStr}` : finalRoute;
    const encoded = `#${encodeURIComponent(rawHash)}`;

    saveJSON(ROUTER_STORAGE_KEYS.LAST_SESSION, { route: finalRoute, params: params || {}, timestamp: Date.now(), mlContext });

    if (replace) window.location.replace(encoded);
    else window.location.hash = encoded;

    if (finalRoute === VMQ_ROUTES.COACH) {
      try { appContext?.actions?.getRecommendations?.(); } catch {}
    }

    if (track) updateNavigationHistory(finalRoute, params || {});
  }, [appContext, updateNavigationHistory]);

  const findPriorityModule = useCallback(() => {
    const dueItems = getDueItemsSafe(10);
    if (dueItems.length > 5) return { route: VMQ_ROUTES.FLASHCARDS, params: { filter: 'due' } };

    const adaptiveConfig = getAdaptiveConfigSafe();
    if (adaptiveConfig?.weakAreas?.length) {
      const weakest = adaptiveConfig.weakAreas[0];
      return { route: normalizeRouteSlug(weakest.module), params: { focus: 'weakness' } };
    }

    const patterns = loadJSON(ROUTER_STORAGE_KEYS.NAV_PATTERNS, { commonPaths: [] });
    if (patterns?.commonPaths?.length) return { route: normalizeRouteSlug(patterns.commonPaths[0].route), params: {} };

    return { route: VMQ_ROUTES.DASHBOARD, params: {} };
  }, []);

  const findWeakestArea = useCallback(() => {
    const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
    const modules = Object.keys(stats?.byModule || {});

    const weaknesses = modules
      .map((m) => {
        const total = stats.byModule[m]?.total || 0;
        const correct = stats.byModule[m]?.correct || 0;
        return { module: normalizeRouteSlug(m), attempts: total, accuracy: total > 0 ? correct / total : 1 };
      })
      .filter((w) => w.attempts > 10)
      .sort((a, b) => a.accuracy - b.accuracy);

    return weaknesses[0] || { module: VMQ_ROUTES.INTERVALS, accuracy: 0, attempts: 0 };
  }, []);

  const navigateSmart = useCallback((type) => {
    switch (type) {
      case 'coach-recommended':
        navigate(VMQ_ROUTES.COACH, { tab: 'recommended', mlSource: 'smart-nav' });
        break;
      case 'priority-module': {
        const priority = findPriorityModule();
        navigate(priority.route, priority.params);
        break;
      }
      case 'sm2-due':
        navigate(VMQ_ROUTES.FLASHCARDS, { filter: 'due', source: 'sm2' });
        break;
      case 'daily-goal':
        navigate(VMQ_ROUTES.GOALS, { focus: 'today' });
        break;
      case 'weak-area': {
        const weak = findWeakestArea();
        navigate(weak.module, { focus: 'weak-area' });
        break;
      }
      default:
        navigate(VMQ_ROUTES.DASHBOARD);
    }
  }, [navigate, findPriorityModule, findWeakestArea]);

  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    const lastSession = loadJSON(ROUTER_STORAGE_KEYS.LAST_SESSION, null);
    const timeSinceLast = Date.now() - (lastSession?.timestamp || 0);

    if (lastSession?.route && timeSinceLast < 86400000 && isKnownRouteSlug(lastSession.route)) {
      const shouldResume = window.confirm(`Welcome back! You were last in ${normalizeRouteSlug(lastSession.route)}. Resume where you left off?`);
      if (shouldResume) {
        navigate(lastSession.route, lastSession.params || {}, { track: false });
        return;
      }
    }

    updateRoutePredictions();
  }, [navigate, updateRoutePredictions]);

  useEffect(() => {
    const shortcuts = {
      '1': VMQ_ROUTES.DASHBOARD,
      '2': VMQ_ROUTES.COACH,
      '3': VMQ_ROUTES.INTERVALS,
      '4': VMQ_ROUTES.BIELER,
      '5': VMQ_ROUTES.RHYTHM,
      '6': VMQ_ROUTES.FLASHCARDS,
      '7': VMQ_ROUTES.GOALS,
      '8': VMQ_ROUTES.SETTINGS,
      '0': VMQ_ROUTES.HOME
    };

    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key;
        if (shortcuts[key]) {
          e.preventDefault();
          navigate(shortcuts[key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  useEffect(() => {
    const focusTarget =
      document.getElementById('main') ||
      document.getElementById('app-content') ||
      document.querySelector('[data-vmq-root]');

    if (focusTarget) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }

    try { a11y?.announce?.(`Navigated to ${currentRoute}`); } catch {}

    // --- VMQ APP MOUNT SIGNAL (required) ---
    // Dispatch a one-time "vmq-app-mounted" event the first time a route
    // successfully renders. The index.html loader listens for this event to
    // hide the splash screen. If this signal is never sent, the loading
    // overlay remains visible indefinitely. We use a global flag to ensure
    // the event only fires once.
    try {
      if (typeof window !== 'undefined' && !window.__VMQ_MOUNTED__) {
        window.__VMQ_MOUNTED__ = true;
        window.dispatchEvent(new Event('vmq-app-mounted'));
      }
    } catch {
      // ignore
    }
  }, [currentRoute]);

  const updateQueryParam = useCallback((key, value) => {
    const newParams = new URLSearchParams(queryParams);
    if (value === null || value === '') newParams.delete(key);
    else newParams.set(key, value);

    setQueryParams(newParams);

    const rawHash = `${currentRoute}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
    window.location.hash = `#${encodeURIComponent(rawHash)}`;
  }, [queryParams, currentRoute]);

  const getQueryParam = useCallback((key, defaultValue = null) => {
    return queryParams.get(key) ?? defaultValue;
  }, [queryParams]);

  const isValidRoute = useCallback((route) => isKnownRouteSlug(route), []);

  const routeInfo = useMemo(() => {
    const valid = isValidRoute(currentRoute);
    return {
      current: currentRoute,
      isValid: valid,
      suggestions: [],
      params: Object.fromEntries(queryParams.entries()),
      path: `${currentRoute}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      category: getRouteCategory(normalizeRouteSlug(currentRoute)),
      predictedNext: predictedRoutes[0] || null,
      predictionConfidence: predictionConfidence.current,
      mlContext: {
        userLevel: getUserLevelSafe(),
        dueItems: getDueItemsSafe(5).length,
        weakAreas: getAdaptiveConfigSafe()?.weakAreas || []
      }
    };
  }, [currentRoute, queryParams, predictedRoutes, isValidRoute]);

  const createShareableLink = useCallback((route = currentRoute, params = {}) => {
    const enrichedParams = { ...params, _sharedBy: getUserLevelSafe(), _timestamp: Date.now() };
    const paramStr = new URLSearchParams(enrichedParams).toString();
    const r = normalizeRouteSlug(route);
    const hash = paramStr ? `${r}?${paramStr}` : r;
    return `${window.location.origin}${window.location.pathname}#${encodeURIComponent(hash)}`;
  }, [currentRoute]);

  const navigateWithExperiment = useCallback((route, params = {}, experimentName) => {
    const variant = Math.random() > 0.5 ? 'A' : 'B';
    const experimentParams = { ...(params || {}), _exp: variant, _expName: experimentName };
    logDiagnostic('EXPERIMENT', `${experimentName}: variant ${variant} for route ${route}`);
    try { sessionTracker?.startSession?.('experiment'); } catch {}
    navigate(route, experimentParams);
  }, [navigate]);

  return {
    route: currentRoute,
    routeInfo,
    navigate,
    navigateSmart,
    queryParams,
    getQueryParam,
    updateQueryParam,
    isValidRoute,
    predictedRoutes,
    createShareableLink,
    navigateWithExperiment,
    navigationHistory,
    goBack: () => {
      if (window.history.length > 1) window.history.back();
      else navigate(VMQ_ROUTES.HOME);
    }
  };
}

function getRouteCategory(route) {
  const r = normalizeRouteSlug(route);
  const categories = {
    theory: [VMQ_ROUTES.INTERVALS, VMQ_ROUTES.KEYS, VMQ_ROUTES.SCALES, VMQ_ROUTES.KEY_TESTER],
    technique: [VMQ_ROUTES.BIELER, VMQ_ROUTES.FINGERBOARD, VMQ_ROUTES.NOTE_LOCATOR, VMQ_ROUTES.BIELER_LAB],
    rhythm: [VMQ_ROUTES.RHYTHM, VMQ_ROUTES.TEMPO, VMQ_ROUTES.RHYTHM_DRILLS, VMQ_ROUTES.SPEED_DRILL],
    coach: [VMQ_ROUTES.DASHBOARD, VMQ_ROUTES.COACH, VMQ_ROUTES.ANALYTICS, VMQ_ROUTES.ACHIEVEMENTS],
    cognitive: [VMQ_ROUTES.FLASHCARDS, VMQ_ROUTES.SPACED_REP],
    tools: [VMQ_ROUTES.SETTINGS, VMQ_ROUTES.DATA_MANAGER, VMQ_ROUTES.JOURNAL]
  };

  for (const [category, routes] of Object.entries(categories)) {
    if (routes.map(normalizeRouteSlug).includes(r)) return category;
  }
  return 'core';
}

// Backward compatibility exports
export function useHashRoute() {
  const router = useVMQRouter();
  return [router.route, router.navigate];
}

export function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = `#${encodeURIComponent(VMQ_ROUTES.HOME)}`;
}

export function getCurrentRoute() {
  const raw = safeDecodeURIComponent(window.location.hash.slice(1));
  const [routePart] = (raw || VMQ_ROUTES.HOME).split('?');
  return normalizeRouteSlug(routePart || VMQ_ROUTES.HOME);
}

// -----------------------------------------------------------------------------
// INITIAL HASH HANDLING (iOS Safari / Empty Hash)
//
// Force an initial route render when the page first loads. On some versions of
// iOS Safari, the "hashchange" event does not fire on page load if there is
// already a hash present, which can result in the router never updating the
// current route. Additionally, if no hash is provided, default to the home
// route. This listener runs once on the browser "load" event and either sets
// a default hash or dispatches a synthetic hashchange event to kick the
// router's hash listener. Wrapping in a typeof guard avoids errors during
// server-side rendering.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    try {
      const currentHash = window.location.hash || '';
      // If there is no hash, navigate to the home route (#menu by default).
      if (!currentHash || currentHash === '#') {
        const homeSlug = VMQ_ROUTES.HOME || 'menu';
        window.location.hash = `#${encodeURIComponent(homeSlug)}`;
      } else {
        // Ensure the router's hashchange handler runs on load. Safari may not
        // dispatch the initial hashchange automatically, so we dispatch one
        // manually. Wrapped in try/catch for older browsers.
        try {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch {
          // Fallback: force a no-op hash update to trigger the listener.
          window.location.hash = window.location.hash;
        }
      }
    } catch {
      // ignore
    }
  });
}