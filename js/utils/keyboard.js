// js/util/
// ======================================
// VMQ KEYBOARD + ACCESSIBILITY v2.0
// Powers 50+ modules + Screen Readers
// ======================================

import { sessionTracker } from '../engines/sessionTracker.js';
import { a11y } from './accessibility.js'; // Cross-import

// ======================================
// KEYBOARD MANAGER - 25+ VMQ Shortcuts
// ======================================
class KeyboardManager {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => this.handleKey(e), { passive: false });
    window.addEventListener('load', () => this.registerVMQShortcuts());
  }

  // VMQ Module Shortcuts (Ctrl+1-9)
  registerVMQShortcuts() {
    const MODULES = {
      '1': 'intervals', '2': 'keys', '3': 'rhythm', '4': 'bieler',
      '5': 'dashboard', '6': 'analytics', '7': 'settings', '8': 'welcome', '9': 'menu'
    };

    Object.entries(MODULES).forEach(([key, route]) => {
      this.register(`ctrl+${key}`, () => window.location.hash = `#${route}`, `${route} module`);
    });

    // Global VMQ shortcuts
    this.register('escape', this.handleEscape, 'Back/Close');
    this.register('space', this.handleSpace, 'Play/Pause/Submit');
    this.register('enter', this.handleEnter, 'Submit Answer');
    this.register('n', this.handleNext, 'Next Question');
    this.register('r', this.handleRepeat, 'Repeat Audio');
    this.register('m', this.handleMute, 'Toggle Mute');
    this.register('?', this.showHelp, 'Keyboard Help');
    this.register('ctrl+shift+r', this.resetModule, 'Reset Current');
  }

  handleKey(event) {
    if (!this.enabled || this.isInput(event.target)) return;

    const key = this.getKey(event);
    const shortcut = this.shortcuts.get(key);
    
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      shortcut.callback(event);
      a11y.announce(shortcut.description); // A11y feedback
    }
  }

  getKey(event) {
    const mods = [];
    if (event.ctrlKey) mods.push('ctrl');
    if (event.altKey) mods.push('alt'); 
    if (event.shiftKey) mods.push('shift');
    if (event.metaKey) mods.push('meta');
    mods.push(event.key.toLowerCase());
    return mods.join('+');
  }

  isInput(target) {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || 
           target.isContentEditable || target.getAttribute('role') === 'textbox';
  }

  // VMQ Global Handlers
  handleEscape() { 
    if (window.location.hash.includes('?')) window.location.hash = window.location.hash.split('?')[0];
    else window.location.hash = '#menu';
  }

  handleSpace() {
    const playBtn = document.querySelector('[data-action="play"], .play-btn, audio');
    playBtn?.click() || document.querySelector('button')?.click();
  }

  handleEnter() { document.querySelector('button[data-action="submit"], .submit-btn')?.click(); }

  handleNext() { document.querySelector('[data-action="next"], .next-btn')?.click(); }

  handleRepeat() { document.querySelector('[data-action="repeat"], .repeat-btn')?.click(); }

  handleMute() { 
    const audio = document.querySelector('audio');
    audio.muted = !audio.muted;
    a11y.announce(audio.muted ? 'Muted' : 'Unmuted');
  }

  resetModule() {
    if (confirm('Reset current module progress?')) {
      sessionTracker.forceEnd('reset');
      window.location.reload();
    }
  }

  showHelp() { showKeyboardHelp(); }

  register(key, callback, desc = '') {
    this.shortcuts.set(key.toLowerCase(), { callback, description: desc });
  }

  toggle(enabled) { this.enabled = enabled; }

  getShortcuts() {
    return Array.from(this.shortcuts.values()).map(s => ({
      key: s.key || s.description.split(' ')[0],
      desc: s.description
    }));
  }
}

// ======================================
// ACCESSIBILITY MANAGER - WCAG 2.2 AA
// ======================================
class AccessibilityManager {
  constructor() {
    this.announcer = null;
    this.init();
  }

