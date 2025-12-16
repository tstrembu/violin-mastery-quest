// js/repertoirePlans.js
// ======================================
// VMQ REPERTOIRE PLANS v3.0.5 - Structured Practice
// ML-Adaptive • Bieler Method • Pedagogy-Aware
// ======================================

import { STORAGE_KEYS } from './storage.js';
import { 
  PROGRESSION_LADDERS, 
  PROGRESSION_INDEX,
  DIFFICULTY_BANDS 
} from './constants.js';

// ======================================
// CORE PLANS - By Skill Level
// ======================================

export const REPERTOIRE_PLANS = {
  beginner: {
    id: 'beginner',
    name: '🎵 Beginner Foundation',
    focus: 'Basic technique + note reading',
    description: 'Suzuki Book 1-2 foundations with Bieler hand frame',
    duration: 30,
    bielerFocus: 'First Trained Function',
    suzukiLevel: 'Book 1-2',
    modules: [
      { 
        module: 'intervals', 
        duration: 5, 
        focus: 'P4, P5, P8',
        difficulty: 'easy',
        tags: ['foundation', 'ringing']
      },
      { 
        module: 'keys', 
        duration: 5, 
        focus: 'C, G, F Major',
        difficulty: 'easy',
        tags: ['natural', 'first-sharp', 'first-flat']
      },
      { 
        module: 'rhythm', 
        duration: 5, 
        focus: 'quarter, eighth',
        difficulty: 'easy',
        tags: ['elementary', 'steady-beat']
      },
      { 
        module: 'bieler', 
        duration: 10, 
        focus: 'bow hold, posture',
        difficulty: 'essential',
        tags: ['foundation', 'bowhold']
      },
      { 
        module: 'dashboard', 
        duration: 5, 
        focus: 'review progress',
        difficulty: 'easy',
        tags: ['reflection', 'motivation']
      }
    ]
  },
  
  intermediate: {
    id: 'intermediate',
    name: '🎻 Intermediate Development',
    focus: 'Key expansion + rhythm precision',
    description: 'Suzuki Book 3-4 with Bieler vibrato introduction',
    duration: 45,
    bielerFocus: 'Second Trained Function',
    suzukiLevel: 'Book 3-4',
    modules: [
      { 
        module: 'intervals', 
        duration: 8, 
        focus: 'm3, M3, m6, M6',
        difficulty: 'medium',
        tags: ['minor', 'major', 'double-stop']
      },
      { 
        module: 'keys', 
        duration: 8, 
        focus: 'D, A, Bb, Eb Major',
        difficulty: 'medium',
        tags: ['sharps', 'flats', 'circle-of-fifths']
      },
      { 
        module: 'rhythm', 
        duration: 8, 
        focus: 'dotted, triplets',
        difficulty: 'medium',
        tags: ['intermediate', 'ornaments']
      },
      { 
        module: 'bieler', 
        duration: 12, 
        focus: 'vibrato, bow speed',
        difficulty: 'medium',
        tags: ['expression', 'bowcontrol']
      },
      { 
        module: 'analytics', 
        duration: 9, 
        focus: 'weak spot analysis',
        difficulty: 'easy',
        tags: ['reflection', 'data-driven']
      }
    ]
  },
  
  advanced: {
    id: 'advanced',
    name: '🎼 Advanced Mastery',
    focus: 'Professional technique + artistry',
    description: 'Kreutzer études with advanced Bieler techniques',
    duration: 60,
    bielerFocus: 'Advanced Techniques',
    suzukiLevel: 'Book 5+',
    modules: [
      { 
        module: 'intervals', 
        duration: 10, 
        focus: 'tritone, M7, m7',
        difficulty: 'hard',
        tags: ['advanced', 'jazz', 'leading-tone']
      },
      { 
        module: 'keys', 
        duration: 10, 
        focus: 'B, F#, C#, Ab Major',
        difficulty: 'hard',
        tags: ['extreme-sharps', 'extreme-flats', 'enharmonic']
      },
      { 
        module: 'rhythm', 
        duration: 10, 
        focus: 'syncopation, 16ths',
        difficulty: 'hard',
        tags: ['syncopation', 'polyrhythm', 'baroque']
      },
      { 
        module: 'bieler', 
        duration: 15, 
        focus: 'sound point, spiccato',
        difficulty: 'hard',
        tags: ['soundpoint', 'bowvariation', 'articulation']
      },
      { 
        module: 'repertoire', 
        duration: 15, 
        focus: 'technique refinement',
        difficulty: 'hard',
        tags: ['integration', 'artistry', 'musicality']
      }
    ]
  },
  
  daily: {
    id: 'daily',
    name: '📅 Daily Maintenance',
    focus: 'Spaced repetition + weak areas',
    description: '20-min focused practice targeting gaps',
    duration: 20,
    bielerFocus: 'Daily Fundamentals',
    suzukiLevel: 'All',
    modules: [
      { 
        module: 'intervals', 
        duration: 5, 
        focus: 'review',
        difficulty: 'adaptive',
        tags: ['spaced-repetition', 'weak-spots']
      },
      { 
        module: 'rhythm', 
        duration: 5, 
        focus: 'review',
        difficulty: 'adaptive',
        tags: ['spaced-repetition', 'weak-spots']
      },
      { 
        module: 'bieler', 
        duration: 5, 
        focus: 'daily technique',
        difficulty: 'essential',
        tags: ['compound-interest', 'foundation']
      },
      { 
        module: 'dashboard', 
        duration: 5, 
        focus: 'streaks + XP',
        difficulty: 'easy',
        tags: ['motivation', 'gamification']
      }
    ]
  }
};

