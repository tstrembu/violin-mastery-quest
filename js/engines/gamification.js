// js/engines/gamification.js
// ====================================
// VMQ GAMIFICATION v3.0 (drop-in replacement)
// XP • Levels • Streaks • Achievements • Adaptive Rewards
// Compatible exports: awardXP/addXP, recordStreak/updateStreak
// Fixes: invalid `meta { ... }` syntax + consistent `{ metadata: ... }` payloads
// ====================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { sessionTracker } from './sessionTracker.js';
import { analyzePerformance } from './analytics.js';
import { getStats as getSM2Stats } from './spacedRepetition.js';

// ------------------------------------
// Internal helpers
// ------------------------------------
const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(n)));
const todayISO = () => new Date().toISOString().slice(0, 10);
const yesterdayISO = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function safeArray(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function safeObject(v, fallback = {}) {
  return v && typeof v === 'object' ? v : fallback;
}

// ====================================
// XP STORAGE
// ====================================

export function loadXP() {
  const xp = loadJSON(STORAGE_KEYS.XP, 0);
  return Number.isFinite(xp) ? xp : 0;
}

export function saveXP(xp) {
  const clean = Number.isFinite(xp) ? Math.max(0, Math.trunc(xp)) : 0;
  return saveJSON(STORAGE_KEYS.XP, clean);
}

/**
 * Append a lightweight XP event to analytics storage.
 * Keeps the app functional even if analytics/sessionTracker are absent.
 */
export function logXPEvent({ amount = 0, reason = 'practice', source = 'core', metadata = {} } = {}) {
  try {
    const analytics = safeObject(loadJSON(STORAGE_KEYS.ANALYTICS, {}), {});
    analytics.events = safeArray(analytics.events, []);

    const evt = {
      type: 'xp',
      timestamp: Date.now(),
      amount: Math.trunc(amount) || 0,
      reason: String(reason || 'practice'),
      source: String(source || 'core'),
      metadata: safeObject(metadata, {})
    };

    analytics.events.push(evt);

    // Prevent unbounded growth (storage module also prunes, but be defensive here)
    if (analytics.events.length > 2000) analytics.events = analytics.events.slice(-2000);

    saveJSON(STORAGE_KEYS.ANALYTICS, analytics);
    return evt;
  } catch {
    return null;
  }
}

// ====================================
// XP AWARDING (core)
// ====================================

/**
 * Add XP + auto-level check + achievement scan + analytics logging
 */
export function addXP(amount, reason = 'practice', { source = 'core', metadata = {} } = {}) {
  const amt = Number.isFinite(amount) ? Math.trunc(amount) : 0;

  // Maintain exact return shape even when no XP is awarded.
  if (!amt) {
    const xpNow = loadXP();
    const lvlNow = getLevel(xpNow);
    return {
      oldXP: xpNow,
      newXP: xpNow,
      oldLevel: lvlNow,
      newLevel: lvlNow,
      leveledUp: false
    };
  }

  const oldXP = loadXP();
  const newXP = Math.max(0, oldXP + amt);
  saveXP(newXP);

  const oldLevel = getLevel(oldXP);
  const newLevel = getLevel(newXP);
  const leveledUp = newLevel.level > oldLevel.level;

  // XP analytics event
  const xpEvent = logXPEvent({ amount: amt, reason, source, metadata });

  // Level-up bonus + achievement unlock
  if (leveledUp) {
    const bonusXP = Math.max(25, calculateLevelBonus(newLevel.level));
    const bonusTotal = newXP + bonusXP;

    saveXP(bonusTotal);

    logXPEvent({
      amount: bonusXP,
      reason: 'level_bonus',
      source: 'system',
      metadata: { level: newLevel.level }
    });

    // Unlock an achievement for the level
    unlockAchievement(`level_${newLevel.level}`, { level: newLevel.level });

    sessionTracker?.trackActivity?.('level', 'up', {
      from: oldLevel.level,
      to: newLevel.level,
      bonusXP
    });
  }

  // Re-check achievements with updated XP/level
  checkAchievements();

  return { oldXP, newXP: loadXP(), oldLevel, newLevel, leveledUp, xpEvent };
}

/**
 * Compatibility alias: some components import `awardXP` instead of `addXP`.
 */
export const awardXP = addXP;

/**
 * Adaptive level bonus: slightly higher at key milestones
 */
function calculateLevelBonus(level) {
  if (level >= 15) return 100;
  if (level >= 10) return 75;
  if (level >= 5) return 60;
  return 50;
}

/**
 * Auto XP from practice (Intervals.js, Rhythm, Keys, etc. call this)
 * Adds adaptive scaling based on difficulty and current performance
 */
export function awardPracticeXP(
  module,
  isCorrect,
  { streak = 0, difficulty = 1, responseTime = 0, accuracyWindow = null } = {}
) {
  if (!isCorrect) return 0;

  const diff = clampInt(difficulty, 1, 5);
  const st = clampInt(streak, 0, 999);

  let xp = 10 * diff; // Base 10 XP per difficulty

  // Streak multiplier (encourages chains of correct answers)
  if (st >= 3) xp += Math.min(st, 10) * 2;

  // Speed bonus (<2s) but capped
  if (responseTime > 0 && responseTime < 2000) xp += 3;

  // Accuracy window bonus (sustained high accuracy)
  if (accuracyWindow && accuracyWindow.questions >= 10 && accuracyWindow.accuracy >= 90) xp += 5;

  // Anti-grind in very long sessions
  if (accuracyWindow && accuracyWindow.questions >= 100) xp = Math.round(xp * 0.8);

  addXP(xp, `${module}_correct`, {
    source: 'practice',
    metadata: { module, streak: st, difficulty: diff, responseTime }
  });

  sessionTracker?.trackActivity?.('xp', 'practice_gain', {
    module,
    xp,
    streak: st,
    difficulty: diff,
    responseTime
  });

  return xp;
}

// ====================================
// LEVEL SYSTEM (20 violin levels)
// ====================================

const LEVELS = [
  { level: 1, title: 'Beginner',       minXP: 0,    badge: '🎻',  repertoire: 'Suzuki Bk1' },
  { level: 2, title: 'Note Reader',    minXP: 50,   badge: '📖',  repertoire: 'Minuet G' },
  { level: 3, title: 'Interval Ear',   minXP: 150,  badge: '👂',  repertoire: 'Bach A-minor' },
  { level: 4, title: 'Key Master',     minXP: 300,  badge: '🔑',  repertoire: 'Kreutzer #1' },
  { level: 5, title: 'Rhythm Sense',   minXP: 500,  badge: '🥁',  repertoire: 'Gavottes' },
  { level: 6, title: 'Bieler Basics',  minXP: 800,  badge: '🎼',  repertoire: 'Suzuki Bk2' },
  { level: 7, title: 'Week Warrior',   minXP: 1200, badge: '🔥',  repertoire: 'Viotti' },
  { level: 8, title: 'Hand Frame',     minXP: 1700, badge: '✋',  repertoire: 'Kreutzer #2' },
  { level: 9, title: 'Bow Control',    minXP: 2300, badge: '🎀',  repertoire: 'Wieniawski' },
  { level:10, title: 'Position I',     minXP: 3000, badge: '📍',  repertoire: 'Bruch VC' },
  { level:11, title: 'Scales Pro',     minXP: 3800, badge: '🎵',  repertoire: 'Major scales' },
  { level:12, title: 'Month Master',   minXP: 4700, badge: '🏆',  repertoire: 'Paganini' },
  { level:13, title: 'Vibrato',        minXP: 5700, badge: '✨',  repertoire: 'Ysaye' },
  { level:14, title: 'Shifting',       minXP: 6800, badge: '⬆️',  repertoire: '3rd pos' },
  { level:15, title: 'Spiccato',       minXP: 8000, badge: '💨',  repertoire: 'Ševčík' },
  { level:16, title: 'Arpeggio',       minXP: 9300, badge: '🔄',  repertoire: 'Bach Partita' },
  { level:17, title: 'Double Stops',   minXP:10700, badge: '🎭',  repertoire: 'Sonatas' },
  { level:18, title: 'Cadenza',        minXP:12200, badge: '🌟',  repertoire: 'Concerti' },
  { level:19, title: 'Virtuoso',       minXP:13800, badge: '👑',  repertoire: 'Caprices' },
  { level:20, title: 'Maestro',        minXP:15500, badge: '🎻🏆', repertoire: 'All Repertoire' }
];

export function getLevel(xp = loadXP()) {
  const x = Number.isFinite(xp) ? xp : 0;
  return LEVELS.reduce((best, lvl) => (x >= lvl.minXP ? lvl : best), LEVELS[0]);
}

/**
 * Router dependency satisfied: `router.js` can call getUserLevel()
 */
export function getUserLevel() {
  return getLevel().level;
}

/**
 * For dashboard/coach: exposes current, next, and percentage
 */
export function getNextLevelProgress(xp = loadXP()) {
  const level = getLevel(xp);
  const next = LEVELS.find(l => l.level === level.level + 1) || level;

  if (next.level === level.level) {
    return {
      currentLevel: level.level,
      nextLevel: level.level,
      current: xp - level.minXP,
      required: 0,
      percentage: 100
    };
  }

  const span = next.minXP - level.minXP;
  const gained = xp - level.minXP;
  const percentage = Math.max(0, Math.min(100, Math.round((gained / span) * 100)));

  return {
    currentLevel: level.level,
    nextLevel: next.level,
    current: gained,
    required: span,
    percentage
  };
}

export function getXPToNextLevel(xp = loadXP()) {
  const { nextLevel, required, current } = getNextLevelProgress(xp);
  if (required === 0) return 0;
  return nextLevel > getLevel(xp).level ? Math.max(0, required - current) : 0;
}

export function getLevelProgress(xp = loadXP()) {
  return getNextLevelProgress(xp).percentage;
}

// ======================================
// STREAK SYSTEM (SessionTracker + Coach)
// ======================================

export function loadStreak() {
  return loadJSON(STORAGE_KEYS.STREAK, { current: 0, best: 0, lastDate: null });
}

export function saveStreak(streak) {
  return saveJSON(STORAGE_KEYS.STREAK, streak);
}

/**
 * Called by SessionTracker on session end
 * Adds adaptive rewards at higher streaks (7, 14, 30, 100)
 */
export function updateStreak() {
  const streak = safeObject(loadStreak(), { current: 0, best: 0, lastDate: null });
  const today = todayISO();

  if (streak.lastDate === today) return streak; // already counted today

  const yesterday = yesterdayISO();
  const continued = streak.lastDate === yesterday;

  const current = continued ? (Number(streak.current) || 0) + 1 : 1;
  const best = Math.max(Number(streak.best) || 0, current);

  const data = { current, best, lastDate: today };
  saveStreak(data);

  // Streak bonuses (adaptive)
  const bonusXP = getStreakBonusXP(current);
  if (bonusXP > 0) {
    addXP(bonusXP, 'streak_bonus', {
      source: 'streak',
      metadata: { streak: current }
    });

    sessionTracker?.trackActivity?.('streak', 'milestone', {
      streak: current,
      bonusXP
    });
  }

  return data;
}

/**
 * Compatibility alias: some code imports `recordStreak`.
 */
export const recordStreak = updateStreak;

function getStreakBonusXP(current) {
  if (current === 7) return 100;
  if (current === 14) return 150;
  if (current === 30) return 500;
  if (current === 100) return 1500;
  return 0;
}

// ======================================
// ACHIEVEMENT SYSTEM (violin-specific)
// ======================================

export function loadAchievements() {
  return loadJSON(STORAGE_KEYS.ACHIEVEMENTS, { unlocked: [], progress: {} });
}

/**
 * Unlock an achievement and grant a small XP reward.
 * NOTE: `meta` argument is accepted for backwards compatibility, but events use `metadata`.
 */
export function unlockAchievement(id, meta = {}) {
  const ach = loadAchievements();
  ach.unlocked = safeArray(ach.unlocked, []);
  ach.progress = safeObject(ach.progress, {});

  if (ach.unlocked.includes(id)) return false;

  ach.unlocked.push(id);
  ach.progress[id] = { unlockedAt: Date.now(), ...safeObject(meta, {}) };
  saveJSON(STORAGE_KEYS.ACHIEVEMENTS, ach);

  addXP(25, `achievement_${id}`, {
    source: 'achievement',
    metadata: { id }
  });

  sessionTracker?.trackActivity?.('achievement', 'unlock', { id, meta });

  // Optional hooks
  try {
    analyzePerformance?.({ type: 'achievement_unlock', id, meta });
  } catch {
    // ignore
  }

  return true;
}

export function checkAchievements() {
  const stats = safeObject(loadJSON(STORAGE_KEYS.STATS, {}), {});
  const streak = loadStreak();
  const xp = loadXP();
  const newUnlocks = [];

  const byModule = safeObject(stats.byModule, {});

  const ACHIEVEMENTS = [
    // First steps
    { id: 'first_note',    check: () => (Number(stats.total) || 0) >= 1 },
    { id: 'first_streak',  check: () => (Number(streak.current) || 0) >= 3 },

    // Module mastery (90%+, 50 attempts)
    {
      id: 'intervals_master',
      check: () => {
        const m = byModule.intervals;
        return m?.total >= 50 && m.correct / m.total >= 0.9;
      }
    },
    {
      id: 'keys_master',
      check: () => {
        const m = byModule.keySignatures;
        return m?.total >= 50 && m.correct / m.total >= 0.9;
      }
    },
    {
      id: 'rhythm_master',
      check: () => {
        const m = byModule.rhythm;
        return m?.total >= 50 && m.correct / m.total >= 0.9;
      }
    },
    {
      id: 'bieler_master',
      check: () => {
        const m = byModule.bieler;
        return m?.total >= 50 && m.correct / m.total >= 0.9;
      }
    },

    // Milestones
    { id: '100_questions',  check: () => (Number(stats.total) || 0) >= 100 },
    { id: '500_questions',  check: () => (Number(stats.total) || 0) >= 500 },
    { id: '1000_questions', check: () => (Number(stats.total) || 0) >= 1000 },
    { id: 'level_10',       check: () => xp >= 3000 },
    { id: 'week_7',         check: () => (Number(streak.best) || 0) >= 7 },
    { id: 'month_30',       check: () => (Number(streak.best) || 0) >= 30 },

    // Long-term dedication
    { id: 'year_100',       check: () => (Number(streak.best) || 0) >= 100 },

    // Spaced repetition mastery
    {
      id: 'sm2_retention_85',
      check: () => {
        try {
          const sm2 = getSM2Stats?.();
          return sm2 && typeof sm2.retention === 'number' && sm2.retention >= 0.85;
        } catch {
          return false;
        }
      }
    }
  ];

  for (const { id, check } of ACHIEVEMENTS) {
    let ok = false;
    try {
      ok = !!check();
    } catch {
      ok = false;
    }
    if (ok && unlockAchievement(id)) newUnlocks.push(id);
  }

  return newUnlocks;
}

// ======================================
// STATS RECORDING (All modules call this)
// ======================================

export function recordAnswer(module, isCorrect, responseTime = 0) {
  const stats = safeObject(loadJSON(STORAGE_KEYS.STATS, { total: 0, correct: 0, byModule: {} }), {
    total: 0,
    correct: 0,
    byModule: {}
  });

  stats.total = (Number(stats.total) || 0) + 1;
  if (isCorrect) stats.correct = (Number(stats.correct) || 0) + 1;

  if (!stats.byModule) stats.byModule = {};
  if (!stats.byModule[module]) stats.byModule[module] = { total: 0, correct: 0, avgResponseTime: 0 };

  const mod = stats.byModule[module];
  mod.total = (Number(mod.total) || 0) + 1;
  if (isCorrect) mod.correct = (Number(mod.correct) || 0) + 1;

  if (responseTime > 0) {
    const prevAvg = Number(mod.avgResponseTime) || 0;
    mod.avgResponseTime = Math.round((prevAvg * (mod.total - 1) + responseTime) / mod.total);
  }

  saveJSON(STORAGE_KEYS.STATS, stats);

  sessionTracker?.trackActivity?.('answer', 'record', {
    module,
    isCorrect,
    responseTime,
    total: stats.total,
    correct: stats.correct
  });

  // Optional: let analytics/coach react immediately (best-effort)
  try {
    analyzePerformance?.({ type: 'answer', module, isCorrect, responseTime, stats });
  } catch {
    // ignore
  }

  checkAchievements();
  return stats;
}

// ======================================
// DASHBOARD SUMMARY (MainMenu, Dashboard)
// ======================================

export function getStatsSummary() {
  const stats = safeObject(loadJSON(STORAGE_KEYS.STATS, {}), {});
  const xp = loadXP();
  const level = getLevel(xp);
  const streak = loadStreak();
  const achievements = loadAchievements();
  const nextLevelProgress = getNextLevelProgress(xp);

  const total = Number(stats.total) || 0;
  const correct = Number(stats.correct) || 0;

  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  return {
    level: level.title,
    levelBadge: level.badge,
    levelNumber: level.level,
    xp,
    progress: getLevelProgress(xp),
    xpToNextLevel: getXPToNextLevel(xp),
    nextLevel: nextLevelProgress.nextLevel,
    accuracy,
    totalQuestions: total,
    streak: Number(streak.current) || 0,
    bestStreak: Number(streak.best) || 0,
    achievements: safeArray(achievements.unlocked, []).length,
    moduleStats: Object.entries(safeObject(stats.byModule, {})).map(([k, v]) => ({
      module: k.replace(/([A-Z])/g, ' $1').trim(),
      key: k,
      accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      attempts: v.total || 0,
      avgResponseTime: v.avgResponseTime || 0
    }))
  };
}

// ======================================
// DATA MANAGEMENT
// ======================================

export function resetProgress() {
  // Use actual storage keys (not "XP"/"STREAK" string indirection).
  saveJSON(STORAGE_KEYS.XP, 0);
  saveJSON(STORAGE_KEYS.STREAK, { current: 0, best: 0, lastDate: null });
  saveJSON(STORAGE_KEYS.STATS, { total: 0, correct: 0, byModule: {} });
  saveJSON(STORAGE_KEYS.ACHIEVEMENTS, { unlocked: [], progress: {} });

  // Keep analytics but clear events, so dashboards don't explode.
  const analytics = safeObject(loadJSON(STORAGE_KEYS.ANALYTICS, {}), {});
  analytics.events = [];
  saveJSON(STORAGE_KEYS.ANALYTICS, analytics);

  sessionTracker?.trackActivity?.('progress', 'reset', { at: Date.now() });
  return true;
}

export function exportProgress() {
  return {
    xp: loadXP(),
    streak: loadStreak(),
    stats: loadJSON(STORAGE_KEYS.STATS, {}),
    achievements: loadAchievements(),
    analytics: loadJSON(STORAGE_KEYS.ANALYTICS, {}),
    exportedAt: Date.now()
  };
}
