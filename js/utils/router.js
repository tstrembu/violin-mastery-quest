// js/utils/router.js
// ======================================
// VMQ ROUTER v3.0 - ML-Enhanced Navigation
// 50+ Module Navigation + Predictive Prefetching
// ======================================

const { useState, useEffect, useCallback, useMemo, useContext, useRef } = React;
import { AppContext } from '../contexts/AppContext.js';
import sessionTracker from '../engines/sessionTracker.js';
import { analyzePerformance } from '../engines/analytics.js';
import { getUserLevel } from '../engines/gamification.js';
import { getAdaptiveConfig } from '../engines/difficultyAdapter.js';
import { getDueItems } from '../engines/spacedRepetition.js';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';

// 🎯 VMQ ROUTE CONFIG (50+ modules)
export const VMQ_ROUTES = {
  // 🎯 CORE NAVIGATION
  HOME: 'menu',
  DASHBOARD: 'dashboard',
  COACH: 'coach',
  GOALS: 'dailygoals',
  ACHIEVEMENTS: 'achievements',
  ANALYTICS: 'analytics',
  
  // 🎵 MUSIC THEORY
  INTERVALS: 'intervals',
  INTERVAL_EAR: 'interval-ear',
  INTERVAL_SPRINT: 'interval-sprint',
  KEYS: 'keys',
  KEY_TESTER: 'key-tester',
  
  // 🎻 VIOLIN TECHNIQUE
  BIELER: 'bieler',
  BIELER_LAB: 'bielerlab',
  FINGERBOARD: 'fingerboard',
  NOTE_LOCATOR: 'notelocator',
  SCALES: 'scaleslab',
  FLASHCARDS: 'flashcards', // <--- This line is MISSING but assumed by context
  
  // 🥁 RHYTHM + TEMPO
  RHYTHM: 'rhythm',
  RHYTHM_DRILLS: 'rhythm-drills',
  TEMPO: 'tempotrainer',
  SPEED_DRILL: 'speeddrill',
  
  // 🧠 COGNITIVE
  SPACED_REP: 'spaced-rep',
  
  // 📊 TOOLS
  DATA_MANAGER: 'datamanager',
  SETTINGS: 'settings',
  JOURNAL: 'practicejournal',
  
  // 🎯 COACH DEEP LINKS
  RECOMMENDED: 'recommended',
  PRIORITY: 'priority'
};

// Backward-compat alias
export const VMQROUTES = VMQ_ROUTES;

