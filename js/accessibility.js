// js/accessibility.js
// ========================================================
// VMQ ACCESSIBILITY SHIM (compat layer)
// Purpose:
// - Preserve existing imports that expect /js/accessibility.js
// - Re-export the real implementation in /js/utils/accessibility.js
// ========================================================

export * from './utils/accessibility.js';
export { a11y } from './utils/accessibility.js';
