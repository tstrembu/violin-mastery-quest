// ======================================
// VMQ COACH ENGINE v2.1.1 - Advanced AI Practice Intelligence
// 7-Day Adaptive Plans + Learning Pattern Recognition + Bieler Pedagogy
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { loadXP, loadStreak, getLevel } from './gamification.js';
import { analyzePerformance, getModuleProgress } from './analytics.js';
import { INTERVALS, KEY_SIGNATURES, RHYTHM_PATTERNS, BIELER_TAXONOMY } from '../config/constants.js';
import { getDueItems } from './spacedRepetition.js';

// ======================================
// CORE COACH INSIGHTS (Enhanced)
// ======================================

/**
 * Complete coach dashboard with AI-powered analysis
 * @param {Object} profile - User profile with preferences
 * @returns {Object} Comprehensive coaching insights
 */
export function getCoachInsights(profile = {}) {
  const stats = loadJSON(STORAGE_KEYS.STATS, {});
  const xp = loadXP();
  const streak = loadStreak();
  const level = getLevel(xp);
  const practiceLog = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, { 
    learningStyle: 'balanced',
    preferredTime: null,
    goals: []
  });

  // Deep performance analysis
  const perf = analyzePerformance('week');
  const longTermPerf = analyzePerformance('month');
  const learningVelocity = calculateLearningVelocity(practiceLog);
  const moduleInsights = analyzeModulePerformance(stats.byModule || {});
  
  // Pattern recognition
  const patterns = detectLearningPatterns(practiceLog, stats);
  const plateaus = detectPlateaus(moduleInsights, practiceLog);
  const breakthroughs = detectBreakthroughs(practiceLog);

  // Bieler Method integration
  const bielerProgress = analyzeBielerProgress(stats, level.level);
  const techniqueGaps = identifyTechniqueGaps(stats, level.level);

  // Spaced repetition integration
  const dueReviews = getDueItems ? getDueItems() : [];
  const reviewPriority = dueReviews.filter(item => item.interval < 7).length;

  return {
    // Personalized greeting
    greeting: generateGreeting(profile.name, streak, perf.overallAccuracy, new Date().getHours()),
    motivationalMessage: generateMotivation(streak, xp, perf.overallAccuracy, patterns),
    
    // Core metrics
    keyMetrics: {
      overallAccuracy: perf.overallAccuracy,
      consistency: perf.consistencyScore,
      avgResponseTime: perf.avgResponseTime,
      learningVelocity,
      streak,
      level: level.title,
      xpThisWeek: perf.xpGained || 0,
      questionsThisWeek: perf.totalQuestions || 0,
      timeThisWeek: perf.totalTime || 0
    },

    // Performance analysis
    strengths: moduleInsights.strengths.slice(0, 3),
    weaknesses: moduleInsights.weaknesses.slice(0, 3),
    mastered: moduleInsights.mastered,
    needsAttention: moduleInsights.needsAttention,

    // AI-powered insights
    patterns: {
      learningStyle: patterns.dominantStyle,
      bestTimeOfDay: patterns.bestTimeOfDay,
      optimalSessionLength: patterns.optimalSessionLength,
      strengthsPattern: patterns.strengthsPattern,
      challengesPattern: patterns.challengesPattern
    },

    // Advanced feedback
    plateaus,
    breakthroughs: breakthroughs.slice(0, 2),
    
    // Bieler pedagogy
    bielerInsights: {
      currentFocus: bielerProgress.currentFocus,
      progress: bielerProgress.progress,
      nextMilestone: bielerProgress.nextMilestone,
      techniqueGaps
    },

    // Actionable recommendations (priority-sorted)
    recommendations: generateSmartRecommendations({
      moduleInsights,
      patterns,
      plateaus,
      techniqueGaps,
      reviewPriority,
      streak,
      level: level.level,
      goals: coachState.goals
    }),

    // Daily practice plan
    todaysPlan: generateTodaysPlan(profile, moduleInsights, patterns, level.level, reviewPriority),
    
    // 7-day strategic preview
    weekPreview: generateWeekPreview(moduleInsights, patterns, level.level, coachState.goals),

    // Study reminders
    reviewAlerts: reviewPriority > 5 ? {
      count: reviewPriority,
      message: `${reviewPriority} flashcards need review (spaced repetition)`,
      action: 'flashcards'
    } : null,

    // Repertoire connections
    repertoireReadiness: assessRepertoireReadiness(stats, level.level)
  };
}

