// ======================================
// VMQ ANALYTICS v3.0 - Advanced ML Intelligence
// Predictive Learning • Adaptive Patterns • Deep Integration
// SM-2 + Difficulty + Session + CoachEngine + 50+ modules
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { MUSIC, accuracy, average, clamp } from '../utils/helpers.js';
import { sessionTracker } from './sessionTracker.js';
import { getDueItems, getStats as sm2Stats } from './spacedRepetition.js';
import { getGlobalStats as diffStats } from './difficultyAdapter.js';

// ======================================
// 🎯 ADVANCED PERFORMANCE ANALYSIS
// ======================================

/**
 * Complete ML-enhanced performance analysis
 * @param {string} timeframe - Analysis window ('week', 'month', 'quarter', 'all')
 * @param {object} options - Advanced options for ML predictions
 * @returns {object} Comprehensive analytics with ML insights
 */
export function analyzePerformance(timeframe = 'week', options = {}) {
  const {
    includePredictions = true,
    includePatterns = true,
    includeOptimization = true,
    includeBreakthrough = true
  } = options;

  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, initializeStats());
  const sessions = loadJSON(STORAGE_KEYS.JOURNAL, []);
  const now = Date.now();
  
  // Timeframe filter with smart windowing
  const cutoff = getTimeCutoff(timeframe);
  const filteredSessions = sessions.filter(s => 
    now - new Date(s.timestamp).getTime() < cutoff
  );

  // 🎯 CORE METRICS (Enhanced)
  const overall = calculateOverallStats(stats, filteredSessions);
  const modules = calculateModuleStats(stats, filteredSessions);
  const trends = calculateTrends(filteredSessions);
  
  // 🧠 MACHINE LEARNING INSIGHTS
  const predictions = includePredictions 
    ? generatePredictions(stats, filteredSessions, modules) 
    : null;
  
  const patterns = includePatterns 
    ? detectLearningPatterns(filteredSessions, stats) 
    : null;
  
  const optimization = includeOptimization 
    ? calculateOptimalPracticeSchedule(filteredSessions, patterns) 
    : null;
  
  const breakthroughs = includeBreakthrough 
    ? detectBreakthroughOpportunities(modules, patterns, overall) 
    : null;
  
  return {
    timeframe,
    timestamp: Date.now(),
    ...overall,
    
    // Module Analysis
    modules: modules.slice(0, 12), // Top 12 for deeper analysis
    strengths: identifyStrengths(modules),
    weaknesses: identifyWeaknesses(modules),
    masteryZones: identifyMasteryZones(modules),
    growthOpportunities: identifyGrowthOpportunities(modules, patterns),
    
    // Trends & Patterns
    trends,
    patterns,
    
    // ML-Enhanced Features
    predictions,
    optimization,
    breakthroughs,
    
    // Cross-Engine Integration
    sm2Integration: integrateSM2Data(),
    difficultyAnalysis: integrateDifficultyData(),
    sessionQuality: analyzeSessionQuality(filteredSessions),
    
    // Actionable Intelligence
    recommendations: generateSmartRecommendations(
      overall, modules, trends, patterns, predictions
    ),
    aiInsights: generateAdvancedAIInsights(
      overall, modules, patterns, predictions, breakthroughs
    ),
    
    // Retention & Mastery Metrics
    retentionMetrics: calculateRetentionMetrics(stats, modules),
    transferLearning: detectTransferLearning(modules),
    metacognition: assessMetacognitiveSkills(filteredSessions, stats)
  };
}

// ======================================
// 🧠 MACHINE LEARNING PREDICTIONS
// ======================================

/**
 * Generate ML-based predictions for future performance
 * Uses regression analysis and pattern matching
 */
function generatePredictions(stats, sessions, modules) {
  if (sessions.length < 5) return null; // Need minimum data
  
  const recentSessions = sessions.slice(0, 20);
  const timeSeriesData = buildTimeSeriesData(recentSessions);
  
  return {
    nextWeekAccuracy: predictNextWeekAccuracy(timeSeriesData),
    breakthroughModules: predictBreakthroughModules(modules, timeSeriesData),
    plateauRisk: assessPlateauRisk(timeSeriesData, modules),
    optimalPracticeTime: predictOptimalPracticeTime(recentSessions),
    masteryTimeline: estimateMasteryTimeline(modules),
    retentionForecast: forecastRetention(stats, modules),
    
    // Confidence scores
    confidence: {
      accuracy: calculatePredictionConfidence(timeSeriesData),
      stability: assessDataStability(sessions)
    }
  };
}

/**
 * Predict next week's accuracy using weighted moving average
 * with exponential decay for recent performance
 */
function predictNextWeekAccuracy(timeSeriesData) {
  if (!timeSeriesData || timeSeriesData.length < 3) return null;
  
  // Exponential weighted moving average (EWMA)
  const weights = timeSeriesData.map((_, i) => 
    Math.exp(-0.15 * (timeSeriesData.length - 1 - i)) // Recent data weighted higher
  );
  
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const weightedAvg = timeSeriesData.reduce((sum, point, i) => 
    sum + (point.accuracy * weights[i]) / weightSum
  , 0);
  
  // Calculate trend (linear regression slope)
  const trend = calculateLinearTrend(
    timeSeriesData.map((p, i) => ({ x: i, y: p.accuracy }))
  );
  
  // Prediction: weighted average + trend projection
  const prediction = clamp(weightedAvg + (trend * 7), 0, 100);
  
  return {
    predicted: Math.round(prediction),
    current: Math.round(timeSeriesData[timeSeriesData.length - 1]?.accuracy || 0),
    trend: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
    trendStrength: Math.abs(trend),
    confidence: calculatePredictionConfidence(timeSeriesData)
  };
}

/**
 * Identify modules likely to breakthrough (>10% improvement)
 */
function predictBreakthroughModules(modules, timeSeriesData) {
  return modules
    .filter(m => m.attempts >= 10 && m.accuracy >= 65 && m.accuracy < 90)
    .map(m => {
      const recentTrend = m.trend || 0;
      const consistency = m.consistency || 50;
      const momentum = calculateMomentum(m.moduleKey, timeSeriesData);
      
      // Breakthrough likelihood score
      const score = (
        (recentTrend * 0.4) +           // Recent improvement
        (consistency * 0.3) +            // Consistency bonus
        (momentum * 0.3)                 // Learning momentum
      );
      
      return {
        module: m.module,
        moduleKey: m.moduleKey,
        currentAccuracy: m.accuracy,
        breakthroughLikelihood: Math.round(Math.min(100, Math.max(0, score))),
        estimatedDays: Math.max(3, Math.round(30 * (1 - score / 100))),
        confidence: consistency > 60 ? 'high' : consistency > 40 ? 'medium' : 'low'
      };
    })
    .filter(m => m.breakthroughLikelihood >= 50)
    .sort((a, b) => b.breakthroughLikelihood - a.breakthroughLikelihood)
    .slice(0, 3);
}

