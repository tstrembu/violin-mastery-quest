// ======================================
// VMQ COACH ENGINE - AI Practice Intelligence
// 7-Day Plans + Daily Insights + Bieler Integration
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { loadXP, loadStreak, getLevel } from './gamification.js';
import { analyzePerformance } from './analytics.js';
import { REPERTOIRE_PLANS } from '../config/repertoirePlans.js';

// ======================================
// CORE COACH INSIGHTS
// ======================================

/**
 * Complete coach dashboard (called by CoachPanel.js)
 */
export function getCoachInsights(profile = {}) {
  const stats = loadJSON(STORAGE_KEYS.STATS, {});
  const xp = loadXP();
  const streak = loadStreak();
  const level = getLevel(xp);
  
  // Analytics integration
  const perf = analyzePerformance('week');
  const moduleStats = Object.entries(stats.byModule || {}).map(([module, data]) => ({
    module: formatModuleName(module),
    accuracy: Math.round((data.correct / data.total) * 100) || 0,
    attempts: data.total || 0
  }));

  const strengths = moduleStats.filter(m => m.accuracy >= 80 && m.attempts >= 10);
  const weaknesses = moduleStats.filter(m => m.accuracy < 70 && m.attempts >= 5);

  return {
    greeting: generateGreeting(profile.name, streak, perf.overallAccuracy),
    motivationalMessage: generateMotivation(streak, xp, perf.overallAccuracy),
    keyMetrics: {
      overallAccuracy: perf.overallAccuracy,
      consistency: perf.consistencyScore,
      avgResponseTime: perf.avgResponseTime,
      streak,
      level: level.title
    },
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    recommendations: generateRecommendations({
      weaknesses,
      strengths,
      consistency: perf.consistencyScore,
      streak
    }),
    todaysPlan: generateTodaysPlan(profile, weaknesses, strengths),
    weekPreview: generateWeekPreview(weaknesses, strengths, level.level)
  };
}

// ======================================
// DAILY PLANNING
// ======================================

/**
 * Today's optimized practice plan
 */
export function generateTodaysPlan(profile, weaknesses, strengths) {
  const level = profile?.level || 'beginner';
  const plan = {
    title: `Daily Practice - ${level.charAt(0).toUpperCase() + level.slice(1)}`,
    totalDuration: 30,
    sections: [],
    bielerFocus: getDailyBielerFocus(level)
  };

  // 1. Warm-up (always)
  plan.sections.push({
    id: 'warmup',
    activity: 'Open Strings + Scales',
    duration: 5,
    module: 'bieler',
    goal: 'Tone production & hand frame',
    priority: 'essential'
  });

  // 2. Primary weakness (double time)
  if (weaknesses?.[0]) {
    plan.sections.push({
      id: 'primary',
      activity: `${weaknesses[0].module} Focus`,
      duration: 10,
      module: weaknesses[0].module.toLowerCase(),
      goal: `Improve from ${weaknesses[0].accuracy}% → 75%+`,
      priority: 'high'
    });
  }

  // 3. Secondary skill + maintenance
  const secondary = strengths?.[0]?.module || 'intervals';
  plan.sections.push({
    id: 'secondary',
    activity: `${secondary} Review`,
    duration: 7,
    module: secondary.toLowerCase(),
    goal: 'Maintain mastery (80%+ accuracy)',
    priority: 'medium'
  });

  // 4. Bieler technique
  plan.sections.push({
    id: 'technique',
    activity: 'Bieler Method',
    duration: 5,
    module: 'bieler',
    goal: plan.bielerFocus.goal,
    priority: 'essential'
  });

  // 5. Reflection
  plan.sections.push({
    id: 'reflection',
    activity: 'Session Review',
    duration: 3,
    type: 'reflection',
    prompt: getReflectionPrompt({}),
    priority: 'essential'
  });

  return plan;
}

/**
 * 7-Day tactical plan preview
 */
export function generateWeekPreview(weaknesses, strengths, level) {
  return {
    theme: determinePlanTheme(weaknesses, strengths),
    days: [
      { day: 'Mon', focus: 'Foundation', duration: 25, primary: weaknesses?.[0]?.module },
      { day: 'Tue', focus: 'Speed', duration: 28, primary: weaknesses?.[0]?.module },
      { day: 'Wed', focus: 'Accuracy', duration: 30, primary: weaknesses?.[1]?.module },
      { day: 'Thu', focus: 'Integration', duration: 32, primary: 'rhythm' },
      { day: 'Fri', focus: 'Review', duration: 25, primary: 'bieler' },
      { day: 'Sat', focus: 'Challenge', duration: 35, primary: strengths?.[0]?.module },
      { day: 'Sun', focus: 'Rest/Reflect', duration: 15, primary: 'reflection' }
    ]
  };
}

