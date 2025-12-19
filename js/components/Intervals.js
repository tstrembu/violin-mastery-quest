// js/components/Intervals.js
// ======================================
// INTERVALS v3.0 (Drop-in, Hardened)
// ML-Adaptive + Weighted Pool + Confusion Detection + Live Mastery
// 8-engine integration (best-effort, safe fallbacks)
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef, useMemo } = React;

// --- ESM-safe imports (namespace) to avoid “Importing a module script failed” from export drift ---
import * as ConstantsMod from '../config/constants.js';
import * as HelpersMod from '../utils/helpers.js';
import * as AudioMod from '../engines/audioEngine.js';
import * as GameMod from '../engines/gamification.js';
import * as SRSMod from '../engines/spacedRepetition.js';
import * as SessionMod from '../engines/sessionTracker.js';
import * as AnalyticsMod from '../engines/analytics.js';
import * as DifficultyMod from '../engines/difficultyAdapter.js';
import * as StorageMod from '../config/storage.js';

// -------------------------
// SAFE CONSTANTS + HELPERS
// -------------------------
const INTERVALS =
  ConstantsMod.INTERVALS ||
  (ConstantsMod.default && ConstantsMod.default.INTERVALS) ||
  [];

const XP_VALUES =
  ConstantsMod.XP_VALUES ||
  ConstantsMod.XPVALUES || // tolerate older name
  (ConstantsMod.default && (ConstantsMod.default.XP_VALUES || ConstantsMod.default.XPVALUES)) ||
  { CORRECT_ANSWER: 10 };

const APP_CONFIG =
  ConstantsMod.CONFIG ||
  (ConstantsMod.default && ConstantsMod.default.CONFIG) ||
  {};

// Local fallback config (merged with APP_CONFIG)
const CONFIG = {
  MIN_QUESTIONS_FOR_ADAPT: 5,
  AUTO_ADVANCE_DELAY: 1800,
  AUTO_ADVANCE_DELAY_WRONG: 2500,
  MAX_PLAYS_BEFORE_PENALTY: 3,
  SPEED_BONUS_MS: 5000,
  PERFECT_STREAK_THRESHOLD: 10,
  CONFUSION_THRESHOLD: 3,
  VIOLIN_RANGE_LOW: 55,  // G3
  VIOLIN_RANGE_HIGH: 88, // E5
  OPTION_COUNT_DEFAULT: 6,
  ...APP_CONFIG,
};

// Helpers (prefer your real ones, fallback minimal)
const shuffle =
  HelpersMod.shuffle ||
  (HelpersMod.default && HelpersMod.default.shuffle) ||
  ((arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  });

const clamp =
  HelpersMod.clamp ||
  (HelpersMod.default && HelpersMod.default.clamp) ||
  ((v, lo, hi) => Math.max(lo, Math.min(hi, v)));

const MUSIC =
  HelpersMod.MUSIC ||
  (HelpersMod.default && HelpersMod.default.MUSIC) ||
  {
    midiToFreq: (m) => 440 * Math.pow(2, (m - 69) / 12),
    midiToNote: (m) => `MIDI ${m}`,
    noteToMidi: (note) => 60,
  };

const midiToFreq = HelpersMod.midiToFreq || (HelpersMod.default && HelpersMod.default.midiToFreq) || MUSIC.midiToFreq;
const midiToNote = HelpersMod.midiToNote || (HelpersMod.default && HelpersMod.default.midiToNote) || MUSIC.midiToNote;
const noteToMidi = HelpersMod.noteToMidi || (HelpersMod.default && HelpersMod.default.noteToMidi) || MUSIC.noteToMidi;

const accuracyPct = (c, t) => (t ? Math.round((c / t) * 100) : 0);
const mean = HelpersMod.mean || (HelpersMod.default && HelpersMod.default.mean) || ((xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0));

// Engines (safe)
const audioEngineImported = AudioMod.audioEngine || (AudioMod.default && AudioMod.default.audioEngine) || AudioMod.default || null;

