// js/engines/coachEngine.js
// ======================================
// VMQ COACH ENGINE v2.1.2 - Compatibility + Stability Pass
// 7-Day Adaptive Plans + Learning Pattern Recognition + Bieler Pedagogy
//
// Goals:
// ✅ Keep all intended features of v2.1.1
// ✅ Provide missing/alias exports used by components (getRecommendations, etc.)
// ✅ Avoid Promise bugs (SRS functions may be async elsewhere)
// ✅ Robust to partial/messy stats & practice logs
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { loadXP, loadStreak, getLevel } from './gamification.js';
import * as analytics from './analytics.js';
import { BIELER_TAXONOMY } from '../config/constants.js';
import { getDueItems as _getDueItemsFromSRS } from './spacedRepetition.js';

// --------------------------------------
// Utilities (safe, no-throw)
// --------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeTrack(category, action, payload) {
  try {
    // sessionTracker is imported by other engines; coachEngine uses analytics + storage only.
    // If you later add sessionTracker here, keep this safe wrapper.
    // no-op for now
    void category; void action; void payload;
  } catch {
    // no-op
  }
}

/**
 * Some builds of spacedRepetition export async getDueItems().
 * Coach engine must remain sync-safe (components often call it without await).
 * So we compute due count directly from persisted deck in STORAGE_KEYS.SPACED_REPETITION.
 */
function getSrsDueSummarySync() {
  const deckObj = loadJSON(STORAGE_KEYS.SPACED_REPETITION, {});
  const obj = isObj(deckObj) ? deckObj : {};
  const now = Date.now();
  const GRACE_MS = Math.round(DAY_MS * 0.2); // ~4.8h grace

  let dueCount = 0;
  let duePriorityCount = 0;

  for (const item of Object.values(obj)) {
    if (!item || item.type === 'meta') continue;
    const due = safeNumber(item.due, Infinity);
    if (due <= now + GRACE_MS) {
      dueCount += 1;
      const interval = safeNumber(item.interval, 9999);
      if (interval < 7) duePriorityCount += 1;
    }
  }

  return { dueCount, duePriorityCount };
}

/**
 * Best-effort wrapper around analytics.analyzePerformance(period)
 * If analytics is missing/changed, fall back to storage-derived stats.
 */
function analyzePerformanceSafe(period = 'week') {
  try {
    if (typeof analytics?.analyzePerformance === 'function') {
      const res = analytics.analyzePerformance(period);
      if (isObj(res)) return res;
    }
  } catch {
    // fall through
  }

  // Fallback from STATS
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const practiceLog = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
  const recent = safeArray(practiceLog).slice(-20);

  const totalQuestions = safeNumber(
    Object.values(stats?.byModule || {}).reduce((sum, m) => sum + safeNumber(m?.total, 0), 0),
    0
  );

  const totalCorrect = safeNumber(
    Object.values(stats?.byModule || {}).reduce((sum, m) => sum + safeNumber(m?.correct, 0), 0),
    0
  );

  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const avgResponseTime =
    safeNumber(
      Object.values(stats?.byModule || {}).reduce((sum, m) => sum + safeNumber(m?.avgTime, 0), 0),
      0
    ) / Math.max(1, Object.keys(stats?.byModule || {}).length);

  const totalTime = safeNumber(recent.reduce((s, r) => s + safeNumber(r?.duration, 0), 0), 0);
  const xpGained = safeNumber(recent.reduce((s, r) => s + safeNumber(r?.xpGained, 0), 0), 0);

  return {
    overallAccuracy,
    consistencyScore: calculateWeeklyConsistency(recent),
    avgResponseTime: Math.round(avgResponseTime || 0),
    xpGained,
    totalQuestions,
    totalTime,
    period
  };
}

/**
 * Some builds/components might call getModuleProgress().
 * Keep a safe pass-through if analytics provides it.
 */
function getModuleProgressSafe(moduleKey) {
  try {
    if (typeof analytics?.getModuleProgress === 'function') {
      return analytics.getModuleProgress(moduleKey);
    }
  } catch {
    // ignore
  }
  return null;
}

// --------------------------------------
// Public API
// --------------------------------------

/**
 * Complete coach dashboard with practice intelligence.
 * SYNC SAFE.
 */
