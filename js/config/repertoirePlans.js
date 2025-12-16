// js/config/repertoirePlans.js
// ======================================
// VMQ REPERTOIRE PLANS v3.1.0 - Structured Practice
// ML-Adaptive • Bieler Method • Pedagogy-Aware
//
// Drop-in goals:
// - Keep existing exported names + plan shapes stable
// - Fix incorrect import path for STORAGE_KEYS (belongs to ../config/storage.js)
// - Avoid hard dependency on optional constants (PROGRESSION_* / DIFFICULTY_BANDS)
// - Make level handling tolerant (string level OR numeric level)
// - Make time math robust + integer minutes
// - Keep “sections” outputs compatible with PracticePlanner-style components
// ======================================

import { STORAGE_KEYS, loadJSON } from './storage.js';
import {
  PROGRESSION_LADDERS,
  PROGRESSION_INDEX,
  DIFFICULTY_BANDS,
} from './constants.js';

// --------------------------------------
// Small safety helpers (local)
// --------------------------------------
function _num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function _int(x, fallback = 0) {
  return Math.floor(_num(x, fallback));
}
function _clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function _arr(x) {
  return Array.isArray(x) ? x : [];
}
function _obj(x) {
  return x && typeof x === 'object' ? x : {};
}
function _todayISO() {
  return new Date().toISOString().split('T')[0];
}
function _weekdayIdx(d = new Date()) {
  return d.getDay();
}
function _weekdayName(idx) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][_clamp(_int(idx, 0), 0, 6)];
}
function _ensureMinMinutes(n, min = 1) {
  return Math.max(min, _int(n, min));
}
function _sumMinutes(items, key = 'actualDuration') {
  return _arr(items).reduce((s, it) => s + _num(it?.[key], 0), 0);
}
function _normalizeLevel(level) {
  // Accept: 'beginner'|'intermediate'|'advanced' OR numeric 1..N OR any string.
  if (typeof level === 'string' && level.trim()) {
    const v = level.trim().toLowerCase();
    if (v.startsWith('adv')) return 'advanced';
    if (v.startsWith('int')) return 'intermediate';
    if (v.startsWith('beg')) return 'beginner';
    if (v === 'daily') return 'daily';
    // fallback: if unknown string, default to beginner (stable behavior)
    return 'beginner';
  }
  const n = _int(level, 1);
  if (n >= 3) return 'advanced';
  if (n === 2) return 'intermediate';
  return 'beginner';
}
function _inferLevelFromXP(xp) {
  const x = _num(xp, 0);
  return x > 1000 ? 'advanced' : x > 300 ? 'intermediate' : 'beginner';
}

// --------------------------------------
// CORE PLANS - By Skill Level
// (Keep stable IDs + module keys)
// --------------------------------------
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
        tags: ['foundation', 'ringing'],
      },
      {
        module: 'keys',
        duration: 5,
        focus: 'C, G, F Major',
        difficulty: 'easy',
        tags: ['natural', 'first-sharp', 'first-flat'],
      },
      {
        module: 'rhythm',
        duration: 5,
        focus: 'quarter, eighth',
        difficulty: 'easy',
        tags: ['elementary', 'steady-beat'],
      },
      {
        module: 'bieler',
        duration: 10,
        focus: 'bow hold, posture',
        difficulty: 'essential',
        tags: ['foundation', 'bowhold'],
      },
      {
        module: 'dashboard',
        duration: 5,
        focus: 'review progress',
        difficulty: 'easy',
        tags: ['reflection', 'motivation'],
      },
    ],
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
        tags: ['minor', 'major', 'double-stop'],
      },
      {
        module: 'keys',
        duration: 8,
        focus: 'D, A, Bb, Eb Major',
        difficulty: 'medium',
        tags: ['sharps', 'flats', 'circle-of-fifths'],
      },
      {
        module: 'rhythm',
        duration: 8,
        focus: 'dotted, triplets',
        difficulty: 'medium',
        tags: ['intermediate', 'ornaments'],
      },
      {
        module: 'bieler',
        duration: 12,
        focus: 'vibrato, bow speed',
        difficulty: 'medium',
        tags: ['expression', 'bowcontrol'],
      },
      {
        module: 'analytics',
        duration: 9,
        focus: 'weak spot analysis',
        difficulty: 'easy',
        tags: ['reflection', 'data-driven'],
      },
    ],
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
        tags: ['advanced', 'jazz', 'leading-tone'],
      },
      {
        module: 'keys',
        duration: 10,
        focus: 'B, F#, C#, Ab Major',
        difficulty: 'hard',
        tags: ['extreme-sharps', 'extreme-flats', 'enharmonic'],
      },
      {
        module: 'rhythm',
        duration: 10,
        focus: 'syncopation, 16ths',
        difficulty: 'hard',
        tags: ['syncopation', 'polyrhythm', 'baroque'],
      },
      {
        module: 'bieler',
        duration: 15,
        focus: 'sound point, spiccato',
        difficulty: 'hard',
        tags: ['soundpoint', 'bowvariation', 'articulation'],
      },
      {
        module: 'repertoire',
        duration: 15,
        focus: 'technique refinement',
        difficulty: 'hard',
        tags: ['integration', 'artistry', 'musicality'],
      },
    ],
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
        tags: ['spaced-repetition', 'weak-spots'],
      },
      {
        module: 'rhythm',
        duration: 5,
        focus: 'review',
        difficulty: 'adaptive',
        tags: ['spaced-repetition', 'weak-spots'],
      },
      {
        module: 'bieler',
        duration: 5,
        focus: 'daily technique',
        difficulty: 'essential',
        tags: ['compound-interest', 'foundation'],
      },
      {
        module: 'dashboard',
        duration: 5,
        focus: 'streaks + XP',
        difficulty: 'easy',
        tags: ['motivation', 'gamification'],
      },
    ],
  },
};

