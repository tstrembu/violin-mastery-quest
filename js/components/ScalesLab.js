// js/components/ScalesLab.js
// ======================================
// SCALES LAB v3.0 (Drop-in, Hardened)
// Unified Harmony Explorer + ML-Adaptive Trainer + Interactive Quiz
// Production-ready with fallback safety + deep analytics integration
// ======================================

const { createElement: h, useState, useEffect, useCallback, useMemo, useRef } = React;

// --- ESM-safe (namespace) imports to avoid "module script failed" when exports drift ---
import * as ConstantsMod from '../config/constants.js';
import * as HelpersMod from '../utils/helpers.js';
import * as AudioMod from '../engines/audioEngine.js';
import * as SRSMod from '../engines/spacedRepetition.js';
import * as GameMod from '../engines/gamification.js';
import * as AnalyticsMod from '../engines/analytics.js';
import * as DifficultyMod from '../engines/difficultyAdapter.js';
import * as SessionMod from '../engines/sessionTracker.js';
import * as KeyboardMod from '../utils/keyboard.js';

// ---------------------------------------------------------------------------
// SAFE ACCESSORS / FALLBACKS
// ---------------------------------------------------------------------------

const CONFIG =
  ConstantsMod.CONFIG ||
  (ConstantsMod.default && ConstantsMod.default.CONFIG) ||
  {};

const NATURAL_NOTES =
  ConstantsMod.NATURAL_NOTES ||
  (ConstantsMod.default && ConstantsMod.default.NATURAL_NOTES) ||
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SHARPS =
  ConstantsMod.SHARPS ||
  (ConstantsMod.default && ConstantsMod.default.SHARPS) ||
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FLATS =
  ConstantsMod.FLATS ||
  (ConstantsMod.default && ConstantsMod.default.FLATS) ||
  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const clamp =
  HelpersMod.clamp ||
  (HelpersMod.default && HelpersMod.default.clamp) ||
  ((v, lo, hi) => Math.max(lo, Math.min(hi, v)));

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

const midiToFreq =
  HelpersMod.midiToFreq ||
  (HelpersMod.default && HelpersMod.default.midiToFreq) ||
  ConstantsMod.midiToFreq ||
  (ConstantsMod.default && ConstantsMod.default.midiToFreq) ||
  ((midi) => 440 * Math.pow(2, (midi - 69) / 12));

const sessionTracker =
  SessionMod.sessionTracker ||
  (SessionMod.default && SessionMod.default.sessionTracker) ||
  { trackActivity: () => {}, getCurrentSession: () => null };

const keyboard = KeyboardMod.keyboard || (KeyboardMod.default && KeyboardMod.default.keyboard) || { register: () => {}, unregister: () => {} };
const a11y = KeyboardMod.a11y || (KeyboardMod.default && KeyboardMod.default.a11y) || { announce: () => {} };

// Audio engine: support either default export OR named export "audioEngine"
const audioEngineImported =
  AudioMod.audioEngine ||
  (AudioMod.default && (AudioMod.default.audioEngine || AudioMod.default)) ||
  null;

// SRS
const updateItem = SRSMod.updateItem || (SRSMod.default && SRSMod.default.updateItem) || (async () => {});
const getDueItems = SRSMod.getDueItems || (SRSMod.default && SRSMod.default.getDueItems) || (() => []);
const ITEM_TYPES = SRSMod.ITEM_TYPES || (SRSMod.default && SRSMod.default.ITEM_TYPES) || { SCALE: 'SCALE' };

// Optional SRS helpers (exist in some builds, not others)
const getMasteryByScaleRoot =
  SRSMod.getMasteryByScaleRoot || (SRSMod.default && SRSMod.default.getMasteryByScaleRoot) || null;

const getConfusionMatrix =
  SRSMod.getConfusionMatrix || (SRSMod.default && SRSMod.default.getConfusionMatrix) || null;

// Gamification
const awardPracticeXP = GameMod.awardPracticeXP || (GameMod.default && GameMod.default.awardPracticeXP) || null;
const recordAnswer = GameMod.recordAnswer || (GameMod.default && GameMod.default.recordAnswer) || (() => {});
const addXP = GameMod.addXP || (GameMod.default && GameMod.default.addXP) || (() => {});
const getUserLevel = GameMod.getUserLevel || (GameMod.default && GameMod.default.getUserLevel) || (async () => 1);

// Analytics / difficulty adaptation (tolerant)
const getAdaptiveConfig =
  DifficultyMod.getAdaptiveConfig ||
  (DifficultyMod.default && DifficultyMod.default.getAdaptiveConfig) ||
  AnalyticsMod.getAdaptiveConfig ||
  (AnalyticsMod.default && AnalyticsMod.default.getAdaptiveConfig) ||
  (async () => ({}));

const updateStats =
  AnalyticsMod.updateStats ||
  (AnalyticsMod.default && AnalyticsMod.default.updateStats) ||
  (() => {});

