// js/config/storage.js
// ======================================
// VMQ STORAGE v3.0.6 - Enhanced localStorage Wrapper (Drop-in)
// ✅ Canonical keying + legacy reads + optional migrate-on-read
// ✅ Quota handling + pruning
// ✅ Data migration (v2→v3, v3.0→v3.1)
// ✅ Stable public API: storage, STORAGE_KEYS, loadJSON/saveJSON,
//    isStorageAvailable, clearAll, exportData, importAll,
//    getStorageEstimate, cleanupOldData, ML helpers
// ======================================

import { VMQ_VERSION } from './version.js';

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

  // NOTE: This key is used by some builds for ML/perf difficulty state.
  // If you want Settings UI overrides separate, add a new key like:
  // DIFFICULTY_OVERRIDES: 'vmq.difficultyOverrides',
  DIFFICULTY: 'vmq.difficulty',

  CONFUSION_MATRIX: 'vmq.confusionMatrix',
  LEARNING_VELOCITY: 'vmq.learningVelocity',

  JOURNAL: 'vmq.journal',
  COACH_DATA: 'vmq.coachData'
};

// NOTE: Keys already include "vmq.*", so on disk we get "vmq-vmq.*".
// Keeping as-is to avoid breaking existing stored data.
const NAMESPACE = 'vmq-';

// ======================================
// KEY CANONICALIZATION + LEGACY SUPPORT
// ======================================

// Canonical on disk: "vmq-" + logicalKey (e.g. "vmq-vmq.profile")
function ns(logicalKey) {
  return `${NAMESPACE}${logicalKey}`;
}

// A minimal, safe legacy set:
// - raw dotted: "vmq.profile"
// - raw underscore: "vmq_profile"
// - namespaced underscore: "vmq-vmq_profile"
// PLUS (optional) older stripped forms if your app ever used them:
// - "profile" or "vmq-profile" variants.
function legacyCandidates(logicalKey) {
  const k = String(logicalKey || '');
  const underscore = k.replace(/\./g, '_');

  const candidates = [
    // raw
    k,
    underscore,

    // namespaced underscore
    ns(underscore)
  ];

  // If key starts with "vmq.", try stripped variants ("profile")
  if (k.startsWith('vmq.')) {
    const stripped = k.slice(4); // "profile"
    const dashed = `vmq-${stripped}`; // "vmq-profile"
    candidates.push(stripped);
    candidates.push(dashed);
    candidates.push(ns(dashed)); // "vmq-vmq-profile"
  }

  return candidates;
}

function keyCandidates(logicalKey) {
  const primary = ns(String(logicalKey || ''));
  const candidates = [primary, ...legacyCandidates(logicalKey)];

  // De-dupe while preserving order
  return [...new Set(candidates.filter(Boolean))];
}

// Optional migrate-on-read: copy legacy -> primary
// If you want legacy truly read-only, set false (we'll still read them).
const MIGRATE_LEGACY_ON_READ = true;

function maybeMigrate(foundKey, logicalKey, rawValue) {
  if (!MIGRATE_LEGACY_ON_READ) return;
  const primary = ns(String(logicalKey || ''));
  if (!foundKey || foundKey === primary) return;

  try {
    if (localStorage.getItem(primary) == null) {
      localStorage.setItem(primary, rawValue);
      // IMPORTANT: leaving legacy keys in place prevents any risk of
      // "new primary exists but legacy is still referenced somewhere".
      // If you want to delete after migration, you can:
      // localStorage.removeItem(foundKey);
    }
  } catch {
    // best-effort only
  }
}

// ======================================
// AVAILABILITY CHECK
// ======================================
export function isStorageAvailable() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const k = '__vmq_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