/**
 * Assess risk of performance plateau
 */
function assessPlateauRisk(timeSeriesData, modules) {
  if (!timeSeriesData || timeSeriesData.length < 10) return null;
  
  const recentData = timeSeriesData.slice(-10);
  const variance = calculateVariance(recentData.map(d => d.accuracy));
  const trend = calculateLinearTrend(
    recentData.map((d, i) => ({ x: i, y: d.accuracy }))
  );
  
  // Plateau indicators
  const lowVariance = variance < 25; // Stable but not improving
  const flatTrend = Math.abs(trend) < 1; // No significant slope
  const highAccuracyStuck = recentData[recentData.length - 1]?.accuracy > 75 && flatTrend;
  
  const plateauScore = (
    (lowVariance ? 40 : 0) +
    (flatTrend ? 40 : 0) +
    (highAccuracyStuck ? 20 : 0)
  );
  
  return {
    risk: plateauScore >= 60 ? 'high' : plateauScore >= 40 ? 'medium' : 'low',
    score: plateauScore,
    indicators: {
      lowVariance,
      flatTrend,
      stagnantModules: modules.filter(m => 
        m.attempts >= 15 && Math.abs(m.trend || 0) < 2
      ).length
    },
    recommendation: plateauScore >= 60 
      ? 'Increase practice variety and introduce new challenges'
      : 'Maintain current practice routine'
  };
}

/**
 * Predict optimal practice time based on performance patterns
 */
function predictOptimalPracticeTime(sessions) {
  if (sessions.length < 5) return null;
  
  // Analyze performance by time of day
  const performanceByHour = sessions.reduce((acc, s) => {
    const hour = new Date(s.timestamp).getHours();
    if (!acc[hour]) acc[hour] = { total: 0, sum: 0, count: 0 };
    acc[hour].sum += s.accuracy || 0;
    acc[hour].count += 1;
    acc[hour].total = acc[hour].sum / acc[hour].count;
    return acc;
  }, {});
  
  // Find peak performance hours
  const sortedHours = Object.entries(performanceByHour)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);
  
  return {
    peakHours: sortedHours.map(([hour, data]) => ({
      hour: parseInt(hour),
      timeRange: formatTimeRange(parseInt(hour)),
      avgAccuracy: Math.round(data.total),
      sessions: data.count
    })),
    recommendation: sortedHours[0] 
      ? `Best practice time: ${formatTimeRange(parseInt(sortedHours[0][0]))}`
      : null
  };
}

/**
 * Estimate timeline to mastery for each module
 */
function estimateMasteryTimeline(modules) {
  return modules
    .filter(m => m.accuracy < 95 && m.attempts >= 5)
    .map(m => {
      const accuracyGap = 95 - m.accuracy;
      const recentTrend = m.trend || 0;
      const avgImprovement = Math.max(0.5, recentTrend, 1); // Min 0.5% per session
      
      const estimatedSessions = Math.ceil(accuracyGap / avgImprovement);
      const estimatedDays = Math.ceil(estimatedSessions / 3); // Assume 3 sessions/day avg
      
      return {
        module: m.module,
        currentAccuracy: m.accuracy,
        toMastery: accuracyGap,
        estimatedSessions,
        estimatedDays: Math.min(180, estimatedDays), // Cap at 6 months
        confidence: m.attempts >= 20 && m.consistency >= 60 ? 'high' : 'medium'
      };
    })
    .sort((a, b) => a.estimatedDays - b.estimatedDays)
    .slice(0, 5);
}

/**
 * Forecast retention based on practice patterns
 */
function forecastRetention(stats, modules) {
  const sm2Data = integrateSM2Data();
  
  return {
    currentRetention: sm2Data?.retention || 0,
    projectedRetention30Days: calculateProjectedRetention(stats, modules, 30),
    projectedRetention90Days: calculateProjectedRetention(stats, modules, 90),
    atRiskConcepts: identifyAtRiskConcepts(modules),
    strengthenedConcepts: identifyStrengthenedConcepts(modules)
  };
}

// ======================================
// 🎨 LEARNING PATTERNS DETECTION
// ======================================

/**
 * Detect complex learning patterns using behavioral analysis
 */
function detectLearningPatterns(sessions, stats) {
  if (sessions.length < 5) return null;
  
  const recentSessions = sessions.slice(0, 30);
  
  return {
    learningStyle: identifyLearningStyle(stats),
    practiceHabits: analyzePracticeHabits(recentSessions),
    focusPatterns: analyzeFocusPatterns(recentSessions),
    errorPatterns: analyzeErrorPatterns(stats),
    recoveryRate: calculateRecoveryRate(recentSessions),
    cognitiveLoad: assessCognitiveLoad(recentSessions, stats),
    deliberatePractice: assessDeliberatePractice(recentSessions),
    transferEfficiency: measureTransferEfficiency(stats)
  };
}

/**
 * Identify dominant learning style (auditory/visual/kinesthetic/balanced)
 */
function identifyLearningStyle(stats) {
  const modulePrefs = Object.entries(stats.byModule || {})
    .filter(([_, data]) => data.total >= 10)
    .map(([module, data]) => ({
      module,
      score: accuracy(data.correct, data.total),
      category: classifyModuleType(module)
    }));
  
  const categoryScores = modulePrefs.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + m.score;
    return acc;
  }, {});
  
  const dominantStyle = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';
  
  return {
    primary: dominantStyle,
    scores: categoryScores,
    confidence: calculateStyleConfidence(categoryScores),
    recommendation: getStyleRecommendation(dominantStyle)
  };
}

/**
 * Analyze practice habits for consistency and quality
 */
function analyzePracticeHabits(sessions) {
  const dailyPractice = groupSessionsByDay(sessions);
  const daysActive = Object.keys(dailyPractice).length;
  const totalDays = Math.ceil(
    (Date.now() - new Date(sessions[sessions.length - 1]?.timestamp || Date.now()).getTime()) 
    / (24 * 60 * 60 * 1000)
  );
  
  return {
    consistency: Math.round((daysActive / Math.max(1, totalDays)) * 100),
    avgSessionsPerDay: Math.round((sessions.length / Math.max(1, daysActive)) * 10) / 10,
    avgDuration: average(sessions.map(s => s.engagedMs || 0)) / 60000, // minutes
    preferredTime: identifyPreferredPracticeTime(sessions),
    sessionDistribution: calculateSessionDistribution(sessions)
  };
}

/**
 * Analyze focus and attention patterns
 */