export function getCoachInsights(profile = {}) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const xp = loadXP();
  const streak = loadStreak();
  const levelObj = getLevel(xp) || { level: 1, title: 'Beginner' };

  const practiceLog = safeArray(loadJSON(STORAGE_KEYS.PRACTICE_LOG, []));
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, {
    learningStyle: 'balanced',
    preferredTime: null,
    goals: [],
    completedSections: [],
    lastPlanDate: null,
    totalPlanTime: 0
  });

  // Performance analysis
  const perf = analyzePerformanceSafe('week');
  const longTermPerf = analyzePerformanceSafe('month');
  const learningVelocity = calculateLearningVelocity(practiceLog);
  const moduleInsights = analyzeModulePerformance(stats.byModule || {});

  // Pattern recognition
  const patterns = detectLearningPatterns(practiceLog, stats);
  const plateaus = detectPlateaus(moduleInsights, practiceLog);
  const breakthroughs = detectBreakthroughs(practiceLog);

  // Bieler Method integration
  const bielerProgress = analyzeBielerProgress(stats, levelObj.level);
  const techniqueGaps = identifyTechniqueGaps(stats, levelObj.level);

  // Spaced repetition integration (SYNC-safe)
  const srs = getSrsDueSummarySync();
  const reviewPriority = srs.duePriorityCount;

  // Recommendations
  const recommendations = generateSmartRecommendations({
    moduleInsights,
    patterns,
    plateaus,
    techniqueGaps,
    reviewPriority,
    streak,
    level: levelObj.level,
    goals: safeArray(coachState.goals)
  });

  // Plans
  const todaysPlan = generateTodaysPlan(profile, moduleInsights, patterns, levelObj.level, reviewPriority);
  const weekPreview = generateWeekPreview(moduleInsights, patterns, levelObj.level, safeArray(coachState.goals));

  return {
    greeting: generateGreeting(profile?.name, streak, perf.overallAccuracy, new Date().getHours()),
    motivationalMessage: generateMotivation(streak, xp, perf.overallAccuracy, patterns),

    keyMetrics: {
      overallAccuracy: safeNumber(perf.overallAccuracy, 0),
      consistency: safeNumber(perf.consistencyScore, 0),
      avgResponseTime: safeNumber(perf.avgResponseTime, 0),
      learningVelocity,
      streak,
      level: levelObj.title || `Level ${levelObj.level || 1}`,
      xpThisWeek: safeNumber(perf.xpGained, 0),
      questionsThisWeek: safeNumber(perf.totalQuestions, 0),
      timeThisWeek: safeNumber(perf.totalTime, 0)
    },

    strengths: safeArray(moduleInsights.strengths).slice(0, 3),
    weaknesses: safeArray(moduleInsights.weaknesses).slice(0, 3),
    mastered: safeArray(moduleInsights.mastered),
    needsAttention: safeArray(moduleInsights.needsAttention),

    patterns: {
      learningStyle: patterns.dominantStyle,
      bestTimeOfDay: patterns.bestTimeOfDay,
      optimalSessionLength: patterns.optimalSessionLength,
      strengthsPattern: patterns.strengthsPattern,
      challengesPattern: patterns.challengesPattern
    },

    plateaus,
    breakthroughs: safeArray(breakthroughs).slice(0, 2),

    bielerInsights: {
      currentFocus: bielerProgress.currentFocus,
      progress: bielerProgress.progress,
      nextMilestone: bielerProgress.nextMilestone,
      techniqueGaps
    },

    recommendations,

    todaysPlan,
    weekPreview,

    reviewAlerts: reviewPriority > 5
      ? {
          count: reviewPriority,
          message: `${reviewPriority} flashcards need review (spaced repetition)`,
          action: 'flashcards'
        }
      : null,

    repertoireReadiness: assessRepertoireReadiness(stats, levelObj.level),

    // Extra: expose a couple helpers for dashboards that already expect them
    longTermPerf,
    coachState,
    srsSummary: srs
  };
}

// --------------------------------------
// Export/alias names often used by components
// --------------------------------------

/** Alias used by some components */
export const getCoachDashboard = getCoachInsights;

/** Alias: some components expect getRecommendations() */
export function getRecommendations(context = {}) {
  // If passed a full context, use it; otherwise compute minimal context from storage.
  if (context && isObj(context) && context.moduleInsights) {
    return generateSmartRecommendations(context);
  }

  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const practiceLog = safeArray(loadJSON(STORAGE_KEYS.PRACTICE_LOG, []));
  const xp = loadXP();
  const streak = loadStreak();
  const levelObj = getLevel(xp) || { level: 1, title: 'Beginner' };

  const moduleInsights = analyzeModulePerformance(stats.byModule || {});
  const patterns = detectLearningPatterns(practiceLog, stats);
  const plateaus = detectPlateaus(moduleInsights, practiceLog);
  const techniqueGaps = identifyTechniqueGaps(stats, levelObj.level);
  const srs = getSrsDueSummarySync();

  return generateSmartRecommendations({
    moduleInsights,
    patterns,
    plateaus,
    techniqueGaps,
    reviewPriority: srs.duePriorityCount,
    streak,
    level: levelObj.level,
    goals: safeArray(loadJSON(STORAGE_KEYS.COACH_DATA, {})?.goals)
  });
}

/** Aliases for plan generators */
export const getDailyPlan = generateTodaysPlan;
export const getWeeklyPlan = generateWeekPreview;
export const getCoachPlan = generateTodaysPlan;

/** If any component calls module progress from coach engine */
export const getModuleProgress = getModuleProgressSafe;

// --------------------------------------
// Advanced Performance Analysis
// --------------------------------------

