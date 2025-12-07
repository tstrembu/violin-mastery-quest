// ======================================
// VMQ ANALYTICS v2.0 - 6-Engine Intelligence
// SM-2 + Difficulty + Session + 50+ modules
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { MUSIC, accuracy, average } from '../utils/helpers.js';
import { sessionTracker } from './sessionTracker.js';

// ======================================
// 🎯 CORE ANALYTICS (Production Optimized)
// ======================================

/**
 * Complete performance analysis (CoachPanel/Journal/Dashboard)
 */
export function analyzePerformance(timeframe = 'week') {
  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, initializeStats());
  const sessions = loadJSON(STORAGE_KEYS.JOURNAL, []);
  const now = Date.now();
  
  // Timeframe filter (production optimized)
  const cutoff = getTimeCutoff(timeframe);
  const filteredSessions = sessions.filter(s => 
    now - new Date(s.timestamp).getTime() < cutoff
  );

  // 🎯 CORE METRICS
  const overall = calculateOverallStats(stats, filteredSessions);
  const modules = calculateModuleStats(stats);
  const trends = calculateTrends(filteredSessions);
  
  return {
    timeframe,
    ...overall,
    modules: modules.slice(0, 8), // Top 8 modules
    strengths: modules.filter(m => m.accuracy >= 85 && m.attempts >= 10).slice(0, 3),
    weaknesses: modules.filter(m => m.accuracy < 75 && m.attempts >= 5).slice(0, 3),
    trends,
    recommendations: generateRecommendations(overall, modules, trends),
    aiInsights: generateAIInsights(overall, modules)
  };
}

/**
 * Initialize stats structure
 */
function initializeStats() {
  return {
    total: 0,
    correct: 0,
    byModule: {},
    daily: {},
    streaks: { current: 0, max: 0 },
    recentSessions: [],
    lastAnalysis: Date.now()
  };
}

/**
 * Time cutoffs (week/month/all)
 */
function getTimeCutoff(timeframe) {
  const cutoffs = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    quarter: 90 * 24 * 60 * 60 * 1000,
    all: Infinity
  };
  return cutoffs[timeframe] || cutoffs.week;
}

/**
 * 🎯 OVERALL STATS (CoachPanel live feed)
 */
function calculateOverallStats(stats, sessions) {
  const totalTime = sessions.reduce((sum, s) => sum + (s.engagedMs || 0), 0);
  const uniqueDays = new Set(sessions.map(s => 
    new Date(s.timestamp).toDateString()
  )).size;
  
  const consistency = sessions.length > 0 
    ? Math.round((uniqueDays / 7) * 100) 
    : 0;

  return {
    overallAccuracy: accuracy(stats.correct, stats.total),
    totalPracticeTime: formatDuration(totalTime),
    totalSessions: sessions.length,
    consistencyScore: Math.min(100, consistency),
    avgSessionTime: formatDuration(totalTime / Math.max(1, sessions.length)),
    currentStreak: calculateCurrentStreak(sessions),
    avgAccuracy: average(sessions.map(s => s.accuracy || 0))
  };
}

/**
 * 🎯 MODULE BREAKDOWN (Journal/Analytics)
 */
function calculateModuleStats(stats) {
  return Object.entries(stats.byModule || {}).map(([module, data]) => ({
    module: formatModuleName(module),
    accuracy: accuracy(data.correct, data.total),
    attempts: data.total,
    avgResponseTime: formatTime(data.avgResponseTime || 0),
    recentAccuracy: accuracy(data.recentCorrect || 0, data.recentTotal || 1),
    improvement: calculateImprovement(data)
  })).sort((a, b) => b.accuracy - a.accuracy);
}

/**
 * 🎯 TRENDS (Dashboard visualization)
 */
function calculateTrends(sessions) {
  const sevenDays = sessions
    .filter(s => Date.now() - s.timestamp < 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => b.timestamp - a.timestamp);
  
  return {
    currentStreak: calculateCurrentStreak(sevenDays),
    sessionsPerDay: Math.round(sevenDays.length / 7),
    accuracyTrend: getAccuracyTrend(sevenDays),
    practiceTrend: sevenDays.length >= 5 ? 'consistent' : 'building'
  };
}

/**
 * 🎯 AI RECOMMENDATIONS (CoachPanel #1)
 */