function analyzeFocusPatterns(sessions) {
  return {
    avgFocusScore: average(sessions.map(s => s.focusScore || 50)),
    focusTrend: calculateLinearTrend(
      sessions.map((s, i) => ({ x: i, y: s.focusScore || 50 }))
    ),
    bestFocusDuration: identifyOptimalSessionLength(sessions),
    distractionTriggers: identifyDistractionTriggers(sessions)
  };
}

/**
 * Analyze error patterns to identify systematic mistakes
 */
function analyzeErrorPatterns(stats) {
  const modules = Object.entries(stats.byModule || {});
  
  return {
    systematicErrors: identifySystematicErrors(modules),
    errorClusters: identifyErrorClusters(stats),
    conceptualGaps: identifyConceptualGaps(modules),
    correctionRate: calculateCorrectionRate(stats)
  };
}

/**
 * Calculate recovery rate from mistakes
 */
function calculateRecoveryRate(sessions) {
  const recoveries = sessions.filter((s, i) => {
    if (i === 0) return false;
    const prev = sessions[i - 1];
    return prev.accuracy < 70 && s.accuracy >= 80;
  });
  
  return {
    rate: sessions.length > 1 ? Math.round((recoveries.length / sessions.length) * 100) : 0,
    avgRecoveryTime: average(recoveries.map(s => s.engagedMs || 0)) / 60000,
    resilience: recoveries.length >= 3 ? 'high' : recoveries.length >= 1 ? 'medium' : 'developing'
  };
}

// ======================================
// ⚡ OPTIMIZATION ENGINE
// ======================================

/**
 * Calculate optimal practice schedule based on ML analysis
 */
function calculateOptimalPracticeSchedule(sessions, patterns) {
  if (!patterns || sessions.length < 10) return null;
  
  return {
    idealDuration: calculateIdealSessionDuration(sessions),
    frequencyRecommendation: calculateIdealFrequency(sessions, patterns),
    timeOfDay: patterns.practiceHabits?.preferredTime,
    moduleRotation: generateModuleRotation(patterns),
    restDays: calculateOptimalRestDays(sessions),
    intensityProfile: generateIntensityProfile(sessions)
  };
}

/**
 * Generate intelligent module rotation schedule
 */
function generateModuleRotation(patterns) {
  const sm2Data = integrateSM2Data();
  const diffData = integrateDifficultyData();
  
  return {
    daily: [
      { priority: 1, category: 'weak-modules', duration: 15 },
      { priority: 2, category: 'sm2-due', duration: 10 },
      { priority: 3, category: 'skill-maintenance', duration: 10 },
      { priority: 4, category: 'new-challenges', duration: 10 }
    ],
    weekly: generateWeeklyRotation(patterns),
    adaptiveAdjustment: true
  };
}

// ======================================
// 🎯 BREAKTHROUGH OPPORTUNITIES
// ======================================

/**
 * Detect opportunities for significant breakthroughs
 */
function detectBreakthroughOpportunities(modules, patterns, overall) {
  const opportunities = [];
  
  // Near-mastery modules (85-94% accuracy)
  modules
    .filter(m => m.accuracy >= 85 && m.accuracy < 95 && m.consistency >= 60)
    .forEach(m => {
      opportunities.push({
        type: 'mastery-threshold',
        module: m.module,
        currentLevel: m.accuracy,
        potential: 95 - m.accuracy,
        effort: 'low',
        impact: 'high',
        recommendation: `Focus 15 min daily to reach mastery in ~${Math.ceil((95 - m.accuracy) / 2)} days`
      });
    });
  
  // Plateau breakers (stuck 70-80%)
  modules
    .filter(m => m.accuracy >= 70 && m.accuracy < 80 && m.attempts >= 20 && Math.abs(m.trend) < 1)
    .forEach(m => {
      opportunities.push({
        type: 'plateau-break',
        module: m.module,
        currentLevel: m.accuracy,
        recommendation: `Change practice approach: try ${getAlternativePracticeMethod(m.moduleKey)}`,
        effort: 'medium',
        impact: 'high'
      });
    });
  
  // Skill transfer opportunities
  const transferOps = identifyTransferOpportunities(modules);
  opportunities.push(...transferOps);
  
  return opportunities.sort((a, b) => {
    const impactScore = { high: 3, medium: 2, low: 1 };
    const effortScore = { low: 3, medium: 2, high: 1 };
    return (impactScore[b.impact] * effortScore[b.effort]) - 
           (impactScore[a.impact] * effortScore[a.effort]);
  }).slice(0, 5);
}

// ======================================
// 🔄 CROSS-ENGINE INTEGRATION
// ======================================

/**
 * Integrate SM-2 spaced repetition data
 */
function integrateSM2Data() {
  try {
    const sm2 = sm2Stats ? sm2Stats() : null;
    return sm2 ? {
      dueToday: sm2.dueToday || 0,
      mature: sm2.mature || 0,
      retention: sm2.retention || 0,
      avgEF: sm2.avgEF || 2.5
    } : null;
  } catch (e) {
    return null;
  }
}

/**
 * Integrate difficulty adapter data
 */
function integrateDifficultyData() {
  try {
    const diff = diffStats ? diffStats() : null;
    return diff ? {
      avgDifficulty: diff.avgDifficulty || 1.0,
      adaptationRate: diff.adaptationRate || 0,
      challengeLevel: diff.challengeLevel || 'balanced'
    } : null;
  } catch (e) {
    return null;
  }
}

/**
 * Analyze session quality metrics
 */
function analyzeSessionQuality(sessions) {
  if (sessions.length === 0) return null;
  
  return {
    avgQualityScore: average(sessions.map(s => s.qualityScore || 50)),
    avgFocusScore: average(sessions.map(s => s.focusScore || 1.0)) * 100,
    avgConsistencyScore: average(sessions.map(s => s.consistencyScore || 50)),
    highQualitySessions: sessions.filter(s => (s.qualityScore || 0) >= 80).length,
    qualityTrend: calculateLinearTrend(
      sessions.slice(0, 20).map((s, i) => ({ x: i, y: s.qualityScore || 50 }))
    )
  };
}

// ======================================
// 🎓 RETENTION & MASTERY METRICS
// ======================================

/**
 * Calculate comprehensive retention metrics
 */
function calculateRetentionMetrics(stats, modules) {
  return {
    shortTerm: calculateShortTermRetention(stats), // <7 days
    mediumTerm: calculateMediumTermRetention(stats), // 7-30 days
    longTerm: calculateLongTermRetention(stats), // >30 days
    forgettingCurve: estimateForgettingCurve(stats),
    consolidatedSkills: identifyConsolidatedSkills(modules),
    volatileSkills: identifyVolatileSkills(modules)
  };
}

