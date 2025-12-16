// js/components/ErrorBoundary.js
// ======================================
// ErrorBoundary – Browser-safe (React UMD, no JSX)
// Drop-in replacement for VMQ
//
// Features:
// - Catches render/lifecycle errors in descendants
// - Friendly fallback UI + Reload button
// - Console logging
// - Emits analytics hooks:
//   1) window.dispatchEvent(new CustomEvent('vmq-error', { detail }))
//   2) optional window.analyticsEngine.trackError(detail)
// - Optional "Reset" when route/module changes (if resetKey prop changes)
// - Optional "onError" callback prop (no hard dependency)
// ======================================

const { Component, createElement: h } = React;

function safeString(v) {
  try {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v && typeof v.message === 'string') return v.message;
    return String(v);
  } catch {
    return '';
  }
}

function now() {
  return Date.now();
}

function safeDispatchVMQError(payload) {
  try {
    if (typeof window !== 'undefined' && window?.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('vmq-error', { detail: payload }));
    }
  } catch (e) {
    console.warn('[ErrorBoundary] vmq-error event dispatch failed:', e);
  }
}

function safeAnalyticsTrack(payload) {
  try {
    if (
      typeof window !== 'undefined' &&
      window?.analyticsEngine &&
      typeof window.analyticsEngine.trackError === 'function'
    ) {
      window.analyticsEngine.trackError(payload);
    }
  } catch (e) {
    console.warn('[ErrorBoundary] analyticsEngine.trackError failed:', e);
  }
}

/**
 * ErrorBoundary
 *
 * Props (all optional):
 * - resetKey: any value; when it changes, boundary resets to non-error state
 * - onError(payload): callback invoked after capture (no hard dependency)
 * - title: override fallback title text
 * - showDetails: boolean; if true, shows stack trace block
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };

    this.handleReload = this.handleReload.bind(this);
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 1) Log
    console.error('[ErrorBoundary]', error, errorInfo);

    // 2) Build payload
    const payload = {
      id: `vmq-${now()}-${Math.random().toString(16).slice(2)}`,
      message: safeString(error?.message || error),
      name: safeString(error?.name) || 'Error',
      stack: error?.stack || null,
      componentStack: errorInfo?.componentStack || null,
      href: (typeof window !== 'undefined' && window?.location?.href) ? window.location.href : null,
      userAgent: (typeof navigator !== 'undefined' && navigator?.userAgent) ? navigator.userAgent : null,
      time: now()
    };

    // 3) Save for optional display
    this.setState({
      errorInfo: errorInfo || null,
      errorId: payload.id
    });

    // 4) Fire hooks (no hard dependencies)
    safeDispatchVMQError(payload);
    safeAnalyticsTrack(payload);

    try {
      if (typeof this.props?.onError === 'function') {
        this.props.onError(payload);
      }
    } catch (e) {
      console.warn('[ErrorBoundary] onError callback failed:', e);
    }
  }

  componentDidUpdate(prevProps) {
    // Optional auto-reset when route/module changes
    if (this.state.hasError && prevProps?.resetKey !== this.props?.resetKey) {
      this.handleReset();
    }
  }

  handleReload() {
    try {
      if (typeof window !== 'undefined' && window?.location?.reload) {
        window.location.reload();
      }
    } catch {
      // If reload fails, at least try to reset UI
      this.handleReset();
    }
  }

  handleReset() {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props?.title || 'Something went wrong';
    const message =
      safeString(this.state?.error?.message) ||
      'An unexpected error occurred.';

    const showDetails = !!this.props?.showDetails;
    const stack = this.state?.error?.stack || null;
    const componentStack = this.state?.errorInfo?.componentStack || null;

    return h('div', { className: 'module-container', role: 'main', 'aria-live': 'polite' },
      h('div', {
        className: 'card card-error elevated',
        style: {
          textAlign: 'center',
          padding: 'var(--space-2xl)',
          maxWidth: '860px',
          margin: '0 auto'
        }
      },
        h('div', {
          style: {
            fontSize: 'clamp(4rem, 12vw, 6rem)',
            marginBottom: 'var(--space-lg)'
          },
          'aria-hidden': true
        }, '⚠️'),

        h('h1', {
          style: {
            color: 'var(--danger)',
            marginBottom: 'var(--space-md)'
          }
        }, title),

        h('p', { style: { marginBottom: 'var(--space-md)' } }, message),

        this.state?.errorId && h('p', {
          className: 'small',
          style: { opacity: 0.75, marginBottom: 'var(--space-md)' }
        }, `Error ID: ${this.state.errorId}`),

        h('div', { style: { display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' } },
          h('button', {
            className: 'btn btn-primary btn-lg',
            onClick: this.handleReload,
            style: { margin: 'var(--space-sm)' },
            type: 'button'
          }, 'Reload App'),

          h('button', {
            className: 'btn btn-outline btn-lg',
            onClick: this.handleReset,
            style: { margin: 'var(--space-sm)' },
            type: 'button'
          }, 'Try to Continue')
        ),

        showDetails && (stack || componentStack) && h('details', {
          style: {
            textAlign: 'left',
            marginTop: 'var(--space-lg)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface-2, #f8f9fa)'
          }
        },
          h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Technical details'),
          stack && h('pre', {
            style: {
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginTop: '10px',
              fontSize: '0.85rem'
            }
          }, stack),
          componentStack && h('pre', {
            style: {
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginTop: '10px',
              fontSize: '0.85rem'
            }
          }, componentStack)
        )
      )
    );
  }
}

export default ErrorBoundary;