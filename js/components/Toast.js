// ======================================
// VMQ TOAST v2.3.1 - PRODUCTION OPTIMIZED
// Fingerboard • Intervals • KeySignatures • 6-Engine LIVE
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef } = React;

const TOAST_TYPES = {
  success: { icon: '✅', bg: 'rgba(16, 185, 129, 0.95)', sound: 523.25 },
  error: { icon: '❌', bg: 'rgba(239, 68, 68, 0.95)', sound: 349.23 },
  warning: { icon: '⚠️', bg: 'rgba(245, 158, 11, 0.95)', sound: 523.25 },
  info: { icon: 'ℹ️', bg: 'rgba(14, 165, 233, 0.95)', sound: 659.25 },
  xp: { icon: '⭐', bg: 'rgba(251, 191, 36, 0.95)', sound: 784.00 },
  streak: { icon: '🔥', bg: 'rgba(251, 146, 60, 0.95)', sound: 880.00 },
  achievement: { icon: '🏆', bg: 'rgba(168, 85, 247, 0.95)', sound: 1046.50 }
};

export default function ToastSystem() {
  const [toasts, setToasts] = useState([]);
  const timeoutRefs = useRef(new Map());

  // 🎯 ADD TOAST (Global API)
  const addToast = useCallback((message, type = 'info', duration = 4000, data = {}) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast = { id, message, type, duration, data, createdAt: Date.now() };

    setToasts(prev => [...prev.slice(-4), toast]); // Max 5 stacked
    
    const timeoutId = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timeoutRefs.current.delete(id);
    }, duration);
    timeoutRefs.current.set(id, timeoutId);

    playToastSound(TOAST_TYPES[type]?.sound || 659.25);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current.clear();
    setToasts([]);
  }, []);

  // 🎵 AUDIO FEEDBACK
  const playToastSound = useCallback((frequency) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    } catch (e) {}
  }, []);

  // ⌨️ ESCAPE KEY
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

  // 🌐 GLOBAL API (window.VMQToast)
  useEffect(() => {
    window.VMQToast = {
      addToast, dismissAll, dismissToast,
      toastHelpers: {
        quizResult: (correct, streak = 0, xp = 0) => correct 
          ? addToast(`Correct! ${streak > 0 ? `🔥 ${streak} streak` : ''}`, 'success', 3000, { streak, xp })
          : addToast('Try again!', 'error', 2500),
        xpGain: (amount, source = 'practice') => addToast(`⭐ +${amount} XP (${source})`, 'xp', 3500, { xp: amount }),
        achievement: (name, xp = 0) => addToast(`🏆 Achievement Unlocked: ${name}`, 'achievement', 5000, { xp }),
        coachTip: (tip) => addToast(tip, 'info', 6000),
        error: (message, recoverable = true) => addToast(message, 'error', recoverable ? 5000 : 8000),
        streakUpdate: (streak, bonus = 0) => addToast(
          `🔥 ${streak} day streak! ${bonus > 0 ? `+${bonus} bonus XP` : ''}`, 'streak', 4000, { streak, bonus }
        )
      }
    };
    return () => { 
      delete window.VMQToast; 
      timeoutRefs.current.forEach(clearTimeout); 
    };
  }, [addToast, dismissAll]);

  // 🎨 RENDER TOAST
  const renderToast = (toast, index) => {
    const typeConfig = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
    const elapsed = Date.now() - toast.createdAt;
    const progress = Math.max(0, 100 - (elapsed / toast.duration * 100));

    return h('div', {
      key: toast.id,
      className: `toast ${toast.type}`,
      role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'true',
      style: { 
        '--toast-progress': `${progress}%`,
        '--toast-bg': typeConfig.bg,
        animationDelay: `${Math.min(index * 100, 300)}ms`
      },
      onClick: () => dismissToast(toast.id),
      tabIndex: 0
    },
      h('div', { className: 'toast-icon' }, typeConfig.icon),
      h('div', { className: 'toast-content' },
        h('div', { className: 'toast-message' }, toast.message),
        toast.data.xp && h('div', { className: 'toast-xp' }, `+${toast.data.xp} XP`),
        toast.data.streak && h('div', { className: 'toast-streak' }, `🔥 ${toast.data.streak} streak!`)
      ),
      h('div', { className: 'toast-progress' },
        h('div', { className: 'toast-progress-fill', style: { width: `${progress}%` } })
      )
    );
  };

  return h('div', { 
    className: 'toast-container', 
    role: 'region', 'aria-live': 'polite', 
    'aria-label': 'Notifications' 
  }, toasts.map(renderToast));
}
