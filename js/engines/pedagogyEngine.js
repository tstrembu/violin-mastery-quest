// js/engines/pedagogyEngine.js
// ======================================
// VMQ PEDAGOGY ENGINE v3.0 - ML-Enhanced
// Progression ladders + passage analysis + predictive repertoire
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { INTERVALS, BIELER_TAXONOMY } from '../config/constants.js';
import { analyzePerformance } from './analytics.js';
import { getStats as sm2GetStats } from './spacedRepetition.js';
import { getDifficultyInfo } from './difficultyAdapter.js';
import { addXP, unlockAchievement } from './gamification.js';
import sessionTracker from './sessionTracker.js';

// ======================================
// PROGRESSION SYSTEM - Adaptive Thresholds
// ======================================

/**
 * User's current level in any module with ML-adjusted thresholds
 */
export function getCurrentProgressionLevel(module) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const moduleStats = stats.byModule[module] || { total: 0, correct: 0, avgResponseTime: 0, recentStreak: 0 };

  const accuracy = moduleStats.total > 0 ? Math.round((moduleStats.correct / moduleStats.total) * 100) : 0;
  const avgTime = moduleStats.avgResponseTime || 5000;
  const recentStreak = moduleStats.recentStreak || 0;

  // Fetch baseline ladder
  const ladders = getProgressionLadders(module);
  
  // ML: Adjust rung thresholds based on recent velocity and cohort difficulty
  const adjustedLadders = adjustLadderThresholds(ladders, moduleStats, module);

  // Find highest achieved level
  for (let i = adjustedLadders.length - 1; i >= 0; i--) {
    const level = adjustedLadders[i];
    if (accuracy >= level.reqAccuracy && avgTime <= level.reqTime) {
      // ML: Predict readiness for next level using retention + streak
      const readiness = predictReadiness(moduleStats, level.nextLevelReq);
      return {
        current: level.name,
        progress: 100,
        next: adjustedLadders[i-1] ? adjustedLadders[i-1].name : 'Mastered!',
        repertoire: level.repertoire,
        unlocked: true,
        readinessScore: readiness.score,
        estimatedDaysToNext: readiness.days,
        mlAdjusted: true
      };
    }
  }

  // Find current level in progress
  for (let i = 0; i < adjustedLadders.length; i++) {
    const level = adjustedLadders[i];
    if (accuracy < level.reqAccuracy || avgTime > level.reqTime) {
      const accProgress = Math.min(100, (accuracy / level.reqAccuracy) * 100);
      const timeProgress = Math.min(100, (level.reqTime / avgTime) * 100);
      const overall = Math.round((accProgress + timeProgress) / 2);

      // ML: Detect plateau and suggest intervention
      const plateau = detectPlateau(moduleStats, level, overall);
      
      return {
        current: level.name,
        progress: overall,
        next: adjustedLadders[i+1]?.name || 'Mastered!',
        repertoire: level.repertoire,
        gaps: {
          accuracyGap: level.reqAccuracy - accuracy,
          timeGap: avgTime - level.reqTime
        },
        plateauDetected: plateau.isPlateau,
        intervention: plateau.intervention,
        streakBoost: recentStreak > 5 ? 1.1 : 1.0 // 10% boost for streaks
      };
    }
  }

  return { current: 'Beginner', progress: 0, next: adjustedLadders[0]?.name || 'Intervals', repertoire: [] };
}

/**
 * Module progression ladders with ML-cohort adjustments
 */