function analyzeModulePerformance(byModule) {
  const byMod = isObj(byModule) ? byModule : {};

  const modules = Object.entries(byMod).map(([moduleKey, dataRaw]) => {
    const data = isObj(dataRaw) ? dataRaw : {};
    const total = safeNumber(data.total, 0);
    const correct = safeNumber(data.correct, 0);

    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    const recentAccuracy = calculateRecentAccuracy(data.history);
    const trend = recentAccuracy - accuracy;

    return {
      module: formatModuleName(moduleKey),
      moduleKey,
      accuracy: Math.round(accuracy),
      recentAccuracy: Math.round(recentAccuracy),
      trend: Math.round(trend),
      attempts: total,
      correct,
      avgResponseTime: safeNumber(data.avgTime, 0),
      lastPracticed: safeNumber(data.lastPracticed, 0),
      difficulty: data.difficulty || 'medium',
      consistency: calculateConsistency(data.history),
      mastery: calculateMastery(accuracy, total, recentAccuracy)
    };
  });

  const strengths = modules
    .filter(m => m.accuracy >= 80 && m.attempts >= 10 && m.consistency > 60)
    .sort((a, b) => b.mastery - a.mastery);

  const weaknesses = modules
    .filter(m => m.accuracy < 70 && m.attempts >= 5)
    .sort((a, b) => a.accuracy - b.accuracy);

  const mastered = modules.filter(m => m.mastery >= 90 && m.attempts >= 20);

  const needsAttention = modules
    .filter(m => m.attempts >= 10 && m.trend < -5)
    .sort((a, b) => a.trend - b.trend);

  const stagnant = modules.filter(m => m.attempts >= 15 && Math.abs(m.trend) < 2 && m.accuracy < 85);

  return { modules, strengths, weaknesses, mastered, needsAttention, stagnant };
}

function calculateLearningVelocity(practiceLog) {
  const recentSessions = safeArray(practiceLog).slice(-14);
  if (recentSessions.length === 0) return 0;

  const totalXP = recentSessions.reduce((sum, s) => sum + safeNumber(s?.xpGained, 0), 0);
  const totalMinutes = recentSessions.reduce((sum, s) => sum + safeNumber(s?.duration, 0), 0);

  return totalMinutes > 0 ? Math.round((totalXP / totalMinutes) * 60) : 0;
}

function detectLearningPatterns(practiceLog, stats) {
  const recentSessions = safeArray(practiceLog).slice(-30);

  const timeDistribution = recentSessions.reduce((acc, s) => {
    const ts = safeNumber(s?.timestamp, Date.now());
    const hour = new Date(ts).getHours();
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    acc[period] = (acc[period] || 0) + 1;
    return acc;
  }, {});

  const bestTimeOfDay =
    Object.entries(timeDistribution).sort(([, a], [, b]) => b - a)[0]?.[0] || 'morning';

  const avgSessionLength =
    recentSessions.length > 0
      ? Math.round(recentSessions.reduce((sum, s) => sum + safeNumber(s?.duration, 0), 0) / recentSessions.length)
      : 20;

  const modulePreferences = Object.entries(stats?.byModule || {})
    .map(([mod, dataRaw]) => {
      const data = isObj(dataRaw) ? dataRaw : {};
      const total = safeNumber(data.total, 0);
      const correct = safeNumber(data.correct, 0);
      const score = total > 0 ? (correct / total) * 100 : 0;
      return { module: mod, score, attempts: total };
    })
    .filter(m => m.attempts >= 5)
    .sort((a, b) => b.score - a.score);

  let dominantStyle = 'balanced';
  const top = modulePreferences[0]?.module?.toLowerCase?.() || '';
  if (top === 'intervals' || top === 'eartraining') dominantStyle = 'auditory';
  else if (top === 'fingerboard' || top === 'keys' || top === 'keysignatures') dominantStyle = 'visual';
  else if (top === 'bieler' || top === 'rhythm') dominantStyle = 'kinesthetic';

  return {
    bestTimeOfDay,
    optimalSessionLength: avgSessionLength,
    dominantStyle,
    strengthsPattern: modulePreferences.slice(0, 3),
    challengesPattern: modulePreferences.slice(-3).reverse(),
    consistencyPattern: calculateWeeklyConsistency(recentSessions)
  };
}

function detectPlateaus(moduleInsights, practiceLog) {
  const stagnants = safeArray(moduleInsights?.stagnant);
  const plateaus = stagnants.map(module => ({
    module: module.module,
    accuracy: module.accuracy,
    sessionsStuck: calculateStuckSessions(module.moduleKey, practiceLog),
    recommendation: generatePlateauBreaker(module),
    priority: module.accuracy < 75 ? 'high' : 'medium'
  }));

  return plateaus.filter(p => p.sessionsStuck >= 5);
}

function detectBreakthroughs(practiceLog) {
  const recentSessions = safeArray(practiceLog).slice(-10);
  const breakthroughs = [];

  for (let i = 1; i < recentSessions.length; i++) {
    const session = recentSessions[i] || {};
    const prev = recentSessions[i - 1] || {};

    const improvement = safeNumber(session.accuracy, 0) - safeNumber(prev.accuracy, 0);
    if (improvement >= 15 && safeNumber(session.accuracy, 0) >= 80) {
      breakthroughs.push({
        module: session.module || 'unknown',
        achievement: `${safeNumber(session.accuracy, 0)}% accuracy (up ${Math.round(improvement)}%)`,
        date: new Date(safeNumber(session.timestamp, Date.now())).toLocaleDateString(),
        message: generateBreakthroughMessage(session.module || 'unknown', Math.round(improvement))
      });
    }
  }

  return breakthroughs;
}

