// js/utils/router.js
// ======================================
// VMQ ROUTER v3.0.5 - ML-Enhanced Navigation (Corrected + Compatible)
// Predictive Prefetching + Robust Storage + Safer Engine Integration
// ======================================

const { useState, useEffect, useCallback, useMemo, useContext, useRef } = React;

import { AppContext } from '../contexts/AppContext.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { a11y } from '../accessibility.js'; // ✅ FIXED PATH (was wrong)

import {
  normalizeRouteSlug,
  safeDecodeURIComponent,
  parseQueryString,
  getComponentFileForRoute,
  isKnownRoute,
  ROUTE_TO_COMPONENT_FILE,
} from '../config/routeManifest.js';

// ------------------------------------------------------
// ROUTES (public API)
// ------------------------------------------------------
export const VMQ_ROUTES = Object.freeze({
  // Core
  MENU: 'menu',
  HOME: 'menu',          // backward-friendly alias
  WELCOME: 'welcome',

  DASHBOARD: 'dashboard',
  COACH: 'coach',
  GOALS: 'dailygoals',
  ACHIEVEMENTS: 'achievements',
  ANALYTICS: 'analytics',

  SETTINGS: 'settings',
  JOURNAL: 'journal',
  DATA_MANAGER: 'datamanager',

  // Music theory
  INTERVALS: 'intervals',
  INTERVAL_EAR: 'interval-ear',
  INTERVAL_SPRINT: 'interval-sprint',
  KEYS: 'keys',
  KEY_TESTER: 'key-tester',

  // Violin technique
  BIELER: 'bieler',
  BIELER_LAB: 'bielerlab',
  FINGERBOARD: 'fingerboard',
  NOTE_LOCATOR: 'notelocator',
  SCALES: 'scales',
  FLASHCARDS: 'flashcards',

  // Rhythm + tempo
  RHYTHM: 'rhythm',
  RHYTHM_DRILLS: 'rhythm-drills',
  TEMPO: 'tempotrainer',
  SPEED_DRILL: 'speeddrill',

  // Cognitive
  SPACED_REP: 'spaced-rep',

  // Deep-link logical targets (not necessarily App routes)
  RECOMMENDED: 'recommended',
  PRIORITY: 'priority',
});

// Backward-compat alias
export const VMQROUTES = VMQ_ROUTES;

// ------------------------------------------------------
// ROUTER STORAGE KEYS
// ------------------------------------------------------
const ROUTER_STORAGE_KEYS = Object.freeze({
  LAST_SESSION: STORAGE_KEYS?.LAST_SESSION || 'vmq.router.lastSession',
  NAV_HISTORY: STORAGE_KEYS?.NAV_HISTORY || 'vmq.router.navHistory',
  NAV_PATTERNS: STORAGE_KEYS?.NAV_PATTERNS || 'vmq.router.navPatterns',
});

// ------------------------------------------------------
// Helpers
// ------------------------------------------------------
function safeMultiDecode(input, maxPasses = 2) {
  let s = (input ?? '').toString();
  for (let i = 0; i < maxPasses; i++) {
    const dec = safeDecodeURIComponent(s);
    if (dec === s) break;
    s = dec;
  }
  return s;
}

function paramsObjectToSearchParams(obj) {
  const usp = new URLSearchParams();
  const o = obj && typeof obj === 'object' ? obj : {};
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) v.forEach((vv) => usp.append(k, String(vv)));
    else if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  return usp;
}

function isKnownRouteSlug(routeSlug) {
  const slug = normalizeRouteSlug(routeSlug);
  if (!slug) return false;

  // routeManifest is canonical
  if (isKnownRoute(slug)) return true;

  // allow explicit VMQ_ROUTES values even if not in manifest yet
  const allowed = new Set(Object.values(VMQ_ROUTES).map(normalizeRouteSlug));
  return allowed.has(slug);
}

// ------------------------------------------------------
// OPTIONAL ENGINE ACCESS (best-effort, avoids hard-crashing router)
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
  try {
    if (g?.getUserLevel) return g.getUserLevel();
  } catch {}
  return 1;
}

function getAdaptiveConfigSafe() {
  const d = engineCacheRef.current.difficulty;
  try {
    if (d?.getAdaptiveConfig) return d.getAdaptiveConfig();
  } catch {}
  return {};
}

function getDueItemsSafe(limit = 5) {
  const s = engineCacheRef.current.spaced;
  try {
    if (s?.getDueItems) return s.getDueItems('all', limit) || [];
  } catch {}
  return [];
}

