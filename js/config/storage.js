import { STORAGE_KEYS } from './constants.js';

// Generic helpers
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

// Stats helpers
export function loadStats() {
  return loadJSON(STORAGE_KEYS.STATS, { total:0, correct:0, byMode:{} });
}
export function saveStats(stats) { saveJSON(STORAGE_KEYS.STATS, stats); }
export function updateStats(module, correct) {
  const stats = loadStats();
  if (!stats.byMode[module]) stats.byMode[module] = { correct:0, total:0 };
  stats.byMode[module].total += 1;
  if (correct) stats.byMode[module].correct += 1;
  stats.total += 1;
  if (correct) stats.correct += 1;
  saveStats(stats);
}

// XP & level helpers
export function loadXP()       { return loadJSON(STORAGE_KEYS.XP, 0); }
export function saveXP(xp)     { saveJSON(STORAGE_KEYS.XP, xp); }
export function loadLevel()    { return loadJSON(STORAGE_KEYS.LEVEL, 1); }
export function saveLevel(lvl) { saveJSON(STORAGE_KEYS.LEVEL, lvl); }

// Streak helpers
export function loadStreak()          { return loadJSON(STORAGE_KEYS.STREAK, 0); }
export function saveStreak(streak)    { saveJSON(STORAGE_KEYS.STREAK, streak); }
export function loadLastPractice()    { return loadJSON(STORAGE_KEYS.LAST_PRACTICE, null); }
export function saveLastPractice(date){ saveJSON(STORAGE_KEYS.LAST_PRACTICE, date); }

// Profile & practice plan
export function loadProfile()         { return loadJSON(STORAGE_KEYS.PROFILE, PROFILE_TYPES.INTERMEDIATE.id); }
export function saveProfile(profileId){ saveJSON(STORAGE_KEYS.PROFILE, profileId); }
export function loadPracticePlan()    { return loadJSON(STORAGE_KEYS.PRACTICE_PLAN, []); }
export function savePracticePlan(plan){ saveJSON(STORAGE_KEYS.PRACTICE_PLAN, plan); }

// Achievements
export function loadAchievements()          { return loadJSON(STORAGE_KEYS.ACHIEVEMENTS, {}); }
export function saveAchievements(achievements){ saveJSON(STORAGE_KEYS.ACHIEVEMENTS, achievements); }

// Daily goal
export function loadDailyGoal()          { return loadJSON(STORAGE_KEYS.DAILY_GOAL, null); }
export function saveDailyGoal(goal)      { saveJSON(STORAGE_KEYS.DAILY_GOAL, goal); }