// js/components/ErrorBoundary.js
// ErrorBoundary – Browser-safe version (no React import, no JSX)
const { Component, createElement: h } = React;

/**
 * ErrorBoundary
 *
 * - Catches runtime errors in child components
 * - Shows a friendly fallback UI instead of crashing the whole app
 * - Logs to console
 * - Emits a lightweight analytics hook:
 *   - window.dispatchEvent(new CustomEvent('vmq-error', { detail: payload }))
 *   - optional window.analyticsEngine.trackError(payload) if defined
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);

    const payload = {
      message: error?.message || String(error),
      name: error?.name || 'Error',
      stack: error?.stack || null,
      componentStack: errorInfo?.componentStack || null,
      time: Date.now()
    };

    // 1) Fire a custom event that other parts of VMQ can listen for
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('vmq-error', { detail: payload }));
      }
    } catch (e) {
      console.warn('[ErrorBoundary] vmq-error event dispatch failed:', e);
    }

    // 2) Optional global analytics hook (no hard dependency)
    try {
      if (
        typeof window !== 'undefined' &&
        window.analyticsEngine &&
        typeof window.analyticsEngine.trackError === 'function'
      ) {
        window.analyticsEngine.trackError(payload);
      }
    } catch (e) {
      console.warn('[ErrorBoundary] analyticsEngine.trackError failed:', e);
    }
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      const message =
        (this.state.error && this.state.error.message) ||
        'An unexpected error occurred.';

      return h('div', { className: 'module-container' },
        h('div', {
          className: 'card card-error elevated',
          style: { textAlign: 'center', padding: 'var(--space-2xl)' }
        },
          h('div', {
            style: {
              fontSize: 'clamp(4rem, 12vw, 6rem)',
              marginBottom: 'var(--space-lg)'
            }
          }, '⚠️'),
          h('h1', {
            style: {
              color: 'var(--danger)',
              marginBottom: 'var(--space-md)'
            }
          }, 'Something went wrong'),
          h('p', { style: { marginBottom: 'var(--space-md)' } }, message),
          h('button', {
            className: 'btn btn-primary btn-lg',
            onClick: this.handleReload,
            style: { margin: 'var(--space-sm)' }
          }, 'Reload App')
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;