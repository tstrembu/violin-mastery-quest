// js/components/Rhythm.js
// ======================================
// RHYTHM v3.0 (Drop-in, Hardened)
// ML-Adaptive Pattern Mastery
// Syncopation + Confusion Detection + Tempo Adaptation + 8-Engine Integration
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef, useMemo } = React;

// --- ESM-safe imports (namespace) to avoid module-load failures from export drift ---
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
const RHYTHM_PATTERNS =
  ConstantsMod.RHYTHM_PATTERNS ||
  (ConstantsMod.default && ConstantsMod.default.RHYTHM_PATTERNS) ||
  [];

const TIME_SIGNATURES =
  ConstantsMod.TIME_SIGNATURES ||
  (ConstantsMod.default && ConstantsMod.default.TIME_SIGNATURES) ||
  ['4/4', '3/4'];

const XP_VALUES =
  ConstantsMod.XP_VALUES ||
  ConstantsMod.XPVALUES ||
  (ConstantsMod.default && (ConstantsMod.default.XP_VALUES || ConstantsMod.default.XPVALUES)) ||
  { CORRECT_ANSWER: 10 };

const APP_CONFIG =
  ConstantsMod.CONFIG ||
  (ConstantsMod.default && ConstantsMod.default.CONFIG) ||
  {};

const CONFIG = {
  MIN_QUESTIONS_FOR_ADAPT: 5,
  AUTO_ADVANCE_DELAY: 1500,
  AUTO_ADVANCE_DELAY_WRONG: 2500,
  PERFECT_STREAK_THRESHOLD: 10,
  SPEED_BONUS_MS: 7000,
  MAX_PLAYS_BEFORE_PENALTY: 3,
  CONFUSION_THRESHOLD: 3,
  TEMPO_MIN: 50,
  TEMPO_MAX: 160,
  TEMPO_STEP: 4,
  OPTION_COUNT_DEFAULT: 6,
  ...APP_CONFIG,
};

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

const mean =
  HelpersMod.mean ||
  (HelpersMod.default && HelpersMod.default.mean) ||
  ((xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0));

const formatDuration =
  HelpersMod.formatDuration ||
  (HelpersMod.default && HelpersMod.default.formatDuration) ||
  ((s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  });

const accuracyPct = (c, t) => (t ? Math.round((c / t) * 100) : 0);

// Engines (safe)
const audioEngineImported = AudioMod.audioEngine || (AudioMod.default && AudioMod.default.audioEngine) || AudioMod.default || null;

const recordAnswer = GameMod.recordAnswer || (GameMod.default && GameMod.default.recordAnswer) || (() => {});
const addXP = GameMod.addXP || (GameMod.default && GameMod.default.addXP) || (() => {});
const awardPracticeXP = GameMod.awardPracticeXP || (GameMod.default && GameMod.default.awardPracticeXP) || null;

const updateItem = SRSMod.updateItem || (SRSMod.default && SRSMod.default.updateItem) || (async () => {});
const getDueItems = SRSMod.getDueItems || (SRSMod.default && SRSMod.default.getDueItems) || (() => []);
const ITEM_TYPES = SRSMod.ITEM_TYPES || (SRSMod.default && SRSMod.default.ITEM_TYPES) || { RHYTHM: 'RHYTHM' };

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

// Keys (tolerant)
const KEY_MASTERY = STORAGE_KEYS.MASTERY_RHYTHM || 'vmq_mastery_rhythm';
const KEY_CONFUSION = STORAGE_KEYS.CONFUSION_RHYTHM || STORAGE_KEYS.CONFUSION_PATTERNS || 'vmq_confusion_rhythm';

// -------------------------
// Duration palette
// -------------------------
const DURATIONS = [
  { id: 'quarter', label: 'Quarter', symbol: '♩', beats: 1.0 },
  { id: 'eighth', label: 'Eighth', symbol: '♪', beats: 0.5 },
  { id: 'sixteenth', label: 'Sixteenth', symbol: '𝅘𝅥𝅯', beats: 0.25 },
  { id: 'dotted-quarter', label: 'Dotted ¼', symbol: '♩.', beats: 1.5 },
  { id: 'half', label: 'Half', symbol: '𝅗𝅥', beats: 2.0 },
];

// -------------------------
// Storage shapes
// -------------------------
function loadMastered() {
  const data = loadJSON(KEY_MASTERY, {});
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.patterns)) return data.patterns;
  if (Array.isArray(data.masteredPatterns)) return data.masteredPatterns;
  return [];
}
function saveMastered(arr) {
  const data = loadJSON(KEY_MASTERY, {});
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    data.patterns = arr;
    saveJSON(KEY_MASTERY, data);
  } else {
    saveJSON(KEY_MASTERY, { patterns: arr });
  }
}

