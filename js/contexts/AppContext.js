// /js/contexts/AppContext.js
// ======================================
// VMQ APP CONTEXT v2.2.0 - 6-Engine Live State (Safe + Compatible)
// Fixes:
// - updateStreak name collision / recursion
// - sessionTracker event wiring (no .on dependency)
// - resilient refresh + sync loops
// - consistent exports/hooks across modules
//
// Drop-in expectations:
// - React is global (no JSX), using createElement alias `h`
// - storage.js provides { loadJSON, saveJSON?, STORAGE_KEYS }
// - engines remain canonical sources of truth
// ======================================

const {
  createElement: h,
  useEffect,
  useReducer,
  useContext,
  createContext,
  useCallback,
  useMemo,
  useRef,
} = React;

import { loadJSON, STORAGE_KEYS } from '../config/storage.js';
import { analyzePerformance } from '../engines/analytics.js';

import {
  loadXP,
  addXP,
  loadStreak,
  updateStreak as engineUpdateStreak,
  getLevel,
} from '../engines/gamification.js';

import { getCoachInsights } from '../engines/coachEngine.js';
import { getStats as sm2Stats } from '../engines/spacedRepetition.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { getDifficulty } from '../engines/difficultyAdapter.js';

// --------------------------------------
// CONSTANTS
// --------------------------------------
const LIVE_SYNC_MS = 10_000;
const NOTIF_MAX = 5;

const DEFAULT_PROFILE = { name: 'Student', level: 1, instrument: 'violin' };

// --------------------------------------
// INITIAL STATE (keep shape stable)
// --------------------------------------
const INITIAL_STATE = {
  profile: { ...DEFAULT_PROFILE },

  // Many components assume xp + streak number + level number
  gamification: { xp: 0, streak: 0, level: 1 },

  analytics: {
    overallAccuracy: 0,
    consistency: 0,
    modules: [],
    trends: {},
  },

  sm2: { dueToday: 0, mature: 0, retention: 0 },

  coach: { recommendations: [], priorities: [] },

  session: {
    currentModule: null,
    activeTimeMs: 0,
    todaySessions: 0,
    lastSessionEndedAt: null,
  },

  currentDrill: null,

  ui: { isLoading: true, theme: 'light', notifications: [] },

  lastSync: Date.now(),
};

// --------------------------------------
// HELPERS
// --------------------------------------
function _safeNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function _safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function _mergeSafeState(base, patch) {
  // merge top-level + nested known objects to preserve expected shapes
  const merged = { ...base, ...(patch || {}) };

  merged.profile = { ...base.profile, ...(patch?.profile || {}) };
  merged.gamification = { ...base.gamification, ...(patch?.gamification || {}) };
  merged.analytics = { ...base.analytics, ...(patch?.analytics || {}) };
  merged.sm2 = { ...base.sm2, ...(patch?.sm2 || {}) };
  merged.coach = { ...base.coach, ...(patch?.coach || {}) };
  merged.session = { ...base.session, ...(patch?.session || {}) };
  merged.ui = { ...base.ui, ...(patch?.ui || {}) };

  // notifications always array
  merged.ui.notifications = _safeArray(merged.ui.notifications).slice(-NOTIF_MAX);

  return merged;
}

function _now() {
  return Date.now();
}

// --------------------------------------
// REDUCER (pure; side-effects in actions/effects)
// --------------------------------------
function appReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE': {
      const merged = _mergeSafeState(state, action.payload);
      return { ...merged, ui: { ...merged.ui, isLoading: false } };
    }

    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...(action.payload || {}) } };

    case 'SET_GAMIFICATION':
      return {
        ...state,
        gamification: { ...state.gamification, ...(action.payload || {}) },
      };

    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload || state.analytics };

    case 'SET_SM2':
      return { ...state, sm2: action.payload || state.sm2 };

    case 'SET_COACH':
      return { ...state, coach: { ...state.coach, ...(action.payload || {}) } };

    case 'SET_CURRENT_DRILL':
      return {
        ...state,
        currentDrill: action.payload,
        session: {
          ...state.session,
          currentModule:
            action.payload?.module ||
            action.payload?.activity ||
            state.session.currentModule,
        },
      };

    case 'SESSION_START':
      return {
        ...state,
        session: {
          ...state.session,
          currentModule: action.payload?.activity || state.session.currentModule,
          todaySessions: _safeNumber(state.session.todaySessions, 0) + 1,
        },
      };

    case 'SESSION_END': {
      const entry = action.payload?.entry || null;
      const elapsedMs = _safeNumber(entry?.elapsedMs, 0);
      return {
        ...state,
        session: {
          ...state.session,
          activeTimeMs: _safeNumber(state.session.activeTimeMs, 0) + elapsedMs,
          lastSessionEndedAt: _now(),
        },
      };
    }

    case 'ADD_NOTIFICATION': {
      const next = [..._safeArray(state.ui.notifications), action.payload].slice(
        -NOTIF_MAX
      );
      return { ...state, ui: { ...state.ui, notifications: next } };
    }

    case 'SET_THEME':
      return { ...state, ui: { ...state.ui, theme: String(action.payload || 'light') } };

    case 'LIVE_SYNC':
      return { ...state, lastSync: _now() };

    default:
      return state;
  }
}

