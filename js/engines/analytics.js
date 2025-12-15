// js/engines/analytics.js
// ======================================
// VMQ ANALYTICS v3.1 — drop-in replacement
//
// High-impact bug fixes implemented (per your list):
// 1) ✅ No hard ESM import for optional helpers (uses globalThis.VMQHelpers fallback)
// 2) ✅ Robust timestamp parsing everywhere (toMs())
// 3) ✅ Oldest-session logic no longer assumes sorting (minTimestampMs())
// 4) ✅ formatTimeRange() fixed for 11PM → 12AM boundary
// 5) ✅ Recent window accuracy is correct (ring buffer recentWindow[])
// 6) ✅ Streak updates on every updateStats() (stats.streaks.current/max)
//
// Public API preserved:
// - analyzePerformance(timeframe, options)
// - updateStats(module, isCorrect, responseTime, sessionData)
// - getQuickStat(type)
// - exportAnalytics()
// - default export with same keys
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { sessionTracker } from './sessionTracker.js';
import { getStats as sm2Stats } from './spacedRepetition.js';
import { getGlobalStats as diffStats } from './difficultyAdapter.js';

// Optional helpers if your app exposes them (e.g., window.VMQHelpers)
const Helpers = (globalThis && globalThis.VMQHelpers) ? globalThis.VMQHelpers : null;

// ======================================
// ✅ Local, guaranteed helper primitives
// ======================================

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function average(arr) {
  const a = Array.isArray(arr) ? arr : [];
  if (a.length === 0) return 0;
  let sum = 0;
  for (const v of a) sum += (Number(v) || 0);
  return sum / a.length;
}

function accuracy(correct, total) {
  const c = Number(correct) || 0;
  const t = Number(total) || 0;
  return t > 0 ? Math.round((c / t) * 100) : 0;
}

const H = {
  clamp: Helpers?.clamp || clamp,
  average: Helpers?.average || average,
  accuracy: Helpers?.accuracy || accuracy
};

function safeGet(obj, path, fallback = undefined) {
  try {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeTrack(category, action, payload) {
  try {
    sessionTracker?.trackActivity?.(category, action, payload);
  } catch {
    // no-op
  }
}

// ✅ Fix #2: timestamp hardening everywhere
function toMs(ts, fallback = Date.now()) {
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : fallback;
}

// ✅ Fix #3: do not assume sessions are sorted
function minTimestampMs(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  if (!list.length) return Date.now();
  let min = Infinity;
  for (const s of list) {
    const t = toMs(s?.timestamp, NaN);
    if (Number.isFinite(t) && t < min) min = t;
  }
  return Number.isFinite(min) ? min : Date.now();
}

function dayKeyFromTs(ts) {
  const ms = toMs(ts, Date.now());
  return new Date(ms).toDateString();
}

function dayKeyToMs(dayKey) {
  // dayKey is like "Mon Dec 15 2025" (from toDateString()).
  return toMs(dayKey, NaN);
}

// ✅ Fix #4: 11PM end-period bug
function formatTimeRange(hour) {
  const h = ((Number(hour) || 0) % 24 + 24) % 24;
  const start = h % 12 || 12;

  const endH = (h + 1) % 24;
  const end = endH % 12 || 12;

  const startPeriod = h < 12 ? 'AM' : 'PM';
  const endPeriod = endH < 12 ? 'AM' : 'PM';

  return `${start}${startPeriod}-${end}${endPeriod}`;
}

function formatModuleName(name) {
  return String(name)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatDuration(ms) {
  const t = Number(ms) || 0;
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ======================================
// 🎯 ADVANCED PERFORMANCE ANALYSIS (Public API)
// ======================================

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

  const cutoff = getTimeCutoff(timeframe);

  // ✅ Fix #2: invalid timestamps no longer drop sessions (fallback to now)
  const filteredSessions = (Array.isArray(sessions) ? sessions : []).filter(s => {
    const ts = toMs(s?.timestamp, now);
    return (now - ts) < cutoff;
  });

  const overall = calculateOverallStats(stats, filteredSessions);
  const modules = calculateModuleStats(stats, filteredSessions);
  const trends = calculateTrends(filteredSessions);

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

    modules: modules.slice(0, 12),
    strengths: identifyStrengths(modules),
    weaknesses: identifyWeaknesses(modules),
    masteryZones: identifyMasteryZones(modules),
    growthOpportunities: identifyGrowthOpportunities(modules, patterns),

    trends,
    patterns,

    predictions,
    optimization,
    breakthroughs,

    sm2Integration: integrateSM2Data(),
    difficultyAnalysis: integrateDifficultyData(),
    sessionQuality: analyzeSessionQuality(filteredSessions),

    recommendations: generateSmartRecommendations(
      overall, modules, trends, patterns, predictions
    ),
    aiInsights: generateAdvancedAIInsights(
      overall, modules, patterns, predictions, breakthroughs
    ),

    retentionMetrics: calculateRetentionMetrics(stats, modules),
    transferLearning: detectTransferLearning(modules),
    metacognition: assessMetacognitiveSkills(filteredSessions, stats)
  };
}

// ======================================
// 🧠 MACHINE LEARNING PREDICTIONS
// ======================================

function generatePredictions(stats, sessions, modules) {
  if (!Array.isArray(sessions) || sessions.length < 5) return null;

  // ✅ Fix #2/#3: sort with toMs; don't assume valid timestamps
  const sorted = [...sessions].sort((a, b) => toMs(a?.timestamp, 0) - toMs(b?.timestamp, 0));
  const recentSessions = sorted.slice(-20);
  const timeSeriesData = buildTimeSeriesData(recentSessions);

  return {
    nextWeekAccuracy: predictNextWeekAccuracy(timeSeriesData),
    breakthroughModules: predictBreakthroughModules(modules, timeSeriesData),
    plateauRisk: assessPlateauRisk(timeSeriesData, modules),
    optimalPracticeTime: predictOptimalPracticeTime(recentSessions),
    masteryTimeline: estimateMasteryTimeline(modules),
    retentionForecast: forecastRetention(stats, modules),

    confidence: {
      accuracy: calculatePredictionConfidence(timeSeriesData),
      stability: assessDataStability(sorted)
    }
  };
}

function predictNextWeekAccuracy(timeSeriesData) {
  if (!Array.isArray(timeSeriesData) || timeSeriesData.length < 3) return null;

  const n = timeSeriesData.length;
  const weights = timeSeriesData.map((_, i) => Math.exp(-0.15 * (n - 1 - i)));
  const wSum = weights.reduce((s, w) => s + w, 0);

  const wAvg = timeSeriesData.reduce((sum, p, i) => {
    return sum + ((p.accuracy || 0) * weights[i]) / wSum;
  }, 0);

  const trend = calculateLinearTrend(timeSeriesData.map((p, i) => ({ x: i, y: p.accuracy || 0 })));
  const predicted = H.clamp(wAvg + (trend * 7), 0, 100);

  const current = timeSeriesData[n - 1]?.accuracy ?? 0;

  return {
    predicted: Math.round(predicted),
    current: Math.round(current),
    trend: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
    trendStrength: Math.abs(trend),
    confidence: calculatePredictionConfidence(timeSeriesData)
  };
}

function predictBreakthroughModules(modules, timeSeriesData) {
  const list = Array.isArray(modules) ? modules : [];
  return list
    .filter(m => (m.attempts || 0) >= 10 && (m.accuracy || 0) >= 65 && (m.accuracy || 0) < 90)
    .map(m => {
      const recentTrend = Number(m.trend) || 0;
      const consistency = Number(m.consistency) || 50;
      const momentum = calculateMomentum(m.moduleKey || '', timeSeriesData);

      const score = (recentTrend * 0.4) + (consistency * 0.3) + (momentum * 0.3);
      const bounded = Math.min(100, Math.max(0, score));

      return {
        module: m.module,
        moduleKey: m.moduleKey,
        currentAccuracy: m.accuracy,
        breakthroughLikelihood: Math.round(bounded),
        estimatedDays: Math.max(3, Math.round(30 * (1 - bounded / 100))),
        confidence: consistency > 60 ? 'high' : consistency > 40 ? 'medium' : 'low'
      };
    })
    .filter(m => m.breakthroughLikelihood >= 50)
    .sort((a, b) => b.breakthroughLikelihood - a.breakthroughLikelihood)
    .slice(0, 3);
}

function assessPlateauRisk(timeSeriesData, modules) {
  if (!Array.isArray(timeSeriesData) || timeSeriesData.length < 10) return null;

  const recent = timeSeriesData.slice(-10);
  const variance = calculateVariance(recent.map(d => d.accuracy || 0));
  const trend = calculateLinearTrend(recent.map((d, i) => ({ x: i, y: d.accuracy || 0 })));

  const lowVariance = variance < 25;
  const flatTrend = Math.abs(trend) < 1;
  const highAccuracyStuck = (recent[recent.length - 1]?.accuracy || 0) > 75 && flatTrend;

  const plateauScore =
    (lowVariance ? 40 : 0) +
    (flatTrend ? 40 : 0) +
    (highAccuracyStuck ? 20 : 0);

  const stagnantModules = (Array.isArray(modules) ? modules : []).filter(m =>
    (m.attempts || 0) >= 15 && Math.abs(Number(m.trend) || 0) < 2
  ).length;

  return {
    risk: plateauScore >= 60 ? 'high' : plateauScore >= 40 ? 'medium' : 'low',
    score: plateauScore,
    indicators: { lowVariance, flatTrend, stagnantModules },
    recommendation: plateauScore >= 60
      ? 'Increase practice variety and introduce new challenges'
      : 'Maintain current practice routine'
  };
}

function predictOptimalPracticeTime(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 5) return null;

  const byHour = sessions.reduce((acc, s) => {
    const ts = toMs(s?.timestamp, Date.now());
    const hour = new Date(ts).getHours();
    if (!acc[hour]) acc[hour] = { sum: 0, count: 0 };
    acc[hour].sum += Number(s.accuracy) || 0;
    acc[hour].count += 1;
    return acc;
  }, {});

  const sorted = Object.entries(byHour)
    .map(([h, d]) => [h, { avg: d.count ? d.sum / d.count : 0, count: d.count }])
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 3);

  return {
    peakHours: sorted.map(([hour, data]) => ({
      hour: parseInt(hour, 10),
      timeRange: formatTimeRange(parseInt(hour, 10)),
      avgAccuracy: Math.round(data.avg),
      sessions: data.count
    })),
    recommendation: sorted[0]
      ? `Best practice time: ${formatTimeRange(parseInt(sorted[0][0], 10))}`
      : null
  };
}

