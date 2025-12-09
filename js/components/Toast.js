// ======================================
// VMQ TOAST v3.0 - ML-AWARE NOTIFICATIONS
// Fingerboard • Intervals • KeySignatures • 6-Engine LIVE
// ======================================

const {
  createElement: h,
  useState,
  useEffect,
  useCallback,
  useRef
} = React;

// Local modules: paths are relative to /js/components/
import FEATURES from '../config/version.js';
import sessionTracker from '../engines/sessionTracker.js';
import { trackEvent } from '../engines/analytics.js';

const TOAST_TYPES = {
  success:   { icon: '✅', bg: 'rgba(16, 185, 129, 0.95)', sound: 523.25 },
  error:     { icon: '❌', bg: 'rgba(239, 68, 68, 0.95)', sound: 349.23 },
  warning:   { icon: '⚠️', bg: 'rgba(245, 158, 11, 0.95)', sound: 523.25 },
  info:      { icon: 'ℹ️', bg: 'rgba(14, 165, 233, 0.95)', sound: 659.25 },
  xp:        { icon: '⭐', bg: 'rgba(251, 191, 36, 0.95)', sound: 784.0  },
  streak:    { icon: '🔥', bg: 'rgba(251, 146, 60, 0.95)', sound: 880.0  },
  achievement: { icon: '🏆', bg: 'rgba(168, 85, 247, 0.95)', sound: 1046.5 },
  // Special system/update channel (uses .info styling in CSS if no specific rule)
  update:    { icon: '⬆️', bg: 'rgba(14, 165, 233, 0.98)', sound: 659.25 }
};

// Guard so turning feature flag off makes VMQToast a no-op without breaking callers.
const TOASTS_ENABLED =
  !FEATURES ||
  !FEATURES.toastNotifications ||
  FEATURES.toastNotifications.enabled !== false;

