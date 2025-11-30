// ========================================================
// VMQ TOAST - Accessible Notifications
// ========================================================

const { createElement: h, useEffect } = React;

export function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // ✨ ARIA live region for screen readers
  const ariaRole = type === 'error' ? 'alert' : 'status';

  return h('div', {
    className: `toast toast-${type}`,
    role: ariaRole,
    'aria-live': type === 'error' ? 'assertive' : 'polite',
    'aria-atomic': 'true',
    onClick: onClose
  },
    h('div', { className: 'toast-message' }, message),
    h('button', { 
      className: 'toast-close', 
      onClick: onClose,
      'aria-label': 'Close notification'  // ✨ Accessibility
    }, '×')
  );
}