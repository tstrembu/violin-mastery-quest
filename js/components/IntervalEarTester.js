// js/components/IntervalEarTester.js
// ======================================
// INTERVAL EAR TESTER v2.1.1 (Drop-in, Hardened)
// Audio-First + SM-2 + Adaptive Difficulty + Confusion Detection + Mastery + Full Engine Integration
//
// Key hardening changes vs your draft:
// - ✅ NO named imports (prevents “module failed to load” when an export name drifts)
// - ✅ Fixes illegal const reassignment bug in nextQuestion() base note selection
// - ✅ Confusion model fixed: supports pairwise + per-interval weighting (backward compatible with old storage)
// - ✅ Keyboard answers map to current answerOptions (not random pool)
// - ✅ Adaptation uses “next totals” (no off-by-one / stale state)
// - ✅ Due-items weighting computed once per pool build
// - ✅ Safe fallbacks if engines/helpers are missing (won’t crash; degrades gracefully)
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef, useMemo } = React;

// --- SAFE IMPORTS (namespace) to prevent ESM named-export failures ---
import * as ConstantsMod from '../config/constants.js';
import * as HelpersMod from '../utils/helpers.js';
import * as DifficultyMod from '../engines/difficultyAdapter.js';
import * as SRSMod from '../engines/spacedRepetition.js';
import * as GameMod from '../engines/gamification.js';
import * as KeyboardMod from '../utils/keyboard.js';
import * as SessionTrackerMod from '../engines/sessionTracker.js';
import * as CoachMod from '../engines/coachEngine.js';
import * as StorageMod from '../config/storage.js';

// -------------------------
// FALLBACKS (no-throw)
// -------------------------
const INTERVALS =
  ConstantsMod.INTERVALS ||
  (ConstantsMod.default && ConstantsMod.default.INTERVALS) ||
  [
    // Minimal fallback set (won’t match your full set, but prevents crashes if constants mis-export)
    { id: 'unison', name: 'Unison', semitones: 0, quality: 'perfect', difficulty: 'easy', example: 'Same note' },
    { id: 'm2', name: 'm2', semitones: 1, quality: 'minor', difficulty: 'easy', example: 'Jaws' },
    { id: 'M2', name: 'M2', semitones: 2, quality: 'major', difficulty: 'easy', example: 'Happy Birthday' },
    { id: 'm3', name: 'm3', semitones: 3, quality: 'minor', difficulty: 'easy', example: 'Greensleeves' },
    { id: 'M3', name: 'M3', semitones: 4, quality: 'major', difficulty: 'easy', example: 'When the Saints' },
    { id: 'P4', name: 'P4', semitones: 5, quality: 'perfect', difficulty: 'easy', example: 'Here Comes the Bride' },
    { id: 'A4', name: 'Tritone', semitones: 6, quality: 'aug', difficulty: 'hard', example: 'Simpsons' },
    { id: 'P5', name: 'P5', semitones: 7, quality: 'perfect', difficulty: 'easy', example: 'Star Wars' },
    { id: 'm6', name: 'm6', semitones: 8, quality: 'minor', difficulty: 'medium', example: 'The Entertainer' },
    { id: 'M6', name: 'M6', semitones: 9, quality: 'major', difficulty: 'medium', example: 'My Bonnie' },
    { id: 'm7', name: 'm7', semitones: 10, quality: 'minor', difficulty: 'hard', example: 'Somewhere' },
    { id: 'M7', name: 'M7', semitones: 11, quality: 'major', difficulty: 'hard', example: 'Take On Me' },
    { id: 'P8', name: 'Octave', semitones: 12, quality: 'perfect', difficulty: 'easy', example: 'Somewhere Over the Rainbow' },
  ];

const XP_VALUES =
  ConstantsMod.XP_VALUES ||
  (ConstantsMod.default && ConstantsMod.default.XP_VALUES) ||
  { CORRECT_ANSWER: 10 };

// Helpers
const MUSIC =
  HelpersMod.MUSIC ||
  (HelpersMod.default && HelpersMod.default.MUSIC) ||
  {
    midiToFreq: (m) => 440 * Math.pow(2, (m - 69) / 12),
    midiToNote: (m) => `MIDI ${m}`,
  };

const clamp = HelpersMod.clamp || (HelpersMod.default && HelpersMod.default.clamp) || ((v, lo, hi) => Math.max(lo, Math.min(hi, v)));
const shuffle = HelpersMod.shuffle || (HelpersMod.default && HelpersMod.default.shuffle) || ((arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
});
const accuracy = HelpersMod.accuracy || (HelpersMod.default && HelpersMod.default.accuracy) || ((correct, total) => (total ? Math.round((correct / total) * 100) : 0));
const mean = HelpersMod.mean || (HelpersMod.default && HelpersMod.default.mean) || ((xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0));
const analyzeLearningCurve =
  HelpersMod.analyzeLearningCurve ||
  (HelpersMod.default && HelpersMod.default.analyzeLearningCurve) ||
  ((points) => {
    // Very light fallback: detects improving trend over last N
    if (!points || points.length < 5) return null;
    const last = points.slice(-8);
    const firstHalf = last.slice(0, Math.floor(last.length / 2));
    const secondHalf = last.slice(Math.floor(last.length / 2));
    const a1 = mean(firstHalf.map(p => p.accuracy));
    const a2 = mean(secondHalf.map(p => p.accuracy));
    const velocity = a2 - a1;
    const stage = a2 >= 90 ? 'Consolidating' : a2 >= 75 ? 'Stabilizing' : 'Acquiring';
    return { stage, velocity, prediction: null };
  });

