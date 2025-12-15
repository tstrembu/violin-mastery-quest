// /js/contexts/AppContext.js
// ======================================
// VMQ APP CONTEXT v2.0 - 6-Engine Live State
// Analytics + SM-2 + Coach + 50+ modules
// ======================================

const { createElement: h, useState, useEffect, useReducer, useContext, createContext } = React;

// 🎯 6-ENGINE LIVE IMPORTS
import { 
  loadJSON, saveJSON, STORAGE_KEYS 
} from '../config/storage.js';
import { 
  analyzePerformance, updateStats 
} from '../engines/analytics.js';
import { 
  loadXP, addXP, loadStreak, updateStreak 
} from '../engines/gamification.js';
import { 
  getRecommendations 
} from '../engines/coachEngine.js';
import { 
  getStats as sm2Stats 
} from '../engines/spacedRepetition.js';
import { 
  sessionTracker 
} from '../engines/sessionTracker.js';
import { 
  getDifficulty 
} from '../engines/difficultyAdapter.js';
import { formatDate } from '../utils/helpers.js';

// 🎯 VMQ PRODUCTION STATE (6 engines live)
const INITIAL_STATE = {
  // 🎯 USER PROFILE
  profile: { name: 'Student', level: 1, instrument: 'violin' },
  
  // 🎮 GAMIFICATION (XP + Streak)
  gamification: { xp: 0, streak: 0, level: 1 },
  
  // 📊 ANALYTICS (Live module stats)
  analytics: { 
    overallAccuracy: 0, 
    consistency: 0, 
    modules: [],
    trends: {}
  },
  
  // 🧠 SM-2 (Spaced repetition)
  sm2: { dueToday: 0, mature: 0, retention: 0 },
  
  // 🎯 COACH (AI recommendations)
  coach: { recommendations: [], priorities: [] },
  
  // 📓 SESSION (Live tracking)
  session: { 
    currentModule: null, 
    activeTime: 0, 
    todaySessions: 0 
  },
  
  // 🎵 DRILL STATE
  currentDrill: null,
  
  // 🔄 UI STATE
  ui: { isLoading: true, theme: 'light', notifications: [] },
  
  // 💾 LAST SYNC
  lastSync: Date.now()
};

// 🎯 VMQ REDUCER (Production optimized)
function appReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE':
      return { ...INITIAL_STATE, ...action.payload, ui: { ...state.ui, isLoading: false } };
    
    case 'UPDATE_GAMIFICATION':
      saveJSON(STORAGE_KEYS.GAMIFICATION, action.payload);
      return { ...state, gamification: action.payload };
    
    case 'UPDATE_ANALYTICS':
      saveJSON(STORAGE_KEYS.ANALYTICS, action.payload);
      return { ...state, analytics: action.payload };
    
    case 'UPDATE_SM2':
      saveJSON(STORAGE_KEYS.SM2_STATS, action.payload);
      return { ...state, sm2: action.payload };
    
    case 'SET_COACH_RECOMMENDATIONS':
      return { ...state, coach: { ...state.coach, recommendations: action.payload } };
    
    case 'SET_CURRENT_DRILL':
      sessionTracker.startSession(action.payload);
      return { ...state, currentDrill: action.payload, session: { 
        ...state.session, currentModule: action.payload?.module 
      }};
    
    case 'UPDATE_SESSION':
      return { ...state, session: { ...state.session, ...action.payload } };
    
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        ui: { 
          ...state.ui, 
          notifications: [...state.ui.notifications, action.payload].slice(-5) 
        } 
      };
    
    case 'LIVE_SYNC':
      return { ...state, lastSync: Date.now(), ui: { ...state.ui, isLoading: false } };
    
    default:
      return state;
  }
}

// 🎯 VMQ CONTEXT
export const AppContext = createContext();