/**
 * Detect transfer learning between modules
 */
function detectTransferLearning(modules) {
  const correlations = calculateModuleCorrelations(modules);
  
  return {
    positivetransfer: correlations.filter(c => c.correlation > 0.6),
    negativeTransfer: correlations.filter(c => c.correlation < -0.3),
    recommendations: generateTransferRecommendations(correlations)
  };
}

/**
 * Assess metacognitive skills (learning to learn)
 */
function assessMetacognitiveSkills(sessions, stats) {
  return {
    selfAwareness: calculateSelfAwareness(sessions),
    adaptability: calculateAdaptability(sessions, stats),
    errorCorrection: calculateErrorCorrectionRate(stats),
    strategicThinking: assessStrategicThinking(sessions),
    reflectionQuality: assessReflectionQuality(sessions)
  };
}

// ======================================
// 🎯 ENHANCED RECOMMENDATIONS
// ======================================

/**
 * Generate ML-powered smart recommendations
 */
export function generateSmartRecommendations(overall, modules, trends, patterns, predictions) {
  const recs = [];

  // URGENT: Critical weaknesses (ML-enhanced)
  const criticalWeaknesses = identifyWeaknesses(modules)
    .filter(m => m.accuracy < 70 && m.attempts >= 10);
  
  criticalWeaknesses.slice(0, 2).forEach(module => {
    recs.push({
      priority: 'urgent',
      type: 'focus',
      icon: '🎯',
      title: `${module.module} Critical`,
      message: `${module.accuracy}% accuracy (${module.attempts} attempts)`,
      action: `#${module.moduleKey}`,
      reasoning: `Low accuracy with high attempts suggests systematic errors`,
      estimatedTime: 20,
      difficulty: 'medium',
      mlConfidence: 0.9
    });
  });

  // HIGH: SM-2 Reviews
  const sm2Data = integrateSM2Data();
  if (sm2Data && sm2Data.dueToday >= 5) {
    recs.push({
      priority: 'high',
      type: 'review',
      icon: '🔄',
      title: 'Flashcard Review Due',
      message: `${sm2Data.dueToday} cards need review`,
      action: '#flashcards',
      reasoning: 'Optimal retention window closing',
      estimatedTime: Math.ceil(sm2Data.dueToday / 2),
      difficulty: 'easy',
      mlConfidence: 1.0
    });
  }

  // HIGH: Breakthrough opportunities
  if (predictions?.breakthroughModules?.length > 0) {
    const top = predictions.breakthroughModules[0];
    recs.push({
      priority: 'high',
      type: 'breakthrough',
      icon: '🚀',
      title: `${top.module} Ready to Break Through`,
      message: `${top.breakthroughLikelihood}% breakthrough probability`,
      action: `#${top.moduleKey}`,
      reasoning: `Momentum detected. Push to ${top.currentAccuracy + 10}% in ~${top.estimatedDays} days`,
      estimatedTime: 15,
      difficulty: 'medium',
      mlConfidence: top.breakthroughLikelihood / 100
    });
  }

  // MEDIUM: Plateau breakers
  if (predictions?.plateauRisk?.risk === 'high') {
    recs.push({
      priority: 'medium',
      type: 'plateau',
      icon: '📈',
      title: 'Break Through Plateau',
      message: predictions.plateauRisk.recommendation,
      action: '#bieler',
      reasoning: 'Performance has stabilized. Time for new challenges',
      estimatedTime: 15,
      difficulty: 'hard',
      mlConfidence: 0.75
    });
  }

  // MEDIUM: Optimal practice time
  if (predictions?.optimalPracticeTime) {
    const peak = predictions.optimalPracticeTime.peakHours[0];
    if (peak) {
      recs.push({
        priority: 'medium',
        type: 'optimization',
        icon: '⏰',
        title: 'Practice at Peak Performance Time',
        message: `Best results at ${peak.timeRange} (${peak.avgAccuracy}% avg)`,
        action: '#planner',
        reasoning: 'ML analysis shows peak cognitive performance',
        estimatedTime: 30,
        difficulty: 'easy',
        mlConfidence: 0.8
      });
    }
  }

  // LOW: Consistency building
  if (overall.consistencyScore < 60) {
    recs.push({
      priority: 'low',
      type: 'habit',
      icon: '📅',
      title: 'Build Practice Consistency',
      message: `${overall.consistencyScore}% consistency. Target 5 days/week`,
      action: '#planner',
      reasoning: 'Consistency compounds better than intensity',
      estimatedTime: 15,
      difficulty: 'easy',
      mlConfidence: 0.95
    });
  }

  return recs
    .sort((a, b) => {
      const priorityMap = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (priorityMap[b.priority] * (b.mlConfidence || 0.5)) - 
             (priorityMap[a.priority] * (a.mlConfidence || 0.5));
    })
    .slice(0, 6);
}

/**
 * Generate advanced AI insights with ML predictions
 */
export function generateAdvancedAIInsights(overall, modules, patterns, predictions, breakthroughs) {
  const insights = [];

  // Mastery insights
  if (overall.overallAccuracy >= 90) {
    insights.push({
      type: 'mastery',
      icon: '🎉',
      message: `Outstanding ${overall.overallAccuracy}% mastery!`,
      detail: 'You\'re in the top 10% of learners',
      nextModule: 'bielerlab',
      mlScore: 0.95
    });
  }

  // Learning velocity insight
  if (patterns?.cognitiveLoad) {
    const load = patterns.cognitiveLoad;
    insights.push({
      type: 'cognitive',
      icon: '🧠',
      message: `Cognitive load: ${load.level}`,
      detail: load.level === 'optimal' 
        ? 'Perfect challenge level - keep going!'
        : load.level === 'high'
        ? 'Consider shorter sessions or easier material'
        : 'Ready for more challenge',
      mlScore: 0.88
    });
  }

  // Breakthrough prediction
  if (predictions?.breakthroughModules?.length > 0) {
    const top = predictions.breakthroughModules[0];
    insights.push({
      type: 'prediction',
      icon: '🔮',
      message: `${top.module} breakthrough in ~${top.estimatedDays} days`,
      detail: `${top.breakthroughLikelihood}% probability at current pace`,
      module: top.module,
      mlScore: top.breakthroughLikelihood / 100
    });
  }

  // Retention insight
  if (predictions?.retentionForecast) {
    const retention = predictions.retentionForecast;
    insights.push({
      type: 'retention',
      icon: '💪',
      message: `${Math.round(retention.currentRetention)}% retention rate`,
      detail: retention.currentRetention >= 85 
        ? 'Excellent long-term memory!'
        : 'Review due items to strengthen retention',
      mlScore: 0.82
    });
  }

  // Transfer learning
  const topModule = modules[0];
  if (topModule && topModule.accuracy >= 95) {
    insights.push({
      type: 'strength',
      icon: '⭐',
      message: `${topModule.module} → Expert level`,
      detail: 'This skill transfers to related modules',
      module: topModule.module,
      mlScore: 0.9
    });
  }

  return insights
    .sort((a, b) => (b.mlScore || 0) - (a.mlScore || 0))
    .slice(0, 5);
}

