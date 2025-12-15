// js/utils/keyboard.js
// ======================================
// VMQ KEYBOARD v2.1 (Consolidated A11y)
// Uses the single a11y system from accessibility.js
// Fixes getShortcuts(): stores key labels explicitly
// ======================================

import { sessionTracker } from '../engines/sessionTracker.js';
import { a11y } from './accessibility.js';

// ======================================
// KEYBOARD MANAGER - VMQ Shortcuts
// ======================================
class KeyboardManager {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this._initialized = false;
    this.init();
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    document.addEventListener('keydown', (e) => this.handleKey(e), { passive: false });
    window.addEventListener('load', () => this.registerVMQShortcuts(), { once: true });
  }

  // VMQ Module Shortcuts (Ctrl+1-9)
  registerVMQShortcuts() {
    const MODULES = {
      '1': 'intervals',
      '2': 'keys',
      '3': 'rhythm',
      '4': 'bieler',
      '5': 'dashboard',
      '6': 'analytics',
      '7': 'settings',
      '8': 'welcome',
      '9': 'menu'
    };

    Object.entries(MODULES).forEach(([key, route]) => {
      this.register(`ctrl+${key}`, () => (window.location.hash = `#${route}`), `${route} module`);
    });

    // Global VMQ shortcuts
    this.register('escape', () => this.handleEscape(), 'Back/Close');
    this.register('space', () => this.handleSpace(), 'Play/Pause/Submit');
    this.register('enter', () => this.handleEnter(), 'Submit Answer');
    this.register('n', () => this.handleNext(), 'Next Question');
    this.register('r', () => this.handleRepeat(), 'Repeat Audio');
    this.register('m', () => this.handleMute(), 'Toggle Mute');
    this.register('?', () => this.showHelp(), 'Keyboard Help');
    this.register('ctrl+shift+r', () => this.resetModule(), 'Reset Current');
  }

  handleKey(event) {
    if (!this.enabled || this.isInput(event.target)) return;

    const key = this.getKey(event);
    const shortcut = this.shortcuts.get(key);

    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();

      try {
        shortcut.callback(event);
      } finally {
        // Always announce after action (single a11y system)
        if (shortcut.description) a11y.announce(shortcut.description, 'polite');
      }
    }
  }

  // Normalize key combos into canonical form like "ctrl+shift+r"
  getKey(event) {
    const mods = [];
    if (event.ctrlKey) mods.push('ctrl');
    if (event.altKey) mods.push('alt');
    if (event.shiftKey) mods.push('shift');
    if (event.metaKey) mods.push('meta');

    let k = (event.key || '').toLowerCase();

    // Normalize common keys
    if (k === ' ') k = 'space';
    if (k === 'escape') k = 'escape';

    // Normalize "?" which can arrive as "/" + shift on many keyboards
    if (k === '/' && event.shiftKey) k = '?';

    mods.push(k);
    return mods.join('+');
  }

  isInput(target) {
    if (!target) return false;
    return (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable ||
      target.getAttribute?.('role') === 'textbox'
    );
  }

  // ----------------------------
  // Global handlers
  // ----------------------------
  handleEscape() {
    if (window.location.hash.includes('?')) window.location.hash = window.location.hash.split('?')[0];
    else window.location.hash = '#menu';
  }

  handleSpace() {
    const playBtn = document.querySelector('[data-action="play"], .play-btn');
    if (playBtn?.click) return playBtn.click();

    const submit = document.querySelector('button[data-action="submit"], .submit-btn');
    if (submit?.click) return submit.click();

    // As a last resort, click the first visible button
    const firstBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.offsetParent !== null
    );
    firstBtn?.click?.();
  }

  handleEnter() {
    document.querySelector('button[data-action="submit"], .submit-btn')?.click?.();
  }

  handleNext() {
    document.querySelector('[data-action="next"], .next-btn')?.click?.();
  }

  handleRepeat() {
    document.querySelector('[data-action="repeat"], .repeat-btn')?.click?.();
  }

  handleMute() {
    const audio = document.querySelector('audio');
    if (!audio) return a11y.announce('No audio element found', 'polite');
    audio.muted = !audio.muted;
    a11y.announce(audio.muted ? 'Muted' : 'Unmuted', 'polite');
  }

  resetModule() {
    if (!confirm('Reset current module progress?')) return;

    try {
      sessionTracker.forceEnd?.('reset');
    } catch (_) {
      // ignore
    }
    window.location.reload();
  }

  showHelp() {
    showKeyboardHelp();
  }

  // ----------------------------
  // API
  // ----------------------------
  register(keyCombo, callback, desc = '') {
    const normalized = String(keyCombo || '').toLowerCase();
    this.shortcuts.set(normalized, {
      key: normalized,            // ✅ store key for getShortcuts()
      callback,
      description: desc
    });
  }

  toggle(enabled) {
    this.enabled = !!enabled;
  }

  getShortcuts() {
    // ✅ previously tried to read s.key even though it never existed
    return Array.from(this.shortcuts.values())
      .map((s) => ({ key: s.key, desc: s.description }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }
}

// Singleton
export const keyboard = new KeyboardManager();

// ======================================
// KEYBOARD HELP MODAL
// ======================================
export function showKeyboardHelp() {
  const shortcuts = keyboard.getShortcuts();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal card" role="dialog" aria-labelledby="kbd-title" aria-modal="true">
      <h2 id="kbd-title">⌨️ VMQ Keyboard Shortcuts</h2>
      <div class="shortcuts-grid">
        ${shortcuts
          .map(
            (s) =>
              `<div><kbd>${escapeHtml(prettyKey(s.key))}</kbd> ${escapeHtml(s.desc || '')}</div>`
          )
          .join('')}
      </div>
      <button class="btn btn-primary">Close</button>
    </div>
  `;

  document.body.appendChild(modal);

  const cleanupTrap = a11y.trapFocus(modal);
  a11y.announce('Keyboard help opened', 'polite');

  const close = () => {
    cleanupTrap?.();
    modal.remove();
    a11y.announce('Keyboard help closed', 'polite');
  };

  modal.querySelector('button')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // ESC closes help
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);

  // focus close button
  modal.querySelector('button')?.focus?.();
}

// --------------------------------------
// Small helpers
// --------------------------------------
function prettyKey(k) {
  return String(k)
    .replaceAll('ctrl', 'Ctrl')
    .replaceAll('shift', 'Shift')
    .replaceAll('alt', 'Alt')
    .replaceAll('meta', 'Meta')
    .replaceAll('space', 'Space')
    .split('+')
    .map((part) => (part.length === 1 ? part.toUpperCase() : part))
    .join('+');
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
