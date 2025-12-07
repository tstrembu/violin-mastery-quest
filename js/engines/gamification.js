// ======================================
// VMQ GAMIFICATION v2.0 - XP, Levels, Streaks, Achievements
// Powers ALL 50+ modules + SessionTracker integration
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { sessionTracker } from './sessionTracker.js';

// ======================================
// XP SYSTEM (SessionTracker auto-sync)
// ======================================

/** Load total XP */
export function loadXP() {
  return loadJSON(STORAGE_KEYS.XP, 0);
}

/** Save XP */
export function saveXP(xp) {
  return saveJSON(STORAGE_KEYS.XP, Math.max(0, xp));
}

/** Add XP + auto-level check + achievement scan */
export function addXP(amount, reason = 'practice') {
  const oldXP = loadXP();
  const newXP = oldXP + amount;
  saveXP(newXP);
  
  const oldLevel = getLevel(oldXP);
  const newLevel = getLevel(newXP);
  const leveledUp = newLevel.level > oldLevel.level;
  
  // XP analytics
  const analytics = loadJSON(STORAGE_KEYS.ANALYTICS, { totalXPEarned: 0, xpHistory: [] });
  analytics.totalXPEarned += amount;
  analytics.xpHistory.unshift({ amount, reason, timestamp: Date.now(), total: newXP });
  saveJSON(STORAGE_KEYS.ANALYTICS, { 
    ...analytics, 
    xpHistory: analytics.xpHistory.slice(0, 100) 
  });
  
  // Level up bonus + achievement
  if (leveledUp) {
    saveXP(newXP + 50); // Level bonus
    unlockAchievement(`level_${newLevel.level}`);
  }
  
  checkAchievements();
  
  return { oldXP, newXP, oldLevel, newLevel, leveledUp };
}

/** Auto XP from practice (Intervals.js calls) */
export function awardPracticeXP(module, isCorrect, { streak = 0, difficulty = 1, responseTime = 0 } = {}) {
  if (!isCorrect) return 0;
  
  let xp = 10 * difficulty; // Base 10 XP
  
  // Streak multiplier
  if (streak >= 3) xp += Math.min(streak, 10) * 2;
  
  // Speed bonus (<2s)
  if (responseTime > 0 && responseTime < 2000) xp += 3;
  
  addXP(xp, `${module}_correct`);
  return xp;
}

// ======================================
// LEVEL SYSTEM (20 violin levels)
// ======================================

export function getLevel(xp = loadXP()) {
  const LEVELS = [
    { level: 1, title: 'Beginner', minXP: 0, badge: '🎻', repertoire: 'Suzuki Bk1' },
    { level: 2, title: 'Note Reader', minXP: 50, badge: '📖', repertoire: 'Minuet G' },
    { level: 3, title: 'Interval Ear', minXP: 150, badge: '👂', repertoire: 'Bach A-minor' },
    { level: 4, title: 'Key Master', minXP: 300, badge: '🔑', repertoire: 'Kreutzer #1' },
    { level: 5, title: 'Rhythm Sense', minXP: 500, badge: '🥁', repertoire: 'Gavottes' },
    { level: 6, title: 'Bieler Basics', minXP: 800, badge: '🎼', repertoire: 'Suzuki Bk2' },
    { level: 7, title: 'Week Warrior', minXP: 1200, badge: '🔥', repertoire: 'Viotti' },
    { level: 8, title: 'Hand Frame', minXP: 1700, badge: '✋', repertoire: 'Kreutzer #2' },
    { level: 9, title: 'Bow Control', minXP: 2300, badge: '🎀', repertoire: 'Wieniawski' },
    { level: 10, title: 'Position I', minXP: 3000, badge: '📍', repertoire: 'Bruch VC' },
    { level: 11, title: 'Scales Pro', minXP: 3800, badge: '🎵', repertoire: 'Major scales' },
    { level: 12, title: 'Month Master', minXP: 4700, badge: '🏆', repertoire: 'Paganini' },
    { level: 13, title: 'Vibrato', minXP: 5700, badge: '✨', repertoire: 'Ysaye' },
    { level: 14, title: 'Shifting', minXP: 6800, badge: '⬆️', repertoire: '3rd pos' },
    { level: 15, title: 'Spiccato', minXP: 8000, badge: '💨', repertoire: 'Ševčík' },
    { level: 16, title: 'Arpeggio', minXP: 9300, badge: '🔄', repertoire: 'Bach Partita' },
    { level: 17, title: 'Double Stops', minXP: 10700, badge: '🎭', repertoire: 'Sonatas' },
    { level: 18, title: 'Cadenza', minXP: 12200, badge: '🌟', repertoire: 'Concerti' },
    { level: 19, title: 'Virtuoso', minXP: 13800, badge: '👑', repertoire: 'Caprices' },
    { level: 20, title: 'Maestro', minXP: 15500, badge: '🎻🏆', repertoire: 'All Repertoire' }
  ];
  
  return LEVELS.find(l => xp >= l.minXP) || LEVELS[0];
}