// ------------------------------------------------------
// ROUTER HOOK
// ------------------------------------------------------
export function useVMQRouter() {
  const appContext = useContext(AppContext);
  const hasMounted = useRef(false);
  const predictionConfidence = useRef(0);

  // Parse hash → { route, params, raw }
  const parseHash = useCallback((hash) => {
    const rawHash = (hash ?? '').toString();
    const stripped = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;

    // Handles both legacy fully-encoded hashes and normal hashes
    const decoded = safeMultiDecode(stripped).trim();

    const [routePartRaw, queryRaw = ''] = decoded.split('?');
    const route = normalizeRouteSlug(routePartRaw || VMQ_ROUTES.HOME);

    // Robust parse (supports repeated keys)
    const paramsObj = parseQueryString(queryRaw);

    return {
      route,
      params: paramsObj,
      raw: decoded,
    };
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
    return paramsObjectToSearchParams(parsed.params || {});
  });

  const [navigationHistory, setNavigationHistory] = useState(() =>
    loadJSON(ROUTER_STORAGE_KEYS.NAV_HISTORY, [])
  );

  const [predictedRoutes, setPredictedRoutes] = useState([]);

  // ------------------------------------------------------
  // DIAGNOSTICS (opt-in)
  // ------------------------------------------------------
  function logDiagnostic(category, message, data = null) {
    if (window.location.search.includes('vmq-diagnostics')) {
      console.log(`%c[Router] ${category}: ${message}`, 'color: #3b82f6;', data || '');
    }
  }

  // ------------------------------------------------------
  // NAV HISTORY + PATTERN MINING
  // ------------------------------------------------------
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
          primaryGoal: route.includes('coach') ? 'review' : 'practice',
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),

      frequentPairs: Object.entries(routePairs)
        .map(([pair, count]) => ({ pair, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),

      lastAnalyzed: Date.now(),
    };

    saveJSON(ROUTER_STORAGE_KEYS.NAV_PATTERNS, patterns);
  }, []);

  const updateNavigationHistory = useCallback(
    (route, params) => {
      const entry = {
        route: normalizeRouteSlug(route),
        params: params || {},
        timestamp: Date.now(),
        userLevel: getUserLevelSafe(),
        sessionId: sessionTracker?.getCurrentSession?.()?.id || 'unknown',
      };

      setNavigationHistory((prev) => {
        const updated = [...(Array.isArray(prev) ? prev : []), entry].slice(-100);
        saveJSON(ROUTER_STORAGE_KEYS.NAV_HISTORY, updated);
        analyzeNavigationPatterns(updated);
        return updated;
      });
    },
    [analyzeNavigationPatterns]
  );

  // ------------------------------------------------------
  // ML-ish PREDICTIONS (best-effort)
  // ------------------------------------------------------
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

    logDiagnostic('PREDICTION', `Next routes: ${unique.join(', ')}`, {
      confidence: predictionConfidence.current,
    });
  }, []);

  // ------------------------------------------------------
  // HASHCHANGE LISTENER
  // ------------------------------------------------------
  useEffect(() => {
    let timeoutId;

    const handleHashChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const parsed = parseHash(window.location.hash || '');
        const nextRoute = isKnownRouteSlug(parsed.route) ? parsed.route : VMQ_ROUTES.HOME;

        setCurrentRoute(nextRoute);
        setQueryParams(paramsObjectToSearchParams(parsed.params || {}));

        updateNavigationHistory(nextRoute, parsed.params || {});
        try {
          sessionTracker?.startSession?.(nextRoute);
        } catch {}

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

  // ------------------------------------------------------
  // PREFETCH PREDICTED MODULES (uses routeManifest mapping)
  // ------------------------------------------------------
  useEffect(() => {
    if (!predictedRoutes.length) return;

    predictedRoutes.forEach((route) => {
      const slug = normalizeRouteSlug(route);
      const file = getComponentFileForRoute(slug);
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

  // ------------------------------------------------------
  // NAVIGATE (FIXED: no double-encoding of entire hash)
  // ------------------------------------------------------
  const navigate = useCallback(
    (route, params = {}, options = {}) => {
      const { replace = false, track = true, mlContext = null } = options;

      // Support: navigate("DASHBOARD") or navigate(VMQ_ROUTES.DASHBOARD) or navigate("dashboard")
      const routeStr = (route ?? '').toString();
      const asKey = routeStr.toUpperCase();
      const resolved = VMQ_ROUTES[asKey] || routeStr;

      const targetRoute = normalizeRouteSlug(resolved);
      const finalRoute = isKnownRouteSlug(targetRoute) ? targetRoute : VMQ_ROUTES.HOME;

      const usp = paramsObjectToSearchParams(params || {});
      const paramStr = usp.toString();

      // Encode route segment only (query already encoded by URLSearchParams)
      const newHash = `#${encodeURIComponent(finalRoute)}${paramStr ? `?${paramStr}` : ''}`;

      saveJSON(ROUTER_STORAGE_KEYS.LAST_SESSION, {
        route: finalRoute,
        params: params || {},
        timestamp: Date.now(),
        mlContext,
      });

      if (replace) window.location.replace(newHash);
      else window.location.hash = newHash;

      if (finalRoute === VMQ_ROUTES.COACH) {
        try {
          appContext?.actions?.getRecommendations?.();
        } catch (e) {
          console.warn('[Router] Coach refresh failed', e);
        }
      }

      if (track) updateNavigationHistory(finalRoute, params || {});
    },
    [appContext, updateNavigationHistory]
  );

  // ------------------------------------------------------
  // SMART NAVIGATION
  // ------------------------------------------------------
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
        return {
          module: normalizeRouteSlug(m),
          attempts: total,
          accuracy: total > 0 ? correct / total : 1,
        };
      })
      .filter((w) => w.attempts > 10)
      .sort((a, b) => a.accuracy - b.accuracy);

    return weaknesses[0] || { module: VMQ_ROUTES.INTERVALS, accuracy: 0, attempts: 0 };
  }, []);

  const navigateSmart = useCallback(
    (type) => {
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
    },
    [navigate, findPriorityModule, findWeakestArea]
  );

  // ------------------------------------------------------
  // SESSION RESUMPTION (one-time prompt)
  // ------------------------------------------------------
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    const lastSession = loadJSON(ROUTER_STORAGE_KEYS.LAST_SESSION, null);
    const timeSinceLast = Date.now() - (lastSession?.timestamp || 0);

    if (lastSession?.route && timeSinceLast < 86400000 && isKnownRouteSlug(lastSession.route)) {
      const shouldResume = window.confirm(
        `Welcome back! You were last in ${normalizeRouteSlug(lastSession.route)}. Resume where you left off?`
      );
      if (shouldResume) {
        navigate(lastSession.route, lastSession.params || {}, { track: false });
        return;
      }
    }

    updateRoutePredictions();
  }, [navigate, updateRoutePredictions]);

  // ------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // ------------------------------------------------------
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
      '0': VMQ_ROUTES.HOME,
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

  // ------------------------------------------------------
  // FOCUS + A11Y ANNOUNCEMENTS
  // ------------------------------------------------------
  useEffect(() => {
    const focusTarget =
      document.getElementById('main') ||
      document.getElementById('app-content') ||
      document.querySelector('[data-vmq-root]');

    if (focusTarget) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }

    try {
      a11y?.announce?.(`Navigated to ${currentRoute}`);
    } catch {}
  }, [currentRoute]);

  // ------------------------------------------------------
  // QUERY PARAM HELPERS (hash-based)
  // ------------------------------------------------------
  const updateQueryParam = useCallback(
    (key, value) => {
      const newParams = new URLSearchParams(queryParams);
      if (value === null || value === '') newParams.delete(key);
      else newParams.set(key, value);

      setQueryParams(newParams);

      const newHash = `#${encodeURIComponent(currentRoute)}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
      window.location.hash = newHash;
    },
    [queryParams, currentRoute]
  );

  const getQueryParam = useCallback(
    (key, defaultValue = null) => queryParams.get(key) ?? defaultValue,
    [queryParams]
  );

  // ------------------------------------------------------
  // ROUTE VALIDATION + SUGGESTIONS
  // ------------------------------------------------------
  const findSimilarRoutes = useCallback((invalidRoute) => {
    const needle = normalizeRouteSlug(invalidRoute);
    const routes = [...new Set(Object.keys(ROUTE_TO_COMPONENT_FILE).map(normalizeRouteSlug))];

    const similarities = routes.map((route) => ({
      route,
      similarity: calculateStringSimilarity(needle, route),
    }));

    return similarities
      .filter((s) => s.similarity > 0.6)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map((s) => s.route);
  }, []);

  const isValidRoute = useCallback((route) => isKnownRouteSlug(route), []);

  // ------------------------------------------------------
  // ROUTE INFO
  // ------------------------------------------------------
  const routeInfo = useMemo(() => {
    const valid = isValidRoute(currentRoute);
    const suggestions = valid ? [] : findSimilarRoutes(currentRoute);

    return {
      current: currentRoute,
      isValid: valid,
      suggestions,
      params: Object.fromEntries(queryParams.entries()),
      path: `${currentRoute}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      category: getRouteCategory(normalizeRouteSlug(currentRoute)),
      predictedNext: predictedRoutes[0] || null,
      predictionConfidence: predictionConfidence.current,
      mlContext: {
        userLevel: getUserLevelSafe(),
        dueItems: getDueItemsSafe(5).length,
        weakAreas: getAdaptiveConfigSafe()?.weakAreas || [],
      },
    };
  }, [currentRoute, queryParams, predictedRoutes, isValidRoute, findSimilarRoutes]);

  // ------------------------------------------------------
  // SHAREABLE LINKS
  // ------------------------------------------------------
  const createShareableLink = useCallback(
    (route = currentRoute, params = {}) => {
      const enrichedParams = {
        ...params,
        _sharedBy: getUserLevelSafe(),
        _timestamp: Date.now(),
      };

      const r = normalizeRouteSlug(route);
      const usp = paramsObjectToSearchParams(enrichedParams);
      const hash = `#${encodeURIComponent(r)}${usp.toString() ? `?${usp.toString()}` : ''}`;

      return `${window.location.origin}${window.location.pathname}${hash}`;
    },
    [currentRoute]
  );

  // ------------------------------------------------------
  // EXPERIMENT NAV
  // ------------------------------------------------------
  const navigateWithExperiment = useCallback(
    (route, params = {}, experimentName) => {
      const variant = Math.random() > 0.5 ? 'A' : 'B';
      const experimentParams = { ...(params || {}), _exp: variant, _expName: experimentName };

      logDiagnostic('EXPERIMENT', `${experimentName}: variant ${variant} for route ${route}`);

      try {
        sessionTracker?.startSession?.('experiment');
      } catch {}

      navigate(route, experimentParams);
    },
    [navigate]
  );

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
    },
  };
}