function estimateMasteryTimeline(modules) {
  const list = Array.isArray(modules) ? modules : [];
  return list
    .filter(m => (m.accuracy || 0) < 95 && (m.attempts || 0) >= 5)
    .map(m => {
      const gap = 95 - (m.accuracy || 0);
      const trend = Number(m.trend) || 0;
      const avgImprovement = Math.max(0.5, trend, 1);

      const sessionsNeeded = Math.ceil(gap / avgImprovement);
      const daysNeeded = Math.ceil(sessionsNeeded / 3);

      return {
        module: m.module,
        currentAccuracy: m.accuracy,
        toMastery: gap,
        estimatedSessions: sessionsNeeded,
        estimatedDays: Math.min(180, daysNeeded),
        confidence: (m.attempts || 0) >= 20 && (m.consistency || 0) >= 60 ? 'high' : 'medium'
      };
    })
    .sort((a, b) => a.estimatedDays - b.estimatedDays)
    .slice(0, 5);
}

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

function calculatePredictionConfidence(timeSeriesData) {
  if (!Array.isArray(timeSeriesData) || timeSeriesData.length < 5) return 0.3;
  if (timeSeriesData.length < 10) return 0.6;

  const consistency = 100 - calculateVariance(timeSeriesData.map(d => d.accuracy || 0));
  return Math.min(0.95, Math.max(0.1, consistency / 100));
}

function assessDataStability(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const recent = list.slice(-10);
  const v = calculateVariance(recent.map(s => Number(s.accuracy) || 0));
  return v < 100 ? 'stable' : v < 200 ? 'moderate' : 'volatile';
}

// ======================================
// 🎨 LEARNING PATTERNS DETECTION
// ======================================

function detectLearningPatterns(sessions, stats) {
  if (!Array.isArray(sessions) || sessions.length < 5) return null;

  const sorted = [...sessions].sort((a, b) => toMs(a?.timestamp, 0) - toMs(b?.timestamp, 0));
  const recent = sorted.slice(-30);

  return {
    learningStyle: identifyLearningStyle(stats),
    practiceHabits: analyzePracticeHabits(recent),
    focusPatterns: analyzeFocusPatterns(recent),
    errorPatterns: analyzeErrorPatterns(stats),
    recoveryRate: calculateRecoveryRate(recent),
    cognitiveLoad: assessCognitiveLoad(recent, stats),
    deliberatePractice: assessDeliberatePractice(recent),
    transferEfficiency: measureTransferEfficiency(stats)
  };
}