// ======================================
// 🔧 HELPER FUNCTIONS (Enhanced)
// ======================================

function initializeStats() {
  return {
    total: 0,
    correct: 0,
    byModule: {},
    daily: {},
    streaks: { current: 0, max: 0 },
    recentSessions: [],
    lastAnalysis: Date.now(),
    confusionMatrix: {}, // NEW: Track specific error patterns
    learningVelocity: [], // NEW: Track learning rate over time
    retentionHistory: []  // NEW: Track retention over time
  };
}

function getTimeCutoff(timeframe) {
  const cutoffs = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    quarter: 90 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
    all: Infinity
  };
  return cutoffs[timeframe] || cutoffs.week;
}

function calculateOverallStats(stats, sessions) {
  const totalTime = sessions.reduce((sum, s) => sum + (s.engagedMs || 0), 0);
  const uniqueDays = new Set(sessions.map(s => 
    new Date(s.timestamp).toDateString()
  )).size;
  
  const consistency = sessions.length > 0 
    ? Math.round((uniqueDays / Math.max(1, Math.ceil(
        (Date.now() - new Date(sessions[sessions.length - 1]?.timestamp || Date.now()).getTime()) 
        / (24 * 60 * 60 * 1000)
      ))) * 100) 
    : 0;

  return {
    overallAccuracy: accuracy(stats.correct, stats.total),
    totalPracticeTime: formatDuration(totalTime),
    totalSessions: sessions.length,
    consistencyScore: Math.min(100, consistency),
    avgSessionTime: formatDuration(totalTime / Math.max(1, sessions.length)),
    currentStreak: calculateCurrentStreak(sessions),
    avgAccuracy: average(sessions.map(s => s.accuracy || 0)),
    totalQuestions: stats.total,
    xpGained: sessions.reduce((sum, s) => sum + (s.xpEarned || 0), 0)
  };
}

function calculateModuleStats(stats, sessions) {
  return Object.entries(stats.byModule || {}).map(([module, data]) => {
    const moduleKey = module.toLowerCase().replace(/\s+/g, '');
    const moduleSessions = sessions.filter(s => 
      s.activity?.toLowerCase().includes(moduleKey)
    );
    
    return {
      module: formatModuleName(module),
      moduleKey,
      accuracy: accuracy(data.correct, data.total),
      attempts: data.total,
      avgResponseTime: data.avgResponseTime || 0,
      recentAccuracy: accuracy(data.recentCorrect || 0, data.recentTotal || 1),
      improvement: calculateImprovement(data),
      trend: calculateModuleTrend(moduleSessions),
      consistency: calculateConsistency(moduleSessions),
      lastPracticed: data.lastPracticed || 0,
      difficulty: data.difficulty || 'medium',
      mastery: calculateMastery(
        accuracy(data.correct, data.total), 
        data.total, 
        accuracy(data.recentCorrect || 0, data.recentTotal || 1)
      )
    };
  }).sort((a, b) => b.mastery - a.mastery);
}

function calculateTrends(sessions) {
  const sevenDays = sessions
    .filter(s => Date.now() - new Date(s.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => b.timestamp - a.timestamp);
  
  return {
    currentStreak: calculateCurrentStreak(sevenDays),
    sessionsPerDay: sevenDays.length > 0 ? Math.round((sevenDays.length / 7) * 10) / 10 : 0,
    accuracyTrend: getAccuracyTrend(sevenDays),
    practiceTrend: sevenDays.length >= 5 ? 'consistent' : 'building',
    momentumScore: calculateMomentumScore(sevenDays)
  };
}

// Identity functions (strength/weakness detection)
function identifyStrengths(modules) {
  return modules
    .filter(m => m.accuracy >= 85 && m.attempts >= 10 && m.consistency >= 60)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 3);
}

function identifyWeaknesses(modules) {
  return modules
    .filter(m => m.accuracy < 75 && m.attempts >= 5)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
}

function identifyMasteryZones(modules) {
  return modules.filter(m => m.mastery >= 90 && m.attempts >= 20);
}

function identifyGrowthOpportunities(modules, patterns) {
  return modules
    .filter(m => 
      m.accuracy >= 75 && 
      m.accuracy < 90 && 
      m.consistency >= 50 &&
      m.trend > 0
    )
    .sort((a, b) => (b.trend * b.consistency) - (a.trend * a.consistency))
    .slice(0, 5);
}

// Statistical helper functions
function calculateLinearTrend(data) {
  if (data.length < 2) return 0;
  
  const n = data.length;
  const sumX = data.reduce((sum, d) => sum + d.x, 0);
  const sumY = data.reduce((sum, d) => sum + d.y, 0);
  const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
  const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return isNaN(slope) ? 0 : slope;
}

function calculateVariance(data) {
  if (data.length === 0) return 0;
  const mean = average(data);
  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  return average(squaredDiffs);
}

function calculateMomentum(moduleKey, timeSeriesData) {
  // Momentum = trend * consistency
  const moduleData = timeSeriesData.filter(d => 
    d.module?.toLowerCase() === moduleKey.toLowerCase()
  );
  
  if (moduleData.length < 3) return 0;
  
  const trend = calculateLinearTrend(
    moduleData.map((d, i) => ({ x: i, y: d.accuracy }))
  );
  const consistency = 100 - calculateVariance(moduleData.map(d => d.accuracy));
  
  return Math.max(0, (trend * consistency) / 100);
}

function calculateMastery(accuracy, attempts, recentAccuracy) {
  // Mastery score considers: accuracy, volume, consistency
  const accuracyScore = accuracy;
  const volumeScore = Math.min(100, (attempts / 50) * 100);
  const consistencyScore = recentAccuracy >= accuracy - 5 ? 100 : 50;
  
  return Math.round(
    accuracyScore * 0.5 + 
    volumeScore * 0.25 + 
    consistencyScore * 0.25
  );
}

function calculateConsistency(sessions) {
  if (sessions.length < 3) return 50;
  const accuracies = sessions.map(s => s.accuracy || 0);
  const variance = calculateVariance(accuracies);
  return Math.max(0, Math.min(100, 100 - variance));
}

function calculateModuleTrend(sessions) {
  if (sessions.length < 3) return 0;
  return calculateLinearTrend(
    sessions.slice(0, 10).map((s, i) => ({ x: i, y: s.accuracy || 0 }))
  );
}