const recordAnswer = GameMod.recordAnswer || (GameMod.default && GameMod.default.recordAnswer) || (() => {});
const addXP = GameMod.addXP || (GameMod.default && GameMod.default.addXP) || (() => {});
const awardPracticeXP = GameMod.awardPracticeXP || (GameMod.default && GameMod.default.awardPracticeXP) || null;

const updateItem = SRSMod.updateItem || (SRSMod.default && SRSMod.default.updateItem) || (async () => {});
const getDueItems = SRSMod.getDueItems || (SRSMod.default && SRSMod.default.getDueItems) || (() => []);
const ITEM_TYPES = SRSMod.ITEM_TYPES || (SRSMod.default && SRSMod.default.ITEM_TYPES) || { INTERVAL: 'INTERVAL' };

const sessionTracker = SessionMod.sessionTracker || (SessionMod.default && SessionMod.default.sessionTracker) || { trackActivity: () => {} };

const analyzePerformance = AnalyticsMod.analyzePerformance || (AnalyticsMod.default && AnalyticsMod.default.analyzePerformance) || null;

const getAdaptiveConfig =
  DifficultyMod.getAdaptiveConfig ||
  (DifficultyMod.default && DifficultyMod.default.getAdaptiveConfig) ||
  null;

const getDifficulty =
  DifficultyMod.getDifficulty ||
  (DifficultyMod.default && DifficultyMod.default.getDifficulty) ||
  (async () => ({ level: 1, config: {} }));

const adjustDifficulty =
  DifficultyMod.adjustDifficulty ||
  (DifficultyMod.default && DifficultyMod.default.adjustDifficulty) ||
  (async () => {});

const recordPerformance =
  DifficultyMod.recordPerformance ||
  (DifficultyMod.default && DifficultyMod.default.recordPerformance) ||
  (() => {});

// Storage (safe)
const loadJSON = StorageMod.loadJSON || (StorageMod.default && StorageMod.default.loadJSON) || ((k, fb) => {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch { return fb; }
});
const saveJSON = StorageMod.saveJSON || (StorageMod.default && StorageMod.default.saveJSON) || ((k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
});
const STORAGE_KEYS = StorageMod.STORAGE_KEYS || (StorageMod.default && StorageMod.default.STORAGE_KEYS) || {};

const KEY_MASTERY = STORAGE_KEYS.MASTERY_INTERVALS || STORAGE_KEYS.MASTERY || 'vmq_mastery';
const KEY_CONFUSION = STORAGE_KEYS.CONFUSION_PATTERNS || 'vmq_confusion_patterns';

// -------------------------
// STORAGE SHAPES (backward compatible)
// -------------------------
function loadMasteredIntervals() {
  const data = loadJSON(KEY_MASTERY, {});
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.intervals)) return data.intervals;
  if (Array.isArray(data.intervalEar)) return data.intervalEar; // tolerate shared key
  if (Array.isArray(data.masteredIntervals)) return data.masteredIntervals;
  return [];
}

function saveMasteredIntervals(arr) {
  const data = loadJSON(KEY_MASTERY, {});
  // preserve object form if it exists
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    data.intervals = arr;
    saveJSON(KEY_MASTERY, data);
  } else {
    saveJSON(KEY_MASTERY, { intervals: arr });
  }
}

// confusion supports:
// - old: { "P5-m3": 2, "m3-P5": 1 }
// - new: { pairs: {...}, byCorrect: {...} }
function loadConfusionState() {
  const data = loadJSON(KEY_CONFUSION, {});
  const raw = data.intervals || data.intervalEar || data || {};
  if (raw && (raw.pairs || raw.byCorrect)) {
    return {
      pairs: raw.pairs || {},
      byCorrect: raw.byCorrect || {},
    };
  }
  const pairs = { ...(raw || {}) };
  const byCorrect = {};
  Object.keys(pairs).forEach((k) => {
    const sep = k.includes('-') ? '-' : (k.includes('_') ? '_' : null);
    if (!sep) return;
    const [correct] = k.split(sep);
    byCorrect[correct] = (byCorrect[correct] || 0) + (pairs[k] || 0);
  });
  return { pairs, byCorrect };
}