function loadConfusion() {
  const data = loadJSON(KEY_CONFUSION, {});
  // supports either { byPattern: {}, byPair: {} } or flat map
  if (data && data.byPattern) return { byPattern: data.byPattern || {}, byPair: data.byPair || {} };
  // flat -> treat as byPattern
  return { byPattern: { ...(data || {}) }, byPair: {} };
}
function saveConfusion(state) {
  saveJSON(KEY_CONFUSION, {
    byPattern: state.byPattern || {},
    byPair: state.byPair || {},
  });
}

// -------------------------
// Utility: parse time signature
// -------------------------
function parseTimeSig(ts) {
  const [n, d] = String(ts || '4/4').split('/').map(x => parseInt(x, 10));
  return { beatsPerBar: Number.isFinite(n) ? n : 4, beatUnit: Number.isFinite(d) ? d : 4 };
}

// -------------------------
// Component
// -------------------------
export default function Rhythm(props) {
  const { onBack, showToast, refreshStats, audioEngine } = props || {};
  const engine = audioEngine || audioEngineImported || (window.VMQ && window.VMQ.audioEngine) || null;

  const toast = useCallback((msg, type = 'info') => {
    if (typeof showToast === 'function') return showToast(msg, type);
    if (window.VMQToast && typeof window.VMQToast.show === 'function') return window.VMQToast.show(msg, type);
    if (type === 'error') console.error(msg);
    else console.log(msg);
  }, [showToast]);

  // Core state
  const [mode, setMode] = useState('visual'); // visual | audio | counting | mixed
  const [timeSig, setTimeSig] = useState(TIME_SIGNATURES[0] || '4/4');
  const [tempo, setTempo] = useState(80);

  const [adaptiveConfig, setAdaptiveConfig] = useState({
    level: 1,
    difficulty: 'easy',
    optionCount: CONFIG.OPTION_COUNT_DEFAULT,
    patternPool: [],
  });

  const [currentPattern, setCurrentPattern] = useState(null);
  const [userBeats, setUserBeats] = useState([]);     // array length = pattern beats length, each = duration id or null
  const [selectedTool, setSelectedTool] = useState(DURATIONS[0].id);

  const [showAnswerState, setShowAnswerState] = useState(false);
  const [usedHint, setUsedHint] = useState(false);

  const [stats, setStats] = useState({
    correct: 0, total: 0, streak: 0, perfectStreak: 0, avgResponseTime: 0
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const [masteredPatterns, setMasteredPatterns] = useState([]);
  const [confusionState, setConfusionState] = useState({ byPattern: {}, byPair: {} });
  const [recentPerformance, setRecentPerformance] = useState([]);

  // Refs
  const questionStartRef = useRef(0);
  const playCountRef = useRef(0);
  const perfLogRef = useRef([]);
  const autoAdvanceRef = useRef(null);
  const patternTimerRef = useRef(null);
  const metroTimerRef = useRef(null);

  // Derived
  const { beatsPerBar } = useMemo(() => parseTimeSig(timeSig), [timeSig]);
  const sessionAcc = useMemo(() => accuracyPct(stats.correct, stats.total), [stats.correct, stats.total]);
  const sessionGrade = useMemo(() => {
    const a = sessionAcc;
    if (a >= 95) return 'S';
    if (a >= 90) return 'A';
    if (a >= 80) return 'B';
    if (a >= 70) return 'C';
    return 'D';
  }, [sessionAcc]);

  const isCorrect = useMemo(() => {
    if (!showAnswerState || !currentPattern) return null;
    const target = (currentPattern.beats || []).map(b => b.value);
    if (target.length !== userBeats.length) return false;
    for (let i = 0; i < target.length; i++) {
      if (userBeats[i] !== target[i]) return false;
    }
    return true;
  }, [showAnswerState, currentPattern, userBeats]);

  // Due items set (for weighting)
  const dueSet = useMemo(() => {
    try {
      const due = getDueItems ? (getDueItems('rhythm', 50) || []) : [];
      const set = new Set();
      due.forEach(it => {
        const id = it?.content?.pattern;
        const ts = it?.content?.timeSig || 'any';
        if (id) set.add(`${id}__${ts}`);
      });
      return set;
    } catch {
      return new Set();
    }
  }, [timeSig, stats.total]);

  // ---------------------------------------
  // Pool selection (level + timesig)
  // ---------------------------------------
  const getPatternPoolForLevel = useCallback((levelNum, ts) => {
    const L = clamp(levelNum || 1, 1, 6);
    const pools = {
      1: RHYTHM_PATTERNS.filter(p => p.difficulty === 'easy' && p.timeSig === ts && !p.syncopated),
      2: RHYTHM_PATTERNS.filter(p => ['easy'].includes(p.difficulty) && p.timeSig === ts),
      3: RHYTHM_PATTERNS.filter(p => ['easy', 'medium'].includes(p.difficulty) && p.timeSig === ts),
      4: RHYTHM_PATTERNS.filter(p => p.timeSig === ts && !p.complex),
      5: RHYTHM_PATTERNS.filter(p => p.timeSig === ts && !!p.syncopated),
      6: RHYTHM_PATTERNS.filter(p => p.timeSig === ts),
    };
    return pools[L] || pools[1] || RHYTHM_PATTERNS.filter(p => p.timeSig === ts);
  }, []);

  const calcWeight = useCallback((pattern, levelNum) => {
    let w = 1.0;

    // mastered downweight
    if (masteredPatterns.includes(pattern.id)) w *= 0.3;

    // confusion boost
    const conf = confusionState.byPattern[pattern.id] || 0;
    if (conf > 0) w *= (1 + conf * 0.5);

    // due boost
    if (dueSet.has(`${pattern.id}__${timeSig}`) || dueSet.has(`${pattern.id}__any`)) w *= 2.0;

    // tempo adaptation: faster tempo = slightly harder selection bias
    if (tempo > 100) w *= 1.2;

    // syncopation bias: only start boosting syncopation later
    if (pattern.syncopated && levelNum >= 4) w *= 1.15;

    return w;
  }, [masteredPatterns, confusionState.byPattern, dueSet, timeSig, tempo]);

  const buildWeightedPool = useCallback((levelNum, ts) => {
    const base = getPatternPoolForLevel(levelNum, ts);
    return base
      .map(p => ({ ...p, weight: calcWeight(p, levelNum) }))
      .filter(p => (p.weight || 0) > 0);
  }, [getPatternPoolForLevel, calcWeight]);

  // ---------------------------------------
  // Adaptive config refresh
  // ---------------------------------------
  const refreshAdaptive = useCallback(async () => {
    const mastered = loadMastered();
    const confusion = loadConfusion();
    setMasteredPatterns(mastered);
    setConfusionState(confusion);

    let cfg = null;
    try {
      cfg = getAdaptiveConfig ? await getAdaptiveConfig('rhythm') : await getDifficulty('rhythm');
    } catch {
      cfg = { level: 1, difficulty: 'easy', config: {} };
    }

    const lvl = clamp(cfg?.level || 1, 1, 6);
    const optionCount = clamp(cfg?.config?.optionCount || CONFIG.OPTION_COUNT_DEFAULT, 3, 6);

    const pool = buildWeightedPool(lvl, timeSig);

    setAdaptiveConfig({
      level: lvl,
      difficulty: cfg?.difficulty || cfg?.name || (lvl <= 2 ? 'easy' : lvl <= 4 ? 'medium' : 'hard'),
      optionCount,
      patternPool: pool,
    });
  }, [buildWeightedPool, timeSig]);

  // ---------------------------------------
  // Timer cleanup
  // ---------------------------------------
  const stopPatternPlayback = useCallback(() => {
    if (patternTimerRef.current) {
      clearTimeout(patternTimerRef.current);
      patternTimerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const stopMetronome = useCallback(() => {
    if (metroTimerRef.current) {
      clearInterval(metroTimerRef.current);
      metroTimerRef.current = null;
    }
    try { engine?.stopMetronome?.(); } catch {}
  }, [engine]);

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  // ---------------------------------------
  // Next question (weighted)
  // ---------------------------------------
  const nextQuestion = useCallback(() => {
    clearAutoAdvance();
    stopPatternPlayback();

    const pool = adaptiveConfig.patternPool || [];
    if (!pool.length) return;

    const totalW = pool.reduce((s, p) => s + (p.weight || 1), 0) || 1;
    let r = Math.random() * totalW;
    let picked = pool[0];
    for (const p of pool) {
      r -= (p.weight || 1);
      if (r <= 0) { picked = p; break; }
    }

    const beats = Array.isArray(picked.beats) ? picked.beats : [];
    setCurrentPattern(picked);
    setUserBeats(new Array(beats.length).fill(null));
    setShowAnswerState(false);
    setUsedHint(false);

    setPlayCount(0);
    playCountRef.current = 0;

    questionStartRef.current = Date.now();

    sessionTracker.trackActivity?.('rhythm', 'pattern_shown', {
      pattern: picked.id,
      timeSig,
      tempo,
      level: adaptiveConfig.level,
      weight: picked.weight,
      syncopated: !!picked.syncopated,
    });

    // Auto-play in audio / mixed modes
    if (mode === 'audio' || mode === 'mixed' || mode === 'counting') {
      setTimeout(() => playPattern(), 250);
    }
  }, [adaptiveConfig.patternPool, adaptiveConfig.level, timeSig, tempo, mode, clearAutoAdvance, stopPatternPlayback]);

  // ---------------------------------------
  // Playback (best effort)
  // ---------------------------------------
  const playPattern = useCallback(async () => {
    if (!currentPattern || isPlaying) return;

    if (!engine) {
      toast('Audio engine not available', 'error');
      return;
    }

    const beats = Array.isArray(currentPattern.beats) ? currentPattern.beats : [];
    if (!beats.length) {
      toast('Pattern has no beats', 'error');
      return;
    }

    setIsPlaying(true);
    setPlayCount((p) => {
      const n = p + 1;
      playCountRef.current = n;
      return n;
    });

    // Prefer an engine-native rhythm method if present
    try {
      if (typeof engine.playRhythmPattern === 'function') {
        await engine.playRhythmPattern(currentPattern, tempo, timeSig);
        setIsPlaying(false);
        return;
      }
    } catch (e) {
      console.warn('[Rhythm] engine.playRhythmPattern failed:', e);
    }

    // Fallback: tick scheduling using playMetronomeTick
    if (typeof engine.playMetronomeTick !== 'function') {
      toast('Audio engine missing playMetronomeTick', 'error');
      setIsPlaying(false);
      return;
    }

    const beatMs = 60000 / Math.max(30, tempo);
    const durToSubticks = (id) => {
      // return list of tick offsets inside this beat-unit section (in ms)
      // For quarter: one tick at 0
      // For eighth: ticks at 0 and beatMs/2
      // For sixteenth: ticks at 0, beatMs/4, beatMs/2, 3*beatMs/4 (approximated)
      // For dotted-quarter: tick at 0 (holds longer)
      // For half: tick at 0 (holds longer)
      if (id === 'eighth') return [0, beatMs / 2];
      if (id === 'sixteenth') return [0, beatMs / 4, beatMs / 2, (3 * beatMs) / 4];
      return [0];
    };

    let idx = 0;
    const totalBeats = beats.length;

    const step = () => {
      if (idx >= totalBeats) {
        setIsPlaying(false);
        patternTimerRef.current = null;
        return;
      }

      const isDownbeat = (idx % beatsPerBar) === 0;
      const val = beats[idx]?.value || 'quarter';
      const subticks = durToSubticks(val);

      // schedule subticks within this beat
      subticks.forEach((offset, k) => {
        setTimeout(() => {
          try { engine.playMetronomeTick(isDownbeat && k === 0, k === 0 ? 0.45 : 0.18); } catch {}
        }, offset);
      });

      idx += 1;
      patternTimerRef.current = setTimeout(step, beatMs);
    };

    step();
  }, [engine, currentPattern, tempo, timeSig, isPlaying, beatsPerBar, toast]);

  // ---------------------------------------
  // Hint
  // ---------------------------------------
  const hint = useCallback(() => {
    if (!currentPattern || showAnswerState) return;
    setUsedHint(true);
    const beats = currentPattern.beats || [];
    const first = beats[0]?.value ? `First beat: ${beats[0].value}` : '';
    toast(`💡 Hint: ${timeSig} • ${beats.length} beats. ${first}`.trim(), 'info');
  }, [currentPattern, showAnswerState, timeSig, toast]);

  // ---------------------------------------
  // Confusion + mastery
  // ---------------------------------------
  const recordConfusion = useCallback((patternId, targetBeats, answerBeats) => {
    setConfusionState(prev => {
      const byPattern = { ...(prev.byPattern || {}) };
      const byPair = { ...(prev.byPair || {}) };

      byPattern[patternId] = (byPattern[patternId] || 0) + 1;

      // capture common pair confusions (eighth vs sixteenth, etc.)
      for (let i = 0; i < Math.min(targetBeats.length, answerBeats.length); i++) {
        const t = targetBeats[i];
        const a = answerBeats[i];
        if (!t || !a || t === a) continue;
        const key = `${t}->${a}`;
        byPair[key] = (byPair[key] || 0) + 1;
      }

      const next = { byPattern, byPair };
      saveConfusion(next);

      if (byPattern[patternId] === CONFIG.CONFUSION_THRESHOLD) {
        toast(`⚠️ Pattern mixups detected for this rhythm (${byPattern[patternId]}x)`, 'warning');
      }

      return next;
    });
  }, [toast]);

  const checkForMastery = useCallback((patternId) => {
    const recent = perfLogRef.current
      .filter(p => p.pattern === patternId && p.timeSig === timeSig)
      .slice(-10);

    if (recent.length < 10) return;

    const correctCount = recent.filter(r => r.correct).length;
    const avgT = mean(recent.map(r => r.responseTime));

    if (correctCount >= 9 && avgT < 4500 && tempo >= 90) {
      if (!masteredPatterns.includes(patternId)) {
        setMasteredPatterns(prev => {
          const updated = [...prev, patternId];
          saveMastered(updated);
          toast('🌟 Mastered this rhythm pattern!', 'success');
          return updated;
        });
      }
    }
  }, [timeSig, tempo, masteredPatterns, toast]);

  // ---------------------------------------
  // Check answer (8-engine cascade + tempo adaptation)
  // ---------------------------------------
  const checkAnswer = useCallback(async () => {
    if (!currentPattern) return;

    const target = (currentPattern.beats || []).map(b => b.value);
    const answer = userBeats.slice();

    // require filled
    if (answer.some(v => !v)) {
      toast('Fill all beats before checking.', 'info');
      return;
    }

    const correct = target.length === answer.length && target.every((v, i) => v === answer[i]);
    const responseTime = Math.max(1, Date.now() - (questionStartRef.current || Date.now()));
    const plays = playCountRef.current || 0;

    setShowAnswerState(true);

    // XP calc
    const baseXP = XP_VALUES.CORRECT_ANSWER || XP_VALUES.CORRECTANSWER || 10;
    let xpEarned = baseXP;

    const nextStreak = correct ? (stats.streak + 1) : 0;
    const nextPerfect = (correct && plays <= 1 && !usedHint) ? (stats.perfectStreak + 1) : 0;

    if (correct) {
      if (tempo > 100) xpEarned = Math.ceil(xpEarned * 1.3);
      if (plays <= 1) xpEarned = Math.ceil(xpEarned * 1.2);
      if (usedHint) xpEarned = Math.floor(xpEarned * 0.5);
      xpEarned += (adaptiveConfig.level || 1) * 2;
      if (nextPerfect >= CONFIG.PERFECT_STREAK_THRESHOLD) xpEarned += Math.floor(nextPerfect * 0.5);
    } else {
      xpEarned = Math.floor(xpEarned * 0.3);
      recordConfusion(currentPattern.id, target, answer);
    }

    // Update stats (safe avg time)
    const nextTotal = stats.total + 1;
    const nextCorrect = stats.correct + (correct ? 1 : 0);
    const nextAvg = Math.round((stats.avgResponseTime * stats.total + responseTime) / nextTotal);

    setStats(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
      streak: correct ? (prev.streak + 1) : 0,
      perfectStreak: (correct && plays <= 1 && !usedHint) ? (prev.perfectStreak + 1) : 0,
      avgResponseTime: Math.round((prev.avgResponseTime * prev.total + responseTime) / (prev.total + 1)),
    }));

    // log performance
    const perf = {
      correct,
      pattern: currentPattern.id,
      timeSig,
      tempo,
      responseTime,
      plays,
      usedHint,
      syncopated: !!currentPattern.syncopated,
      level: adaptiveConfig.level,
      timestamp: Date.now(),
    };
    perfLogRef.current.push(perf);
    setRecentPerformance(prev => [...prev, perf].slice(-20));

    // 8-engine cascade
    try { recordAnswer('rhythm', correct, responseTime, { pattern: currentPattern.id, timeSig, tempo }); } catch {}

    try {
      const quality = correct ? (usedHint ? 4 : (plays <= 1 ? 5 : 4)) : 2;
      await updateItem(
        `rhythm_${currentPattern.id}_${timeSig}`,
        quality,
        responseTime,
        {
          type: ITEM_TYPES.RHYTHM,
          pattern: currentPattern.id,
          timeSig,
          tempo,
          beats: target.length,
          syncopated: !!currentPattern.syncopated,
          plays,
          usedHint,
          answer,
        }
      );
    } catch (e) {
      console.warn('[Rhythm] updateItem failed:', e);
    }

    // mastery
    if (correct) checkForMastery(currentPattern.id);

    // awardPracticeXP hook (optional)
    if (typeof awardPracticeXP === 'function') {
      try {
        xpEarned = awardPracticeXP('rhythm', correct, {
          streak: nextStreak,
          perfectStreak: nextPerfect,
          tempo,
          complexity: currentPattern.syncopated ? 2 : 1,
          responseTime,
          plays,
          hint: usedHint,
        });
      } catch {}
    }

    try { addXP(xpEarned, `rhythm_${correct ? 'correct' : 'incorrect'}`); } catch {}
    try { engine?.playFeedback?.(correct); } catch {}

    toast(correct ? `✅ Nice! +${xpEarned} XP` : '❌ Not quite — check the revealed pattern.', correct ? 'success' : 'error');

    // tempo adaptation (local, deterministic)
    // - after every 5 attempts, nudge tempo based on recent accuracy
    if (nextTotal % 5 === 0) {
      const last5 = perfLogRef.current.slice(-5);
      const acc5 = last5.filter(p => p.correct).length / 5;
      let nextTempo = tempo;

      if (acc5 >= 0.8 && tempo < CONFIG.TEMPO_MAX) nextTempo = clamp(tempo + CONFIG.TEMPO_STEP, CONFIG.TEMPO_MIN, CONFIG.TEMPO_MAX);
      if (acc5 <= 0.4 && tempo > CONFIG.TEMPO_MIN) nextTempo = clamp(tempo - CONFIG.TEMPO_STEP, CONFIG.TEMPO_MIN, CONFIG.TEMPO_MAX);

      if (nextTempo !== tempo) setTempo(nextTempo);
    }

    // difficulty adaptation every N questions (engine-based)
    if (nextTotal % CONFIG.MIN_QUESTIONS_FOR_ADAPT === 0) {
      const lastN = perfLogRef.current.slice(-CONFIG.MIN_QUESTIONS_FOR_ADAPT);
      const nAcc = lastN.filter(p => p.correct).length / CONFIG.MIN_QUESTIONS_FOR_ADAPT;
      const avgSec = mean(lastN.map(p => p.responseTime)) / 1000;

      try {
        await adjustDifficulty('rhythm', nAcc, avgSec);
        await refreshAdaptive();
      } catch (e) {
        console.warn('[Rhythm] adjustDifficulty failed:', e);
      }
    }

    // analytics checkpoint
    if (nextTotal % 10 === 0) {
      try {
        recordPerformance('rhythm', nextCorrect / nextTotal, (nextAvg || 0) / 1000, nextCorrect, { timeSig, tempo, level: adaptiveConfig.level });
      } catch {}
      try { analyzePerformance?.('rhythm', perfLogRef.current.slice(-50)); } catch {}
      refreshStats?.();
    }

    // auto-advance
    clearAutoAdvance();
    autoAdvanceRef.current = setTimeout(() => nextQuestion(), correct ? CONFIG.AUTO_ADVANCE_DELAY : CONFIG.AUTO_ADVANCE_DELAY_WRONG);
  }, [
    currentPattern, userBeats, timeSig, tempo, stats, usedHint,
    adaptiveConfig.level, engine, toast,
    recordConfusion, checkForMastery,
    refreshAdaptive, nextQuestion, clearAutoAdvance, refreshStats
  ]);

  // ---------------------------------------
  // Metronome (optional)
  // ---------------------------------------
  const toggleMetronome = useCallback(() => {
    if (!engine) {
      toast('Audio engine not available', 'error');
      return;
    }

    if (metroTimerRef.current) {
      stopMetronome();
      toast('Metronome stopped', 'info');
      return;
    }

    // Prefer engine method
    try {
      if (typeof engine.startMetronome === 'function') {
        engine.startMetronome(tempo, beatsPerBar);
        toast('Metronome started', 'info');
        return;
      }
    } catch {}

    // Fallback: interval tick
    if (typeof engine.playMetronomeTick !== 'function') {
      toast('Audio engine missing metronome tick', 'error');
      return;
    }

    let i = 0;
    const beatMs = 60000 / Math.max(30, tempo);
    metroTimerRef.current = setInterval(() => {
      const down = (i % beatsPerBar) === 0;
      try { engine.playMetronomeTick(down, down ? 0.45 : 0.2); } catch {}
      i++;
    }, beatMs);

    toast('Metronome started', 'info');
  }, [engine, tempo, beatsPerBar, stopMetronome, toast]);

  // ---------------------------------------
  // UI helpers
  // ---------------------------------------
  const canCheck = useMemo(() => {
    if (!currentPattern) return false;
    if (!userBeats.length) return false;
    return userBeats.every(v => !!v);
  }, [currentPattern, userBeats]);

  const revealedTarget = useMemo(() => {
    const beats = currentPattern?.beats || [];
    return beats.map(b => b.value);
  }, [currentPattern]);

  const topConfusions = useMemo(() => {
    const entries = Object.entries(confusionState.byPair || {})
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return entries.map(([k, c]) => ({ key: k, count: c }));
  }, [confusionState.byPair]);

  const sessionSeconds = useMemo(() => {
    // rough: derive from performance timestamps if present
    const first = perfLogRef.current[0]?.timestamp;
    const last = perfLogRef.current[perfLogRef.current.length - 1]?.timestamp;
    if (!first || !last) return 0;
    return Math.max(0, Math.floor((last - first) / 1000));
  }, [stats.total]);

  // ---------------------------------------
  // Lifecycle
  // ---------------------------------------
  useEffect(() => {
    refreshAdaptive();
  }, []); // once

  useEffect(() => {
    // refresh pool when timeSig or tempo changes (tempo affects weight)
    refreshAdaptive();
  }, [timeSig, tempo]);

  useEffect(() => {
    if (adaptiveConfig.patternPool && adaptiveConfig.patternPool.length > 0) {
      nextQuestion();
    }
  }, [adaptiveConfig.patternPool?.length, mode]);

  useEffect(() => {
    return () => {
      clearAutoAdvance();
      stopPatternPlayback();
      stopMetronome();
    };
  }, []);

  // ---------------------------------------
  // Render
  // ---------------------------------------
  return h('div', { className: 'module-container rhythm-v3', role: 'main' },

    // Header
    h('header', { className: 'module-header elevated' },
      h('button', {
        className: 'btn-back',
        onClick: () => { clearAutoAdvance(); stopPatternPlayback(); stopMetronome(); onBack?.(); },
        'aria-label': 'Go back to main menu'
      }, '← Back'),
      h('h2', null, '🥁 Rhythm'),

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
          h('div', { className: 'stat-value' }, masteredPatterns.length),
          h('small', null, 'mastered')
        ),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-value' }, `Lv${adaptiveConfig.level}`),
          h('small', null, adaptiveConfig.difficulty)
        )
      )
    ),

    // Controls
    h('div', {
      style: { display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }
    },
      // Mode
      h('div', { className: 'mode-toggle' },
        ['visual', 'audio', 'counting', 'mixed'].map(m =>
          h('button', {
            key: m,
            className: `btn ${mode === m ? 'btn-primary' : 'btn-outline'} btn-sm`,
            onClick: () => setMode(m),
            title: `Switch to ${m} mode`
          }, m.charAt(0).toUpperCase() + m.slice(1))
        )
      ),

      // Time signature
      h('div', { className: 'mode-toggle' },
        TIME_SIGNATURES.map(ts =>
          h('button', {
            key: ts,
            className: `btn ${timeSig === ts ? 'btn-primary' : 'btn-outline'} btn-sm`,
            onClick: () => setTimeSig(ts)
          }, ts)
        )
      ),

      // Tempo
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', minWidth: '220px' } },
        h('label', null, `Tempo: ${tempo} BPM`),
        h('input', {
          type: 'range',
          min: String(CONFIG.TEMPO_MIN),
          max: String(CONFIG.TEMPO_MAX),
          value: tempo,
          onChange: (e) => setTempo(Number(e.target.value)),
          className: 'slider'
        })
      ),

      // Tools
      h('div', { className: 'mode-toggle' },
        h('button', { className: 'btn btn-outline btn-sm', onClick: hint, disabled: !currentPattern || showAnswerState }, '💡 Hint'),
        h('button', { className: 'btn btn-outline btn-sm', onClick: toggleMetronome }, metroTimerRef.current ? '⏹ Metro' : '⏰ Metro'),
        h('button', { className: 'btn btn-outline btn-sm', onClick: () => nextQuestion() }, '↻ New')
      )
    ),

    // Main card
    h('div', { className: 'card rhythm-display elevated' },

      // Prompt line
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-md)' } },
        h('div', null,
          h('h3', { style: { margin: 0 } }, mode === 'visual' ? 'Copy the rhythm' : 'Listen and reproduce'),
          currentPattern?.name && h('small', { className: 'text-muted' }, currentPattern.name)
        ),
        h('small', { className: 'text-muted' }, sessionSeconds ? `Session: ${formatDuration(sessionSeconds)}` : '')
      ),

      // Playback buttons
      h('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' } },
        h('button', {
          className: 'btn btn-primary',
          onClick: playPattern,
          disabled: !currentPattern || isPlaying
        }, isPlaying ? 'Playing…' : `▶️ Play (${playCount + 1}x)`),
        h('button', {
          className: 'btn btn-outline',
          onClick: stopPatternPlayback,
          disabled: !isPlaying
        }, '⏹ Stop')
      ),

      // Target pattern visual (only when visual mode OR after reveal)
      (currentPattern && (mode === 'visual' || showAnswerState)) && h('div', {
        className: 'pattern-visual large',
        style: { marginTop: 'var(--space-lg)' }
      },
        (currentPattern.beats || []).map((b, i) => {
          const d = DURATIONS.find(x => x.id === b.value);
          return h('span', { key: i, className: 'rhythm-note' }, d?.symbol || b.symbol || b.value);
        })
      ),

      // Tool palette
      h('div', { style: { marginTop: 'var(--space-lg)' } },
        h('small', { className: 'text-muted' }, 'Select a value, then tap each beat slot:'),
        h('div', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' } },
          DURATIONS.map(d =>
            h('button', {
              key: d.id,
              className: `btn btn-sm ${selectedTool === d.id ? 'btn-primary' : 'btn-outline'}`,
              onClick: () => setSelectedTool(d.id),
              title: d.label
            }, `${d.symbol} ${d.label}`)
          )
        )
      ),

      // Answer slots
      currentPattern && h('div', {
        className: 'answer-grid rhythm-answer-grid',
        style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-md)' }
      },
        userBeats.map((val, i) => {
          const d = DURATIONS.find(x => x.id === val);
          const shown = d?.symbol || (val ? val : '—');

          let slotClass = 'btn btn-outline';
          if (showAnswerState) {
            const target = revealedTarget[i];
            if (val === target) slotClass = 'btn btn-primary';
          }

          return h('button', {
            key: i,
            className: slotClass,
            style: { minWidth: '58px' },
            disabled: showAnswerState,
            onClick: () => {
              setUserBeats(prev => {
                const next = prev.slice();
                next[i] = selectedTool;
                return next;
              });
            },
            title: `Beat ${i + 1}`
          }, shown);
        })
      ),

      // Check / Feedback
      h('div', { style: { marginTop: 'var(--space-lg)' } },
        !showAnswerState
          ? h('button', {
              className: 'btn btn-primary btn-lg',
              style: { width: '100%' },
              onClick: checkAnswer,
              disabled: !canCheck || !currentPattern
            }, '✅ Check Pattern')
          : currentPattern && h('div', { className: `feedback-card ${isCorrect ? 'success' : 'error'} elevated` },
              h('div', { style: { fontSize: '1.25rem' } }, isCorrect ? '✅ Correct' : '❌ Incorrect'),
              h('div', { className: 'text-muted', style: { marginTop: 'var(--space-xs)' } },
                `${timeSig} • ${tempo} BPM • ${currentPattern.syncopated ? 'Syncopated' : 'Straight'}`
              ),
              !isCorrect && h('div', { style: { marginTop: 'var(--space-sm)' } },
                h('small', { className: 'text-muted' }, 'Correct pattern (revealed above).')
              ),
              h('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' } },
                h('button', { className: 'btn btn-outline', onClick: playPattern }, '▶️ Replay'),
                h('button', { className: 'btn btn-primary', onClick: nextQuestion }, '➡️ Next')
              )
            )
      )
    ),

    // Confusion panel
    topConfusions.length > 0 && h('div', { className: 'card card-warning' },
      h('h4', null, '⚠️ Common Mixups'),
      h('ul', null,
        topConfusions.map(x => h('li', { key: x.key }, `${x.key} (${x.count}x)`))
      )
    ),

    // Quick reference / browse
    h('div', { className: 'card' },
      h('h3', null, 'Patterns'),
      h('div', { className: 'module-grid' },
        (adaptiveConfig.patternPool || []).slice(0, 8).map(p =>
          h('div', {
            key: p.id,
            className: `module-stat ${masteredPatterns.includes(p.id) ? 'mastered' : ''}`,
            style: { cursor: 'pointer' },
            onClick: () => {
              clearAutoAdvance();
              stopPatternPlayback();
              setCurrentPattern(p);
              setUserBeats(new Array((p.beats || []).length).fill(null));
              setShowAnswerState(false);
              setUsedHint(false);
              setPlayCount(0);
              playCountRef.current = 0;
              questionStartRef.current = Date.now();
            }
          },
            h('h4', null, p.name || p.id),
            h('div', { className: 'pattern-visual small' },
              (p.beats || []).map((b, i) => {
                const d = DURATIONS.find(x => x.id === b.value);
                return h('span', { key: i, className: 'rhythm-note' }, d?.symbol || b.symbol || b.value);
              })
            ),
            h('small', { className: 'text-muted' }, `${p.timeSig || timeSig} • ${p.difficulty || ''}${p.syncopated ? ' • syncopated' : ''}`)
          )
        )
      )
    )
  );
}