function getProgressionLadders(module) {
  const baseLadders = {
    intervals: [
      { name: 'Perfect Intervals', reqAccuracy: 90, reqTime: 2000, repertoire: ['Bach A-minor Concerto'], nextLevelReq: { accuracy: 95, time: 1500 } },
      { name: 'Major/Minor', reqAccuracy: 85, reqTime: 2500, repertoire: ['Suzuki Bk1'], nextLevelReq: { accuracy: 90, time: 2000 } },
      { name: 'Compound', reqAccuracy: 80, reqTime: 3000, repertoire: ['Bruch Violin Concerto'], nextLevelReq: { accuracy: 85, time: 2500 } }
    ],
    keys: [
      { name: 'Sharps (C,G,D)', reqAccuracy: 95, reqTime: 1500, repertoire: ['Kreutzer Etudes'], nextLevelReq: { accuracy: 98, time: 1200 } },
      { name: 'Flats (F,Bb)', reqAccuracy: 90, reqTime: 2000, repertoire: ['Viotti'], nextLevelReq: { accuracy: 95, time: 1500 } },
      { name: 'Exotic (F#,Cb)', reqAccuracy: 85, reqTime: 2500, repertoire: ['Paganini Caprices'], nextLevelReq: { accuracy: 90, time: 2000 } }
    ],
    rhythm: [
      { name: 'Simple (4/4)', reqAccuracy: 90, reqTime: 2000, repertoire: ['Minuet in G'], nextLevelReq: { accuracy: 95, time: 1500 } },
      { name: 'Compound (6/8)', reqAccuracy: 85, reqTime: 2500, repertoire: ['Gavottes'], nextLevelReq: { accuracy: 90, time: 2000 } },
      { name: 'Syncopation', reqAccuracy: 80, reqTime: 3000, repertoire: ['Wieniawski'], nextLevelReq: { accuracy: 85, time: 2500 } }
    ],
    bieler: [
      { name: 'Left Hand Basics', reqAccuracy: 90, reqTime: 3000, repertoire: ['Suzuki Bk1'], nextLevelReq: { accuracy: 95, time: 2500 } },
      { name: 'Bow Functions', reqAccuracy: 85, reqTime: 3500, repertoire: ['Kreutzer'], nextLevelReq: { accuracy: 90, time: 3000 } },
      { name: 'Advanced', reqAccuracy: 80, reqTime: 4000, repertoire: ['Ysaye Sonatas'], nextLevelReq: { accuracy: 85, time: 3500 } }
    ]
  };

  return baseLadders[module] || baseLadders.intervals;
}

/**
 * ML: Adjust ladder thresholds based on performance velocity and cohort data
 */
function adjustLadderThresholds(ladders, moduleStats, module) {
  if (!moduleStats || moduleStats.total < 30) return ladders;

  const recentAccuracyTrend = getRecentTrend(moduleStats, 'accuracy', 10);
  const recentTimeTrend = getRecentTrend(moduleStats, 'time', 10);
  const velocity = calculateLearningVelocity(recentAccuracyTrend, recentTimeTrend);

  return ladders.map((rung, idx) => {
    // Adjust thresholds based on velocity: faster learners get slightly harder goals
    const difficultyMultiplier = velocity > 1.2 ? 0.95 : velocity < 0.8 ? 1.05 : 1.0;
    
    // Cross-module transfer bonus: if related modules are strong, ease requirements
    const transferBonus = getCrossModuleTransferBonus(module);
    
    return {
      ...rung,
      reqAccuracy: Math.min(98, Math.round(rung.reqAccuracy * difficultyMultiplier * transferBonus)),
      reqTime: Math.max(1000, Math.round(rung.reqTime / difficultyMultiplier / transferBonus)),
      mlAdjusted: true,
      velocity,
      transferBonus
    };
  });
}

/**
 * ML: Predict readiness for next level using retention + streak
 */
function predictReadiness(moduleStats, nextLevelReq) {
  const sm2Stats = sm2GetStats();
  const retention = sm2Stats?.retention || 0;
  const recentAccuracy = getRecentAverage(moduleStats, 'accuracy', 5);
  
  // Simple linear model: 70% retention + 30% recent accuracy predicts readiness
  const readinessScore = (retention * 0.7) + (recentAccuracy * 0.3);
  const requiredScore = (nextLevelReq.accuracy * 0.7) + 10; // 10 point buffer
  
  const daysToReady = readinessScore >= requiredScore ? 0 : Math.ceil((requiredScore - readinessScore) / 5);
  
  return {
    score: Math.min(100, readinessScore),
    days: daysToReady,
    confidence: moduleStats.total > 50 ? 'high' : 'medium'
  };
}

/**
 * ML: Detect plateau and suggest intervention
 */
