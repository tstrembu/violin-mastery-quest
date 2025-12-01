// ========================================================
// VMQ APP - Main Application Router
// ========================================================

const { createElement: h, useState, useEffect } = React;

// ========================================================
// IMPORTS - All at the top!
// ========================================================

// Config
import { STORAGE_KEYS } from './config/constants.js';  // ✅ Correct path
import { loadJSON, saveJSON, getStorageStatus } from './config/storage.js';

// Engines
import { audioEngine } from './engines/audioEngine.js';

// Components - Existing
import { MainMenu } from './components/MainMenu.js';
import { Intervals } from './components/Intervals.js';
import { Flashcards } from './components/Flashcards.js';
import { Bieler } from './components/Bieler.js';
import { Rhythm } from './components/Rhythm.js';
import { KeySignatures } from './components/KeySignatures.js';
import { Fingerboard } from './components/Fingerboard.js';
import { Settings } from './components/Settings.js';
import { Toast } from './components/Toast.js';

// Components - New
import Dashboard from './components/Dashboard.js';
import Analytics from './components/Analytics.js';
import Welcome from './components/Welcome.js';
import PracticePlanner from './components/PracticePlanner.js';

// ========================================================
// MAIN APP COMPONENT
// ========================================================

export default function App() {
  // Check if user is new (no profile set yet)
  const [view, setView] = useState(() => {
    const profile = loadJSON(STORAGE_KEYS.PROFILE, null);
    return profile ? 'dashboard' : 'welcome';  // New users see welcome screen
  });

  const [stats, setStats] = useState(() => loadJSON(STORAGE_KEYS.STATS, {
    total: 0,
    correct: 0,
    byMode: {}
  }));

  const [toastMessage, setToastMessage] = useState(null);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // ========================================================
  // THEME INITIALIZATION
  // ========================================================

  useEffect(() => {
    const settings = loadJSON(STORAGE_KEYS.SETTINGS, {
      muted: false,
      darkMode: false,
      highContrast: false,
      largeFonts: false,
      compactLayout: false
    });

    applyThemeSettings(settings);
    audioEngine.setMute(settings.muted);

    // Apply profile theme if set
    const profile = loadJSON(STORAGE_KEYS.PROFILE, null);
    if (profile) {
      document.body.setAttribute('data-profile', profile);
    }
  }, []);

  function applyThemeSettings(settings) {
    const html = document.documentElement;

    // Theme
    if (settings.darkMode) {
      html.setAttribute('data-theme', 'dark');
    } else if (settings.highContrast) {
      html.setAttribute('data-theme', 'high-contrast');
    } else {
      html.setAttribute('data-theme', 'light');
    }

    // Font size
    if (settings.largeFonts) {
      html.setAttribute('data-font-size', 'large');
    } else {
      html.removeAttribute('data-font-size');
    }

    // Layout
    if (settings.compactLayout) {
      html.setAttribute('data-layout', 'compact');
    } else {
      html.removeAttribute('data-layout');
    }
  }

  // ========================================================
  // STORAGE & AUDIO INITIALIZATION
  // ========================================================

  // Check storage and warn user
  useEffect(() => {
    const storageStatus = getStorageStatus();
    if (!storageStatus.available) {
      setTimeout(() => {
        showToast(storageStatus.message, 'warning');
      }, 1000);
    }
  }, []);

  // Save stats whenever they change
  useEffect(() => {
    saveJSON(STORAGE_KEYS.STATS, stats);
  }, [stats]);

  // Initialize audio context on first interaction (iOS requirement)
  useEffect(() => {
    const initAudio = async () => {
      if (!audioInitialized) {
        try {
          await audioEngine.resume();
          setAudioInitialized(true);
          console.log('✅ Audio initialized');
        } catch (err) {
          console.warn('⚠️ Audio initialization delayed:', err);
        }
      }
    };

    const events = ['click', 'touchstart', 'touchend'];
    events.forEach(event => {
      document.addEventListener(event, initAudio, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initAudio);
      });
    };
  }, [audioInitialized]);

  // ========================================================
  // EVENT HANDLERS
  // ========================================================

  function handleAnswer(isCorrect, modeName) {
    setStats(prev => {
      const byMode = { ...prev.byMode };
      if (!byMode[modeName]) {
        byMode[modeName] = { total: 0, correct: 0 };
      }
      byMode[modeName].total += 1;
      if (isCorrect) {
        byMode[modeName].correct += 1;
      }

      return {
        total: prev.total + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        byMode
      };
    });

    // Haptic feedback on iPhone (if available)
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(isCorrect ? 10 : 50);
    }
  }

  function navigateTo(newView) {
    setView(newView);
    // Scroll to top on navigation
    window.scrollTo(0, 0);
  }

  function showToast(message, type = 'info') {
    setToastMessage({ message, type, timestamp: Date.now() });
  }

  // ========================================================
  // VIEW ROUTER
  // ========================================================

  function renderView() {
    const commonProps = {
      navigate: navigateTo,
      showToast
    };

    switch (view) {
      // New Views
      case 'welcome':
        return h(Welcome, commonProps);

      case 'dashboard':
        return h(Dashboard, commonProps);

      case 'analytics':
        return h(Analytics, commonProps);

      case 'practicePlanner':
        return h(PracticePlanner, commonProps);

      // Training Modules
      case 'intervals':
        return h(Intervals, {
          ...commonProps,
          onAnswer: (correct) => handleAnswer(correct, 'intervals'),
          audioEngine
        });

      case 'flashcards':
        return h(Flashcards, {
          ...commonProps,
          onAnswer: (correct) => handleAnswer(correct, 'flashcards')
        });

      case 'bieler':
        return h(Bieler, {
          ...commonProps,
          onAnswer: (correct) => handleAnswer(correct, 'bieler')
        });

      case 'rhythm':
        return h(Rhythm, {
          ...commonProps,
          onAnswer: (correct) => handleAnswer(correct, 'rhythm'),
          audioEngine
        });

      case 'keySignatures':
        return h(KeySignatures, {
          ...commonProps,
          onAnswer: (correct) => handleAnswer(correct, 'keySignatures')
        });

      case 'fingerboard':
        return h(Fingerboard, {
          ...commonProps,
          onAnswer: (correct) => handleAnswer(correct, 'fingerboard')
        });

      // Settings
      case 'settings':
        return h(Settings, {
          ...commonProps,
          audioEngine,
          onThemeChange: applyThemeSettings
        });

      // Main Menu (default)
      case 'menu':
      default:
        return h(MainMenu, {
          stats,
          onSelectMode: navigateTo
        });
    }
  }

  // ========================================================
  // RENDER
  // ========================================================

  return h('div', { className: 'app' },
    renderView(),
    toastMessage && h(Toast, {
      message: toastMessage.message,
      type: toastMessage.type,
      onClose: () => setToastMessage(null)
    })
  );
}

// ========================================================
// MOUNT APP
// ========================================================

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
