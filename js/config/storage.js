// ========================================================
// VMQ STORAGE - LocalStorage helpers
// ========================================================

// 1️⃣ IMPORTS (at the very top)
import { STORAGE_KEYS } from './constants.js';

// 2️⃣ CORE FUNCTIONS (your existing base functions)
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

// 3️⃣ STATS FUNCTIONS (your existing module stats)
export function loadStats() {
  return loadJSON('vmq.stats', {
    intervals: { correct: 0, total: 0 },
    rhythm: { correct: 0, total: 0 },
    flashcards: { correct: 0, total: 0 },
    bieler: { correct: 0, total: 0 },
    fingerboard: { correct: 0, total: 0 },
    keysig: { correct: 0, total: 0 }
  });
}

export function saveStats(stats) {
  saveJSON('vmq.stats', stats);
}

export function updateStats(module, correct) {
  const stats = loadStats();
  if (!stats[module]) {
    stats[module] = { correct: 0, total: 0 };
  }
  stats[module].total += 1;
  if (correct) {
    stats[module].correct += 1;
  }
  saveStats(stats);
}

// 4️⃣ NEW GAMIFICATION FUNCTIONS (the ones I gave you)
// XP & Levels
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

// Streaks
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

// Profile
export function loadProfile() {
  return loadJSON(STORAGE_KEYS.PROFILE, 'intermediate');
}

export function saveProfile(profile) {
  saveJSON(STORAGE_KEYS.PROFILE, profile);
}

// Achievements
export function loadAchievements() {
  return loadJSON(STORAGE_KEYS.ACHIEVEMENTS, []);
}

export function saveAchievements(achievements) {
  saveJSON(STORAGE_KEYS.ACHIEVEMENTS, achievements);
}

// Daily Goals
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

// Spaced Repetition
export function loadItemRatings() {
  return loadJSON(STORAGE_KEYS.ITEM_RATINGS, {});
}

export function saveItemRatings(ratings) {
  saveJSON(STORAGE_KEYS.ITEM_RATINGS, ratings);
}

// Practice Planner
export function loadPracticePlan() {
  return loadJSON(STORAGE_KEYS.PRACTICE_PLAN, []);
}

export function savePracticePlan(plan) {
  saveJSON(STORAGE_KEYS.PRACTICE_PLAN, plan);
}
