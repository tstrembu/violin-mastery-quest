// ======================================
// VMQ STORAGE v3.0.5 - Enhanced localStorage Wrapper
// ML Analytics Integration • Quota Management • Data Migration
// ======================================

import { VMQ_VERSION } from './constants.js';

// ======================================
// STORAGE KEYS - Unified namespace
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
  CONFUSION_MATRIX: 'vmq.confusionMatrix', // NEW: for ML error tracking
  LEARNING_VELOCITY: 'vmq.learningVelocity', // NEW: for adaptive pacing
  
  // Journal & Coach
  JOURNAL: 'vmq.journal',
  COACH_DATA: 'vmq.coachData'
};

// VMQ Storage Namespace Prefix
const NAMESPACE = 'vmq-';

// ======================================
// STORAGE ENGINE - Core API with Validation
// ======================================

const STORAGE = {
  /**
   * Set data with JSON serialization & auto-versioning
   * @param {string} key - Storage key from STORAGE_KEYS
   * @param {*} data - Data to store
   * @returns {boolean} Success status
   */
  set(key, data) {
    try {
      if (data === undefined || data === null) {
        this.remove(key);
        return;
      }
      
      const json = JSON.stringify(data);
      const namespacedKey = `${NAMESPACE}${key}`;
      
      localStorage.setItem(namespacedKey, json);
      
      // Auto-migrate version if this is profile/settings
      if (key === STORAGE_KEYS.PROFILE || key === STORAGE_KEYS.SETTINGS) {
        STORAGE.set(STORAGE_KEYS.VERSION, VMQ_VERSION);
      }
      
      console.log(`[Storage] Saved ${key}:`, data);
      return true;
      
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error(`[Storage] Quota exceeded for ${key}. Triggering auto-prune.`);
        pruneOldData(30); // Auto-cleanup old practice logs
        // Retry once after cleanup
        try {
          localStorage.setItem(`${NAMESPACE}${key}`, JSON.stringify(data));
          return true;
        } catch (retryError) {
          console.error(`[Storage] Retry failed after prune:`, retryError);
          return false;
        }
      }
      console.error(`[Storage] Failed to save ${key}:`, error);
      return false;
    }
  },

  /**
   * Get data with safe JSON parsing
   * @param {string} key - Storage key
   * @param {*} defaultValue - Return if not found
   * @returns {*} Parsed data or default
   */
  get(key, defaultValue = null) {
    try {
      const namespacedKey = `${NAMESPACE}${key}`;
      const json = localStorage.getItem(namespacedKey);
      
      if (json === null) return defaultValue;
      
      const data = JSON.parse(json);
      console.log(`[Storage] Loaded ${key}:`, data);
      return data;
      
    } catch (error) {
      console.error(`[Storage] Failed to load ${key}:`, error);
      return defaultValue;
    }
  },

  /**
   * Remove specific key
   */
  remove(key) {
    try {
      const namespacedKey = `${NAMESPACE}${key}`;
      localStorage.removeItem(namespacedKey);
      console.log(`[Storage] Removed ${key}`);
      return true;
      
    } catch (error) {
      console.error(`[Storage] Failed to remove ${key}:`, error);
      return false;
    }
  },

  /**
   * Clear all VMQ data
   */
  clearAll() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(NAMESPACE)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[Storage] Cleared all VMQ data');
      return true;
      
    } catch (error) {
      console.error('[Storage] Failed to clear', error);
      return false;
    }
  },

  /**
   * Export all data for backup
   * @returns {object} { json, url, blob }
   */
  exportAll() {
    try {
      const data = {};
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(NAMESPACE)) {
          const cleanKey = key.replace(NAMESPACE, '');
          data[cleanKey] = JSON.parse(localStorage.getItem(key));
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
      
      console.log('[Storage] Exported data');
      return { json, url, blob };
      
    } catch (error) {
      console.error('[Storage] Export failed:', error);
      return null;
    }
  },

  /**
   * Import data from JSON string
   * @param {string} jsonString - JSON string to import
   * @returns {boolean} Success status
   */
  importAll(jsonString) {
    try {
      const importData = JSON.parse(jsonString);
      const data = importData.data || importData;
      
      Object.entries(data).forEach(([key, value]) => {
        STORAGE.set(key, value);
      });
      
      console.log(`[Storage] Imported ${Object.keys(data).length} items`);
      return true;
      
    } catch (error) {
      console.error('[Storage] Import failed:', error);
      return false;
    }
  }
};

// ======================================
// STORAGE ESTIMATE & QUOTA MANAGEMENT
// ======================================

/**
 * Get storage quota and usage stats
 * @returns {Promise<object>} Storage estimate with calculations
 */