export default function ToastSystem() {
  const [toasts, setToasts] = useState([]);
  const [now, setNow] = useState(Date.now());
  const timeoutRefs = useRef(new Map());
  const userSegmentRef = useRef('unknown');

  // Precompute whether analytics events should be emitted.
  const analyticsEnabled =
    !!FEATURES &&
    !!FEATURES.analytics &&
    FEATURES.analytics.events === true;

  // Resolve user segment once; used for analytics enrichment.
  useEffect(() => {
    try {
      if (window.VMQ && typeof window.VMQ.getUserSegment === 'function') {
        userSegmentRef.current = window.VMQ.getUserSegment() || 'unknown';
      }
    } catch (e) {
      // Soft-fail; analytics enrichment is best-effort only.
    }
  }, []);

  // ML/analytics hook for toast lifecycle.
  const logToastEvent = useCallback((phase, toast, extra = {}) => {
    if (!analyticsEnabled || !toast) return;

    const basePayload = {
      id: toast.id,
      type: toast.type,
      duration: toast.duration,
      createdAt: toast.createdAt,
      source: toast.data?.source || toast.data?.module || 'global',
      userSegment: userSegmentRef.current,
      ...extra
    };

    try {
      if (typeof trackEvent === 'function') {
        // Channel = "toast", phase = "show" | "auto-dismiss" | "interaction"
        trackEvent('toast', phase, basePayload);
      }
    } catch (e) {
      // Never block UI on analytics errors.
    }

    try {
      if (sessionTracker && typeof sessionTracker.trackActivity === 'function') {
        // Lightweight mirror into session tracker for cross-engine analytics.
        sessionTracker.trackActivity('toast', phase, {
          type: toast.type,
          source: basePayload.source,
          phase,
          ts: Date.now()
        });
      }
    } catch (e) {
      // Also best-effort.
    }
  }, [analyticsEnabled]);

  // 🎵 AUDIO FEEDBACK (honors feature flag but not per-user mute – app audio engine handles that globally)
  const playToastSound = useCallback((frequency) => {
    if (!TOASTS_ENABLED) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      // Ignore audio errors; visual toast still shows.
    }
  }, []);

  // Lightweight timer to keep progress bars and animation-dependant UI in sync.
  useEffect(() => {
    if (!toasts.length) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 100); // 10 fps is enough for smooth progress without being heavy

    return () => clearInterval(interval);
  }, [toasts.length]);

  // 🎯 ADD TOAST (Global API)
  const addToast = useCallback(
    (message, type = 'info', duration = 4000, data = {}) => {
      if (!TOASTS_ENABLED) {
        // Still return an id-like string so callers can store something if they wish.
        return `toast-disabled-${Date.now()}`;
      }

      const safeType = TOAST_TYPES[type] ? type : 'info';
      const id =
        'toast-' +
        Date.now() +
        '-' +
        Math.random().toString(36).substr(2, 9);

      const createdAt = Date.now();
      const toast = {
        id,
        message,
        type: safeType,
        duration: Math.max(800, duration || 4000), // never shorter than 800ms
         data || {},
        createdAt
      };

      // Limit stack to last 5 toasts (preserve newest).
      setToasts((prev) => {
        const next = [...prev.slice(-4), toast];
        return next;
      });

      // Schedule auto-dismiss with analytics hook.
      const timeoutId = setTimeout(() => {
        setToasts((prev) => {
          const existing = prev.find((t) => t.id === id);
          if (existing) {
            logToastEvent('auto-dismiss', existing, { reason: 'timeout' });
          }
          return prev.filter((t) => t.id !== id);
        });
        timeoutRefs.current.delete(id);
      }, toast.duration);

      timeoutRefs.current.set(id, timeoutId);

      // Fire-and-forget analytics for show.
      logToastEvent('show', toast);

      // Sound is small and non-blocking.
      playToastSound(TOAST_TYPES[safeType]?.sound || 659.25);

      return id;
    },
    [logToastEvent, playToastSound]
  );

  const dismissToast = useCallback(
    (id, reason = 'manual') => {
      const timeoutId = timeoutRefs.current.get(id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutRefs.current.delete(id);
      }

      setToasts((prev) => {
        const existing = prev.find((t) => t.id === id);
        if (existing) {
          logToastEvent('interaction', existing, {
            interactionType: 'dismiss',
            reason
          });
        }
        return prev.filter((t) => t.id !== id);
      });
    },
    [logToastEvent]
  );

  const dismissAll = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current.clear();

    // For analytics, capture what was visible before clearing.
    setToasts((prev) => {
      prev.forEach((t) =>
        logToastEvent('interaction', t, {
          interactionType: 'dismiss-all',
          reason: 'escape'
        })
      );
      return [];
    });
  }, [logToastEvent]);

  const handleToastActivate = useCallback(
    (toast, interactionType = 'click') => {
      if (!toast) return;

      // Optional per-toast action hook supplied by callers (e.g., update reload).
      if (toast.data && typeof toast.data.onClick === 'function') {
        try {
          toast.data.onClick(toast);
        } catch (e) {
          // Ignore handler errors; user still gets dismissal.
        }
      }

      logToastEvent('interaction', toast, { interactionType });
      dismissToast(toast.id, interactionType);
    },
    [dismissToast, logToastEvent]
  );

  // ⌨️ ESCAPE KEY clears all toasts
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        e.preventDefault();
        dismissAll();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [toasts.length, dismissAll]);

  // 🔁 PWA UPDATE TOAST: listen for vmq-update-available from service worker registration.
  useEffect(() => {
    const handleUpdateAvailable = (event) => {
      if (!TOASTS_ENABLED) return;

      const detail = event?.detail || {};
      const versionLabel = detail.version ? `v${detail.version}` : '';
      const message = versionLabel
        ? `Update ready: ${versionLabel}. Tap to refresh.`
        : 'A new VMQ update is ready. Tap to refresh.';

      addToast(message, 'update', 10000, {
        source: 'system',
        kind: 'update',
        onClick: () => {
          try {
            // Ask SW to skip waiting if wired; then reload.
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage?.({
                type: 'SKIPWAITING'
              });
            }
          } catch (e) {
            // Reload anyway; worst case user gets fresh shell.
          }
          window.location.reload();
        }
      });
    };

    window.addEventListener('vmq-update-available', handleUpdateAvailable);
    return () =>
      window.removeEventListener('vmq-update-available', handleUpdateAvailable);
  }, [addToast]);

  // 🌐 GLOBAL API (window.VMQToast)
  useEffect(() => {
    const api = {
      addToast,
      dismissAll,
      dismissToast,
      toastHelpers: {
        quizResult: (correct, streak = 0, xp = 0, meta = {}) =>
          correct
            ? addToast(
                `Correct! ${streak > 0 ? `🔥 ${streak} streak` : ''}`,
                'success',
                3000,
                { streak, xp, source: meta.source || 'quiz', ...meta }
              )
            : addToast('Try again!', 'error', 2500, {
                source: meta.source || 'quiz',
                ...meta
              }),

        xpGain: (amount, source = 'practice', meta = {}) =>
          addToast(
            `⭐ +${amount} XP (${source})`,
            'xp',
            3500,
            { xp: amount, source, ...meta }
          ),

        achievement: (name, xp = 0, meta = {}) =>
          addToast(
            `🏆 Achievement Unlocked: ${name}`,
            'achievement',
            5000,
            { xp, source: meta.source || 'achievement', ...meta }
          ),

        coachTip: (tip, meta = {}) =>
          addToast(
            tip,
            'info',
            6000,
            { source: meta.source || 'coach', ...meta }
          ),

        error: (message, recoverable = true, meta = {}) =>
          addToast(
            message,
            'error',
            recoverable ? 5000 : 8000,
            { recoverable, source: meta.source || 'system', ...meta }
          ),

        streakUpdate: (streak, bonus = 0, meta = {}) =>
          addToast(
            `🔥 ${streak} day streak! ${
              bonus > 0 ? `+${bonus} bonus XP` : ''
            }`,
            'streak',
            4000,
            { streak, bonus, source: meta.source || 'streak', ...meta }
          ),

        // New helper for explicit system / update messages from other modules if needed.
        systemUpdate: (message, meta = {}) =>
          addToast(
            message,
            'update',
            8000,
            { source: 'system', ...meta }
          )
      }
    };

    // Even if disabled, expose API so callers do not crash; implementation handles the flag.
    window.VMQToast = api;

    return () => {
      if (window.VMQToast === api) {
        delete window.VMQToast;
      }
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current.clear();
    };
  }, [addToast, dismissAll, dismissToast]);

  // 🎨 RENDER TOAST
  const renderToast = (toast, index) => {
    const typeConfig = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
    const elapsed = Math.max(0, now - toast.createdAt);
    const progress =
      toast.duration > 0
        ? Math.max(0, 100 - (elapsed / toast.duration) * 100)
        : 0;

    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToastActivate(toast, 'keyboard');
      }
    };

    return h(
      'div',
      {
        key: toast.id,
        className: `toast ${toast.type}`,
        role: 'alert',
        'aria-live': 'assertive',
        'aria-atomic': 'true',
        style: {
          '--toast-progress': `${progress}%`,
          '--toast-bg': typeConfig.bg,
          animationDelay: `${Math.min(index * 100, 300)}ms`
        },
        onClick: () => handleToastActivate(toast, 'click'),
        onKeyDown,
        tabIndex: 0
      },
      h('div', { className: 'toast-icon' }, typeConfig.icon),
      h(
        'div',
        { className: 'toast-content' },
        h('div', { className: 'toast-message' }, toast.message),
        toast.data?.xp &&
          h(
            'div',
            { className: 'toast-xp' },
            `+${toast.data.xp} XP`
          ),
        toast.data?.streak &&
          h(
            'div',
            { className: 'toast-streak' },
            `🔥 ${toast.data.streak} streak!`
          ),
        toast.data?.skillTag &&
          h(
            'div',
            { className: 'toast-meta' },
            toast.data.skillTag
          )
      ),
      h(
        'div',
        { className: 'toast-progress' },
        h('div', {
          className: 'toast-progress-fill',
          style: { width: `${progress}%` }
        })
      )
    );
  };

  // Container is always present so layout / print CSS rules that hide it still work cleanly.
  return h(
    'div',
    {
      className: 'toast-container',
      role: 'region',
      'aria-live': 'polite',
      'aria-label': 'Notifications'
    },
    toasts.map(renderToast)
  );
}