export function generateRecommendations(overall, modules, trends) {
  const recs = [];

  // 🎯 PRIORITY 1: SM-2 + Weak modules
  const weakModules = modules.filter(m => m.accuracy < 75 && m.attempts >= 5);
  weakModules.slice(0, 2).forEach(module => {
    recs.push({
      priority: 'high',
      type: 'focus',
      title: `${module.module} Needs Work`,
      message: `${module.accuracy}% (${module.attempts} attempts)`,
      module: module.module.toLowerCase().replace(/\s+/g, ''),
      action: `#${module.module.toLowerCase().replace(/\s+/g, '')}`
    });
  });

  // 🎯 PRIORITY 2: Consistency
  if (overall.consistencyScore < 60) {
    recs.push({
      priority: 'medium',
      type: 'habit',
      title: 'Practice Daily',
      message: `${overall.consistencyScore}% consistency. Aim 5 days/week`,
      module: 'practiceplanner',
      action: '#practiceplanner'
    });
  }

  // 🎯 PRIORITY 3: Speed vs Accuracy
  if (overall.overallAccuracy < 80 && modules[0]?.avgResponseTime > 3000) {
    recs.push({
      priority: 'medium',
      type: 'speed',
      title: 'Build Speed',
      message: 'Avg response > 3s. Use Sprint modes.',
      module: 'intervalsprint',
      action: '#intervalsprint'
    });
  }

  // 🎯 STRENGTH PROMOTION
  if (overall.overallAccuracy >= 90) {
    recs.push({
      priority: 'low',
      type: 'advance',
      title: 'Advanced Ready!',
      message: `${overall.overallAccuracy}% → Try Bieler Lab`,
      module: 'bielerlab',
      action: '#bielerlab'
    });
  }

  return recs.slice(0, 5);
}

/**
 * 🎯 AI INSIGHTS (CoachPanel live)
 */
export function generateAIInsights(overall, modules) {
  const insights = [];

  if (overall.overallAccuracy >= 90) {
    insights.push({
      type: 'mastery',
      message: `🎉 ${overall.overallAccuracy}% accuracy mastery!`,
      nextModule: 'bielerlab'
    });
  }

  if (overall.consistencyScore >= 80) {
    insights.push({
      type: 'habit',
      message: `✅ ${overall.consistencyScore}% consistency. Habit formed!`,
      streak: overall.currentStreak
    });
  }

  const topModule = modules[0];
  if (topModule && topModule.accuracy >= 95) {
    insights.push({
      type: 'strength',
      message: `${topModule.module} → 95% expert`,
      module: topModule.module
    });
  }

  return insights;
}

// ======================================
// 🔧 STATS HELPERS (Production)
// ======================================

function formatModuleName(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(ms) {
  return ms > 0 ? `${Math.round(ms)}ms` : 'N/A';
}

function calculateCurrentStreak(sessions) {
  let streak = 0;
  const today = new Date().toDateString();
  
  // Check today first
  if (sessions.some(s => new Date(s.timestamp).toDateString() === today)) {
    streak = 1;
  }
  
  return Math.max(1, streak);
}

function getAccuracyTrend(sessions) {
  const recent = sessions.slice(0, 5).map(s => s.accuracy || 0);
  const earlier = sessions.slice(5, 10).map(s => s.accuracy || 0);
  
  const recentAvg = average(recent);
  const earlierAvg = average(earlier);
  
  if (recentAvg > earlierAvg + 5) return 'improving';
  if (recentAvg < earlierAvg - 5) return 'declining';
  return 'stable';
}

function calculateImprovement(data) {
  const recent = data.recentAccuracy || 0;
  const overall = accuracy(data.correct, data.total);
  return Math.round(recent - overall);
}

/**
 * 🎯 UPDATE STATS (50+ modules → live)
 */
export function updateStats(module, isCorrect, responseTime = 0, sessionData = {}) {
  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, initializeStats());
  
  // Global
  stats.total += 1;
  stats.correct += isCorrect ? 1 : 0;
  
  // Module (production optimized)
  if (!stats.byModule[module]) {
    stats.byModule[module] = { 
      correct: 0, total: 0, 
      avgResponseTime: 0, 
      recentCorrect: 0, recentTotal: 0 
    };
  }
  
  const mod = stats.byModule[module];
  mod.total += 1;
  mod.correct += isCorrect ? 1 : 0;
  
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
  
  // Daily
  const today = new Date().toDateString();
  stats.daily[today] = (stats.daily[today] || 0) + 1;
  
  saveJSON(STORAGE_KEYS.ANALYTICS, stats);
  
  // Live session tracking
  sessionTracker.trackAnswer(module, isCorrect, responseTime, sessionData);
  
  return stats;
}

/**
 * 🎯 QUICK STATS (Dashboard live)
 */
export function getQuickStat(type) {
  const stats = loadJSON(STORAGE_KEYS.ANALYTICS, {});
  switch (type) {
    case 'accuracy': return accuracy(stats.correct, stats.total);
    case 'sessions': return stats.total || 0;
    case 'consistency': 
      const sessions = loadJSON(STORAGE_KEYS.JOURNAL, []);
      return Math.min(100, Math.round(sessions.length / 7));
    case 'streak': return stats.streaks?.current || 1;
    default: return 0;
  }
}

/**
 * 🎯 EXPORT (DataManager)
 */
export function exportAnalytics() {
  const analysis = analyzePerformance('all');
  return {
    timestamp: Date.now(),
    ...analysis,
    rawStats: loadJSON(STORAGE_KEYS.ANALYTICS, {})
  };
}
