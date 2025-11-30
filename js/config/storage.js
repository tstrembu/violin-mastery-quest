// ========================================================
// VMQ STORAGE - localStorage with Safari Private Mode Support
// ========================================================

export const STORAGE_KEYS = {
  STATS: 'vmq.stats',
  ITEMS: 'vmq.itemDatabase',
  DIFFICULTY: 'vmq.difficulty',
  SETTINGS: 'vmq.settings',
  STREAK: 'vmq.streak',
  ACHIEVEMENTS: 'vmq.achievements',
  LAST_PRACTICE: 'vmq.lastPractice'
};

// ✨ Runtime cache for when localStorage is unavailable
let runtimeCache = {};
let storageAvailable = null;

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage works
 */
function checkStorageAvailable() {
  if (storageAvailable !== null) return storageAvailable;
  
  try {
    const test = '__vmq_storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    storageAvailable = true;
    return true;
  } catch (e) {
    console.warn('localStorage unavailable (Private Browsing?). Using runtime cache.');
    storageAvailable = false;
    return false;
  }
}

/**
 * Load JSON with fallback to runtime cache
 */
export function loadJSON(key, fallback = {}) {
  try {
    if (checkStorageAvailable()) {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } else {
      // Use runtime cache
      return runtimeCache[key] !== undefined ? runtimeCache[key] : fallback;
    }
  } catch (err) {
    console.error(`Failed to load ${key}:`, err);
    return fallback;
  }
}

/**
 * Save JSON with fallback to runtime cache
 */
export function saveJSON(key, value) {
  try {
    if (checkStorageAvailable()) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      // Use runtime cache
      runtimeCache[key] = value;
    }
  } catch (err) {
    console.error(`Failed to save ${key}:`, err);
    // Fallback to runtime cache
    runtimeCache[key] = value;
  }
}

export function clearKey(key) {
  try {
    if (checkStorageAvailable()) {
      localStorage.removeItem(key);
    }
    delete runtimeCache[key];
  } catch (err) {
    console.error(`Failed to clear ${key}:`, err);
  }
}

export function clearAll() {
  Object.values(STORAGE_KEYS).forEach(key => clearKey(key));
  runtimeCache = {};
}

export function exportData() {
  const data = {};
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    data[name] = loadJSON(key, null);
  });
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      if (data[name] !== null && data[name] !== undefined) {
        saveJSON(key, data[name]);
      }
    });
    return true;
  } catch (err) {
    console.error('Failed to import ', err);
    return false;
  }
}

/**
 * ✨ Check if storage is working
 */
export function isStorageAvailable() {
  return checkStorageAvailable();
}

/**
 * ✨ Get storage status message for UI
 */
export function getStorageStatus() {
  if (checkStorageAvailable()) {
    return { available: true, message: 'Progress will be saved' };
  } else {
    return { 
      available: false, 
      message: 'Private browsing detected. Progress will reset when you close the app.' 
    };
  }
}