export async function getStorageEstimate() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        used: estimate.usage,
        available: estimate.quota - estimate.usage,
        percentage: Math.round((estimate.usage / estimate.quota) * 100),
        isFull: estimate.usage >= estimate.quota * 0.95
      };
    } catch (error) {
      console.warn('[Storage] Estimate failed:', error);
    }
  }
  
  // Fallback estimate
  return {
    usage: 0,
    quota: 5242880, // 5MB fallback
    used: 0,
    available: 5242880,
    percentage: 0,
    isFull: false
  };
}

// ======================================
// SMART DATA PRUNING
// ======================================

/**
 * Intelligently prune old data when quota exceeds 90%
 * @param {number} daysThreshold - Remove data older than this
 */
function pruneOldData(daysThreshold = 30) {
  try {
    const cutoff = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
    
    // Prune practice log (most valuable to keep recent)
    const log = STORAGE.get(STORAGE_KEYS.PRACTICE_LOG, []);
    const cleanedLog = log.filter(entry => 
      new Date(entry.timestamp).getTime() > cutoff
    );
    
    if (cleanedLog.length < log.length) {
      STORAGE.set(STORAGE_KEYS.PRACTICE_LOG, cleanedLog);
      console.log(`[Storage] Pruned practice log: ${log.length} → ${cleanedLog.length}`);
    }
    
    // Prune analytics events (older than threshold)
    const analytics = STORAGE.get(STORAGE_KEYS.ANALYTICS, {});
    if (analytics.events && Array.isArray(analytics.events)) {
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

// ======================================
// DATA MIGRATION
// ======================================

/**
 * Migrate data from older VMQ versions
 */
export function migrateData() {
  try {
    const currentVersion = STORAGE.get(STORAGE_KEYS.VERSION, '0.0.0');
    
    if (currentVersion === VMQ_VERSION) {
      console.log('[Storage] No migration needed (v' + VMQ_VERSION + ')');
      return;
    }
    
    console.log('[Storage] Migrating from v' + currentVersion + ' to v' + VMQ_VERSION);
    
    // v2.x → v3.0: Add ML tracking fields
    if (compareVersions(currentVersion, '3.0.0') < 0) {
      migrateV2toV3();
    }
    
    // v3.0 → v3.1: Add confusion matrix & learning velocity
    if (compareVersions(currentVersion, '3.1.0') < 0) {
      migrateV3toV3_1();
    }
    
    // Mark as migrated
    STORAGE.set(STORAGE_KEYS.VERSION, VMQ_VERSION);
    console.log('[Storage] Migration complete');
    
  } catch (error) {
    console.error('[Storage] Migration failed:', error);
  }
}

/**
 * Simple semantic version comparison
 */
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

/**
 * v2.x → v3.0: Add analytics, coach data structure
 */
function migrateV2toV3() {
  try {
    // Ensure profile exists and has required fields
    const profile = STORAGE.get(STORAGE_KEYS.PROFILE, {});
    profile.onboardingComplete = profile.onboardingComplete ?? false;
    profile.userSegment = profile.userSegment ?? 'beginner';
    STORAGE.set(STORAGE_KEYS.PROFILE, profile);
    
    // Initialize coach data if missing
    const coachData = STORAGE.get(STORAGE_KEYS.COACH_DATA, {});
    coachData.initialized = true;
    coachData.lastUpdated = Date.now();
    STORAGE.set(STORAGE_KEYS.COACH_DATA, coachData);
    
    console.log('[Storage] v2→v3 migration: Profile & Coach data updated');
  } catch (error) {
    console.error('[Storage] v2→v3 migration failed:', error);
  }
}

/**
 * v3.0 → v3.1: Add confusion matrix & learning velocity tracking
 */
function migrateV3toV3_1() {
  try {
    // Initialize confusion matrix (tracks common errors)
    const confusionMatrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
    if (!confusionMatrix.initialized) {
      confusionMatrix.intervalEar = {};
      confusionMatrix.keySignatures = {};
      confusionMatrix.rhythm = {};
      confusionMatrix.initialized = Date.now();
      STORAGE.set(STORAGE_KEYS.CONFUSION_MATRIX, confusionMatrix);
    }
    
    // Initialize learning velocity tracker
    const learningVelocity = STORAGE.get(STORAGE_KEYS.LEARNING_VELOCITY, {});
    if (!learningVelocity.initialized) {
      learningVelocity.intervals = [];
      learningVelocity.keys = [];
      learningVelocity.rhythm = [];
      learningVelocity.initialized = Date.now();
      STORAGE.set(STORAGE_KEYS.LEARNING_VELOCITY, learningVelocity);
    }
    
    console.log('[Storage] v3.0→v3.1 migration: ML tracking fields initialized');
  } catch (error) {
    console.error('[Storage] v3.0→v3.1 migration failed:', error);
  }
}

// ======================================
// CLEANUP UTILITIES
// ======================================

/**
 * Clean up all user data (dangerous)
 */
export function cleanupAllData() {
  return STORAGE.clearAll();
}

/**
 * Remove data older than specified days
 * @param {number} days - Days threshold
 */
export function cleanupOldData(days = 90) {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const log = STORAGE.get(STORAGE_KEYS.PRACTICE_LOG, []);
    
    const cleanedLog = log.filter(entry => 
      new Date(entry.timestamp).getTime() > cutoff
    );
    
    STORAGE.set(STORAGE_KEYS.PRACTICE_LOG, cleanedLog);
    
    console.log(`[Storage] Cleaned old data (${log.length} → ${cleanedLog.length} entries)`);
    return true;
    
  } catch (error) {
    console.error('[Storage] Cleanup failed:', error);
    return false;
  }
}

/**
 * Track ML confusion (for adaptive difficulty)
 * @param {string} module - Module name (intervalEar, keys, rhythm)
 * @param {string} itemId - What was confused
 * @param {string} guessedId - What it was confused with
 */
export function trackConfusion(module, itemId, guessedId) {
  try {
    const matrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
    
    if (!matrix[module]) matrix[module] = {};
    if (!matrix[module][itemId]) matrix[module][itemId] = {};
    
    const confused = matrix[module][itemId][guessedId] || 0;
    matrix[module][itemId][guessedId] = confused + 1;
    
    STORAGE.set(STORAGE_KEYS.CONFUSION_MATRIX, matrix);
    return true;
  } catch (error) {
    console.error('[Storage] Failed to track confusion:', error);
    return false;
  }
}

/**
 * Get confusion data for a module (for ML adaptive selection)
 * @param {string} module - Module name
 * @returns {object} Confusion pairs ranked by frequency
 */
export function getConfusionData(module) {
  try {
    const matrix = STORAGE.get(STORAGE_KEYS.CONFUSION_MATRIX, {});
    return matrix[module] || {};
  } catch (error) {
    console.error('[Storage] Failed to get confusion data:', error);
    return {};
  }
}

/**
 * Track learning velocity (acceleration of mastery)
 * @param {string} module - Module name
 * @param {number} accuracy - Current accuracy %
 * @param {number} timeMs - Time to answer (milliseconds)
 */
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
    
    // Keep only recent data (last 1000 entries per module)
    if (velocity[module].length > 1000) {
      velocity[module] = velocity[module].slice(-1000);
    }
    
    STORAGE.set(STORAGE_KEYS.LEARNING_VELOCITY, velocity);
    return true;
  } catch (error) {
    console.error('[Storage] Failed to track learning velocity:', error);
    return false;
  }
}