// ======================================
// CUSTOM PLAN GENERATION
// ======================================

/**
 * Generate custom practice plan based on available time & level
 * @param {string} level - 'beginner', 'intermediate', 'advanced'
 * @param {number} availableTime - minutes available
 * @returns {object} Scaled plan with time adjustments
 */
export function generatePracticePlan(level = 'beginner', availableTime = 30) {
  const basePlan = REPERTOIRE_PLANS[level] || REPERTOIRE_PLANS.beginner;
  
  // Time scaling: allow 50-200% variation
  const timeRatio = Math.min(2, Math.max(0.5, availableTime / basePlan.duration));
  
  return {
    ...basePlan,
    generatedAt: new Date().toISOString(),
    availableTime,
    actualDuration: availableTime,
    timeRatio: Math.round(timeRatio * 100),
    modules: basePlan.modules.map(mod => ({
      ...mod,
      actualDuration: Math.max(3, Math.round(mod.duration * timeRatio))
    })),
    scalingNote: timeRatio < 0.7 ? 'fast-paced' : timeRatio > 1.3 ? 'leisurely' : 'standard'
  };
}

// ======================================
// SMART DAILY PLAN FROM STATS
// ======================================

/**
 * Generate ML-informed daily plan using weak spots & learning data
 * @param {object} stats - Module stats { byModule: { intervals: {...}, ... } }
 * @param {number} xp - Total XP for level inference
 * @param {object} options - { availableTime, weekday, confusion }
 * @returns {object} Personalized daily plan
 */