// ======================================
// SMART DATA PRUNING
// ======================================
function pruneOldData(daysThreshold = 30) {
  try {
    const cutoff = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);

    const log = STORAGE.get(STORAGE_KEYS.PRACTICE_LOG, []);
    const cleanedLog = Array.isArray(log)
      ? log.filter(entry => {
          const t = entry?.timestamp;
          const ms = typeof t === 'number' ? t : new Date(t).getTime();
          return Number.isFinite(ms) && ms > cutoff;
        })
      : [];

    if (Array.isArray(log) && cleanedLog.length < log.length) {
      STORAGE.set(STORAGE_KEYS.PRACTICE_LOG, cleanedLog);
      console.log(`[Storage] Pruned practice log: ${log.length} → ${cleanedLog.length}`);
    }

    const analytics = STORAGE.get(STORAGE_KEYS.ANALYTICS, {});
    if (analytics && typeof analytics === 'object' && Array.isArray(analytics.events)) {
      const before = analytics.events.length;
      analytics.events = analytics.events.filter(event => {
        const t = event?.timestamp;
        const ms = typeof t === 'number' ? t : new Date(t).getTime();
        return Number.isFinite(ms) && ms > cutoff;
      });
      if (analytics.events.length < before) {
        STORAGE.set(STORAGE_KEYS.ANALYTICS, analytics);
        console.log('[Storage] Pruned analytics events');
      }
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
// STORAGE ENGINE - Core API
// ======================================
const STORAGE = {
  set(key, data) {
    try {
      if (!isStorageAvailable()) return false;

      if (data === undefined || data === null) {
        STORAGE.remove(key);
        return true;
      }

      const json = JSON.stringify(data);
      localStorage.setItem(ns(key), json);

      // Version bump when profile/settings written
      if (key === STORAGE_KEYS.PROFILE || key === STORAGE_KEYS.SETTINGS) {
        localStorage.setItem(ns(STORAGE_KEYS.VERSION), JSON.stringify(VMQ_VERSION));
      }

      return true;
    } catch (error) {
      // Quota handling
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
      if (!isStorageAvailable()) return defaultValue;

      let foundKey = null;
      let raw = null;

      for (const k of keyCandidates(key)) {
        raw = localStorage.getItem(k);
        if (raw != null) {
          foundKey = k;
          break;
        }
      }

      if (raw == null) return defaultValue;

      // If read from legacy, optionally migrate forward.
      maybeMigrate(foundKey, key, raw);

      return JSON.parse(raw);
    } catch (error) {
      console.error(`[Storage] Failed to load ${key}:`, error);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      if (!isStorageAvailable()) return false;
      for (const k of keyCandidates(key)) {
        try { localStorage.removeItem(k); } catch {}
      }
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to remove ${key}:`, error);
      return false;
    }
  },

  clearAll() {
    try {
      if (!isStorageAvailable()) return false;

      const primaryPrefix = NAMESPACE; // "vmq-"
      const rawPrefix = 'vmq.';        // raw dotted legacy keys

      // Remove:
      // - all "vmq-" namespaced keys
      // - any raw dotted legacy "vmq.*"
      // - any raw underscore legacy "vmq_*"
      Object.keys(localStorage).forEach(k => {
        const isPrimary = k.startsWith(primaryPrefix);
        const isRawDotted = k.startsWith(rawPrefix);
        const isRawUnderscore = k.startsWith('vmq_');
        if (isPrimary || isRawDotted || isRawUnderscore) {
          localStorage.removeItem(k);
        }
      });

      return true;
    } catch (error) {
      console.error('[Storage] Failed to clear:', error);
      return false;
    }
  },

  exportAll() {
    try {
      if (!isStorageAvailable()) return null;

      const data = {};

      // Export canonical + legacy (so backups capture everything),
      // but store them under their logical key name when possible.
      // Priority: canonical ("vmq-" prefixed) then raw dotted/underscore.
      const seenLogical = new Set();

      // 1) canonical keys
      Object.keys(localStorage).forEach(k => {
        if (!k.startsWith(NAMESPACE)) return;
        const logical = k.slice(NAMESPACE.length);
        seenLogical.add(logical);
        try {
          data[logical] = JSON.parse(localStorage.getItem(k));
        } catch {
          data[logical] = null;
        }
      });

      // 2) raw dotted / underscore legacy that haven't been captured
      Object.keys(localStorage).forEach(k => {
        // raw dotted
        if (k.startsWith('vmq.') && !seenLogical.has(k)) {
          try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = null; }
          seenLogical.add(k);
        }
        // raw underscore -> map to dotted if it looks like "vmq_*"
        if (k.startsWith('vmq_')) {
          const dotted = k.replace(/_/g, '.');
          const logical = dotted.startsWith('vmq.') ? dotted : k;
          if (!seenLogical.has(logical)) {
            try { data[logical] = JSON.parse(localStorage.getItem(k)); } catch { data[logical] = null; }
            seenLogical.add(logical);
          }
        }
      });

      const exportPayload = {
        version: VMQ_VERSION,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        dataSize: JSON.stringify(data).length,
        itemCount: Object.keys(data).length,
        data
      };

      const json = JSON.stringify(exportPayload, null, 2);

      // Browser-only download helpers
      let blob = null;
      let url = null;
      try {
        blob = new Blob([json], { type: 'application/json' });
        url = URL.createObjectURL(blob);
      } catch {
        // ignore (non-browser runtime)
      }

      return { json, url, blob };
    } catch (error) {
      console.error('[Storage] Export failed:', error);
      return null;
    }
  },

  importAll(jsonString) {
    try {
      if (!isStorageAvailable()) return false;

      const importData = JSON.parse(jsonString);
      const data = importData?.data || importData;

      if (!data || typeof data !== 'object') return false;

      Object.entries(data).forEach(([key, value]) => {
        // Important: write to canonical logical keys (dotted),
        // but allow raw keys if caller intentionally provided them.
        // If key is "vmq_profile", convert to "vmq.profile" where safe.
        const logical =
          typeof key === 'string' && key.startsWith('vmq_')
            ? key.replace(/_/g, '.')
            : key;

        STORAGE.set(logical, value);
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
// COMPAT EXPORTS (for older components)
// ======================================
export function clearAll() {
  return STORAGE.clearAll();
}

/**
 * exportData()
 * Back-compat helper: triggers a file download (browser).
 * Returns true on success, false otherwise.
 */
export function exportData(filenamePrefix = 'vmq-backup') {
  try {
    const out = STORAGE.exportAll();
    if (!out?.url || typeof document === 'undefined') return false;

    const a = document.createElement('a');
    a.href = out.url;
    a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    try { URL.revokeObjectURL(out.url); } catch {}
    return true;
  } catch (e) {
    console.error('[Storage] exportData failed:', e);
    return false;
  }
}

// Convenience wrappers expected by Settings/Welcome (safe + non-breaking)
export function loadProfile() {
  return STORAGE.get(STORAGE_KEYS.PROFILE, {
    name: '',
    level: 'beginner',
    goals: [],
    preferredTime: 'flexible',
    practiceMinutes: 20,
    repertoire: 'suzuki1',
    onboardingComplete: false
  });
}

export function saveProfile(profile) {
  return STORAGE.set(STORAGE_KEYS.PROFILE, profile);
}

// XP may be stored as number OR as object; support both.
export function loadXP() {
  const v = STORAGE.get(STORAGE_KEYS.XP, 0);
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && typeof v.xp === 'number') return v.xp;
  return 0;
}

// Your STORAGE_KEYS has no LEVEL key; derive a level from XP if needed.
export function loadLevel() {
  const v = STORAGE.get(STORAGE_KEYS.XP, 0);
  if (v && typeof v === 'object' && typeof v.level === 'number') return v.level;

  const xp = loadXP();
  // Simple stable derivation (100xp per level)
  return Math.max(1, Math.floor(xp / 100) + 1);
}

export function loadStreak() {
  const v = STORAGE.get(STORAGE_KEYS.STREAK, 0);
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

export function loadAchievements() {
  const v = STORAGE.get(STORAGE_KEYS.ACHIEVEMENTS, []);
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object' && Array.isArray(v.unlocked)) return v.unlocked;
  return [];
}

export function loadStats() {
  const s = STORAGE.get(STORAGE_KEYS.STATS, null);
  if (s && typeof s === 'object') return s;

  const a = STORAGE.get(STORAGE_KEYS.ANALYTICS, {});
  return (a && typeof a === 'object') ? a : {};
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
    if (profile && typeof profile === 'object') {
      profile.onboardingComplete = profile.onboardingComplete ?? false;
      profile.userSegment = profile.userSegment ?? 'beginner';
      STORAGE.set(STORAGE_KEYS.PROFILE, profile);
    }

    const coachData = STORAGE.get(STORAGE_KEYS.COACH_DATA, {});
    if (coachData && typeof coachData === 'object') {
      coachData.initialized = true;
      coachData.lastUpdated = Date.now();
      STORAGE.set(STORAGE_KEYS.COACH_DATA, coachData);
    }
  } catch (error) {
    console.error('[Storage] v2→v3 migration failed:', error);
  }
}

function migrateV3toV3_1() {
  try {
    const confusionMatrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
    if (confusionMatrix && typeof confusionMatrix === 'object' && !confusionMatrix.initialized) {
      confusionMatrix.intervalEar = confusionMatrix.intervalEar || {};
      confusionMatrix.keySignatures = confusionMatrix.keySignatures || {};
      confusionMatrix.rhythm = confusionMatrix.rhythm || {};
      confusionMatrix.initialized = Date.now();
      STORAGE.set(STORAGE_KEYS.CONFUSION_MATRIX, confusionMatrix);
    }

    const learningVelocity = STORAGE.get(STORAGE_KEYS.LEARNING_VELOCITY, {});
    if (learningVelocity && typeof learningVelocity === 'object' && !learningVelocity.initialized) {
      learningVelocity.intervals = learningVelocity.intervals || [];
      learningVelocity.keys = learningVelocity.keys || [];
      learningVelocity.rhythm = learningVelocity.rhythm || [];
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

// ======================================
// STORAGE ESTIMATE & QUOTA MANAGEMENT (exported)
// ======================================
export async function getStorageEstimate() {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const percentage = quota ? Math.round((usage / quota) * 100) : 0;
      return {
        usage,
        quota,
        used: usage,
        available: Math.max(0, quota - usage),
        percentage,
        isFull: quota ? usage >= quota * 0.95 : false
      };
    } catch (e) {
      console.warn('[Storage] estimate failed:', e);
    }
  }
  // reasonable fallback
  return {
    usage: 0,
    quota: 5_242_880,
    used: 0,
    available: 5_242_880,
    percentage: 0,
    isFull: false
  };
}

// ======================================
// CLEANUP UTILITIES (exported)
// ======================================
export function cleanupAllData() {
  return STORAGE.clearAll();
}

export function cleanupOldData(days = 90) {
  return pruneOldData(days);
}

// ======================================
// ML TRACKING HELPERS (exported)
// ======================================
export function trackConfusion(module, itemId, guessedId) {
  try {
    const matrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
    if (!matrix[module]) matrix[module] = {};
    if (!matrix[module][itemId]) matrix[module][itemId] = {};
    matrix[module][itemId][guessedId] = (matrix[module][itemId][guessedId] || 0) + 1;
    STORAGE.set(STORAGE_KEYS.CONFUSION_MATRIX, matrix);
    return true;
  } catch (e) {
    console.error('[Storage] trackConfusion failed:', e);
    return false;
  }
}

export function getConfusionData(module) {
  try {
    const matrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
    return matrix?.[module] || {};
  } catch (e) {
    console.error('[Storage] getConfusionData failed:', e);
    return {};
  }
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

    // cap growth
    if (velocity[module].length > 1000) velocity[module] = velocity[module].slice(-1000);

    STORAGE.set(STORAGE_KEYS.LEARNING_VELOCITY, velocity);
    return true;
  } catch (e) {
    console.error('[Storage] trackLearningVelocity failed:', e);
    return false;
  }
}

export function calculateLearningAcceleration(module) {
  try {
    const velocity = STORAGE.get(STORAGE_KEYS.LEARNING_VELOCITY, {});
    const data = velocity?.[module] || [];
    if (data.length < 2) return { acceleration: 0, trend: 'flat', weeklyAvg: [] };

    const byWeek = {};
    for (const entry of data) {
      const w = entry.week;
      if (!byWeek[w]) byWeek[w] = [];
      byWeek[w].push(entry.accuracy);
    }

    const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
    const weeklyAvg = weeks.map(w => ({
      week: w,
      avg: byWeek[w].reduce((a, b) => a + b, 0) / byWeek[w].length
    }));

    const acceleration =
      weeklyAvg.length >= 2 ? (weeklyAvg[weeklyAvg.length - 1].avg - weeklyAvg[0].avg) : 0;

    // NOTE: accuracy is usually 0–1 or 0–100 depending on caller.
    // Keep your prior intent (thresholds at 2) but make it resilient:
    const trend =
      acceleration > 2 ? 'accelerating' :
      acceleration < -2 ? 'declining' :
      'flat';

    return { acceleration, trend, weeklyAvg };
  } catch (e) {
    console.error('[Storage] calculateLearningAcceleration failed:', e);
    return { acceleration: 0, trend: 'error', weeklyAvg: [] };
  }
}