function detectPlateau(moduleStats, currentLevel, progress) {
  if (!moduleStats || moduleStats.total < 20) {
    return { isPlateau: false };
  }

  const recentTrend = getRecentTrend(moduleStats, 'accuracy', 7);
  const isPlateau = recentTrend < 0.05 && progress < 60; // <5% improvement and <60% progress
  
  const interventions = [
    'Review fundamentals with SM-2 flashcards',
    'Try different practice modes (ear training, fingerboard)',
    'Lower difficulty temporarily to rebuild confidence',
    'Focus on one technique at a time'
  ];
  
  return {
    isPlateau,
    intervention: isPlateau ? interventions[Math.floor(Math.random() * interventions.length)] : null,
    severity: isPlateau ? (recentTrend < 0 ? 'high' : 'medium') : null
  };
}

// ======================================
// REPERTOIRE MAPPING - ML-Enhanced
// ======================================

/**
 * Real music examples for intervals with ML difficulty prediction
 */
export function getRepertoireForInterval(intervalId) {
  const interval = INTERVALS.find(i => i.id === intervalId);
  if (!interval) return null;
  
  // ML: Predict difficulty based on user history with this interval
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const intervalStats = stats.byModule?.intervals?.byInterval?.[intervalId] || {};
  const userAccuracy = intervalStats.accuracy || 50;
  const attempts = intervalStats.attempts || 0;
  
  // Adjust repertoire suggestions based on performance
  const isMastered = userAccuracy > 85 && attempts > 10;
  const isStruggling = userAccuracy < 60 && attempts > 5;
  
  let recommendedPieces = interval.repertoire || [];
  if (isStruggling) {
    // Suggest easier pieces
    recommendedPieces = interval.etudes?.slice(0, 2) || recommendedPieces;
  } else if (isMastered) {
    // Suggest challenging performance pieces
    recommendedPieces = (interval.performancePieces || interval.repertoire || []).slice(0, 3);
  }
  
  return {
    interval: interval.name,
    semitones: interval.semitones,
    examples: recommendedPieces,
    etudes: interval.etudes || [],
    suzuki: interval.suzukiLevel || 'N/A',
    bielerNote: interval.bielerNote || 'Core interval for hand frame',
    userAccuracy,
    attempts,
    masteryLevel: isMastered ? 'mastered' : isStruggling ? 'needs-practice' : 'developing',
    mlPrediction: predictPieceDifficulty(intervalId, userAccuracy, attempts)
  };
}

/**
 * ML: Predict if a piece is appropriate for current skill level
 */
function predictPieceDifficulty(intervalId, accuracy, attempts) {
  // Simple logistic regression approximation
  const logOdds = (accuracy / 100) * 2 + (attempts / 20) - 1.5;
  const probability = 1 / (1 + Math.exp(-logOdds));
  
  return {
    successProbability: Math.round(probability * 100),
    recommendation: probability > 0.7 ? 'recommended' : probability > 0.4 ? 'challenging' : 'too-difficult',
    estimatedPracticeHours: Math.ceil((100 - accuracy) / 10)
  };
}

// ======================================
// PASSAGE ANALYSIS - ML-Enhanced
// ======================================

/**
 * Analyze sheet music passage → recommended drills with ML context
 */