// 🎯 ML-ENHANCED ROUTER HOOK
export function useVMQRouter() {
  const appContext = useContext(AppContext);
  const hasMounted = useRef(false);

  const [currentRoute, setCurrentRoute] = useState(() => {
    const initial = decodeURIComponent(window.location.hash.slice(1)) || VMQ_ROUTES.HOME;
    // Try to resume last session on first load
    const lastSession = loadJSON(STORAGE_KEYS.LAST_SESSION, null);
    if (lastSession && lastSession.route && Date.now() - lastSession.timestamp < 86400000) {
      return lastSession.route;
    }
    return initial;
  });
  
  const [queryParams, setQueryParams] = useState(() => 
    new URLSearchParams(window.location.search)
  );
  
  const [navigationHistory, setNavigationHistory] = useState(() => 
    loadJSON(STORAGE_KEYS.NAV_HISTORY, [])
  );

  // 🎯 PREDICTIVE ROUTE CACHE
  const [predictedRoutes, setPredictedRoutes] = useState([]);
  const predictionConfidence = useRef(0);

  // 🎯 ML: Parse route with prediction context
  const parseRoute = useCallback((hash) => {
    const cleanHash = decodeURIComponent(hash || '')
      .slice(1)
      .toLowerCase()
      .trim();
    
    const [routePart, paramStr = ''] = cleanHash.split('?');
    const params = new URLSearchParams(paramStr);
    const routeKey = routePart?.toUpperCase?.() || '';
    
    // ML: Analyze route intent
    const intent = analyzeRouteIntent(routePart, Object.fromEntries(params));
    
    return {
      route: VMQ_ROUTES[routeKey] || routePart || VMQ_ROUTES.HOME,
      params: Object.fromEntries(params.entries()),
      raw: cleanHash,
      intent,
      mlAnalyzed: true
    };
  }, []);

  // 🎯 ML: Analyze route intent based on user patterns
  function analyzeRouteIntent(route, params) {
    const patterns = loadJSON(STORAGE_KEYS.NAV_PATTERNS, { commonPaths: [] });
    const userLevel = getUserLevel();
    const dueItems = getDueItems('all', 10);
    
    const intent = {
      likelyGoal: 'practice',
      expectedDuration: 15,
      difficulty: params.difficulty || 'auto',
      dueItemsCount: dueItems.length,
      userLevel,
      confidence: 0.6
    };
    
    // Check if route matches common patterns
    const commonPath = patterns.commonPaths.find(p => p.route === route);
    if (commonPath) {
      intent.expectedDuration = commonPath.avgDuration;
      intent.likelyGoal = commonPath.primaryGoal;
      intent.confidence = Math.min(0.95, commonPath.frequency * 0.1);
    }
    
    // Adjust for due items
    if (dueItems.length > 5 && route === VMQ_ROUTES.FLASHCARDS) {
      intent.likelyGoal = 'review';
      intent.priority = 'high';
    }
    
    return intent;
  }

  // 🎯 LIVE HASH LISTENER (Debounced + ML-enhanced)
  useEffect(() => {
    let timeoutId;
    const handleHashChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const parsed = parseRoute(window.location.hash || '');
        setCurrentRoute(parsed.route);
        setQueryParams(new URLSearchParams(parsed.params));
        
        // Update navigation history for ML
        updateNavigationHistory(parsed.route, parsed.params);
        
        // Track with session
        try {
          sessionTracker?.trackNavigation?.(parsed.route, parsed.params);
        } catch (e) {
          console.warn('[Router] sessionTracker.trackNavigation failed', e);
        }
        
        // ML: Update predictions
        updateRoutePredictions();
      }, 50);
    };

    window.addEventListener('hashchange', handleHashChange, false);
    handleHashChange();
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearTimeout(timeoutId);
    };
  }, [parseRoute]);

  // 🎯 ML: Update navigation history with intelligence
  function updateNavigationHistory(route, params) {
    const entry = {
      route,
      params,
      timestamp: Date.now(),
      userLevel: getUserLevel(),
      sessionId: sessionTracker?.getCurrentSession?.() || 'unknown'
    };
    
    // Keep last 100 entries for ML analysis
    const updated = [...navigationHistory, entry].slice(-100);
    setNavigationHistory(updated);
    saveJSON(STORAGE_KEYS.NAV_HISTORY, updated);
    
    // Analyze patterns in background
    analyzeNavigationPatterns(updated);
  }

  // 🎯 ML: Analyze navigation patterns for predictions
  function analyzeNavigationPatterns(history) {
    if (history.length < 5) return;
    
    // Find common paths
    const routeCounts = {};
    const routePairs = {};
    
    history.forEach((entry, i) => {
      routeCounts[entry.route] = (routeCounts[entry.route] || 0) + 1;
      
      if (i > 0) {
        const pair = `${history[i-1].route}→${entry.route}`;
        routePairs[pair] = (routePairs[pair] || 0) + 1;
      }
    });
    
    // Save patterns for ML use
    const patterns = {
      commonPaths: Object.entries(routeCounts)
        .map(([route, count]) => ({
          route,
          frequency: count,
          avgDuration: 15, // Placeholder, could be enhanced
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
    
    saveJSON(STORAGE_KEYS.NAV_PATTERNS, patterns);
  }

  // 🎯 ML: Predict next likely routes
  function updateRoutePredictions() {
    const patterns = loadJSON(STORAGE_KEYS.NAV_PATTERNS, { commonPaths: [] });
    const dueItems = getDueItems('all', 5);
    
    const predictions = [];
    
    // Based on patterns
    if (patterns.commonPaths.length > 0) {
      predictions.push(...patterns.commonPaths.slice(0, 3).map(p => p.route));
    }
    
    // Based on due items
    if (dueItems.length > 3) {
      predictions.push(VMQ_ROUTES.FLASHCARDS);
    }
    
    // Based on user level and weak areas
    const adaptiveConfig = getAdaptiveConfig();
    if (adaptiveConfig.weakAreas?.length) {
      const weakModule = adaptiveConfig.weakAreas[0].module;
      predictions.push(weakModule);
    }
    
    // Deduplicate and limit
    const uniquePredictions = [...new Set(predictions)].slice(0, 3);
    setPredictedRoutes(uniquePredictions);
    
    // Update confidence
    predictionConfidence.current = Math.min(0.9, uniquePredictions.length / 3);
    
    logDiagnostic('PREDICTION', `Next routes: ${uniquePredictions.join(', ')}`, {
      confidence: predictionConfidence.current
    });
  }

  // 🎯 ML: Prefetch predicted routes
  useEffect(() => {
    if (predictedRoutes.length === 0) return;
    
    predictedRoutes.forEach(route => {
      const modulePath = `./js/components/${route}.js`;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = modulePath;
      link.as = 'script';
      document.head.appendChild(link);
      
      logDiagnostic('PREFETCH', `Prefetching ${route}`);
    });
  }, [predictedRoutes]);

  // 🎯 PRODUCTION NAVIGATION (ML-enhanced)
  const navigate = useCallback(
    (route, params = {}, options = {}) => {
      const {
        replace = false,
        track = true,
        mlContext = null,
        experiment = null
      } = options;
      
      const targetRoute =
        typeof route === 'string'
          ? VMQ_ROUTES[route.toUpperCase()] || route
          : route;
      
      const paramStr = new URLSearchParams(params).toString();
      const hash = paramStr ? `${targetRoute}?${paramStr}` : targetRoute;
      const encoded = `#${encodeURIComponent(hash)}`;
      
      // ML: Save last session state
      saveJSON(STORAGE_KEYS.LAST_SESSION, {
        route: targetRoute,
        params,
        timestamp: Date.now(),
        mlContext
      });
      
      // A/B testing support
      if (experiment) {
        const variant = Math.random() > 0.5 ? 'A' : 'B';
        params._exp = variant;
        logDiagnostic('EXPERIMENT', `${experiment}: variant ${variant}`);
      }
      
      if (replace) {
        window.location.replace(encoded);
      } else {
        window.location.hash = encoded;
      }
      
      // ML: Update context for Coach
      if (targetRoute === VMQ_ROUTES.COACH) {
        try {
          appContext?.actions?.getRecommendations?.();
        } catch (e) {
          console.warn('[Router] Coach refresh failed', e);
        }
      }
      
      // Track navigation
      if (track) {
        updateNavigationHistory(targetRoute, params);
      }
    },
    [appContext, navigationHistory]
  );

  // 🎯 SMART NAVIGATION (ML-enhanced)
  const navigateSmart = useCallback(
    (type, module = null) => {
      switch (type) {
        case 'coach-recommended':
          navigate(VMQ_ROUTES.COACH, { tab: 'recommended', mlSource: 'smart-nav' });
          break;
        case 'priority-module':
          // ML: Find highest priority module
          const priority = findPriorityModule();
          navigate(priority.route, priority.params);
          break;
        case 'sm2-due':
          navigate(VMQ_ROUTES.FLASHCARDS, { filter: 'due', source: 'sm2' });
          break;
        case 'daily-goal':
          navigate(VMQ_ROUTES.GOALS, { focus: 'today' });
          break;
        case 'weak-area':
          const weak = findWeakestArea();
          navigate(weak.module, { focus: 'weak-area' });
          break;
        default:
          navigate(VMQ_ROUTES.DASHBOARD);
      }
    },
    [navigate]
  );

  // 🎯 ML: Find priority module based on multiple factors
  function findPriorityModule() {
    const dueItems = getDueItems('all', 10);
    if (dueItems.length > 5) {
      return { route: VMQ_ROUTES.FLASHCARDS, params: { filter: 'due' } };
    }
    
    const adaptiveConfig = getAdaptiveConfig();
    if (adaptiveConfig.weakAreas?.length) {
      const weakest = adaptiveConfig.weakAreas[0];
      return { route: weakest.module, params: { focus: 'weakness' } };
    }
    
    const patterns = loadJSON(STORAGE_KEYS.NAV_PATTERNS, { commonPaths: [] });
    if (patterns.commonPaths.length) {
      return { route: patterns.commonPaths[0].route, params: {} };
    }
    
    return { route: VMQ_ROUTES.DASHBOARD, params: {} };
  }

  // 🎯 ML: Find weakest learning area
  function findWeakestArea() {
    const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
    const modules = Object.keys(stats.byModule);
    
    const weaknesses = modules
      .map(module => ({
        module,
        accuracy: stats.byModule[module].correct / stats.byModule[module].total,
        attempts: stats.byModule[module].total
      }))
      .filter(w => w.attempts > 10) // Only consider practiced modules
      .sort((a, b) => a.accuracy - b.accuracy);
    
    return weaknesses[0] || { module: VMQ_ROUTES.INTERVALS, accuracy: 0 };
  }

  // 🎯 SESSION RESUMPTION
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    
    const lastSession = loadJSON(STORAGE_KEYS.LAST_SESSION, null);
    const timeSinceLast = Date.now() - (lastSession?.timestamp || 0);
    
    // Resume if less than 24 hours and route is valid
    if (lastSession && timeSinceLast < 86400000 && isValidRoute(lastSession.route)) {
      const shouldResume = window.confirm(
        `Welcome back! You were last in ${lastSession.route}. Resume where you left off?`
      );
      
      if (shouldResume) {
        navigate(lastSession.route, lastSession.params, { track: false });
        return; // Skip initial render
      }
    }
    
    // Initial route prediction
    updateRoutePredictions();
  }, [navigate, isValidRoute]);

  // 🎯 KEYBOARD SHORTCUTS
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

  // 🎯 FOCUS MANAGEMENT (Accessibility)
  useEffect(() => {
    const mainContent = document.getElementById('app-content');
    if (mainContent) {
      mainContent.setAttribute('tabindex', '-1');
      mainContent.focus();
      
      // Announce route change to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.textContent = `Navigated to ${currentRoute}`;
      document.body.appendChild(announcement);
      setTimeout(() => announcement.remove(), 1000);
    }
  }, [currentRoute]);

  // 🎯 QUERY PARAM HELPERS
  const updateQueryParam = useCallback(
    (key, value) => {
      const newParams = new URLSearchParams(queryParams);
      if (value === null || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
      setQueryParams(newParams);
      
      // Update URL without navigation
      const newHash = `${currentRoute}?${newParams.toString()}`;
      window.location.hash = encodeURIComponent(newHash);
    },
    [queryParams, currentRoute]
  );

  const getQueryParam = useCallback(
    (key, defaultValue = null) => {
      return queryParams.get(key) ?? defaultValue;
    },
    [queryParams]
  );

  // 🎯 ML-ENHANCED ROUTE VALIDATION
  const isValidRoute = useCallback((route) => {
    if (!route) return false;
    
    const key = route.toUpperCase?.() || '';
    const isKnown = VMQ_ROUTES[key] === route || Object.values(VMQ_ROUTES).includes(route);
    
    // ML: Suggest similar routes if invalid
    if (!isKnown && route.length > 2) {
      const suggestions = findSimilarRoutes(route);
      if (suggestions.length) {
        logDiagnostic('VALIDATION', `Invalid route ${route}, suggestions: ${suggestions.join(', ')}`);
        return { valid: false, suggestions };
      }
    }
    
    return isKnown;
  }, []);

  // 🎯 ML: Find similar routes for suggestions
  function findSimilarRoutes(invalidRoute) {
    const routes = Object.values(VMQ_ROUTES);
    const similarities = routes.map(route => ({
      route,
      similarity: calculateStringSimilarity(invalidRoute, route)
    }));
    
    return similarities
      .filter(s => s.similarity > 0.6)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(s => s.route);
  }

  // 🎯 ML-ENHANCED ROUTE INFO
  const routeInfo = useMemo(
    () => ({
      current: currentRoute,
      isValid: isValidRoute(currentRoute),
      params: Object.fromEntries(queryParams.entries()),
      path: `${currentRoute}${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`,
      category: getRouteCategory(currentRoute),
      predictedNext: predictedRoutes[0] || null,
      predictionConfidence: predictionConfidence.current,
      mlContext: {
        userLevel: getUserLevel(),
        dueItems: getDueItems('all', 5).length,
        weakAreas: getAdaptiveConfig().weakAreas || []
      }
    }),
    [currentRoute, queryParams, isValidRoute, predictedRoutes]
  );

  // 🎯 ML-POWERED DEEP LINKS
  const createShareableLink = useCallback(
    (route = currentRoute, params = {}) => {
      const userLevel = getUserLevel();
      const adaptiveConfig = getAdaptiveConfig();
      
      // Add ML context to params
      const enrichedParams = {
        ...params,
        _sharedBy: userLevel,
        _focus: adaptiveConfig.weakAreas?.[0]?.module || 'general',
        _timestamp: Date.now()
      };
      
      const paramStr = new URLSearchParams(enrichedParams).toString();
      const hash = paramStr ? `${route}?${paramStr}` : route;
      
      return `${window.location.origin}${window.location.pathname}#${encodeURIComponent(hash)}`;
    },
    [currentRoute]
  );

  // 🎯 A/B TESTING SUPPORT
  const navigateWithExperiment = useCallback(
    (route, params = {}, experimentName) => {
      const variant = Math.random() > 0.5 ? 'A' : 'B';
      const experimentParams = { ...params, _exp: variant, _expName: experimentName };
      
      logDiagnostic('EXPERIMENT', `${experimentName}: variant ${variant} for route ${route}`);
      
      // Track experiment start
      if (sessionTracker?.trackActivity) {
        sessionTracker.trackActivity('router', 'experiment-start', {
          experiment: experimentName,
          variant,
          route
        });
      }
      
      navigate(route, experimentParams);
    },
    [navigate]
  );

  // 🎯 DIAGNOSTIC LOGGING
  function logDiagnostic(category, message, data = null) {
    if (window.location.search.includes('vmq-diagnostics')) {
      console.log(`%c[Router] ${category}: ${message}`, 'color: #3b82f6;', data || '');
    }
  }

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
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate(VMQ_ROUTES.HOME);
      }
    }
  };
}

