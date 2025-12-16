// js/components/Loading.js
// ======================================
// VMQ LOADING v2.0.0 (Drop-in)
// Browser-safe, no React import, no JSX.
// Returns an HTMLElement so it can be used by non-React loaders.
// Also provides a small React-compat wrapper export for places that expect
// a React component (optional, non-breaking).
// ======================================

import { createElement } from '../utils/helpers.js';

/**
 * Create a loading screen element.
 * @param {object} [props]
 * @param {string} [props.message='Loading…'] Text message to display.
 * @param {boolean} [props.active=true] Whether to add "active" class.
 * @param {string} [props.ariaLabel='Loading'] Accessible label for the spinner region.
 * @returns {HTMLElement}
 */
export default function Loading(props = {}) {
  const {
    message = 'Loading…',
    active = true,
    ariaLabel = 'Loading',
  } = props;

  // Root
  const root = createElement('div', `loading-screen${active ? ' active' : ''}`);
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-busy', 'true');

  // Content
  const content = createElement('div', 'loading-content');
  content.style.textAlign = 'center';

  // Spinner
  const spinner = createElement('div', 'loading-spinner');
  spinner.setAttribute('aria-label', ariaLabel);
  spinner.style.width = 'clamp(48px, 12vw, 64px)';
  spinner.style.height = 'clamp(48px, 12vw, 64px)';
  spinner.style.margin = '0 auto var(--space-xl)';

  // Message
  const heading = createElement('h2', null, message);
  heading.style.marginBottom = 'var(--space-md)';

  // Assemble
  content.appendChild(spinner);
  content.appendChild(heading);
  root.appendChild(content);

  return root;
}

/**
 * Optional: React-compat wrapper (non-breaking).
 * If some parts of VMQ still do `const { createElement: h } = React;`
 * and expect Loading to be callable as a React function component,
 * they can import { LoadingReact } instead.
 *
 * Usage:
 *   import Loading, { LoadingReact } from './Loading.js';
 */
export function LoadingReact({ message = 'Loading…', active = true } = {}) {
  // If React is unavailable, fall back to DOM element.
  // If React is available, wrap the DOM element in a container via ref.
  // This keeps compatibility without requiring JSX.
  const ReactRef = (globalThis && globalThis.React) ? globalThis.React : null;
  if (!ReactRef?.createElement || !ReactRef?.useEffect || !ReactRef?.useRef) {
    return Loading({ message, active });
  }

  const { createElement: h, useEffect, useRef } = ReactRef;
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(Loading({ message, active }));
  }, [message, active]);

  return h('div', { ref: hostRef });
}