// --------------------------------------
// CONTEXT
// --------------------------------------
export const AppContext = createContext(null);

// --------------------------------------
// PROVIDER
// --------------------------------------
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  // prevent overlapping sync loops / refresh storms
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  // ---------- notifications ----------
  const addNotification = useCallback((message, type = 'info') => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: _now() + Math.random(),
        message: String(message ?? ''),
        type: String(type ?? 'info'),
        timestamp: _now(),
      },
    });
  }, []);

  // ---------- coach refresh ----------
  const refreshCoach = useCallback(async (profile) => {
    try {
      const insights = await Promise.resolve(getCoachInsights(profile));
      const recommendations = _safeArray(insights?.recommendations);
      const priorities = _safeArray(insights?.priorities);
      if (mountedRef.current) {
        dispatch({ type: 'SET_COACH', payload: { recommendations, priorities } });
      }
      return { recommendations, priorities };
    } catch (e) {
      // coach should never crash the app
      return { recommendations: [], priorities: [] };
    }
  }, []);

  // ---------- compute canonical gamification ----------
  const readGamificationSnapshot = useCallback(() => {
    const xp = _safeNumber(loadXP?.(), 0);
    const streakData = loadStreak?.() || {};
    const levelMeta = getLevel?.(xp) || {};
    return {
      xp,
      streak: _safeNumber(streakData?.current, 0),
      level: _safeNumber(levelMeta?.level, 1),
    };
  }, []);

  // ---------- refresh all (bootstrap + manual) ----------
  const refreshAll = useCallback(async () => {
    const profile =
      loadJSON?.(STORAGE_KEYS?.PROFILE, DEFAULT_PROFILE) || DEFAULT_PROFILE;

    const gamification = readGamificationSnapshot();

    // These may be sync or async depending on engine implementation.
    // Keep safe defaults if any engine fails.
    const [analytics, sm2] = await Promise.all([
      Promise.resolve(analyzePerformance?.('week')).catch(() => state.analytics),
      Promise.resolve(sm2Stats?.()).catch(() => state.sm2),
    ]);

    await refreshCoach(profile);

    if (mountedRef.current) {
      dispatch({
        type: 'INITIALIZE',
        payload: { profile, gamification, analytics, sm2 },
      });
    }
  }, [readGamificationSnapshot, refreshCoach, state.analytics, state.sm2]);

  // ---------- bootstrap + tracker wiring + live sync ----------
  useEffect(() => {
    mountedRef.current = true;

    // Ensure tracker is running (guarded against double init internally)
    try {
      sessionTracker?.init?.();
    } catch (e) {
      // ignore
    }

    refreshAll().catch((err) => {
      console.warn('[AppContext] Bootstrap failed:', err);
      if (mountedRef.current) dispatch({ type: 'INITIALIZE', payload: {} });
    });

    // Tracker events via browser events (no .on dependency)
    const onStart = (e) => dispatch({ type: 'SESSION_START', payload: e?.detail || {} });
    const onEnd = (e) => dispatch({ type: 'SESSION_END', payload: e?.detail || {} });

    window.addEventListener('vmq-session-start', onStart);
    window.addEventListener('vmq-session-end', onEnd);

    const tick = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      try {
        const [analytics, sm2] = await Promise.all([
          Promise.resolve(analyzePerformance?.('week')).catch(() => null),
          Promise.resolve(sm2Stats?.()).catch(() => null),
        ]);

        if (!mountedRef.current) return;

        if (analytics) dispatch({ type: 'SET_ANALYTICS', payload: analytics });
        if (sm2) dispatch({ type: 'SET_SM2', payload: sm2 });

        const profile =
          loadJSON?.(STORAGE_KEYS?.PROFILE, DEFAULT_PROFILE) || DEFAULT_PROFILE;
        await refreshCoach(profile);

        dispatch({ type: 'LIVE_SYNC' });
      } catch {
        // never crash the UI on sync
      } finally {
        syncingRef.current = false;
      }
    };

    const t = setInterval(tick, LIVE_SYNC_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(t);
      window.removeEventListener('vmq-session-start', onStart);
      window.removeEventListener('vmq-session-end', onEnd);
    };
  }, [refreshAll, refreshCoach]);

  // ---------- actions ----------
  const updateXP = useCallback(
    (amount, source = 'practice', metadata = {}) => {
      try {
        // Keep engine canonical
        addXP?.(amount, source, { source, metadata });

        const snap = readGamificationSnapshot();
        dispatch({ type: 'SET_GAMIFICATION', payload: snap });
      } catch (e) {
        addNotification('XP update failed (non-fatal).', 'error');
      }
    },
    [addNotification, readGamificationSnapshot]
  );

  // IMPORTANT: local function name is NOT updateStreak (prevents shadowing recursion)
  const dispatchStreakUpdate = useCallback(() => {
    try {
      const streakData = engineUpdateStreak?.() || {};
      const current = _safeNumber(streakData?.current, 0);

      dispatch({ type: 'SET_GAMIFICATION', payload: { streak: current } });
      return streakData;
    } catch (e) {
      addNotification('Streak update failed (non-fatal).', 'error');
      return null;
    }
  }, [addNotification]);

  const setCurrentDrill = useCallback((drill) => {
    const d = drill || null;

    // SessionTracker expects an activity string; keep it compatible
    const activity = d?.module || d?.activity || null;
    if (activity) {
      try {
        sessionTracker?.startSession?.(activity);
      } catch {
        // ignore
      }
    }

    dispatch({ type: 'SET_CURRENT_DRILL', payload: d });
  }, []);

  const setTheme = useCallback((theme) => {
    const t = String(theme || 'light');
    dispatch({ type: 'SET_THEME', payload: t });

    // Optional: if the app uses data-theme at root, keep it in sync safely
    try {
      document.documentElement?.setAttribute?.('data-theme', t);
    } catch {
      // ignore
    }
  }, []);

  // a compact, stable action bundle (for advanced modules)
  const actions = useMemo(
    () => ({
      getDifficulty,
      analyzePerformance,
      getCoachInsights,
      sm2Stats,
      refreshAll, // expose manual refresh if any module wants it
      setTheme,
    }),
    [refreshAll, setTheme]
  );

  // public context value
  const value = useMemo(
    () => ({
      state,
      updateXP,
      // expose under expected public name, but points to safe function
      updateStreak: dispatchStreakUpdate,
      setCurrentDrill,
      addNotification,
      sessionTracker,
      actions,
      setTheme,
    }),
    [state, updateXP, dispatchStreakUpdate, setCurrentDrill, addNotification, actions, setTheme]
  );

  // Keep existing behavior: show a minimal loading UI while bootstrapping
  return h(
    AppContext.Provider,
    { value },
    state.ui.isLoading
      ? h(
          'div',
          { className: 'loading-screen active', role: 'status', 'aria-live': 'polite' },
          h('div', { className: 'loading-content', style: { textAlign: 'center' } },
            h('div', { className: 'loading-spinner' }),
            h('div', { style: { marginTop: '12px' } }, 'Loading VMQ…')
          )
        )
      : children
  );
}