const analyzePerformance =
  AnalyticsMod.analyzePerformance ||
  (AnalyticsMod.default && AnalyticsMod.default.analyzePerformance) ||
  (() => {});

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const SCALE_TYPES = [
  { id: 'major',           name: 'Major',            pattern: [2,2,1,2,2,2,1], color: '#4CAF50', emoji: '🔑', difficulty: 1.0 },
  { id: 'minor_natural',   name: 'Natural Minor',    pattern: [2,1,2,2,1,2,2], color: '#FF9800', emoji: '🌿', difficulty: 1.2 },
  { id: 'minor_harmonic',  name: 'Harmonic Minor',   pattern: [2,1,2,2,1,3,1], color: '#F44336', emoji: '🎻', difficulty: 1.5 },
  { id: 'minor_melodic',   name: 'Melodic Minor',    pattern: [2,1,2,2,2,2,1], color: '#9C27B0', emoji: '✨', difficulty: 1.6 },
  { id: 'pentatonic',      name: 'Major Pentatonic', pattern: [2,2,3,2,3],     color: '#2196F3', emoji: '⭐', difficulty: 0.8 },
  { id: 'blues',           name: 'Blues',            pattern: [3,2,1,1,3,2],   color: '#795548', emoji: '🎸', difficulty: 1.3 },
];

const ROOTS = [
  { midi: 60, name: 'C'  }, { midi: 61, name: 'C#' }, { midi: 62, name: 'D'  },
  { midi: 63, name: 'D#' }, { midi: 64, name: 'E'  }, { midi: 65, name: 'F'  },
  { midi: 66, name: 'F#' }, { midi: 67, name: 'G'  }, { midi: 68, name: 'G#' },
  { midi: 69, name: 'A'  }, { midi: 70, name: 'A#' }, { midi: 71, name: 'B'  },
];

const MODES = [
  { id: 'explore', label: 'Explore',    description: 'Click notes to learn scale degrees', icon: '🎛️' },
  { id: 'trainer', label: 'ML Trainer', description: 'Adaptive practice focusing on weak areas', icon: '🤖' },
  { id: 'quiz',    label: 'Quiz',       description: 'Identify degrees + scale types', icon: '📝' },
];

// Local tuning
const LOCAL = {
  TEMPO_MIN: 40,
  TEMPO_MAX: 160,
  TEMPO_STEP: 4,
  DEFAULT_TEMPO: 80,
  AUTO_ADVANCE_MS: 700,
  TRAINER_AUTOPLAY_DELAY: 250,
  MASTERED_THRESHOLD: 0.85,
  WEAK_THRESHOLD: 0.70,
  QUIZ_LEN: 10,
  ...CONFIG,
};

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

function getOrdinalSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function midiNoteName(midi, prefer = 'sharps') {
  const arr = prefer === 'flats' ? FLATS : SHARPS;
  const name = arr[midi % 12] || NATURAL_NOTES[midi % 12] || '?';
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// Mastery color scale (HSL green=120°, red=0°)
function getMasteryHSL(mastery) {
  const x = clamp(Number(mastery || 0), 0, 1);
  const hue = x * 120;
  return `hsl(${Math.round(hue)}, 70%, 50%)`;
}

function weightedPick(items, weightKey = 'weight') {
  const total = items.reduce((s, it) => s + Math.max(0, Number(it[weightKey] || 0)), 0);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, Number(it[weightKey] || 0));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function safeToast(showToast, msg, type = 'info') {
  if (typeof showToast === 'function') return showToast(msg, type);
  if (window.VMQToast && typeof window.VMQToast.show === 'function') return window.VMQToast.show(msg, type);
  if (type === 'error') console.error(msg);
  else console.log(msg);
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function ScalesLab({ onBack, showToast, refreshStats, audioEngine }) {
  const engine = audioEngine || audioEngineImported || (window.VMQ && window.VMQ.audioEngine) || null;

  // -------------------------------------------------------------------------
  // CORE STATE
  // -------------------------------------------------------------------------
  const [root, setRoot] = useState(60);
  const [scaleType, setScaleType] = useState('major');
  const [mode, setMode] = useState('explore');

  const [tempo, setTempo] = useState(LOCAL.DEFAULT_TEMPO);
  const [playMode, setPlayMode] = useState('updown'); // up | down | updown
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedNote, setHighlightedNote] = useState(-1);

  // ML / analytics
  const [adaptiveConfig, setAdaptiveConfig] = useState({});
  const [userLevel, setUserLevel] = useState(1);

  // mastery/confusion (safe local shapes)
  const [scaleMastery, setScaleMastery] = useState({}); // key `${scaleId}-${rootMidi}` -> 0..1
  const [confusionPairs, setConfusionPairs] = useState([]); // array of "scaleIdA-scaleIdB" or similar

  // Session stats
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, streak: 0, accuracy: 0 });

  // Trainer pool
  const [trainerPool, setTrainerPool] = useState([]); // [{ scaleId, rootMidi, mastery, weight }]
  const trainerStartRef = useRef(0);

  // Quiz state
  const [quizKind, setQuizKind] = useState('degree'); // degree | identify
  const [quizTargetDegree, setQuizTargetDegree] = useState(null); // { degreeIdx, midi }
  const [quizTargetScale, setQuizTargetScale] = useState(null); // { rootMidi, scaleId }
  const [quizProgress, setQuizProgress] = useState({ current: 0, score: 0, maxScore: LOCAL.QUIZ_LEN });
  const quizStartRef = useRef(0);

  // Playback cancellation
  const playTimerRef = useRef(null);
  const playSeqRef = useRef({ token: 0 });

  const currentScaleData = useMemo(
    () => SCALE_TYPES.find(s => s.id === scaleType) || SCALE_TYPES[0],
    [scaleType]
  );

  const rootName = useMemo(
    () => ROOTS.find(r => r.midi === root)?.name || midiNoteName(root, 'sharps'),
    [root]
  );

  // -------------------------------------------------------------------------
  // SCALE NOTES (memo)
  // -------------------------------------------------------------------------
  const scaleNotes = useMemo(() => {
    const pattern = currentScaleData.pattern || [];
    const notes = [root];
    let cur = root;
    for (const step of pattern) {
      cur += step;
      notes.push(cur);
    }
    return notes;
  }, [root, currentScaleData]);

  // -------------------------------------------------------------------------
  // INIT: load config + mastery + confusion
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [lvl, cfg] = await Promise.all([
          getUserLevel().catch(() => 1),
          getAdaptiveConfig('scaleslab').catch(() => ({})),
        ]);

        // Mastery/confusion: prefer engine helpers; otherwise default empty.
        const [mastery, confusion] = await Promise.all([
          (getMasteryByScaleRoot ? getMasteryByScaleRoot('scaleslab') : Promise.resolve({})).catch(() => ({})),
          (getConfusionMatrix ? getConfusionMatrix('scaleslab') : Promise.resolve({ pairs: [] })).catch(() => ({ pairs: [] })),
        ]);

        if (cancelled) return;

        setUserLevel(clamp(Number(lvl || 1), 1, 10));
        setAdaptiveConfig(cfg || {});
        setScaleMastery(mastery && typeof mastery === 'object' ? mastery : {});
        setConfusionPairs(Array.isArray(confusion?.pairs) ? confusion.pairs : []);

        if (cfg?.targetTempo && tempo === LOCAL.DEFAULT_TEMPO) {
          setTempo(clamp(Math.round(cfg.targetTempo), LOCAL.TEMPO_MIN, LOCAL.TEMPO_MAX));
        }

        sessionTracker.trackActivity?.('scaleslab', 'init', {
          userLevel: lvl,
          targetTempo: cfg?.targetTempo || null,
          masteryKeys: mastery ? Object.keys(mastery).length : 0,
          confusionCount: Array.isArray(confusion?.pairs) ? confusion.pairs.length : 0,
        });
      } catch (err) {
        console.warn('[ScalesLab] Init failed (graceful):', err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // CLEANUP: stop playback timers
  // -------------------------------------------------------------------------
  const stopPlayback = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    playSeqRef.current.token++;
    setIsPlaying(false);
    setHighlightedNote(-1);
    try { engine?.stopAll?.(); } catch {}
  }, [engine]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // -------------------------------------------------------------------------
  // PLAYBACK (safe, cancels properly)
  // -------------------------------------------------------------------------
  const playScale = useCallback((opts = {}) => {
    if (isPlaying) return;
    if (!engine) {
      safeToast(showToast, 'Audio engine not available', 'error');
      return;
    }

    const notes = scaleNotes;
    if (!notes.length) return;

    const playDir = opts.playMode || playMode;
    let seq = notes.slice();
    if (playDir === 'down') seq = seq.slice().reverse();
    if (playDir === 'updown') seq = [...notes, ...notes.slice(0, -1).reverse()];

    const intervalMs = Math.round(60000 / clamp(tempo, LOCAL.TEMPO_MIN, LOCAL.TEMPO_MAX));
    const token = ++playSeqRef.current.token;

    setIsPlaying(true);
    setHighlightedNote(-1);

    sessionTracker.trackActivity?.('scaleslab', 'play', {
      root: rootName,
      scaleType,
      tempo,
      playMode: playDir,
      difficulty: currentScaleData.difficulty,
      mode,
      intent: opts.intent || 'practice',
    });

    let i = 0;
    const startTs = (performance && performance.now) ? performance.now() : Date.now();

    const step = () => {
      if (token !== playSeqRef.current.token) return; // cancelled
      if (i >= seq.length) {
        setIsPlaying(false);
        setHighlightedNote(-1);

        const endTs = (performance && performance.now) ? performance.now() : Date.now();
        const duration = Math.max(1, endTs - startTs);

        try {
          updateStats?.('scaleslab', true, duration / Math.max(1, seq.length), {
            root,
            scaleType,
            playMode: playDir,
            notes: seq.length,
            tempo,
            mode,
          });
        } catch {}

        // Session stats: treat completed playback as a "rep"
        setSessionStats(prev => {
          const correct = prev.correct + 1;
          const total = prev.total + 1;
          const streak = prev.streak + 1;
          return { correct, total, streak, accuracy: Math.round((correct / total) * 100) };
        });

        return;
      }

      const midi = seq[i];
      const freq = midiToFreq(midi);

      try {
        // Prefer violin note if present; else generic tone
        if (typeof engine.playViolinNote === 'function') {
          engine.playViolinNote(freq, 1.0, 'medium', root, scaleType);
        } else if (typeof engine.playTone === 'function') {
          engine.playTone(freq, 0.65, 'triangle');
        } else if (typeof engine.playNote === 'function') {
          engine.playNote(freq, 0.65);
        }
      } catch (e) {
        console.warn('[ScalesLab] playback error (ignored):', e);
      }

      setHighlightedNote(i);
      i += 1;

      playTimerRef.current = setTimeout(step, intervalMs);
    };

    step();
  }, [engine, isPlaying, scaleNotes, tempo, playMode, rootName, root, scaleType, currentScaleData.difficulty, mode, showToast]);

  // -------------------------------------------------------------------------
  // EXPLORE: click note to hear and label
  // -------------------------------------------------------------------------
  const handleExploreClick = useCallback((midi, index) => {
    if (!engine) return;

    try {
      engine.playTone?.(midiToFreq(midi), 0.7, 'sine');
    } catch {}

    setHighlightedNote(index);

    try {
      recordAnswer('scaleslab', true, 250, { mode: 'explore', root, scaleType, midi, index });
      sessionTracker.trackActivity?.('scaleslab', 'explore_note', { midi, index, root, scaleType });
    } catch {}

    safeToast(showToast, midiNoteName(midi), 'success');
  }, [engine, root, scaleType, showToast]);

  // -------------------------------------------------------------------------
  // TRAINER: build weighted pool (mastery + due items + confusion)
  // -------------------------------------------------------------------------
  const initTrainerMode = useCallback(() => {
    const lvl = clamp(userLevel || 1, 1, 10);

    // choose scale set based on level (keeps intent: earlier levels = fewer types)
    const allowedScaleTypes = SCALE_TYPES.filter(s => {
      if (lvl <= 1) return s.id === 'major' || s.id === 'pentatonic';
      if (lvl === 2) return ['major', 'minor_natural', 'pentatonic'].includes(s.id);
      if (lvl === 3) return ['major', 'minor_natural', 'minor_harmonic', 'pentatonic'].includes(s.id);
      return true;
    });

    // due items support (if present)
    const due = (() => {
      try { return getDueItems?.('scaleslab', 50) || []; } catch { return []; }
    })();
    const dueSet = new Set(
      due
        .map(it => it?.content?.key || it?.content?.scaleKey || it?.id || '')
        .filter(Boolean)
    );

    const pool = [];

    for (const st of allowedScaleTypes) {
      for (const r of ROOTS) {
        const key = `${st.id}-${r.midi}`;
        const mastery = clamp(Number(scaleMastery[key] ?? 0.5), 0, 1);

        // base weight favors weaker items
        let weight = 0.25 + (1 - mastery) * 2.25;

        // bump if due
        if (dueSet.has(key) || dueSet.has(`scale:${key}`) || dueSet.has(`scaleslab:${key}`)) weight *= 1.8;

        // bump if confusion mentions this scale type (best-effort)
        const confused = confusionPairs.some(p => String(p).includes(st.id));
        if (confused) weight *= 1.15;

        // difficulty multiplier
        weight *= (st.difficulty || 1.0);

        pool.push({ scaleId: st.id, rootMidi: r.midi, mastery, weight, key });
      }
    }

    // If mastery dataset empty, still provide a pool
    const finalPool = pool.length ? pool : ROOTS.map(r => ({ scaleId: 'major', rootMidi: r.midi, mastery: 0.5, weight: 1, key: `major-${r.midi}` }));

    setTrainerPool(finalPool);
    trainerStartRef.current = Date.now();

    sessionTracker.trackActivity?.('scaleslab', 'trainer_init', {
      poolSize: finalPool.length,
      weakCount: finalPool.filter(p => p.mastery < LOCAL.WEAK_THRESHOLD).length,
      level: lvl,
    });
  }, [userLevel, scaleMastery, confusionPairs]);

  const nextTrainerQuestion = useCallback(() => {
    if (!trainerPool.length) return;

    const pick = weightedPick(trainerPool, 'weight');
    if (!pick) return;

    setScaleType(pick.scaleId);
    setRoot(pick.rootMidi);
    setHighlightedNote(-1);

    trainerStartRef.current = Date.now();

    a11y.announce?.(`Practice ${ROOTS.find(x => x.midi === pick.rootMidi)?.name || midiNoteName(pick.rootMidi)} ${SCALE_TYPES.find(s => s.id === pick.scaleId)?.name || pick.scaleId}`);

    // Autoplay to reinforce ear training
    setTimeout(() => playScale({ intent: 'trainer', playMode: 'updown' }), LOCAL.TRAINER_AUTOPLAY_DELAY);
  }, [trainerPool, playScale]);

  // -------------------------------------------------------------------------
  // QUIZ: (A) degree quiz, (B) identify scale type by ear
  // -------------------------------------------------------------------------
  const generateDegreeQuiz = useCallback(() => {
    const notes = scaleNotes;
    if (!notes.length) return;

    const degreeIdx = Math.floor(Math.random() * notes.length);
    setQuizTargetDegree({ degreeIdx, midi: notes[degreeIdx] });
    quizStartRef.current = Date.now();
    setHighlightedNote(-1);

    a11y.announce?.(`Find the ${degreeIdx + 1}${getOrdinalSuffix(degreeIdx + 1)} degree of ${rootName} ${currentScaleData.name}`);
  }, [scaleNotes, rootName, currentScaleData]);

  const generateIdentifyQuiz = useCallback(() => {
    // pick from trainer pool when possible (weighted toward weak)
    let target = null;

    if (trainerPool && trainerPool.length) {
      target = weightedPick(trainerPool, 'weight');
    } else {
      const st = SCALE_TYPES[Math.floor(Math.random() * SCALE_TYPES.length)];
      const r = ROOTS[Math.floor(Math.random() * ROOTS.length)];
      target = { scaleId: st.id, rootMidi: r.midi, key: `${st.id}-${r.midi}` };
    }

    setQuizTargetScale({ scaleId: target.scaleId, rootMidi: target.rootMidi });
    quizStartRef.current = Date.now();
    setHighlightedNote(-1);

    // Immediately set the internal state to that target for playback (but do not reveal the type)
    setRoot(target.rootMidi);

    a11y.announce?.('Listen to the scale and identify the scale type.');
  }, [trainerPool]);

  const playQuizPrompt = useCallback(() => {
    if (!quizTargetScale) return;
    // temporarily play the target scale without changing the visible scaleType selection permanently
    const prevType = scaleType;
    setScaleType(quizTargetScale.scaleId);

    // play, then restore after scheduling starts (so visual stays stable if you prefer)
    setTimeout(() => {
      playScale({ intent: 'quiz', playMode: 'updown' });
      // Restore selection for UI neutrality (user is guessing type)
      setTimeout(() => setScaleType(prevType), 0);
    }, 0);
  }, [quizTargetScale, scaleType, playScale]);

  const bumpSessionStats = useCallback((isCorrect) => {
    setSessionStats(prev => {
      const correct = prev.correct + (isCorrect ? 1 : 0);
      const total = prev.total + 1;
      const streak = isCorrect ? prev.streak + 1 : 0;
      return { correct, total, streak, accuracy: Math.round((correct / total) * 100) };
    });
  }, []);

  const awardXP = useCallback(async (isCorrect, difficulty, responseTime, meta) => {
    try {
      if (typeof awardPracticeXP === 'function') {
        const xpVal = await awardPracticeXP('scaleslab', isCorrect, meta || {});
        if (typeof xpVal === 'number' && Number.isFinite(xpVal)) {
          addXP(xpVal, `scaleslab_${isCorrect ? 'correct' : 'wrong'}`);
          return xpVal;
        }
      }
    } catch {}
    // fallback: small deterministic
    const xp = isCorrect ? Math.round(10 * (difficulty || 1)) : 3;
    try { addXP(xp, `scaleslab_${isCorrect ? 'correct' : 'wrong'}`); } catch {}
    return xp;
  }, []);

  const handleDegreeAnswer = useCallback(async (midi, index) => {
    if (!quizTargetDegree) return;

    const isCorrect = index === quizTargetDegree.degreeIdx;
    const responseTime = quizStartRef.current ? (Date.now() - quizStartRef.current) : 0;

    try { engine?.playTone?.(midiToFreq(midi), 0.65, isCorrect ? 'sine' : 'triangle'); } catch {}
    try { recordAnswer('scaleslab', isCorrect, responseTime, { quiz: 'degree', root, scaleType, degree: quizTargetDegree.degreeIdx + 1 }); } catch {}

    // SRS update (best-effort)
    try {
      const key = `scaleslab_degree_${scaleType}_${root}_${quizTargetDegree.degreeIdx + 1}`;
      const quality = isCorrect ? 4 : 1;
      await updateItem(key, quality, responseTime, {
        type: ITEM_TYPES.SCALE,
        root,
        scaleType,
        degree: quizTargetDegree.degreeIdx + 1,
        quiz: 'degree',
      });
    } catch {}

    // analytics
    try { updateStats?.('scaleslab', isCorrect, responseTime, { mode: 'quiz_degree', root, scaleType }); } catch {}

    bumpSessionStats(isCorrect);

    // quiz progress
    setQuizProgress(prev => {
      const nextCurrent = prev.current + 1;
      const nextScore = prev.score + (isCorrect ? 1 : 0);
      return { ...prev, current: nextCurrent, score: nextScore };
    });

    const xp = await awardXP(isCorrect, currentScaleData.difficulty, responseTime, { quiz: 'degree', responseTime, scaleType });

    if (isCorrect) safeToast(showToast, `${midiNoteName(midi)} ✓ +${xp}XP`, 'success');
    else safeToast(showToast, `Target: ${midiNoteName(quizTargetDegree.midi)} (+${xp}XP)`, 'error');

    // next question
    setTimeout(() => generateDegreeQuiz(), LOCAL.AUTO_ADVANCE_MS);
  }, [
    quizTargetDegree, engine, root, scaleType, currentScaleData.difficulty,
    showToast, bumpSessionStats, awardXP, generateDegreeQuiz
  ]);

  const handleIdentifyAnswer = useCallback(async (pickedScaleId) => {
    if (!quizTargetScale) return;

    const isCorrect = pickedScaleId === quizTargetScale.scaleId;
    const responseTime = quizStartRef.current ? (Date.now() - quizStartRef.current) : 0;

    try { recordAnswer('scaleslab', isCorrect, responseTime, { quiz: 'identify', pickedScaleId, targetScaleId: quizTargetScale.scaleId, root: quizTargetScale.rootMidi }); } catch {}

    // SRS update (best-effort)
    try {
      const key = `scaleslab_identify_${quizTargetScale.scaleId}_${quizTargetScale.rootMidi}`;
      const quality = isCorrect ? 4 : 1;
      await updateItem(key, quality, responseTime, {
        type: ITEM_TYPES.SCALE,
        root: quizTargetScale.rootMidi,
        scaleType: quizTargetScale.scaleId,
        quiz: 'identify',
        pickedScaleId,
      });
    } catch {}

    try { updateStats?.('scaleslab', isCorrect, responseTime, { mode: 'quiz_identify', root: quizTargetScale.rootMidi, target: quizTargetScale.scaleId, pickedScaleId }); } catch {}

    bumpSessionStats(isCorrect);

    setQuizProgress(prev => {
      const nextCurrent = prev.current + 1;
      const nextScore = prev.score + (isCorrect ? 1 : 0);
      return { ...prev, current: nextCurrent, score: nextScore };
    });

    const targetName = SCALE_TYPES.find(s => s.id === quizTargetScale.scaleId)?.name || quizTargetScale.scaleId;
    const pickedName = SCALE_TYPES.find(s => s.id === pickedScaleId)?.name || pickedScaleId;

    const xp = await awardXP(isCorrect, (SCALE_TYPES.find(s => s.id === quizTargetScale.scaleId)?.difficulty || 1), responseTime, { quiz: 'identify', responseTime });

    safeToast(
      showToast,
      isCorrect ? `✅ Correct: ${pickedName} (+${xp}XP)` : `❌ You chose ${pickedName}. Target was ${targetName}. (+${xp}XP)`,
      isCorrect ? 'success' : 'error'
    );

    setTimeout(() => {
      generateIdentifyQuiz();
      setTimeout(() => playQuizPrompt(), 200);
    }, LOCAL.AUTO_ADVANCE_MS);
  }, [quizTargetScale, showToast, bumpSessionStats, awardXP, generateIdentifyQuiz, playQuizPrompt]);

  // -------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // -------------------------------------------------------------------------
  useEffect(() => {
    keyboard.register?.('space', () => (mode === 'quiz' && quizKind === 'identify') ? playQuizPrompt() : playScale(), 'Play scale');
    keyboard.register?.('escape', stopPlayback, 'Stop');
    keyboard.register?.('arrowleft', () => setRoot(prev => Math.max(48, prev - 1)), 'Previous root');
    keyboard.register?.('arrowright', () => setRoot(prev => Math.min(84, prev + 1)), 'Next root');
    keyboard.register?.('u', () => setPlayMode('up'), 'Upward');
    keyboard.register?.('d', () => setPlayMode('down'), 'Downward');
    keyboard.register?.('b', () => setPlayMode('updown'), 'Up & Down');
    keyboard.register?.('q', () => setMode(m => (m === 'explore' ? 'quiz' : m === 'quiz' ? 'trainer' : 'explore')), 'Cycle modes');

    return () => {
      keyboard.unregister?.('space', 'escape', 'arrowleft', 'arrowright', 'u', 'd', 'b', 'q');
    };
  }, [mode, quizKind, playQuizPrompt, playScale, stopPlayback]);

  // -------------------------------------------------------------------------
  // MODE-SPECIFIC INIT
  // -------------------------------------------------------------------------
  useEffect(() => {
    stopPlayback();

    if (mode === 'trainer') {
      initTrainerMode();
      // pick immediately
      setTimeout(() => nextTrainerQuestion(), 50);
    }

    if (mode === 'quiz') {
      // reset quiz progress when entering quiz
      setQuizProgress({ current: 0, score: 0, maxScore: LOCAL.QUIZ_LEN });

      // ensure trainer pool exists for identify quiz weighting
      initTrainerMode();

      if (quizKind === 'degree') {
        generateDegreeQuiz();
        sessionTracker.trackActivity?.('scaleslab', 'quiz_start', { kind: 'degree', root, scaleType });
      } else {
        generateIdentifyQuiz();
        setTimeout(() => playQuizPrompt(), 250);
        sessionTracker.trackActivity?.('scaleslab', 'quiz_start', { kind: 'identify' });
      }
    }

    if (mode === 'explore') {
      sessionTracker.trackActivity?.('scaleslab', 'explore_start', { root, scaleType });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, quizKind]);

  // when root/scale changes during quiz-degree, regenerate prompt
  useEffect(() => {
    if (mode === 'quiz' && quizKind === 'degree') generateDegreeQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, scaleType]);

  // -------------------------------------------------------------------------
  // PERIODIC ANALYTICS CHECKPOINT (lightweight)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (sessionStats.total > 0 && sessionStats.total % 10 === 0) {
      try {
        analyzePerformance?.('scaleslab', {
          total: sessionStats.total,
          correct: sessionStats.correct,
          accuracy: sessionStats.accuracy,
          streak: sessionStats.streak,
          mode,
          root,
          scaleType,
          tempo,
        });
      } catch {}
      try { refreshStats?.(); } catch {}
    }
  }, [sessionStats.total]); // intentional

  // -------------------------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------------------------
  const masteryForCurrent = clamp(Number(scaleMastery[`${scaleType}-${root}`] ?? 0), 0, 1);
  const masteryPct = Math.round(masteryForCurrent * 100);
  const masteryClass =
    masteryForCurrent >= LOCAL.MASTERED_THRESHOLD ? 'mastered' :
    masteryForCurrent >= LOCAL.WEAK_THRESHOLD ? 'good' : 'needs-work';

  const quizDone = quizProgress.current >= quizProgress.maxScore;

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return h('div', { className: 'module-container scales-lab-v3', role: 'main' },

    // Header
    h('header', { className: 'module-header scales-header' },
      h('button', { className: 'btn-back', onClick: () => { stopPlayback(); onBack?.(); } }, '← Back'),
      h('h1', null, '🎼 Scales Lab'),

      h('div', { className: 'header-stats', 'aria-live': 'polite', 'aria-atomic': 'true' },
        h('span', { className: 'stat accuracy' },
          `${sessionStats.correct}/${sessionStats.total} `,
          h('small', null, `${sessionStats.accuracy}%`)
        ),
        h('span', { className: 'stat streak' },
          sessionStats.streak >= 5 ? '🔥' : '',
          ` ${sessionStats.streak} `,
          h('small', null, 'streak')
        ),
        h('span', { className: `stat mastery ${masteryClass}` },
          `${masteryPct}% `,
          h('small', null, 'mastery')
        )
      )
    ),

    // Mode Selector
    h('section', { className: 'mode-selector' },
      MODES.map(m =>
        h('button', {
          key: m.id,
          className: `mode-btn ${mode === m.id ? 'active' : ''}`,
          onClick: () => setMode(m.id),
          title: m.description
        },
          `${m.icon} ${m.label}`,
          h('small', null, m.description)
        )
      )
    ),

    // Quiz kind toggle (only in quiz)
    mode === 'quiz' && h('div', { className: 'card', style: { marginBottom: 'var(--space-md)' } },
      h('div', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' } },
        h('strong', null, 'Quiz type:'),
        h('button', {
          className: `btn btn-sm ${quizKind === 'degree' ? 'btn-primary' : 'btn-outline'}`,
          onClick: () => setQuizKind('degree')
        }, 'Degree'),
        h('button', {
          className: `btn btn-sm ${quizKind === 'identify' ? 'btn-primary' : 'btn-outline'}`,
          onClick: () => setQuizKind('identify')
        }, 'Identify by ear'),
        h('span', { className: 'text-muted', style: { marginLeft: 'auto' } },
          `Q ${Math.min(quizProgress.current + 1, quizProgress.maxScore)}/${quizProgress.maxScore} • Score ${quizProgress.score}`
        )
      ),
      quizDone && h('div', { style: { marginTop: 'var(--space-sm)' } },
        h('strong', null, `Quiz complete: ${quizProgress.score}/${quizProgress.maxScore}`),
        h('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' } },
          h('button', {
            className: 'btn btn-primary',
            onClick: () => {
              setQuizProgress({ current: 0, score: 0, maxScore: LOCAL.QUIZ_LEN });
              if (quizKind === 'degree') generateDegreeQuiz();
              else { generateIdentifyQuiz(); setTimeout(() => playQuizPrompt(), 200); }
            }
          }, 'Restart'),
          h('button', { className: 'btn btn-outline', onClick: () => setMode('trainer') }, 'Go to Trainer')
        )
      )
    ),

    // Controls: Root & Scale selection (disabled in identify-quiz to avoid giving away answer)
    h('div', { className: 'scales-controls' },

      // Roots
      h('div', { className: 'control-group' },
        h('label', null, 'Root:'),
        h('div', { className: 'root-selector' },
          ROOTS.map(r => {
            const key = `${scaleType}-${r.midi}`;
            const m = clamp(Number(scaleMastery[key] ?? 0), 0, 1);
            const weak = m < LOCAL.WEAK_THRESHOLD;
            const disabled = (mode === 'quiz' && quizKind === 'identify');
            return h('button', {
              key: r.midi,
              className: `root-btn ${root === r.midi ? 'active' : ''} ${weak ? 'needs-work' : ''}`,
              style: { backgroundColor: currentScaleData.color, opacity: weak ? 0.85 : 1 },
              disabled,
              onClick: () => {
                setRoot(r.midi);
                a11y.announce?.(`${r.name} root selected`);
              }
            }, r.name);
          })
        )
      ),

      // Scale types
      h('div', { className: 'control-group' },
        h('label', null, 'Scale:'),
        h('div', { className: 'scale-selector' },
          SCALE_TYPES.map(scale => {
            const disabled = (mode === 'quiz' && quizKind === 'identify');
            const isConfused = confusionPairs.some(p => String(p).includes(scale.id));
            return h('button', {
              key: scale.id,
              className: `scale-btn ${scaleType === scale.id ? 'active' : ''} ${isConfused ? 'confusion' : ''}`,
              style: { backgroundColor: scale.color },
              disabled,
              onClick: () => {
                setScaleType(scale.id);
                a11y.announce?.(`${scale.name} scale selected`);
              },
              title: isConfused ? 'Commonly confused scale' : ''
            }, `${scale.emoji} ${scale.name}`);
          })
        )
      )
    ),

    // Playback Controls
    h('div', { className: 'playback-controls' },
      h('div', { className: 'tempo-control' },
        h('label', null, `Tempo: ${tempo} BPM`),
        h('input', {
          type: 'range',
          min: LOCAL.TEMPO_MIN,
          max: LOCAL.TEMPO_MAX,
          step: LOCAL.TEMPO_STEP,
          value: tempo,
          onChange: e => setTempo(parseInt(e.target.value, 10)),
          className: 'tempo-slider',
          'aria-label': 'Tempo in beats per minute'
        }),
        adaptiveConfig?.targetTempo && h('small', { className: 'adaptive-hint' }, `AI suggests: ${Math.round(adaptiveConfig.targetTempo)} BPM`)
      ),

      h('div', { className: 'play-controls' },
        h('button', {
          className: `btn-play ${isPlaying ? 'playing' : ''}`,
          onClick: () => {
            if (mode === 'quiz' && quizKind === 'identify') playQuizPrompt();
            else playScale();
          },
          disabled: isPlaying,
          'aria-label': 'Play scale'
        }, isPlaying ? '🔊 Playing...' : '▶️ Play'),

        h('button', { className: 'btn btn-outline', onClick: stopPlayback, disabled: !isPlaying }, '⏹ Stop'),

        h('div', { className: 'play-mode-toggle' },
          ['up', 'down', 'updown'].map(pm =>
            h('button', {
              key: pm,
              className: `btn-sm ${playMode === pm ? 'active' : ''}`,
              onClick: () => setPlayMode(pm)
            }, pm.toUpperCase())
          )
        )
      )
    ),

    // Mode-specific content blocks
    mode === 'explore' && h('div', { className: 'card explore-content' },
      h('div', null, 'Select a root + scale, then click notes (or press SPACE) to learn degrees and sound.'),
      h('small', { className: 'text-muted' }, 'Shortcuts: SPACE play • ←→ root • U/D/B play mode • Q cycle modes')
    ),

    mode === 'trainer' && h('section', { className: 'trainer-content card' },
      h('div', { className: 'trainer-prompt' },
        h('strong', null, `Trainer: ${rootName} ${currentScaleData.name}`),
        h('small', { className: 'text-muted' }, `Mastery: ${masteryPct}% • Level: ${userLevel}`),
        h('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' } },
          h('button', { className: 'btn btn-primary', onClick: () => playScale({ intent: 'trainer' }) }, 'Play'),
          h('button', { className: 'btn btn-outline', onClick: nextTrainerQuestion }, 'Skip → Next')
        )
      )
    ),

    mode === 'quiz' && h('section', { className: 'quiz-content card' },
      quizKind === 'degree'
        ? (quizTargetDegree
            ? h('div', null,
                h('h3', null, `Find the ${quizTargetDegree.degreeIdx + 1}${getOrdinalSuffix(quizTargetDegree.degreeIdx + 1)} degree`),
                h('small', { className: 'text-muted' }, `Root: ${rootName} • Scale: ${currentScaleData.name} • Click a note below`)
              )
            : h('div', null, 'Loading quiz…'))
        : h('div', null,
            h('h3', null, 'Identify the scale type (by ear)'),
            h('small', { className: 'text-muted' }, 'Press SPACE or click Play, then choose the type below.'),
            h('div', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' } },
              SCALE_TYPES.map(s =>
                h('button', {
                  key: s.id,
                  className: 'btn btn-outline btn-sm',
                  onClick: () => handleIdentifyAnswer(s.id),
                  disabled: quizDone
                }, `${s.emoji} ${s.name}`)
              )
            )
          )
    ),

    // Scale visualization (staff-like SVG)
    h('section', { className: 'scale-visualizer' },
      h('div', { className: 'scale-staff' },
        h('svg', {
          width: '100%',
          height: 200,
          viewBox: '0 0 1000 200',
          className: 'scale-svg',
          role: 'img',
          'aria-label': `${rootName} ${currentScaleData.name} scale - mastery ${masteryPct}%`
        },

          // Staff lines
          [0, 1, 2, 3, 4].map(i =>
            h('line', {
              key: `staff-${i}`,
              x1: 50, y1: 60 + i * 25,
              x2: 950, y2: 60 + i * 25,
              stroke: 'var(--ink)',
              strokeWidth: 2
            })
          ),

          // Treble clef (best effort glyph)
          h('text', { x: 80, y: 140, fontSize: 50, fill: 'var(--ink)', fontFamily: 'serif' }, '𝄞'),

          // Notes
          scaleNotes.map((midi, i) => {
            const x = 200 + i * 110;

            // NOTE: This y-mapping is "visual learner friendly" not true engraving.
            const y = 140 - ((midi - root) * 3.2);

            // Color: explore uses primary; trainer/quiz uses mastery-ish
            let fill = 'var(--primary)';
            if (mode !== 'explore') {
              const noteKey = `${scaleType}-${root}-note-${i}`;
              fill = getMasteryHSL(scaleMastery[noteKey] ?? 0.5);
            }

            const isActive = i === highlightedNote;

            return h('g', { key: `note-${i}` },
              h('circle', {
                cx: x,
                cy: y,
                r: isActive ? 16 : 12,
                fill: isActive ? currentScaleData.color : fill,
                stroke: 'var(--ink)',
                strokeWidth: 2,
                className: `scale-note ${isActive ? 'active' : ''}`,
                role: 'button',
                tabIndex: 0,
                onClick: () => {
                  if (mode === 'explore') handleExploreClick(midi, i);
                  else if (mode === 'quiz' && quizKind === 'degree' && quizTargetDegree && !quizDone) handleDegreeAnswer(midi, i);
                },
                onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (mode === 'explore') handleExploreClick(midi, i);
                    else if (mode === 'quiz' && quizKind === 'degree' && quizTargetDegree && !quizDone) handleDegreeAnswer(midi, i);
                  }
                }
              }),
              h('text', {
                x,
                y: y + 5,
                textAnchor: 'middle',
                fontSize: 14,
                fill: isActive ? 'white' : 'currentColor',
                fontWeight: 'bold'
              }, (SHARPS[midi % 12] || NATURAL_NOTES[midi % 12] || '?'))
            );
          })
        )
      ),

      // Info bar
      h('div', { className: 'scale-info' },
        h('div', null,
          h('strong', null, `${rootName} ${currentScaleData.name}`),
          h('small', { className: 'text-muted' }, `Pattern: ${currentScaleData.pattern.join(' - ')}`)
        ),
        h('div', { className: `mastery-badge ${masteryClass}` }, `Mastery: ${masteryPct}%`),
        h('div', { className: 'keyboard-hints' },
          h('kbd', null, 'SPACE'), h('small', null, 'Play'),
          h('kbd', null, '←→'), h('small', null, 'Root'),
          h('kbd', null, 'Q'), h('small', null, 'Next mode')
        )
      )
    ),

    // Live session indicator (best effort)
    h('div', { className: 'session-status' },
      h('span', { className: 'live-dot' }, '●'),
      h('small', null, (sessionTracker.getCurrentSession?.()?.activity) || 'Scales Lab v3.0')
    )
  );
}