function identifyLearningStyle(stats) {
  const byModule = stats?.byModule || {};
  const modulePrefs = Object.entries(byModule)
    .filter(([_, data]) => (data?.total || 0) >= 10)
    .map(([module, data]) => ({
      module,
      score: H.accuracy(data.correct, data.total),
      category: classifyModuleType(module)
    }));

  // (Optional “better math” without breaking shape): average per category instead of sum.
  const categoryBuckets = modulePrefs.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m.score);
    return acc;
  }, {});

  const categoryScores = Object.fromEntries(
    Object.entries(categoryBuckets).map(([k, arr]) => [k, Math.round(H.average(arr))])
  );

  const dominantStyle = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';

  return {
    primary: dominantStyle,
    scores: categoryScores,
    confidence: calculateStyleConfidence(categoryScores),
    recommendation: getStyleRecommendation(dominantStyle)
  };
}

function analyzePracticeHabits(sessions) {
  const daily = groupSessionsByDay(sessions);
  const daysActive = Object.keys(daily).length;

  // ✅ Fix #3: do not assume sessions[0] is oldest
  const oldestMs = minTimestampMs(sessions);
  const totalDays = Math.ceil((Date.now() - oldestMs) / DAY_MS);

  return {
    consistency: Math.round((daysActive / Math.max(1, totalDays)) * 100),
    avgSessionsPerDay: Math.round((sessions.length / Math.max(1, daysActive)) * 10) / 10,
    avgDuration: (H.average(sessions.map(s => s.engagedMs || 0)) / 60000),
    preferredTime: identifyPreferredPracticeTime(sessions),
    sessionDistribution: calculateSessionDistribution(sessions)
  };
}

function analyzeFocusPatterns(sessions) {
  return {
    avgFocusScore: H.average(sessions.map(s => s.focusScore || 50)),
    focusTrend: calculateLinearTrend(sessions.map((s, i) => ({ x: i, y: s.focusScore || 50 }))),
    bestFocusDuration: identifyOptimalSessionLength(sessions),
    distractionTriggers: identifyDistractionTriggers(sessions)
  };
}

function analyzeErrorPatterns(stats) {
  const modules = Object.entries(stats?.byModule || {});
  return {
    systematicErrors: identifySystematicErrors(modules),
    errorClusters: identifyErrorClusters(stats),
    conceptualGaps: identifyConceptualGaps(modules),
    correctionRate: calculateCorrectionRate(stats)
  };
}

function calculateRecoveryRate(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const recoveries = list.filter((s, i) => {
    if (i === 0) return false;
    const prev = list[i - 1];
    return (prev?.accuracy || 0) < 70 && (s?.accuracy || 0) >= 80;
  });

  return {
    rate: list.length > 1 ? Math.round((recoveries.length / list.length) * 100) : 0,
    avgRecoveryTime: (H.average(recoveries.map(s => s.engagedMs || 0)) / 60000),
    resilience: recoveries.length >= 3 ? 'high' : recoveries.length >= 1 ? 'medium' : 'developing'
  };
}

// ======================================
// ⚡ OPTIMIZATION ENGINE
// ======================================

function calculateOptimalPracticeSchedule(sessions, patterns) {
  if (!patterns || !Array.isArray(sessions) || sessions.length < 10) return null;

  return {
    idealDuration: calculateIdealSessionDuration(sessions),
    frequencyRecommendation: calculateIdealFrequency(sessions, patterns),
    timeOfDay: patterns.practiceHabits?.preferredTime,
    moduleRotation: generateModuleRotation(patterns),
    restDays: calculateOptimalRestDays(sessions),
    intensityProfile: generateIntensityProfile(sessions)
  };
}