// --------------------------------------
// CUSTOM PLAN GENERATION
// --------------------------------------
/**
 * Generate custom practice plan based on available time & level
 * @param {string|number} level - 'beginner'|'intermediate'|'advanced'|'daily' OR numeric
 * @param {number} availableTime - minutes available
 * @returns {object} Scaled plan with time adjustments
 */
export function generatePracticePlan(level = 'beginner', availableTime = 30) {
  const lvl = _normalizeLevel(level);
  const basePlan = REPERTOIRE_PLANS[lvl] || REPERTOIRE_PLANS.beginner;

  const avail = _ensureMinMinutes(availableTime, 5);

  // Allow 50–200% variation vs base plan duration
  const baseDur = _ensureMinMinutes(basePlan.duration, 1);
  const timeRatio = _clamp(avail / baseDur, 0.5, 2);

  // Scale each module, keep each at least 3 minutes
  const scaledModules = basePlan.modules.map((mod) => ({
    ...mod,
    actualDuration: Math.max(3, Math.round(_ensureMinMinutes(mod.duration, 1) * timeRatio)),
  }));

  // Normalize to hit available time (fix rounding drift)
  let drift = avail - _sumMinutes(scaledModules, 'actualDuration');

  // Adjust by distributing +/-1 minute across modules (avoid dropping under 3)
  if (drift !== 0 && scaledModules.length) {
    const direction = drift > 0 ? 1 : -1;
    drift = Math.abs(drift);

    // Prefer adjusting modules that are not "essential" first (but keep behavior safe)
    const indices = scaledModules
      .map((m, i) => ({ i, w: m.difficulty === 'essential' ? 0 : 1 }))
      .sort((a, b) => b.w - a.w)
      .map((x) => x.i);

    let cursor = 0;
    while (drift > 0 && cursor < indices.length * 10) {
      const idx = indices[cursor % indices.length];
      const m = scaledModules[idx];
      const next = m.actualDuration + direction;
      if (direction > 0 || next >= 3) {
        m.actualDuration = next;
        drift -= 1;
      }
      cursor += 1;
    }
  }

  return {
    ...basePlan,
    generatedAt: new Date().toISOString(),
    availableTime: avail,
    actualDuration: avail,
    timeRatioPct: Math.round(timeRatio * 100),
    modules: scaledModules,
    scalingNote: timeRatio < 0.7 ? 'fast-paced' : timeRatio > 1.3 ? 'leisurely' : 'standard',
  };
}

// --------------------------------------
// SMART DAILY PLAN FROM STATS
// --------------------------------------
/**
 * Generate ML-informed daily plan using weak spots & learning data
 * @param {object} stats - Module stats { byModule: { intervals: {...}, ... } }
 * @param {number} xp - Total XP for level inference
 * @param {object} options - { availableTime, weekday, confusion }
 * @returns {object} Personalized daily plan
 */