function saveConfusionState(state) {
  const data = loadJSON(KEY_CONFUSION, {});
  const next = {
    ...(data && typeof data === 'object' ? data : {}),
    intervals: {
      pairs: state.pairs || {},
      byCorrect: state.byCorrect || {},
    },
  };
  saveJSON(KEY_CONFUSION, next);
}

// -------------------------
// INTERVAL POOLS (level-based)
// -------------------------
function basePoolForLevel(level) {
  const L = clamp(level || 1, 1, 6);
  const pools = {
    1: INTERVALS.filter(i => ['unison', 'P4', 'P5', 'P8'].includes(i.id)),
    2: INTERVALS.filter(i => i.difficulty === 'easy'),
    3: INTERVALS.filter(i => ['easy', 'medium'].includes(i.difficulty)),
    4: INTERVALS.filter(i => i.difficulty !== 'hard' && i.id !== 'A4'),
    5: INTERVALS.filter(i => i.id !== 'A4'),
    6: INTERVALS,
  };
  return pools[L] || pools[1] || INTERVALS;
}

// -------------------------
// COMPONENT
// -------------------------
export default function Intervals(props) {
  const {
    onBack,
    refreshStats,
    xp,
    streak,
    level,
    showToast,        // optional (recommended)
    audioEngine,      // optional (if parent passes it)
  } = props || {};

  // prefer passed engine, then imported engine, then window fallback
  const engine = audioEngine || audioEngineImported || (window.VMQ && window.VMQ.audioEngine) || null;

  const toast = useCallback((msg, type = 'info') => {
    if (typeof showToast === 'function') return showToast(msg, type);
    // optional global fallback if you have one
    if (window.VMQToast && typeof window.VMQToast.show === 'function') return window.VMQToast.show(msg, type);
    // last resort: console
    if (type === 'error') console.error(msg);
    else console.log(msg);
  }, [showToast]);

  const [mode, setMode] = useState('visual'); // visual | melodic | harmonic | mixed
  const [adaptiveConfig, setAdaptiveConfig] = useState({
    level: 1,
    difficulty: 'easy',
    optionCount: CONFIG.OPTION_COUNT_DEFAULT,
    intervalPool: [],
  });

  const [currentInterval, setCurrentInterval] = useState(null);
  const [baseMidi, setBaseMidi] = useState(60);
  const [options, setOptions] = useState([]); // stable choices per question

  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswerState, setShowAnswerState] = useState(false);

  const [stats, setStats] = useState({
    correct: 0,
    total: 0,
    streak: 0,
    perfectStreak: 0,
    avgResponseTime: 0,
  });

  const [responseStart, setResponseStart] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const playCountRef = useRef(0);

  const [usedHint, setUsedHint] = useState(false);

  const [confusionState, setConfusionState] = useState({ pairs: {}, byCorrect: {} });
  const [masteredIntervals, setMasteredIntervals] = useState([]);
  const [recentPerformance, setRecentPerformance] = useState([]);

  const performanceLogRef = useRef([]);
  const autoAdvanceTimerRef = useRef(null);

  // -------------------------
  // Derived display values
  // -------------------------
  const baseNoteName = useMemo(() => {
    try { return midiToNote(baseMidi); } catch { return 'C4'; }
  }, [baseMidi]);

  const isCorrect = useMemo(() => {
    if (!showAnswerState || !currentInterval) return null;
    return userAnswer === currentInterval.id;
  }, [showAnswerState, currentInterval, userAnswer]);

  const sessionAcc = useMemo(() => accuracyPct(stats.correct, stats.total), [stats.correct, stats.total]);
  const sessionGrade = useMemo(() => {
    const a = sessionAcc;
    if (a >= 95) return 'S';
    if (a >= 90) return 'A';
    if (a >= 80) return 'B';
    if (a >= 70) return 'C';
    return 'D';
  }, [sessionAcc]);

  // due set
  const dueSet = useMemo(() => {
    try {
      const due = getDueItems ? (getDueItems('interval', 50) || []) : [];
      const set = new Set();
      due.forEach((it) => {
        const iv = it?.content?.interval;
        const m = it?.content?.mode;
        if (iv) set.add(`${iv}__${m || 'any'}`);
      });
      return set;
    } catch {
      return new Set();
    }
  }, [mode, stats.total]);

  // -------------------------
  // Weighting
  // -------------------------
  const calculateWeight = useCallback((interval, levelNum, masteredArr, confusionByCorrect) => {
    let w = 1.0;

    if (masteredArr.includes(interval.id)) w *= 0.3;

    const conf = confusionByCorrect[interval.id] || 0;
    if (conf > 0) w *= (1 + conf * 0.35);

    // due items: match mode or any
    if (dueSet.has(`${interval.id}__${mode}`) || dueSet.has(`${interval.id}__any`)) w *= 2.0;

    // level slight boost
    w *= (1 + Math.min(0.25, (levelNum || 1) * 0.04));

    return w;
  }, [dueSet, mode]);

  const buildWeightedPool = useCallback((levelNum, masteredArr, confusionByCorrect) => {
    const base = basePoolForLevel(levelNum);
    return base
      .map(iv => ({ ...iv, weight: calculateWeight(iv, levelNum, masteredArr, confusionByCorrect) }))
      .filter(iv => (iv.weight || 0) > 0);
  }, [calculateWeight]);

  // -------------------------
  // Adaptive config load
  // -------------------------
  const refreshAdaptiveConfig = useCallback(async () => {
    const mastered = loadMasteredIntervals();
    const confusion = loadConfusionState();

    setMasteredIntervals(mastered);
    setConfusionState(confusion);

    let diff = null;

    try {
      if (getAdaptiveConfig) diff = await getAdaptiveConfig('intervals');
      else diff = await getDifficulty('intervals');
    } catch {
      diff = { level: 1, difficulty: 'easy', config: {} };
    }

    const lvl = clamp(diff?.level || 1, 1, 6);
    const optionCount = clamp(diff?.config?.optionCount || CONFIG.OPTION_COUNT_DEFAULT, 3, 6);

    const pool = buildWeightedPool(lvl, mastered, confusion.byCorrect);

    setAdaptiveConfig({
      level: lvl,
      difficulty: diff?.difficulty || diff?.name || (lvl <= 2 ? 'easy' : lvl <= 4 ? 'medium' : 'hard'),
      optionCount,
      intervalPool: pool,
    });
  }, [buildWeightedPool]);

  // -------------------------
  // Confusion + mastery
  // -------------------------
  const recordConfusion = useCallback((correctId, wrongId) => {
    setConfusionState((prev) => {
      const pairs = { ...(prev.pairs || {}) };
      const byCorrect = { ...(prev.byCorrect || {}) };

      const key = `${correctId}-${wrongId}`;
      pairs[key] = (pairs[key] || 0) + 1;
      byCorrect[correctId] = (byCorrect[correctId] || 0) + 1;

      const next = { pairs, byCorrect };
      saveConfusionState(next);

      if (pairs[key] === CONFIG.CONFUSION_THRESHOLD) {
        const c = INTERVALS.find(i => i.id === correctId);
        const w = INTERVALS.find(i => i.id === wrongId);
        toast(`💡 Pattern: ${c?.name || correctId} vs ${w?.name || wrongId} (${pairs[key]}x)`, 'warning');
      }
      return next;
    });
  }, [toast]);

  const checkForMastery = useCallback((intervalId) => {
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
          toast(`🌟 Mastered: ${iv?.name || intervalId}`, 'success');
          return updated;
        });
      }
    }
  }, [mode, masteredIntervals, toast]);

  // -------------------------
  // Question generation
  // -------------------------
  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const generateOptions = useCallback((correctInterval, pool, optionCount) => {
    const others = pool.filter(i => i.id !== correctInterval.id);
    const distractors = shuffle(others).slice(0, Math.max(0, optionCount - 1));
    return shuffle([correctInterval, ...distractors]);
  }, []);

  const nextQuestion = useCallback(() => {
    clearAutoAdvance();

    const pool = adaptiveConfig.intervalPool || [];
    if (!pool.length) return;

    // weighted selection
    const totalW = pool.reduce((s, i) => s + (i.weight || 1), 0) || 1;
    let r = Math.random() * totalW;
    let picked = pool[0];

    for (const iv of pool) {
      r -= (iv.weight || 1);
      if (r <= 0) { picked = iv; break; }
    }

    // choose base midi so top stays in range
    const minBase = CONFIG.VIOLIN_RANGE_LOW;
    const maxBase = CONFIG.VIOLIN_RANGE_HIGH - (picked.semitones || 0);
    const safeMax = Math.max(minBase, maxBase);
    const base = minBase + (((Math.random() * (safeMax - minBase + 1)) | 0));
    const baseClamped = clamp(base, minBase, safeMax);

    setCurrentInterval(picked);
    setBaseMidi(baseClamped);

    setOptions(generateOptions(picked, pool, adaptiveConfig.optionCount));

    setUserAnswer('');
    setShowAnswerState(false);
    setPlayCount(0);
    playCountRef.current = 0;
    setUsedHint(false);
    setResponseStart(Date.now());

    sessionTracker.trackActivity?.('intervals', 'question_shown', {
      interval: picked.id,
      level: adaptiveConfig.level,
      mode,
      weight: picked.weight,
    });

    // auto-play for audio modes (melodic/harmonic/mixed)
    if (mode !== 'visual') {
      setTimeout(() => { playInterval(); }, 250);
    }
  }, [adaptiveConfig.intervalPool, adaptiveConfig.level, adaptiveConfig.optionCount, mode, clearAutoAdvance, generateOptions]);

  // -------------------------
  // Audio playback
  // -------------------------
  const playInterval = useCallback(async () => {
    if (!currentInterval) return;
    if (!engine || typeof engine.playInterval !== 'function') {
      toast('Audio engine not available', 'error');
      return;
    }

    setPlayCount((p) => {
      const n = p + 1;
      playCountRef.current = n;
      return n;
    });

    const f1 = midiToFreq(baseMidi);
    const f2 = midiToFreq(baseMidi + (currentInterval.semitones || 0));

    try {
      if (mode === 'harmonic') {
        await engine.playInterval(f1, f2, true, 2.0);
      } else if (mode === 'melodic' || mode === 'mixed') {
        await engine.playInterval(f1, f2, false, 1.5, 'ascending');
      } else {
        // fallback
        await engine.playInterval(f1, f2, false, 1.5);
      }

      sessionTracker.trackActivity?.('intervals', 'interval_played', {
        interval: currentInterval.id,
        plays: playCountRef.current,
        mode,
      });
    } catch (e) {
      console.error('[Intervals] playInterval failed:', e);
      toast('Audio playback failed', 'error');
    }
  }, [engine, currentInterval, baseMidi, mode, toast]);

  // -------------------------
  // Hint (keeps feature; you can restyle later)
  // -------------------------
  const showHint = useCallback(() => {
    if (!currentInterval || showAnswerState) return;
    setUsedHint(true);
    toast(`💡 Hint: ${currentInterval.semitones} semitones • ${currentInterval.quality || ''}`.trim(), 'info');
  }, [currentInterval, showAnswerState, toast]);

  // -------------------------
  // Answer checking (8-engine cascade)
  // -------------------------
  const checkAnswer = useCallback(async (intervalIdOrText) => {
    if (!currentInterval || showAnswerState) return;

    // normalize for visual typing:
    // allow entering "P5", "p5", "perfect 5", etc. (best-effort)
    let pickedId = String(intervalIdOrText || '').trim();
    if (!pickedId) return;

    if (mode === 'visual') {
      pickedId = pickedId
        .replace(/\s+/g, '')
        .replace(/^perfect/i, 'P')
        .replace(/^major/i, 'M')
        .replace(/^minor/i, 'm')
        .replace(/^augmented/i, 'A')
        .replace(/^diminished/i, 'd');
    }

    const correct = pickedId === currentInterval.id;
    const responseTime = Date.now() - (responseStart || Date.now());
    const plays = playCountRef.current || 0;

    setUserAnswer(pickedId);
    setShowAnswerState(true);

    // XP calc (keeps your intent; avoids bad constants)
    const baseXP = XP_VALUES.CORRECT_ANSWER || XP_VALUES.CORRECTANSWER || 10;
    let xpEarned = baseXP;

    const nextStreak = correct ? (stats.streak + 1) : 0;
    const nextPerfect = (correct && !usedHint && plays <= 1) ? (stats.perfectStreak + 1) : 0;

    if (correct) {
      if (nextPerfect >= CONFIG.PERFECT_STREAK_THRESHOLD) xpEarned += Math.floor(nextPerfect * 0.5);
      if (responseTime < CONFIG.SPEED_BONUS_MS) xpEarned = Math.ceil(xpEarned * 1.3);
      if (plays <= 1) xpEarned = Math.ceil(xpEarned * 1.2);
      xpEarned += (adaptiveConfig.level || 1) * 2;
      if (usedHint) xpEarned = Math.floor(xpEarned * 0.5);
    } else {
      xpEarned = Math.floor(xpEarned * 0.3);
    }

    // Update stats
    const nextTotal = stats.total + 1;
    const nextCorrect = stats.correct + (correct ? 1 : 0);
    const nextAvg = Math.round((stats.avgResponseTime * stats.total + responseTime) / nextTotal);

    setStats((prev) => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
      streak: correct ? (prev.streak + 1) : 0,
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

    // Engine cascade
    try {
      recordAnswer('intervals', correct, responseTime, { interval: currentInterval.id, mode, level: adaptiveConfig.level });
    } catch {}

    try {
      const quality = correct ? (usedHint ? 4 : (plays <= 1 ? 5 : 4)) : 2;
      await updateItem(
        `intervals_${currentInterval.id}_${mode}`,
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
      console.warn('[Intervals] updateItem failed:', e);
    }

    // Confusion + mastery
    if (!correct) recordConfusion(currentInterval.id, pickedId);
    else checkForMastery(currentInterval.id);

    // Practice XP engine (if you have it)
    if (typeof awardPracticeXP === 'function') {
      try {
        xpEarned = awardPracticeXP('intervals', correct, {
          streak: nextStreak,
          perfectStreak: nextPerfect,
          difficulty: adaptiveConfig.level,
          responseTime,
          plays,
          hint: usedHint,
        });
      } catch {}
    }

    try { addXP(xpEarned, `intervals_${correct ? 'correct' : 'incorrect'}`); } catch {}

    try { engine?.playFeedback?.(correct); } catch {}

    // Optional analytics summary hook
    if (analyzePerformance && nextTotal % 10 === 0) {
      try { analyzePerformance('intervals', performanceLogRef.current.slice(-50)); } catch {}
    }

    // Difficulty adaptation every N questions (use next totals)
    if (nextTotal % CONFIG.MIN_QUESTIONS_FOR_ADAPT === 0) {
      const lastN = performanceLogRef.current.slice(-CONFIG.MIN_QUESTIONS_FOR_ADAPT);
      const nCorrect = lastN.filter(p => p.correct).length;
      const recentAcc = nCorrect / CONFIG.MIN_QUESTIONS_FOR_ADAPT;

      try {
        await adjustDifficulty('intervals', recentAcc, (nextAvg || 0) / 1000);
        await refreshAdaptiveConfig();
      } catch (e) {
        console.warn('[Intervals] adjustDifficulty failed:', e);
      }
    }

    // Session analytics
    if (nextTotal % 10 === 0) {
      try {
        recordPerformance(
          'intervals',
          nextCorrect / nextTotal,
          (nextAvg || 0) / 1000,
          nextCorrect,
          { mode, level: adaptiveConfig.level }
        );
      } catch {}
      refreshStats?.();
    }

    // Auto advance
    const delay = correct ? CONFIG.AUTO_ADVANCE_DELAY : CONFIG.AUTO_ADVANCE_DELAY_WRONG;
    autoAdvanceTimerRef.current = setTimeout(() => nextQuestion(), delay);
  }, [
    currentInterval,
    showAnswerState,
    responseStart,
    stats,
    usedHint,
    adaptiveConfig.level,
    mode,
    engine,
    recordConfusion,
    checkForMastery,
    refreshAdaptiveConfig,
    nextQuestion,
    refreshStats,
  ]);

  // -------------------------
  // Init + mode changes
  // -------------------------
  useEffect(() => {
    refreshAdaptiveConfig();
  }, []); // once

  useEffect(() => {
    if (adaptiveConfig.intervalPool && adaptiveConfig.intervalPool.length > 0) {
      nextQuestion();
    }
  }, [adaptiveConfig.intervalPool?.length, mode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  // -------------------------
  // Confusion list for UI
  // -------------------------
  const topConfusions = useMemo(() => {
    const entries = Object.entries(confusionState.pairs || {})
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return entries.map(([k, c]) => {
      const [a, b] = k.split('-');
      const ia = INTERVALS.find(x => x.id === a);
      const ib = INTERVALS.find(x => x.id === b);
      return { key: k, count: c, a: ia?.name || a, b: ib?.name || b };
    });
  }, [confusionState.pairs]);

  // -------------------------
  // Render
  // -------------------------
  return h('div', { className: 'module-container intervals-v3', role: 'main' },

    // Header
    h('header', { className: 'module-header elevated' },
      h('button', {
        className: 'btn-back',
        onClick: () => { clearAutoAdvance(); onBack?.(); },
        'aria-label': 'Go back to main menu',
      }, '← Back'),

      h('h1', null, '🎵 Intervals'),

      h('div', { className: 'stats-live', 'aria-live': 'polite' },
        h('div', { className: 'stat-card' },
          h('div', { className: `stat-value grade-${sessionGrade.toLowerCase()}` }, `${stats.correct}/${stats.total}`),
          h('small', null, `${sessionAcc}% (${sessionGrade})`)
        ),
        h('div', { className: 'stat-card streak' },
          h('div', { className: 'stat-value' }, stats.streak),
          h('small', null, 'streak')
        ),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-value' }, masteredIntervals.length),
          h('small', null, 'mastered')
        ),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-value' }, `Lv${adaptiveConfig.level}`),
          h('small', null, adaptiveConfig.difficulty)
        )
      )
    ),

    // Controls
    h('div', { className: 'control-grid' },
      h('div', { className: 'mode-toggle' },
        ['visual', 'melodic', 'harmonic', 'mixed'].map(m =>
          h('button', {
            key: m,
            className: `btn ${mode === m ? 'btn-primary' : 'btn-outline'}`,
            onClick: () => setMode(m),
            title: `Switch to ${m} mode`,
          }, m.charAt(0).toUpperCase() + m.slice(1))
        )
      ),
      h('div', { className: 'mode-toggle' },
        h('button', { className: 'btn btn-outline', onClick: showHint, disabled: showAnswerState || !currentInterval }, '💡 Hint'),
        h('button', {
          className: 'btn btn-outline',
          onClick: () => nextQuestion(),
        }, '↻ New')
      )
    ),

    // Question Card
    h('div', { className: 'card elevated' },
      h('div', { className: 'question-display', style: { textAlign: 'center' } },
        h('div', { className: 'interval-context' },
          h('div', { className: 'note-name large' }, baseNoteName),
          h('span', { style: { fontSize: '2rem', margin: '0 1rem' } }, '→'),
          h('div', { className: 'note-name large mystery' }, '?'),
          (currentInterval && masteredIntervals.includes(currentInterval.id)) &&
            h('span', { className: 'mastery-icon', title: 'Mastered' }, '⭐')
        ),

        (mode !== 'visual') && h('button', {
          className: 'btn btn-primary btn-lg btn-play',
          onClick: playInterval,
          disabled: !engine || typeof engine.playInterval !== 'function' || !currentInterval,
          style: { width: '100%', margin: 'var(--space-lg) 0' }
        }, `🔊 Play (${playCount + 1}x)`)
      ),

      // Answer UI
      !showAnswerState
        ? h('form', {
            onSubmit: (e) => {
              e.preventDefault();
              checkAnswer(userAnswer);
            }
          },
            mode === 'visual'
              ? h('div', null,
                  h('input', {
                    type: 'text',
                    value: userAnswer,
                    onChange: (e) => setUserAnswer(e.target.value),
                    placeholder: 'Type interval id (P5, m3, M2, etc.)',
                    className: 'input-large',
                    autoCapitalize: 'none',
                    autoCorrect: 'off',
                    spellCheck: false,
                  }),
                  h('button', {
                    type: 'submit',
                    className: 'btn btn-primary btn-lg',
                    disabled: !String(userAnswer || '').trim() || !currentInterval,
                    style: { width: '100%', marginTop: 'var(--space-md)' }
                  }, '✅ Check Answer')
                )
              : h('div', { className: 'answer-grid' },
                  options.map((iv, i) =>
                    h('button', {
                      key: iv.id,
                      className: `btn btn-outline ${masteredIntervals.includes(iv.id) ? 'mastered' : ''}`,
                      style: { flex: 1, '--animation-delay': `${i * 50}ms` },
                      onClick: (e) => {
                        e.preventDefault();
                        checkAnswer(iv.id);
                      }
                    }, iv.name || iv.id)
                  )
                )
          )
        : currentInterval && h('div', { className: `feedback-card ${isCorrect ? 'success' : 'error'}` },
            h('div', { style: { fontSize: '1.25rem', marginBottom: 'var(--space-sm)' } },
              isCorrect ? '✅ Correct' : '❌ Incorrect'
            ),
            h('h3', null, currentInterval.name || currentInterval.id),
            h('div', { className: 'interval-details' },
              h('div', null, `${currentInterval.semitones} semitones • ${currentInterval.quality || ''}`.trim()),
              currentInterval.example && h('div', { className: 'text-muted' }, `Example: ${currentInterval.example}`)
            ),
            !isCorrect && h('div', { className: 'text-muted', style: { marginTop: 'var(--space-sm)' } },
              `You selected: ${INTERVALS.find(i => i.id === userAnswer)?.name || userAnswer}`
            ),
            h('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' } },
              h('button', { className: 'btn btn-outline', type: 'button', onClick: playInterval, disabled: mode === 'visual' }, '🔊 Replay'),
              h('button', { className: 'btn btn-primary', type: 'button', onClick: nextQuestion }, '➡️ Next')
            )
          )
    ),

    // Confusion Patterns
    topConfusions.length > 0 && h('div', { className: 'card card-warning' },
      h('h4', null, '⚠️ Confusion Patterns'),
      h('ul', null,
        topConfusions.map(x =>
          h('li', { key: x.key }, `${x.a} ↔ ${x.b} (${x.count}x)`)
        )
      )
    ),

    // Quick Reference (mastery-aware)
    h('div', { className: 'card' },
      h('h3', null, 'Quick Reference'),
      h('div', { className: 'module-grid' },
        (adaptiveConfig.intervalPool || []).slice(0, 12).map(iv =>
          h('div', {
            key: iv.id,
            className: `interval-ref ${masteredIntervals.includes(iv.id) ? 'mastered' : ''}`,
            style: { cursor: 'pointer' },
            onClick: () => {
              // allow quick drill: set as current and regenerate options
              setCurrentInterval(iv);
              setOptions(generateOptions(iv, adaptiveConfig.intervalPool || [], adaptiveConfig.optionCount));
              setUserAnswer('');
              setShowAnswerState(false);
              setPlayCount(0);
              playCountRef.current = 0;
              setUsedHint(false);
              setResponseStart(Date.now());
            }
          },
            h('div', { className: 'interval-name' }, iv.name || iv.id),
            (iv.symbol || iv.quality) && h('div', { className: 'interval-symbol' }, iv.symbol || iv.quality),
            iv.example && h('small', { className: 'text-muted' }, iv.example)
          )
        )
      )
    )
  );
}