// ======================================
// BIELER METHOD INTEGRATION
// ======================================

function getDailyBielerFocus(level) {
  const focuses = {
    beginner: { term: 'First Trained Function', goal: 'Perfect 4th hand frame' },
    intermediate: { term: 'Bow Division', goal: 'Even tone across bow' },
    advanced: { term: 'Sound Point', goal: 'Optimal contact point' }
  };
  return focuses[level] || focuses.beginner;
}

// ======================================
// PERSONALIZATION ENGINE
// ======================================

function generateGreeting(name, streak, accuracy) {
  const hour = new Date().getHours();
  const timePrefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = name || 'Violinist';
  
  if (streak >= 7) return `${timePrefix}, ${userName}! 🔥 ${streak}-day streak!`;
  if (accuracy >= 85) return `${timePrefix}, ${userName}! 🎯 Precision master!`;
  return `${timePrefix}, ${userName}! Ready to practice?`;
}

function generateMotivation(streak, xp, accuracy) {
  if (streak >= 14) return "Legendary consistency! You're building mastery.";
  if (accuracy >= 90) return "Precision like a pro! Now add speed.";
  if (streak >= 3) return "Great streak! Momentum is building.";
  return "Every note you play makes you better. Let's go!";
}

// ======================================
// RECOMMENDATIONS ENGINE
// ======================================

function generateRecommendations({ weaknesses, strengths, consistency, streak }) {
  const recs = [];

  // Weakness focus
  weaknesses?.slice(0, 2).forEach(weak => {
    recs.push({
      type: 'focus',
      title: `${formatModuleName(weak.module)}`,
      message: `${weak.accuracy}% accuracy - prioritize today`,
      action: `→ #${weak.module.toLowerCase()}`
    });
  });

  // Consistency
  if (consistency < 50) {
    recs.push({
      type: 'warning',
      title: 'Practice Habit',
      message: `${consistency}% consistency - aim for 4+ days/week`,
      action: 'Daily 15-min sessions'
    });
  }

  // Streak
  if (streak === 0) {
    recs.push({
      type: 'motivation',
      title: 'Start Today!',
      message: 'Even 10 minutes builds momentum',
      action: '→ #menu'
    });
  }

  // Bieler always
  recs.push({
    type: 'essential',
    title: 'Bieler Technique',
    message: 'Daily technique = compound interest for violin',
    action: '→ #bieler'
  });

  return recs.slice(0, 5);
}

// ======================================
// UTILITIES
// ======================================

function formatModuleName(module) {
  const map = {
    intervals: 'Intervals', keys: 'Key Signatures', 
    rhythm: 'Rhythm', bieler: 'Bieler Technique'
  };
  return map[module] || module.charAt(0).toUpperCase() + module.slice(1);
}

function determinePlanTheme(weaknesses, strengths) {
  if (!weaknesses?.length) return 'Maintenance Mode';
  const primary = weaknesses[0].module;
  const themes = {
    intervals: 'Intonation Foundation',
    rhythm: 'Rhythmic Precision', 
    keys: 'Key Mastery',
    bieler: 'Technical Development'
  };
  return themes[primary] || 'Balanced Development';
}

function getReflectionPrompt(sessionData = {}) {
  const accuracy = sessionData.accuracy || 75;
  
  if (accuracy < 60) return {
    question: 'What was most challenging today?',
    followUp: 'Break it into smaller steps tomorrow'
  };
  
  return {
    question: 'What felt strongest today?',
    followUp: 'Build on that strength tomorrow'
  };
}

// Track plan completion
export function completePlanSection(sectionId, timeSpent) {
  const coachState = loadJSON(STORAGE_KEYS.COACH_STATE, { 
    completedSections: [],
    lastPlanDate: null 
  });
  
  coachState.completedSections.push({
    sectionId,
    completedAt: Date.now(),
    timeSpent
  });
  
  saveJSON(STORAGE_KEYS.COACH_STATE, coachState);
  return coachState;
}

console.log('[Coach] VMQ AI Coach loaded');
