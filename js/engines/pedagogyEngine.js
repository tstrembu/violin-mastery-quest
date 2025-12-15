// js/engines/pedagogyEngine.js
// ======================================
// VMQ PEDAGOGY ENGINE v3.0.5 - Compatibility + Stability Pass
// Progression ladders + passage analysis + predictive repertoire
//
// Goals:
// ✅ Keep all intended v3.0.0 features
// ✅ Export/alias names used by components (analyzeFeedback, getRecommendations, etc.)
// ✅ Avoid Promise misuse (sm2GetStats may be async in spacedRepetition v2.1+)
// ✅ Defensive for partial stats shapes
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { INTERVALS, BIELER_TAXONOMY } from '../config/constants.js';
import { analyzePerformance as _analyzePerformance } from './analytics.js';
import { getStats as sm2GetStats } from './spacedRepetition.js';
import { getDifficultyInfo as _getDifficultyInfo } from './difficultyAdapter.js';
import { addXP, unlockAchievement } from './gamification.js';
import sessionTracker from './sessionTracker.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const safeArray = (v) => (Array.isArray(v) ? v : []);
const safeNumber = (n, fallback = 0) => (Number.isFinite(Number(n)) ? Number(n) : fallback);

/**
 * Sync-safe SRS stats derived from stored deck.
 * Avoids calling sm2GetStats() which may be async in newer engine versions.
 */
function getSrsStatsSync() {
  const deckObj = loadJSON(STORAGE_KEYS.SPACED_REPETITION, {});
  const obj = isObj(deckObj) ? deckObj : {};

  const now = Date.now();
  const GRACE_MS = Math.round(DAY_MS * 0.2);

  const items = Object.values(obj).filter(it => it && it.type !== 'meta');
  const dueToday = items.filter(it => safeNumber(it.due, Infinity) <= now + DAY_MS).length;
  const dueNow = items.filter(it => safeNumber(it.due, Infinity) <= now + GRACE_MS).length;

  const avgEF =
    items.length > 0
      ? items.reduce((s, it) => s + safeNumber(it.efactor, 0), 0) / items.length
      : 0;

  const retention =
    items.length > 0
      ? items.filter(it => {
          const hist = it?.qualityHistory;
          if (!Array.isArray(hist) || hist.length === 0) return false;
          const last5 = hist.slice(-5);
          return last5.length > 0 && last5.every(q => safeNumber(q, 0) >= 3);
        }).length / items.length
      : 0;

  return {
    total: items.length,
    dueToday,
    dueNow,
    avgEF,
    retention
  };
}

// ======================================
// PROGRESSION SYSTEM
// ======================================

export function getCurrentProgressionLevel(module) {
  const modKey = String(module || 'intervals').toLowerCase();
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const moduleStats = stats.byModule?.[modKey] || { total: 0, correct: 0, avgResponseTime: 0, recentStreak: 0 };

  const total = safeNumber(moduleStats.total, 0);
  const correct = safeNumber(moduleStats.correct, 0);
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const avgTime = safeNumber(moduleStats.avgResponseTime, 5000);
  const recentStreak = safeNumber(moduleStats.recentStreak, 0);

  const ladders = getProgressionLadders(modKey);
  const adjustedLadders = adjustLadderThresholds(ladders, moduleStats, modKey);

  for (let i = adjustedLadders.length - 1; i >= 0; i--) {
    const lvl = adjustedLadders[i];
    if (accuracy >= lvl.reqAccuracy && avgTime <= lvl.reqTime) {
      const readiness = predictReadiness(moduleStats, lvl.nextLevelReq);
      return {
        current: lvl.name,
        progress: 100,
        next: adjustedLadders[i - 1] ? adjustedLadders[i - 1].name : 'Mastered!',
        repertoire: lvl.repertoire,
        unlocked: true,
        readinessScore: readiness.score,
        estimatedDaysToNext: readiness.days,
        mlAdjusted: true
      };
    }
  }

  for (let i = 0; i < adjustedLadders.length; i++) {
    const lvl = adjustedLadders[i];
    if (accuracy < lvl.reqAccuracy || avgTime > lvl.reqTime) {
      const accProgress = Math.min(100, (accuracy / Math.max(1, lvl.reqAccuracy)) * 100);
      const timeProgress = Math.min(100, (lvl.reqTime / Math.max(1, avgTime)) * 100);
      const overall = Math.round((accProgress + timeProgress) / 2);

      const plateau = detectPlateau(moduleStats, lvl, overall);

      return {
        current: lvl.name,
        progress: overall,
        next: adjustedLadders[i + 1]?.name || 'Mastered!',
        repertoire: lvl.repertoire,
        gaps: {
          accuracyGap: lvl.reqAccuracy - accuracy,
          timeGap: avgTime - lvl.reqTime
        },
        plateauDetected: plateau.isPlateau,
        intervention: plateau.intervention,
        streakBoost: recentStreak > 5 ? 1.1 : 1.0
      };
    }
  }

  return { current: 'Beginner', progress: 0, next: adjustedLadders[0]?.name || 'Intervals', repertoire: [] };
}