// ======================================
// ADVANCED PERFORMANCE ANALYSIS
// ======================================

/**
 * Analyze each module's performance with ML-style insights
 */
function analyzeModulePerformance(byModule) {
  const modules = Object.entries(byModule).map(([module, data]) => {
    const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
    const recentAccuracy = calculateRecentAccuracy(data.history);
    const trend = recentAccuracy - accuracy; // Positive = improving
    
    return {
      module: formatModuleName(module),
      moduleKey: module,
      accuracy: Math.round(accuracy),
      recentAccuracy: Math.round(recentAccuracy),
      trend: Math.round(trend),
      attempts: data.total || 0,
      correct: data.correct || 0,
      avgResponseTime: data.avgTime || 0,
      lastPracticed: data.lastPracticed || 0,
      difficulty: data.difficulty || 'medium',
      consistency: calculateConsistency(data.history),
      mastery: calculateMastery(accuracy, data.total, recentAccuracy)
    };
  });

  // Categorize modules
  const strengths = modules.filter(m => 
    m.accuracy >= 80 && m.attempts >= 10 && m.consistency > 60
  ).sort((a, b) => b.mastery - a.mastery);

  const weaknesses = modules.filter(m => 
    m.accuracy < 70 && m.attempts >= 5
  ).sort((a, b) => a.accuracy - b.accuracy);

  const mastered = modules.filter(m => 
    m.mastery >= 90 && m.attempts >= 20
  );

  const needsAttention = modules.filter(m => 
    m.attempts >= 10 && m.trend < -5 // Declining performance
  ).sort((a, b) => a.trend - b.trend);

  const stagnant = modules.filter(m =>
    m.attempts >= 15 && Math.abs(m.trend) < 2 && m.accuracy < 85
  );

  return { modules, strengths, weaknesses, mastered, needsAttention, stagnant };
}

/**
 * Calculate learning velocity (XP per hour)
 */
function calculateLearningVelocity(practiceLog) {
  const recentSessions = practiceLog.slice(-14); // Last 2 weeks
  if (recentSessions.length === 0) return 0;

  const totalXP = recentSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0);
  const totalMinutes = recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  
  return totalMinutes > 0 ? Math.round((totalXP / totalMinutes) * 60) : 0;
}

/**
 * Detect learning patterns using heuristics
 */
function detectLearningPatterns(practiceLog, stats) {
  const recentSessions = practiceLog.slice(-30);
  
  // Time of day analysis
  const timeDistribution = recentSessions.reduce((acc, s) => {
    const hour = new Date(s.timestamp).getHours();
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    acc[period] = (acc[period] || 0) + 1;
    return acc;
  }, {});
  
  const bestTimeOfDay = Object.entries(timeDistribution)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'morning';

  // Session length analysis
  const avgSessionLength = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / recentSessions.length)
    : 20;

  // Learning style detection (visual, auditory, kinesthetic)
  const modulePreferences = Object.entries(stats.byModule || {})
    .map(([mod, data]) => ({
      module: mod,
      score: (data.correct / data.total) * 100,
      attempts: data.total
    }))
    .filter(m => m.attempts >= 5)
    .sort((a, b) => b.score - a.score);

  let dominantStyle = 'balanced';
  if (modulePreferences[0]?.module === 'intervals' || modulePreferences[0]?.module === 'eartraining') {
    dominantStyle = 'auditory';
  } else if (modulePreferences[0]?.module === 'fingerboard' || modulePreferences[0]?.module === 'keys') {
    dominantStyle = 'visual';
  } else if (modulePreferences[0]?.module === 'bieler' || modulePreferences[0]?.module === 'rhythm') {
    dominantStyle = 'kinesthetic';
  }

  return {
    bestTimeOfDay,
    optimalSessionLength: avgSessionLength,
    dominantStyle,
    strengthsPattern: modulePreferences.slice(0, 3),
    challengesPattern: modulePreferences.slice(-3).reverse(),
    consistencyPattern: calculateWeeklyConsistency(recentSessions)
  };
}

