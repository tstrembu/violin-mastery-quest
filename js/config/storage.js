// ======================================
// VMQ STORAGE v3.0.5 - Enhanced localStorage Wrapper
// ML Analytics Integration • Quota Management • Data Migration
// ======================================

import { VMQ_VERSION } from './constants.js';

// ======================================
// STORAGE KEYS - Unified namespace
// NOTE: keys already include "vmq." so we do NOT add another prefix.
// ======================================

export const STORAGE_KEYS = {
  // Core app data
  VERSION: 'vmq.version',
  PROFILE: 'vmq.profile',
  SETTINGS: 'vmq.settings',

  // Gamification
  XP: 'vmq.xp',
  STREAK: 'vmq.streak',
  ACHIEVEMENTS: 'vmq.achievements',
  DAILY_GOALS: 'vmq.dailyGoals',

  // Analytics & Stats
  STATS: 'vmq.stats',
  ANALYTICS: 'vmq.analytics',
  PRACTICE_LOG: 'vmq.practiceLog',

  // Training Data (ML)
  REPERTOIRE: 'vmq.repertoire',
  SPACED_REPETITION: 'vmq.spacedRepetition',
  DIFFICULTY: 'vmq.difficulty',
  CONFUSION_MATRIX: 'vmq.confusionMatrix',
  LEARNING_VELOCITY: 'vmq.learningVelocity',

  // Journal & Coach
  JOURNAL: 'vmq.journal',
  COACH_DATA: 'vmq.coachData'
};

// Going forward: no extra namespace (keys already have "vmq.")
const NAMESPACE = '';
// Backward-compat: your old code used "vmq-" and produced keys like "vmq-vmq.profile"
const LEGACY_NAMESPACE = 'vmq-';

// --------------------------------------
// Environment guards
// --------------------------------------
function hasLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const k = `__vmq_test_${Date.now()}`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function nsKey(key) {
  return `${NAMESPACE}${key}`;
}

function legacyKey(key) {
  return `${LEGACY_NAMESPACE}${key}`;
}

// ======================================
// STORAGE ENGINE - Core API with Validation
// ======================================