export function generateDailyPlan(stats = {}, xp = 0, options = {}) {
  const { 
    availableTime = 25, 
    weekday = new Date().getDay(),
    confusion = {}
  } = options;

  // Infer level from XP
  const levelIndex = xp > 1000 ? 2 : xp > 300 ? 1 : 0;
  const level = ['beginner', 'intermediate', 'advanced'][levelIndex];

  // Identify weak modules (accuracy < 75%)
  const weakModules = [];
  const modulesPerf = [];
  
  Object.entries(stats.byModule || {}).forEach(([module, data]) => {
    const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 100;
    const responseTime = data.avgTime || 2000;
    
    modulesPerf.push({
      module,
      accuracy: Math.round(accuracy),
      attempts: data.total,
      confusion: confusion[module] || {},
      responseTime
    });

    // Weak = accuracy < 75% OR low attempts (less than 5)
    if ((data.total > 5 && accuracy < 75) || (data.total > 0 && data.total < 5)) {
      weakModules.push({
        module,
        accuracy: Math.round(accuracy),
        priority: accuracy < 50 ? 'critical' : 'high'
      });
    }
  });

  // Sort weak modules by priority
  weakModules.sort((a, b) => {
    const priority = { critical: 0, high: 1, medium: 2 };
    return priority[a.priority] - priority[b.priority];
  });

  // Build personalized sections
  const sections = [];
  let timeUsed = 0;
  const totalTime = availableTime;

  // 1. WARMUP (2-3 min always)
  const warmupTime = Math.min(3, totalTime * 0.1);
  sections.push({
    order: 1,
    type: 'warmup',
    module: 'bieler',
    activity: 'Warm-up Fundamentals',
    duration: warmupTime,
    focus: level === 'advanced' ? 'bow-control' : 'hand-frame',
    priority: 'essential'
  });
  timeUsed += warmupTime;

  // 2. PRIMARY WEAKNESS (40% of remaining time)
  if (weakModules.length > 0 && timeUsed < totalTime - 5) {
    const primaryWeak = weakModules[0];
    const weakTime = Math.round((totalTime - timeUsed) * 0.4);
    
    sections.push({
      order: 2,
      type: 'focus-weak',
      module: primaryWeak.module,
      activity: `Accuracy Building: ${primaryWeak.module}`,
      duration: Math.max(5, weakTime),
      focus: `Improve from ${primaryWeak.accuracy}%`,
      priority: primaryWeak.priority,
      strategy: getImprovementStrategy(primaryWeak.module, primaryWeak.confusion)
    });
    timeUsed += Math.max(5, weakTime);
  }

  // 3. SECONDARY WEAKNESS or MAINTENANCE (20-30% of remaining)
  if (timeUsed < totalTime - 8) {
    const secondaryWeak = weakModules[1];
    const secondaryTime = Math.round((totalTime - timeUsed) * 0.3);
    
    sections.push({
      order: 3,
      type: secondaryWeak ? 'focus-secondary' : 'maintenance',
      module: secondaryWeak?.module || modulesPerf.filter(m => m.accuracy > 80)[0]?.module || 'intervals',
      activity: secondaryWeak ? `Build: ${secondaryWeak.module}` : 'Maintenance Review',
      duration: Math.max(4, secondaryTime),
      focus: secondaryWeak ? 'Develop skill' : 'Keep sharp',
      priority: 'medium'
    });
    timeUsed += Math.max(4, secondaryTime);
  }

  // 4. REFLECTION (last 2-3 min always)
  const reflectionTime = Math.max(2, totalTime - timeUsed - 1);
  sections.push({
    order: 4,
    type: 'reflection',
    module: 'dashboard',
    activity: 'Session Reflection',
    duration: reflectionTime,
    focus: 'Progress review + motivation',
    priority: 'essential',
    reflectionPrompt: getReflectionPrompt(weakModules[0] || {}, modulesPerf)
  });

  return {
    date: new Date().toISOString().split('T')[0],
    level,
    totalDuration: availableTime,
    weekday,
    weekdayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday],
    weakModules: weakModules.slice(0, 2),
    sections,
    performanceSummary: {
      strongModules: modulesPerf.filter(m => m.accuracy >= 80).map(m => m.module),
      weakModules: modulesPerf.filter(m => m.accuracy < 75).map(m => m.module),
      avgAccuracy: Math.round(
        modulesPerf.reduce((sum, m) => sum + m.accuracy, 0) / (modulesPerf.length || 1)
      )
    }
  };
}

// ======================================
// INTELLIGENT STRATEGY SELECTION
// ======================================

/**
 * Recommend improvement strategy based on module and confusion patterns
 * @param {string} module - Module with weakness
 * @param {object} confusions - Common confusions for this module
 * @returns {string} Strategy recommendation
 */
function getImprovementStrategy(module, confusions = {}) {
  const strategies = {
    intervals: Object.keys(confusions).length > 0
      ? `Focus on most confused: ${Object.entries(confusions).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed intervals'}`
      : 'Slow, deliberate listening. Sing before playing.',
    keys: 'Work through circle of fifths systematically. Hand frame visualization.',
    rhythm: 'Slow-motion first. Count aloud. Use drone for steady reference.',
    bieler: 'Daily fundamentals. Ševčík Op. 1 for hand position. Five-minute minimum.',
    flashcards: 'Spaced repetition algorithm. Review cards due today first.'
  };
  
  return strategies[module] || 'Focused repetition with deliberate attention to problem areas.';
}

/**
 * Generate reflection prompt tailored to session data
 */
function getReflectionPrompt(primaryWeak = {}, modulesPerf = []) {
  const avg = modulesPerf.length > 0 
    ? modulesPerf.reduce((s, m) => s + m.accuracy, 0) / modulesPerf.length 
    : 0;

  if (avg >= 90) {
    return {
      question: 'Excellent session! What felt most solid today?',
      options: ['Hand frame', 'Intonation', 'Bow control', 'Mental focus'],
      followUp: 'How can you apply this strength to your weak spots tomorrow?'
    };
  }

  if (primaryWeak.priority === 'critical') {
    return {
      question: `${primaryWeak.module} feels challenging. What specifically?`,
      options: ['Can\'t recognize quickly enough', 'Hand position uncomfortable', 'Theory gap', 'Not enough practice'],
      followUp: 'Let\'s focus on just one aspect tomorrow. Small wins compound!'
    };
  }

  return {
    question: 'What went well? What needs more work?',
    options: ['Accuracy', 'Speed', 'Endurance', 'Confidence'],
    followUp: 'Every session builds your skill foundation. Great work!'
  };
}

