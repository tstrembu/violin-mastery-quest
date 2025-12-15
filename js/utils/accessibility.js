// js/utils/accessibility.js
// ========================================================
// VMQ ACCESSIBILITY - Single Source of Truth (WCAG-friendly)
// Announcements + Focus mgmt + ARIA helpers + Contrast utils
// ========================================================

/**
 * Generate ARIA label for interval buttons
 */
export function getIntervalAriaLabel(interval) {
  return `${interval.label}, ${interval.example}`;
}

/**
 * Generate ARIA label for mode cards
 */
export function getModeAriaLabel(mode, description) {
  return `${mode} practice mode. ${description}`;
}

/**
 * Check color contrast ratio (simplified)
 * @param {string} fg - Foreground color (hex)
 * @param {string} bg - Background color (hex)
 * @returns {boolean} True if contrast meets WCAG AA (4.5:1)
 */
export function meetsContrastRequirement(fg, bg) {
  const fgLum = getLuminance(fg);
  const bgLum = getLuminance(bg);
  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
  return ratio >= 4.5;
}

function getLuminance(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return 0;
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ========================================================
// Accessibility Manager (singleton)
// ========================================================
class AccessibilityManager {
  constructor() {
    this.announcer = null;
    this._initialized = false;
    this.reducedMotion = false;
    this.darkMode = false;

    // avoid duplicate skip links / live regions if imported twice
    this._skipLinksAdded = false;

    if (typeof window !== 'undefined') {
      this._initWhenReady();
    }
  }

  _initWhenReady() {
    if (document?.body) {
      this.init();
      return;
    }
    window.addEventListener('DOMContentLoaded', () => this.init(), { once: true });
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Live region: reuse if already exists
    const existing = document.getElementById('vmq-announcer');
    if (existing) {
      this.announcer = existing;
    } else {
      this.announcer = document.createElement('div');
      this.announcer.id = 'vmq-announcer';
      this.announcer.setAttribute('role', 'status');
      this.announcer.setAttribute('aria-live', 'polite');
      this.announcer.setAttribute('aria-atomic', 'true');
      this.announcer.className = 'sr-only';
      document.body.appendChild(this.announcer);
    }

    this.addSkipLinks();

    // Media preferences
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.darkMode = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;

    // Auto navigation announcements (safe, single instance)
    window.addEventListener('hashchange', () => {
      this.announceNavigation(window.location.hash);
    });

    // Initial ping (optional but helpful)
    this.announce('Violin Mastery Quest loaded');
  }

  // ----------------------------
  // Announcements
  // ----------------------------
  announce(message, priority = 'polite') {
    if (!message) return;
    if (!this.announcer) this.init();
    if (!this.announcer) return;

    const live = priority === 'assertive' ? 'assertive' : 'polite';
    this.announcer.setAttribute('aria-live', live);
    this.announcer.setAttribute('role', live === 'assertive' ? 'alert' : 'status');

    // Ensure re-announce even for repeated text
    this.announcer.textContent = '';
    // Next tick so SR detects change
    setTimeout(() => {
      if (this.announcer) this.announcer.textContent = String(message);
    }, 10);
  }

  announceNavigation(hash) {
    const page = (hash || '#home').split('?')[0].replace('#', '') || 'home';
    const pretty = page.replace(/[-_]/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    this.announce(`Now on ${pretty}`, 'polite');
  }

  announceAnswer(correct, module, score) {
    const msg = correct
      ? `Correct! Score: ${score}`
      : `Try again. Keep practicing ${module}`;
    this.announce(msg, 'assertive');
  }

  announceAchievement(name) {
    this.announce(`Achievement: ${name}!`, 'assertive');
  }

  announceProgress(current, total) {
    if (!total) return;
    this.announce(`${current}/${total} (${Math.round((current / total) * 100)}%)`, 'polite');
  }

  // ----------------------------
  // Focus management
  // ----------------------------
  setFocus(element, announcement = '') {
    if (!element?.focus) return;
    element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
    if (announcement) this.announce(announcement, 'polite');
  }

  trapFocus(container) {
    if (!container?.querySelectorAll) return () => {};

    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return () => {};

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const onKeydown = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeydown);
    // focus first usable element
    first.focus?.();

    return () => container.removeEventListener('keydown', onKeydown);
  }

  // ----------------------------
  // UI helpers
  // ----------------------------
  enhanceButton(btn, action, label) {
    if (!btn) return;
    btn.setAttribute('role', 'button');
    if (label) btn.setAttribute('aria-label', label);
    if (action) btn.dataset.action = action;
  }

  createProgressBar(current, total, label = 'Progress') {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuenow', String(current));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-label', label);
    bar.className = 'progress-bar';

    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${total ? (current / total) * 100 : 0}%`;

    bar.appendChild(fill);
    return bar;
  }

  addSkipLinks() {
    if (this._skipLinksAdded) return;
    this._skipLinksAdded = true;

    // If already present, don't duplicate
    if (document.querySelector('.skip-link')) return;

    const skip = document.createElement('a');
    skip.href = '#main';
    skip.className = 'skip-link sr-only sr-only-focusable';
    skip.textContent = 'Skip to main content';
    document.body.prepend(skip);
  }

  prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }

  prefersDarkMode() {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  }
}

// Singleton export used everywhere (no competing announcers)
export const a11y = new AccessibilityManager();

/**
 * Backward-compatible functional export (existing imports keep working)
 */
export function announce(message, priority = 'polite') {
  a11y.announce(message, priority);
}

export function prefersReducedMotion() {
  return a11y.prefersReducedMotion();
}

export function prefersDarkMode() {
  return a11y.prefersDarkMode();
}