export function generateDailyPlan(stats = {}, xp = 0, options = {}) {
  const opt = _obj(options);
  const availableTime = _ensureMinMinutes(opt.availableTime ?? 25, 10);
  const weekday = _int(opt.weekday ?? _weekdayIdx(), _weekdayIdx());
  const confusion = _obj(opt.confusion);

  const byModule = _obj(stats.byModule);
  const level = _inferLevelFromXP(xp);

  // Build perf list
  const modulesPerf = Object.entries(byModule).map(([module, dataRaw]) => {
    const d = _obj(dataRaw);
    const total = Math.max(0, _int(d.total, 0));
    const correct = Math.max(0, _int(d.correct, 0));
    const accuracy = total > 0 ? (correct / total) * 100 : 100;
    const responseTime = _num(d.avgTime ?? d.avgResponseTime ?? 2000, 2000);
    return {
      module,
      accuracy: Math.round(accuracy),
      attempts: total,
      confusion: _obj(confusion[module]),
      responseTime,
    };
  });

  // Identify weak modules:
  // - accuracy < 75% when enough attempts OR
  // - low attempts (1..4) to build base
  const weakModules = modulesPerf
    .filter((m) => (m.attempts >= 5 && m.accuracy < 75) || (m.attempts > 0 && m.attempts < 5))
    .map((m) => ({
      module: m.module,
      accuracy: m.accuracy,
      priority: m.accuracy < 50 ? 'critical' : 'high',
      confusion: m.confusion,
    }))
    .sort((a, b) => {
      const pr = { critical: 0, high: 1, medium: 2 };
      const da = pr[a.priority] ?? 9;
      const db = pr[b.priority] ?? 9;
      if (da !== db) return da - db;
      return a.accuracy - b.accuracy; // lower accuracy first
    });

  // Helper choices if stats are empty
  const fallbackStrong = modulesPerf.find((m) => m.accuracy >= 80)?.module || 'intervals';
  const fallbackWeak = weakModules[0]?.module || 'keys';

  // Build personalized sections
  const sections = [];
  let timeUsed = 0;
  const totalTime = availableTime;

  // 1) Warmup (always 2–3 min)
  const warmupTime = _clamp(Math.round(totalTime * 0.1), 2, 3);
  sections.push({
    order: 1,
    type: 'warmup',
    module: 'bieler',
    activity: 'Warm-up Fundamentals',
    duration: warmupTime,
    focus: level === 'advanced' ? 'bow-control' : 'hand-frame',
    priority: 'essential',
  });
  timeUsed += warmupTime;

  // 2) Primary weakness (≈40% of remaining)
  if (weakModules.length > 0 && timeUsed < totalTime - 6) {
    const primaryWeak = weakModules[0];
    const remaining = totalTime - timeUsed;
    const weakTime = Math.max(5, Math.round(remaining * 0.4));

    sections.push({
      order: 2,
      type: 'focus-weak',
      module: primaryWeak.module,
      activity: `Accuracy Building: ${primaryWeak.module}`,
      duration: weakTime,
      focus: `Improve from ${primaryWeak.accuracy}%`,
      priority: primaryWeak.priority,
      strategy: getImprovementStrategy(primaryWeak.module, primaryWeak.confusion),
    });
    timeUsed += weakTime;
  }

  // 3) Secondary weakness OR maintenance (≈30% of remaining)
  if (timeUsed < totalTime - 5) {
    const secondaryWeak = weakModules[1];
    const remaining = totalTime - timeUsed;
    const secondaryTime = Math.max(4, Math.round(remaining * 0.3));

    sections.push({
      order: 3,
      type: secondaryWeak ? 'focus-secondary' : 'maintenance',
      module: secondaryWeak?.module || fallbackStrong || 'intervals',
      activity: secondaryWeak ? `Build: ${secondaryWeak.module}` : 'Maintenance Review',
      duration: secondaryTime,
      focus: secondaryWeak ? 'Develop skill' : 'Keep sharp',
      priority: 'medium',
      strategy: secondaryWeak ? getImprovementStrategy(secondaryWeak.module, secondaryWeak.confusion) : undefined,
    });
    timeUsed += secondaryTime;
  }

  // 4) Reflection (always last 2–3 min; fill remainder safely)
  const remaining = totalTime - timeUsed;
  const reflectionTime = _clamp(Math.max(2, remaining), 2, 4);

  sections.push({
    order: 4,
    type: 'reflection',
    module: 'dashboard',
    activity: 'Session Reflection',
    duration: reflectionTime,
    focus: 'Progress review + motivation',
    priority: 'essential',
    reflectionPrompt: getReflectionPrompt(weakModules[0] || {}, modulesPerf),
  });

  // Fix any time drift by adjusting reflection duration
  const sumDur = sections.reduce((s, x) => s + _num(x.duration, 0), 0);
  if (sumDur !== totalTime) {
    const delta = totalTime - sumDur;
    sections[sections.length - 1].duration = Math.max(
      2,
      _int(sections[sections.length - 1].duration + delta, 2)
    );
  }

  return {
    date: _todayISO(),
    level,
    totalDuration: totalTime,
    weekday,
    weekdayName: _weekdayName(weekday),
    weakModules: weakModules.slice(0, 2).map(({ confusion: _c, ...rest }) => rest),
    sections: sections.map((s, i) => ({ ...s, order: i + 1 })),
    performanceSummary: {
      strongModules: modulesPerf.filter((m) => m.accuracy >= 80).map((m) => m.module),
      weakModules: modulesPerf.filter((m) => m.accuracy < 75).map((m) => m.module),
      avgAccuracy: Math.round(
        modulesPerf.reduce((sum, m) => sum + _num(m.accuracy, 0), 0) / (modulesPerf.length || 1)
      ),
    },
  };
}

