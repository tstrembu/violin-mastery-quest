/**
 * Gamification Engine
 * Handles XP, levels, streaks, and achievements
 */

import { 
  loadXP, saveXP, 
  loadLevel, saveLevel,
  loadStreak, saveStreak,
  loadLastPractice, saveLastPractice,
  loadAchievements, saveAchievements,
  loadDailyGoal, saveDailyGoal
} from '../config/storage.js';

import { 
  XP_VALUES, 
  LEVEL_THRESHOLDS, 
  ACHIEVEMENTS,
  DAILY_GOALS 
} from '../config/constants.js';

/**
 * Award XP to the player
 * @param {number} amount - XP to award
 * @param {string} reason - Reason for XP (for logging)
 * @returns {number} New total XP
 */
export function awardXP(amount, reason = '') {
  const currentXP = loadXP();
  const newXP = currentXP + amount;
  saveXP(newXP);
  
  // Check for level up
  const currentLevel = loadLevel();
  const newLevel = calculateLevel(newXP);
  
  if (newLevel > currentLevel) {
    saveLevel(newLevel);
    return { xp: newXP, level: newLevel, leveledUp: true };
  }
  
  // Update daily goal
  updateDailyGoalXP(amount);
  
  return { xp: newXP, level: currentLevel, leveledUp: false };
}

/**
 * Calculate level from XP
 * @param {number} xp - Total XP
 * @returns {number} Current level
 */
export function calculateLevel(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].xp) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 1;
}

/**
 * Get XP needed for next level
 * @returns {object} { current, needed, progress }
 */
export function getXPProgress() {
  const xp = loadXP();
  const level = loadLevel();
  
  const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === level);
  const nextThreshold = LEVEL_THRESHOLDS.find(t => t.level === level + 1);
  
  if (!nextThreshold) {
    return { current: xp, needed: 0, progress: 100, maxLevel: true };
  }
  
  const xpInLevel = xp - currentThreshold.xp;
  const xpNeeded = nextThreshold.xp - currentThreshold.xp;
  const progress = Math.round((xpInLevel / xpNeeded) * 100);
  
  return { 
    current: xpInLevel, 
    needed: xpNeeded, 
    progress,
    maxLevel: false 
  };
}

/**
 * Update practice streak
 * @returns {number} Current streak
 */
export function updateStreak() {
  const today = new Date().toISOString().substring(0, 10);
  const lastPractice = loadLastPractice();
  let streak = loadStreak();
  
  if (!lastPractice) {
    // First practice ever
    streak = 1;
  } else if (lastPractice === today) {
    // Already practiced today, no change
    return streak;
  } else {
    const lastDate = new Date(lastPractice);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      streak += 1;
      
      // Award streak bonus
      if (streak % 7 === 0) {
        awardXP(XP_VALUES.STREAK_BONUS * 7, `${streak}-day streak bonus`);
      }
    } else {
      // Streak broken
      streak = 1;
    }
  }
  
  saveStreak(streak);
  saveLastPractice(today);
  
  return streak;
}

/**
 * Check and unlock achievements
 * @param {string} type - Type of achievement trigger
 * @param {object} data - Context data
 * @returns {array} Newly unlocked achievements
 */
export function checkAchievements(type, data = {}) {
  const unlocked = loadAchievements();
  const newUnlocks = [];
  
  ACHIEVEMENTS.forEach(achievement => {
    if (unlocked.includes(achievement.id)) return;
    
    let shouldUnlock = false;
    
    switch (achievement.id) {
      case 'first_steps':
        shouldUnlock = true;
        break;
        
      case 'week_warrior':
        shouldUnlock = loadStreak() >= 7;
        break;
        
      case 'interval_master':
        shouldUnlock = type === 'accuracy' && 
                       data.module === 'intervals' && 
                       data.accuracy >= 90;
        break;
        
      case 'rhythm_expert':
        shouldUnlock = type === 'accuracy' && 
                       data.module === 'rhythm' && 
                       data.accuracy >= 90;
        break;
        
      case 'key_sage':
        shouldUnlock = type === 'accuracy' && 
                       data.module === 'keySignatures' && 
                       data.accuracy >= 90;
        break;
        
      case 'bieler_scholar':
        shouldUnlock = type === 'accuracy' && 
                       data.module === 'bieler' && 
                       data.accuracy >= 90;
        break;
        
      case 'practice_dedicated':
        shouldUnlock = loadStreak() >= 30;
        break;
    }
    
    if (shouldUnlock) {
      unlocked.push(achievement.id);
      newUnlocks.push(achievement);
      awardXP(achievement.xp, `Achievement: ${achievement.name}`);
    }
  });
  
  if (newUnlocks.length > 0) {
    saveAchievements(unlocked);
  }
  
  return newUnlocks;
}

/**
 * Update daily goal progress
 */
function updateDailyGoalXP(xp) {
  const today = new Date().toISOString().substring(0, 10);
  let goal = loadDailyGoal();
  
  if (goal.date !== today) {
    // New day, reset goal
    goal = {
      date: today,
      xpEarned: xp,
      itemsCompleted: 0,
      minutesPracticed: 0
    };
  } else {
    goal.xpEarned += xp;
  }
  
  saveDailyGoal(goal);
}

/**
 * Increment daily items completed
 */
export function incrementDailyItems() {
  const today = new Date().toISOString().substring(0, 10);
  let goal = loadDailyGoal();
  
  if (goal.date !== today) {
    goal = {
      date: today,
      xpEarned: 0,
      itemsCompleted: 1,
      minutesPracticed: 0
    };
  } else {
    goal.itemsCompleted += 1;
  }
  
  saveDailyGoal(goal);
}

/**
 * Get daily goal status
 * @param {string} profile - User profile type
 * @returns {object} Goal progress
 */
export function getDailyGoalStatus(profile = 'intermediate') {
  const goal = loadDailyGoal();
  const target = DAILY_GOALS[profile.toUpperCase()] || DAILY_GOALS.INTERMEDIATE;
  
  const today = new Date().toISOString().substring(0, 10);
  
  if (goal.date !== today) {
    return {
      xpProgress: 0,
      itemsProgress: 0,
      xpTarget: target.xpTarget,
      itemsTarget: target.itemsTarget,
      completed: false
    };
  }
  
  const xpProgress = Math.round((goal.xpEarned / target.xpTarget) * 100);
  const itemsProgress = Math.round((goal.itemsCompleted / target.itemsTarget) * 100);
  const completed = xpProgress >= 100 && itemsProgress >= 100;
  
  if (completed && !goal.completedAwardGiven) {
    awardXP(XP_VALUES.DAILY_GOAL_MET, 'Daily goal completed');
    goal.completedAwardGiven = true;
    saveDailyGoal(goal);
  }
  
  return {
    xpEarned: goal.xpEarned,
    itemsCompleted: goal.itemsCompleted,
    xpProgress: Math.min(100, xpProgress),
    itemsProgress: Math.min(100, itemsProgress),
    xpTarget: target.xpTarget,
    itemsTarget: target.itemsTarget,
    completed
  };
}
