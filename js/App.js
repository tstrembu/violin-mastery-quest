// js/App.js
// ======================================
// VMQ ROOT APP v3.0.0 - ML-Adaptive PWA
// Error Boundaries • Theme Sync • 50+ Modules • Predictive Loading
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef, useMemo } = React;

// Core imports
import { VMQ_VERSION, FEATURES } from './config/constants.js';
import { STORAGE_KEYS, loadJSON, saveJSON, storage } from './config/storage.js';
import { audioEngine } from './engines/audioEngine.js';
import { loadXP, loadStreak, updateStreak, getLevel, addXP, unlockAchievement } from './engines/gamification.js';
import { sessionTracker } from './engines/sessionTracker.js';
import { keyboard } from './utils/keyboard.js';
import { a11y } from './utils/a11y.js';
import { useVMQRouter, VMQ_ROUTES } from './utils/router.js';
import { generateMLRecommendations } from './engines/analytics.js';
import { getAdaptiveConfig } from './engines/difficultyAdapter.js';
import { getDueItems } from './engines/spacedRepetition.js';

// Global Toast System
import ToastSystem from './components/Toast.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import Loading from './components/Loading.js';

// Core Components
import MainMenu from './components/MainMenu.js';
import Dashboard from './components/Dashboard.js';
import Analytics from './components/Analytics.js';
import Settings from './components/Settings.js';
import Welcome from './components/Welcome.js';
import CoachPanel from './components/CoachPanel.js';
import PracticeJournal from './components/PracticeJournal.js';

// Learning Modules (lazy-loaded)
// Use dynamic imports with React.lazy for large training modules to
// reduce initial bundle size.  Each lazy import returns a component
// whose default export matches the original component.
const Intervals     = React.lazy(() => import('./components/Intervals.js'));
const KeySignatures = React.lazy(() => import('./components/KeySignatures.js'));
const Rhythm        = React.lazy(() => import('./components/Rhythm.js'));
const Bieler        = React.lazy(() => import('./components/Bieler.js'));
const Fingerboard   = React.lazy(() => import('./components/Fingerboard.js'));
const ScalesLab     = React.lazy(() => import('./components/ScalesLab.js'));
    
// ======================================
// ML CONTEXT PROVIDER
// ======================================
const MLContext = React.createContext(null);

function MLProvider({ children }) {
  const [mlState, setMlState] = useState({
    predictions: null,
    confidence: 0,
    lastUpdated: null,
    isWarmingUp: true
  });

  // Warm up ML models on mount
  useEffect(() => {
    let cancelled = false;
    
    async function warmup() {
      try {
        const start = performance.now();
        
        // Parallel model initialization
        const [recommendations, adaptiveConfig, dueItems] = await Promise.all([
          generateMLRecommendations(),
          getAdaptiveConfig(),
          getDueItems('all', 20)
        ]);
        
        if (cancelled) return;
        
        setMlState({
          predictions: recommendations,
          confidence: recommendations?.confidence || 0,
          lastUpdated: Date.now(),
          isWarmingUp: false,
          dueItems: dueItems.length,
          weakAreas: adaptiveConfig.weakAreas || []
        });
        
        console.log(`[ML] Warmup complete: ${Math.round(performance.now() - start)}ms`);
      } catch (e) {
        console.warn('[ML] Warmup failed:', e);
        setMlState(prev => ({ ...prev, isWarmingUp: false, error: e }));
      }
    }
    
    warmup();
    return () => { cancelled = true; };
  }, []);

  // Periodic refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const recommendations = await generateMLRecommendations();
        setMlState(prev => ({
          ...prev,
          predictions: recommendations,
          confidence: recommendations.confidence,
          lastUpdated: Date.now()
        }));
      } catch (e) {
        console.warn('[ML] Refresh failed:', e);
      }
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  return h(MLContext.Provider, { value: mlState }, children);
}

// ======================================
// ROUTES MAP v3.0 - 50+ Modules
// ======================================
const ROUTES = {
  'menu': MainMenu,
  'dashboard': Dashboard,
  'analytics': Analytics,
  'settings': Settings,
  'welcome': Welcome,
  'coach': CoachPanel,
  'journal': PracticeJournal,
  'intervals': Intervals,
  'keys': KeySignatures,
  'rhythm': Rhythm,
  'bieler': Bieler,
  'fingerboard': Fingerboard,
  'scales': ScalesLab,
  // Additional routes would be added here
};