// ------------------------------------------------------
// ROUTE CATEGORIES
// ------------------------------------------------------
function getRouteCategory(route) {
  const r = normalizeRouteSlug(route);
  const categories = {
    theory: [VMQ_ROUTES.INTERVALS, VMQ_ROUTES.KEYS, VMQ_ROUTES.SCALES, VMQ_ROUTES.KEY_TESTER],
    technique: [VMQ_ROUTES.BIELER, VMQ_ROUTES.FINGERBOARD, VMQ_ROUTES.NOTE_LOCATOR, VMQ_ROUTES.BIELER_LAB],
    rhythm: [VMQ_ROUTES.RHYTHM, VMQ_ROUTES.TEMPO, VMQ_ROUTES.RHYTHM_DRILLS, VMQ_ROUTES.SPEED_DRILL],
    coach: [VMQ_ROUTES.DASHBOARD, VMQ_ROUTES.COACH, VMQ_ROUTES.ANALYTICS, VMQ_ROUTES.ACHIEVEMENTS],
    cognitive: [VMQ_ROUTES.FLASHCARDS, VMQ_ROUTES.SPACED_REP],
    tools: [VMQ_ROUTES.SETTINGS, VMQ_ROUTES.DATA_MANAGER, VMQ_ROUTES.JOURNAL],
  };

  for (const [category, routes] of Object.entries(categories)) {
    if (routes.map(normalizeRouteSlug).includes(r)) return category;
  }
  return 'core';
}