// 🎯 APP PROVIDER (6-Engine Live)
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  // 🚀 BOOTSTRAP (6 engines parallel)
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [profile, gamification, analytics, sm2, recommendations] = await Promise.all([
          loadJSON(STORAGE_KEYS.PROFILE),
          loadJSON(STORAGE_KEYS.GAMIFICATION, { xp: 0, streak: 0 }),
          analyzePerformance('week'),
          sm2Stats(),
          getRecommendations()
        ]);
        
        dispatch({
          type: 'INITIALIZE',
          payload: {
            profile: profile || INITIAL_STATE.profile,
            gamification,
            analytics,
            sm2,
            coach: { recommendations }
          }
        });
        
        sessionTracker.on('activity', (data) => {
          dispatch({ type: 'UPDATE_SESSION', payload: data });
          dispatch({ type: 'UPDATE_ANALYTICS', payload: updateStats(data.module, data.correct, data.responseTime) });
        });
        
      } catch (error) {
        console.warn('[AppContext] Bootstrap failed:', error);
        dispatch({ type: 'INITIALIZE', payload: {} });
      }
    };
    
    bootstrap();
    
    // 🎯 LIVE SYNC (10s)
    const liveSync = setInterval(async () => {
      const [analytics, sm2, recommendations] = await Promise.all([
        analyzePerformance('week'),
        sm2Stats(),
        getRecommendations()
      ]);
      
      dispatch({ 
        type: 'LIVE_SYNC',
        payload: { analytics, sm2, coach: { recommendations } }
      });
    }, 10000);
    
    return () => clearInterval(liveSync);
  }, []);

  // 🎯 LIVE DISPATCHERS (Production)
  const updateXP = (amount, source = 'practice') => {
    const newXP = state.gamification.xp + amount;
    dispatch({
      type: 'UPDATE_GAMIFICATION',
      payload: { 
        ...state.gamification, 
        xp: newXP,
        level: Math.floor(newXP / 1000) + 1 
      }
    });
    addXP(amount, source);
  };

  const updateStreak = () => {
    const newStreak = state.gamification.streak + 1;
    dispatch({
      type: 'UPDATE_GAMIFICATION',
      payload: { ...state.gamification, streak: newStreak }
    });
    updateStreak(newStreak);
  };

  const setCurrentDrill = (drill) => {
    dispatch({ type: 'SET_CURRENT_DRILL', payload: drill });
  };

  const addNotification = (message, type = 'info') => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: { id: Date.now(), message, type, timestamp: Date.now() }
    });
  };

  const value = {
    state,
    updateXP,
    updateStreak,
    setCurrentDrill,
    addNotification,
    sessionTracker,
    actions: {
      getDifficulty,
      analyzePerformance,
      getRecommendations
    }
  };

  return h(AppContext.Provider, { value }, 
    state.ui.isLoading 
      ? h('div', { className: 'loading-screen' }, 
          h('div', { className: 'spinner' }), 
          'Loading VMQ...')
      : children
  );
}

// 🎯 CUSTOM HOOKS (Production)
export const useAppState = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppState must be used within AppProvider');
  return context.state;
};

export const useGamification = () => {
  const context = useContext(AppContext);
  return {
    xp: context.state.gamification.xp,
    streak: context.state.gamification.streak,
    updateXP: context.updateXP,
    updateStreak: context.updateStreak
  };
};

export const useAnalytics = () => {
  const context = useContext(AppContext);
  return {
    analytics: context.state.analytics,
    modules: context.state.analytics.modules || [],
    refresh: () => context.actions.analyzePerformance('week')
  };
};

export const useCoach = () => {
  const context = useContext(AppContext);
  return {
    recommendations: context.state.coach.recommendations,
    refresh: () => context.actions.getRecommendations()
  };
};

export const useSession = () => {
  const context = useContext(AppContext);
  return context.state.session;
};

export const useNotifications = () => {
  const context = useContext(AppContext);
  return {
    notifications: context.state.ui.notifications,
    add: context.addNotification
  };
};