/**
 * Detect performance plateaus
 */
function detectPlateaus(moduleInsights, practiceLog) {
  const plateaus = moduleInsights.stagnant.map(module => ({
    module: module.module,
    accuracy: module.accuracy,
    sessionsStuck: calculateStuckSessions(module.moduleKey, practiceLog),
    recommendation: generatePlateauBreaker(module),
    priority: module.accuracy < 75 ? 'high' : 'medium'
  }));

  return plateaus.filter(p => p.sessionsStuck >= 5);
}

/**
 * Detect recent breakthroughs
 */
function detectBreakthroughs(practiceLog) {
  const recentSessions = practiceLog.slice(-10);
  const breakthroughs = [];

  recentSessions.forEach((session, i) => {
    if (i === 0) return;
    
    const prev = recentSessions[i - 1];
    const improvement = session.accuracy - prev.accuracy;
    
    if (improvement >= 15 && session.accuracy >= 80) {
      breakthroughs.push({
        module: session.module,
        achievement: `${session.accuracy}% accuracy (up ${improvement}%)`,
        date: new Date(session.timestamp).toLocaleDateString(),
        message: generateBreakthroughMessage(session.module, improvement)
      });
    }
  });

  return breakthroughs;
}

// ======================================
// BIELER METHOD INTEGRATION (Enhanced)
// ======================================

/**
 * Analyze progress through Bieler Taxonomy
 */