// ------------------------------------------------------
// BACKWARD COMPATIBILITY EXPORTS
// ------------------------------------------------------
export function useHashRoute() {
  const router = useVMQRouter();
  return [router.route, router.navigate];
}

export function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = `#${encodeURIComponent(VMQ_ROUTES.HOME)}`;
}

export function getCurrentRoute() {
  const raw = safeMultiDecode((window.location.hash || '').slice(1));
  const [routePart] = (raw || VMQ_ROUTES.HOME).split('?');
  return normalizeRouteSlug(routePart || VMQ_ROUTES.HOME);
}

// ------------------------------------------------------
// DEEP LINKS
// ------------------------------------------------------
export const DEEP_LINKS = {
  shareProgress: (userLevel = 'intermediate') => {
    const focus =
      userLevel === 'beginner' ? 'intervals'
      : userLevel === 'advanced' ? 'bieler'
      : 'keys';
    return `${VMQ_ROUTES.DASHBOARD}?tab=week&focus=${focus}`;
  },

  priorityPractice: (module, userContext = {}) => {
    const params = new URLSearchParams({ mode: 'priority', ...(userContext || {}) });
    return `${normalizeRouteSlug(module)}?${params.toString()}`;
  },

  sm2Due: (count = 0) => {
    return `${VMQ_ROUTES.FLASHCARDS}?filter=due&count=${count}`;
  },

  challengeFriend: (module, difficulty = 'medium', userLevel = 'intermediate') => {
    return `${normalizeRouteSlug(module)}?mode=challenge&difficulty=${difficulty}&level=${userLevel}`;
  },
};

export const DEEPLINKS = DEEP_LINKS;

// ------------------------------------------------------
// STRING SIMILARITY UTILS
// ------------------------------------------------------
function calculateStringSimilarity(str1, str2) {
  const a = (str1 || '').toString();
  const b = (str2 || '').toString();
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;

  if (longer.length === 0) return 1.0;
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const s1 = (str1 || '').toString();
  const s2 = (str2 || '').toString();

  const matrix = Array.from({ length: s2.length + 1 }, () => []);

  for (let i = 0; i <= s2.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}