function generateModuleRotation(patterns) {
  integrateSM2Data();
  integrateDifficultyData();

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

function detectBreakthroughOpportunities(modules, patterns, overall) {
  const list = Array.isArray(modules) ? modules : [];
  const opportunities = [];

  list
    .filter(m => (m.accuracy || 0) >= 85 && (m.accuracy || 0) < 95 && (m.consistency || 0) >= 60)
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

  list
    .filter(m => (m.accuracy || 0) >= 70 && (m.accuracy || 0) < 80 && (m.attempts || 0) >= 20 && Math.abs(Number(m.trend) || 0) < 1)
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

  opportunities.push(...identifyTransferOpportunities(list));

  return opportunities
    .sort((a, b) => {
      const impact = { high: 3, medium: 2, low: 1 };
      const effort = { low: 3, medium: 2, high: 1 };
      return (impact[b.impact] * effort[b.effort]) - (impact[a.impact] * effort[a.effort]);
    })
    .slice(0, 5);
}

// ======================================
// 🔄 CROSS-ENGINE INTEGRATION (Async-safe)
// ======================================

function integrateSM2Data() {
  try {
    const maybe = sm2Stats?.();
    if (maybe && typeof maybe.then === 'function') return null;

    const sm2 = maybe;
    return sm2 ? {
      dueToday: sm2.dueToday || 0,
      mature: sm2.mature || 0,
      retention: sm2.retention || 0,
      avgEF: sm2.avgEF || 2.5
    } : null;
  } catch {
    return null;
  }
}

function integrateDifficultyData() {
  try {
    const maybe = diffStats?.();
    if (maybe && typeof maybe.then === 'function') return null;

    const diff = maybe;
    return diff ? {
      avgDifficulty: diff.avgDifficulty || diff.avgLevel || 1.0,
      adaptationRate: diff.adaptationRate || 0,
      challengeLevel: diff.challengeLevel || 'balanced'
    } : null;
  } catch {
    return null;
  }
}

function analyzeSessionQuality(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  return {
    avgQualityScore: H.average(sessions.map(s => s.qualityScore || 50)),
    avgFocusScore: H.average(sessions.map(s => s.focusScore || 1.0)) * 100,
    avgConsistencyScore: H.average(sessions.map(s => s.consistencyScore || 50)),
    highQualitySessions: sessions.filter(s => (s.qualityScore || 0) >= 80).length,
    qualityTrend: calculateLinearTrend(
      sessions.slice(-20).map((s, i) => ({ x: i, y: s.qualityScore || 50 }))
    )
  };
}

// ======================================
// 🎓 RETENTION & MASTERY METRICS
// ======================================

function calculateRetentionMetrics(stats, modules) {
  return {
    shortTerm: calculateShortTermRetention(stats),
    mediumTerm: calculateMediumTermRetention(stats),
    longTerm: calculateLongTermRetention(stats),
    forgettingCurve: estimateForgettingCurve(stats),
    consolidatedSkills: identifyConsolidatedSkills(modules),
    volatileSkills: identifyVolatileSkills(modules)
  };
}

function detectTransferLearning(modules) {
  const correlations = calculateModuleCorrelationsFromModules(modules);
  return {
    positiveTransfer: correlations.filter(c => c.correlation > 0.6),
    negativeTransfer: correlations.filter(c => c.correlation < -0.3),
    recommendations: generateTransferRecommendations(correlations)
  };
}

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
// 🎯 ENHANCED RECOMMENDATIONS (Public)
// ======================================

export function generateSmartRecommendations(overall, modules, trends, patterns, predictions) {
  const recs = [];

  const criticalWeaknesses = identifyWeaknesses(modules)
    .filter(m => (m.accuracy || 0) < 70 && (m.attempts || 0) >= 10);

  criticalWeaknesses.slice(0, 2).forEach(module => {
    recs.push({
      priority: 'urgent',
      type: 'focus',
      icon: '🎯',
      title: `${module.module} Critical`,
      message: `${module.accuracy}% accuracy (${module.attempts} attempts)`,
      action: `#${module.moduleKey}`,
      reasoning: 'Low accuracy with high attempts suggests systematic errors',
      estimatedTime: 20,
      difficulty: 'medium',
      mlConfidence: 0.9
    });
  });

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

  if (predictions?.breakthroughModules?.length > 0) {
    const top = predictions.breakthroughModules[0];
    recs.push({
      priority: 'high',
      type: 'breakthrough',
      icon: '🚀',
      title: `${top.module} Ready to Break Through`,
      message: `${top.breakthroughLikelihood}% breakthrough probability`,
      action: `#${top.moduleKey}`,
      reasoning: `Momentum detected. Push to ${Math.min(99, (top.currentAccuracy || 0) + 10)}% in ~${top.estimatedDays} days`,
      estimatedTime: 15,
      difficulty: 'medium',
      mlConfidence: (top.breakthroughLikelihood || 50) / 100
    });
  }

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

  if (predictions?.optimalPracticeTime?.peakHours?.[0]) {
    const peak = predictions.optimalPracticeTime.peakHours[0];
    recs.push({
      priority: 'medium',
      type: 'optimization',
      icon: '⏰',
      title: 'Practice at Peak Performance Time',
      message: `Best results at ${peak.timeRange} (${peak.avgAccuracy}% avg)`,
      action: '#planner',
      reasoning: 'Pattern analysis shows peak performance windows',
      estimatedTime: 30,
      difficulty: 'easy',
      mlConfidence: 0.8
    });
  }

  if ((overall?.consistencyScore || 0) < 60) {
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

  const priorityMap = { urgent: 4, high: 3, medium: 2, low: 1 };
  return recs
    .sort((a, b) => (priorityMap[b.priority] * (b.mlConfidence || 0.5)) - (priorityMap[a.priority] * (a.mlConfidence || 0.5)))
    .slice(0, 6);
}

export function generateAdvancedAIInsights(overall, modules, patterns, predictions, breakthroughs) {
  const insights = [];

  if ((overall?.overallAccuracy || 0) >= 90) {
    insights.push({
      type: 'mastery',
      icon: '🎉',
      message: `Outstanding ${overall.overallAccuracy}% mastery!`,
      detail: "You're operating at a high mastery level—keep raising difficulty gradually.",
      nextModule: 'bielerlab',
      mlScore: 0.95
    });
  }

  if (patterns?.cognitiveLoad) {
    const load = patterns.cognitiveLoad;
    insights.push({
      type: 'cognitive',
      icon: '🧠',
      message: `Cognitive load: ${load.level}`,
      detail: load.recommendation,
      mlScore: 0.88
    });
  }

  if (predictions?.breakthroughModules?.length > 0) {
    const top = predictions.breakthroughModules[0];
    insights.push({
      type: 'prediction',
      icon: '🔮',
      message: `${top.module} breakthrough in ~${top.estimatedDays} days`,
      detail: `${top.breakthroughLikelihood}% probability at current pace`,
      module: top.module,
      mlScore: (top.breakthroughLikelihood || 50) / 100
    });
  }

  if (predictions?.retentionForecast) {
    const r = predictions.retentionForecast;
    insights.push({
      type: 'retention',
      icon: '💪',
      message: `${Math.round(r.currentRetention || 0)}% retention rate`,
      detail: (r.currentRetention || 0) >= 85
        ? 'Excellent long-term memory—keep reviewing due items.'
        : 'Review due items more consistently to strengthen retention.',
      mlScore: 0.82
    });
  }

  const topModule = (Array.isArray(modules) ? modules : [])[0];
  if (topModule && (topModule.accuracy || 0) >= 95) {
    insights.push({
      type: 'strength',
      icon: '⭐',
      message: `${topModule.module} → Expert level`,
      detail: 'This skill likely transfers to related modules—pair practice strategically.',
      module: topModule.module,
      mlScore: 0.9
    });
  }

  return insights
    .sort((a, b) => (b.mlScore || 0) - (a.mlScore || 0))
    .slice(0, 5);
}

// ======================================
// 🔧 INTERNAL: Stats structure + transforms
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
    confusionMatrix: {},
    learningVelocity: [],
    retentionHistory: []
  };
}

function getTimeCutoff(timeframe) {
  const map = {
    week: 7 * DAY_MS,
    month: 30 * DAY_MS,
    quarter: 90 * DAY_MS,
    year: 365 * DAY_MS,
    all: Infinity
  };
  return map[timeframe] ?? map.week;
}