// ======================================
// PLAN RECOMMENDATION LOGIC
// ======================================

/**
 * Recommend plan based on time available
 * @param {number} availableTime - Minutes available
 * @returns {string} Plan ID
 */
export function getRecommendedPlan(availableTime) {
  if (availableTime <= 20) return 'daily';
  if (availableTime <= 35) return 'beginner';
  if (availableTime <= 50) return 'intermediate';
  return 'advanced';
}

/**
 * Get user's personalized plan (for PracticePlanner component)
 * @param {object} profile - User profile with level
 * @param {object} stats - Performance stats
 * @param {number} availableTime - Time available now
 * @returns {object} Generated plan
 */
export function getUserPlan(profile, stats, availableTime) {
  const level = profile?.level || 'beginner';
  return generatePracticePlan(level, availableTime);
}

// ======================================
// WEEKLY STRATEGIC PLANNING
// ======================================

/**
 * Generate 7-day strategic preview with progressive difficulty
 * @param {object} stats - Weekly performance data
 * @param {number} xp - User XP
 * @returns {array} Day-by-day plans
 */
export function generateWeekPreview(stats = {}, xp = 0) {
  const levelIndex = xp > 1000 ? 2 : xp > 300 ? 1 : 0;
  const level = ['beginner', 'intermediate', 'advanced'][levelIndex];

  // Identify strengths & weaknesses
  const strength = Object.entries(stats.byModule || {})
    .map(([m, d]) => ({
      module: m,
      accuracy: (d.correct / (d.total || 1)) * 100
    }))
    .sort((a, b) => b.accuracy - a.accuracy)[0]?.module || 'intervals';

  const weakness = Object.entries(stats.byModule || {})
    .map(([m, d]) => ({
      module: m,
      accuracy: (d.correct / (d.total || 1)) * 100
    }))
    .sort((a, b) => a.accuracy - b.accuracy)[0]?.module || 'keys';

  return [
    { day: 'Mon', theme: 'Foundation', primary: 'bieler', secondary: weakness, duration: 25 },
    { day: 'Tue', theme: 'Speed Building', primary: weakness, secondary: 'rhythm', duration: 28 },
    { day: 'Wed', theme: 'Accuracy Refinement', primary: strength, secondary: 'flashcards', duration: 30 },
    { day: 'Thu', theme: 'Integration', primary: 'rhythm', secondary: weakness, duration: 32 },
    { day: 'Fri', theme: 'Technique Deep Dive', primary: 'bieler', secondary: weakness, duration: 25 },
    { day: 'Sat', theme: 'Challenge Day', primary: strength, secondary: weakness, duration: 35 },
    { day: 'Sun', theme: 'Rest & Review', primary: 'dashboard', secondary: 'flashcards', duration: 20 }
  ];
}

// ======================================
// PEDAGOGY-AWARE PLAN SEQUENCING
// ======================================

/**
 * Reorder plan sections based on Bieler pedagogy & spaced repetition
 * @param {object} plan - Generated plan
 * @param {object} smData - Spaced repetition data
 * @returns {object} Resequenced plan
 */
export function optimizePlanSequence(plan, smData = {}) {
  if (!plan.sections || plan.sections.length === 0) return plan;

  // SM-2 cards due today get priority
  const cardsDue = (smData.due || []).length;

  // Reorder: Warmup → SM-2 Review (if due) → Weak → Maintenance → Reflection
  const warmup = plan.sections.find(s => s.type === 'warmup') || null;
  const reflection = plan.sections.find(s => s.type === 'reflection') || null;
  const others = plan.sections.filter(s => s.type !== 'warmup' && s.type !== 'reflection');

  const reordered = [];
  if (warmup) reordered.push(warmup);
  
  // Prioritize SM-2 review if many cards are due
  const smReview = others.find(s => s.module === 'flashcards');
  if (cardsDue > 5 && smReview) {
    reordered.push(smReview);
    others.splice(others.indexOf(smReview), 1);
  }

  reordered.push(...others);
  if (reflection) reordered.push(reflection);

  return {
    ...plan,
    sections: reordered.map((s, i) => ({ ...s, order: i + 1 }))
  };
}

// ======================================
// EXPORTS
// ======================================

export default REPERTOIRE_PLANS;
