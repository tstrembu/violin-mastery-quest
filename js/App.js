// ========================================================
// VMQ APP - Production Version with Theme Initialization
// ========================================================

const { createElement: h, useState, useEffect } = React;

import { MainMenu } from './components/MainMenu.js';
import { Intervals } from './components/Intervals.js';
import { Flashcards } from './components/Flashcards.js';
import { Bieler } from './components/Bieler.js';
import { Rhythm } from './components/Rhythm.js';
import { KeySignatures } from './components/KeySignatures.js';
import { Fingerboard } from './components/Fingerboard.js';
import { Settings } from './components/Settings.js';
import { Toast } from './components/Toast.js';
import { audioEngine } from './engines/audioEngine.js';
import { STORAGE_KEYS, loadJSON, saveJSON, getStorageStatus } from './config/storage.js';

export default function App() {
  const [view, setView] = useState('menu');
  const [stats, setStats] = useState(() => loadJSON(STORAGE_KEYS.STATS, {
    total: 0,
    correct: 0,
    byMode: {}
  }));
  const [toastMessage, setToastMessage] = useState(null);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // ✨ Apply saved theme settings on mount
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
  }, []);

  /**
   * ✨ Apply theme settings to DOM
   */
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
          console.log('Audio initialized');
        } catch (err) {
          console.warn('Audio initialization delayed:', err);
        }
      }
    };

    // Multiple event types for better iOS compatibility
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
  }

  function showToast(message, type = 'info') {
    setToastMessage({ message, type, timestamp: Date.now() });
  }

  function renderView() {
    const commonProps = {
      onBack: () => navigateTo('menu'),
      showToast
    };

    switch (view) {
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
        return h(Fingerboard, commonProps);

      case 'settings':
        return h(Settings, {
          ...commonProps,
          audioEngine
        });

      default:
        return h(MainMenu, {
          stats,
          onSelectMode: navigateTo
        });
    }
  }

  return h('div', { className: 'app' },
    renderView(),
    toastMessage && h(Toast, {
      message: toastMessage.message,
      type: toastMessage.type,
      onClose: () => setToastMessage(null)
    })
  );
}

// Mount app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