// Engines (safe)
const getDifficulty = DifficultyMod.getDifficulty || (DifficultyMod.default && DifficultyMod.default.getDifficulty) || (async () => ({ level: 1, config: {} }));
const recordPerformance = DifficultyMod.recordPerformance || (DifficultyMod.default && DifficultyMod.default.recordPerformance) || (() => {});
const adjustDifficulty = DifficultyMod.adjustDifficulty || (DifficultyMod.default && DifficultyMod.default.adjustDifficulty) || (async () => {});

const updateItem = SRSMod.updateItem || (SRSMod.default && SRSMod.default.updateItem) || (async () => {});
const getDueItems = SRSMod.getDueItems || (SRSMod.default && SRSMod.default.getDueItems) || (() => []);
const ITEM_TYPES = SRSMod.ITEM_TYPES || (SRSMod.default && SRSMod.default.ITEM_TYPES) || { INTERVAL: 'INTERVAL' };

const addXP = GameMod.addXP || (GameMod.default && GameMod.default.addXP) || (() => {});
const recordAnswer = GameMod.recordAnswer || (GameMod.default && GameMod.default.recordAnswer) || (() => {});
const updateStreak = GameMod.updateStreak || (GameMod.default && GameMod.default.updateStreak) || (() => {});

const keyboard = KeyboardMod.keyboard || (KeyboardMod.default && KeyboardMod.default.keyboard) || {
  register: () => {},
  unregister: () => {},
};
const a11y = KeyboardMod.a11y || (KeyboardMod.default && KeyboardMod.default.a11y) || { announce: () => {} };

const sessionTracker = SessionTrackerMod.sessionTracker || (SessionTrackerMod.default && SessionTrackerMod.default.sessionTracker) || { trackActivity: () => {} };
const getCoachInsights = CoachMod.getCoachInsights || (CoachMod.default && CoachMod.default.getCoachInsights) || (() => null);

// Storage (safe)
const loadJSON = StorageMod.loadJSON || (StorageMod.default && StorageMod.default.loadJSON) || ((k, fb) => {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch { return fb; }
});
const saveJSON = StorageMod.saveJSON || (StorageMod.default && StorageMod.default.saveJSON) || ((k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} });
const STORAGE_KEYS = StorageMod.STORAGE_KEYS || (StorageMod.default && StorageMod.default.STORAGE_KEYS) || {};

// Local keys if not defined in config/storage.js
const KEY_MASTERY = STORAGE_KEYS.MASTERY || 'vmq_mastery';
const KEY_CONFUSION = STORAGE_KEYS.CONFUSION_PATTERNS || 'vmq_confusion_patterns';

// -------------------------
// CONFIG
// -------------------------
const CONFIG = {
  MIN_QUESTIONS_FOR_ADAPT: 5,
  AUTO_ADVANCE_DELAY: 1800,
  AUTO_ADVANCE_DELAY_WRONG: 2500,
  MAX_PLAYS_BEFORE_PENALTY: 3,
  SPEED_BONUS_MS: 5000,
  PERFECT_STREAK_THRESHOLD: 10,
  CONFUSION_THRESHOLD: 3,
  MASTERY_THRESHOLD: 90,
  VIOLIN_RANGE_LOW: 55,  // G3
  VIOLIN_RANGE_HIGH: 88, // E5
};

// -------------------------
// STORAGE HELPERS (Backward compatible)
// -------------------------
function loadMasteredIntervals() {
  const data = loadJSON(KEY_MASTERY, {});
  // supports: { intervalEar: [...] } OR older { intervalEar: {...} } etc
  const arr = data.intervalEar;
  return Array.isArray(arr) ? arr : [];
}
function saveMasteredIntervals(intervals) {
  const data = loadJSON(KEY_MASTERY, {});
  data.intervalEar = intervals;
  saveJSON(KEY_MASTERY, data);
}

// Confusion storage supports:
// 1) Old flat map: { intervalEar: { "P4_M3": 2, "M2_m2": 1 } }
// 2) New shape: { intervalEar: { pairs: {...}, byCorrect: {...} } }
function loadConfusionState() {
  const data = loadJSON(KEY_CONFUSION, {});
  const raw = data.intervalEar || {};
  if (raw && (raw.pairs || raw.byCorrect)) {
    return {
      pairs: raw.pairs || {},
      byCorrect: raw.byCorrect || {},
    };
  }
  // old flat → derive
  const pairs = { ...(raw || {}) };
  const byCorrect = {};
  Object.keys(pairs).forEach((k) => {
    if (!k.includes('_')) return;
    const [correctId] = k.split('_');
    byCorrect[correctId] = (byCorrect[correctId] || 0) + (pairs[k] || 0);
  });
  return { pairs, byCorrect };
}
function saveConfusionState(state) {
  const data = loadJSON(KEY_CONFUSION, {});
  data.intervalEar = {
    pairs: state.pairs || {},
    byCorrect: state.byCorrect || {},
  };
  saveJSON(KEY_CONFUSION, data);
}

