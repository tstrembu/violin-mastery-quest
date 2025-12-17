// js/bootstrap.js
// ============================================================
// VMQ BOOTSTRAP v1.1.0 (Drop-in replacement)
//
// Goals:
// - Remains safe/minimal (keeps SW precache satisfied).
// - Adds small, reusable utilities that *won’t break* if unused.
// - Provides a single shared place for shell-level helpers if you
//   later move logic out of index.html / App.js.
// - Avoids hard dependencies on React or any engine modules.
//
// Compatible with the rest of the app:
// - Still exports BOOTSTRAP_VERSION and noop() as before.
// - Adds optional helpers (all side-effect free unless called).
// ============================================================

export const BOOTSTRAP_VERSION = 'vmq-bootstrap-1.1.0';

/** No-op function (kept for compatibility). */
export function noop() {}

/** High-resolution timestamp helper. */
export function now() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

/**
 * Safe JSON parse (returns fallback on failure).
 * @template T
 * @param {string} text
 * @param {T} fallback
 * @returns {T}
 */
export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(String(text));
  } catch {
    return fallback;
  }
}

/**
 * Lightweight logger that can be disabled by setting window.VMQ_LOG = false.
 * @param {...any} args
 */
export function log(...args) {
  try {
    const enabled = (typeof window === 'undefined') ? false : (window.VMQ_LOG !== false);
    if (enabled) console.log('[VMQ]', ...args);
  } catch {
    // ignore
  }
}

/**
 * Update <meta name="theme-color"> safely.
 * (CSS cannot change meta theme-color; must be done via JS.)
 * @param {string} color
 */
export function setThemeColor(color) {
  try {
    if (typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && typeof color === 'string' && color.trim()) {
      meta.setAttribute('content', color.trim());
    }
  } catch {
    // ignore
  }
}

/**
 * Announce a message to screen readers (polite).
 * @param {string} message
 * @param {{ timeoutMs?: number }} [opts]
 */
export function announce(message, opts = {}) {
  try {
    if (typeof document === 'undefined') return;
    const text = String(message || '').trim();
    if (!text) return;

    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.position = 'absolute';
    el.style.left = '-10000px';
    el.style.top = 'auto';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.overflow = 'hidden';
    el.textContent = text;

    document.body.appendChild(el);
    const timeoutMs = Number(opts.timeoutMs ?? 1000);
    setTimeout(() => el.remove(), Number.isFinite(timeoutMs) ? timeoutMs : 1000);
  } catch {
    // ignore
  }
}

/**
 * Create a guarded, idempotent function wrapper.
 * Useful for “register SW once” or “init once” patterns.
 * @template {(...args:any)=>any} F
 * @param {string} key
 * @param {F} fn
 * @returns {F}
 */
export function once(key, fn) {
  /** @type {any} */
  const g = (typeof globalThis !== 'undefined') ? globalThis : {};
  const storeKey = `__VMQ_ONCE__:${String(key || 'default')}`;

  return /** @type {F} */ (function (...args) {
    if (g[storeKey]) return g[storeKey].value;
    g[storeKey] = { ran: true, value: fn(...args) };
    return g[storeKey].value;
  });
}

/**
 * Feature check helper (fail-open).
 * Reads: window.VMQ.FEATURES or window.VMQ.features
 * @param {string} featureName
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName) {
  try {
    if (typeof window === 'undefined') return true;
    const name = String(featureName || '').trim();
    if (!name) return true;
    const features = window.VMQ?.FEATURES || window.VMQ?.features || {};
    return features?.[name]?.enabled !== false;
  } catch {
    return true;
  }
}

/**
 * Non-throwing service worker registration helper.
 * (Does nothing if unsupported or disabled by feature flag.)
 *
 * @param {{ scriptUrl?: string, scope?: string, featureFlag?: string }} [opts]
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerSW(opts = {}) {
  try {
    if (typeof window === 'undefined') return null;
    const featureFlag = String(opts.featureFlag || 'pwaOffline');
    if (!isFeatureEnabled(featureFlag)) return null;
    if (!('serviceWorker' in navigator)) return null;

    const scriptUrl = String(opts.scriptUrl || './sw.js');
    const scope = String(opts.scope || './');

    const existing = await navigator.serviceWorker.getRegistration(scope);
    if (existing) return existing;

    return await navigator.serviceWorker.register(scriptUrl, {
      scope,
      updateViaCache: 'none'
    });
  } catch (e) {
    log('SW register failed', e);
    return null;
  }
}

// -----------------------------------------------------------------------------
// MOUNT TIMEOUT SAFETY GUARD
//
// If the main app fails to dispatch the "vmq-app-mounted" event within a
// reasonable time, force the event to fire so the loader overlay can hide.
// Without this fallback, a misconfiguration or network error could leave
// users staring at a loading screen indefinitely. The loader's own timeout is
// separate, but this guard ensures it never waits longer than 6 seconds.
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      if (!window.__VMQ_MOUNTED__) {
        // Use console.warn instead of log() here to ensure visibility even when
        // logging is disabled via VMQ_LOG. This guard should only fire on
        // unexpected conditions.
        console.warn('[VMQ] Mount timeout — forcing loader exit');
        window.dispatchEvent(new Event('vmq-app-mounted'));
      }
    } catch {
      // ignore
    }
  }, 6000);
}