export function analyzePassage(passageText = '') {
  const analysis = {
    intervals: [],
    techniques: [],
    drills: [],
    difficulty: 'beginner',
    confidence: 0.7,
    mlEnriched: true
  };
  
  const text = passageText.toLowerCase();
  
  // Enhanced interval detection with context
  INTERVALS.forEach(int => {
    const hasInterval = text.includes(int.name.toLowerCase()) || text.includes(int.abbr.toLowerCase());
    if (hasInterval) {
      // ML: Check if this interval is weak for the user
      const intervalStats = getUserIntervalStats(int.id);
      const isWeakArea = intervalStats.accuracy < 70 && intervalStats.attempts > 5;
      
      analysis.intervals.push({
        name: int.name,
        drill: 'intervals',
        module: `#intervals?focus=${int.id}`,
        why: isWeakArea ? `Your weak area (${intervalStats.accuracy}% accuracy)` : 'Found in melodic lines',
        priority: isWeakArea ? 'high' : 'medium',
        confidence: 0.85
      });
    }
  });
  
  // Enhanced technique detection with Bieler taxonomy
  Object.entries(BIELER_TAXONOMY.leftHand || {}).forEach(([key, func]) => {
    const hasTechnique = text.includes(func.name.toLowerCase());
    if (hasTechnique) {
      // ML: Check technique mastery
      const techStats = getUserTechniqueStats(key);
      const needsWork = techStats.seen > 0 && techStats.accuracy < 75;
      
      analysis.techniques.push({
        name: func.name,
        drill: 'bieler',
        module: '#bieler',
        exercises: func.exercises.slice(0, needsWork ? 3 : 2),
        priority: needsWork ? 'high' : 'medium',
        mastery: techStats.accuracy
      });
    }
  });
  
  // ML: Semantic pattern detection
  const semanticPatterns = detectSemanticPatterns(text);
  semanticPatterns.forEach(pattern => {
    analysis.drills.push({
      module: pattern.module,
      reason: pattern.reason,
      route: pattern.route,
      mlConfidence: pattern.confidence
    });
  });
  
  // ML: Difficulty estimation using ensemble approach
  analysis.difficulty = estimateDifficulty(text, analysis.intervals, analysis.techniques);
  analysis.confidence = calculateAnalysisConfidence(analysis);
  
  return analysis;
}

/**
 * ML: Detect semantic patterns in passage text
 */
function detectSemanticPatterns(text) {
  const patterns = [];
  
  // Pattern 1: Position work
  if (/3rd|5th|7th|position|shift/i.test(text)) {
    patterns.push({
      module: 'keys',
      reason: 'Position changes require key familiarity and hand frame knowledge',
      route: '#keys?focus=position',
      confidence: 0.8
    });
  }
  
  // Pattern 2: Complex rhythms
  if (/triplet|duplet|syncopation|polyrhythm/i.test(text)) {
    patterns.push({
      module: 'rhythm',
      reason: 'Complex rhythmic subdivisions need dedicated practice',
      route: '#rhythm?focus=advanced',
      confidence: 0.75
    });
  }
  
  // Pattern 3: Expressive markings
  if (/dolce|martelé|sul ponticello|sul tasto/i.test(text)) {
    patterns.push({
      module: 'bieler',
      reason: 'Expressive techniques from Bieler method vocabulary',
      route: '#bieler?focus=expression',
      confidence: 0.7
    });
  }
  
  return patterns;
}

/**
 * ML: Estimate difficulty using multiple signals
 */
function estimateDifficulty(text, intervals, techniques) {
  const signals = {
    intervalComplexity: intervals.filter(i => i.name.includes('7th') || i.name.includes('dim') || i.name.includes('aug')).length * 0.3,
    techniqueComplexity: techniques.length * 0.25,
    positionChanges: (text.match(/position|shift/g) || []).length * 0.2,
    rhythmicComplexity: (text.match(/triplet|syncopation|irregular/g) || []).length * 0.25
  };
  
  const score = Object.values(signals).reduce((sum, val) => sum + val, 0);
  
  if (score > 1.5) return 'advanced';
  if (score > 0.8) return 'intermediate';
  return 'beginner';
}

/**
 * ML: Calculate confidence in analysis
 */
function calculateAnalysisConfidence(analysis) {
  const intervalConfidence = analysis.intervals.reduce((sum, i) => sum + (i.confidence || 0.7), 0) / Math.max(1, analysis.intervals.length);
  const patternConfidence = analysis.drills.reduce((sum, d) => sum + (d.mlConfidence || 0.5), 0) / Math.max(1, analysis.drills.length);
  
  return Math.min(0.95, (intervalConfidence + patternConfidence) / 2);
}

// ======================================
// REPERTOIRE WORKSHOP - ML-Powered
// ======================================

/**
 * Drill sequence for specific piece challenge with ML personalization
 */