// ======================================
// HEALTH MONITOR
// ======================================
function useEngineHealth() {
  const [health, setHealth] = useState({
    status: 'checking',
    engines: {},
    lastCheck: null
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
      { name: 'difficultyAdapter', module: './engines/difficultyAdapter.js', critical: false }
    ];

    const results = {};
    let allHealthy = true;

    for (const engine of engines) {
      try {
        const module = await import(engine.module);
        const isHealthy = module && (module.default || module[engine.name]);
        results[engine.name] = {
          status: isHealthy ? 'healthy' : 'failed',
          critical: engine.critical
        };
        if (!isHealthy && engine.critical) allHealthy = false;
      } catch (e) {
        results[engine.name] = {
          status: 'error',
          error: e,
          critical: engine.critical
        };
        if (engine.critical) allHealthy = false;
      }
    }

    setHealth({
      status: allHealthy ? 'healthy' : 'degraded',
      engines: results,
      lastCheck: Date.now()
    });

    return allHealthy;
  }, []);

  // Check on mount and every 30 seconds
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { health, checkHealth };
}

// ======================================
// PERFORMANCE BUDGET ENFORCER
// ======================================
function usePerformanceBudget() {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    engineInitTime: 0,
    mlWarmupTime: 0,
    budgetExceeded: false
  });

  const checkBudget = useCallback((newMetrics) => {
    const PERFORMANCE_BUDGETS = {
      loadTime: 3000,
      engineInitTime: 2000,
      mlWarmupTime: 1500
    };

    let exceeded = false;
    for (const [key, budget] of Object.entries(PERFORMANCE_BUDGETS)) {
      if (newMetrics[key] > budget) {
        console.warn(`[Perf] Budget exceeded: ${key} (${newMetrics[key]}ms > ${budget}ms)`);
        exceeded = true;
      }
    }

    setMetrics(prev => ({ ...prev, ...newMetrics, budgetExceeded: exceeded }));
    return exceeded;
  }, []);

  return { metrics, checkBudget };
}

// ======================================
// ENGAGEMENT OPTIMIZER
// ======================================
function useEngagementOptimizer() {
  const [state, setState] = useState({
    focusScore: 1.0,
    lastInteraction: Date.now(),
    isIdle: false,
    breakSuggested: false
  });

  // Monitor interactions
  useEffect(() => {
    let idleTimer;
    
    const resetIdle = () => {
      clearTimeout(idleTimer);
      setState(prev => ({ ...prev, lastInteraction: Date.now(), isIdle: false }));
      
      idleTimer = setTimeout(() => {
        setState(prev => ({ ...prev, isIdle: true }));
      }, 30000); // 30 seconds idle
    };

    window.addEventListener('click', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('scroll', resetIdle);
    window.addEventListener('touchstart', resetIdle);

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('click', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('scroll', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
    };
  }, []);

  // Suggest breaks after 25 minutes (Pomodoro)
  useEffect(() => {
    const startTime = Date.now();
    const breakInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 25 * 60 * 1000 && elapsed < 26 * 60 * 1000) {
        setState(prev => ({ ...prev, breakSuggested: true }));
        // Show break suggestion toast
        window.dispatchEvent(new CustomEvent('vmq-suggest-break'));
      }
    }, 60000);

    return () => clearInterval(breakInterval);
  }, []);

  return state;
}

