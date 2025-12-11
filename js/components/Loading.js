// Loading – Browser-safe version (no React import, no JSX)
const { createElement: h } = React;

/**
 * Simple loading indicator used as a Suspense fallback when lazily loaded
 * modules are still being downloaded.
 */
function Loading({ message = 'Loading…' }) {
  return h('div', { className: 'loading-screen active' },
    h('div', {
      className: 'loading-content',
      style: { textAlign: 'center' }
    },
      h('div', {
        className: 'loading-spinner',
        style: {
          width: 'clamp(48px, 12vw, 64px)',
          height: 'clamp(48px, 12vw, 64px)',
          margin: '0 auto var(--space-xl)'
        }
      }),
      h('h2', { style: { marginBottom: 'var(--space-md)' } }, message)
    )
  );
}

export default Loading;