function calculateOverallStats(stats, sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const totalTime = list.reduce((sum, s) => sum + (s.engagedMs || 0), 0);

  // ✅ Fix #2: robust day extraction
  const uniqueDays = new Set(list.map(s => dayKeyFromTs(s?.timestamp))).size;

  // ✅ Fix #3: do not assume ordering
  const oldestMs = minTimestampMs(list);
  const daysSpan = Math.max(1, Math.ceil((Date.now() - oldestMs) / DAY_MS));
  const consistency = Math.round((uniqueDays / daysSpan) * 100);

  return {
    overallAccuracy: H.accuracy(stats.correct, stats.total),
    totalPracticeTime: formatDuration(totalTime),
    totalSessions: list.length,
    consistencyScore: Math.min(100, consistency),
    avgSessionTime: formatDuration(totalTime / Math.max(1, list.length)),
    currentStreak: calculateCurrentStreak(list),
    avgAccuracy: H.average(list.map(s => s.accuracy || 0)),
    totalQuestions: stats.total || 0,
    xpGained: list.reduce((sum, s) => sum + (s.xpEarned || 0), 0)
  };
}

function calculateModuleStats(stats, sessions) {
  const byModule = stats?.byModule || {};
  const list = Array.isArray(sessions) ? sessions : [];

  return Object.entries(byModule).map(([module, data]) => {
    const moduleKey = String(module).toLowerCase().replace(/\s+/g, '');
    const moduleSessions = list.filter(s =>
      String(s.activity || '').toLowerCase().includes(moduleKey)
    );

    const acc = H.accuracy(data.correct, data.total);
    const recentAcc = H.accuracy(data.recentCorrect || 0, data.recentTotal || 1);

    return {
      module: formatModuleName(module),
      moduleKey,
      accuracy: acc,
      attempts: data.total || 0,
      avgResponseTime: data.avgResponseTime || 0,
      recentAccuracy: recentAcc,
      improvement: calculateImprovement(data),
      trend: calculateModuleTrend(moduleSessions),
      consistency: calculateConsistency(moduleSessions),
      lastPracticed: data.lastPracticed || 0,
      difficulty: data.difficulty || 'medium',
      mastery: calculateMastery(acc, data.total || 0, recentAcc)
    };
  }).sort((a, b) => b.mastery - a.mastery);
}

function calculateTrends(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const cutoff = Date.now() - (7 * DAY_MS);

  // ✅ Fix #2: robust filtering
  const last7 = list.filter(s => toMs(s?.timestamp, 0) >= cutoff);

  return {
    currentStreak: calculateCurrentStreak(last7),
    sessionsPerDay: last7.length > 0 ? Math.round((last7.length / 7) * 10) / 10 : 0,
    accuracyTrend: getAccuracyTrend(last7),
    practiceTrend: last7.length >= 5 ? 'consistent' : 'building',
    momentumScore: calculateMomentumScore(last7.slice(-10))
  };
}

// Strength / weakness helpers
function identifyStrengths(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(m => (m.accuracy || 0) >= 85 && (m.attempts || 0) >= 10 && (m.consistency || 0) >= 60)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 3);
}

function identifyWeaknesses(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(m => (m.accuracy || 0) < 75 && (m.attempts || 0) >= 5)
    .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))
    .slice(0, 3);
}

function identifyMasteryZones(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(m => (m.mastery || 0) >= 90 && (m.attempts || 0) >= 20);
}

function identifyGrowthOpportunities(modules, patterns) {
  return (Array.isArray(modules) ? modules : [])
    .filter(m =>
      (m.accuracy || 0) >= 75 &&
      (m.accuracy || 0) < 90 &&
      (m.consistency || 0) >= 50 &&
      (Number(m.trend) || 0) > 0
    )
    .sort((a, b) =>
      ((Number(b.trend) || 0) * (b.consistency || 0)) - ((Number(a.trend) || 0) * (a.consistency || 0))
    )
    .slice(0, 5);
}

// Stats math
function calculateLinearTrend(data) {
  if (!Array.isArray(data) || data.length < 2) return 0;

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (const d of data) {
    const x = Number(d.x) || 0;
    const y = Number(d.y) || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = (n * sumX2 - sumX * sumX);
  if (!denom) return 0;

  const slope = (n * sumXY - sumX * sumY) / denom;
  return Number.isFinite(slope) ? slope : 0;
}

function calculateVariance(arr) {
  const a = Array.isArray(arr) ? arr : [];
  if (a.length === 0) return 0;
  const mean = average(a);
  const sq = a.map(x => Math.pow((Number(x) || 0) - mean, 2));
  return average(sq);
}

function calculateMomentum(moduleKey, timeSeriesData) {
  const key = String(moduleKey || '').toLowerCase();
  const list = Array.isArray(timeSeriesData) ? timeSeriesData : [];
  const moduleData = list.filter(d => String(d.module || '').toLowerCase().includes(key));

  if (moduleData.length < 3) return 0;

  const trend = calculateLinearTrend(moduleData.map((d, i) => ({ x: i, y: d.accuracy || 0 })));
  const consistency = 100 - calculateVariance(moduleData.map(d => d.accuracy || 0));
  return Math.max(0, (trend * consistency) / 100);
}

function calculateMastery(acc, attempts, recentAcc) {
  const accuracyScore = acc;
  const volumeScore = Math.min(100, (attempts / 50) * 100);
  const consistencyScore = recentAcc >= (acc - 5) ? 100 : 50;
  return Math.round(accuracyScore * 0.5 + volumeScore * 0.25 + consistencyScore * 0.25);
}

function calculateConsistency(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 3) return 50;
  const accs = sessions.map(s => Number(s.accuracy) || 0);
  const v = calculateVariance(accs);
  return Math.max(0, Math.min(100, 100 - v));
}

function calculateModuleTrend(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 3) return 0;
  const recent = sessions.slice(-10);
  return calculateLinearTrend(recent.map((s, i) => ({ x: i, y: Number(s.accuracy) || 0 })));
}

function buildTimeSeriesData(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  return list.map((s, i) => ({
    timestamp: s?.timestamp,
    accuracy: Number(s?.accuracy) || 0,
    module: s?.activity || '',
    index: i
  }));
}

function calculateMomentumScore(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 3) return 0;
  const trend = calculateLinearTrend(sessions.map((s, i) => ({ x: i, y: Number(s.accuracy) || 0 })));
  const consistency = calculateConsistency(sessions);
  return Math.round(Math.max(0, (trend * 10 + consistency) / 2));
}

