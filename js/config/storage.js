// js/config/storage.js
// ======================================
// VMQ STORAGE v3.0.5 - Enhanced localStorage Wrapper
// ML Analytics Integration • Quota Management • Data Migration
// ======================================

import { VMQ_VERSION } from './constants.js';

// ======================================
// STORAGE KEYS - Unified namespace
// ======================================

export const STORAGE_KEYS = {
  VERSION: 'vmq.version',
  PROFILE: 'vmq.profile',
  SETTINGS: 'vmq.settings',

  XP: 'vmq.xp',
  STREAK: 'vmq.streak',
  ACHIEVEMENTS: 'vmq.achievements',
  DAILY_GOALS: 'vmq.dailyGoals',

  STATS: 'vmq.stats',
  ANALYTICS: 'vmq.analytics',
  PRACTICE_LOG: 'vmq.practiceLog',

  REPERTOIRE: 'vmq.repertoire',
  SPACED_REPETITION: 'vmq.spacedRepetition',
  DIFFICULTY: 'vmq.difficulty',
  CONFUSION_MATRIX: 'vmq.confusionMatrix',
  LEARNING_VELOCITY: 'vmq.learningVelocity',

  JOURNAL: 'vmq.journal',
  COACH_DATA: 'vmq.coachData'
};

// NOTE: Your keys already include "vmq.*" so this becomes "vmq-vmq.*" on disk.
// Keeping as-is to avoid breaking existing stored data.
const NAMESPACE = 'vmq-';

function ns(key) {
  return `${NAMESPACE}${key}`;
}

// ======================================
// SMART DATA PRUNING
// ======================================

function pruneOldData(daysThreshold = 30) {
  try {
    const cutoff = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);

    const log = STORAGE.get(STORAGE_KEYS.PRACTICE_LOG, []);
    const cleanedLog = Array.isArray(log)
      ? log.filter(entry => new Date(entry.timestamp).getTime() > cutoff)
      : [];

    if (cleanedLog.length < (log?.length || 0)) {
      STORAGE.set(STORAGE_KEYS.PRACTICE_LOG, cleanedLog);
      console.log(`[Storage] Pruned practice log: ${log.length} → ${cleanedLog.length}`);
    }

    const analytics = STORAGE.get(STORAGE_KEYS.ANALYTICS, {});
    if (analytics?.events && Array.isArray(analytics.events)) {
      analytics.events = analytics.events.filter(event =>
        new Date(event.timestamp).getTime() > cutoff
      );
      STORAGE.set(STORAGE_KEYS.ANALYTICS, analytics);
      console.log('[Storage] Pruned analytics events');
    }

    return true;
  } catch (error) {
    console.error('[Storage] Prune failed:', error);
    return false;
  }
}

// Exposed for bootstraps/shims
export async function autoPrune(daysThreshold = 30) {
  return pruneOldData(daysThreshold);
}

// ======================================
// STORAGE ENGINE - Core API with Validation
// ======================================

const STORAGE = {
  set(key, data) {
    try {
      if (data === undefined || data === null) {
        STORAGE.remove(key);
        return true;
      }

      const json = JSON.stringify(data);
      localStorage.setItem(ns(key), json);

      if (key === STORAGE_KEYS.PROFILE || key === STORAGE_KEYS.SETTINGS) {
        STORAGE.set(STORAGE_KEYS.VERSION, VMQ_VERSION);
      }

      return true;
    } catch (error) {
      if (error?.name === 'QuotaExceededError') {
        console.error(`[Storage] Quota exceeded for ${key}. Triggering auto-prune.`);
        pruneOldData(30);

        try {
          localStorage.setItem(ns(key), JSON.stringify(data));
          return true;
        } catch (retryError) {
          console.error('[Storage] Retry failed after prune:', retryError);
          return false;
        }
      }

      console.error(`[Storage] Failed to save ${key}:`, error);
      return false;
    }
  },

  get(key, defaultValue = null) {
    try {
      const json = localStorage.getItem(ns(key));
      if (json === null) return defaultValue;
      return JSON.parse(json);
    } catch (error) {
      console.error(`[Storage] Failed to load ${key}:`, error);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(ns(key));
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to remove ${key}:`, error);
      return false;
    }
  },

  clearAll() {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(NAMESPACE)) localStorage.removeItem(k);
      });
      return true;
    } catch (error) {
      console.error('[Storage] Failed to clear:', error);
      return false;
    }
  },

  exportAll() {
    try {
      const data = {};
      Object.keys(localStorage).forEach(k => {
        if (!k.startsWith(NAMESPACE)) return;
        const cleanKey = k.replace(NAMESPACE, '');
        try {
          data[cleanKey] = JSON.parse(localStorage.getItem(k));
        } catch {
          data[cleanKey] = null;
        }
      });

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
    } catch (error) {
      console.error('[Storage] Export failed:', error);
      return null;
    }
  },

  importAll(jsonString) {
    try {
      const importData = JSON.parse(jsonString);
      const data = importData.data || importData;

      Object.entries(data).forEach(([key, value]) => {
        STORAGE.set(key, value);
      });

      return true;
    } catch (error) {
      console.error('[Storage] Import failed:', error);
      return false;
    }
  }
};

// Export the object explicitly (matches your App.js import)
export const storage = STORAGE;

// Convenience helpers (SAFE wrappers; no lost `this`)
export function loadJSON(key, defaultValue = null) {
  return STORAGE.get(key, defaultValue);
}
export function saveJSON(key, data) {
  return STORAGE.set(key, data);
}

// ======================================
// DATA MIGRATION
// ======================================

export function migrateData() {
  try {
    const currentVersion = STORAGE.get(STORAGE_KEYS.VERSION, '0.0.0');

    if (currentVersion === VMQ_VERSION) return;

    if (compareVersions(currentVersion, '3.0.0') < 0) migrateV2toV3();
    if (compareVersions(currentVersion, '3.1.0') < 0) migrateV3toV3_1();

    STORAGE.set(STORAGE_KEYS.VERSION, VMQ_VERSION);
  } catch (error) {
    console.error('[Storage] Migration failed:', error);
  }
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
  try {
    const profile = STORAGE.get(STORAGE_KEYS.PROFILE, {});
    profile.onboardingComplete = profile.onboardingComplete ?? false;
    profile.userSegment = profile.userSegment ?? 'beginner';
    STORAGE.set(STORAGE_KEYS.PROFILE, profile);

    const coachData = STORAGE.get(STORAGE_KEYS.COACH_DATA, {});
    coachData.initialized = true;
    coachData.lastUpdated = Date.now();
    STORAGE.set(STORAGE_KEYS.COACH_DATA, coachData);
  } catch (error) {
    console.error('[Storage] v2→v3 migration failed:', error);
  }
}

function migrateV3toV3_1() {
  try {
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
  } catch (error) {
    console.error('[Storage] v3.0→v3.1 migration failed:', error);
  }
}

// Default export
export default STORAGE;

// Auto-migrate on module load
migrateData();