// 🎯 ROUTE CATEGORIES (ML-enhanced)
function getRouteCategory(route) {
  const categories = {
    theory: [VMQ_ROUTES.INTERVALS, VMQ_ROUTES.KEYS, VMQ_ROUTES.SCALES],
    technique: [VMQ_ROUTES.BIELER, VMQ_ROUTES.FINGERBOARD, VMQ_ROUTES.NOTE_LOCATOR],
    rhythm: [VMQ_ROUTES.RHYTHM, VMQ_ROUTES.TEMPO, VMQ_ROUTES.RHYTHM_DRILLS],
    coach: [VMQ_ROUTES.DASHBOARD, VMQ_ROUTES.COACH, VMQ_ROUTES.ANALYTICS],
    cognitive: [VMQ_ROUTES.FLASHCARDS, VMQ_ROUTES.SPACED_REP],
    tools: [VMQ_ROUTES.SETTINGS, VMQ_ROUTES.DATA_MANAGER, VMQ_ROUTES.JOURNAL]
  };
  
  for (const [category, routes] of Object.entries(categories)) {
    if (routes.includes(route)) return category;
  }
  
  return 'core';
}

// 🎯 BACKWARD COMPATIBILITY
export function useHashRoute() {
  const router = useVMQRouter();
  return [router.route, router.navigate];
}

