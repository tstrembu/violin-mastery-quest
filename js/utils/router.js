// ======================================
// VMQ ROUTER v2.1 - 50+ Module Navigation
// Coach → Goals → Analytics → Deep Links
// ======================================

const { useState, useEffect, useCallback, useMemo, useContext } = React;
import { AppContext } from '../contexts/AppContext.js';
import sessionTracker from '../engines/sessionTracker.js';

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
  
  // 🥁 RHYTHM + TECHNIQUE
  RHYTHM: 'rhythm',
  RHYTHM_DRILLS: 'rhythm-drills',
  TEMPO: 'tempotrainer',
  SPEED_DRILL: 'speeddrill',
  
  // 🧠 COGNITIVE
  FLASHCARDS: 'flashcards',
  SPACED_REP: 'spaced-rep',
  
  // 📊 TOOLS
  DATA_MANAGER: 'datamanager',
  SETTINGS: 'settings',
  JOURNAL: 'practicejournal',
  
  // 🎯 COACH DEEP LINKS
  RECOMMENDED: 'recommended',
  PRIORITY: 'priority'
};

// Backward-compat alias (older code may import VMQROUTES)
export const VMQROUTES = VMQ_ROUTES;

// 🎯 PRODUCTION ROUTER HOOK
export function useVMQRouter() {
  const appContext = useContext(AppContext);

  const [currentRoute, setCurrentRoute] = useState(
    decodeURIComponent(window.location.hash.slice(1)) || VMQ_ROUTES.HOME
  );
  const [queryParams, setQueryParams] = useState(
    new URLSearchParams(window.location.search)
  );

  // 🎯 PARSE ROUTE + PARAMS (Production)
  const parseRoute = useCallback((hash) => {
    const cleanHash = decodeURIComponent(hash || '')
      .slice(1)
      .toLowerCase()
      .trim();
    
    const [routePart, paramStr = ''] = cleanHash.split('?');
    const params = new URLSearchParams(paramStr);
    const routeKey = routePart?.toUpperCase?.() || '';
    
    return {
      route: VMQ_ROUTES[routeKey] || routePart || VMQ_ROUTES.HOME,
      params: Object.fromEntries(params.entries()),
      raw: cleanHash
    };
  }, []);

  // 🎯 LIVE HASH LISTENER (Debounced)
  useEffect(() => {
    let timeoutId;
    const handleHashChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const parsed = parseRoute(window.location.hash || '');
        setCurrentRoute(parsed.route);
        setQueryParams(new URLSearchParams(parsed.params));
        
        // 🎯 SESSION TRACKING
        try {
          sessionTracker?.trackNavigation?.(parsed.route, parsed.params);
        } catch (e) {
          console.warn('[Router] sessionTracker.trackNavigation failed', e);
        }
      }, 50); // 50ms debounce
    };

    window.addEventListener('hashchange', handleHashChange, false);
    handleHashChange(); // Initial parse
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearTimeout(timeoutId);
    };
  }, [parseRoute]);

  // 🎯 PRODUCTION NAVIGATION (50+ modules)
  const navigate = useCallback(
    (route, params = {}, replace = false) => {
      const targetRoute =
        typeof route === 'string'
          ? VMQ_ROUTES[route.toUpperCase()] || route
          : route;
      
      const paramStr = new URLSearchParams(params).toString();
      const hash = paramStr ? `${targetRoute}?${paramStr}` : targetRoute;
      const encoded = `#${encodeURIComponent(hash)}`;
      
      if (replace) {
        window.location.replace(encoded);
      } else {
        window.location.hash = encoded;
      }
      
      // 🎯 COACH CONTEXT – refresh when entering Coach
      if (targetRoute === VMQ_ROUTES.COACH) {
        try {
          appContext?.actions?.getRecommendations?.();
        } catch (e) {
          console.warn('[Router] Coach refresh failed', e);
        }
      }
    },
    [appContext]
  );

  // 🎯 SMART NAVIGATION (Coach → Goals → Priority)
  const navigateSmart = useCallback(
    (type, module = null) => {
      switch (type) {
        case 'coach-recommended':
          navigate(VMQ_ROUTES.COACH, { tab: 'recommended' });
          break;
        case 'priority-module':
          navigate(module || VMQ_ROUTES.INTERVAL_EAR);
          break;
        case 'sm2-due':
          navigate(VMQ_ROUTES.FLASHCARDS, { filter: 'due' });
          break;
        case 'daily-goal':
          navigate(VMQ_ROUTES.GOALS);
          break;
        default:
          navigate(VMQ_ROUTES.DASHBOARD);
      }
    },
    [navigate]
  );

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
    },
    [queryParams]
  );

  const getQueryParam = useCallback(
    (key, defaultValue = null) => {
      return queryParams.get(key) ?? defaultValue;
    },
    [queryParams]
  );

  // 🎯 ROUTE VALIDATION
  const isValidRoute = useCallback((route) => {
    if (!route) return false;
    const key = route.toUpperCase?.() || '';
    return VMQ_ROUTES[key] === route || Object.values(VMQ_ROUTES).includes(route);
  }, []);

  // 🎯 ACTIVE ROUTE INFO (Production)
  const routeInfo = useMemo(
    () => ({
      current: currentRoute,
      isValid: isValidRoute(currentRoute),
      params: Object.fromEntries(queryParams.entries()),
      path: `${currentRoute}${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`,
      category: getRouteCategory(currentRoute)
    }),
    [currentRoute, queryParams, isValidRoute]
  );

  return {
    route: currentRoute,
    routeInfo,
    navigate,
    navigateSmart,
    queryParams,
    getQueryParam,
    updateQueryParam,
    isValidRoute
  };
}

// 🎯 ROUTE CATEGORIES (50+ modules)
function getRouteCategory(route) {
  if ([VMQ_ROUTES.INTERVALS, VMQ_ROUTES.KEYS].includes(route)) return 'theory';
  if ([VMQ_ROUTES.BIELER, VMQ_ROUTES.FINGERBOARD].includes(route)) return 'technique';
  if ([VMQ_ROUTES.RHYTHM, VMQ_ROUTES.TEMPO].includes(route)) return 'rhythm';
  if ([VMQ_ROUTES.DASHBOARD, VMQ_ROUTES.COACH].includes(route)) return 'coach';
  if ([VMQ_ROUTES.FLASHCARDS].includes(route)) return 'cognitive';
  return 'core';
}

// 🎯 UTILITY FUNCTIONS
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

// 🎯 BACKWARD COMPATIBILITY
export function useHashRoute() {
  const router = useVMQRouter();
  return [router.route, router.navigate];
}

// 🎯 DEEP LINKS (Shareable)
export const DEEP_LINKS = {
  shareProgress: () => `${VMQ_ROUTES.DASHBOARD}?tab=week`,
  priorityPractice: (module) =>
    `${VMQ_ROUTES[module.toUpperCase()] || module}?mode=priority`,
  sm2Due: () => `${VMQ_ROUTES.FLASHCARDS}?filter=due`
};

// Backward-compat alias (older code uses DEEPLINKS)
export const DEEPLINKS = DEEP_LINKS;