// -------------------------
// MAIN COMPONENT
// -------------------------
export default function IntervalEarTester({
  onBack,
  showToast,
  refreshStats,
  audioEngine,
}) {
  // ----- Core state
  const [mode, setMode] = useState('melodic'); // melodic, harmonic, ascending, descending
  const [currentInterval, setCurrentInterval] = useState(null);
  const [baseMidi, setBaseMidi] = useState(60);
  const [userAnswer, setUserAnswer] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [usedHint, setUsedHint] = useState(false);

  // ----- Performance tracking
  const [stats, setStats] = useState({
    correct: 0,
    total: 0,
    streak: 0,
    longestStreak: 0,
    perfectStreak: 0,
    avgResponseTime: 0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const sessionStartTimeRef = useRef(Date.now());
  const questionStartTimeRef = useRef(Date.now());
  const playCountRef = useRef(0);

  // ----- Advanced features
  const [recentPerformance, setRecentPerformance] = useState([]);
  const [masteredIntervals, setMasteredIntervals] = useState([]);
  const [confusionState, setConfusionState] = useState({ pairs: {}, byCorrect: {} });

  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [visualFeedback, setVisualFeedback] = useState(true);

  // logs
  const performanceLogRef = useRef([]);
  const autoAdvanceTimerRef = useRef(null);

  // For keyboard mapping to current answers
  const answerOptionsRef = useRef([]);

  // Adaptive config
  const [adaptiveConfig, setAdaptiveConfig] = useState({
    difficulty: 'beginner',
    level: 1,
    accuracyTarget: 75,
    optionCount: 4,
    allowRepeats: true,
    prioritizeDue: true,
  });

  // -------------------------
  // Level naming + pools
  // -------------------------
  const getLevelName = useCallback((level) => {
    if (level <= 1) return 'beginner';
    if (level <= 2) return 'elementary';
    if (level <= 3) return 'intermediate';
    if (level <= 4) return 'advanced';
    return 'expert';
  }, []);

  const getBasePoolForLevel = useCallback((level) => {
    const pools = {
      1: INTERVALS.filter(i => ['unison', 'P4', 'P5', 'P8'].includes(i.id)),
      2: INTERVALS.filter(i => i.difficulty === 'easy'),
      3: INTERVALS.filter(i => ['easy', 'medium'].includes(i.difficulty)),
      4: INTERVALS.filter(i => i.difficulty !== 'hard' || i.id === 'M7'),
      5: INTERVALS.filter(i => i.id !== 'A4'),
      6: INTERVALS,
    };
    return pools[Math.min(6, level)] || pools[1];
  }, []);

  // Due-items set (computed once per render)
  const dueKeySet = useMemo(() => {
    try {
      const due = getDueItems ? (getDueItems('interval', 50) || []) : [];
      const set = new Set();
      due.forEach((item) => {
        const iv = item?.content?.interval;
        const m = item?.content?.mode;
        if (iv && m) set.add(`${iv}__${m}`);
      });
      return set;
    } catch {
      return new Set();
    }
  }, [mode, stats.total]); // refresh periodically as session progresses

  const calculateIntervalWeight = useCallback((interval, level, masteredArr, confusionByCorrect) => {
    let weight = 1.0;

    // mastered → lower weight, but still included
    if (masteredArr.includes(interval.id)) weight *= 0.3;

    // confused (per correct interval) → higher weight
    const c = confusionByCorrect[interval.id] || 0;
    if (c > 0) weight *= (1 + c * 0.35);

    // prioritize due items for current mode
    if (dueKeySet.has(`${interval.id}__${mode}`)) weight *= 2.0;

    // small boost as level rises (helps keep challenge)
    weight *= (1 + Math.min(0.25, level * 0.04));

    return weight;
  }, [dueKeySet, mode]);

  const buildWeightedPool = useCallback((level, masteredArr, confusionByCorrect) => {
    const base = getBasePoolForLevel(level);
    return base.map(iv => ({
      ...iv,
      weight: calculateIntervalWeight(iv, level, masteredArr, confusionByCorrect),
    }));
  }, [getBasePoolForLevel, calculateIntervalWeight]);

  // -------------------------
  // INIT / LOAD STATE
  // -------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const diff = await getDifficulty('interval-ear');
        const level = clamp(diff?.level || 1, 1, 6);

        const mastered = loadMasteredIntervals();
        const conf = loadConfusionState();
        const pool = buildWeightedPool(level, mastered, conf.byCorrect);

        if (!alive) return;

        setMasteredIntervals(mastered);
        setConfusionState(conf);

        setAdaptiveConfig({
          difficulty: getLevelName(level),
          level,
          accuracyTarget: diff?.config?.accuracyTarget || 75,
          optionCount: clamp(diff?.config?.optionCount || 4, 3, 6),
          allowRepeats: level < 3,
          prioritizeDue: level >= 2,
        });

        // announce
        a11y.announce(`Interval Ear Training. Level ${level}. Mode ${mode}.`);
      } catch (e) {
        // fallback
        const level = 1;
        const mastered = loadMasteredIntervals();
        const conf = loadConfusionState();
        setMasteredIntervals(mastered);
        setConfusionState(conf);
        setAdaptiveConfig((prev) => ({
          ...prev,
          level,
          difficulty: getLevelName(level),
          optionCount: 4,
        }));
      }
    })();

    return () => { alive = false; };
  }, [mode, getLevelName, buildWeightedPool]);

  // Weighted pool for current config (recomputed when mastery/confusion changes)
  const weightedPool = useMemo(() => {
    return buildWeightedPool(adaptiveConfig.level, masteredIntervals, confusionState.byCorrect);
  }, [adaptiveConfig.level, masteredIntervals, confusionState.byCorrect, buildWeightedPool]);

  // -------------------------
  // QUESTION GENERATION
  // -------------------------
  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const nextQuestion = useCallback(() => {
    clearAutoAdvance();

    const pool = weightedPool;
    if (!pool || pool.length === 0) {
      showToast?.('No intervals available in pool', 'error');
      return;
    }

    // Weighted random
    const totalW = pool.reduce((s, i) => s + (i.weight || 1), 0) || 1;
    let r = Math.random() * totalW;
    let selected = pool[0];

    for (const iv of pool) {
      r -= (iv.weight || 1);
      if (r <= 0) { selected = iv; break; }
    }

    // Choose base note so top note stays in violin range (FIX: use let, not const)
    const maxBase = CONFIG.VIOLIN_RANGE_HIGH - selected.semitones;
    const minBase = CONFIG.VIOLIN_RANGE_LOW;
    const baseRange = Math.max(1, maxBase - minBase + 1);
    let base = minBase + ((Math.random() * baseRange) | 0);
    base = clamp(base, minBase, maxBase);

    setCurrentInterval(selected);
    setBaseMidi(base);

    setUserAnswer(null);
    setShowAnswer(false);
    setShowHint(false);
    setUsedHint(false);

    setPlayCount(0);
    playCountRef.current = 0;

    questionStartTimeRef.current = Date.now();

    // Auto-play
    if (autoPlay) {
      setTimeout(() => { playInterval(); }, 250);
    }

    sessionTracker.trackActivity?.('interval-ear');
    a11y.announce(`New ${mode} interval question.`);
  }, [weightedPool, autoPlay, mode, clearAutoAdvance, sessionTracker, showToast]);

  // -------------------------
  // AUDIO PLAYBACK
  // -------------------------
  const playInterval = useCallback(async () => {
    if (isPlaying || !currentInterval || !audioEngine?.playInterval) return;

    setIsPlaying(true);

    setPlayCount((prev) => {
      const next = prev + 1;
      playCountRef.current = next;
      return next;
    });

    const f1 = MUSIC.midiToFreq(baseMidi);
    const f2 = MUSIC.midiToFreq(baseMidi + currentInterval.semitones);

    try {
      // Keep API-compat: many audio engines accept (f1, f2, harmonicBool, durationSec)
      if (mode === 'harmonic') {
        await audioEngine.playInterval(f1, f2, true, 2.0);
      } else if (mode === 'descending') {
        await audioEngine.playInterval(f2, f1, false, 1.5, 'descending');
      } else {
        // melodic or ascending (ascending == melodic ordering)
        await audioEngine.playInterval(f1, f2, false, 1.5, 'ascending');
      }

      a11y.announce(`Interval played. Play count ${playCountRef.current}.`);
    } catch (e) {
      console.error('[IntervalEar] playInterval failed:', e);
      showToast?.('Audio playback failed', 'error');
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, currentInterval, audioEngine, baseMidi, mode, showToast]);

  // -------------------------
  // ANSWER OPTIONS
  // -------------------------
  const answerOptions = useMemo(() => {
    if (!currentInterval) return [];
    const pool = weightedPool.filter(i => i.id !== currentInterval.id);
    const distractors = shuffle(pool).slice(0, Math.max(0, adaptiveConfig.optionCount - 1));
    const opts = shuffle([currentInterval, ...distractors]);
    answerOptionsRef.current = opts;
    return opts;
  }, [currentInterval, weightedPool, adaptiveConfig.optionCount]);

  // -------------------------
  // CONFUSION + MASTERY
  // -------------------------
  const detectAndRecordConfusion = useCallback((correctId, wrongId) => {
    setConfusionState((prev) => {
      const pairs = { ...(prev.pairs || {}) };
      const byCorrect = { ...(prev.byCorrect || {}) };

      const k = `${correctId}_${wrongId}`;
      pairs[k] = (pairs[k] || 0) + 1;
      byCorrect[correctId] = (byCorrect[correctId] || 0) + 1;

      const next = { pairs, byCorrect };
      saveConfusionState(next);

      if (pairs[k] === CONFIG.CONFUSION_THRESHOLD) {
        const correct = INTERVALS.find(i => i.id === correctId);
        const wrong = INTERVALS.find(i => i.id === wrongId);
        showToast?.(`💡 Pattern: ${correct?.name || correctId} vs ${wrong?.name || wrongId} (${pairs[k]}x)`, 'warning');
      }
      return next;
    });
  }, [showToast]);

  const checkForMastery = useCallback((intervalId) => {
    // mastery rule: last 10 attempts for (intervalId, mode) => >= 9 correct and avgTime < 4s
    const recent = performanceLogRef.current
      .filter(p => p.interval === intervalId && p.mode === mode)
      .slice(-10);

    if (recent.length < 10) return;

    const correctCount = recent.filter(r => r.correct).length;
    const avgT = mean(recent.map(r => r.responseTime));

    if (correctCount >= 9 && avgT < 4000) {
      if (!masteredIntervals.includes(intervalId)) {
        setMasteredIntervals((prev) => {
          const updated = [...prev, intervalId];
          saveMasteredIntervals(updated);
          const iv = INTERVALS.find(i => i.id === intervalId);
          showToast?.(`🌟 Mastered: ${iv?.name || intervalId} (${mode})`, 'success');
          return updated;
        });
      }
    }
  }, [mode, masteredIntervals, showToast]);

  // -------------------------
  // ANSWER CHECKING
  // -------------------------
  const checkAnswer = useCallback(async (intervalId) => {
    if (!currentInterval || showAnswer || userAnswer) return;

    clearAutoAdvance();

    const correct = intervalId === currentInterval.id;
    const responseTime = Date.now() - questionStartTimeRef.current;
    const plays = playCountRef.current || 0;

    setUserAnswer(intervalId);
    setShowAnswer(true);

    // XP logic
    let xp = XP_VALUES.CORRECT_ANSWER || 10;

    const nextStreak = correct ? (stats.streak + 1) : 0;

    if (correct) {
      // streak bonus
      if (nextStreak >= CONFIG.PERFECT_STREAK_THRESHOLD) xp += Math.floor(nextStreak * 0.5);

      // speed bonus
      if (responseTime < CONFIG.SPEED_BONUS_MS) xp += Math.ceil(xp * 0.3);

      // first-try bonus
      if (plays <= 1) xp += Math.ceil(xp * 0.2);

      // level bonus
      xp += adaptiveConfig.level * 2;

      // hint penalty
      if (usedHint) xp = Math.floor(xp * 0.5);
    } else {
      xp = Math.floor(xp * 0.3);
    }

    // Update stats (use next totals to avoid stale logic)
    const nextTotal = stats.total + 1;
    const nextCorrect = stats.correct + (correct ? 1 : 0);
    const nextAvgTime = Math.round((stats.avgResponseTime * stats.total + responseTime) / nextTotal);

    const nextPerfectStreak =
      (correct && !usedHint && plays <= 1)
        ? (stats.perfectStreak + 1)
        : 0;

    setStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
      streak: correct ? (prev.streak + 1) : 0,
      longestStreak: Math.max(prev.longestStreak, correct ? (prev.streak + 1) : 0),
      perfectStreak: (correct && !usedHint && plays <= 1) ? (prev.perfectStreak + 1) : 0,
      avgResponseTime: Math.round((prev.avgResponseTime * prev.total + responseTime) / (prev.total + 1)),
    }));

    // Log performance
    const perf = {
      correct,
      interval: currentInterval.id,
      responseTime,
      plays,
      usedHint,
      mode,
      level: adaptiveConfig.level,
      timestamp: Date.now(),
    };
    performanceLogRef.current.push(perf);
    setRecentPerformance((prev) => [...prev, perf].slice(-20));

    // SM-2 quality
    const quality = correct
      ? (usedHint ? 4 : (plays <= 1 ? 5 : 4))
      : (plays > CONFIG.MAX_PLAYS_BEFORE_PENALTY ? 1 : 2);

    try {
      await updateItem(
        `interval_${currentInterval.id}_${mode}`,
        quality,
        responseTime,
        {
          type: ITEM_TYPES.INTERVAL,
          interval: currentInterval.id,
          mode,
          semitones: currentInterval.semitones,
          plays,
          usedHint,
          level: adaptiveConfig.level,
        }
      );
    } catch (e) {
      // non-fatal
      console.warn('[IntervalEar] updateItem failed:', e);
    }

    // Gamification
    try {
      addXP(xp, `${mode} interval`);
      recordAnswer('interval-ear', correct, responseTime, {
        mode,
        interval: currentInterval.id,
        plays,
        level: adaptiveConfig.level,
        hint: usedHint,
      });
      updateStreak?.();
    } catch (e) {
      // non-fatal
    }

    // Confusion/Mastery
    if (!correct) {
      detectAndRecordConfusion(currentInterval.id, intervalId);
    } else {
      checkForMastery(currentInterval.id);
    }

    // Feedback
    if (visualFeedback) {
      try { audioEngine?.playFeedback?.(correct); } catch {}
    }

    if (correct) {
      const emoji = nextStreak >= 10 ? '🌟' : nextStreak >= 5 ? '🔥' : nextStreak >= 3 ? '⚡' : '';
      showToast?.(`✅ ${currentInterval.name}! +${xp} XP ${emoji}${nextStreak > 2 ? ` ${nextStreak}` : ''}`, 'success');
      a11y.announce(`Correct. ${currentInterval.name}.`);
    } else {
      showToast?.(`❌ ${currentInterval.name} (${currentInterval.semitones}st)`, 'error');
      a11y.announce(`Incorrect. Correct was ${currentInterval.name}.`);
    }

    // Difficulty adaptation: every N questions (use NEXT totals)
    if (nextTotal % CONFIG.MIN_QUESTIONS_FOR_ADAPT === 0) {
      const lastN = performanceLogRef.current.slice(-CONFIG.MIN_QUESTIONS_FOR_ADAPT);
      const nCorrect = lastN.filter(p => p.correct).length;
      const recentAcc = accuracy(nCorrect, CONFIG.MIN_QUESTIONS_FOR_ADAPT);
      const avgSec = (nextAvgTime || 0) / 1000;

      try {
        await adjustDifficulty('interval-ear', recentAcc, avgSec);
        const newDiff = await getDifficulty('interval-ear');
        const newLevel = clamp(newDiff?.level || adaptiveConfig.level, 1, 6);

        if (newLevel !== adaptiveConfig.level) {
          // rebuild pool from stored mastery/confusion
          const mastered = loadMasteredIntervals();
          const conf = loadConfusionState();
          setMasteredIntervals(mastered);
          setConfusionState(conf);

          setAdaptiveConfig((prev) => ({
            ...prev,
            level: newLevel,
            difficulty: getLevelName(newLevel),
            optionCount: clamp(newDiff?.config?.optionCount || prev.optionCount, 3, 6),
            accuracyTarget: newDiff?.config?.accuracyTarget || prev.accuracyTarget,
            allowRepeats: newLevel < 3,
            prioritizeDue: newLevel >= 2,
          }));

          const up = newLevel > adaptiveConfig.level;
          showToast?.(`🎯 Level ${up ? 'up' : 'down'}: ${getLevelName(newLevel)} (Lv${newLevel})`, up ? 'success' : 'info');
        }
      } catch (e) {
        // non-fatal
        console.warn('[IntervalEar] difficulty adapt failed:', e);
      }
    }

    // Auto-advance
    const delay = correct ? CONFIG.AUTO_ADVANCE_DELAY : CONFIG.AUTO_ADVANCE_DELAY_WRONG;
    autoAdvanceTimerRef.current = setTimeout(() => nextQuestion(), delay);
  }, [
    currentInterval,
    showAnswer,
    userAnswer,
    stats,
    usedHint,
    mode,
    adaptiveConfig.level,
    adaptiveConfig.optionCount,
    visualFeedback,
    audioEngine,
    getLevelName,
    detectAndRecordConfusion,
    checkForMastery,
    nextQuestion,
    clearAutoAdvance,
    showToast,
  ]);

  // -------------------------
  // HINT SYSTEM
  // -------------------------
  const toggleHint = useCallback(() => {
    if (showAnswer || !currentInterval) return;
    setShowHint((p) => !p);
    setUsedHint(true);
    showToast?.('💡 Hint shown (50% XP penalty)', 'info');
    a11y.announce(`Hint: ${currentInterval.semitones} semitones. Quality ${currentInterval.quality}.`);
  }, [showAnswer, currentInterval, showToast]);

  // -------------------------
  // MODE CHANGE
  // -------------------------
  const handleModeChange = useCallback((newMode) => {
    if (newMode === mode) return;
    clearAutoAdvance();
    setMode(newMode);
    setShowAnswer(false);
    setUserAnswer(null);
    a11y.announce(`Mode changed to ${newMode}`);
  }, [mode, clearAutoAdvance]);

  // -------------------------
  // KEYBOARD SHORTCUTS (safe unregister)
  // -------------------------
  useEffect(() => {
    const safeUnregister = (key) => { try { keyboard.unregister?.(key); } catch {} };
    const safeRegister = (key, fn, label) => { try { keyboard.register?.(key, fn, label); } catch {} };

    safeRegister('space', () => { if (!showAnswer) playInterval(); }, 'Play interval');
    safeRegister('h', () => toggleHint(), 'Show hint');
    safeRegister('n', () => { if (showAnswer) nextQuestion(); }, 'Next question');
    safeRegister('s', () => setShowStatsPanel((p) => !p), 'Toggle stats');

    // number keys map to current answer options
    for (let i = 1; i <= 6; i++) {
      safeRegister(String(i), () => {
        if (showAnswer) return;
        const opts = answerOptionsRef.current || [];
        const pick = opts[i - 1];
        if (pick) checkAnswer(pick.id);
      }, `Select answer ${i}`);
    }

    safeRegister('m', () => {
      const modes = ['melodic', 'harmonic', 'ascending', 'descending'];
      const idx = modes.indexOf(mode);
      handleModeChange(modes[(idx + 1) % modes.length]);
    }, 'Toggle mode');

    return () => {
      ['space', 'h', 'n', 's', 'm', '1', '2', '3', '4', '5', '6'].forEach(safeUnregister);
    };
  }, [playInterval, toggleHint, nextQuestion, checkAnswer, showAnswer, mode, handleModeChange]);

  // -------------------------
  // SESSION ANALYTICS (periodic)
  // -------------------------
  useEffect(() => {
    if (stats.total >= 10) {
      const acc = accuracy(stats.correct, stats.total);
      const avgTimeSec = (stats.avgResponseTime || 0) / 1000;

      try {
        recordPerformance('interval-ear', acc, avgTimeSec, stats.correct, {
          mode,
          level: adaptiveConfig.level,
          intervalPool: weightedPool.length,
          streak: stats.streak,
          longestStreak: stats.longestStreak,
        });
      } catch {}

      refreshStats?.();
    }
  }, [stats.total]); // keep intentionally sparse

  // -------------------------
  // INIT FIRST QUESTION
  // -------------------------
  useEffect(() => {
    if (!currentInterval && weightedPool.length > 0) nextQuestion();
  }, [weightedPool.length, mode]);

  // -------------------------
  // CLEANUP
  // -------------------------
  useEffect(() => {
    return () => clearAutoAdvance();
  }, [clearAutoAdvance]);

  // -------------------------
  // COMPUTED DISPLAY
  // -------------------------
  const sessionAccuracy = useMemo(() => (stats.total ? accuracy(stats.correct, stats.total) : 0), [stats.correct, stats.total]);

  const sessionGrade = useMemo(() => {
    const a = sessionAccuracy;
    if (a >= 95) return 'S';
    if (a >= 90) return 'A';
    if (a >= 80) return 'B';
    if (a >= 70) return 'C';
    return 'D';
  }, [sessionAccuracy]);

  const learningCurve = useMemo(() => {
    if (recentPerformance.length < 5) return null;
    return analyzeLearningCurve(recentPerformance.map(p => ({
      accuracy: p.correct ? 100 : 0,
      timestamp: p.timestamp,
    })));
  }, [recentPerformance]);

  const sessionDurationSec = useMemo(() => {
    // recompute when stats.total changes so it "ticks" as you answer
    const now = Date.now();
    return Math.floor((now - sessionStartTimeRef.current) / 1000);
  }, [stats.total]);

  const coachInsight = useMemo(() => {
    try { return getCoachInsights?.('interval-ear', { mode, level: adaptiveConfig.level }) || null; } catch { return null; }
  }, [mode, adaptiveConfig.level]);

  // -------------------------
  // RENDER
  // -------------------------
  return h('div', {
    className: 'module-container ear-trainer interval-ear',
    'data-module': 'interval-ear',
    role: 'main',
  },
    // Header
    h('header', { className: 'module-header elevated' },
      h('button', {
        className: 'btn-back',
        onClick: () => { clearAutoAdvance(); onBack?.(); },
        'aria-label': 'Go back to main menu',
      }, '← Back'),

      h('h1', null, '👂 Interval Ear Training'),

      h('div', { className: 'header-badges' },
        h('div', {
          className: `difficulty-badge level-${adaptiveConfig.level}`,
          'aria-label': `Level ${adaptiveConfig.level}, ${adaptiveConfig.difficulty}`,
        }, `Lv${adaptiveConfig.level} • ${adaptiveConfig.difficulty}`),

        masteredIntervals.length > 0 && h('div', { className: 'mastery-badge' }, `🌟 ${masteredIntervals.length} mastered`)
      )
    ),

    // Optional coach hint
    coachInsight && h('div', { className: 'coach-tip card' },
      h('div', { className: 'coach-tip-title' }, '🤖 Coach Tip'),
      h('div', { className: 'coach-tip-body' }, String(coachInsight))
    ),

    // Live Stats Bar
    h('div', { className: 'stats-live', 'aria-live': 'polite' },
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🎯'),
        h('div', { className: 'stat-content' },
          h('div', { className: `stat-value grade-${sessionGrade.toLowerCase()}` }, `${stats.correct}/${stats.total}`),
          h('small', null, `${sessionAccuracy}% (${sessionGrade})`)
        )
      ),

      h('div', { className: 'stat-card streak' },
        h('div', { className: 'stat-icon' },
          stats.streak >= 10 ? '🌟' : stats.streak >= 5 ? '🔥' : '⚡'
        ),
        h('div', { className: 'stat-content' },
          h('div', { className: 'stat-value' }, stats.streak),
          h('small', null, 'streak')
        )
      ),

      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '⏱️'),
        h('div', { className: 'stat-content' },
          h('div', { className: 'stat-value' },
            `${Math.floor(sessionDurationSec / 60)}:${String(sessionDurationSec % 60).padStart(2, '0')}`
          ),
          h('small', null, 'time')
        )
      ),

      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, playCount > CONFIG.MAX_PLAYS_BEFORE_PENALTY ? '🔊' : '🔉'),
        h('div', { className: 'stat-content' },
          h('div', { className: 'stat-value' }, playCount),
          h('small', null, 'plays')
        )
      )
    ),

    // Learning Progress (if available)
    learningCurve && h('div', { className: 'learning-progress' },
      h('div', { className: 'progress-label' },
        h('span', null, `Learning stage: ${learningCurve.stage}`),
        (learningCurve.velocity > 0) && h('span', { className: 'trend-up' }, `↗ +${learningCurve.velocity.toFixed(1)}%`)
      ),
      learningCurve.prediction && h('small', null, `${learningCurve.prediction.sessionsToMastery} sessions to mastery`)
    ),

    // Mode Selector
    h('div', { className: 'mode-selector', role: 'radiogroup', 'aria-label': 'Interval playback mode' },
      [
        { id: 'melodic', icon: '🎵', label: 'Melodic' },
        { id: 'harmonic', icon: '🎹', label: 'Harmonic' },
        { id: 'ascending', icon: '⬆️', label: 'Ascending' },
        { id: 'descending', icon: '⬇️', label: 'Descending' },
      ].map(m =>
        h('button', {
          key: m.id,
          className: `mode-btn ${mode === m.id ? 'active' : ''}`,
          role: 'radio',
          'aria-checked': mode === m.id,
          onClick: () => handleModeChange(m.id),
          title: m.label,
        },
          h('span', { className: 'mode-icon' }, m.icon),
          h('span', { className: 'mode-label' }, m.label)
        )
      )
    ),

    // Playback Section
    h('section', { className: 'playback-section', 'aria-live': 'assertive', 'aria-atomic': true },
      h('div', { className: 'playback-card elevated' },
        h('h2', { className: 'instruction' }, 'Listen and identify the interval'),

        currentInterval && h('div', { className: 'interval-context' },
          h('small', null, `${MUSIC.midiToNote(baseMidi)} → ${MUSIC.midiToNote(baseMidi + currentInterval.semitones)}`)
        ),

        h('button', {
          className: `btn-play-main ${isPlaying ? 'playing pulse' : ''}`,
          onClick: playInterval,
          disabled: isPlaying || !audioEngine?.playInterval || !currentInterval,
          'aria-label': `Play ${mode} interval`,
        },
          h('div', { className: 'play-icon' }, isPlaying ? '🔊' : '▶️'),
          h('div', { className: 'play-text' },
            h('span', { className: 'play-label' }, isPlaying ? 'PLAYING...' : 'PLAY INTERVAL'),
            h('small', null,
              playCount > 0
                ? `Played ${playCount}x${playCount > CONFIG.MAX_PLAYS_BEFORE_PENALTY ? ' (penalty)' : ''}`
                : 'Press SPACE or click'
            )
          )
        ),

        h('button', {
          className: `btn-hint ${showHint ? 'active' : ''}`,
          onClick: toggleHint,
          disabled: showAnswer || usedHint,
          title: 'Show hint (50% XP penalty)',
        }, showHint ? '💡 Hint shown' : '💡 Need a hint?'),

        showHint && currentInterval && h('div', { className: 'hint-box' },
          h('p', null,
            h('strong', null, 'Hint:'),
            ` ${currentInterval.semitones} semitones • ${currentInterval.quality}`,
            currentInterval.example ? ` • Example: ${currentInterval.example}` : ''
          )
        )
      )
    ),

    // Answer Section
    h('section', { className: 'answer-section' },
      !showAnswer
        ? h('div', { className: 'answer-grid ear-grid', role: 'radiogroup', 'aria-label': 'Answer options' },
            answerOptions.map((iv, i) =>
              h('button', {
                key: iv.id,
                className: `answer-btn interval-btn ${userAnswer === iv.id ? 'selected' : ''} ${masteredIntervals.includes(iv.id) ? 'mastered' : ''}`,
                onClick: () => checkAnswer(iv.id),
                disabled: showAnswer,
                role: 'radio',
                'aria-checked': userAnswer === iv.id,
                'aria-label': `${iv.name}, ${iv.semitones} semitones, ${iv.quality}`,
                style: { '--animation-delay': `${i * 50}ms` },
              },
                h('div', { className: 'interval-header' },
                  h('span', { className: 'interval-name' }, iv.name),
                  masteredIntervals.includes(iv.id) && h('span', { className: 'mastery-icon', title: 'Mastered' }, '⭐')
                ),
                h('div', { className: 'interval-meta' },
                  h('small', null, `${iv.semitones}st • ${iv.quality}`)
                ),
                h('kbd', { className: 'shortcut-key' }, i + 1)
              )
            )
          )
        : currentInterval && h('div', {
            className: `feedback-card large ${userAnswer === currentInterval.id ? 'success' : 'error'}`,
            role: 'status',
            'aria-live': 'assertive',
          },
            h('div', { className: 'feedback-header' },
              h('div', { className: 'feedback-icon' }, userAnswer === currentInterval.id ? '✅' : '❌'),
              h('h3', null, currentInterval.name)
            ),

            h('div', { className: 'interval-details' },
              h('div', { className: 'detail-item' },
                h('span', { className: 'detail-label' }, 'Semitones:'),
                h('span', { className: 'detail-value' }, currentInterval.semitones)
              ),
              h('div', { className: 'detail-item' },
                h('span', { className: 'detail-label' }, 'Quality:'),
                h('span', { className: 'detail-value' }, currentInterval.quality)
              ),
              currentInterval.example && h('div', { className: 'detail-item' },
                h('span', { className: 'detail-label' }, 'Example:'),
                h('span', { className: 'detail-value' }, currentInterval.example)
              )
            ),

            (userAnswer !== currentInterval.id) && h('div', { className: 'confusion-note' },
              h('p', null, `You selected: ${INTERVALS.find(i => i.id === userAnswer)?.name || 'Unknown'}`)
            ),

            h('div', { className: 'feedback-actions' },
              h('button', { className: 'btn btn-secondary', onClick: playInterval, disabled: isPlaying }, isPlaying ? '🔊 Playing...' : '🔄 Replay'),
              h('button', { className: 'btn btn-primary', onClick: nextQuestion }, '→ Next Question')
            )
          )
    ),

    // Stats Panel
    showStatsPanel && h('div', { className: 'stats-panel card' },
      h('div', { className: 'panel-header' },
        h('h3', null, '📊 Session Statistics'),
        h('button', { className: 'btn-close', onClick: () => setShowStatsPanel(false), 'aria-label': 'Close statistics' }, '✕')
      ),

      h('div', { className: 'stats-grid' },
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Accuracy'),
          h('div', { className: 'stat-value' }, `${sessionAccuracy}%`)
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Avg Response'),
          h('div', { className: 'stat-value' }, `${((stats.avgResponseTime || 0) / 1000).toFixed(1)}s`)
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Longest Streak'),
          h('div', { className: 'stat-value' }, stats.longestStreak)
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Perfect Streak'),
          h('div', { className: 'stat-value' }, stats.perfectStreak)
        )
      ),

      Object.keys(confusionState.pairs || {}).length > 0 && h('div', { className: 'confusion-section' },
        h('h4', null, '💡 Confusion Patterns'),
        h('ul', null,
          Object.entries(confusionState.pairs)
            .filter(([, count]) => count >= 2)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([pattern, count]) => {
              const [correctId, wrongId] = pattern.split('_');
              const correct = INTERVALS.find(i => i.id === correctId);
              const wrong = INTERVALS.find(i => i.id === wrongId);
              return h('li', { key: pattern },
                `${correct?.name || correctId} confused with ${wrong?.name || wrongId} (${count}x)`
              );
            })
        )
      )
    ),

    // Controls Bar
    h('div', { className: 'controls-bar' },
      h('div', { className: 'control-group' },
        h('label', { className: 'control-label' },
          h('input', { type: 'checkbox', checked: autoPlay, onChange: (e) => setAutoPlay(!!e.target.checked) }),
          h('span', null, 'Auto-play')
        ),
        h('label', { className: 'control-label' },
          h('input', { type: 'checkbox', checked: visualFeedback, onChange: (e) => setVisualFeedback(!!e.target.checked) }),
          h('span', null, 'Visual feedback')
        )
      ),
      h('button', { className: 'btn btn-sm btn-outline', onClick: () => setShowStatsPanel(p => !p) }, showStatsPanel ? 'Hide Stats' : 'Show Stats')
    ),

    // Keyboard hints
    h('div', { className: 'keyboard-hints ear-hints' },
      h('div', { className: 'hint-group' }, h('kbd', null, 'SPACE'), h('small', null, 'Play')),
      h('div', { className: 'hint-group' }, h('kbd', null, '1-6'), h('small', null, 'Answer')),
      h('div', { className: 'hint-group' }, h('kbd', null, 'H'), h('small', null, 'Hint')),
      h('div', { className: 'hint-group' }, h('kbd', null, 'M'), h('small', null, 'Mode')),
      h('div', { className: 'hint-group' }, h('kbd', null, 'S'), h('small', null, 'Stats'))
    )
  );
}