// --------------------------------------
// INTELLIGENT STRATEGY SELECTION
// --------------------------------------
/**
 * Recommend improvement strategy based on module and confusion patterns
 * @param {string} module - Module with weakness
 * @param {object} confusions - Common confusions for this module
 * @returns {string} Strategy recommendation
 */
function getImprovementStrategy(module, confusions = {}) {
  const c = _obj(confusions);

  const topConfusion = (() => {
    const entries = Object.entries(c).filter(([, v]) => _num(v, 0) > 0);
    if (!entries.length) return null;
    entries.sort((a, b) => _num(b[1], 0) - _num(a[1], 0));
    return entries[0]?.[0] || null;
  })();

  const strategies = {
    intervals: topConfusion
      ? `Focus on the most confused interval: ${topConfusion}. Slow listening → sing → play.`
      : 'Slow, deliberate listening. Sing before playing.',
    keys: 'Work through circle of fifths systematically. Map hand frames before speed.',
    rhythm: 'Slow-motion first. Count aloud. Then add metronome (small tempo steps).',
    bieler: 'Daily fundamentals. Prioritize frame + bow path. Five-minute minimum.',
    flashcards: 'Spaced repetition: do “due today” first, then short mixed review.',
    repertoire: 'Isolate the hardest 2 measures → rhythms → intonation → bowing → reintegrate.',
    analytics: 'Review weak spots, then pick one target for tomorrow.',
    dashboard: 'Log wins + choose one micro-goal for the next session.',
  };

  return strategies[module] || 'Focused repetition with deliberate attention to problem areas.';
}

/**
 * Generate reflection prompt tailored to session data
 */
function getReflectionPrompt(primaryWeak = {}, modulesPerf = []) {
  const pw = _obj(primaryWeak);
  const perf = _arr(modulesPerf);

  const avg = perf.length
    ? perf.reduce((s, m) => s + _num(m?.accuracy, 0), 0) / perf.length
    : 0;

  if (avg >= 90) {
    return {
      question: 'Excellent session! What felt most solid today?',
      options: ['Hand frame', 'Intonation', 'Bow control', 'Mental focus'],
      followUp: 'How can you apply this strength to your weak spots tomorrow?',
    };
  }

  if (pw.priority === 'critical') {
    return {
      question: `${pw.module || 'This skill'} feels challenging. What specifically?`,
      options: [
        "Can't recognize quickly enough",
        'Hand position uncomfortable',
        'Theory gap',
        'Not enough practice',
      ],
      followUp: "Tomorrow: pick ONE lever (slowdown, sing, isolate, or repeat). Small wins compound.",
    };
  }

  return {
    question: 'What went well? What needs more work?',
    options: ['Accuracy', 'Speed', 'Endurance', 'Confidence'],
    followUp: 'Every session builds your skill foundation. Great work!',
  };
}

// --------------------------------------
// PLAN RECOMMENDATION LOGIC
// --------------------------------------
/**
 * Recommend plan based on time available
 * @param {number} availableTime - Minutes available
 * @returns {string} Plan ID
 */
export function getRecommendedPlan(availableTime) {
  const t = _ensureMinMinutes(availableTime, 1);
  if (t <= 20) return 'daily';
  if (t <= 35) return 'beginner';
  if (t <= 50) return 'intermediate';
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
  const p = _obj(profile);

  // If profile.level is numeric or string, normalize
  const lvl = _normalizeLevel(p.level ?? 'beginner');

  // If caller provides stats + wants smarter daily, they can call generateDailyPlan directly.
  // Keep this function stable: it returns a scaled base plan.
  return generatePracticePlan(lvl, availableTime);
}

