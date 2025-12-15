// /js/contexts/AppContext.js
// ======================================
// VMQ APP CONTEXT v2.1 - 6-Engine Live State (Safe + Compatible)
// Fixes: updateStreak name collision / recursion
// Uses: sessionTracker browser events (no .on dependency)
// ======================================

const {
  createElement: h,
  useEffect,
  useReducer,
  useContext,
  createContext,
  useCallback,
  useMemo
} = React;

import { loadJSON, STORAGE_KEYS } from '../config/storage.js';

import { analyzePerformance } from '../engines/analytics.js';

import {
  loadXP,
  addXP,
  loadStreak,
  updateStreak as engineUpdateStreak,
  getLevel
} from '../engines/gamification.js';

import { getCoachInsights } from '../engines/coachEngine.js';
import { getStats as sm2Stats } from '../engines/spacedRepetition.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { getDifficulty } from '../engines/difficultyAdapter.js';

// --------------------------------------
// INITIAL STATE
// --------------------------------------
const INITIAL_STATE = {
  profile: { name: 'Student', level: 1, instrument: 'violin' },

  // Keep this shape: many components assume xp + streak number + level number
  gamification: { xp: 0, streak: 0, level: 1 },

  analytics: {
    overallAccuracy: 0,
    consistency: 0,
    modules: [],
    trends: {}
  },

  sm2: { dueToday: 0, mature: 0, retention: 0 },

  coach: { recommendations: [], priorities: [] },

  session: {
    currentModule: null,
    activeTimeMs: 0,
    todaySessions: 0,
    lastSessionEndedAt: null
  },

  currentDrill: null,

  ui: { isLoading: true, theme: 'light', notifications: [] },

  lastSync: Date.now()
};