const STORAGE = {
  /**
   * Set data with JSON serialization & auto-versioning
   * @param {string} key - Storage key from STORAGE_KEYS or raw string
   * @param {*} data - Data to store
   * @returns {boolean} Success status
   */
  set(key, data) {
    if (!hasLocalStorage()) return false;

    try {
      if (data === undefined || data === null) {
        return this.remove(key);
      }

      const json = JSON.stringify(data);
      localStorage.setItem(nsKey(key), json);

      // Auto-write version when saving profile/settings
      if (key === STORAGE_KEYS.PROFILE || key === STORAGE_KEYS.SETTINGS) {
        localStorage.setItem(nsKey(STORAGE_KEYS.VERSION), JSON.stringify(VMQ_VERSION));
      }

      return true;
    } catch (error) {
      if (error && error.name === 'QuotaExceededError') {
        // Best-effort prune then retry once
        pruneOldData(30);
        try {
          localStorage.setItem(nsKey(key), JSON.stringify(data));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  },

  /**
   * Get data with safe JSON parsing + legacy fallback
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  get(key, defaultValue = null) {
    if (!hasLocalStorage()) return defaultValue;

    try {
      // 1) New key
      const json = localStorage.getItem(nsKey(key));
      if (json !== null) return JSON.parse(json);

      // 2) Legacy key fallback (vmq- + vmq.* => vmq-vmq.*)
      const legacyJson = localStorage.getItem(legacyKey(key));
      if (legacyJson !== null) {
        const val = JSON.parse(legacyJson);
        // Migrate forward transparently
        try {
          localStorage.setItem(nsKey(key), legacyJson);
          localStorage.removeItem(legacyKey(key));
        } catch {}
        return val;
      }

      return defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Remove specific key (also removes legacy key)
   */
  remove(key) {
    if (!hasLocalStorage()) return false;

    try {
      localStorage.removeItem(nsKey(key));
      localStorage.removeItem(legacyKey(key));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Clear all VMQ data (new + legacy)
   */
  clearAll() {
    if (!hasLocalStorage()) return false;

    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith('vmq.') || k.startsWith('vmq-vmq.') || k.startsWith(LEGACY_NAMESPACE)) {
          localStorage.removeItem(k);
        }
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Export all VMQ data for backup
   * @returns {object|null} { json, url, blob }
   */
  exportAll() {
    try {
      if (!hasLocalStorage()) return null;

      const data = {};
      for (const k of Object.keys(localStorage)) {
        // include current keys and legacy keys
        if (k.startsWith('vmq.') || k.startsWith('vmq-vmq.') || k.startsWith(LEGACY_NAMESPACE)) {
          const cleanKey = k.startsWith(LEGACY_NAMESPACE) ? k.slice(LEGACY_NAMESPACE.length) : k;
          try {
            data[cleanKey] = JSON.parse(localStorage.getItem(k));
          } catch {
            data[cleanKey] = localStorage.getItem(k);
          }
        }
      }

      const exportData = {
        version: VMQ_VERSION,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        dataSize: JSON.stringify(data).length,
        itemCount: Object.keys(data).length,
        data
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      return { json, url, blob };
    } catch {
      return null;
    }
  },

  /**
   * Import data from JSON string
   * @param {string} jsonString
   * @returns {boolean}
   */
  importAll(jsonString) {
    if (!hasLocalStorage()) return false;

    try {
      const importData = JSON.parse(jsonString);
      const data = importData.data || importData;

      for (const [key, value] of Object.entries(data)) {
        STORAGE.set(key, value);
      }
      return true;
    } catch {
      return false;
    }
  }
};

// ======================================
// STORAGE ESTIMATE & QUOTA MANAGEMENT
// ======================================

export async function getStorageEstimate() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        usage,
        quota,
        used: usage,
        available: Math.max(0, quota - usage),
        percentage: quota ? Math.round((usage / quota) * 100) : 0,
        isFull: quota ? usage >= quota * 0.95 : false
      };
    }
  } catch {}

  return {
    usage: 0,
    quota: 5242880,
    used: 0,
    available: 5242880,
    percentage: 0,
    isFull: false
  };
}

// ======================================
// SMART DATA PRUNING
// ======================================

function pruneOldData(daysThreshold = 30) {
  try {
    const cutoff = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);

    // Practice log
    const log = STORAGE.get(STORAGE_KEYS.PRACTICE_LOG, []);
    const cleanedLog = Array.isArray(log)
      ? log.filter(entry => new Date(entry.timestamp).getTime() > cutoff)
      : [];

    if (Array.isArray(log) && cleanedLog.length < log.length) {
      STORAGE.set(STORAGE_KEYS.PRACTICE_LOG, cleanedLog);
    }

    // Analytics events
    const analytics = STORAGE.get(STORAGE_KEYS.ANALYTICS, {});
    if (analytics && Array.isArray(analytics.events)) {
      analytics.events = analytics.events.filter(ev => new Date(ev.timestamp).getTime() > cutoff);
      STORAGE.set(STORAGE_KEYS.ANALYTICS, analytics);
    }

    return true;
  } catch {
    return false;
  }
}

// Exported for shell/bootstrap calls
export async function autoPrune(days = 30) {
  return pruneOldData(days);
}

// ======================================
// DATA MIGRATION
// ======================================

export function migrateData() {
  // Only run in browser contexts
  if (typeof window === 'undefined' || !hasLocalStorage()) return;

  try {
    const currentVersion = STORAGE.get(STORAGE_KEYS.VERSION, '0.0.0');
    if (currentVersion === VMQ_VERSION) return;

    // v2.x → v3.0
    if (compareVersions(currentVersion, '3.0.0') < 0) migrateV2toV3();
    // v3.0 → v3.1
    if (compareVersions(currentVersion, '3.1.0') < 0) migrateV3toV3_1();

    STORAGE.set(STORAGE_KEYS.VERSION, VMQ_VERSION);
  } catch {}
}

function compareVersions(v1, v2) {
  const p1 = (v1 || '0.0.0').split('.').map(Number);
  const p2 = (v2 || '0.0.0').split('.').map(Number);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

function migrateV2toV3() {
  const profile = STORAGE.get(STORAGE_KEYS.PROFILE, {});
  profile.onboardingComplete = profile.onboardingComplete ?? false;
  profile.userSegment = profile.userSegment ?? 'beginner';
  STORAGE.set(STORAGE_KEYS.PROFILE, profile);

  const coachData = STORAGE.get(STORAGE_KEYS.COACH_DATA, {});
  coachData.initialized = true;
  coachData.lastUpdated = Date.now();
  STORAGE.set(STORAGE_KEYS.COACH_DATA, coachData);
}

function migrateV3toV3_1() {
  const confusionMatrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
  if (!confusionMatrix.initialized) {
    confusionMatrix.intervalEar = {};
    confusionMatrix.keySignatures = {};
    confusionMatrix.rhythm = {};
    confusionMatrix.initialized = Date.now();
    STORAGE.set(STORAGE_KEYS.CONFUSION_MATRIX, confusionMatrix);
  }

  const learningVelocity = STORAGE.get(STORAGE_KEYS.LEARNING_VELOCITY, {});
  if (!learningVelocity.initialized) {
    learningVelocity.intervals = [];
    learningVelocity.keys = [];
    learningVelocity.rhythm = [];
    learningVelocity.initialized = Date.now();
    STORAGE.set(STORAGE_KEYS.LEARNING_VELOCITY, learningVelocity);
  }
}

// ======================================
// CLEANUP UTILITIES
// ======================================

export function cleanupAllData() {
  return STORAGE.clearAll();
}

export function cleanupOldData(days = 90) {
  return pruneOldData(days);
}

export function trackConfusion(module, itemId, guessedId) {
  try {
    const matrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
    if (!matrix[module]) matrix[module] = {};
    if (!matrix[module][itemId]) matrix[module][itemId] = {};

    matrix[module][itemId][guessedId] = (matrix[module][itemId][guessedId] || 0) + 1;
    STORAGE.set(STORAGE_KEYS.CONFUSION_MATRIX, matrix);
    return true;
  } catch {
    return false;
  }
}

export function getConfusionData(module) {
  const matrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
  return matrix[module] || {};
}

export function trackLearningVelocity(module, accuracy, timeMs) {
  try {
    const velocity = STORAGE.get(STORAGE_KEYS.LEARNING_VELOCITY, {});
    if (!velocity[module]) velocity[module] = [];

    velocity[module].push({
      timestamp: Date.now(),
      accuracy,
      timeMs,
      week: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
    });

    if (velocity[module].length > 1000) velocity[module] = velocity[module].slice(-1000);
    STORAGE.set(STORAGE_KEYS.LEARNING_VELOCITY, velocity);
    return true;
  } catch {
    return false;
  }
}

export function calculateLearningAcceleration(module) {
  try {
    const velocity = STORAGE.get(STORAGE_KEYS.LEARNING_VELOCITY, {});
    const data = velocity[module] || [];
    if (data.length < 2) return { acceleration: 0, trend: 'flat', weeklyAvg: [] };

    const byWeek = {};
    data.forEach(entry => {
      if (!byWeek[entry.week]) byWeek[entry.week] = [];
      byWeek[entry.week].push(entry.accuracy);
    });

    const weeks = Object.keys(byWeek).sort((a, b) => Number(a) - Number(b));
    const weeklyAvgs = weeks.map(w => ({
      week: Number(w),
      avg: byWeek[w].reduce((a, b) => a + b, 0) / byWeek[w].length
    }));

    const acceleration = weeklyAvgs.length >= 2
      ? weeklyAvgs[weeklyAvgs.length - 1].avg - weeklyAvgs[0].avg
      : 0;

    const trend = acceleration > 2 ? 'accelerating' : acceleration < -2 ? 'declining' : 'flat';
    return { acceleration, trend, weeklyAvg: weeklyAvgs };
  } catch {
    return { acceleration: 0, trend: 'error', weeklyAvg: [] };
  }
}

// Backward compatible convenience names
export const loadJSON = STORAGE.get.bind(STORAGE);
export const saveJSON = STORAGE.set.bind(STORAGE);

export default STORAGE;

// Auto-migrate on module load (browser only)
migrateData();