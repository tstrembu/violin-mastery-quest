// js/utils/accessibility.js
// ========================================================
// VMQ ACCESSIBILITY - ARIA Labels & WCAG Support
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
  // Simplified - in production, use a proper contrast calculator
  const fgLum = getLuminance(fg);
  const bgLum = getLuminance(bg);
  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
  return ratio >= 4.5;
}

function getLuminance(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Announce to screen readers
 */
export function announce(message, priority = 'polite') {
  const announcer = document.createElement('div');
  announcer.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  announcer.setAttribute('aria-live', priority);
  announcer.setAttribute('aria-atomic', 'true');
  announcer.style.position = 'absolute';
  announcer.style.left = '-10000px';
  announcer.textContent = message;
  
  document.body.appendChild(announcer);
  setTimeout(() => document.body.removeChild(announcer), 1000);
}
