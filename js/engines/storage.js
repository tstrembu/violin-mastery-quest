// js/engines/storage.js
// Compatibility wrapper.
// Some parts of the app import "./js/engines/storage.js" while the actual
// storage module lives under "./js/config/storage.js" in this repo.
//
// This wrapper preserves the existing import path without changing app logic.

export * from '../config/storage.js';

// Optional no-op / best-effort helpers used by shell bootstrap.
export async function autoPrune() {
  try {
    const mod = await import('../config/storage.js');
    if (typeof mod.autoPrune === 'function') return await mod.autoPrune();
  } catch {}
  return false;
}