  init() {
    // Live region
    this.announcer = document.createElement('div');
    this.announcer.id = 'vmq-announcer';
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only';
    document.body.appendChild(this.announcer);

    // Skip links
    this.addSkipLinks();

    // Media queries
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  announce(msg, priority = 'polite') {
    if (!this.announcer) return;
    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = msg;
  }

  // VMQ Announcements
  announceNavigation(hash) {
    const page = hash.split('/')[0].replace('#', '') || 'home';
    this.announce(`Now on ${page.replace(/([A-Z])/g, ' $1')}`);
  }

  announceAnswer(correct, module, score) {
    const msg = correct 
      ? `Correct! Score: ${score}`
      : `Try again. Keep practicing ${module}`;
    this.announce(msg, 'assertive');
  }

  announceAchievement(name) {
    this.announce(`🎉 Achievement: ${name}!`, 'assertive');
  }

  announceProgress(current, total) {
    this.announce(`${current}/${total} (${Math.round(current/total*100)}%)`, 'polite');
  }

  // Focus Management
  setFocus(element, announce = '') {
    if (!element?.focus) return;
    element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
    if (announce) this.announce(announce);
  }

  trapFocus(modal) {
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0], last = focusable[focusable.length - 1];
    
    const onKeydown = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    modal.addEventListener('keydown', onKeydown);
    first.focus();
    return () => modal.removeEventListener('keydown', onKeydown);
  }

  // VMQ Components
  enhanceButton(btn, action, label) {
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', label);
    if (action) btn.dataset.action = action;
  }

  createProgressBar(current, total, label = '') {
    const bar = document.createElement('div');
    bar.role = 'progressbar';
    bar.setAttribute('aria-valuenow', current);
    bar.setAttribute('aria-valuemin', 0);
    bar.setAttribute('aria-valuemax', total);
    bar.setAttribute('aria-label', label || 'Progress');
    bar.className = 'progress-bar';
    
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${(current/total)*100}%`;
    bar.appendChild(fill);
    
    return bar;
  }

  addSkipLinks() {
    const skip = document.createElement('a');
    skip.href = '#main';
    skip.className = 'skip-link sr-only sr-only-focusable';
    skip.textContent = 'Skip to main content';
    document.body.prepend(skip);
  }
}

// ======================================
// GLOBAL INSTANCES + HELPERS
// ======================================
export const keyboard = new KeyboardManager();
export const a11y = new AccessibilityManager();

// Auto-init on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    keyboard.registerVMQShortcuts();
    a11y.announce('Violin Mastery Quest loaded');
  });

  // Hash change announcements
  window.addEventListener('hashchange', () => {
    a11y.announceNavigation(window.location.hash);
  });
}

// ======================================
// KEYBOARD HELP MODAL
// ======================================
export function showKeyboardHelp() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal card" role="dialog" aria-labelledby="kbd-title">
      <h2 id="kbd-title">⌨️ VMQ Keyboard Shortcuts</h2>
      <div class="shortcuts-grid">
        <div><kbd>ESC</kbd> Back/Close</div>
        <div><kbd>Space</kbd> Play/Submit</div>
        <div><kbd>Enter</kbd> Submit</div>
        <div><kbd>N</kbd> Next</div>
        <div><kbd>R</kbd> Repeat</div>
        <div><kbd>M</kbd> Mute</div>
        ${Object.entries({1:'Intervals',2:'Keys',3:'Rhythm',4:'Bieler'}).map(([k,v]) => 
          `<div><kbd>Ctrl+${k}</kbd> ${v}</div>`).join('')}
        <div><kbd>?</kbd> Help</div>
      </div>
      <button class="btn btn-primary" autofocus>Close</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  a11y.trapFocus(modal);
  modal.querySelector('button').focus();
  
  modal.querySelector('button').onclick = () => modal.remove();
  modal.onclick = (e) => e.target === modal && modal.remove();
}

// ======================================
// MEDIA QUERY HELPERS
// ======================================
export function prefersReducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersDarkMode() {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}