// --------------------------------------
// Bieler Method Integration
// --------------------------------------

function analyzeBielerProgress(stats, level) {
  const bielerStats = stats?.byModule?.bieler || { total: 0, correct: 0 };
  const total = safeNumber(bielerStats.total, 0);
  const correct = safeNumber(bielerStats.correct, 0);
  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  const progressionMap = {
    1: { focus: 'First Trained Function', skill: 'Hand Frame (Perfect 4th)' },
    2: { focus: 'String Crossing', skill: 'Stable hand, arm adjustment' },
    3: { focus: 'Shifting', skill: 'Position changes 1-3' },
    4: { focus: 'Vibrato', skill: 'Wrist oscillation' },
    5: { focus: 'Advanced Bowing', skill: 'Spiccato, martelé' }
  };

  const current = progressionMap[Math.min(Math.max(1, level), 5)] || progressionMap[1];
  const next = progressionMap[Math.min(Math.max(1, level + 1), 5)] || progressionMap[5];

  return {
    currentFocus: current.focus,
    currentSkill: current.skill,
    progress: Math.round(accuracy),
    nextMilestone: {
      focus: next.focus,
      skill: next.skill,
      requirement: 'Complete 20 drills at 85%+ accuracy'
    },
    daysOnCurrent: calculateDaysOnFocus(stats, current.focus)
  };
}

function identifyTechniqueGaps(stats, level) {
  const gaps = [];
  const bielerModule = stats?.byModule?.bieler || {};
  const byTechnique = isObj(bielerModule.byTechnique) ? bielerModule.byTechnique : {};

  const essentialTechniques = [
    { name: 'Hand Frame', threshold: 80, level: 1 },
    { name: 'Bow Hold', threshold: 85, level: 1 },
    { name: 'String Crossing', threshold: 75, level: 2 },
    { name: 'Intonation', threshold: 80, level: 2 },
    { name: 'Position Shifting', threshold: 70, level: 3 },
    { name: 'Vibrato', threshold: 65, level: 4 }
  ];

  essentialTechniques.forEach(tech => {
    if (level < tech.level) return;

    const raw = byTechnique[tech.name];
    const currentLevel = safeNumber(raw?.accuracy ?? raw, 0);

    if (currentLevel < tech.threshold) {
      gaps.push({
        technique: tech.name,
        currentLevel,
        targetLevel: tech.threshold,
        priority: level > tech.level ? 'high' : 'medium',
        drill: getBielerDrill(tech.name)
      });
    }
  });

  return gaps.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));
}

// --------------------------------------
// Recommendations Engine
// --------------------------------------