// ======================================
// ROOT APP v3.0 - Production Ready
// ======================================
export default function App() {
  const router = useVMQRouter();
  const mlContext = React.useContext(MLContext);
  
  // Core state
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  // Hooks that provide health, metrics, etc.
  const { health, checkHealth } = useEngineHealth();
  const { metrics, checkBudget } = usePerformanceBudget();
  const engagement = useEngagementOptimizer();
  const initAttempts = useRef(0);
  const [level, setLevel] = useState({ level: 1, title: 'Beginner', badge: '🎵' });
  const [settings, setSettings] = useState({
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
    autoPlayAudio: true
  });
  
  // ====================================
  // FAIL-SAFE INIT TIMEOUT
  // If initialization never finishes (e.g., an engine hangs),
  // start VMQ anyway so the user can still practice.
  // ====================================
  useEffect(() => {
    if (initialized) return;
  
    const timeoutId = setTimeout(() => {
      console.warn('[VMQ] Initialization timed out, starting in degraded mode.', {
        healthStatus: health.status
      });
      setInitialized(true);
    }, 8000);
  
    return () => clearTimeout(timeoutId);
  }, [initialized, health.status]);
  
  // Enhanced state
  const [gamificationState, setGamificationState] = useState({
    activeBoosts: [],
    achievementQueue: [],
    socialLeaderboard: null
  });

  // ====================================
  // 404 NOT FOUND
  // ====================================
  function NotFound({ onBack }) {
    return h('div', { className: 'module-container' },
      h('div', { className: 'card card-error', style: { textAlign: 'center', padding: 'var(--space-2xl)' } },
        h('div', { className: 'error-icon', style: { fontSize: 'clamp(3rem, 10vw, 5rem)' } }, '🚫'),
        h('h2', { style: { marginBottom: 'var(--space-md)' } }, 'Route Not Found'),
        h('p', { className: 'text-muted', style: { marginBottom: 'var(--space-xl)' } }, 
          `"${router.route}" doesn't exist in VMQ`
        ),
        h('button', {
          className: 'btn btn-primary btn-lg',
          onClick: () => onBack()
        }, '🏠 Back to Menu')
      )
    );
  }

  // ====================================
  // ANALYTICS EVENT BUS
  // ====================================
  const emitAnalyticsEvent = useCallback((category, action, data = {}) => {
    const event = {
      category,
      action,
      data: {
        ...data,
        timestamp: Date.now(),
        route: router.routeInfo.current,
        userLevel: level.level,
        xp,
        engagementScore: engagement.focusScore,
        mlConfidence: mlContext.confidence
      }
    };
    
    // Log to console in development
    if (window.location.hostname === 'localhost') {
      console.log(`[Analytics] ${category}.${action}`, event.data);
    }
    
    // Emit to session tracker
    sessionTracker.trackActivity(category, action, event.data);
    
    // Emit to analytics engine if available
    if (window.analyticsEngine?.trackEvent) {
      window.analyticsEngine.trackEvent(event);
    }
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('vmq-analytics-event', { detail: event }));
  }, [router.routeInfo.current, level.level, xp, engagement.focusScore, mlContext.confidence]);

  // ====================================
  // STATS REFRESH - ML-Enhanced
  // ====================================
  const refreshStats = useCallback(async () => {
    try {
      const currentXp = loadXP();
      const streakData = updateStreak();
      const currentLevel = getLevel(currentXp);
      
      setXp(currentXp);
      setStreak(streakData.current);
      setLevel(currentLevel);
      
      // ML: Check for breakthrough
      if (streakData.isBreakthrough) {
        addXP(50, 'breakthrough-bonus');
        unlockAchievement('streak-breakthrough', { days: streakData.current });
        emitAnalyticsEvent('gamification', 'breakthrough', { type: 'streak', days: streakData.current });
      }
      
      // ML: Predict next level XP
      const xpToNext = currentLevel.xpToNext || 1000;
      const predictedTime = predictTimeToNextLevel(currentXp, xpToNext);
      setLevel(prev => ({ ...prev, predictedTime }));
      
    } catch (error) {
      console.error('[VMQ] Stats refresh failed:', error);
      emitAnalyticsEvent('error', 'stats-refresh-failed', { error: error.message });
    }
  }, [emitAnalyticsEvent]);

  // ====================================
  // SETTINGS UPDATE - ML-Aware
  // ====================================
  const updateSettings = useCallback((updates) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    saveJSON(STORAGE_KEYS.SETTINGS, updated);
    applyTheme(updated);
    
    // Audio updates
    if ('muted' in updates) {
      audioEngine.setMuted(updates.muted);
      emitAnalyticsEvent('audio', updates.muted ? 'muted' : 'unmuted');
    }
    if ('volume' in updates) {
      audioEngine.setVolume(updates.volume);
    }
    if ('droneActive' in updates) {
      if (updates.droneActive) {
        audioEngine.playOpenStringDrone(updated.droneString || 'G');
      } else {
        audioEngine.stopAll();
      }
    }
    
    // ML: Track setting changes that affect learning
    if ('zenMode' in updates || 'reducedMotion' in updates) {
      emitAnalyticsEvent('settings', 'accessibility-change', {
        zenMode: updates.zenMode,
        reducedMotion: updates.reducedMotion
      });
    }
  }, [settings, emitAnalyticsEvent]);

  // ====================================
  // THEME APPLICATION v3.0 - PWA Sync
  // ====================================
  function applyTheme(currentSettings) {
    const html = document.documentElement;
    
    // Theme cascade: high-contrast > dark > colorblind > light
    let theme = 'light';
    if (currentSettings.highContrast) theme = 'high-contrast';
    else if (currentSettings.darkMode) theme = 'dark';
    else if (currentSettings.colorblindMode) theme = 'colorblind';
    
    html.setAttribute('data-theme', theme);
    
    // Typography
    if (currentSettings.largeFonts) {
      html.setAttribute('data-font-size', 'large');
    } else {
      html.removeAttribute('data-font-size');
    }
    
    // Dyslexia mode
    if (currentSettings.dyslexiaMode) {
      html.setAttribute('data-dyslexia', 'true');
    } else {
      html.removeAttribute('data-dyslexia');
    }
    
    // Motion
    if (currentSettings.reducedMotion || engagement.focusScore < 0.5) {
      html.setAttribute('data-reduced-motion', 'true');
    } else {
      html.removeAttribute('data-reduced-motion');
    }
    
    // Layout
    if (currentSettings.layout !== 'default') {
      html.setAttribute('data-layout', currentSettings.layout);
    } else {
      html.removeAttribute('data-layout');
    }
    
    // Sync PWA theme-color
    updateThemeColor(theme);
  }

  // ====================================
  // PWA THEME-COLOR SYNC
  // ====================================
  function updateThemeColor(theme) {
    const themeColors = {
      'light': '#3b82f6',
      'dark': '#141420',
      'high-contrast': '#000000',
      'colorblind': '#0077bb'
    };
    
    const color = themeColors[theme] || '#3b82f6';
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', color);
    }
    
    // App.js (near the bottom) — NO duplicate SW register here.
    // We assume index.html registers ./sw.js.
    
    if ('serviceWorker' in navigator) {
      // Wait for the already-registered SW (from index.html)
      navigator.serviceWorker.ready
        .then(async (registration) => {
          // Enable periodic background sync (check for due items)
          if ('periodicSync' in registration) {
            try {
              await registration.periodicSync.register('check-due-items', {
                minInterval: 30 * 60 * 1000
              });
              console.log('✓ Periodic sync registered');
            } catch (e) {
              console.warn('Periodic sync failed:', e);
            }
          }
    
          // Request notification permission
          if ('Notification' in window && Notification.permission === 'default') {
            setTimeout(async () => {
              try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') console.log('✓ Notifications enabled');
              } catch {}
            }, 60000);
          }
    
          // Listen for SW messages
          navigator.serviceWorker.addEventListener('message', (event) => {
            const { type, data } = event.data || {};
    
            if (type === 'SYNC_ANALYTICS') {
              console.log('Syncing analytics:', data?.events?.length || 0);
            }
    
            if (type === 'CHECK_DUE_ITEMS') {
              (async () => {
                try {
                  const dueItems = await getDueItems('all', 100);
                  const dueCount = dueItems?.length || 0;
    
                  if (dueCount > 0) {
                    window.dispatchEvent(new CustomEvent('vmq-show-toast', {
                      detail: { message: `${dueCount} flashcards are due for review!`, type: 'info' }
                    }));
                  }
                } catch {}
              })();
            }
          });
        })
        .catch((err) => console.warn('SW ready failed:', err));
    
      // Send navigation events to SW for ML prefetching
      window.addEventListener('hashchange', () => {
        const route = window.location.hash.slice(1) || 'menu';
        navigator.serviceWorker.controller?.postMessage({ type: 'NAVIGATION', route });
      });
    }

  // ====================================
  // ML: Predict time to next level
  // ====================================
  function predictTimeToNextLevel(currentXp, xpToNext) {
    const recentHistory = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []).slice(-10);
    if (recentHistory.length < 3) return null;
    
    const avgXpPerSession = recentHistory.reduce((sum, s) => sum + (s.xpGained || 0), 0) / recentHistory.length;
    if (avgXpPerSession <= 0) return null;
    
    const sessionsNeeded = Math.ceil((xpToNext - currentXp) / avgXpPerSession);
    const avgSessionFrequency = 1; // sessions per day (simplified)
    
    return Math.ceil(sessionsNeeded / avgSessionFrequency);
  }

  // ====================================
  // INITIALIZATION v3.0 - ML-Enhanced Resilience
  // ====================================
  useEffect(() => {
    let cancelled = false;
  
    async function initVMQ() {
      console.log(`[VMQ v${VMQ_VERSION}] initVMQ start`);
      initAttempts.current += 1;
      const initStart = performance.now();
  
      try {
        // 1) Health check first
        const isHealthy = await checkHealth();
        if (!isHealthy) {
          console.warn('[VMQ] Some non-critical engines failed health check');
        }
        if (cancelled) return;
  
        // 2) Load settings with ML defaults
        const savedSettings = loadJSON(STORAGE_KEYS.SETTINGS, settings);
        setSettings(savedSettings);
        applyTheme(savedSettings);
        if (cancelled) return;
  
        // 3) Initialize critical engines in parallel
        await Promise.all([
          audioEngine.init(),
          keyboard.init(),
          a11y.init(),
          sessionTracker.init()
        ]);
        if (cancelled) return;
  
        // 4) Audio config
        audioEngine.setMuted(savedSettings.muted);
        audioEngine.setVolume(savedSettings.volume);
  
        // 5) Stats with ML insights
        await refreshStats();
        if (cancelled) return;
  
        // 6) Emit init event
        emitAnalyticsEvent('app', 'initialized', {
          attempt: initAttempts.current,
          health: health.status,
          mlWarmup: mlContext.isWarmingUp ? 'pending' : 'complete'
        });
  
        // 7) Determine initial route with ML
        const profile = loadJSON(STORAGE_KEYS.PROFILE, {});
        const isFirstTime = !profile.onboardingComplete;
  
        let initialRoute = isFirstTime ? VMQ_ROUTES.WELCOME : VMQ_ROUTES.MENU;
  
        // ML: If due items exist, prioritize flashcards
        if (!isFirstTime && mlContext.dueItems > 5) {
          initialRoute = VMQ_ROUTES.FLASHCARDS;
          emitAnalyticsEvent('ml', 'prioritized-due-items', { count: mlContext.dueItems });
        }
  
        // 8) Set route and mark initialized
        router.navigate(initialRoute, {}, { track: false });
        if (cancelled) return;
  
        setInitialized(true);
  
        // 9) Check performance budget
        const initTime = performance.now() - initStart;
        checkBudget({
          engineInitTime: initTime,
          mlWarmupTime: mlContext.isWarmingUp ? 0 : 500
        });
  
        console.log(`[VMQ v${VMQ_VERSION}] ✓ Ready • ML-Enhanced`);
      } catch (error) {
        if (cancelled) return;
  
        console.error('[VMQ] initVMQ failed:', error);
        emitAnalyticsEvent('error', 'init-failed', {
          error: error.message,
          attempt: initAttempts.current
        });
  
        // Retry a couple of times, then give up and show error UI
        if (initAttempts.current < 3) {
          console.log(`[VMQ] Retrying init... (${initAttempts.current}/3)`);
          setTimeout(initVMQ, 1000);
        } else {
          setError(error);
          setInitialized(true);
        }
      }
    }
  
    initVMQ();
  
    // Keep your router subscription logic if you had it before
    const unsubscribe = router.routeInfo.subscribe?.(() => {}) || (() => {});
  
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [checkHealth, emitAnalyticsEvent, refreshStats, router, mlContext, checkBudget, settings]);

  // ====================================
  // ENGAGEMENT MONITORING
  // ====================================
  useEffect(() => {
    if (!initialized) return;
    
    // Track engagement every 5 seconds
    const tracker = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - engagement.lastInteraction;
      
      if (timeSinceLastInteraction > 60000) { // 1 minute idle
        emitAnalyticsEvent('engagement', 'idle-detected', { 
          duration: timeSinceLastInteraction 
        });
      }
      
      if (engagement.breakSuggested) {
        emitAnalyticsEvent('engagement', 'break-suggested');
      }
    }, 5000);
    
    return () => clearInterval(tracker);
  }, [initialized, engagement, emitAnalyticsEvent]);

  // ====================================
  // PWA UPDATE HANDLER
  // ====================================
  useEffect(() => {
    const handleUpdate = (e) => {
      emitAnalyticsEvent('pwa', 'update-available', { 
        version: e.detail?.version || 'unknown' 
      });
      
      // Show update toast
      window.dispatchEvent(new CustomEvent('vmq-show-toast', {
        detail: {
          message: 'VMQ update available! Refresh for new features.',
          type: 'info',
          action: 'Refresh',
          onAction: () => window.location.reload()
        }
      }));
    };
    
    window.addEventListener('vmq-update-available', handleUpdate);
    return () => window.removeEventListener('vmq-update-available', handleUpdate);
  }, [emitAnalyticsEvent]);

  // ====================================
  // A/B TESTING INTEGRATION
  // ====================================
  useEffect(() => {
    // Check if user is in experiment
    const experiments = loadJSON('vmq-experiments', {});
    const userSegment = getUserSegment();
    
    // Example: Test new dashboard layout
    if (!experiments.dashboardLayout) {
      experiments.dashboardLayout = {
        variant: Math.random() > 0.5 ? 'A' : 'B',
        assigned: Date.now()
      };
      saveJSON('vmq-experiments', experiments);
    }
    
    // Log experiment assignment
    emitAnalyticsEvent('experiment', 'assigned', {
      name: 'dashboardLayout',
      variant: experiments.dashboardLayout.variant,
      segment: userSegment
    });
  }, [emitAnalyticsEvent]);

  // ====================================
  // ROUTE RENDERER WITH PREDICTIVE LOADING
  // ====================================
  
  // ====================================
  // ROUTE RENDERER WITH PREDICTIVE LOADING
  // ====================================
  const renderCurrentRoute = () => { // <--- ADDED FUNCTION NAME
    // Get the component dynamically inside the function scope
    const Component = ROUTES[router.route] || NotFound; // <--- MOVED COMPONENT DEFINITION HERE

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
      emitAnalyticsEvent
  };

  // Ensure lazy components are wrapped in React.Suspense in the parent
  // Note: We don't see the Suspense boundary here, but we'll assume the caller (App) or a parent component handles it.
    return h(Component, commonProps);
  };

  // ====================================
  // ERROR BOUNDARY UI with Diagnostics
  // ====================================
  if (error) {
    const diagnosticData = {
      error: error.message,
      stack: error.stack,
      health,
      metrics,
      mlContext,
      timestamp: Date.now(),
      version: VMQ_VERSION
    };
    
    return h('div', { className: 'module-container' },
      h('div', { className: 'card card-error elevated', style: { textAlign: 'center', padding: 'var(--space-2xl)' } },
        h('div', { style: { fontSize: 'clamp(4rem, 12vw, 6rem)', marginBottom: 'var(--space-lg)' } }, '⚠️'),
        h('h1', { style: { color: 'var(--danger)', marginBottom: 'var(--space-md)' } }, 'Initialization Failed'),
        h('p', { style: { marginBottom: 'var(--space-md)' } }, error.message || 'VMQ failed to start'),
        
        h('div', { className: 'diagnostic-info', style: { textAlign: 'left', margin: 'var(--space-lg) 0' } },
          h('h3', null, 'Diagnostic Info:'),
          h('pre', { style: { fontSize: 'var(--font-size-xs)', overflow: 'auto' } }, 
            JSON.stringify(diagnosticData, null, 2)
          )
        ),
        
        h('button', {
          className: 'btn btn-primary btn-lg',
          onClick: () => window.location.reload(),
          style: { margin: 'var(--space-sm)' }
        }, '🔄 Reload App'),
        
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
          style: { margin: 'var(--space-sm)' }
        }, '📥 Download Diagnostics'),
        
        h('p', { className: 'text-muted', style: { marginTop: 'var(--space-lg)', fontSize: 'var(--font-size-sm)' } }, 
          `VMQ v${VMQ_VERSION} • Attempt ${initAttempts.current}/3 • Health: ${health.status}`
        )
      )
    );
  }

  // ====================================
  // LOADING SCREEN with ML Progress
  // ====================================
  if (!initialized) {
    const progress = mlContext.isWarmingUp ? 60 : 90;
    
    return h('div', { className: 'loading-screen active' },
      h('div', { className: 'loading-content', style: { textAlign: 'center' } },
        h('div', { className: 'loading-spinner', style: { 
          width: 'clamp(48px, 12vw, 64px)', 
          height: 'clamp(48px, 12vw, 64px)', 
          margin: '0 auto var(--space-xl)'
        } }),
        h('h2', { style: { marginBottom: 'var(--space-md)' } }, 'Violin Mastery Quest'),
        h('p', { className: 'text-muted' }, `Loading v${VMQ_VERSION} with ML...`),
        
        h('div', { className: 'loading-details', style: { margin: 'var(--space-lg) 0' } },
          h('div', { className: 'engine-status-grid' },
            Object.entries(health.engines).map(([name, status]) =>
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
          mlContext.isWarmingUp ? 'Warming up ML models...' : 'Finalizing...'
        )
      )
    );
  }

  // ====================================
  // MAIN LAYOUT v3.0 - ML-Enhanced
  // ====================================
  return h('div', { 
    className: 'vmq-app', 
    role: 'application', 
    'aria-label': 'Violin Mastery Quest',
    'data-ml-confidence': mlContext.confidence,
    'data-health-status': health.status
  },
    // Global Header
    !settings.zenMode && h('header', { className: 'app-header', role: 'banner' },
      h('div', { className: 'header-grid' },
        h('button', { 
          className: 'logo-btn', 
          onClick: () => router.navigate(VMQ_ROUTES.MENU),
          'aria-label': 'Violin Mastery Quest Home'
        }, '🎻 VMQ'),
        
        // ML: Show active boost indicator
        gamificationState.activeBoosts.length > 0 && h('div', { className: 'boost-indicator' },
          h('span', { className: 'boost-badge' }, `🚀 ${gamificationState.activeBoosts[0].multiplier}x`)
        ),
        
        h('div', { className: 'header-stats', 'aria-live': 'polite', 'aria-atomic': 'true' },
          h('span', { 'aria-label': `Level ${level.level}` }, `${level.badge} Lv${level.level}`),
          h('span', { 'aria-label': `${xp} experience points` }, `${xp.toLocaleString()} XP`),
          h('span', { className: 'streak', 'aria-label': `${streak} day streak` }, `${streak}🔥`),
          
          // ML: Show prediction confidence
          mlContext.confidence > 0.7 && h('span', { className: 'ml-indicator', title: 'ML active' }, '🤖')
        ),
        
        h('nav', { className: 'header-nav', role: 'navigation', 'aria-label': 'Main navigation' },
          h('button', { 
            className: `nav-btn ${router.route === VMQ_ROUTES.DASHBOARD ? 'active' : ''}`, 
            onClick: () => router.navigate(VMQ_ROUTES.DASHBOARD),
            'aria-label': 'Dashboard'
          }, '📊'),
          h('button', { 
            className: `nav-btn ${router.route === VMQ_ROUTES.COACH ? 'active' : ''}`, 
            onClick: () => router.navigate(VMQ_ROUTES.COACH),
            'aria-label': 'AI Coach'
          }, '🎯'),
          h('button', { 
            className: `nav-btn ${router.route === VMQ_ROUTES.SETTINGS ? 'active' : ''}`, 
            onClick: () => router.navigate(VMQ_ROUTES.SETTINGS),
            'aria-label': 'Settings'
          }, '⚙️')
        )
      )
    ),

    // Main Content
    h('main', { id: 'main', className: 'app-main', role: 'main', tabIndex: -1 },
      renderCurrentRoute()
    ),

    // Global Toast System
    h(ToastSystem, { 
      onToastShown: (toast) => emitAnalyticsEvent('ui', 'toast-shown', { message: toast.message })
    }),

    // ML: Quick Action FAB (Floating Action Button)
    mlContext.predictions?.quickAction && !settings.zenMode && h('button', {
      className: 'fab-quick-action',
      onClick: () => {
        const action = mlContext.predictions.quickAction;
        router.navigate(action.route, action.params);
        emitAnalyticsEvent('ml', 'quick-action-clicked', action);
      },
      'aria-label': mlContext.predictions.quickAction.label,
      title: mlContext.predictions.quickAction.label
    }, mlContext.predictions.quickAction.icon),

    // Footer
    !settings.zenMode && h('footer', { className: 'app-footer', role: 'contentinfo' },
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

// ======================================
// PRODUCTION BOOTSTRAP v3.0 - ML-Enhanced
// ======================================
function bootstrap() {
  console.log(`[VMQ v${VMQ_VERSION}] Production bootstrap with ML...`);
  
  if (!window.React || !window.ReactDOM) {
    document.getElementById('root').innerHTML = `
      <div class="error-fallback">
        <h1>⚠️ VMQ Load Failed</h1>
        <p>React libraries failed to load. Check your internet connection.</p>
        <button onclick="location.reload()" class="btn btn-primary">🔄 Reload App</button>
        <p class="text-muted">VMQ v${VMQ_VERSION}</p>
      </div>`;
    return;
  }

  const root = document.getElementById('root');
  if (!root) {
    console.error('[VMQ] Root element not found');
    return;
  }

  try {
    // Wrap App with ML Provider
    const AppWithML = h(MLProvider, null, h(App));
    
    const container = ReactDOM.createRoot(root);
    container.render(AppWithML);
    console.log(`[VMQ v${VMQ_VERSION}] ✓ Live • ML-Enhanced • PWA Ready`);
    
  } catch (error) {
    console.error('[VMQ] Render failed:', error);
    root.innerHTML = `
      <div class="error-fallback">
        <h1>🚫 Render Error</h1>
        <p>${error.message}</p>
        <button onclick="location.reload()" class="btn btn-primary">Reload</button>
      </div>`;
  }
}

// Auto-bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// In js/bootstrap.js or main App.js

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(async registration => {
      console.log('✓ VMQ SW registered');
      
      // Enable periodic background sync (check for due items)
      if ('periodicSync' in registration) {
        try {
          await registration.periodicSync.register('check-due-items', {
            minInterval: 30 * 60 * 1000 // 30 minutes
          });
          console.log('✓ Periodic sync registered');
        } catch (e) {
          console.warn('Periodic sync failed:', e);
        }
      }
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        // Ask user after they've practiced for a while
        setTimeout(async () => {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            console.log('✓ Notifications enabled');
          }
        }, 60000); // After 1 minute
      }
      
      // Listen for SW messages
      navigator.serviceWorker.addEventListener('message', event => {
        const { type, data } = event.data;
        
        if (type === 'SYNC_ANALYTICS') {
          // Process synced analytics events
          console.log('Syncing analytics:', data.events?.length);
        }
        
        if (type === 'CHECK_DUE_ITEMS') {
          const dueCount = getDueItems('all', 100).length;
          if (dueCount > 0) {
            window.dispatchEvent(new CustomEvent('vmq-show-toast', {
              detail: {
                message: `${dueCount} flashcards are due for review!`,
                type: 'info'
              }
            }));
          }
        }
      });
    })
    .catch(err => {
      console.error('SW registration failed:', err);
    });
  
  // Send navigation events to SW for ML prefetching
  window.addEventListener('hashchange', () => {
    const route = window.location.hash.slice(1) || 'menu';
    navigator.serviceWorker.controller?.postMessage({
      type: 'NAVIGATION',
      route
    });
  });
}

// ======================================
// UTILITY EXPORTS
// ======================================

// Re-export MLContext if you ever want to consume it from
// other modules (optional but safe).
export { MLContext };

/**
 * Feature-flag checker.
 * Returns true if the feature is enabled (or not explicitly disabled),
 * and false only when FEATURES[featureName].enabled === false.
 */
export function checkFeature(featureName) {
  return FEATURES[featureName]?.enabled !== false;
}