function analyzeBielerProgress(stats, level) {
  const bielerStats = stats.byModule?.bieler || { total: 0, correct: 0 };
  const accuracy = bielerStats.total > 0 
    ? (bielerStats.correct / bielerStats.total) * 100 
    : 0;

  // Map level to Bieler functions
  const progressionMap = {
    1: { focus: 'First Trained Function', skill: 'Hand Frame (Perfect 4th)' },
    2: { focus: 'String Crossing', skill: 'Stable hand, arm adjustment' },
    3: { focus: 'Shifting', skill: 'Position changes 1-3' },
    4: { focus: 'Vibrato', skill: 'Wrist oscillation' },
    5: { focus: 'Advanced Bowing', skill: 'Spiccato, martelé' }
  };

  const current = progressionMap[Math.min(level, 5)] || progressionMap[1];
  const next = progressionMap[Math.min(level + 1, 5)] || progressionMap[5];

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

/**
 * Identify specific technique gaps
 */
function identifyTechniqueGaps(stats, level) {
  const gaps = [];
  const bielerData = stats.byModule?.bieler || {};

  // Check essential techniques
  const essentialTechniques = [
    { name: 'Hand Frame', threshold: 80, level: 1 },
    { name: 'Bow Hold', threshold: 85, level: 1 },
    { name: 'String Crossing', threshold: 75, level: 2 },
    { name: 'Intonation', threshold: 80, level: 2 },
    { name: 'Position Shifting', threshold: 70, level: 3 },
    { name: 'Vibrato', threshold: 65, level: 4 }
  ];

  essentialTechniques.forEach(tech => {
    if (level >= tech.level && (!bielerData[tech.name] || bielerData[tech.name] < tech.threshold)) {
      gaps.push({
        technique: tech.name,
        currentLevel: bielerData[tech.name] || 0,
        targetLevel: tech.threshold,
        priority: level > tech.level ? 'high' : 'medium',
        drill: getBielerDrill(tech.name)
      });
    }
  });

  return gaps.sort((a, b) => 
    (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0)
  );
}

// ======================================
// SMART RECOMMENDATIONS ENGINE (Enhanced)
// ======================================

/**
 * Generate priority-sorted, actionable recommendations
 */
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
  const now = Date.now();

  // URGENT: Critical weaknesses
  moduleInsights.weaknesses.slice(0, 2).forEach(weak => {
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
  if (reviewPriority > 5) {
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
  if (techniqueGaps.length > 0) {
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
  if (plateaus.length > 0) {
    const topPlateau = plateaus[0];
    recs.push({
      type: 'plateau',
      priority: 3,
      icon: '📈',
      title: `Break Through: ${topPlateau.module}`,
      message: topPlateau.recommendation,
      action: topPlateau.module.toLowerCase(),
      actionText: 'Try New Approach',
      reasoning: `Stuck at ${topPlateau.accuracy}% for ${topPlateau.sessionsStuck} sessions`,
      estimatedTime: 20,
      difficulty: 'hard'
    });
  }

  // MEDIUM: Declining modules
  if (moduleInsights.needsAttention.length > 0) {
    const declining = moduleInsights.needsAttention[0];
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
  if (streak < 3) {
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
  const practiced = Object.keys(moduleInsights.modules);
  const unpracticed = allModules.filter(m => !practiced.includes(m));
  
  if (unpracticed.length > 0 && level >= 2) {
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

  // Sort by priority and return top 5
  return recs.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// ======================================
// ADAPTIVE DAILY PLANNING (Enhanced)
// ======================================

/**
 * Generate personalized daily practice plan
 */
export function generateTodaysPlan(profile, moduleInsights, patterns, level, reviewPriority) {
  const totalDuration = profile?.dailyGoal || 30;
  const learningStyle = patterns?.dominantStyle || 'balanced';
  const weaknesses = moduleInsights?.weaknesses || [];
  const strengths = moduleInsights?.strengths || [];

  const plan = {
    title: `${getDayName()}'s Practice - Level ${level}`,
    subtitle: `Optimized for ${learningStyle} learners`,
    totalDuration,
    sections: [],
    bielerFocus: getDailyBielerFocus(level),
    motivationalQuote: getMotivationalQuote(level)
  };

  let remainingTime = totalDuration;

  // 1. WARM-UP (always 5-7 min, ~20% of session)
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

  // 2. SPACED REPETITION REVIEW (if due, ~15 min)
  if (reviewPriority > 3 && remainingTime >= 10) {
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

  // 3. PRIMARY FOCUS - Biggest weakness (30-40% of remaining time)
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

  // 4. SECONDARY PRACTICE - Strength maintenance or second weakness (20-30%)
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
        goal: strengths[0] 
          ? `Keep mastery at ${target.accuracy}%+` 
          : `Improve from ${target.accuracy}%`,
        priority: 'medium',
        icon: '📚'
      });
      remainingTime -= secondaryTime;
    }
  }

  // 5. INTEGRATION/CHALLENGE (remaining time if > 5 min)
  if (remainingTime >= 5) {
    plan.sections.push({
      id: 'integration',
      order: 5,
      activity: 'Integration Challenge',
      duration: remainingTime - 3, // Leave 3 for reflection
      module: selectIntegrationModule(weaknesses, strengths),
      goal: 'Combine skills in realistic context',
      priority: 'medium',
      icon: '⚡',
      isChallenge: true
    });
    remainingTime -= (remainingTime - 3);
  }

  // 6. REFLECTION (always last 3 min)
  plan.sections.push({
    id: 'reflection',
    order: 6,
    activity: 'Session Reflection',
    duration: Math.max(2, remainingTime),
    type: 'reflection',
    prompt: getReflectionPrompt(weaknesses[0]),
    questions: [
      'What felt strongest today?',
      'What needs more attention?',
      'How was your tone quality?'
    ],
    priority: 'essential',
    icon: '📝'
  });

  return plan;
}

/**
 * Generate 7-day strategic preview with progressive difficulty
 */
export function generateWeekPreview(moduleInsights, patterns, level, goals = []) {
  const theme = determinePlanTheme(moduleInsights.weaknesses, moduleInsights.strengths);
  const weaknesses = moduleInsights.weaknesses.slice(0, 3);
  const strengths = moduleInsights.strengths.slice(0, 2);

  return {
    theme,
    subtitle: `Progressive ${theme} plan`,
    totalWeeklyGoal: goals.find(g => g.type === 'weekly')?.target || 150,
    days: [
      {
        day: 'Mon',
        dayName: 'Monday',
        focus: 'Foundation',
        duration: 25,
        primary: weaknesses[0]?.moduleKey || 'intervals',
        secondary: 'bieler',
        intensity: 'medium',
        description: 'Start week with fundamental review',
        icon: '📖'
      },
      {
        day: 'Tue',
        dayName: 'Tuesday',
        focus: 'Speed Building',
        duration: 28,
        primary: weaknesses[0]?.moduleKey || 'intervals',
        secondary: 'rhythm',
        intensity: 'high',
        description: 'Increase tempo while maintaining accuracy',
        icon: '⚡'
      },
      {
        day: 'Wed',
        dayName: 'Wednesday',
        focus: 'Accuracy Refinement',
        duration: 30,
        primary: weaknesses[1]?.moduleKey || 'keys',
        secondary: 'flashcards',
        intensity: 'high',
        description: 'Precision practice + spaced repetition',
        icon: '🎯'
      },
      {
        day: 'Thu',
        dayName: 'Thursday',
        focus: 'Integration',
        duration: 32,
        primary: 'rhythm',
        secondary: strengths[0]?.moduleKey || 'intervals',
        intensity: 'medium',
        description: 'Combine multiple skills',
        icon: '🎼'
      },
      {
        day: 'Fri',
        dayName: 'Friday',
        focus: 'Technique Deep Dive',
        duration: 25,
        primary: 'bieler',
        secondary: weaknesses[2]?.moduleKey || 'fingerboard',
        intensity: 'high',
        description: 'Focus on Bieler Method fundamentals',
        icon: '🎻'
      },
      {
        day: 'Sat',
        dayName: 'Saturday',
        focus: 'Challenge Day',
        duration: 35,
        primary: strengths[0]?.moduleKey || 'intervals',
        secondary: weaknesses[0]?.moduleKey || 'keys',
        intensity: 'very high',
        description: 'Push limits with harder material',
        icon: '🚀'
      },
      {
        day: 'Sun',
        dayName: 'Sunday',
        focus: 'Light Review & Reflection',
        duration: 15,
        primary: 'flashcards',
        secondary: 'analytics',
        intensity: 'light',
        description: 'Active rest + week review',
        icon: '📊'
      }
    ]
  };
}

// ======================================
// REPERTOIRE READINESS ASSESSMENT
// ======================================

/**
 * Assess readiness for specific repertoire pieces
 */
function assessRepertoireReadiness(stats, level) {
  const readiness = [];
  
  // Beginner repertoire
  if (level >= 1) {
    readiness.push({
      piece: 'Twinkle Variations (Suzuki Book 1)',
      readiness: calculatePieceReadiness(stats, ['intervals', 'rhythm'], 70),
      requiredSkills: ['Major 2nd intervals', 'Quarter/half note rhythm', 'Open string bow'],
      recommendation: 'Ready to start with teacher guidance'
    });
  }

  // Intermediate repertoire
  if (level >= 3) {
    readiness.push({
      piece: 'Vivaldi A-minor Concerto',
      readiness: calculatePieceReadiness(stats, ['intervals', 'keys', 'bieler'], 75),
      requiredSkills: ['All intervals', 'A minor scale', '1st-3rd positions', 'String crossing'],
      recommendation: readiness >= 75 ? 'Ready to begin' : 'Practice fundamentals first'
    });
  }

  return readiness;
}

function calculatePieceReadiness(stats, requiredModules, threshold) {
  const scores = requiredModules.map(mod => {
    const data = stats.byModule?.[mod];
    if (!data || data.total < 10) return 0;
    return (data.correct / data.total) * 100;
  });

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(Math.min(100, (avgScore / threshold) * 100));
}

// ======================================
// HELPER FUNCTIONS
// ======================================

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
  return map[module.toLowerCase()] || module.charAt(0).toUpperCase() + module.slice(1);
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
  return focuses[Math.min(level - 1, 4)] || focuses[0];
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

function determinePlanTheme(weaknesses, strengths) {
  if (!weaknesses || weaknesses.length === 0) return 'Maintenance & Exploration';
  
  const primary = weaknesses[0].moduleKey;
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
  return quotes[level % quotes.length];
}

function getImprovementStrategy(weakness, learningStyle) {
  const strategies = {
    auditory: `Listen to perfect examples, then sing before playing`,
    visual: `Study notation patterns, use color coding for recognition`,
    kinesthetic: `Slow practice with muscle memory focus, repetition`,
    balanced: `Multi-sensory approach: see, hear, feel the patterns`
  };
  return strategies[learningStyle] || strategies.balanced;
}

function selectIntegrationModule(weaknesses, strengths) {
  // Mix weak and strong skills
  if (weaknesses.length > 0 && strengths.length > 0) {
    return Math.random() > 0.5 ? weaknesses[0].moduleKey : strengths[0].moduleKey;
  }
  return 'rhythm'; // Safe default
}

function getReflectionPrompt(primaryWeakness) {
  if (!primaryWeakness) {
    return {
      question: 'What felt strongest in today\'s practice?',
      followUp: 'How can you build on that tomorrow?'
    };
  }

  if (primaryWeakness.accuracy < 60) {
    return {
      question: `What made ${primaryWeakness.module} challenging today?`,
      followUp: 'Try breaking it into smaller steps tomorrow.'
    };
  }

  return {
    question: 'What progress did you notice today?',
    followUp: 'Celebrate small wins - they compound!'
  };
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

// Calculation helpers
function calculateRecentAccuracy(history = []) {
  if (!history || history.length < 5) return 0;
  const recent = history.slice(-10);
  const correct = recent.filter(h => h.correct).length;
  return (correct / recent.length) * 100;
}

function calculateConsistency(history = []) {
  if (!history || history.length < 5) return 0;
  // Check how many of last 7 days had practice
  const recentDays = history.slice(-7).map(h => new Date(h.timestamp).toDateString());
  const uniqueDays = [...new Set(recentDays)].length;
  return Math.round((uniqueDays / 7) * 100);
}

function calculateMastery(accuracy, attempts, recentAccuracy) {
  // Weighted mastery: accuracy (50%) + volume (30%) + recent performance (20%)
  const accuracyScore = accuracy;
  const volumeScore = Math.min(100, (attempts / 50) * 100);
  const recencyScore = recentAccuracy || accuracy;
  
  return Math.round(
    accuracyScore * 0.5 +
    volumeScore * 0.3 +
    recencyScore * 0.2
  );
}

function calculateWeeklyConsistency(sessions) {
  const days = [...new Set(sessions.map(s => new Date(s.timestamp).toDateString()))];
  return Math.round((days.length / 7) * 100);
}

function calculateStuckSessions(moduleKey, practiceLog) {
  const moduleSessions = practiceLog
    .filter(s => s.module === moduleKey)
    .slice(-10);
  
  if (moduleSessions.length < 5) return 0;
  
  const avgAccuracy = moduleSessions.reduce((sum, s) => sum + s.accuracy, 0) / moduleSessions.length;
  const variance = moduleSessions.reduce((sum, s) => 
    sum + Math.abs(s.accuracy - avgAccuracy), 0
  ) / moduleSessions.length;
  
  return variance < 5 ? moduleSessions.length : 0;
}

function generatePlateauBreaker(module) {
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

function calculateDaysOnFocus(stats, focusName) {
  // Simplified - would need practice log analysis
  return 7; // Placeholder
}

// ======================================
// STATE MANAGEMENT
// ======================================

/**
 * Track completion of practice plan sections
 */
export function completePlanSection(sectionId, timeSpent, accuracy) {
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, {
    completedSections: [],
    lastPlanDate: null,
    totalPlanTime: 0
  });

  coachState.completedSections.push({
    sectionId,
    completedAt: Date.now(),
    timeSpent,
    accuracy
  });

  coachState.totalPlanTime += timeSpent;
  coachState.lastPlanDate = new Date().toDateString();

  saveJSON(STORAGE_KEYS.COACH_DATA, coachState);
  return coachState;
}

/**
 * Save user goals
 */
export function saveUserGoals(goals) {
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, {});
  coachState.goals = goals;
  saveJSON(STORAGE_KEYS.COACH_DATA, coachState);
}

/**
 * Update learning style preference
 */
export function updateLearningStyle(style) {
  const coachState = loadJSON(STORAGE_KEYS.COACH_DATA, {});
  coachState.learningStyle = style;
  saveJSON(STORAGE_KEYS.COACH_DATA, coachState);
}

console.log('[Coach Engine] VMQ AI Coach v2.1.1 loaded ✅');

export default {
  getCoachInsights,
  generateTodaysPlan,
  generateWeekPreview,
  completePlanSection,
  saveUserGoals,
  updateLearningStyle
};