function generateSmartRecommendations({
  moduleInsights,
  patterns,
  plateaus,
  techniqueGaps,
  reviewPriority,
  streak,
  level,
  goals
}) {
  const recs = [];

  const weaknesses = safeArray(moduleInsights?.weaknesses);
  const needsAttention = safeArray(moduleInsights?.needsAttention);

  // URGENT: Critical weaknesses
  weaknesses.slice(0, 2).forEach(weak => {
    recs.push({
      type: 'urgent',
      priority: 1,
      icon: '🚨',
      title: `Focus: ${weak.module}`,
      message: `${weak.accuracy}% accuracy - needs immediate attention`,
      action: weak.moduleKey,
      actionText: 'Practice Now',
      reasoning: 'Low accuracy affecting overall progress',
      estimatedTime: 15,
      difficulty: 'medium'
    });
  });

  // HIGH: Spaced repetition reviews
  if (safeNumber(reviewPriority, 0) > 5) {
    recs.push({
      type: 'review',
      priority: 2,
      icon: '🗂️',
      title: 'Flashcard Review Due',
      message: `${reviewPriority} cards need review (spaced repetition)`,
      action: 'flashcards',
      actionText: 'Review Flashcards',
      reasoning: 'Optimal retention window closing',
      estimatedTime: Math.ceil(reviewPriority / 2),
      difficulty: 'easy'
    });
  }

  // HIGH: Technique gaps
  if (safeArray(techniqueGaps).length > 0) {
    const topGap = techniqueGaps[0];
    recs.push({
      type: 'technique',
      priority: 2,
      icon: '🎻',
      title: `Bieler: ${topGap.technique}`,
      message: `${topGap.currentLevel}% → ${topGap.targetLevel}% target`,
      action: 'bieler',
      actionText: 'Practice Technique',
      reasoning: 'Essential for current level progression',
      estimatedTime: 10,
      difficulty: 'hard',
      drill: topGap.drill
    });
  }

  // MEDIUM: Plateau breakers
  if (safeArray(plateaus).length > 0) {
    const topPlateau = plateaus[0];
    recs.push({
      type: 'plateau',
      priority: 3,
      icon: '📈',
      title: `Break Through: ${topPlateau.module}`,
      message: topPlateau.recommendation,
      action: String(topPlateau.module || '').toLowerCase(),
      actionText: 'Try New Approach',
      reasoning: `Stuck at ${topPlateau.accuracy}% for ${topPlateau.sessionsStuck} sessions`,
      estimatedTime: 20,
      difficulty: 'hard'
    });
  }

  // MEDIUM: Declining modules
  if (needsAttention.length > 0) {
    const declining = needsAttention[0];
    recs.push({
      type: 'maintenance',
      priority: 3,
      icon: '⚠️',
      title: `Refresh: ${declining.module}`,
      message: `Accuracy dropped ${Math.abs(declining.trend)}% recently`,
      action: declining.moduleKey,
      actionText: 'Quick Review',
      reasoning: 'Prevent skill decay',
      estimatedTime: 10,
      difficulty: 'easy'
    });
  }

  // LOW: Consistency building
  if (safeNumber(streak, 0) < 3) {
    recs.push({
      type: 'habit',
      priority: 4,
      icon: '🔥',
      title: 'Build Your Streak',
      message: 'Daily practice compounds - start small',
      action: 'intervals',
      actionText: '10-Min Session',
      reasoning: 'Consistency > intensity for long-term growth',
      estimatedTime: 10,
      difficulty: 'easy'
    });
  }

  // LOW: Explore new modules
  const allModules = ['intervals', 'keys', 'rhythm', 'bieler', 'fingerboard', 'scales'];
  const practicedKeys = safeArray(moduleInsights?.modules).map(m => m.moduleKey);
  const unpracticed = allModules.filter(m => !practicedKeys.includes(m));

  if (unpracticed.length > 0 && safeNumber(level, 1) >= 2) {
    recs.push({
      type: 'explore',
      priority: 5,
      icon: '🎯',
      title: `Explore: ${formatModuleName(unpracticed[0])}`,
      message: 'Expand your skill set',
      action: unpracticed[0],
      actionText: 'Try Module',
      reasoning: 'Broaden musicianship',
      estimatedTime: 15,
      difficulty: 'medium'
    });
  }

  // ALWAYS: Bieler daily practice
  recs.push({
    type: 'essential',
    priority: 6,
    icon: '🎼',
    title: 'Daily Technique',
    message: 'Bieler Method = compound interest for violin',
    action: 'bieler',
    actionText: '5-Min Technique',
    reasoning: 'Foundation for all repertoire',
    estimatedTime: 5,
    difficulty: 'medium'
  });

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// --------------------------------------
// Planning
// --------------------------------------

export function generateTodaysPlan(profile, moduleInsights, patterns, level, reviewPriority) {
  const totalDuration = safeNumber(profile?.dailyGoal, 30);
  const learningStyle = patterns?.dominantStyle || 'balanced';
  const weaknesses = safeArray(moduleInsights?.weaknesses);
  const strengths = safeArray(moduleInsights?.strengths);

  const plan = {
    title: `${getDayName()}'s Practice - Level ${safeNumber(level, 1)}`,
    subtitle: `Optimized for ${learningStyle} learners`,
    totalDuration,
    sections: [],
    bielerFocus: getDailyBielerFocus(level),
    motivationalQuote: getMotivationalQuote(level)
  };

  let remainingTime = totalDuration;

  const warmupTime = Math.min(7, Math.max(5, Math.round(totalDuration * 0.2)));
  plan.sections.push({
    id: 'warmup',
    order: 1,
    activity: 'Technical Warm-up',
    duration: warmupTime,
    module: 'bieler',
    goal: plan.bielerFocus.goal,
    exercises: ['Open strings', 'Hand frame check', 'Bow hold'],
    priority: 'essential',
    icon: '🎻'
  });
  remainingTime -= warmupTime;

  if (safeNumber(reviewPriority, 0) > 3 && remainingTime >= 10) {
    const reviewTime = Math.min(15, Math.max(10, remainingTime * 0.4));
    plan.sections.push({
      id: 'review',
      order: 2,
      activity: 'Flashcard Review',
      duration: Math.round(reviewTime),
      module: 'flashcards',
      goal: `Review ${reviewPriority} cards (SM-2 algorithm)`,
      priority: 'high',
      icon: '🗂️',
      dueCards: reviewPriority
    });
    remainingTime -= reviewTime;
  }

  if (weaknesses[0] && remainingTime >= 10) {
    const focusTime = Math.round(remainingTime * 0.35);
    const weakness = weaknesses[0];

    plan.sections.push({
      id: 'primary',
      order: 3,
      activity: `Focus: ${weakness.module}`,
      duration: focusTime,
      module: weakness.moduleKey,
      goal: `Improve from ${weakness.accuracy}% → ${weakness.accuracy + 10}%`,
      strategy: getImprovementStrategy(weakness, learningStyle),
      priority: 'high',
      icon: '🎯',
      currentLevel: weakness.accuracy,
      targetLevel: weakness.accuracy + 10
    });
    remainingTime -= focusTime;
  }

  if (remainingTime >= 7) {
    const secondaryTime = Math.round(remainingTime * 0.4);
    const target = strengths[0] || weaknesses[1];
    if (target) {
      plan.sections.push({
        id: 'secondary',
        order: 4,
        activity: strengths[0] ? `Maintain: ${target.module}` : `Develop: ${target.module}`,
        duration: secondaryTime,
        module: target.moduleKey,
        goal: strengths[0] ? `Keep mastery at ${target.accuracy}%+` : `Improve from ${target.accuracy}%`,
        priority: 'medium',
        icon: '📚'
      });
      remainingTime -= secondaryTime;
    }
  }

  if (remainingTime >= 5) {
    plan.sections.push({
      id: 'integration',
      order: 5,
      activity: 'Integration Challenge',
      duration: Math.max(2, remainingTime - 3),
      module: selectIntegrationModule(weaknesses, strengths),
      goal: 'Combine skills in realistic context',
      priority: 'medium',
      icon: '⚡',
      isChallenge: true
    });
    remainingTime = 3;
  }

  plan.sections.push({
    id: 'reflection',
    order: 6,
    activity: 'Session Reflection',
    duration: Math.max(2, remainingTime),
    type: 'reflection',
    prompt: getReflectionPrompt(weaknesses[0]),
    questions: ['What felt strongest today?', 'What needs more attention?', 'How was your tone quality?'],
    priority: 'essential',
    icon: '📝'
  });

  return plan;
}

export function generateWeekPreview(moduleInsights, patterns, level, goals = []) {
  const weaknesses = safeArray(moduleInsights?.weaknesses).slice(0, 3);
  const strengths = safeArray(moduleInsights?.strengths).slice(0, 2);

  const theme = determinePlanTheme(weaknesses, strengths);

  return {
    theme,
    subtitle: `Progressive ${theme} plan`,
    totalWeeklyGoal: safeArray(goals).find(g => g?.type === 'weekly')?.target || 150,
    days: [
      { day: 'Mon', dayName: 'Monday', focus: 'Foundation', duration: 25, primary: weaknesses[0]?.moduleKey || 'intervals', secondary: 'bieler', intensity: 'medium', description: 'Start week with fundamental review', icon: '📖' },
      { day: 'Tue', dayName: 'Tuesday', focus: 'Speed Building', duration: 28, primary: weaknesses[0]?.moduleKey || 'intervals', secondary: 'rhythm', intensity: 'high', description: 'Increase tempo while maintaining accuracy', icon: '⚡' },
      { day: 'Wed', dayName: 'Wednesday', focus: 'Accuracy Refinement', duration: 30, primary: weaknesses[1]?.moduleKey || 'keys', secondary: 'flashcards', intensity: 'high', description: 'Precision practice + spaced repetition', icon: '🎯' },
      { day: 'Thu', dayName: 'Thursday', focus: 'Integration', duration: 32, primary: 'rhythm', secondary: strengths[0]?.moduleKey || 'intervals', intensity: 'medium', description: 'Combine multiple skills', icon: '🎼' },
      { day: 'Fri', dayName: 'Friday', focus: 'Technique Deep Dive', duration: 25, primary: 'bieler', secondary: weaknesses[2]?.moduleKey || 'fingerboard', intensity: 'high', description: 'Focus on Bieler Method fundamentals', icon: '🎻' },
      { day: 'Sat', dayName: 'Saturday', focus: 'Challenge Day', duration: 35, primary: strengths[0]?.moduleKey || 'intervals', secondary: weaknesses[0]?.moduleKey || 'keys', intensity: 'very high', description: 'Push limits with harder material', icon: '🚀' },
      { day: 'Sun', dayName: 'Sunday', focus: 'Light Review & Reflection', duration: 15, primary: 'flashcards', secondary: 'analytics', intensity: 'light', description: 'Active rest + week review', icon: '📊' }
    ]
  };
}

// --------------------------------------
// Repertoire readiness
// --------------------------------------

function assessRepertoireReadiness(stats, level) {
  const readiness = [];

  if (safeNumber(level, 1) >= 1) {
    const score = calculatePieceReadiness(stats, ['intervals', 'rhythm'], 70);
    readiness.push({
      piece: 'Twinkle Variations (Suzuki Book 1)',
      readiness: score,
      requiredSkills: ['Major 2nd intervals', 'Quarter/half note rhythm', 'Open string bow'],
      recommendation: score >= 75 ? 'Ready to start with teacher guidance' : 'Build fundamentals a bit more'
    });
  }

  if (safeNumber(level, 1) >= 3) {
    const score = calculatePieceReadiness(stats, ['intervals', 'keys', 'bieler'], 75);
    readiness.push({
      piece: 'Vivaldi A-minor Concerto',
      readiness: score,
      requiredSkills: ['All intervals', 'A minor scale', '1st-3rd positions', 'String crossing'],
      recommendation: score >= 75 ? 'Ready to begin' : 'Practice fundamentals first'
    });
  }

  return readiness;
}

function calculatePieceReadiness(stats, requiredModules, threshold) {
  const scores = safeArray(requiredModules).map(mod => {
    const data = stats?.byModule?.[mod];
    const total = safeNumber(data?.total, 0);
    const correct = safeNumber(data?.correct, 0);
    if (total < 10) return 0;
    return (correct / total) * 100;
  });

  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return Math.round(Math.min(100, (avgScore / threshold) * 100));
}

// --------------------------------------
// State management
// --------------------------------------

export function completePlanSection(sectionId, timeSpent, accuracy) {
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, {
    completedSections: [],
    lastPlanDate: null,
    totalPlanTime: 0,
    learningStyle: 'balanced',
    preferredTime: null,
    goals: []
  });

  coachState.completedSections = safeArray(coachState.completedSections);
  coachState.completedSections.push({
    sectionId,
    completedAt: Date.now(),
    timeSpent: safeNumber(timeSpent, 0),
    accuracy: safeNumber(accuracy, 0)
  });

  coachState.totalPlanTime = safeNumber(coachState.totalPlanTime, 0) + safeNumber(timeSpent, 0);
  coachState.lastPlanDate = new Date().toDateString();

  saveJSON(STORAGE_KEYS.COACH_DATA, coachState);
  return coachState;
}

