// ========================================================
// VMQ STORAGE - LocalStorage helpers with safety checks
// ========================================================

import { STORAGE_KEYS } from './constants.js';  // ✅ Correct path

// ========================================================
// CORE STORAGE FUNCTIONS
// ========================================================

export function loadJSON(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return defaultValue;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
}

// ========================================================
// MODULE STATS
// ========================================================

export function loadStats() {
  return loadJSON(STORAGE_KEYS.STATS, {
    total: 0,
    correct: 0,
    byMode: {}
  });
}

export function saveStats(stats) {
  saveJSON(STORAGE_KEYS.STATS, stats);
}

export function updateStats(module, correct) {
  const stats = loadStats();
  
  // Initialize byMode if needed
  if (!stats.byMode) {
    stats.byMode = {};
  }
  
  // Initialize module stats if needed
  if (!stats.byMode[module]) {
    stats.byMode[module] = { correct: 0, total: 0 };
  }
  
  // Update module stats
  stats.byMode[module].total += 1;
  if (correct) {
    stats.byMode[module].correct += 1;
  }
  
  // Update global stats
  stats.total += 1;
  if (correct) {
    stats.correct += 1;
  }
  
  saveStats(stats);
}

// ========================================================
// XP & LEVELING
// ========================================================

export function loadXP() {
  return loadJSON(STORAGE_KEYS.XP, 0);
}

export function saveXP(xp) {
  saveJSON(STORAGE_KEYS.XP, xp);
}

export function loadLevel() {
  return loadJSON(STORAGE_KEYS.LEVEL, 1);
}

export function saveLevel(level) {
  saveJSON(STORAGE_KEYS.LEVEL, level);
}

// ========================================================
// STREAKS & PRACTICE TRACKING
// ========================================================

export function loadStreak() {
  return loadJSON(STORAGE_KEYS.STREAK, 0);
}

export function saveStreak(streak) {
  saveJSON(STORAGE_KEYS.STREAK, streak);
}

export function loadLastPractice() {
  return loadJSON(STORAGE_KEYS.LAST_PRACTICE, null);
}

export function saveLastPractice(dateStr) {
  saveJSON(STORAGE_KEYS.LAST_PRACTICE, dateStr);
}

// ========================================================
// PROFILE & ACHIEVEMENTS
// ========================================================

export function loadProfile() {
  return loadJSON(STORAGE_KEYS.PROFILE, null);
}

export function saveProfile(profile) {
  saveJSON(STORAGE_KEYS.PROFILE, profile);
}

export function loadAchievements() {
  return loadJSON(STORAGE_KEYS.ACHIEVEMENTS, []);
}

export function saveAchievements(achievements) {
  saveJSON(STORAGE_KEYS.ACHIEVEMENTS, achievements);
}

// ========================================================
// DAILY GOALS
// ========================================================

export function loadDailyGoal() {
  return loadJSON(STORAGE_KEYS.DAILY_GOAL, {
    date: new Date().toISOString().substring(0, 10),
    xpEarned: 0,
    itemsCompleted: 0,
    minutesPracticed: 0
  });
}

export function saveDailyGoal(goal) {
  saveJSON(STORAGE_KEYS.DAILY_GOAL, goal);
}

// ========================================================
// SPACED REPETITION
// ========================================================

export function loadItemRatings() {
  return loadJSON(STORAGE_KEYS.ITEM_RATINGS, {});
}

export function saveItemRatings(ratings) {
  saveJSON(STORAGE_KEYS.ITEM_RATINGS, ratings);
}

// ========================================================
// PRACTICE PLANNER
// ========================================================

export function loadPracticePlan() {
  return loadJSON(STORAGE_KEYS.PRACTICE_PLAN, []);
}

export function savePracticePlan(plan) {
  saveJSON(STORAGE_KEYS.PRACTICE_PLAN, plan);
}

// ========================================================
// SETTINGS
// ========================================================

export function loadSettings() {
  return loadJSON(STORAGE_KEYS.SETTINGS, {
    muted: false,
    darkMode: false,
    highContrast: false,
    largeFonts: false,
    compactLayout: false
  });
}

export function saveSettings(settings) {
  saveJSON(STORAGE_KEYS.SETTINGS, settings);
}

// ========================================================
// DIFFICULTY
// ========================================================

export function loadDifficulty() {
  return loadJSON(STORAGE_KEYS.DIFFICULTY, {});
}

export function saveDifficulty(difficulty) {
  saveJSON(STORAGE_KEYS.DIFFICULTY, difficulty);
}

// ========================================================
// UTILITY FUNCTIONS
// ========================================================

/**
 * Check if localStorage is available (fails in private browsing)
 */
export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get storage status with user-friendly message
 */
export function getStorageStatus() {
  const available = isStorageAvailable();
  return {
    available,
    message: available 
      ? 'Storage available' 
      : '⚠️ Private browsing detected. Progress will not be saved.'
  };
}

/**
 * Clear all VMQ data from localStorage
 */
export function clearAll() {
  Object.values(STORAGE_KEYS).forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing ${key}:`, error);
    }
  });
}

/**
 * Export all data as JSON string
 */
export function exportData() {
  const data = {};
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        data[name] = JSON.parse(item);
      }
    } catch (error) {
      console.error(`Error exporting ${key}:`, error);
    }
  });
  
  return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON string
 */
export function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    Object.entries(data).forEach(([name, value]) => {
      const key = STORAGE_KEYS[name];
      if (key) {
        saveJSON(key, value);
      }
    });
    return true;
  } catch (error) {
    console.error('Error importing ', error);
    return false;
  }
}

/**
 * Get storage usage info
 */
export function getStorageInfo() {
  let totalSize = 0;
  const items = {};
  
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const size = new Blob([item]).size;
        totalSize += size;
        items[name] = {
          key,
          size,
          sizeKB: (size / 1024).toFixed(2)
        };
      }
    } catch (error) {
      console.error(`Error checking ${key}:`, error);
    }
  });
  
  return {
    totalSize,
    totalKB: (totalSize / 1024).toFixed(2),
    items
  };
}
