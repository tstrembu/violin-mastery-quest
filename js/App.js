// ======================================
// VMQ ROOT APPLICATION v2.0 - TOAST SYSTEM LIVE!
// Unified router + 50+ modules + Gamification Feedback
// ======================================

const { createElement: h, useState, useEffect, useCallback } = React;

import { STORAGE_KEYS, VMQ_VERSION } from './config/constants.js';
import { loadJSON, saveJSON } from './config/storage.js';
import { audioEngine } from './engines/audioEngine.js';
import { loadXP, loadStreak, updateStreak, getLevel } from './engines/gamification.js';
import { sessionTracker } from './engines/sessionTracker.js';
import { keyboard } from './utils/keyboard.js';
import { a11y } from './utils/keyboard.js';

// ======================================
// TOAST SYSTEM (NEW!)
import ToastSystem from './components/Toast.js';  // ✅ ADD THIS LINE
// ======================================

// ======================================
// CORE COMPONENTS (Always loaded)
import MainMenu from './components/MainMenu.js';
import Dashboard from './components/Dashboard.js';
import Analytics from './components/Analytics.js';
import Settings from './components/Settings.js';
import Welcome from './components/Welcome.js';
import CoachPanel from './components/CoachPanel.js';
import PracticeJournal from './components/PracticeJournal.js';

// ... (all your other imports remain the same)

// ======================================
// COMPLETE ROUTES MAP v2.0 (50+ modules) - UNCHANGED
// ======================================
const ROUTES = {
  // Core Navigation
  'menu': MainMenu,
  'dashboard': Dashboard,
  'analytics': Analytics,
  'settings': Settings,
  'welcome': Welcome,
  'coach': CoachPanel,
  'journal': PracticeJournal,
  // ... all your routes unchanged
};