// Streak / trend helpers
function calculateCurrentStreak(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const todayKey = new Date().toDateString();

  const uniqueDays = [...new Set(list.map(s => dayKeyFromTs(s?.timestamp)))]
    .sort((a, b) => (dayKeyToMs(b) || 0) - (dayKeyToMs(a) || 0));

  if (uniqueDays.length === 0) return 0;
  if (uniqueDays[0] !== todayKey) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const cur = dayKeyToMs(uniqueDays[i]);
    const prev = dayKeyToMs(uniqueDays[i - 1]);
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) break;
    const diff = Math.floor((prev - cur) / DAY_MS);
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}

function getAccuracyTrend(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  if (list.length < 5) return 'stable';

  const recent = list.slice(-5).map(s => Number(s.accuracy) || 0);
  const earlier = list.slice(-10, -5).map(s => Number(s.accuracy) || 0);

  const rAvg = average(recent);
  const eAvg = average(earlier);

  if (rAvg > eAvg + 5) return 'improving';
  if (rAvg < eAvg - 5) return 'declining';
  return 'stable';
}

function calculateImprovement(data) {
  const recent = H.accuracy(data.recentCorrect || 0, data.recentTotal || 1);
  const overall = H.accuracy(data.correct || 0, data.total || 0);
  return Math.round(recent - overall);
}

// Categorization / recommendations
function classifyModuleType(module) {
  const m = String(module || '').toLowerCase();
  if (m.includes('ear') || m.includes('interval')) return 'auditory';
  if (m.includes('fingerboard') || m.includes('note')) return 'visual';
  if (m.includes('bieler') || m.includes('rhythm')) return 'kinesthetic';
  return 'balanced';
}

function getStyleRecommendation(style) {
  const map = {
    auditory: 'Leverage ear training modules and singing practice',
    visual: 'Use fingerboard diagrams and notation-based drills',
    kinesthetic: 'Emphasize Bieler technique and rhythm-in-motion practice',
    balanced: 'Continue a multi-sensory mix for best results'
  };
  return map[style] || map.balanced;
}

function getAlternativePracticeMethod(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  const alternatives = {
    intervalear: 'melodic recognition + singing back intervals',
    rhythm: 'clap + count with metronome subdivisions',
    fingerboard: 'position mapping drills + guided shifting',
    bieler: 'slow-motion reps + mirror feedback',
    keys: 'circle-of-fifths quick recall + tonic/dominant mapping'
  };
  return alternatives[key] || 'vary tempo, context, and spacing';
}

// Session grouping / habit analysis
function groupSessionsByDay(sessions) {
  return (Array.isArray(sessions) ? sessions : []).reduce((acc, s) => {
    const day = dayKeyFromTs(s?.timestamp);
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});
}