export function generateRepertoireWorkshop(piece, measure, challenge, userLevel = 'intermediate') {
  const baseWorkshops = {
    intonation: [
      { module: 'intervals', duration: 5, goal: 'Perfect intervals in melody' },
      { module: 'keys', duration: 3, goal: 'Key context awareness' }
    ],
    rhythm: [
      { module: 'rhythm', duration: 7, goal: 'Pattern breakdown' },
      { module: 'intervals', duration: 3, goal: 'Rhythmic displacement' }
    ],
    bow: [
      { module: 'bieler', duration: 8, goal: 'Bow function matching' },
      { module: 'rhythm', duration: 4, goal: 'Bow-rhythm coordination' }
    ],
    shifts: [
      { module: 'keys', duration: 6, goal: 'New position hand frame' },
      { module: 'bieler', duration: 4, goal: 'Second Trained Function' }
    ]
  };
  
  const sequence = baseWorkshops[challenge.toLowerCase()] || baseWorkshops.bow;
  
  // ML: Adjust durations based on user level and previous practice efficiency
  const adjustedSequence = sequence.map(drill => {
    const efficiency = getPracticeEfficiency(drill.module);
    const levelMultiplier = userLevel === 'beginner' ? 1.5 : userLevel === 'advanced' ? 0.8 : 1.0;
    
    return {
      ...drill,
      duration: Math.max(2, Math.round(drill.duration * levelMultiplier / efficiency)),
      route: `#${drill.module}`,
      mlOptimized: true
    };
  });
  
  return {
    piece,
    measure,
    challenge,
    prepTime: adjustedSequence.reduce((sum, s) => sum + s.duration, 0),
    drills: adjustedSequence,
    estimatedSessions: Math.ceil(adjustedSequence.reduce((sum, s) => sum + s.duration, 0) / 15), // 15 min sessions
    successProbability: predictWorkshopSuccess(adjustedSequence, userLevel)
  };
}

/**
 * ML: Predict workshop success probability
 */
function predictWorkshopSuccess(sequence, userLevel) {
  const moduleStats = sequence.map(d => {
    const stats = getModuleStats(d.module);
    return {
      module: d.module,
      userAccuracy: stats.accuracy || 50,
      attempts: stats.attempts || 0,
      confidence: Math.min(1, (stats.attempts || 0) / 20)
    };
  });
  
  const weightedScore = moduleStats.reduce((sum, m) => {
    return sum + (m.userAccuracy * m.confidence);
  }, 0) / moduleStats.length;
  
  const levelMultiplier = { beginner: 0.8, intermediate: 1.0, advanced: 1.2 };
  
  return Math.min(0.95, (weightedScore / 100) * levelMultiplier[userLevel]);
}

// ======================================
// ROADMAP & PROGRESS - ML-Enhanced
// ======================================

/**
 * Visual progress roadmap for module with ML predictions
 */
export function getProgressRoadmap(module) {
  const current = getCurrentProgressionLevel(module);
  const ladders = getProgressionLadders(module);
  
  // ML: Add predictions for each future level
  const roadmap = ladders.map((level, i) => {
    const isComplete = i < ladders.findIndex(l => l.name === current.current);
    const isCurrent = level.name === current.current;
    
    let prediction = null;
    if (!isComplete && !isCurrent) {
      prediction = predictLevelTimeline(module, level, i);
    }
    
    return {
      name: level.name,
      complete: isComplete,
      current: isCurrent,
      req: `${level.reqAccuracy}% @ ${level.reqTime}ms`,
      repertoire: level.repertoire.slice(0, 2).join(', '),
      mlPrediction: prediction
    };
  });
  
  return {
    currentLevel: current.current,
    progressPercent: current.progress,
    roadmap,
    crossModuleSynergies: detectCrossModuleSynergies(module), // ML addition
    recommendedFocus: getRecommendedFocusAreas(module) // ML addition
  };
}

/**
 * ML: Predict timeline to complete a level
 */
function predictLevelTimeline(module, targetLevel, levelIndex) {
  const currentStats = getModuleStats(module);
  const velocity = calculateLearningVelocity(
    getRecentTrend(currentStats, 'accuracy', 10),
    getRecentTrend(currentStats, 'time', 10)
  );
  
  const gap = targetLevel.reqAccuracy - (currentStats.accuracy || 0);
  const sessionsNeeded = Math.max(1, Math.ceil(gap / Math.max(0.5, velocity * 5)));
  
  return {
    estimatedSessions: sessionsNeeded,
    estimatedDays: Math.ceil(sessionsNeeded / 2), // Assume 2 sessions/day
    confidence: currentStats.total > 50 ? 'high' : currentStats.total > 20 ? 'medium' : 'low',
    ifContinueCurrentTrend: velocity > 1.0 ? 'on-track' : velocity < 0.5 ? 'falling-behind' : 'steady'
  };
}