/**
 * Calculate learning acceleration for a module
 * @param {string} module - Module name
 * @returns {object} { acceleration, trend, weeklyAvg }
 */
export function calculateLearningAcceleration(module) {
  try {
    const velocity = STORAGE.get(STORAGE_KEYS.LEARNING_VELOCITY, {});
    const data = velocity[module] || [];
    
    if (data.length < 2) {
      return { acceleration: 0, trend: 'flat', weeklyAvg: [] };
    }
    
    // Group by week, calculate avg accuracy
    const byWeek = {};
    data.forEach(entry => {
      if (!byWeek[entry.week]) byWeek[entry.week] = [];
      byWeek[entry.week].push(entry.accuracy);
    });
    
    const weeks = Object.keys(byWeek).sort((a, b) => a - b);
    const weeklyAvgs = weeks.map(w => ({
      week: w,
      avg: byWeek[w].reduce((a, b) => a + b, 0) / byWeek[w].length
    }));
    
    // Simple linear acceleration: change in avg per week
    const acceleration = weeklyAvgs.length >= 2 
      ? weeklyAvgs[weeklyAvgs.length - 1].avg - weeklyAvgs[0].avg
      : 0;
    
    const trend = acceleration > 2 ? 'accelerating' : acceleration < -2 ? 'declining' : 'flat';
    
    return { acceleration, trend, weeklyAvg: weeklyAvgs };
  } catch (error) {
    console.error('[Storage] Failed to calculate acceleration:', error);
    return { acceleration: 0, trend: 'error', weeklyAvg: [] };
  }
}

// ======================================
// CONVENIENCE HELPERS (backward compatibility)
// ======================================

export const loadJSON = STORAGE.get;
export const saveJSON = STORAGE.set;

// ======================================
// EXPORTS
// ======================================

export default STORAGE;

// Auto-migrate on module load
migrateData();
