// ======================================
// VMQ STORAGE ENGINE v2.0 - Production Ready
// localStorage + IndexedDB fallback + Auto-backup
// ======================================

import { VMQ_VERSION, CACHE_BUST } from './version.js';
import { downloadFile } from '../utils/helpers.js';

export const STORAGE_KEYS = {
  // Core User Data
  STATS: 'vmq.v2.stats',
  SETTINGS: 'vmq.v2.settings',
  XP: 'vmq.v2.xp',
  STREAK: 'vmq.v2.streak',
  PROFILE: 'vmq.v2.profile',
  
  // Practice Tracking
  PRACTICE_LOG: 'vmq.v2.practiceLog',
  DAILY_GOALS: 'vmq.v2.dailyGoals',
  SESSION_HISTORY: 'vmq.v2.sessionHistory',
  
  // Learning Systems
  SPACED_REP: 'vmq.v2.spacedRep',      // SM-2 flashcards
  ACHIEVEMENTS: 'vmq.v2.achievements',
  COACH_INSIGHTS: 'vmq.v2.coach',
  
  // Backups & Migration
  LAST_BACKUP: 'vmq.v2.lastBackup',
  MIGRATION_VERSION: 'vmq.v2.migration'
};

// ======================================
// STORAGE BACKEND DETECTION (Priority Order)
// ======================================

class StorageBackend {
  constructor() {
    this.backends = [
      this.initIndexedDB(),
      this.initLocalStorage(),
      this.initMemory()
    ];
    this.currentBackend = null;
    this.init();
  }

  async init() {
    for (const backend of this.backends) {
      if (await backend.test()) {
        this.currentBackend = backend;
        console.log(`[VMQ Storage] Using: ${backend.name}`);
        return;
      }
    }
    console.warn('[VMQ Storage] Fallback to memory only');
  }

  async initIndexedDB() {
    if (!('indexedDB' in window)) return { name: 'No IDB', test: () => false };
    
    const dbName = `VMQ_v${VMQ_VERSION}_${CACHE_BUST}`;
    const request = indexedDB.open(dbName, 3);
    
    request.onerror = () => {};
    request.onsuccess = () => request.result.close();
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      db.createObjectStore('data', { keyPath: 'key' });
    };
    
    return {
      name: 'IndexedDB',
      async test() {
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(true);
          request.onerror = () => resolve(false);
        });
      },
      async save(key, data) {
        const tx = request.result.transaction('data', 'readwrite');
        const store = tx.objectStore('data');
        await store.put({ key, data, timestamp: Date.now(), version: VMQ_VERSION });
      },
      async load(key) {
        const tx = request.result.transaction('data', 'readonly');
        const store = tx.objectStore('data');
        const result = await store.get(key);
        return result ? result.data : null;
      }
    };
  }

  initLocalStorage() {
    return {
      name: 'localStorage',
      test: () => {
        try {
          const test = `__vmq_test_${Date.now()}`;
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
        } catch (e) {
          return false;
        }
      },
      save: (key, data) => localStorage.setItem(key, JSON.stringify({ 
        data, 
        version: VMQ_VERSION, 
        timestamp: Date.now() 
      })),
      load: (key) => {
        try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item).data : null;
        } catch (e) {
          return null;
        }
      }
    };
  }

  initMemory() {
    const memory = {};
    return {
      name: 'Memory',
      test: () => true,
      save: (key, data) => memory[key] = data,
      load: (key) => memory[key] || null
    };
  }
}

const storage = new StorageBackend();

// ======================================
// CORE API (Versioned + Safe)
// ======================================

export async function saveJSON(key, data, options = {}) {
  if (!storage.currentBackend) {
    console.warn('[VMQ Storage] Backend not ready');
    return false;
  }
  
  try {
    await storage.currentBackend.save(key, {
      ...data,
      _meta: {
        version: VMQ_VERSION,
        timestamp: Date.now(),
        size: JSON.stringify(data).length
      }
    });
    return true;
  } catch (error) {
    console.error(`[VMQ Storage] Save failed (${key}):`, error);
    return false;
  }
}

export async function loadJSON(key, defaultValue = null) {
  try {
    if (!storage.currentBackend) return defaultValue;
    const data = await storage.currentBackend.load(key);
    return data || defaultValue;
  } catch (error) {
    console.error(`[VMQ Storage] Load failed (${key}):`, error);
    return defaultValue;
  }
}