/**
 * ML: Detect cross-module skill transfer opportunities
 */
function detectCrossModuleSynergies(module) {
  const modules = ['intervals', 'keys', 'bieler', 'rhythm'];
  const synergies = [];
  
  modules.forEach(otherModule => {
    if (otherModule === module) return;
    
    const otherStats = getModuleStats(otherModule);
    const thisStats = getModuleStats(module);
    
    // If other module is strong and this is weak, suggest transfer
    if (otherStats.accuracy > 80 && thisStats.accuracy < 70 && otherStats.attempts > 20) {
      synergies.push({
        from: otherModule,
        to: module,
        effect: 'positive-transfer',
        strength: Math.min(0.3, (otherStats.accuracy - thisStats.accuracy) / 100),
        recommendedDrill: `Practice ${otherModule} concepts that apply to ${module}`
      });
    }
  });
  
  return synergies;
}

/**
 * ML: Get recommended focus areas based on weaknesses
 */
function getRecommendedFocusAreas(module) {
  const stats = getModuleStats(module);
  const sm2Stats = sm2GetStats();
  const dueItems = sm2Stats?.dueToday || 0;
  
  const focusAreas = [];
  
  if (stats.accuracy < 60) {
    focusAreas.push({ area: 'fundamentals', priority: 'high', reason: 'Low accuracy indicates gaps' });
  }
  
  if (dueItems > 5) {
    focusAreas.push({ area: 'spaced-repetition', priority: 'high', reason: `${dueItems} items due for review` });
  }
  
  if (stats.avgTime > 3000) {
    focusAreas.push({ area: 'speed', priority: 'medium', reason: 'Slow response times' });
  }
  
  return focusAreas;
}

// ======================================
// PROGRESS TRACKING - ML-Enhanced
// ======================================

/**
 * Log repertoire milestone with ML insights
 */
export function logRepertoireMilestone(piece, measure, module) {
  const milestones = loadJSON(STORAGE_KEYS.MILESTONES, []);
  
  // ML: Check if this is a breakthrough performance
  const isBreakthrough = detectBreakthroughPerformance(module, piece);
  
  const milestone = {
    piece,
    measure,
    module,
    date: new Date().toISOString(),
    level: getCurrentProgressionLevel(module).current,
    isBreakthrough,
    mlInsights: {
      retentionPredicted: predictRetentionForPiece(module, piece),
      skillTransferDetected: detectCrossModuleSynergies(module).length > 0,
      difficultyAlignment: getDifficultyAlignment(module, piece)
    }
  };
  
  milestones.push(milestone);
  
  // ML: Trigger gamification for breakthroughs
  if (isBreakthrough) {
    addXP(100, 'breakthrough-performance');
    unlockAchievement('repertoire-breakthrough', { piece, module });
  }
  
  saveJSON(STORAGE_KEYS.MILESTONES, milestones.slice(-50));
  
  // ML: Log to analytics
  if (sessionTracker?.trackActivity) {
    sessionTracker.trackActivity('pedagogy', 'milestone', {
      piece,
      module,
      isBreakthrough,
      readiness: milestone.mlInsights.retentionPredicted
    });
  }
  
  return milestones;
}

/**
 * ML: Detect if performance represents a breakthrough
 */
function detectBreakthroughPerformance(module, piece) {
  const stats = getModuleStats(module);
  const recentImprovement = getRecentImprovementRate(stats, 5);
  
  // Breakthrough if rapid improvement AND above-average performance
  return recentImprovement > 15 && stats.accuracy > 75;
}

/**
 * ML: Predict retention for a specific piece
 */