// ======================================
// ROOT APP v2.0 - TOAST SYSTEM INTEGRATED
// ======================================

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('loading');
  // ✅ REMOVE toastQueue - ToastSystem handles this!
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState({ level: 1, title: 'Beginner', badge: '🎵' });
  const [settings, setSettings] = useState({
    muted: false, volume: 0.7, violinTimbre: true,
    darkMode: false, highContrast: false, largeFonts: false,
    zenMode: false, reducedMotion: false, onboardingComplete: false
  });

  // ✅ REMOVE showToast/dismissToast - ToastSystem handles globally!

  const refreshStats = useCallback(() => {
    const currentXp = loadXP();
    const streakData = updateStreak();
    const currentLevel = getLevel(currentXp);
    setXp(currentXp);
    setStreak(streakData.current);
    setLevel(currentLevel);
  }, []);

  const updateSettings = useCallback((updates) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    saveJSON(STORAGE_KEYS.SETTINGS, updated);
  }, [settings]);

  // ====================================
  // INITIALIZATION v2.0 - UNCHANGED
  // ====================================
  useEffect(() => {
    async function initialize() {
      console.log(`[VMQ v${VMQ_VERSION}] Initializing...`);

      try {
        const savedSettings = loadJSON(STORAGE_KEYS.SETTINGS, settings);
        setSettings(savedSettings);
        applyTheme(savedSettings);

        await audioEngine.init();
        audioEngine.setMuted(savedSettings.muted);
        audioEngine.setVolume(savedSettings.volume);

        sessionTracker.init();
        keyboard.init();
        a11y.init();

        refreshStats();

        const profile = loadJSON(STORAGE_KEYS.PROFILE, {});
        const isFirstTime = !profile.onboardingComplete;
        const initialRoute = isFirstTime ? 'welcome' : 'menu';
        setCurrentRoute(initialRoute);
        if (!window.location.hash) router.navigate(initialRoute);

        router.start();
        setInitialized(true);
        console.log(`[VMQ v${VMQ_VERSION}] Ready + ToastSystem LIVE ✓`);

      } catch (error) {
        console.error('[VMQ] Init failed:', error);
        setInitialized(true);
      }
    }

    initialize();
    const unsubscribe = router.subscribe(setCurrentRoute);
    return unsubscribe;
  }, [refreshStats]);

  function applyTheme(settings) {
    const html = document.documentElement;
    html.setAttribute('data-theme', 
      settings.darkMode ? 'dark' : 
      settings.highContrast ? 'high-contrast' : 'light'
    );
    if (settings.largeFonts) html.setAttribute('data-font-size', 'large');
    if (settings.reducedMotion) html.setAttribute('data-reduced-motion', 'true');
  }

  const renderCurrentRoute = () => {
    const Component = ROUTES[currentRoute] || NotFound;
    const commonProps = {
      onBack: () => router.navigate('menu'),
      onNavigate: router.navigate,
      refreshStats,  // ✅ Pass to modules
      xp, streak, level, settings, updateSettings
    };
    return h(Component, commonProps);
  };

  function NotFound({ onBack }) {
    return h('div', { className: 'module-container center' },
      h('div', { className: 'card error-card' },
        h('h2', null, '🚫 Route Not Found'),
        h('p', null, `"${currentRoute}" doesn't exist`),
        h('button', {
          className: 'btn btn-primary',
          onClick: () => router.navigate('menu')
        }, '🏠 Menu')
      )
    );
  }

  if (!initialized) {
    return h('div', { className: 'loading-screen full' },
      h('div', { className: 'loading-content' },
        h('div', { className: 'loading-spinner large' }),
        h('h2', null, 'Violin Mastery Quest'),
        h('p', null, `Loading v${VMQ_VERSION}...`)
      )
    );
  }

  // ====================================
  // ✅ MAIN LAYOUT WITH TOASTSYSTEM!
  // ====================================
  return h('div', { className: 'vmq-app', role: 'application' },
    // Global Header (unchanged)
    !settings.zenMode && h('header', { className: 'app-header' },
      h('div', { className: 'header-grid' },
        h('button', { className: 'logo-btn', onClick: () => router.navigate('menu') }, '🎻 VMQ'),
        h('div', { className: 'header-stats', 'aria-live': 'polite' },
          h('span', null, `${level.badge} Lv${level.level}`),
          h('span', null, `${xp.toLocaleString()} XP`),
          h('span', { className: 'streak' }, `${streak}🔥`)
        ),
        h('nav', { className: 'header-nav' },
          h('button', { className: `nav-btn ${currentRoute === 'dashboard' ? 'active' : ''}`, 
                       onClick: () => router.navigate('dashboard') }, '📊'),
          h('button', { className: `nav-btn ${currentRoute === 'coach' ? 'active' : ''}`, 
                       onClick: () => router.navigate('coach') }, '🎯'),
          h('button', { className: `nav-btn ${currentRoute === 'settings' ? 'active' : ''}`, 
                       onClick: () => router.navigate('settings') }, '⚙️')
        )
      )
    ),

    // Main content
    h('main', { className: 'app-main' }, renderCurrentRoute()),

    // ✅ TOAST SYSTEM (Global - Always visible!)
    h(ToastSystem, null),

    // Footer (unchanged)
    !settings.zenMode && h('footer', { className: 'app-footer' },
      h('div', null,
        h('small', null, `VMQ v${VMQ_VERSION} • Bieler Method`),
        h('kbd', null, 'ESC'), h('small', null, 'Back')
      )
    )
  );
}

// ======================================
// PRODUCTION BOOTSTRAP
// ======================================

function bootstrap() {
  console.log(`[VMQ v${VMQ_VERSION}] Production bootstrap...`);
  
  if (!window.React || !window.ReactDOM) {
    document.getElementById('root').innerHTML = `
      <div style="padding:3rem;text-align:center;background:var(--bg-primary);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <h1 style="color:var(--danger);">⚠️ VMQ Load Failed</h1>
        <p>React libraries failed to load.</p>
        <button onclick="location.reload()" style="padding:1rem 2rem;background:var(--primary);color:white;border:none;border-radius:8px;font-size:1.1rem;cursor:pointer;margin-top:1rem;">🔄 Reload App</button>
        <p style="margin-top:2rem;font-size:0.9rem;color:var(--ink-light);">Check your internet connection</p>
      </div>`;
    return;
  }

  const root = document.getElementById('root');
  if (!root) return console.error('[VMQ] Root not found');

  try {
    const container = ReactDOM.createRoot(root);
    container.render(h(App));
    console.log(`[VMQ v${VMQ_VERSION}] Live ✓`);
  } catch (error) {
    console.error('[VMQ] Render failed:', error);
    root.innerHTML = `
      <div style="padding:3rem;text-align:center;">
        <h1 style="color:var(--danger);">🚫 Render Error</h1>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="padding:1rem 2rem;background:var(--primary);color:white;border:none;border-radius:8px;">Reload</button>
      </div>`;
  }
}

// Production bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
