// js/components/Toast.js
// ======================================
// VMQ TOAST v3.0.5 - ML-AWARE NOTIFICATIONS (Drop-in)
// ✅ Fixes syntax error: `data: data.data || {}` (and supports both shapes safely)
// ✅ Robust to sessionTracker default-vs-named export
// ✅ Never crashes callers when disabled (window.VMQToast still exists)
// ✅ Better numeric checks for xp/streak (shows 0 correctly when desired)
// ======================================

const {
  createElement: h,
  useState,
  useEffect,
  useCallback,
  useRef
} = React;

// Local modules
import FEATURES from '../config/version.js';
import * as sessionTrackerModule from '../engines/sessionTracker.js';
import { trackEvent } from '../engines/analytics.js';

const sessionTracker =
  sessionTrackerModule?.default ||
  sessionTrackerModule?.sessionTracker ||
  sessionTrackerModule;

const TOAST_TYPES = {
  success:      { icon: '✅', bg: 'rgba(16, 185, 129, 0.95)', sound: 523.25 },
  error:        { icon: '❌', bg: 'rgba(239, 68, 68, 0.95)', sound: 349.23 },
  warning:      { icon: '⚠️', bg: 'rgba(245, 158, 11, 0.95)', sound: 523.25 },
  info:         { icon: 'ℹ️', bg: 'rgba(14, 165, 233, 0.95)', sound: 659.25 },
  xp:           { icon: '⭐', bg: 'rgba(251, 191, 36, 0.95)', sound: 784.0  },
  streak:       { icon: '🔥', bg: 'rgba(251, 146, 60, 0.95)', sound: 880.0  },
  achievement:  { icon: '🏆', bg: 'rgba(168, 85, 247, 0.95)', sound: 1046.5 },
  update:       { icon: '⬆️', bg: 'rgba(14, 165, 233, 0.98)', sound: 659.25 }
};

// Feature-flag: if explicitly disabled, API remains but becomes no-op.
const TOASTS_ENABLED =
  !FEATURES ||
  !FEATURES.toastNotifications ||
  FEATURES.toastNotifications.enabled !== false;

function safeString(x) {
  if (x == null) return '';
  return typeof x === 'string' ? x : String(x);
}

function safeDuration(ms, fallback = 4000) {
  const n = Number(ms);
  const v = Number.isFinite(n) ? n : fallback;
  return Math.max(800, v); // never shorter than 800ms
}

