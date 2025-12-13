// ====================================
// VMQ GAMIFICATION v3.0
// XP • Levels • Streaks • Achievements • Adaptive Rewards
// Deep integration with Analytics, Coach, SM-2, Planner
// ====================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { sessionTracker } from './sessionTracker.js';
import { analyzePerformance } from './analytics.js';
import { getStats as getSM2Stats } from './spacedRepetition.js';

// ... (Existing functions loadXP, saveXP, logXPEvent remain unchanged)

/**
 * Add XP + auto-level check + achievement scan + analytics logging
 */
export function addXP(amount, reason = 'practice', { source = 'core', metadata = {} } = {}) {
  if (!amount || amount === 0) {
    return {
      oldXP: loadXP(),
      newXP: loadXP(),
      oldLevel: getLevel(loadXP()),
      newLevel: getLevel(loadXP()),
      leveledUp: false
    };
  }

  const oldXP = loadXP();
  const newXP = oldXP + amount;
  saveXP(newXP);

  const oldLevel = getLevel(oldXP);
  const newLevel = getLevel(newXP);
  const leveledUp = newLevel.level > oldLevel.level;

  // XP analytics event
  const xpEvent = logXPEvent({ amount, reason, source, metadata });

  // Level up bonus + achievement
  if (leveledUp) {
    const bonus = calculateLevelBonus(newLevel.level);
    const bonusXP = Math.max(25, bonus);
    const bonusTotal = newXP + bonusXP;

    saveXP(bonusTotal);
    logXPEvent({
      amount: bonusXP,
      reason: 'level_bonus',
      source: 'system',
      metadata: { level: newLevel.level } // FIX: Changed 'meta' to 'metadata'
    });

    unlockAchievement(`level_${newLevel.level}`, { level: newLevel.level });
    sessionTracker.trackActivity?.('level', 'up', {
      from: oldLevel.level,
      to: newLevel.level,
      bonusXP
    });
  }

  // Re-check achievements with new XP/level
  checkAchievements();

  return { oldXP, newXP: loadXP(), oldLevel, newLevel, leveledUp, xpEvent };
}

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

  let xp = 10 * difficulty; // Base 10 XP per difficulty

  // Streak multiplier (encourages chains of correct answers)
  if (streak >= 3) {
    xp += Math.min(streak, 10) * 2;
  }

  // Speed bonus (<2s) but with cap to avoid spammy tapping
  if (responseTime > 0 && responseTime < 2000) {
    xp += 3;
  }

  // Accuracy window bonus: reward sustained high accuracy in recent window
  if (accuracyWindow && accuracyWindow.questions >= 10 && accuracyWindow.accuracy >= 90) {
    xp += 5;
  }

  // Light diminishing returns in very long sessions (anti-grind)
  if (accuracyWindow && accuracyWindow.questions >= 100) {
    xp = Math.round(xp * 0.8);
  }

  addXP(xp, `${module}_correct`, {
    source: 'practice',
    metadata: { module, streak, difficulty, responseTime } // FIX: Changed 'meta' to 'metadata'
  });

  // Notify session tracker for per-session XP analytics
  sessionTracker.trackActivity?.('xp', 'practice_gain', {
    module,
    xp,
    streak,
    difficulty,
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
  return LEVELS.reduce((best, lvl) => (xp >= lvl.minXP ? lvl : best), LEVELS[0]);
}

/**
 * 🎯 FIXED: Router dependency satisfied
 * Simple wrapper for router.js's call to getUserLevel()
 */
export function getUserLevel() {
  return getLevel().level;
}

/**
 * For dashboard / coach: exposes current, next, and percentage
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
  return (nextLevel > getLevel(xp).level) ? (required - current) : 0;
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
  const streak = loadStreak();
  const today = new Date().toISOString().split('T')[0];

  if (streak.lastDate === today) return streak; // Already today

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let current = 1;

  if (streak.lastDate === yesterday) {
    current = streak.current + 1;
  }

  const best = Math.max(streak.best, current);
  const data = { current, best, lastDate: today };
  saveStreak(data);

  // Streak bonuses (adaptive)
  const bonusXP = getStreakBonusXP(current);
  if (bonusXP > 0) {
    addXP(bonusXP, 'streak_bonus', {
      source: 'streak',
      meta { streak: current }
    });
    sessionTracker.trackActivity?.('streak', 'milestone', { streak: current, bonusXP });
  }

  return data;
}

function getStreakBonusXP(current) {
  if (current === 7) return 100;
  if (current === 14) return 150;
  if (current === 30) return 500;
  if (current === 100) return 1500;
  return 0;
}

// ======================================
// ACHIEVEMENT SYSTEM (30+ violin-specific)
// ======================================

export function loadAchievements() {
  return loadJSON(STORAGE_KEYS.ACHIEVEMENTS, { unlocked: [], progress: {} });
}

export function unlockAchievement(id, meta = {}) {
  const ach = loadAchievements();
  if (ach.unlocked.includes(id)) return false;

  ach.unlocked.push(id);
  ach.progress[id] = { unlockedAt: Date.now(), ...meta };
  saveJSON(STORAGE_KEYS.ACHIEVEMENTS, ach);

  addXP(25, `achievement_${id}`, { source: 'achievement', meta { id } });
  sessionTracker.trackActivity?.('achievement', 'unlock', { id, meta });

  // Hook for Toast/Coach: VMQToast listens to sessionTracker or progress
  return true;
}

export function checkAchievements() {
  const stats = loadJSON(STORAGE_KEYS.STATS, {});
  const streak = loadStreak();
  const xp = loadXP();
  const newUnlocks = [];

  const ACHIEVEMENTS = [
    // First steps
    { id: 'first_note',    check: () => stats.total >= 1 },
    { id: 'first_streak',  check: () => streak.current >= 3 },

    // Module mastery (90%+, 50 attempts)
    { id: 'intervals_master', check: () => {
        const m = stats.byModule?.intervals;
        return m?.total >= 50 && (m.correct/m.total) >= 0.9;
      }
    },
    { id: 'keys_master', check: () => {
        const m = stats.byModule?.keySignatures;
        return m?.total >= 50 && (m.correct/m.total) >= 0.9;
      }
    },
    { id: 'rhythm_master', check: () => {
        const m = stats.byModule?.rhythm;
        return m?.total >= 50 && (m.correct/m.total) >= 0.9;
      }
    },
    { id: 'bieler_master', check: () => {
        const m = stats.byModule?.bieler;
        return m?.total >= 50 && (m.correct/m.total) >= 0.9;
      }
    },

    // Milestones
    { id: '100_questions',  check: () => stats.total >= 100 },
    { id: '500_questions',  check: () => stats.total >= 500 },
    { id: '1000_questions', check: () => stats.total >= 1000 },
    { id: 'level_10',       check: () => xp >= 3000 },
    { id: 'week_7',         check: () => streak.best >= 7 },
    { id: 'month_30',       check: () => streak.best >= 30 },

    // Long-term dedication
    { id: 'year_100',       check: () => streak.best >= 100 },

    // Spaced repetition mastery (from SM-2 stats)
    { id: 'sm2_retention_85', check: () => {
        try {
          const sm2 = getSM2Stats?.();
          return sm2 && sm2.retention >= 0.85;
        } catch {
          return false;
        }
      }
    }
  ];

  ACHIEVEMENTS.forEach(({ id, check }) => {
    if (check() && unlockAchievement(id)) newUnlocks.push(id);
  });

  return newUnlocks;
}

// ======================================
// STATS RECORDING (All modules call this)
// ======================================

export function recordAnswer(module, isCorrect, responseTime = 0) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { total: 0, correct: 0, byModule: {} });

  stats.total += 1;
  if (isCorrect) stats.correct += 1;

  if (!stats.byModule[module]) {
    stats.byModule[module] = { total: 0, correct: 0, avgResponseTime: 0 };
  }

  const mod = stats.byModule[module];
  mod.total += 1;
  if (isCorrect) mod.correct += 1;

  if (responseTime > 0) {
    const prevAvg = mod.avgResponseTime || 0;
    mod.avgResponseTime = Math.round((prevAvg * (mod.total - 1) + responseTime) / mod.total);
  }

  saveJSON(STORAGE_KEYS.STATS, stats);

  // Let Coach/Analytics react to fresh stats via analyzePerformance if needed
  sessionTracker.trackActivity?.('answer', 'record', {
    module,
    isCorrect,
    responseTime,
    total: stats.total,
    correct: stats.correct
  });

  checkAchievements();
}

// ======================================
// DASHBOARD SUMMARY (for MainMenu, Dashboard)
// ======================================

export function getStatsSummary() {
  const stats = loadJSON(STORAGE_KEYS.STATS, {});
  const xp = loadXP();
  const level = getLevel(xp);
  const streak = loadStreak();
  const achievements = loadAchievements();
  const nextLevelProgress = getNextLevelProgress(xp);

  const accuracy = stats.total
    ? Math.round((stats.correct / stats.total) * 100)
    : 0;

  return {
    level: level.title,
    levelBadge: level.badge,
    levelNumber: level.level,
    xp,
    progress: getLevelProgress(xp),
    xpToNextLevel: getXPToNextLevel(xp),
    nextLevel: nextLevelProgress.nextLevel,
    accuracy,
    totalQuestions: stats.total || 0,
    streak: streak.current,
    bestStreak: streak.best,
    achievements: achievements.unlocked.length,
    moduleStats: Object.entries(stats.byModule || {}).map(([k, v]) => ({
      module: k.replace(/([A-Z])/g,' $1').trim(),
      key: k,
      accuracy: v.total ? Math.round((v.correct/v.total)*100) : 0,
      attempts: v.total || 0,
      avgResponseTime: v.avgResponseTime || 0
    }))
  };
}

// ======================================
// DATA MANAGEMENT
// ======================================

export function resetProgress() {
  ['XP', 'STREAK', 'STATS', 'ACHIEVEMENTS', 'ANALYTICS'].forEach(key =>
    saveJSON(
      STORAGE_KEYS[key],
      key === 'STATS' ? { total: 0, correct: 0, byModule: {} } : null
    )
  );
}

export function exportProgress() {
  return {
    xp: loadXP(),
    streak: loadStreak(),
    stats: loadJSON(STORAGE_KEYS.STATS, {}),
    achievements: loadAchievements(),
    exportedAt: Date.now()
  };
}
