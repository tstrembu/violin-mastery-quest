// ======================================
// VMQ STORAGE - localStorage Wrapper + STORAGE_KEYS
// Unified namespace, migration, quota management
// ======================================

import { VMQ_VERSION } from './constants.js';

// ======================================
// STORAGE NAMESPACE & KEYS
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
  
  // Training Data
  REPERTOIRE: 'vmq.repertoire',
  SPACED_REPETITION: 'vmq.spacedRepetition',
  DIFFICULTY: 'vmq.difficulty',
  
  // Journal & Coach
  JOURNAL: 'vmq.journal',
  COACH_DATA: 'vmq.coachData'
};

// VMQ Storage Namespace Prefix
const NAMESPACE = 'vmq-';

// ======================================
// STORAGE ENGINE - Core API
// ======================================

const STORAGE = {
  // Generic JSON storage with validation
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
      console.error(`[Storage] Failed to save ${key}:`, error);
      return false;
    }
  },

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

  // Bulk operations
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
      console.error('[Storage] Failed to clear ', error);
      return false;
    }
  },

  // Export/Import for backup
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

export async function getStorageEstimate() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        used: estimate.usage,
        available: estimate.quota - estimate.usage,
        percentage: Math.round((estimate.usage / estimate.quota) * 100)
      };
    } catch (error) {
      console.warn('[Storage] Estimate failed:', error);
    }
  }
  
  // Fallback estimate
  return {
    usage: 0,
    quota: 5000000, // 5MB fallback
    used: 0,
    available: 5000000,
    percentage: 0
  };
}

// ======================================
// DATA MIGRATION
// ======================================

export function migrateData() {
  try {
    const currentVersion = STORAGE.get(STORAGE_KEYS.VERSION, '0.0.0');
    
    if (currentVersion === VMQ_VERSION) {
      console.log('[Storage] No migration needed (v' + VMQ_VERSION + ')');
      return;
    }
    
    console.log('[Storage] Migrating from v' + currentVersion + ' to v' + VMQ_VERSION);
    
    // v1.0 → v1.1: Namespace old flat keys
    if (compareVersions(currentVersion, '1.1.0') < 0) {
      migrateV1toV1_1();
    }
    
    // v1.1 → v1.2: Add new fields, clean up
    if (compareVersions(currentVersion, '1.2.0') < 0) {
      migrateV1_1toV1_2();
    }
    
    // Mark as migrated
    STORAGE.set(STORAGE_KEYS.VERSION, VMQ_VERSION);
    console.log('[Storage] Migration complete');
    
  } catch (error) {
    console.error('[Storage] Migration failed:', error);
  }
}

function compareVersions(v1, v2) {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

function migrateV1toV1_1() {
  // Move old flat keys to namespace
  const oldKeys = ['profile', 'settings', 'xp', 'streak'];
  oldKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      STORAGE.set(key, JSON.parse(value));
      localStorage.removeItem(key);
    }
  });
}

function migrateV1_1toV1_2() {
  // Ensure all new fields exist with defaults
  const profile = STORAGE.get(STORAGE_KEYS.PROFILE, {});
  if (!profile.onboardingComplete) {
    profile.onboardingComplete = false;
    STORAGE.set(STORAGE_KEYS.PROFILE, profile);
  }
}

// ======================================
// CLEANUP UTILITIES
// ======================================

export function cleanupAllData() {
  return STORAGE.clearAll();
}

export function cleanupOldData(days = 90) {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const log = STORAGE.get(STORAGE_KEYS.PRACTICE_LOG, []);
    
    const cleanedLog = log.filter(entry => new Date(entry.timestamp) > cutoff);
    STORAGE.set(STORAGE_KEYS.PRACTICE_LOG, cleanedLog);
    
    console.log(`[Storage] Cleaned old data (${log.length} → ${cleanedLog.length})`);
    return true;
    
  } catch (error) {
    console.error('[Storage] Cleanup failed:', error);
    return false;
  }
}

// ======================================
// CONVENIENCE HELPERS
// ======================================

// Legacy helpers (for backward compatibility)
export const loadJSON = STORAGE.get;
export const saveJSON = STORAGE.set;

// Export the main storage object
export default STORAGE;

// Auto-migrate on module load
migrateData();