function predictRetentionForPiece(module, piece) {
  const sm2Stats = sm2GetStats();
  const baseRetention = sm2Stats?.retention || 70;
  
  // Adjust based on piece difficulty and user performance
  const difficultyFactor = getPieceDifficulty(piece) * 0.1;
  const performanceFactor = getModuleStats(module).accuracy / 100;
  
  return Math.min(95, baseRetention + (difficultyFactor * performanceFactor * 10));
}

// ======================================
// QUICK EXPORTS & UTILITY
// ======================================

export function getQuickRepertoire(module) {
  const ladders = getProgressionLadders(module);
  const currentLevel = getCurrentProgressionLevel(module);
  
  // ML: Filter to appropriate difficulty level
  const appropriateRepertoire = ladders
    .filter((_, i) => i <= ladders.findIndex(l => l.name === currentLevel.current) + 1)
    .flatMap(level => level.repertoire)
    .slice(0, 5);
  
  return appropriateRepertoire;
}

/**
 * Utility: Get recent trend for a metric
 */
function getRecentTrend(stats, metric, window) {
  const recent = (stats.recentHistory || []).slice(-window);
  if (recent.length < 2) return 0;
  
  const first = recent[0]?.[metric] || 0;
  const last = recent[recent.length - 1]?.[metric] || 0;
  
  return (last - first) / Math.max(1, recent.length - 1);
}

/**
 * Utility: Get recent average for a metric
 */
function getRecentAverage(stats, metric, window) {
  const recent = (stats.recentHistory || []).slice(-window);
  if (!recent.length) return 0;
  
  const sum = recent.reduce((acc, item) => acc + (item?.[metric] || 0), 0);
  return sum / recent.length;
}

/**
 * Utility: Calculate learning velocity
 */
function calculateLearningVelocity(accuracyTrend, timeTrend) {
  // Normalize trends: positive accuracy + negative time = good velocity
  const normalizedAccuracy = Math.max(0, Math.min(2, accuracyTrend + 1));
  const normalizedTime = Math.max(0, Math.min(2, 1 - (timeTrend / 1000)));
  
  return (normalizedAccuracy + normalizedTime) / 2;
}

/**
 * Utility: Get cross-module transfer bonus
 */
function getCrossModuleTransferBonus(module) {
  const synergies = detectCrossModuleSynergies(module);
  const positiveTransfers = synergies.filter(s => s.effect === 'positive-transfer');
  
  if (!positiveTransfers.length) return 1.0;
  
  const avgStrength = positiveTransfers.reduce((sum, s) => sum + s.strength, 0) / positiveTransfers.length;
  return 1.0 + (avgStrength * 0.15); // Up to 15% bonus
}

/**
 * Utility: Get module statistics
 */
function getModuleStats(module) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  return stats.byModule?.[module] || { total: 0, correct: 0, accuracy: 0, attempts: 0 };
}

/**
 * Utility: Get user interval statistics
 */
function getUserIntervalStats(intervalId) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  return stats.byModule?.intervals?.byInterval?.[intervalId] || { accuracy: 0, attempts: 0 };
}

/**
 * Utility: Get user technique statistics
 */
function getUserTechniqueStats(techniqueKey) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  return stats.byModule?.bieler?.byTechnique?.[techniqueKey] || { accuracy: 0, seen: 0 };
}

/**
 * Utility: Get piece difficulty rating
 */
function getPieceDifficulty(piece) {
  // Simple heuristic: count technical terms in piece name
  const technicalTerms = (piece.match(/concerto|sonata|etude|caprice/gi) || []).length;
  return Math.min(3, technicalTerms + 1);
}

/**
 * Utility: Get difficulty alignment
 */
function getDifficultyAlignment(module, piece) {
  const pieceDiff = getPieceDifficulty(piece);
  const userLevel = getModuleStats(module).level || 1;
  
  const alignment = pieceDiff - userLevel;
  if (alignment > 1) return 'too-difficult';
  if (alignment < -1) return 'too-easy';
  return 'well-aligned';
}

/**
 * Utility: Get recent improvement rate
 */
function getRecentImprovementRate(stats, window) {
  const recent = (stats.recentHistory || []).slice(-window);
  if (recent.length < 2) return 0;
  
  const first = recent[0]?.accuracy || 0;
  const last = recent[recent.length - 1]?.accuracy || 0;
  
  return last - first;
}