function getProgressionLadders(module) {
  const base = {
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
    ],
    fingerboard: [
      { name: '1st Position Mapping', reqAccuracy: 85, reqTime: 3000, repertoire: ['Suzuki Bk2'], nextLevelReq: { accuracy: 90, time: 2500 } },
      { name: '2nd/3rd Position', reqAccuracy: 80, reqTime: 3500, repertoire: ['Accolay Concerto'], nextLevelReq: { accuracy: 85, time: 3000 } },
      { name: 'Full Neck Fluency', reqAccuracy: 75, reqTime: 4000, repertoire: ['Bruch Concerto'], nextLevelReq: { accuracy: 80, time: 3500 } }
    ]
  };

  return base[module] || base.intervals;
}

function adjustLadderThresholds(ladders, moduleStats, module) {
  if (!moduleStats || safeNumber(moduleStats.total, 0) < 30) return ladders;

  const recentAccuracyTrend = getRecentTrend(moduleStats, 'accuracy', 10);
  const recentTimeTrend = getRecentTrend(moduleStats, 'time', 10);
  const velocity = calculateLearningVelocity(recentAccuracyTrend, recentTimeTrend);

  return ladders.map((rung) => {
    const difficultyMultiplier = velocity > 1.2 ? 0.95 : velocity < 0.8 ? 1.05 : 1.0;
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

function predictReadiness(moduleStats, nextLevelReq) {
  const srs = getSrsStatsSync();
  const retentionPct = safeNumber(srs.retention, 0) * 100; // srs.retention is 0..1
  const recentAccuracy = getRecentAverage(moduleStats, 'accuracy', 5);

  const readinessScore = (retentionPct * 0.7) + (recentAccuracy * 0.3);
  const requiredScore = (safeNumber(nextLevelReq?.accuracy, 90) * 0.7) + 10;

  const daysToReady = readinessScore >= requiredScore ? 0 : Math.ceil((requiredScore - readinessScore) / 5);

  return {
    score: Math.min(100, readinessScore),
    days: daysToReady,
    confidence: safeNumber(moduleStats.total, 0) > 50 ? 'high' : 'medium'
  };
}

function detectPlateau(moduleStats, _currentLevel, progress) {
  if (!moduleStats || safeNumber(moduleStats.total, 0) < 20) return { isPlateau: false };

  const recentTrend = getRecentTrend(moduleStats, 'accuracy', 7);
  const isPlateau = recentTrend < 0.05 && safeNumber(progress, 0) < 60;

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
// REPERTOIRE MAPPING
// ======================================

export function getRepertoireForInterval(intervalId) {
  const interval = safeArray(INTERVALS).find(i => i?.id === intervalId);
  if (!interval) return null;

  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const intervalStats = stats.byModule?.intervals?.byInterval?.[intervalId] || {};
  const userAccuracy = safeNumber(intervalStats.accuracy, 50);
  const attempts = safeNumber(intervalStats.attempts, 0);

  const isMastered = userAccuracy > 85 && attempts > 10;
  const isStruggling = userAccuracy < 60 && attempts > 5;

  let recommendedPieces = safeArray(interval.repertoire);
  if (isStruggling) recommendedPieces = safeArray(interval.etudes).slice(0, 2).length ? safeArray(interval.etudes).slice(0, 2) : recommendedPieces;
  else if (isMastered) recommendedPieces = safeArray(interval.performancePieces || interval.repertoire).slice(0, 3);

  return {
    interval: interval.name,
    semitones: interval.semitones,
    examples: recommendedPieces,
    etudes: safeArray(interval.etudes),
    suzuki: interval.suzukiLevel || 'N/A',
    bielerNote: interval.bielerNote || 'Core interval for hand frame',
    userAccuracy,
    attempts,
    masteryLevel: isMastered ? 'mastered' : isStruggling ? 'needs-practice' : 'developing',
    mlPrediction: predictPieceDifficulty(intervalId, userAccuracy, attempts)
  };
}

function predictPieceDifficulty(_intervalId, accuracy, attempts) {
  const logOdds = (accuracy / 100) * 2 + (attempts / 20) - 1.5;
  const probability = 1 / (1 + Math.exp(-logOdds));
  return {
    successProbability: Math.round(probability * 100),
    recommendation: probability > 0.7 ? 'recommended' : probability > 0.4 ? 'challenging' : 'too-difficult',
    estimatedPracticeHours: Math.ceil((100 - accuracy) / 10)
  };
}

// ======================================
// PASSAGE ANALYSIS
// ======================================

export function analyzePassage(passageText = '') {
  const analysis = {
    intervals: [],
    techniques: [],
    drills: [],
    difficulty: 'beginner',
    confidence: 0.7,
    mlEnriched: true
  };

  const text = String(passageText || '').toLowerCase();

  safeArray(INTERVALS).forEach(int => {
    const name = String(int?.name || '').toLowerCase();
    const abbr = String(int?.abbr || '').toLowerCase();
    const hasInterval = (name && text.includes(name)) || (abbr && text.includes(abbr));

    if (hasInterval) {
      const intervalStats = getUserIntervalStats(int.id);
      const isWeakArea = safeNumber(intervalStats.accuracy, 0) < 70 && safeNumber(intervalStats.attempts, 0) > 5;

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

  const leftHand = isObj(BIELER_TAXONOMY?.leftHand) ? BIELER_TAXONOMY.leftHand : {};
  Object.entries(leftHand).forEach(([key, func]) => {
    const fname = String(func?.name || '').toLowerCase();
    if (fname && text.includes(fname)) {
      const techStats = getUserTechniqueStats(key);
      const needsWork = safeNumber(techStats.seen, 0) > 0 && safeNumber(techStats.accuracy, 0) < 75;

      analysis.techniques.push({
        name: func.name,
        drill: 'bieler',
        module: '#bieler',
        exercises: safeArray(func.exercises).slice(0, needsWork ? 3 : 2),
        priority: needsWork ? 'high' : 'medium',
        mastery: safeNumber(techStats.accuracy, 0)
      });
    }
  });

  const semanticPatterns = detectSemanticPatterns(text);
  semanticPatterns.forEach(p => {
    analysis.drills.push({
      module: p.module,
      reason: p.reason,
      route: p.route,
      mlConfidence: p.confidence
    });
  });

  analysis.difficulty = estimateDifficulty(text, analysis.intervals, analysis.techniques);
  analysis.confidence = calculateAnalysisConfidence(analysis);

  return analysis;
}

// ---- Compatibility alias: some components import analyzeFeedback()
export function analyzeFeedback(input = '') {
  // If a component passes a structured object, try to do the “right thing”.
  if (input && typeof input === 'object') {
    const maybeText = input.passageText || input.text || input.notes || '';
    return analyzePassage(String(maybeText));
  }
  return analyzePassage(String(input || ''));
}

function detectSemanticPatterns(text) {
  const patterns = [];

  if (/3rd|5th|7th|position|shift/i.test(text)) {
    patterns.push({
      module: 'keys',
      reason: 'Position changes require key familiarity and hand frame knowledge',
      route: '#keys?focus=position',
      confidence: 0.8
    });
  }

  if (/triplet|duplet|syncopation|polyrhythm/i.test(text)) {
    patterns.push({
      module: 'rhythm',
      reason: 'Complex rhythmic subdivisions need dedicated practice',
      route: '#rhythm?focus=advanced',
      confidence: 0.75
    });
  }

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

function estimateDifficulty(text, intervals, techniques) {
  const signals = {
    intervalComplexity: safeArray(intervals).filter(i =>
      String(i?.name || '').includes('7th') || String(i?.name || '').includes('dim') || String(i?.name || '').includes('aug')
    ).length * 0.3,
    techniqueComplexity: safeArray(techniques).length * 0.25,
    positionChanges: (String(text).match(/position|shift/g) || []).length * 0.2,
    rhythmicComplexity: (String(text).match(/triplet|syncopation|irregular/g) || []).length * 0.25
  };

  const score = Object.values(signals).reduce((sum, val) => sum + safeNumber(val, 0), 0);

  if (score > 1.5) return 'advanced';
  if (score > 0.8) return 'intermediate';
  return 'beginner';
}

function calculateAnalysisConfidence(analysis) {
  const intervalConfidence =
    safeArray(analysis?.intervals).reduce((sum, i) => sum + safeNumber(i?.confidence, 0.7), 0) /
    Math.max(1, safeArray(analysis?.intervals).length);

  const patternConfidence =
    safeArray(analysis?.drills).reduce((sum, d) => sum + safeNumber(d?.mlConfidence, 0.5), 0) /
    Math.max(1, safeArray(analysis?.drills).length);

  return Math.min(0.95, (intervalConfidence + patternConfidence) / 2);
}

// ======================================
// WORKSHOP / ROADMAP
// ======================================

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

  const seq = baseWorkshops[String(challenge || '').toLowerCase()] || baseWorkshops.bow;

  const adjusted = seq.map(drill => {
    const efficiency = getPracticeEfficiency(drill.module);
    const levelMultiplier = userLevel === 'beginner' ? 1.5 : userLevel === 'advanced' ? 0.8 : 1.0;

    return {
      ...drill,
      duration: Math.max(2, Math.round(safeNumber(drill.duration, 5) * levelMultiplier / Math.max(0.25, efficiency))),
      route: `#${drill.module}`,
      mlOptimized: true
    };
  });

  const prepTime = adjusted.reduce((sum, s) => sum + safeNumber(s?.duration, 0), 0);

  return {
    piece,
    measure,
    challenge,
    prepTime,
    drills: adjusted,
    estimatedSessions: Math.ceil(prepTime / 15),
    successProbability: predictWorkshopSuccess(adjusted, userLevel)
  };
}

function predictWorkshopSuccess(sequence, userLevel) {
  const moduleStats = safeArray(sequence).map(d => {
    const st = getModuleStats(d.module);
    return {
      module: d.module,
      userAccuracy: safeNumber(st.accuracy, 50),
      attempts: safeNumber(st.attempts, 0),
      confidence: Math.min(1, safeNumber(st.attempts, 0) / 20)
    };
  });

  const weightedScore =
    moduleStats.reduce((sum, m) => sum + (m.userAccuracy * m.confidence), 0) / Math.max(1, moduleStats.length);

  const levelMultiplier = { beginner: 0.8, intermediate: 1.0, advanced: 1.2 };

  return Math.min(0.95, (weightedScore / 100) * (levelMultiplier[userLevel] || 1.0));
}

export function getProgressRoadmap(module) {
  const modKey = String(module || 'intervals').toLowerCase();
  const current = getCurrentProgressionLevel(modKey);
  const ladders = getProgressionLadders(modKey);

  const idxCurrent = ladders.findIndex(l => l.name === current.current);

  const roadmap = ladders.map((lvl, i) => {
    const isComplete = idxCurrent >= 0 ? i < idxCurrent : false;
    const isCurrent = lvl.name === current.current;

    let prediction = null;
    if (!isComplete && !isCurrent) prediction = predictLevelTimeline(modKey, lvl, i);

    return {
      name: lvl.name,
      complete: isComplete,
      current: isCurrent,
      req: `${lvl.reqAccuracy}% @ ${lvl.reqTime}ms`,
      repertoire: safeArray(lvl.repertoire).slice(0, 2).join(', '),
      mlPrediction: prediction
    };
  });

  return {
    currentLevel: current.current,
    progressPercent: current.progress,
    roadmap,
    crossModuleSynergies: detectCrossModuleSynergies(modKey),
    recommendedFocus: getRecommendedFocusAreas(modKey)
  };
}

function predictLevelTimeline(module, targetLevel) {
  const currentStats = getModuleStats(module);
  const velocity = calculateLearningVelocity(
    getRecentTrend(currentStats, 'accuracy', 10),
    getRecentTrend(currentStats, 'time', 10)
  );

  const gap = safeNumber(targetLevel.reqAccuracy, 0) - safeNumber(currentStats.accuracy, 0);
  const sessionsNeeded = Math.max(1, Math.ceil(gap / Math.max(0.5, velocity * 5)));

  return {
    estimatedSessions: sessionsNeeded,
    estimatedDays: Math.ceil(sessionsNeeded / 2),
    confidence: safeNumber(currentStats.total, 0) > 50 ? 'high' : safeNumber(currentStats.total, 0) > 20 ? 'medium' : 'low',
    ifContinueCurrentTrend: velocity > 1.0 ? 'on-track' : velocity < 0.5 ? 'falling-behind' : 'steady'
  };
}

function detectCrossModuleSynergies(module) {
  const modules = ['intervals', 'keys', 'bieler', 'rhythm', 'fingerboard'];
  const synergies = [];

  modules.forEach(other => {
    if (other === module) return;

    const otherStats = getModuleStats(other);
    const thisStats = getModuleStats(module);

    if (safeNumber(otherStats.accuracy, 0) > 80 && safeNumber(thisStats.accuracy, 0) < 70 && safeNumber(otherStats.attempts, 0) > 20) {
      synergies.push({
        from: other,
        to: module,
        effect: 'positive-transfer',
        strength: Math.min(0.3, (safeNumber(otherStats.accuracy, 0) - safeNumber(thisStats.accuracy, 0)) / 100),
        recommendedDrill: `Practice ${other} concepts that apply to ${module}`
      });
    }
  });

  return synergies;
}

function getRecommendedFocusAreas(module) {
  const stats = getModuleStats(module);
  const srs = getSrsStatsSync();

  const focusAreas = [];

  if (safeNumber(stats.accuracy, 0) < 60) {
    focusAreas.push({ area: 'fundamentals', priority: 'high', reason: 'Low accuracy indicates gaps' });
  }

  if (safeNumber(srs.dueToday, 0) > 5) {
    focusAreas.push({ area: 'spaced-repetition', priority: 'high', reason: `${srs.dueToday} items due for review` });
  }

  if (safeNumber(stats.avgTime, 0) > 3000) {
    focusAreas.push({ area: 'speed', priority: 'medium', reason: 'Slow response times' });
  }

  return focusAreas;
}

// ======================================
// MILESTONES
// ======================================

export function logRepertoireMilestone(piece, measure, module) {
  const modKey = String(module || 'intervals').toLowerCase();
  const milestones = safeArray(loadJSON(STORAGE_KEYS.MILESTONES, []));

  const isBreakthrough = detectBreakthroughPerformance(modKey, piece);

  const milestone = {
    piece,
    measure,
    module: modKey,
    date: new Date().toISOString(),
    level: getCurrentProgressionLevel(modKey).current,
    isBreakthrough,
    mlInsights: {
      retentionPredicted: predictRetentionForPiece(modKey, piece),
      skillTransferDetected: detectCrossModuleSynergies(modKey).length > 0,
      difficultyAlignment: getDifficultyAlignment(modKey, piece)
    }
  };

  milestones.push(milestone);

  if (isBreakthrough) {
    try { addXP(100, 'breakthrough-performance'); } catch { /* ignore */ }
    try { unlockAchievement('repertoire-breakthrough', { piece, module: modKey }); } catch { /* ignore */ }
  }

  saveJSON(STORAGE_KEYS.MILESTONES, milestones.slice(-50));

  try {
    if (sessionTracker?.trackActivity) {
      sessionTracker.trackActivity('pedagogy', 'milestone', {
        piece,
        module: modKey,
        isBreakthrough,
        readiness: milestone.mlInsights.retentionPredicted
      });
    }
  } catch {
    // ignore
  }

  return milestones;
}

function detectBreakthroughPerformance(module, _piece) {
  const stats = getModuleStats(module);
  const recentImprovement = getRecentImprovementRate(stats, 5);
  return recentImprovement > 15 && safeNumber(stats.accuracy, 0) > 75;
}

function predictRetentionForPiece(_module, piece) {
  const srs = getSrsStatsSync();
  const baseRetention = safeNumber(srs.retention, 0) * 100; // 0..100

  const difficultyFactor = getPieceDifficulty(piece) * 0.1;
  const performanceFactor = safeNumber(getModuleStats(_module).accuracy, 0) / 100;

  return Math.min(95, baseRetention + (difficultyFactor * performanceFactor * 10));
}

// ======================================
// EXTRA COMPATIBILITY EXPORTS
// ======================================

/**
 * Some components want a single "pedagogy insights" object.
 */
export function getPedagogyInsights(module = 'intervals') {
  const modKey = String(module || 'intervals').toLowerCase();
  const current = getCurrentProgressionLevel(modKey);
  const roadmap = getProgressRoadmap(modKey);
  const srs = getSrsStatsSync();

  return {
    module: modKey,
    current,
    roadmap,
    srs
  };
}

/**
 * Some components import analyzeFingerboardPerformance().
 * We provide a stable implementation based on STATS.
 */
export function analyzeFingerboardPerformance() {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const fb = stats.byModule?.fingerboard || {};
  const total = safeNumber(fb.total, 0);
  const correct = safeNumber(fb.correct, 0);
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Optional nested breakdowns if you store them later:
  const byString = isObj(fb.byString) ? fb.byString : {};
  const byPosition = isObj(fb.byPosition) ? fb.byPosition : {};

  const weakestStrings = Object.entries(byString)
    .map(([k, v]) => ({ key: k, accuracy: safeNumber(v?.accuracy ?? v, 0) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 2);

  const weakestPositions = Object.entries(byPosition)
    .map(([k, v]) => ({ key: k, accuracy: safeNumber(v?.accuracy ?? v, 0) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 2);

  return {
    module: 'fingerboard',
    accuracy,
    attempts: total,
    avgTime: safeNumber(fb.avgResponseTime ?? fb.avgTime, 0),
    weakestStrings,
    weakestPositions,
    recommendation:
      accuracy < 65
        ? 'Return to 1st-position mapping drills; slow down and name notes aloud.'
        : accuracy < 80
        ? 'Add mixed-string quizzes and position checks.'
        : 'Maintain with quick daily review and repertoire mapping.'
  };
}

/**
 * Some components import getRecommendations() from pedagogyEngine.
 * Provide pedagogy-flavored recommendations (module focus + SRS + difficulty adapter).
 */
export function getRecommendations(module = 'intervals') {
  const modKey = String(module || 'intervals').toLowerCase();
  const stats = getModuleStats(modKey);
  const srs = getSrsStatsSync();

  const difficultyInfo = (() => {
    try {
      if (typeof _getDifficultyInfo === 'function') return _getDifficultyInfo(modKey);
    } catch { /* ignore */ }
    return null;
  })();

  const recs = [];

  if (safeNumber(stats.accuracy, 0) < 70) {
    recs.push({ type: 'focus', priority: 1, module: modKey, message: 'Accuracy is low—practice fundamentals at lower difficulty.' });
  }

  if (safeNumber(srs.dueToday, 0) > 5) {
    recs.push({ type: 'srs', priority: 2, module: 'flashcards', message: `${srs.dueToday} items due—do a spaced repetition review.` });
  }

  if (difficultyInfo?.recommendedDifficulty) {
    recs.push({ type: 'difficulty', priority: 3, module: modKey, message: `Suggested difficulty: ${difficultyInfo.recommendedDifficulty}` });
  }

  // Fingerboard bonus suggestion
  if (modKey !== 'fingerboard' && safeNumber(getModuleStats('fingerboard').accuracy, 0) < 70) {
    recs.push({ type: 'transfer', priority: 4, module: 'fingerboard', message: 'Fingerboard mapping is a bottleneck—add 5 minutes of note-location drills.' });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// ======================================
// Utilities
// ======================================

function getRecentTrend(stats, metric, window) {
  const recent = safeArray(stats?.recentHistory).slice(-window);
  if (recent.length < 2) return 0;

  const first = safeNumber(recent[0]?.[metric], 0);
  const last = safeNumber(recent[recent.length - 1]?.[metric], 0);

  return (last - first) / Math.max(1, recent.length - 1);
}

function getRecentAverage(stats, metric, window) {
  const recent = safeArray(stats?.recentHistory).slice(-window);
  if (!recent.length) return 0;
  const sum = recent.reduce((acc, item) => acc + safeNumber(item?.[metric], 0), 0);
  return sum / recent.length;
}

function calculateLearningVelocity(accuracyTrend, timeTrend) {
  const normalizedAccuracy = Math.max(0, Math.min(2, safeNumber(accuracyTrend, 0) + 1));
  const normalizedTime = Math.max(0, Math.min(2, 1 - (safeNumber(timeTrend, 0) / 1000)));
  return (normalizedAccuracy + normalizedTime) / 2;
}

function getCrossModuleTransferBonus(module) {
  const synergies = detectCrossModuleSynergies(module);
  const positive = synergies.filter(s => s.effect === 'positive-transfer');
  if (!positive.length) return 1.0;

  const avgStrength = positive.reduce((sum, s) => sum + safeNumber(s.strength, 0), 0) / positive.length;
  return 1.0 + (avgStrength * 0.15);
}

function getModuleStats(module) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const m = stats.byModule?.[module] || {};
  const total = safeNumber(m.total, safeNumber(m.attempts, 0));
  const correct = safeNumber(m.correct, 0);
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : safeNumber(m.accuracy, 0);

  return {
    ...m,
    total,
    attempts: total,
    correct,
    accuracy,
    avgTime: safeNumber(m.avgTime ?? m.avgResponseTime, 0)
  };
}

function getUserIntervalStats(intervalId) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  return stats.byModule?.intervals?.byInterval?.[intervalId] || { accuracy: 0, attempts: 0 };
}

function getUserTechniqueStats(techniqueKey) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  return stats.byModule?.bieler?.byTechnique?.[techniqueKey] || { accuracy: 0, seen: 0 };
}

function getPieceDifficulty(piece) {
  const technicalTerms = (String(piece || '').match(/concerto|sonata|etude|caprice/gi) || []).length;
  return Math.min(3, technicalTerms + 1);
}

function getDifficultyAlignment(module, piece) {
  const pieceDiff = getPieceDifficulty(piece);
  const userLevel = safeNumber(getModuleStats(module).level, 1);

  const alignment = pieceDiff - userLevel;
  if (alignment > 1) return 'too-difficult';
  if (alignment < -1) return 'too-easy';
  return 'well-aligned';
}

function getRecentImprovementRate(stats, window) {
  const recent = safeArray(stats?.recentHistory).slice(-window);
  if (recent.length < 2) return 0;
  const first = safeNumber(recent[0]?.accuracy, 0);
  const last = safeNumber(recent[recent.length - 1]?.accuracy, 0);
  return last - first;
}

/**
 * Placeholder: if you later compute “practice efficiency” from logs,
 * you can upgrade this without changing callers.
 */
function getPracticeEfficiency(_module) {
  return 1.0;
}

console.log('[Pedagogy Engine] VMQ Pedagogy v3.0.1 loaded ✅');

export default {
  getCurrentProgressionLevel,
  getProgressRoadmap,
  analyzePassage,
  analyzeFeedback,
  generateRepertoireWorkshop,
  getRepertoireForInterval,
  logRepertoireMilestone,
  getQuickRepertoire,
  getPedagogyInsights,
  analyzeFingerboardPerformance,
  getRecommendations
};

// Keep your quick export as-is (with minor guard)
export function getQuickRepertoire(module) {
  const modKey = String(module || 'intervals').toLowerCase();
  const ladders = getProgressionLadders(modKey);
  const currentLevel = getCurrentProgressionLevel(modKey);
  const idx = ladders.findIndex(l => l.name === currentLevel.current);

  const appropriate = ladders
    .filter((_, i) => i <= (idx >= 0 ? idx + 1 : 1))
    .flatMap(level => safeArray(level.repertoire))
    .slice(0, 5);

  return appropriate;
}