// --------------------------------------
// HOOKS (safe + consistent)
// --------------------------------------
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useAppState() {
  return useApp().state;
}

export function useGamification() {
  const ctx = useApp();
  return {
    xp: ctx.state.gamification.xp,
    streak: ctx.state.gamification.streak,
    level: ctx.state.gamification.level,
    updateXP: ctx.updateXP,
    updateStreak: ctx.updateStreak,
  };
}

export function useAnalytics() {
  const ctx = useApp();
  return {
    analytics: ctx.state.analytics,
    modules: ctx.state.analytics.modules || [],
    // non-mutating refresh helper (callers can also use ctx.actions.refreshAll)
    refresh: () => Promise.resolve(ctx.actions.analyzePerformance?.('week')),
  };
}

export function useCoach() {
  const ctx = useApp();
  return {
    recommendations: ctx.state.coach.recommendations || [],
    priorities: ctx.state.coach.priorities || [],
    refresh: async () => {
      const profile =
        loadJSON?.(STORAGE_KEYS?.PROFILE, DEFAULT_PROFILE) || DEFAULT_PROFILE;
      return Promise.resolve(getCoachInsights(profile));
    },
  };
}

export function useSession() {
  return useApp().state.session;
}

export function useNotifications() {
  const ctx = useApp();
  return {
    notifications: ctx.state.ui.notifications,
    add: ctx.addNotification,
  };
}

export function useTheme() {
  const ctx = useApp();
  return {
    theme: ctx.state.ui.theme,
    setTheme: ctx.setTheme,
  };
}