export function saveUserGoals(goals) {
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, {});
  coachState.goals = safeArray(goals);
  saveJSON(STORAGE_KEYS.COACH_DATA, coachState);
  return coachState.goals;
}

export function updateLearningStyle(style) {
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, {});
  coachState.learningStyle = style || 'balanced';
  saveJSON(STORAGE_KEYS.COACH_DATA, coachState);
  return coachState.learningStyle;
}

// --------------------------------------
// Helpers
// --------------------------------------

function formatModuleName(module) {
  const map = {
    intervals: 'Intervals',
    keys: 'Key Signatures',
    keysignatures: 'Key Signatures',
    rhythm: 'Rhythm',
    bieler: 'Bieler Technique',
    fingerboard: 'Fingerboard',
    scales: 'Scales Lab',
    flashcards: 'Flashcards',
    eartraining: 'Ear Training'
  };
  const key = String(module || '').toLowerCase();
  return map[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown');
}

function getDayName() {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

function getDailyBielerFocus(level) {
  const focuses = [
    { term: 'First Trained Function', goal: 'Perfect 4th hand frame (1-4 fingers)', exercises: ['Hand frame drills', 'Finger placement'] },
    { term: 'String Crossing', goal: 'Stable hand, arm level adjustment', exercises: ['2-string patterns', 'Broken chords'] },
    { term: 'Shifting', goal: 'Smooth position changes (1st-3rd)', exercises: ['Guide finger shifts', 'Scale passages'] },
    { term: 'Vibrato Development', goal: 'Wrist flexibility and oscillation', exercises: ['Slow vibrato', 'Speed variations'] },
    { term: 'Advanced Bow Techniques', goal: 'Spiccato, martelé, collé', exercises: ['Bow division', 'Stroke variations'] }
  ];
  return focuses[Math.min(Math.max(1, safeNumber(level, 1)) - 1, 4)] || focuses[0];
}

function generateGreeting(name, streak, accuracy, hour) {
  const timePrefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = name || 'Violinist';

  if (streak >= 30) return `${timePrefix}, ${userName}! 🏆 30+ day legend!`;
  if (streak >= 14) return `${timePrefix}, ${userName}! 🔥 ${streak}-day streak!`;
  if (accuracy >= 90) return `${timePrefix}, ${userName}! 🎯 Precision master!`;
  if (accuracy >= 80) return `${timePrefix}, ${userName}! ⭐ Strong skills!`;
  return `${timePrefix}, ${userName}! Ready to practice?`;
}

function generateMotivation(streak, xp, accuracy, patterns) {
  if (streak >= 21) return "Three weeks of consistency! Mastery is built day by day. 🎻";
  if (accuracy >= 95) return "Incredible precision! You're performing at a professional level. 🌟";
  if (accuracy >= 85) return "Excellence! Now focus on integrating skills into repertoire. 🎼";
  if (streak >= 7) return "One week strong! Momentum is your secret weapon. 🔥";
  if (patterns?.dominantStyle === 'auditory') return "Your ear is leading the way! Great for intonation. 👂";
  if (xp >= 10000) return "10,000+ XP! You've logged serious practice hours. 📊";
  return "Every session builds your foundation. Let's make today count! 💪";
}

function determinePlanTheme(weaknesses) {
  const primary = weaknesses?.[0]?.moduleKey;
  const themes = {
    intervals: 'Intonation Foundation',
    keys: 'Key Signature Mastery',
    rhythm: 'Rhythmic Precision',
    bieler: 'Technical Development',
    fingerboard: 'Spatial Awareness',
    scales: 'Scale Fluency'
  };
  return themes[primary] || 'Balanced Development';
}

function getMotivationalQuote(level) {
  const quotes = [
    "Practice isn't the thing you do once you're good. It's the thing you do that makes you good. - Malcolm Gladwell",
    "The beautiful thing about learning is that no one can take it away from you. - B.B. King",
    "Music is the strongest form of magic. - Marilyn Manson",
    "Without music, life would be a mistake. - Friedrich Nietzsche"
  ];
  return quotes[safeNumber(level, 1) % quotes.length];
}

function getImprovementStrategy(_weakness, learningStyle) {
  const strategies = {
    auditory: 'Listen to perfect examples, then sing before playing',
    visual: 'Study notation patterns; use color coding for recognition',
    kinesthetic: 'Slow practice with muscle-memory focus; repetition',
    balanced: 'Multi-sensory approach: see, hear, feel the patterns'
  };
  return strategies[learningStyle] || strategies.balanced;
}

function selectIntegrationModule(weaknesses, strengths) {
  if (weaknesses?.length && strengths?.length) return Math.random() > 0.5 ? weaknesses[0].moduleKey : strengths[0].moduleKey;
  if (weaknesses?.length) return weaknesses[0].moduleKey;
  if (strengths?.length) return strengths[0].moduleKey;
  return 'rhythm';
}

function getReflectionPrompt(primaryWeakness) {
  if (!primaryWeakness) return { question: "What felt strongest in today's practice?", followUp: 'How can you build on that tomorrow?' };

  if (safeNumber(primaryWeakness.accuracy, 0) < 60) {
    return { question: `What made ${primaryWeakness.module} challenging today?`, followUp: 'Try breaking it into smaller steps tomorrow.' };
  }
  return { question: 'What progress did you notice today?', followUp: 'Celebrate small wins - they compound!' };
}

function getBielerDrill(techniqueName) {
  const drills = {
    'Hand Frame': 'Ševčík Op. 1 No. 1 (finger placement)',
    'Bow Hold': 'Open string sustained tones',
    'String Crossing': 'Broken chord patterns (I-V-I)',
    'Intonation': 'Slow scales with drone note',
    'Position Shifting': 'Ševčík Op. 8 (shifting exercises)',
    'Vibrato': 'Wrist rotation exercises on open string'
  };
  return drills[techniqueName] || 'Foundational technique practice';
}

function calculateRecentAccuracy(history = []) {
  const h = safeArray(history);
  if (h.length < 5) return 0;
  const recent = h.slice(-10);

  // Support multiple shapes:
  // - { correct: true/false }
  // - { accuracy: number }
  // - { isCorrect: true/false }
  const hasAccuracy = recent.some(x => Number.isFinite(Number(x?.accuracy)));
  if (hasAccuracy) {
    const avg = recent.reduce((s, x) => s + safeNumber(x?.accuracy, 0), 0) / recent.length;
    return avg;
  }

  const correct = recent.filter(x => x?.correct === true || x?.isCorrect === true).length;
  return (correct / recent.length) * 100;
}

function calculateConsistency(history = []) {
  const h = safeArray(history);
  if (h.length < 5) return 0;
  const recentDays = h.slice(-7).map(x => new Date(safeNumber(x?.timestamp, Date.now())).toDateString());
  const uniqueDays = [...new Set(recentDays)].length;
  return Math.round((uniqueDays / 7) * 100);
}

function calculateMastery(accuracy, attempts, recentAccuracy) {
  const accuracyScore = safeNumber(accuracy, 0);
  const volumeScore = Math.min(100, (safeNumber(attempts, 0) / 50) * 100);
  const recencyScore = Number.isFinite(Number(recentAccuracy)) ? safeNumber(recentAccuracy, accuracyScore) : accuracyScore;

  return Math.round(accuracyScore * 0.5 + volumeScore * 0.3 + recencyScore * 0.2);
}

function calculateWeeklyConsistency(sessions) {
  const s = safeArray(sessions);
  const days = [...new Set(s.map(x => new Date(safeNumber(x?.timestamp, Date.now())).toDateString()))];
  return Math.round((days.length / 7) * 100);
}

function calculateStuckSessions(moduleKey, practiceLog) {
  const moduleSessions = safeArray(practiceLog).filter(s => s?.module === moduleKey).slice(-10);
  if (moduleSessions.length < 5) return 0;

  const avgAccuracy = moduleSessions.reduce((sum, s) => sum + safeNumber(s?.accuracy, 0), 0) / moduleSessions.length;
  const variance =
    moduleSessions.reduce((sum, s) => sum + Math.abs(safeNumber(s?.accuracy, 0) - avgAccuracy), 0) / moduleSessions.length;

  return variance < 5 ? moduleSessions.length : 0;
}

function generatePlateauBreaker() {
  const breakers = [
    'Try 50% slower tempo with 100% accuracy',
    'Switch to different difficulty level',
    'Practice in short bursts (5 min focus sessions)',
    'Use audio playback to hear correct patterns',
    'Take 2-day break then return fresh'
  ];
  return breakers[Math.floor(Math.random() * breakers.length)];
}

function generateBreakthroughMessage(module, improvement) {
  return `Amazing ${improvement}% jump in ${formatModuleName(module)}! This is what consistent practice looks like. 🚀`;
}

function calculateDaysOnFocus(_stats, _focusName) {
  // Placeholder: can be made real later by analyzing practiceLog vs focusName.
  return 7;
}

console.log('[Coach Engine] VMQ AI Coach v2.1.2 loaded ✅');

export default {
  getCoachInsights,
  getCoachDashboard,
  getRecommendations,
  generateTodaysPlan,
  generateWeekPreview,
  getDailyPlan,
  getWeeklyPlan,
  completePlanSection,
  saveUserGoals,
  updateLearningStyle,
  getModuleProgress
};