// --------------------------------------
// WEEKLY STRATEGIC PLANNING
// --------------------------------------
/**
 * Generate 7-day strategic preview with progressive difficulty
 * @param {object} stats - Weekly performance data
 * @param {number} xp - User XP
 * @returns {array} Day-by-day plans (preview objects)
 */
export function generateWeekPreview(stats = {}, xp = 0) {
  const byModule = _obj(stats.byModule);
  const level = _inferLevelFromXP(xp);

  const ranked = Object.entries(byModule)
    .map(([m, dRaw]) => {
      const d = _obj(dRaw);
      const total = Math.max(0, _int(d.total, 0));
      const correct = Math.max(0, _int(d.correct, 0));
      const acc = total > 0 ? (correct / total) * 100 : 0;
      return { module: m, accuracy: acc };
    })
    .sort((a, b) => b.accuracy - a.accuracy);

  const strength = ranked[0]?.module || 'intervals';
  const weakness = ranked.slice().sort((a, b) => a.accuracy - b.accuracy)[0]?.module || 'keys';

  // Keep stable preview shape (day/theme/primary/secondary/duration)
  const base = level === 'advanced' ? 30 : level === 'intermediate' ? 27 : 25;

  return [
    { day: 'Mon', theme: 'Foundation', primary: 'bieler', secondary: weakness, duration: base },
    { day: 'Tue', theme: 'Speed Building', primary: weakness, secondary: 'rhythm', duration: base + 3 },
    { day: 'Wed', theme: 'Accuracy Refinement', primary: strength, secondary: 'flashcards', duration: base + 5 },
    { day: 'Thu', theme: 'Integration', primary: 'rhythm', secondary: weakness, duration: base + 7 },
    { day: 'Fri', theme: 'Technique Deep Dive', primary: 'bieler', secondary: weakness, duration: base },
    { day: 'Sat', theme: 'Challenge Day', primary: strength, secondary: weakness, duration: base + 10 },
    { day: 'Sun', theme: 'Rest & Review', primary: 'dashboard', secondary: 'flashcards', duration: base - 5 },
  ];
}

// --------------------------------------
// PEDAGOGY-AWARE PLAN SEQUENCING
// --------------------------------------
/**
 * Reorder plan sections based on Bieler pedagogy & spaced repetition
 * @param {object} plan - Generated plan { sections: [...] }
 * @param {object} smData - Spaced repetition data (expects optional smData.due array)
 * @returns {object} Resequenced plan
 */
export function optimizePlanSequence(plan, smData = {}) {
  const p = _obj(plan);
  const sections = _arr(p.sections);

  if (!sections.length) return p;

  const sm = _obj(smData);
  const dueList = _arr(sm.due);
  const cardsDue = dueList.length;

  const warmup = sections.find((s) => s?.type === 'warmup') || null;
  const reflection = sections.find((s) => s?.type === 'reflection') || null;

  const others = sections.filter((s) => s?.type !== 'warmup' && s?.type !== 'reflection');

  const reordered = [];
  if (warmup) reordered.push(warmup);

  // If many cards due, prioritize flashcards early if present
  const smReview = others.find((s) => s?.module === 'flashcards') || null;
  if (cardsDue > 5 && smReview) {
    reordered.push(smReview);
    const idx = others.indexOf(smReview);
    if (idx >= 0) others.splice(idx, 1);
  }

  reordered.push(...others);
  if (reflection) reordered.push(reflection);

  return {
    ...p,
    sections: reordered.map((s, i) => ({ ...s, order: i + 1 })),
  };
}

// --------------------------------------
// OPTIONAL: USER PLAN PERSISTENCE HELPERS
// (Safe: only used if a component imports them)
// --------------------------------------
/**
 * Save a user's selected plan id (or custom plan) for later retrieval.
 */
export function savePreferredPlan(preferred) {
  try {
    if (!STORAGE_KEYS?.PREFERRED_PLAN) return false;
    // storage.js may expose saveJSON; if not, callers can ignore this helper
    // We keep it minimal here: attempt localStorage directly as a safe fallback.
    const key = STORAGE_KEYS.PREFERRED_PLAN;
    const val = JSON.stringify(preferred ?? null);
    localStorage.setItem(key, val);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a previously preferred plan id.
 */
export function loadPreferredPlan(fallback = 'daily') {
  try {
    if (!STORAGE_KEYS?.PREFERRED_PLAN) return fallback;
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERRED_PLAN);
    const val = raw ? JSON.parse(raw) : null;
    return val || fallback;
  } catch {
    return fallback;
  }
}

// --------------------------------------
// EXPORTS
// --------------------------------------
export default REPERTOIRE_PLANS;