export async function clearData() {
  try {
    if (storage.currentBackend.name === 'IndexedDB') {
      const request = indexedDB.open(`VMQ_v${VMQ_VERSION}_${CACHE_BUST}`, 3);
      request.onsuccess = () => {
        request.result.destroyed = true;
        request.result.close();
      };
    } else if (storage.currentBackend.name === 'localStorage') {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    }
    return true;
  } catch (error) {
    console.error('[VMQ Storage] Clear failed:', error);
    return false;
  }
}

// ======================================
// BACKUP & MIGRATION SYSTEM
// ======================================

export async function createBackup() {
  const backup = {
    version: VMQ_VERSION,
    timestamp: Date.now(),
     {}
  };
  
  for (const key of Object.values(STORAGE_KEYS)) {
    backup.data[key] = await loadJSON(key);
  }
  
  await saveJSON(STORAGE_KEYS.LAST_BACKUP, backup);
  return backup;
}

export async function exportData() {
  const backup = await createBackup();
  downloadFile(
    JSON.stringify(backup, null, 2),
    `vmq-backup-${new Date().toISOString().slice(0,10)}.json`,
    'application/json'
  );
}

export async function importData(fileOrJson) {
  try {
    const data = typeof fileOrJson === 'string' 
      ? JSON.parse(fileOrJson) 
      : JSON.parse(await fileOrJson.text());
    
    if (data.version !== VMQ_VERSION) {
      console.warn(`[VMQ] Import version mismatch: ${data.version} → ${VMQ_VERSION}`);
    }
    
    for (const [key, value] of Object.entries(data.data || data)) {
      if (STORAGE_KEYS[key] !== undefined) {
        await saveJSON(key, value);
      }
    }
    
    return true;
  } catch (error) {
    console.error('[VMQ Storage] Import failed:', error);
    return false;
  }
}

// ======================================
// DATA INTEGRITY & STATS
// ======================================

export async function getStorageStats() {
  const stats = {
    backend: storage.currentBackend?.name || 'unknown',
    keys: 0,
    totalSize: 0,
    version: VMQ_VERSION
  };
  
  for (const key of Object.values(STORAGE_KEYS)) {
    const data = await loadJSON(key);
    if (data) {
      stats.keys++;
      stats.totalSize += JSON.stringify(data).length;
    }
  }
  
  return stats;
}

export async function validateData() {
  const issues = [];
  
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      const data = await loadJSON(key);
      if (data && data._meta?.version !== VMQ_VERSION) {
        issues.push(`${key}: v${data._meta?.version} (expected v${VMQ_VERSION})`);
      }
    } catch (e) {
      issues.push(`${key}: corrupted`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}

// ======================================
// AUTO-MIGRATION (v1 → v2)
// ======================================

export async function migrateFromV1() {
  const migrationKey = STORAGE_KEYS.MIGRATION_VERSION;
  const currentMigration = await loadJSON(migrationKey, '0.0.0');
  
  if (currentMigration === VMQ_VERSION) return false;
  
  console.log('[VMQ Storage] Migrating from', currentMigration, '→', VMQ_VERSION);
  
  // v1 → v2 key mapping
  const v1Keys = {
    'vmq.stats': STORAGE_KEYS.STATS,
    'vmq.settings': STORAGE_KEYS.SETTINGS,
    'vmq.xp': STORAGE_KEYS.XP,
    'vmq.streak': STORAGE_KEYS.STREAK,
    'vmq.practiceLog': STORAGE_KEYS.PRACTICE_LOG
  };
  
  for (const [v1Key, v2Key] of Object.entries(v1Keys)) {
    const v1Data = localStorage.getItem(v1Key);
    if (v1Data) {
      await saveJSON(v2Key, JSON.parse(v1Data));
      localStorage.removeItem(v1Key);
    }
  }
  
  await saveJSON(migrationKey, VMQ_VERSION);
  console.log('[VMQ Storage] Migration complete');
  return true;
}

// ======================================
// AUTO-INIT
// ======================================

if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    await migrateFromV1();
  });
}

// Default export for backwards compatibility
export default {
  saveJSON,
  loadJSON,
  clearData,
  exportData,
  importData,
  STORAGE_KEYS,
  getStorageStats
};