export function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.hash = VMQ_ROUTES.HOME;
  }
}

export function getCurrentRoute() {
  return decodeURIComponent(window.location.hash.slice(1)) || VMQ_ROUTES.HOME;
}

// 🎯 ML-ENHANCED DEEP LINKS
export const DEEP_LINKS = {
  shareProgress: (userLevel = 'intermediate') => {
    const focus = userLevel === 'beginner' ? 'intervals' : 
                  userLevel === 'advanced' ? 'bieler' : 'keys';
    return `${VMQ_ROUTES.DASHBOARD}?tab=week&focus=${focus}`;
  },
  
  priorityPractice: (module, userContext = {}) => {
    const params = new URLSearchParams({
      mode: 'priority',
      ...userContext
    });
    return `${module}?${params.toString()}`;
  },
  
  sm2Due: (count = 0) => {
    return `${VMQ_ROUTES.FLASHCARDS}?filter=due&count=${count}`;
  },
  
  // ML: Create personalized challenge link
  challengeFriend: (module, difficulty = 'medium', userLevel = 'intermediate') => {
    return `${module}?mode=challenge&difficulty=${difficulty}&level=${userLevel}`;
  }
};

// 🎯 UTILITY FUNCTIONS

// ML: Calculate string similarity for route suggestions
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
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
  
  return matrix[str2.length][str1.length];
}

// Backward-compat alias
export const DEEPLINKS = DEEP_LINKS;
