// js/engines/storage.js
// ======================================
// VMQ STORAGE COMPATIBLE WRAPPER
// Keeps legacy imports working:
//   import { loadJSON } from "./js/engines/storage.js"
// while the real module lives in:
//   "./js/config/storage.js"
// ======================================

import STORAGE_DEFAULT, {
  STORAGE_KEYS,
  loadJSON,
  saveJSON,
  getStorageEstimate,
  migrateData,
  cleanupAllData,
  cleanupOldData,
  trackConfusion,
  getConfusionData,
  trackLearningVelocity,
  calculateLearningAcceleration
} from '../config/storage.js';

// Some parts of the codebase expect a named `storage` export.
export const storage = STORAGE_DEFAULT;

// Re-export the core API exactly as expected.
export {
  STORAGE_KEYS,
  loadJSON,
  saveJSON,
  getStorageEstimate,
  migrateData,
  cleanupAllData,
  cleanupOldData,
  trackConfusion,
  getConfusionData,
  trackLearningVelocity,
  calculateLearningAcceleration
};

// Default export for older patterns: `import storage from ...`
export default STORAGE_DEFAULT;

// Optional helper used by shell/bootstrap when quota is tight.
// Best-effort: prune older data and return whether we did anything.
export async function autoPrune(days = 30) {
  try {
    // Your config exposes cleanupOldData(days), which prunes practice log.
    // We can also check quota and only prune when it matters.
    const est = await getStorageEstimate();
    const shouldPrune = est?.percentage >= 80 || est?.isFull;

    if (shouldPrune) {
      return cleanupOldData(days);
    }
    return false;
  } catch {
    // Fail silently; this is only a best-effort helper.
    return false;
  }
}