function identifyPreferredPracticeTime(sessions) {
  const counts = (Array.isArray(sessions) ? sessions : []).reduce((acc, s) => {
    const ts = toMs(s?.timestamp, Date.now());
    const hour = new Date(ts).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? formatTimeRange(parseInt(top[0], 10)) : 'Variable';
}

function calculateSessionDistribution(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  return {
    morning: list.filter(s => new Date(toMs(s?.timestamp, Date.now())).getHours() < 12).length,
    afternoon: list.filter(s => {
      const h = new Date(toMs(s?.timestamp, Date.now())).getHours();
      return h >= 12 && h < 17;
    }).length,
    evening: list.filter(s => new Date(toMs(s?.timestamp, Date.now())).getHours() >= 17).length
  };
}

function identifyOptimalSessionLength(sessions) {
  const buckets = (Array.isArray(sessions) ? sessions : [])
    .filter(s => (s.qualityScore || 0) >= 70)
    .reduce((acc, s) => {
      const minutes = Math.floor((s.engagedMs || 0) / 60000);
      const bucket = Math.floor(minutes / 5) * 5;
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});
  const best = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  return best ? `${best[0]} minutes` : '20-25 minutes';
}

function identifyDistractionTriggers(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const lowFocus = list.filter(s => (s.focusScore || 1.0) < 0.7);
  return {
    count: lowFocus.length,
    avgDuration: H.average(lowFocus.map(s => (s.engagedMs || 0) / 60000)),
    commonTimes: identifyCommonDistractionTimes(lowFocus)
  };
}

function identifyCommonDistractionTimes(sessions) {
  const counts = (Array.isArray(sessions) ? sessions : []).reduce((acc, s) => {
    const h = new Date(toMs(s?.timestamp, Date.now())).getHours();
    acc[h] = (acc[h] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .filter(([_, c]) => c >= 2)
    .map(([h]) => formatTimeRange(parseInt(h, 10)));
}

// Error analysis stubs (coherent + safe)
function identifySystematicErrors(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(([_, data]) => (data?.total || 0) >= 10 && H.accuracy(data.correct, data.total) < 70)
    .map(([module]) => formatModuleName(module))
    .slice(0, 3);
}

function identifyErrorClusters(stats) {
  return [];
}

function identifyConceptualGaps(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(([_, data]) =>
      (data?.total || 0) >= 15 &&
      H.accuracy(data.correct, data.total) < 65 &&
      H.accuracy(data.recentCorrect || 0, data.recentTotal || 1) < 70
    )
    .map(([module]) => formatModuleName(module))
    .slice(0, 3);
}

function calculateCorrectionRate(stats) {
  const mods = Object.values(stats?.byModule || {});
  const improving = mods.filter(m =>
    H.accuracy(m.recentCorrect || 0, m.recentTotal || 1) > H.accuracy(m.correct || 0, m.total || 0)
  ).length;
  return mods.length > 0 ? Math.round((improving / mods.length) * 100) : 0;
}

// Cognitive / deliberate practice
function assessCognitiveLoad(sessions, stats) {
  const list = Array.isArray(sessions) ? sessions : [];
  const recent = list.slice(-10);
  const avgAcc = H.average(recent.map(s => s.accuracy || 0));
  const avgFocus = H.average(recent.map(s => s.focusScore || 0.5));

  let level = 'optimal';
  if (avgAcc < 60 && avgFocus < 0.6) level = 'high';
  else if (avgAcc > 90 && avgFocus > 0.9) level = 'low';

  return {
    level,
    score: Math.round((avgAcc + avgFocus * 100) / 2),
    recommendation: level === 'high'
      ? 'Reduce difficulty or shorten sessions; prioritize accuracy first.'
      : level === 'low'
      ? 'Increase challenge slightly; add speed or complexity constraints.'
      : 'Maintain current challenge level—this is a strong learning zone.'
  };
}

function assessDeliberatePractice(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const deliberate = list.filter(s =>
    (s.focusScore || 0) > 0.8 &&
    (s.qualityScore || 0) > 70 &&
    (s.engagedMs || 0) >= 15 * 60000
  );
  return {
    frequency: list.length > 0 ? Math.round((deliberate.length / list.length) * 100) : 0,
    quality: H.average(deliberate.map(s => s.qualityScore || 50))
  };
}

// Transfer efficiency / correlations
function measureTransferEfficiency(stats) {
  const pairs = calculateModuleCorrelationsFromStats(stats);
  const positive = pairs.filter(c => c.correlation > 0.5);
  return {
    efficiency: positive.length > 0 ? Math.round(H.average(positive.map(c => c.correlation)) * 100) : 0,
    connections: positive.length
  };
}

function calculateModuleCorrelationsFromStats(stats) {
  const by = stats?.byModule || {};
  const entries = Object.entries(by);
  const correlations = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [m1, d1] = entries[i];
      const [m2, d2] = entries[j];

      const a1 = H.accuracy(d1.correct, d1.total);
      const a2 = H.accuracy(d2.correct, d2.total);
      const corr = 1 - Math.abs(a1 - a2) / 100;

      if (corr > 0.4) {
        correlations.push({
          module1: formatModuleName(m1),
          module2: formatModuleName(m2),
          correlation: Math.round(corr * 100) / 100
        });
      }
    }
  }
  return correlations;
}

function calculateModuleCorrelationsFromModules(modules) {
  const list = Array.isArray(modules) ? modules : [];
  const correlations = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const accA = Number(a.accuracy) || 0;
      const accB = Number(b.accuracy) || 0;

      const corr = 1 - Math.abs(accA - accB) / 100;

      correlations.push({
        module1: a.module,
        module2: b.module,
        correlation: Math.round(corr * 100) / 100
      });
    }
  }

  return correlations;
}

function generateTransferRecommendations(correlations) {
  return (Array.isArray(correlations) ? correlations : [])
    .filter(c => c.correlation > 0.6)
    .slice(0, 3)
    .map(c => `Practice ${c.module1} and ${c.module2} together to reinforce shared patterns`);
}

// Optimization helpers
function calculateIdealSessionDuration(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const high = list.filter(s => (s.qualityScore || 0) >= 75);
  if (high.length === 0) return '20-25 minutes';
  const avgMin = H.average(high.map(s => (s.engagedMs || 0) / 60000));
  const base = Math.round(avgMin / 5) * 5;
  return `${base}-${base + 5} minutes`;
}

function calculateIdealFrequency(sessions, patterns) {
  const consistency = patterns?.practiceHabits?.consistency || 50;
  if (consistency >= 80) return '6-7 days/week (excellent)';
  if (consistency >= 60) return '5-6 days/week (good)';
  if (consistency >= 40) return '4-5 days/week (building)';
  return '3-4 days/week (start here)';
}

function calculateOptimalRestDays(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const oldestMs = minTimestampMs(list);
  const weeks = Math.max(1, Math.ceil((Date.now() - oldestMs) / (7 * DAY_MS)));
  const weeklyAvg = list.length / weeks;

  if (weeklyAvg >= 6) return ['Sunday'];
  if (weeklyAvg >= 5) return ['Sunday', 'Wednesday'];
  return ['As needed'];
}

function generateIntensityProfile(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const high = list.filter(s => (s.qualityScore || 0) >= 80).length;
  const med = list.filter(s => (s.qualityScore || 0) >= 60 && (s.qualityScore || 0) < 80).length;
  const low = list.filter(s => (s.qualityScore || 0) < 60).length;

  return {
    high,
    medium: med,
    low,
    recommendation: 'Aim for ~60% high quality, 30% medium, 10% light sessions'
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
  const ops = [];
  const intervalsStrong = modules.find(m => m.moduleKey === 'intervals' && (m.accuracy || 0) >= 85);
  const earWeak = modules.find(m => m.moduleKey === 'intervalear' && (m.accuracy || 0) < 75);

  if (intervalsStrong && earWeak) {
    ops.push({
      type: 'skill-transfer',
      module: 'Interval Ear Training',
      currentLevel: earWeak.accuracy,
      recommendation: 'Apply interval-reading mastery to ear training: name + sing + identify.',
      effort: 'medium',
      impact: 'high'
    });
  }
  return ops;
}

// Retention placeholders (coherent + safe)
function calculateShortTermRetention(stats) { return 85; }
function calculateMediumTermRetention(stats) { return 75; }
function calculateLongTermRetention(stats) { return 65; }
function estimateForgettingCurve(stats) {
  return { day1: 100, day7: 85, day30: 70, day90: 60 };
}

function identifyConsolidatedSkills(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(m => (m.mastery || 0) >= 90 && (m.attempts || 0) >= 30)
    .map(m => m.module);
}

function identifyVolatileSkills(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(m => (m.consistency || 0) < 50 && (m.attempts || 0) >= 10)
    .map(m => m.module);
}

function calculateProjectedRetention(stats, modules, days) {
  const list = Array.isArray(modules) ? modules : [];
  const currentAvg = H.average(list.map(m => m.accuracy || 0));
  const decayRate = 0.002;
  return Math.max(60, currentAvg * (1 - decayRate * (Number(days) || 0)));
}

function identifyAtRiskConcepts(modules) {
  const list = Array.isArray(modules) ? modules : [];
  return list
    .filter(m =>
      (m.accuracy || 0) >= 70 &&
      (m.accuracy || 0) < 85 &&
      (Date.now() - (m.lastPracticed || 0)) > 7 * DAY_MS
    )
    .map(m => m.module)
    .slice(0, 3);
}

function identifyStrengthenedConcepts(modules) {
  const list = Array.isArray(modules) ? modules : [];
  return list
    .filter(m => (m.improvement || 0) > 10 && (m.attempts || 0) >= 10)
    .map(m => ({ module: m.module, improvement: m.improvement }))
    .slice(0, 3);
}

// Metacognition placeholders
function calculateSelfAwareness(sessions) { return 75; }
function calculateAdaptability(sessions, stats) {
  const list = Array.isArray(sessions) ? sessions : [];
  const adapt = list.filter((s, i) => i > 0 && (list[i - 1].accuracy || 0) < 70 && (s.accuracy || 0) >= 75).length;
  return Math.min(100, (adapt / Math.max(1, list.length)) * 500);
}
function calculateErrorCorrectionRate(stats) { return calculateCorrectionRate(stats); }
function assessStrategicThinking(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const strategic = list.filter(s => (s.qualityScore || 0) > 75 && (s.engagedMs || 0) >= 20 * 60000).length;
  return Math.round((strategic / Math.max(1, list.length)) * 100);
}
function assessReflectionQuality(sessions) { return 70; }

function calculateStyleConfidence(categoryScores) {
  const scores = Object.values(categoryScores || {});
  if (scores.length === 0) return 'low';
  const v = calculateVariance(scores);
  return v < 100 ? 'low' : v < 400 ? 'medium' : 'high';
}

// ======================================
// 🎯 STATS UPDATE (Public) — FIXED
// ======================================

export function updateStats(module, isCorrect, responseTime = 0, sessionData = {}) {
  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, initializeStats());
  const modKey = String(module || 'unknown');

  stats.total += 1;
  stats.correct += isCorrect ? 1 : 0;

  if (!stats.byModule[modKey]) {
    stats.byModule[modKey] = {
      correct: 0,
      total: 0,
      avgResponseTime: 0,

      // ✅ Fix #5: exact last-20 tracking
      recentWindow: [],
      recentCorrect: 0,
      recentTotal: 0,

      lastPracticed: Date.now(),
      difficulty: 'medium',
      errorPatterns: [],
      improvementRate: []
    };
  }

  const mod = stats.byModule[modKey];
  mod.total += 1;
  mod.correct += isCorrect ? 1 : 0;
  mod.lastPracticed = Date.now();

  // ✅ Fix #5: correct last-20 window via ring buffer
  if (!Array.isArray(mod.recentWindow)) mod.recentWindow = [];
  mod.recentWindow.push(!!isCorrect);
  if (mod.recentWindow.length > 20) mod.recentWindow.shift();

  mod.recentTotal = mod.recentWindow.length;
  mod.recentCorrect = mod.recentWindow.reduce((s, v) => s + (v ? 1 : 0), 0);

  // EMA for response time
  const rt = Number(responseTime) || 0;
  mod.avgResponseTime = mod.avgResponseTime
    ? (mod.avgResponseTime * 0.9 + rt * 0.1)
    : rt;

  // Improvement history (bounded)
  if (!Array.isArray(mod.improvementRate)) mod.improvementRate = [];
  mod.improvementRate.push({ timestamp: Date.now(), accuracy: H.accuracy(mod.correct, mod.total) });
  if (mod.improvementRate.length > 50) mod.improvementRate.shift();

  // Daily counts
  const todayKey = new Date().toDateString();
  stats.daily = stats.daily || {};
  stats.daily[todayKey] = (stats.daily[todayKey] || 0) + 1;

  // ✅ Fix #6: streak updates (current + max)
  const days = Object.keys(stats.daily || {})
    .map(d => dayKeyToMs(d))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  let streak = 0;
  if (days.length) {
    const todayMs = dayKeyToMs(todayKey);
    const day0 = days[0];
    const diff0 = Number.isFinite(todayMs) ? Math.floor((todayMs - day0) / DAY_MS) : 999;

    if (diff0 === 0) {
      streak = 1;
      for (let i = 1; i < days.length; i++) {
        const diff = Math.floor((days[i - 1] - days[i]) / DAY_MS);
        if (diff === 1) streak += 1;
        else break;
      }
    }
  }

  stats.streaks = stats.streaks || { current: 0, max: 0 };
  stats.streaks.current = streak;
  stats.streaks.max = Math.max(stats.streaks.max || 0, streak);

  // Learning velocity (bounded)
  if (!Array.isArray(stats.learningVelocity)) stats.learningVelocity = [];
  stats.learningVelocity.push({
    timestamp: Date.now(),
    module: modKey,
    isCorrect: !!isCorrect,
    responseTime: rt,
    currentAccuracy: H.accuracy(mod.correct, mod.total)
  });
  if (stats.learningVelocity.length > 100) stats.learningVelocity.shift();

  saveJSON(STORAGE_KEYS.ANALYTICS, stats);

  // Live session tracking: guard if sessionTracker API differs
  try {
    sessionTracker?.trackAnswer?.(module, isCorrect, responseTime, sessionData);
  } catch {
    safeTrack('answer', 'record', { module, isCorrect, responseTime });
  }

  return stats;
}

// ======================================
// 🎯 QUICK STATS (Public) — FIXED
// ======================================

export function getQuickStat(type) {
  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, initializeStats());

  switch (type) {
    case 'accuracy':
      return H.accuracy(stats.correct, stats.total);

    // NOTE: kept for backward compatibility (this is “questions”, not “sessions”)
    case 'sessions':
      return stats.total || 0;

    case 'consistency': {
      const sessions = loadJSON(STORAGE_KEYS.JOURNAL, []);
      const list = Array.isArray(sessions) ? sessions : [];

      // ✅ Fix #3: oldest based on minTimestampMs
      const oldestMs = minTimestampMs(list);
      const days = Math.max(1, Math.ceil((Date.now() - oldestMs) / DAY_MS));

      // ✅ Fix #2: robust day extraction
      const uniqueDays = new Set(list.map(s => dayKeyFromTs(s?.timestamp))).size;
      return Math.min(100, Math.round((uniqueDays / days) * 100));
    }

    case 'streak':
      return safeGet(stats, 'streaks.current', 0) || 0;

    case 'momentum': {
      const sessions = loadJSON(STORAGE_KEYS.JOURNAL, []);
      const list = Array.isArray(sessions) ? sessions : [];
      return calculateMomentumScore(list.slice(-10));
    }

    default:
      return 0;
  }
}

// ======================================
// 🎯 EXPORT (Public)
// ======================================

export function exportAnalytics() {
  const analysis = analyzePerformance('all', {
    includePredictions: true,
    includePatterns: true,
    includeOptimization: true,
    includeBreakthrough: true
  });

  return {
    version: '3.1',
    timestamp: Date.now(),
    ...analysis,
    rawStats: loadJSON(STORAGE_KEYS.ANALYTICS, initializeStats()),
    mlMeta: {
      predictionsEnabled: true,
      patternsDetected: true,
      optimizationActive: true
    }
  };
}

// ======================================
// Default export (keeps prior API shape)
// ======================================

export default {
  analyzePerformance,
  updateStats,
  getQuickStat,
  exportAnalytics,
  generateSmartRecommendations,
  generateAdvancedAIInsights
};