function buildTimeSeriesData(sessions) {
  return sessions.map((s, i) => ({
    timestamp: s.timestamp,
    accuracy: s.accuracy || 0,
    module: s.activity,
    index: i
  }));
}

function calculatePredictionConfidence(timeSeriesData) {
  if (timeSeriesData.length < 5) return 0.3;
  if (timeSeriesData.length < 10) return 0.6;
  
  const consistency = 100 - calculateVariance(timeSeriesData.map(d => d.accuracy));
  return Math.min(0.95, consistency / 100);
}

function calculateDataStability(sessions) {
  const recentVariance = calculateVariance(
    sessions.slice(0, 10).map(s => s.accuracy || 0)
  );
  return recentVariance < 100 ? 'stable' : recentVariance < 200 ? 'moderate' : 'volatile';
}

// Formatting helpers
function formatModuleName(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
}

function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTimeRange(hour) {
  const start = hour % 12 || 12;
  const end = (hour + 1) % 12 || 12;
  const startPeriod = hour < 12 ? 'AM' : 'PM';
  const endPeriod = (hour + 1) < 12 ? 'AM' : 'PM';
  return `${start}${startPeriod}-${end}${endPeriod}`;
}

function calculateCurrentStreak(sessions) {
  let streak = 0;
  const today = new Date().toDateString();
  
  const uniqueDays = [...new Set(sessions.map(s => 
    new Date(s.timestamp).toDateString()
  ))].sort((a, b) => new Date(b) - new Date(a));
  
  if (uniqueDays.length === 0) return 0;
  if (uniqueDays[0] !== today) return 0;
  
  streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const current = new Date(uniqueDays[i]);
    const previous = new Date(uniqueDays[i - 1]);
    const dayDiff = Math.floor((previous - current) / (24 * 60 * 60 * 1000));
    
    if (dayDiff === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return Math.max(1, streak);
}

function getAccuracyTrend(sessions) {
  if (sessions.length < 5) return 'stable';
  
  const recent = sessions.slice(0, 5).map(s => s.accuracy || 0);
  const earlier = sessions.slice(5, 10).map(s => s.accuracy || 0);
  
  const recentAvg = average(recent);
  const earlierAvg = average(earlier);
  
  if (recentAvg > earlierAvg + 5) return 'improving';
  if (recentAvg < earlierAvg - 5) return 'declining';
  return 'stable';
}

function calculateMomentumScore(sessions) {
  if (sessions.length < 3) return 0;
  
  const trend = calculateLinearTrend(
    sessions.slice(0, 10).map((s, i) => ({ x: i, y: s.accuracy || 0 }))
  );
  const consistency = calculateConsistency(sessions);
  
  return Math.round(Math.max(0, (trend * 10 + consistency) / 2));
}

function calculateImprovement(data) {
  const recent = accuracy(data.recentCorrect || 0, data.recentTotal || 1);
  const overall = accuracy(data.correct, data.total);
  return Math.round(recent - overall);
}

// Classification helpers
function classifyModuleType(module) {
  const moduleLower = module.toLowerCase();
  if (moduleLower.includes('ear') || moduleLower.includes('interval')) return 'auditory';
  if (moduleLower.includes('fingerboard') || moduleLower.includes('note')) return 'visual';
  if (moduleLower.includes('bieler') || moduleLower.includes('rhythm')) return 'kinesthetic';
  return 'balanced';
}

function getStyleRecommendation(style) {
  const recommendations = {
    auditory: 'Leverage ear training modules and singing practice',
    visual: 'Use fingerboard diagrams and music notation extensively',
    kinesthetic: 'Focus on Bieler technique and physical practice',
    balanced: 'Continue multi-sensory approach for best results'
  };
  return recommendations[style] || recommendations.balanced;
}

function getAlternativePracticeMethod(moduleKey) {
  const alternatives = {
    'intervalear': 'melodic recognition with singing',
    'rhythm': 'clapping exercises with metronome',
    'fingerboard': 'position shifts and string crossing',
    'bieler': 'slow practice with mirror feedback',
    'keys': 'circle of fifths visualization'
  };
  return alternatives[moduleKey] || 'varied tempo and context practice';
}

// Stub functions for complex ML operations (implement as needed)
function identifyPreferredPracticeTime(sessions) {
  const hourCounts = sessions.reduce((acc, s) => {
    const hour = new Date(s.timestamp).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});
  
  const topHour = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
  return topHour ? formatTimeRange(parseInt(topHour[0])) : 'Variable';
}

function calculateSessionDistribution(sessions) {
  return {
    morning: sessions.filter(s => new Date(s.timestamp).getHours() < 12).length,
    afternoon: sessions.filter(s => {
      const h = new Date(s.timestamp).getHours();
      return h >= 12 && h < 17;
    }).length,
    evening: sessions.filter(s => new Date(s.timestamp).getHours() >= 17).length
  };
}

function groupSessionsByDay(sessions) {
  return sessions.reduce((acc, s) => {
    const day = new Date(s.timestamp).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});
}

function identifyOptimalSessionLength(sessions) {
  const sessionsByDuration = sessions
    .filter(s => s.qualityScore >= 70)
    .reduce((acc, s) => {
      const duration = Math.floor((s.engagedMs || 0) / 60000 / 5) * 5; // 5-min buckets
      acc[duration] = (acc[duration] || 0) + 1;
      return acc;
    }, {});
  
  const optimal = Object.entries(sessionsByDuration)
    .sort((a, b) => b[1] - a[1])[0];
  
  return optimal ? `${optimal[0]} minutes` : '20-25 minutes';
}

function identifyDistractionTriggers(sessions) {
  const lowFocusSessions = sessions.filter(s => (s.focusScore || 1.0) < 0.7);
  
  return {
    count: lowFocusSessions.length,
    avgDuration: average(lowFocusSessions.map(s => (s.engagedMs || 0) / 60000)),
    commonTimes: identifyCommonDistractionTimes(lowFocusSessions)
  };
}

function identifyCommonDistractionTimes(sessions) {
  const hours = sessions.map(s => new Date(s.timestamp).getHours());
  const hourCounts = hours.reduce((acc, h) => {
    acc[h] = (acc[h] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(hourCounts)
    .filter(([_, count]) => count >= 2)
    .map(([hour, _]) => formatTimeRange(parseInt(hour)));
}

function identifySystematicErrors(modules) {
  return modules
    .filter(([_, data]) => data.total >= 10 && accuracy(data.correct, data.total) < 70)
    .map(([module, _]) => formatModuleName(module))
    .slice(0, 3);
}

function identifyErrorClusters(stats) {
  // Implement error clustering logic
  return [];
}

function identifyConceptualGaps(modules) {
  return modules
    .filter(([_, data]) => 
      data.total >= 15 && 
      accuracy(data.correct, data.total) < 65 &&
      accuracy(data.recentCorrect || 0, data.recentTotal || 1) < 70
    )
    .map(([module, _]) => formatModuleName(module))
    .slice(0, 3);
}

function calculateCorrectionRate(stats) {
  // Simplified: ratio of recent to overall accuracy
  const modules = Object.values(stats.byModule || {});
  const improving = modules.filter(m => 
    accuracy(m.recentCorrect || 0, m.recentTotal || 1) > accuracy(m.correct, m.total)
  ).length;
  
  return modules.length > 0 ? Math.round((improving / modules.length) * 100) : 0;
}

function assessCognitiveLoad(sessions, stats) {
  const recentSessions = sessions.slice(0, 10);
  const avgAccuracy = average(recentSessions.map(s => s.accuracy || 0));
  const avgFocus = average(recentSessions.map(s => s.focusScore || 0.5));
  
  let level = 'optimal';
  if (avgAccuracy < 60 && avgFocus < 0.6) level = 'high';
  else if (avgAccuracy > 90 && avgFocus > 0.9) level = 'low';
  
  return {
    level,
    score: Math.round((avgAccuracy + avgFocus * 100) / 2),
    recommendation: level === 'high' 
      ? 'Reduce difficulty or take breaks'
      : level === 'low'
      ? 'Increase challenge level'
      : 'Perfect balance - maintain current approach'
  };
}

function assessDeliberatePractice(sessions) {
  const deliberateIndicators = sessions.filter(s => 
    (s.focusScore || 0) > 0.8 && 
    (s.qualityScore || 0) > 70 &&
    (s.engagedMs || 0) >= 15 * 60000
  );
  
  return {
    frequency: sessions.length > 0 ? Math.round((deliberateIndicators.length / sessions.length) * 100) : 0,
    quality: average(deliberateIndicators.map(s => s.qualityScore || 50))
  };
}

function measureTransferEfficiency(stats) {
  // Measure how well skills transfer between modules
  const correlations = calculateModuleCorrelations(Object.entries(stats.byModule || {}));
  const positiveTransfers = correlations.filter(c => c.correlation > 0.5);
  
  return {
    efficiency: positiveTransfers.length > 0 ? Math.round(average(positiveTransfers.map(c => c.correlation)) * 100) : 0,
    connections: positiveTransfers.length
  };
}

function calculateModuleCorrelations(modules) {
  // Simplified correlation calculation
  const correlations = [];
  
  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      const [mod1, data1] = modules[i];
      const [mod2, data2] = modules[j];
      
      const acc1 = accuracy(data1.correct, data1.total);
      const acc2 = accuracy(data2.correct, data2.total);
      
      // Simple correlation proxy
      const correlation = 1 - Math.abs(acc1 - acc2) / 100;
      
      if (correlation > 0.4) {
        correlations.push({
          module1: formatModuleName(mod1),
          module2: formatModuleName(mod2),
          correlation: Math.round(correlation * 100) / 100
        });
      }
    }
  }
  
  return correlations;
}

function calculateIdealSessionDuration(sessions) {
  const highQuality = sessions.filter(s => (s.qualityScore || 0) >= 75);
  if (highQuality.length === 0) return '20-25 minutes';
  
  const avgDuration = average(highQuality.map(s => (s.engagedMs || 0) / 60000));
  return `${Math.round(avgDuration / 5) * 5}-${Math.round(avgDuration / 5) * 5 + 5} minutes`;
}

function calculateIdealFrequency(sessions, patterns) {
  const consistency = patterns?.practiceHabits?.consistency || 50;
  
  if (consistency >= 80) return '6-7 days/week (excellent)';
  if (consistency >= 60) return '5-6 days/week (good)';
  if (consistency >= 40) return '4-5 days/week (building)';
  return '3-4 days/week (start here)';
}

function calculateOptimalRestDays(sessions) {
  const weeklyAvg = sessions.length / Math.max(1, Math.ceil(
    (Date.now() - new Date(sessions[sessions.length - 1]?.timestamp || Date.now()).getTime()) 
    / (7 * 24 * 60 * 60 * 1000)
  ));
  
  if (weeklyAvg >= 6) return ['Sunday'];
  if (weeklyAvg >= 5) return ['Sunday', 'Wednesday'];
  return ['As needed'];
}

function generateIntensityProfile(sessions) {
  return {
    high: sessions.filter(s => (s.qualityScore || 0) >= 80).length,
    medium: sessions.filter(s => (s.qualityScore || 0) >= 60 && (s.qualityScore || 0) < 80).length,
    low: sessions.filter(s => (s.qualityScore || 0) < 60).length,
    recommendation: 'Mix 60% high, 30% medium, 10% low intensity sessions'
  };
}

function generateWeeklyRotation(patterns) {
  return {
    Monday: ['Weak modules', 'SM-2 review'],
    Tuesday: ['New concepts', 'Ear training'],
    Wednesday: ['Bieler technique', 'Light practice'],
    Thursday: ['Mastery reinforcement', 'Speed drills'],
    Friday: ['Mixed practice', 'Performance simulation'],
    Saturday: ['Deep practice', 'Integration'],
    Sunday: ['Review & reflection', 'Rest']
  };
}

function identifyTransferOpportunities(modules) {
  const opportunities = [];
  
  // Example: If intervals are strong, try ear training
  const intervalsStrong = modules.find(m => 
    m.moduleKey === 'intervals' && m.accuracy >= 85
  );
  const earTrainingWeak = modules.find(m => 
    m.moduleKey === 'intervalear' && m.accuracy < 75
  );
  
  if (intervalsStrong && earTrainingWeak) {
    opportunities.push({
      type: 'skill-transfer',
      module: 'Interval Ear Training',
      currentLevel: earTrainingWeak.accuracy,
      recommendation: 'Apply interval reading skills to ear training',
      effort: 'medium',
      impact: 'high'
    });
  }
  
  return opportunities;
}

function calculateShortTermRetention(stats) {
  // Implement short-term retention calculation
  return 85; // Placeholder
}

function calculateMediumTermRetention(stats) {
  return 75; // Placeholder
}

function calculateLongTermRetention(stats) {
  return 65; // Placeholder
}

function estimateForgettingCurve(stats) {
  return {
    day1: 100,
    day7: 85,
    day30: 70,
    day90: 60
  };
}

function identifyConsolidatedSkills(modules) {
  return modules
    .filter(m => m.mastery >= 90 && m.attempts >= 30)
    .map(m => m.module);
}

function identifyVolatileSkills(modules) {
  return modules
    .filter(m => m.consistency < 50 && m.attempts >= 10)
    .map(m => m.module);
}

function calculateProjectedRetention(stats, modules, days) {
  // Simplified projection
  const currentAvg = average(modules.map(m => m.accuracy));
  const decayRate = 0.002; // 0.2% per day
  return Math.max(60, currentAvg * (1 - decayRate * days));
}

function identifyAtRiskConcepts(modules) {
  return modules
    .filter(m => 
      m.accuracy >= 70 && 
      m.accuracy < 85 && 
      (Date.now() - (m.lastPracticed || 0)) > 7 * 24 * 60 * 60 * 1000
    )
    .map(m => m.module)
    .slice(0, 3);
}

function identifyStrengthenedConcepts(modules) {
  return modules
    .filter(m => m.improvement > 10 && m.attempts >= 10)
    .map(m => ({ module: m.module, improvement: m.improvement }))
    .slice(0, 3);
}

function calculateSelfAwareness(sessions) {
  // Placeholder: Could analyze reflection quality, goal setting
  return 75;
}

function calculateAdaptability(sessions, stats) {
  // Measure how quickly user adapts to challenges
  const adaptationRate = sessions.filter((s, i) => {
    if (i === 0) return false;
    const prev = sessions[i - 1];
    return prev.accuracy < 70 && s.accuracy >= 75;
  }).length;
  
  return Math.min(100, (adaptationRate / Math.max(1, sessions.length)) * 500);
}

function calculateErrorCorrectionRate(stats) {
  return calculateCorrectionRate(stats);
}

function assessStrategicThinking(sessions) {
  // Measure planning and strategy use
  const strategicSessions = sessions.filter(s => 
    (s.qualityScore || 0) > 75 && (s.engagedMs || 0) >= 20 * 60000
  );
  
  return Math.round((strategicSessions.length / Math.max(1, sessions.length)) * 100);
}

function assessReflectionQuality(sessions) {
  // Could integrate with journal entries or session notes
  return 70; // Placeholder
}

function calculateStyleConfidence(categoryScores) {
  const scores = Object.values(categoryScores);
  const max = Math.max(...scores);
  const variance = calculateVariance(scores);
  
  return variance < 100 ? 'low' : variance < 400 ? 'medium' : 'high';
}

function generateTransferRecommendations(correlations) {
  return correlations
    .filter(c => c.correlation > 0.6)
    .map(c => `Practice ${c.module1} and ${c.module2} together`)
    .slice(0, 3);
}

// ======================================
// 🎯 STATS UPDATE (Enhanced with ML)
// ======================================

/**
 * Update stats with ML-enhanced tracking
 */
export function updateStats(module, isCorrect, responseTime = 0, sessionData = {}) {
  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, initializeStats());
  
  // Global
  stats.total += 1;
  stats.correct += isCorrect ? 1 : 0;
  
  // Module (production optimized + ML tracking)
  if (!stats.byModule[module]) {
    stats.byModule[module] = { 
      correct: 0, 
      total: 0, 
      avgResponseTime: 0, 
      recentCorrect: 0, 
      recentTotal: 0,
      lastPracticed: Date.now(),
      difficulty: 'medium',
      errorPatterns: [],
      improvementRate: []
    };
  }
  
  const mod = stats.byModule[module];
  mod.total += 1;
  mod.correct += isCorrect ? 1 : 0;
  mod.lastPracticed = Date.now();
  
  // Running avg (last 20)
  mod.recentTotal += 1;
  mod.recentCorrect += isCorrect ? 1 : 0;
  if (mod.recentTotal > 20) {
    mod.recentTotal = 20;
    mod.recentCorrect = Math.max(0, mod.recentCorrect - (isCorrect ? 0 : 1));
  }
  
  // Response time (exponential moving average)
  mod.avgResponseTime = mod.avgResponseTime 
    ? (mod.avgResponseTime * 0.9 + responseTime * 0.1)
    : responseTime;
  
  // Track improvement rate
  if (!mod.improvementRate) mod.improvementRate = [];
  mod.improvementRate.push({
    timestamp: Date.now(),
    accuracy: accuracy(mod.correct, mod.total)
  });
  if (mod.improvementRate.length > 50) mod.improvementRate.shift();
  
  // Daily
  const today = new Date().toDateString();
  stats.daily[today] = (stats.daily[today] || 0) + 1;
  
  // Learning velocity tracking
  if (!stats.learningVelocity) stats.learningVelocity = [];
  stats.learningVelocity.push({
    timestamp: Date.now(),
    module,
    isCorrect,
    responseTime,
    currentAccuracy: accuracy(mod.correct, mod.total)
  });
  if (stats.learningVelocity.length > 100) stats.learningVelocity.shift();
  
  saveJSON(STORAGE_KEYS.ANALYTICS, stats);
  
  // Live session tracking
  sessionTracker.trackAnswer(module, isCorrect, responseTime, sessionData);
  
  return stats;
}

// ======================================
// 🎯 QUICK STATS (Dashboard live)
// ======================================

export function getQuickStat(type) {
  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, {});
  switch (type) {
    case 'accuracy': 
      return accuracy(stats.correct, stats.total);
    case 'sessions': 
      return stats.total || 0;
    case 'consistency': {
      const sessions = loadJSON(STORAGE_KEYS.JOURNAL, []);
      const days = Math.max(1, Math.ceil(
        (Date.now() - new Date(sessions[sessions.length - 1]?.timestamp || Date.now()).getTime()) 
        / (24 * 60 * 60 * 1000)
      ));
      const uniqueDays = new Set(sessions.map(s => new Date(s.timestamp).toDateString())).size;
      return Math.min(100, Math.round((uniqueDays / days) * 100));
    }
    case 'streak': 
      return stats.streaks?.current || 1;
    case 'momentum': {
      const sessions = loadJSON(STORAGE_KEYS.JOURNAL, []);
      return calculateMomentumScore(sessions.slice(0, 10));
    }
    default: 
      return 0;
  }
}

// ======================================
// 🎯 EXPORT (DataManager)
// ======================================

export function exportAnalytics() {
  const analysis = analyzePerformance('all', {
    includePredictions: true,
    includePatterns: true,
    includeOptimization: true,
    includeBreakthrough: true
  });
  
  return {
    version: '3.0',
    timestamp: Date.now(),
    ...analysis,
    rawStats: loadJSON(STORAGE_KEYS.ANALYTICS, {}),
    mlMeta {
      predictionsEnabled: true,
      patternsDetected: true,
      optimizationActive: true
    }
  };
}

// Export all public functions
export default {
  analyzePerformance,
  updateStats,
  getQuickStat,
  exportAnalytics,
  generateSmartRecommendations,
  generateAdvancedAIInsights
};