// --------------------------------------
// REDUCER (pure; side-effects live in actions)
// --------------------------------------
function appReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE': {
      const merged = { ...state, ...action.payload };
      return { ...merged, ui: { ...merged.ui, isLoading: false } };
    }

    case 'SET_GAMIFICATION':
      return { ...state, gamification: { ...state.gamification, ...action.payload } };

    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload };

    case 'SET_SM2':
      return { ...state, sm2: action.payload };

    case 'SET_COACH':
      return { ...state, coach: { ...state.coach, ...action.payload } };

    case 'SET_CURRENT_DRILL':
      return {
        ...state,
        currentDrill: action.payload,
        session: {
          ...state.session,
          currentModule: action.payload?.module || action.payload?.activity || state.session.currentModule
        }
      };

    case 'SESSION_START':
      return {
        ...state,
        session: {
          ...state.session,
          currentModule: action.payload?.activity || state.session.currentModule,
          todaySessions: state.session.todaySessions + 1
        }
      };

    case 'SESSION_END': {
      const entry = action.payload?.entry || null;
      const elapsedMs = typeof entry?.elapsedMs === 'number' ? entry.elapsedMs : 0;
      return {
        ...state,
        session: {
          ...state.session,
          activeTimeMs: state.session.activeTimeMs + elapsedMs,
          lastSessionEndedAt: Date.now()
        }
      };
    }

    case 'ADD_NOTIFICATION': {
      const next = [...state.ui.notifications, action.payload].slice(-5);
      return { ...state, ui: { ...state.ui, notifications: next } };
    }

    case 'LIVE_SYNC':
      return { ...state, lastSync: Date.now() };

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

  // ---------- helpers ----------
  const addNotification = useCallback((message, type = 'info') => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: { id: Date.now(), message, type, timestamp: Date.now() }
    });
  }, []);

  const refreshCoach = useCallback(async (profile) => {
    try {
      const insights = await Promise.resolve(getCoachInsights(profile));
      const recommendations = Array.isArray(insights?.recommendations)
        ? insights.recommendations
        : [];
      const priorities = Array.isArray(insights?.priorities) ? insights.priorities : [];
      dispatch({ type: 'SET_COACH', payload: { recommendations, priorities } });
      return { recommendations, priorities };
    } catch (e) {
      // coach should never crash the app
      return { recommendations: [], priorities: [] };
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const profile = loadJSON(STORAGE_KEYS.PROFILE, INITIAL_STATE.profile) || INITIAL_STATE.profile;

    // Gamification engine is canonical for xp/streak
    const xp = loadXP();
    const streakData = loadStreak();
    const levelMeta = getLevel(xp);

    // These may be async or sync depending on engine implementation; treat uniformly
    const [analytics, sm2] = await Promise.all([
      Promise.resolve(analyzePerformance('week')).catch(() => state.analytics),
      Promise.resolve(sm2Stats()).catch(() => state.sm2)
    ]);

    await refreshCoach(profile);

    dispatch({
      type: 'INITIALIZE',
      payload: {
        profile,
        gamification: {
          xp,
          streak: typeof streakData?.current === 'number' ? streakData.current : 0,
          level: typeof levelMeta?.level === 'number' ? levelMeta.level : 1
        },
        analytics,
        sm2
      }
    });
  }, [refreshCoach, state.analytics, state.sm2]);

  // ---------- bootstrap ----------
  useEffect(() => {
    // ensure tracker is running (it is already guarded against double init)
    try {
      sessionTracker.init?.();
    } catch (e) {
      // ignore
    }

    refreshAll().catch((err) => {
      console.warn('[AppContext] Bootstrap failed:', err);
      dispatch({ type: 'INITIALIZE', payload: {} });
    });

    // Wire into tracker events (no dependency on a non-existent .on API)
    const onStart = (e) => dispatch({ type: 'SESSION_START', payload: e?.detail || {} });
    const onEnd = (e) => dispatch({ type: 'SESSION_END', payload: e?.detail || {} });

    window.addEventListener('vmq-session-start', onStart);
    window.addEventListener('vmq-session-end', onEnd);

    // Live sync (10s)
    const t = setInterval(async () => {
      try {
        const [analytics, sm2] = await Promise.all([
          Promise.resolve(analyzePerformance('week')).catch(() => null),
          Promise.resolve(sm2Stats()).catch(() => null)
        ]);

        if (analytics) dispatch({ type: 'SET_ANALYTICS', payload: analytics });
        if (sm2) dispatch({ type: 'SET_SM2', payload: sm2 });

        // Coach refresh is lightweight; keep it safe
        const profile = loadJSON(STORAGE_KEYS.PROFILE, INITIAL_STATE.profile) || INITIAL_STATE.profile;
        await refreshCoach(profile);

        dispatch({ type: 'LIVE_SYNC' });
      } catch (e) {
        // never crash the UI on sync
      }
    }, 10000);

    return () => {
      clearInterval(t);
      window.removeEventListener('vmq-session-start', onStart);
      window.removeEventListener('vmq-session-end', onEnd);
    };
  }, [refreshAll, refreshCoach]);

  // ---------- actions ----------
  const updateXP = useCallback(
    (amount, source = 'practice', metadata = {}) => {
      try {
        addXP(amount, source, { source, metadata });
        const xp = loadXP();
        const levelMeta = getLevel(xp);

        dispatch({
          type: 'SET_GAMIFICATION',
          payload: {
            xp,
            level: typeof levelMeta?.level === 'number' ? levelMeta.level : state.gamification.level
          }
        });
      } catch (e) {
        addNotification('XP update failed (non-fatal).', 'error');
      }
    },
    [addNotification, state.gamification.level]
  );

  // IMPORTANT: local name is NOT updateStreak (prevents shadowing recursion)
  const dispatchStreakUpdate = useCallback(() => {
    try {
      const streakData = engineUpdateStreak(); // gamification helper (canonical)
      dispatch({
        type: 'SET_GAMIFICATION',
        payload: { streak: typeof streakData?.current === 'number' ? streakData.current : 0 }
      });
      return streakData;
    } catch (e) {
      addNotification('Streak update failed (non-fatal).', 'error');
      return null;
    }
  }, [addNotification]);

  const setCurrentDrill = useCallback((drill) => {
    // SessionTracker expects an activity string; keep it compatible
    const activity = drill?.module || drill?.activity || null;
    if (activity) {
      try {
        sessionTracker.startSession?.(activity);
      } catch (e) {
        // ignore
      }
    }
    dispatch({ type: 'SET_CURRENT_DRILL', payload: drill });
  }, []);

  const actions = useMemo(
    () => ({
      getDifficulty,
      analyzePerformance,
      getCoachInsights,
      sm2Stats
    }),
    []
  );

  const value = useMemo(
    () => ({
      state,
      updateXP,
      // expose the action under the expected public name, but it points to the safe function
      updateStreak: dispatchStreakUpdate,
      setCurrentDrill,
      addNotification,
      sessionTracker,
      actions
    }),
    [state, updateXP, dispatchStreakUpdate, setCurrentDrill, addNotification, actions]
  );

  return h(
    AppContext.Provider,
    { value },
    state.ui.isLoading
      ? h('div', { className: 'loading-screen' }, h('div', { className: 'spinner' }), 'Loading VMQ…')
      : children
  );
}

// --------------------------------------
// HOOKS
// --------------------------------------
export const useAppState = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx.state;
};

export const useGamification = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useGamification must be used within AppProvider');
  return {
    xp: ctx.state.gamification.xp,
    streak: ctx.state.gamification.streak,
    level: ctx.state.gamification.level,
    updateXP: ctx.updateXP,
    updateStreak: ctx.updateStreak
  };
};

export const useAnalytics = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAnalytics must be used within AppProvider');
  return {
    analytics: ctx.state.analytics,
    modules: ctx.state.analytics.modules || [],
    refresh: () => ctx.actions.analyzePerformance('week')
  };
};

export const useCoach = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useCoach must be used within AppProvider');
  return {
    recommendations: ctx.state.coach.recommendations || [],
    priorities: ctx.state.coach.priorities || [],
    refresh: async () => {
      const profile = loadJSON(STORAGE_KEYS.PROFILE, INITIAL_STATE.profile) || INITIAL_STATE.profile;
      return Promise.resolve(getCoachInsights(profile));
    }
  };
};

export const useSession = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useSession must be used within AppProvider');
  return ctx.state.session;
};

export const useNotifications = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useNotifications must be used within AppProvider');
  return {
    notifications: ctx.state.ui.notifications,
    add: ctx.addNotification
  };
};