export function getXPToNextLevel(xp = loadXP()) {
  const level = getLevel(xp);
  const nextLevel = getLevel(xp + 1);
  return nextLevel.level > level.level ? nextLevel.minXP - xp : 0;
}

export function getLevelProgress(xp = loadXP()) {
  const level = getLevel(xp);
  const next = getLevel(xp + 1);
  if (next.level === level.level) return 100;
  return Math.round(((xp - level.minXP) / (next.minXP - level.minXP)) * 100);
}

// ======================================
// STREAK SYSTEM (SessionTracker auto-updates)
// ======================================

export function loadStreak() {
  return loadJSON(STORAGE_KEYS.STREAK, { current: 0, best: 0, lastDate: null });
}

export function saveStreak(streak) {
  return saveJSON(STORAGE_KEYS.STREAK, streak);
}

/** Called by SessionTracker on session end */
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
  
  // Streak bonuses
  if (current === 7) addXP(100, 'week_streak');
  if (current === 30) addXP(500, 'month_streak');
  
  return data;
}

// ======================================
// ACHIEVEMENT SYSTEM (25 violin-specific)
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
  addXP(25, `achievement_${id}`);
  return true;
}

export function checkAchievements() {
  const stats = loadJSON(STORAGE_KEYS.STATS, {});
  const streak = loadStreak();
  const xp = loadXP();
  const newUnlocks = [];
  
  const ACHIEVEMENTS = [
    // First steps
    { id: 'first_note', check: () => stats.total >= 1 },
    { id: 'first_streak', check: () => streak.current >= 3 },
    
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
    { id: '100_questions', check: () => stats.total >= 100 },
    { id: '500_questions', check: () => stats.total >= 500 },
    { id: '1000_questions', check: () => stats.total >= 1000 },
    { id: 'level_10', check: () => xp >= 3000 },
    { id: 'week_7', check: () => streak.best >= 7 },
    { id: 'month_30', check: () => streak.best >= 30 }
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
  checkAchievements();
}

// ======================================
// DASHBOARD SUMMARY
// ======================================

export function getStatsSummary() {
  const stats = loadJSON(STORAGE_KEYS.STATS, {});
  const xp = loadXP();
  const level = getLevel(xp);
  const streak = loadStreak();
  const achievements = loadAchievements();
  
  return {
    level: level.title,
    levelBadge: level.badge,
    xp,
    progress: getLevelProgress(xp),
    accuracy: stats.total ? Math.round((stats.correct/stats.total)*100) : 0,
    totalQuestions: stats.total || 0,
    streak: streak.current,
    bestStreak: streak.best,
    achievements: achievements.unlocked.length,
    moduleStats: Object.entries(stats.byModule || {}).map(([k,v]) => ({
      module: k.replace(/([A-Z])/g,' $1').trim(),
      accuracy: v.total ? Math.round((v.correct/v.total)*100) : 0,
      attempts: v.total || 0
    }))
  };
}

// ======================================
// DATA MANAGEMENT
// ======================================

export function resetProgress() {
  ['XP', 'STREAK', 'STATS', 'ACHIEVEMENTS', 'ANALYTICS'].forEach(key => 
    saveJSON(STORAGE_KEYS[key], key === 'STATS' ? { total: 0, correct: 0, byModule: {} } : null)
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