function normalizeToastData(data) {
  // Supports either:
  // 1) addToast(..., dataObj)
  // 2) addToast(..., { data: dataObj })  <-- the syntax-error case you referenced
  if (data && typeof data === 'object') {
    const inner = data.data;
    if (inner && typeof inner === 'object') return inner;
    return data;
  }
  return {};
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function ToastSystem() {
  const [toasts, setToasts] = useState([]);
  const [now, setNow] = useState(Date.now());

  const timeoutRefs = useRef(new Map());
  const userSegmentRef = useRef('unknown');

  // Optional shared AudioContext (lighter than creating a new one per toast)
  const audioCtxRef = useRef(null);

  const analyticsEnabled =
    !!FEATURES &&
    !!FEATURES.analytics &&
    FEATURES.analytics.events === true;

  // Resolve user segment once (best-effort)
  useEffect(() => {
    try {
      if (window.VMQ && typeof window.VMQ.getUserSegment === 'function') {
        userSegmentRef.current = window.VMQ.getUserSegment() || 'unknown';
      }
    } catch {}
  }, []);

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
        trackEvent('toast', phase, basePayload);
      }
    } catch {}

    try {
      if (sessionTracker && typeof sessionTracker.trackActivity === 'function') {
        sessionTracker.trackActivity('toast', phase, {
          type: toast.type,
          source: basePayload.source,
          phase,
          ts: Date.now()
        });
      }
    } catch {}
  }, [analyticsEnabled]);

  const playToastSound = useCallback((frequency) => {
    if (!TOASTS_ENABLED) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      // Lazily create (or reuse) a context.
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();

      const audioCtx = audioCtxRef.current;
      const t0 = audioCtx.currentTime;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = Number(frequency) || 659.25;

      gain.gain.setValueAtTime(0.10, t0);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.30);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(t0);
      osc.stop(t0 + 0.40);
    } catch {
      // Ignore audio errors
    }
  }, []);

  // Tick for progress bars (only while toasts exist)
  useEffect(() => {
    if (!toasts.length) return;

    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [toasts.length]);

  // Global API: addToast(message, type, duration, data)
  const addToast = useCallback((message, type = 'info', duration = 4000, data = {}) => {
    if (!TOASTS_ENABLED) return `toast-disabled-${Date.now()}`;

    const safeType = TOAST_TYPES[type] ? type : 'info';
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const createdAt = Date.now();

    const toast = {
      id,
      message: safeString(message),
      type: safeType,
      duration: safeDuration(duration, 4000),
      // ✅ Fix + compatibility: supports data.data OR data directly
      data: normalizeToastData(data) || {},
      createdAt
    };

    // Keep newest 5
    setToasts((prev) => [...prev.slice(-4), toast]);

    const timeoutId = setTimeout(() => {
      setToasts((prev) => {
        const existing = prev.find((t) => t.id === id);
        if (existing) logToastEvent('auto-dismiss', existing, { reason: 'timeout' });
        return prev.filter((t) => t.id !== id);
      });
      timeoutRefs.current.delete(id);
    }, toast.duration);

    timeoutRefs.current.set(id, timeoutId);

    logToastEvent('show', toast);
    playToastSound(TOAST_TYPES[safeType]?.sound || 659.25);

    return id;
  }, [logToastEvent, playToastSound]);

  const dismissToast = useCallback((id, reason = 'manual') => {
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
  }, [logToastEvent]);

  const dismissAll = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current.clear();

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

  const handleToastActivate = useCallback((toast, interactionType = 'click') => {
    if (!toast) return;

    if (toast.data && typeof toast.data.onClick === 'function') {
      try { toast.data.onClick(toast); } catch {}
    }

    logToastEvent('interaction', toast, { interactionType });
    dismissToast(toast.id, interactionType);
  }, [dismissToast, logToastEvent]);

  // ESC clears all
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

  // PWA update toast
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
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage?.({ type: 'SKIPWAITING' });
            }
          } catch {}
          window.location.reload();
        }
      });
    };

    window.addEventListener('vmq-update-available', handleUpdateAvailable);
    return () => window.removeEventListener('vmq-update-available', handleUpdateAvailable);
  }, [addToast]);

  // Expose window.VMQToast API
  useEffect(() => {
    const api = {
      addToast,
      dismissAll,
      dismissToast,
      toastHelpers: {
        quizResult: (correct, streak = 0, xp = 0, meta = {}) =>
          correct
            ? addToast(
                `Correct! ${Number(streak) > 0 ? `🔥 ${streak} streak` : ''}`,
                'success',
                3000,
                { streak, xp, source: meta.source || 'quiz', ...meta }
              )
            : addToast('Try again!', 'error', 2500, {
                source: meta.source || 'quiz',
                ...meta
              }),

        xpGain: (amount, source = 'practice', meta = {}) =>
          addToast(`⭐ +${amount} XP (${source})`, 'xp', 3500, { xp: amount, source, ...meta }),

        achievement: (name, xp = 0, meta = {}) =>
          addToast(`🏆 Achievement Unlocked: ${name}`, 'achievement', 5000, {
            xp,
            source: meta.source || 'achievement',
            ...meta
          }),

        coachTip: (tip, meta = {}) =>
          addToast(tip, 'info', 6000, { source: meta.source || 'coach', ...meta }),

        error: (message, recoverable = true, meta = {}) =>
          addToast(message, 'error', recoverable ? 5000 : 8000, {
            recoverable,
            source: meta.source || 'system',
            ...meta
          }),

        streakUpdate: (streak, bonus = 0, meta = {}) =>
          addToast(
            `🔥 ${streak} day streak! ${Number(bonus) > 0 ? `+${bonus} bonus XP` : ''}`,
            'streak',
            4000,
            { streak, bonus, source: meta.source || 'streak', ...meta }
          ),

        systemUpdate: (message, meta = {}) =>
          addToast(message, 'update', 8000, { source: 'system', ...meta })
      }
    };

    window.VMQToast = api;

    return () => {
      if (window.VMQToast === api) delete window.VMQToast;
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current.clear();
      try {
        // Optional: release audio context
        audioCtxRef.current?.close?.();
      } catch {}
      audioCtxRef.current = null;
    };
  }, [addToast, dismissAll, dismissToast]);

  const renderToast = (toast, index) => {
    const typeConfig = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
    const elapsed = Math.max(0, now - toast.createdAt);
    const progress = toast.duration > 0
      ? Math.max(0, 100 - (elapsed / toast.duration) * 100)
      : 0;

    const xp = numOrNull(toast.data?.xp);
    const streak = numOrNull(toast.data?.streak);

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

        (xp != null && xp !== 0) &&
          h('div', { className: 'toast-xp' }, `+${xp} XP`),

        (streak != null && streak !== 0) &&
          h('div', { className: 'toast-streak' }, `🔥 ${streak} streak!`),

        toast.data?.skillTag &&
          h('div', { className: 'toast-meta' }, toast.data.skillTag)
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