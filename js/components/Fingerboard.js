// js/components/Fingerboard.js
// ======================================
// FINGERBOARD v3.0.5 - ML-ADAPTIVE VIOLIN MASTERY
// Position Confusion • Optimal Fingering • 8-Engine Live
// ======================================

const { createElement: h, useState, useEffect, useCallback, useMemo, useRef } = React;

import { MUSIC, getRandomWeighted, getFingeringDifficulty } from '../utils/helpers.js';
import { audioEngine } from '../engines/audioEngine.js';
import {
  updateItem,
  ITEM_TYPES,
  getDueItems,
  getConfusionMatrix,
  getMasteryByPosition
} from '../engines/spacedRepetition.js';
import { addXP, recordAnswer, getUserLevel } from '../engines/gamification.js';
import { getAdaptiveConfig, analyzeFingerboardPerformance } from '../engines/analytics.js';
import { keyboard, a11y } from '../utils/keyboard.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { useVMQRouter, VMQ_ROUTES } from '../utils/router.js';
import { useGamification, useNotifications } from '../contexts/AppContext.js';
import { FEATURES } from '../config/version.js';

// -----------------------------
// Core data
// -----------------------------
const STRINGS = [
  { id: 'G', openMidi: 55, color: '#f39c12', name: 'G3', tension: 'medium' },
  { id: 'D', openMidi: 62, color: '#2ecc71', name: 'D4', tension: 'low' },
  { id: 'A', openMidi: 69, color: '#3498db', name: 'A4', tension: 'medium' },
  { id: 'E', openMidi: 76, color: '#e74c3c', name: 'E5', tension: 'high' }
];

const POSITIONS = [1, 2, 3, 4, 5, 7, 9]; // standard violin milestones

const FINGERS = [
  { id: '1',  semitones: 0, label: '1',  extension: false },
  { id: '2',  semitones: 2, label: '2',  extension: false },
  { id: '3',  semitones: 4, label: '3',  extension: false },
  { id: '4',  semitones: 5, label: '4',  extension: false },
  { id: '1x', semitones: 7, label: '1×', extension: true }
];

// -----------------------------
// Violin-accurate position model
// -----------------------------
// These are semitone offsets from open string to the *1st finger* for each position.
// This corrects the original (position-1)*4 formula which is not violin-accurate.
const POSITION_1ST_FINGER_OFFSET = {
  1: 2,   // 1st pos: 1st finger is a whole step above open string
  2: 4,   // 2nd pos
  3: 5,   // 3rd pos
  4: 7,   // 4th pos
  5: 9,   // 5th pos
  7: 12,  // 7th pos ~ octave
  9: 16   // 9th pos ~ octave + major 3rd
};

// -----------------------------
// Defaults + small utilities
// -----------------------------
const DEFAULT_CONFIG = {
  level: 1,
  positions: 3,   // number of unlocked positions (slice of POSITIONS)
  strings: 4,     // unlocked strings (1-4)
  maxQuestions: 30,
  autoPlayTrainer: true,
  trainerVibrato: 0.3
};

function clampInt(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(x)));
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function safeCall(fn, ...args) {
  try { return (typeof fn === 'function') ? fn(...args) : undefined; }
  catch (_) { return undefined; }
}

async function safeAsync(promiseLike) {
  try { return await Promise.resolve(promiseLike); }
  catch (_) { return undefined; }
}

// Confusion data can be many shapes; normalize to:
// - midiSet: Set<midiNumber>
// - pairs: Set<"lo-hi"> (optional future use)
// - weights: Map<"lo-hi", weight>
function normalizeConfusion(confusionData) {
  const raw = confusionData?.pairs ?? confusionData ?? [];
  const arr = Array.isArray(raw) ? raw : [];

  const midiSet = new Set();
  const pairs = new Set();
  const weights = new Map();

  for (const item of arr) {
    if (typeof item === 'number') {
      midiSet.add(item);
      continue;
    }
    if (item && typeof item === 'object') {
      if (typeof item.midi === 'number') {
        midiSet.add(item.midi);
        continue;
      }
      const a = item.a ?? item.from ?? item.src;
      const b = item.b ?? item.to ?? item.dst;
      if (typeof a === 'number' && typeof b === 'number') {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const k = `${lo}-${hi}`;
        pairs.add(k);
        if (Number.isFinite(Number(item.weight))) weights.set(k, Number(item.weight));
      }
    }
  }

  return { midiSet, pairs, weights };
}

// Mastery data can be:
// - numeric score (0..1)
// - object { attempts, correct, accuracy }
// Normalize to { attempts, correct, accuracy0to1 } for each key.
function normalizeMastery(masteryRaw) {
  const out = {};
  if (!masteryRaw || typeof masteryRaw !== 'object') return out;

  for (const [k, v] of Object.entries(masteryRaw)) {
    if (typeof v === 'number') {
      out[k] = { attempts: 0, correct: 0, accuracy: clamp01(v) };
      continue;
    }
    if (v && typeof v === 'object') {
      const attempts = clampInt(v.attempts ?? 0, 0, 999999);
      const correct = clampInt(v.correct ?? 0, 0, 999999);
      const acc = (Number.isFinite(Number(v.accuracy)))
        ? clamp01(v.accuracy)
        : (attempts > 0 ? clamp01(correct / attempts) : 0);
      out[k] = { attempts, correct, accuracy: acc };
    }
  }
  return out;
}

function masteryKey(stringId, position) {
  return `${stringId}-${position}`;
}

function accuracyGrade(accPct) {
  const a = Number(accPct) || 0;
  if (a >= 95) return 'S';
  if (a >= 90) return 'A';
  if (a >= 85) return 'B';
  if (a >= 80) return 'C';
  return 'D';
}

function firstFingerOffset(position) {
  return POSITION_1ST_FINGER_OFFSET[position] ?? POSITION_1ST_FINGER_OFFSET[1];
}

// Compute note info using violin-correct model:
// midi = openMidi + firstFingerOffset(position) + finger.semitones
function computeNoteInfo({ stringIdx, position, fingerId, confusion }) {
  const string = STRINGS[stringIdx] || STRINGS[0];
  const finger = FINGERS.find(f => f.id === fingerId) || FINGERS[0];

  const base = firstFingerOffset(position);
  const midi = string.openMidi + base + finger.semitones;

  const noteName = safeCall(MUSIC?.midiToNoteName, midi) || `MIDI ${midi}`;
  const octave = Math.floor(midi / 12) - 1;
  const fullName = `${noteName}${octave}`;
  const freq = safeCall(MUSIC?.midiToFreq, midi) || 440 * Math.pow(2, (midi - 69) / 12);

  const diff = safeCall(getFingeringDifficulty, position, stringIdx, midi);
  const difficulty = Number.isFinite(Number(diff)) ? Number(diff) : 1.0;

  const confusionScore = confusion?.midiSet?.has(midi) ? 1.5 : 1.0;

  return {
    midi,
    freq,
    name: noteName,
    octave,
    fullName,
    string: string.id,
    stringIdx,
    position,
    finger: finger.label,
    fingerId: finger.id,
    difficulty,
    confusionScore
  };
}

// Generate challenging notes inside unlocked ranges.
// Keeps your intent: extension finger mainly early positions (<=3) unless you later expand.
function generateChallengingNotes(maxPosCount, maxStrCount, confusion) {
  const posList = POSITIONS.slice(0, clampInt(maxPosCount, 1, POSITIONS.length));
  const strCount = clampInt(maxStrCount, 1, 4);

  const challenging = [];
  for (let s = 0; s < strCount; s++) {
    for (const pos of posList) {
      for (const f of FINGERS) {
        if (f.extension && pos > 3) continue;
        const info = computeNoteInfo({ stringIdx: s, position: pos, fingerId: f.id, confusion });
        if ((info.difficulty || 1) > 1.2) {
          challenging.push({ stringIdx: s, position: pos, fingerId: f.id, difficulty: info.difficulty });
        }
      }
    }
  }
  return challenging;
}

// If an item is midi-only (from due/confusion), find a playable fingering inside unlocked set.
function findPlayableForMidi(targetMidi, maxPosCount, maxStrCount, confusion) {
  const posList = POSITIONS.slice(0, clampInt(maxPosCount, 1, POSITIONS.length));
  const strCount = clampInt(maxStrCount, 1, 4);

  let best = null;
  for (let s = 0; s < strCount; s++) {
    for (const pos of posList) {
      for (const f of FINGERS) {
        if (f.extension && pos > 3) continue;
        const info = computeNoteInfo({ stringIdx: s, position: pos, fingerId: f.id, confusion });
        if (info.midi !== targetMidi) continue;

        // “Optimal fingering” heuristic: prefer lower difficulty, then lower position, then lower string index
        const score = (info.difficulty || 1) * (info.confusionScore || 1) + (pos * 0.05) + (s * 0.02);
        if (!best || score < best.score) best = { ...info, score };
      }
    }
  }
  return best ? { ...best } : null;
}

// Normalize due items returned by SR engine to an internal shape:
// { stringIdx, position, fingerId, midi?, difficulty?, weight? }
function normalizeDueItem(item) {
  if (!item) return null;

  // midi-only
  if (typeof item.midi === 'number') return { midi: item.midi };

  // possible keys from earlier prototype
  const stringIdx = (typeof item.stringIdx === 'number')
    ? item.stringIdx
    : (typeof item.string === 'number' ? item.string : null);

  const position = item.position;
  const fingerId = item.fingerId ?? item.finger;

  if (typeof stringIdx === 'number' && Number.isFinite(Number(position)) && typeof fingerId === 'string') {
    return { stringIdx, position: Number(position), fingerId };
  }

  return null;
}

// -----------------------------
// Component
// -----------------------------
export default function Fingerboard({ onBack, refreshStats }) {
  // Feature gate (if FEATURES exists)
  const enabled = (FEATURES && typeof FEATURES.FINGERBOARD !== 'undefined') ? FEATURES.FINGERBOARD : true;

  // 🎯 ML-ADAPTIVE CORE STATE
  const [mode, setMode] = useState('explore'); // explore | quiz | trainer
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });

  // Default selected string should be valid index (0..3). The prompt’s snippet uses 1.
  const [selectedString, setSelectedString] = useState(0);
  const [selectedPosition, setSelectedPosition] = useState(POSITIONS[0]);
  const [selectedFinger, setSelectedFinger] = useState('1');

  const [targetNote, setTargetNote] = useState(null);
  const [userAnswer, setUserAnswer] = useState(null);

  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0, accuracy: 0 });
  const [isPlaying, setIsPlaying] = useState(false);

  const [positionMastery, setPositionMastery] = useState({});
  const [confusion, setConfusion] = useState(() => normalizeConfusion([]));
  const [statusLine, setStatusLine] = useState('');

  const inputRef = useRef(null);
  const questionStartRef = useRef(nowMs());
  const answeredLockRef = useRef(false);
  const timerRef = useRef(null);

  // 🎯 8-ENGINE HOOKS (safe)
  const router = safeCall(useVMQRouter) || {};
  const navigate = router.navigate || (() => {});
  const gamCtx = safeCall(useGamification) || {};
  const updateXP = gamCtx.updateXP;
  const notifCtx = safeCall(useNotifications) || {};
  const addNotification = notifCtx.addNotification || (() => {});

  // -----------------------------
  // Init adaptive (ML)
  // -----------------------------
  const initAdaptiveFingerboard = useCallback(async () => {
    const userLevel = await safeAsync(safeCall(getUserLevel));
    const adaptiveConfig = await safeAsync(safeCall(getAdaptiveConfig, 'fingerboard'));
    const masteryRaw = await safeAsync(safeCall(getMasteryByPosition, 'fingerboard'));
    const confusionRaw = await safeAsync(safeCall(getConfusionMatrix, 'fingerboard'));

    const adaptive = (adaptiveConfig && typeof adaptiveConfig === 'object') ? adaptiveConfig : {};
    const lvl = Number.isFinite(Number(adaptive.level)) ? Number(adaptive.level) : (Number(userLevel) || 1);

    const positionsUnlocked = clampInt(lvl + 2, 1, POSITIONS.length);
    const stringsUnlocked = clampInt(lvl + 1, 1, 4);

    const maxQuestions = Number.isFinite(Number(adaptive.maxQuestions))
      ? clampInt(adaptive.maxQuestions, 5, 200)
      : DEFAULT_CONFIG.maxQuestions;

    const normalizedMastery = normalizeMastery(masteryRaw);
    const normalizedConfusion = normalizeConfusion(confusionRaw);

    // weak positions list (accuracy < 0.7)
    const weakPositions = Object.entries(normalizedMastery)
      .filter(([, v]) => (v?.accuracy ?? 0) < 0.7)
      .map(([k]) => k);

    setConfig(prev => ({
      ...prev,
      ...adaptive,
      level: lvl,
      positions: positionsUnlocked,
      strings: stringsUnlocked,
      maxQuestions,
      weakPositions
    }));

    setPositionMastery(normalizedMastery);
    setConfusion(normalizedConfusion);

    safeCall(sessionTracker?.trackActivity, 'fingerboard', 'adaptive_init', {
      level: lvl,
      positionsUnlocked,
      stringsUnlocked,
      weakPositionsCount: weakPositions.length,
      confusionMidiCount: normalizedConfusion.midiSet.size,
      confusionPairCount: normalizedConfusion.pairs.size
    });

    setStatusLine(`Adaptive loaded: Lv${lvl} • ${positionsUnlocked} pos • ${stringsUnlocked} str`);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    initAdaptiveFingerboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // If mode changes, clear timers and locks as needed
  useEffect(() => {
    answeredLockRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setUserAnswer(null);

    if (mode === 'trainer') {
      setStatusLine('Trainer: find the target note on the fingerboard.');
      // start with a question
      setTimeout(() => { nextQuestion(); }, 0);
    } else if (mode === 'quiz') {
      setTargetNote(null);
      setStatusLine('Quiz: set a target (or let the system pick one) and answer.');
    } else {
      setTargetNote(null);
      setStatusLine('Explore: tap any stop to hear a note.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // -----------------------------
  // Note info
  // -----------------------------
  const getNoteInfo = useCallback((stringIdx, position, fingerId) => {
    return computeNoteInfo({ stringIdx, position, fingerId, confusion });
  }, [confusion]);

  // -----------------------------
  // Audio (enhanced + fallback)
  // -----------------------------
  const playNote = useCallback(async (stringIdx, position, fingerId, opts = {}) => {
    if (isPlaying) return;

    setIsPlaying(true);
    const info = getNoteInfo(stringIdx, position, fingerId);

    try {
      const duration = opts.duration ?? 1.2;
      const vibrato = opts.vibrato ?? 0;

      // Preferred: playViolinNote(freq, duration, params, onEnd?)
      if (audioEngine?.playViolinNote) {
        await audioEngine.playViolinNote(info.freq, duration, {
          string: STRINGS[stringIdx]?.tension || 'medium',
          position,
          finger: fingerId,
          vibrato
        });
      } else if (audioEngine?.playTone) {
        await audioEngine.playTone(info.freq, duration);
      } else if (audioEngine?.playNote) {
        await audioEngine.playNote(info.freq, duration);
      }

      safeCall(sessionTracker?.trackActivity, 'fingerboard', 'note_played_v3', {
        midi: info.midi,
        fullName: info.fullName,
        string: info.string,
        position: info.position,
        finger: info.finger,
        mode,
        difficulty: info.difficulty
      });

      safeCall(a11y?.announce, `${info.fullName} on ${info.string} string, position ${info.position}, finger ${info.finger}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[Fingerboard v3.0.5] Audio failed:', error);
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, getNoteInfo, mode]);

  // -----------------------------
  // ML-weighted question generation
  // -----------------------------
  const nextQuestion = useCallback(async () => {
    if (!enabled) return;

    answeredLockRef.current = false;
    setUserAnswer(null);

    const weakNotesRaw = await safeAsync(safeCall(getDueItems, 'fingerboard', 20));
    const weakNotesArr = Array.isArray(weakNotesRaw) ? weakNotesRaw : [];
    const weakNotes = weakNotesArr.map(normalizeDueItem).filter(Boolean);

    const confusionNotes = Array.from(confusion.midiSet).map(midi => ({ midi }));

    const challenging = generateChallengingNotes(config.positions, config.strings, confusion);

    // Weighted pool: 50% weak, 30% confusion, 20% challenging
    const pool = [
      ...weakNotes.map(n => ({ ...n, weight: 3.0 })),
      ...confusionNotes.map(n => ({ ...n, weight: 2.5 })),
      ...challenging.map(n => ({ ...n, weight: 1.5 + (n.difficulty || 1) * 0.5 }))
    ];

    // Fail-safe: if pool empty, pick a deterministic note
    const chosen = (pool.length && safeCall(getRandomWeighted, pool)) || pool[0] || { stringIdx: 0, position: POSITIONS[0], fingerId: '1' };

    let info = null;

    if (typeof chosen.midi === 'number') {
      // Convert midi into a playable fingering within unlocked range
      info = findPlayableForMidi(chosen.midi, config.positions, config.strings, confusion);
      if (!info) {
        // fallback: first challenging note or a safe default
        const fb = challenging[0] || { stringIdx: 0, position: POSITIONS[0], fingerId: '1' };
        info = getNoteInfo(fb.stringIdx, fb.position, fb.fingerId);
      }
    } else {
      // chosen already has fingering fields; normalize & compute
      const sIdx = clampInt(chosen.stringIdx ?? 0, 0, 3);
      const posList = POSITIONS.slice(0, clampInt(config.positions, 1, POSITIONS.length));
      const pos = posList.includes(chosen.position) ? chosen.position : posList[0];
      const fingerId = FINGERS.some(f => f.id === chosen.fingerId) ? chosen.fingerId : '1';
      info = getNoteInfo(sIdx, pos, fingerId);
    }

    setTargetNote(info);
    questionStartRef.current = nowMs();

    safeCall(a11y?.announce, `Find ${info.fullName}. Level ${config.level}.`);
    setStatusLine(`Find: ${info.fullName} (Lv${config.level})`);

    if (mode === 'trainer' && config.autoPlayTrainer) {
      setTimeout(() => {
        playNote(info.stringIdx, info.position, info.fingerId, { duration: 1.3, vibrato: config.trainerVibrato });
      }, 450);
    }
  }, [enabled, config, confusion, getNoteInfo, playNote, mode]);

  // -----------------------------
  // Mastery update helper (local)
  // -----------------------------
  const bumpMastery = useCallback((stringId, position, isCorrect) => {
    const k = masteryKey(stringId, position);

    setPositionMastery(prev => {
      const cur = prev[k] || { attempts: 0, correct: 0, accuracy: 0 };
      const attempts = (cur.attempts || 0) + 1;
      const correct = (cur.correct || 0) + (isCorrect ? 1 : 0);
      const accuracy = attempts ? correct / attempts : 0;
      return { ...prev, [k]: { attempts, correct, accuracy: clamp01(accuracy) } };
    });
  }, []);

  // -----------------------------
  // XP award helper (context-first, fallback to engine)
  // -----------------------------
  const awardXP = useCallback(async (xp, reason) => {
    const amount = Math.max(0, Math.round(Number(xp) || 0));
    if (!amount) return;

    if (typeof updateXP === 'function') {
      try { updateXP(amount, reason); return; } catch (_) {}
    }
    await safeAsync(safeCall(addXP, amount, reason));
  }, [updateXP]);

  // -----------------------------
  // Check answer (ML + 8-engine)
  // -----------------------------
  const checkAnswer = useCallback(async (stringIdx, position, fingerId) => {
    if (!targetNote) return;
    if (answeredLockRef.current) return;

    const answerInfo = getNoteInfo(stringIdx, position, fingerId);
    const isCorrect = (answerInfo.midi === targetNote.midi);

    answeredLockRef.current = true;
    setUserAnswer(answerInfo);

    const responseTime = Math.max(0, nowMs() - (questionStartRef.current || nowMs()));

    // Record answer (gamification engine)
    await safeAsync(safeCall(recordAnswer, 'fingerboard_v3', isCorrect, responseTime, {
      targetMidi: targetNote.midi,
      targetFullName: targetNote.fullName,
      targetString: targetNote.string,
      targetPosition: targetNote.position,
      targetFinger: targetNote.finger,
      answerMidi: answerInfo.midi,
      answerFullName: answerInfo.fullName,
      answerString: answerInfo.string,
      answerPosition: answerInfo.position,
      answerFinger: answerInfo.finger,
      difficulty: targetNote.difficulty,
      confusionScore: targetNote.confusionScore,
      level: config.level,
      mode
    }));

    // Update mastery
    bumpMastery(targetNote.string, targetNote.position, isCorrect);

    // Update stats (avoid stale closure by using functional setState)
    setStats(prev => {
      const correct = prev.correct + (isCorrect ? 1 : 0);
      const total = prev.total + 1;
      const streak = isCorrect ? (prev.streak + 1) : 0;
      const accuracy = total ? Math.round((correct / total) * 100) : 0;
      const next = { correct, total, streak, accuracy };
      safeCall(refreshStats, next);
      return next;
    });

    // Difficulty-weighted XP
    const positionMultiplier = (targetNote.position > 3) ? 1.5 : 1.2;
    const difficultyFactor = clamp01((Number(targetNote.difficulty) || 1) / 2) + 0.75; // ~0.75..1.25
    const xp = Math.round(20 * positionMultiplier * (targetNote.confusionScore || 1) * difficultyFactor);

    if (isCorrect) {
      // Update spaced repetition item
      // Use stable ID to avoid string formatting issues.
      const itemId = `fingerboard_${targetNote.midi}_${targetNote.string}_${targetNote.position}`;

      await safeAsync(safeCall(updateItem, itemId, 4, responseTime, {
        type: ITEM_TYPES?.POSITION_NOTE || 'POSITION_NOTE',
        midi: targetNote.midi,
        fullName: targetNote.fullName,
        position: targetNote.position,
        string: targetNote.string
      }));

      await awardXP(xp, 'fingerboard_ml');
      addNotification(`✅ ${targetNote.fullName} +${xp}XP (Lv${config.level})`, 'success');
      setStatusLine(`✅ Correct: ${targetNote.fullName} (+${xp} XP)`);

      // quick reinforcement play
      playNote(stringIdx, position, fingerId, { duration: 0.9, vibrato: 0.12 });
    } else {
      addNotification(`❌ Target: ${targetNote.fullName} • You chose: ${answerInfo.fullName}`, 'error');
      setStatusLine(`❌ Target was ${targetNote.fullName}. You chose ${answerInfo.fullName}.`);

      // play target for reinforcement
      setTimeout(() => {
        playNote(targetNote.stringIdx, targetNote.position, targetNote.fingerId, { duration: 1.0, vibrato: 0.18 });
      }, 500);
    }

    // Track activity
    safeCall(sessionTracker?.trackActivity, 'fingerboard', 'answer_checked', {
      correct: isCorrect,
      responseTime,
      target: targetNote.fullName,
      answer: answerInfo.fullName,
      level: config.level,
      mode
    });

    // Auto-advance (trainer)
    if (mode === 'trainer') {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        // periodic adaptive refresh & analytics
        // (we avoid stale stats closure by checking session count via next state inference)
        const nextTotal = (stats.total || 0) + 1;

        if (nextTotal % 10 === 0) {
          await safeAsync(safeCall(analyzeFingerboardPerformance, { module: 'fingerboard', level: config.level }));
          await initAdaptiveFingerboard();
        }

        if (nextTotal >= (config.maxQuestions || DEFAULT_CONFIG.maxQuestions)) {
          setStatusLine(`Session complete. Great work!`);
          addNotification(`🎉 Trainer session complete!`, 'success');
          answeredLockRef.current = false;
          return;
        }

        await nextQuestion();
      }, isCorrect ? 950 : 1750);
    } else {
      // quiz/explore allow multiple attempts; unlock immediately
      answeredLockRef.current = false;
    }
  }, [
    targetNote,
    userAnswer,
    stats.total,
    config,
    mode,
    getNoteInfo,
    bumpMastery,
    refreshStats,
    awardXP,
    playNote,
    initAdaptiveFingerboard,
    nextQuestion
  ]);

  // -----------------------------
  // Keyboard / a11y bindings
  // -----------------------------
  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const k = e.key;

      // Fingers: 1-5 (5 selects 1×)
      if (k === '1') return setSelectedFinger('1');
      if (k === '2') return setSelectedFinger('2');
      if (k === '3') return setSelectedFinger('3');
      if (k === '4') return setSelectedFinger('4');
      if (k === '5') return setSelectedFinger('1x');

      // TAB cycles strings
      if (k === 'Tab') {
        e.preventDefault();
        setSelectedString(prev => (prev + 1) % clampInt(config.strings, 1, 4));
        return;
      }

      // Arrow keys cycle positions
      const unlockedPositions = POSITIONS.slice(0, clampInt(config.positions, 1, POSITIONS.length));
      if (k === 'ArrowRight' || k === 'ArrowUp') {
        e.preventDefault();
        setSelectedPosition(prev => {
          const idx = unlockedPositions.indexOf(prev);
          const next = unlockedPositions[(idx + 1) % unlockedPositions.length];
          return next;
        });
        return;
      }
      if (k === 'ArrowLeft' || k === 'ArrowDown') {
        e.preventDefault();
        setSelectedPosition(prev => {
          const idx = unlockedPositions.indexOf(prev);
          const next = unlockedPositions[(idx - 1 + unlockedPositions.length) % unlockedPositions.length];
          return next;
        });
        return;
      }

      // SPACE: play selection (explore/quiz) or replay/next (trainer)
      if (k === ' ') {
        e.preventDefault();
        if (mode === 'trainer' && targetNote) {
          if (!answeredLockRef.current) {
            playNote(targetNote.stringIdx, targetNote.position, targetNote.fingerId, { duration: 1.1, vibrato: config.trainerVibrato });
          } else {
            nextQuestion();
          }
        } else {
          playNote(selectedString, selectedPosition, selectedFinger, { duration: 1.0, vibrato: 0 });
        }
        return;
      }

      // ENTER: in quiz/trainer, answer using current selection
      if (k === 'Enter') {
        if ((mode === 'trainer' || mode === 'quiz') && targetNote) {
          checkAnswer(selectedString, selectedPosition, selectedFinger);
        }
      }
    };

    const detach = safeCall(keyboard?.bind, handler);
    if (!detach) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
    return () => safeCall(detach);
  }, [
    enabled,
    mode,
    targetNote,
    config.positions,
    config.strings,
    config.trainerVibrato,
    selectedString,
    selectedPosition,
    selectedFinger,
    playNote,
    nextQuestion,
    checkAnswer
  ]);

  // -----------------------------
  // SVG rendering (complete)
  // -----------------------------
  const unlockedPositions = useMemo(() => POSITIONS.slice(0, clampInt(config.positions, 1, POSITIONS.length)), [config.positions]);
  const unlockedStrings = useMemo(() => STRINGS.slice(0, clampInt(config.strings, 1, 4)), [config.strings]);

  // Geometry for rendering
  const GEO = useMemo(() => {
    const W = 1200, H = 480;
    const left = 170, right = 1030;
    const top = 140, bottom = 340;

    const posCount = unlockedPositions.length || 1;
    const posW = (right - left) / posCount;

    const stringY = (sIdx) => {
      const n = unlockedStrings.length || 1;
      if (n === 1) return (top + bottom) / 2;
      return top + (sIdx * (bottom - top) / (n - 1));
    };

    const posX = (pIdx) => left + pIdx * posW;

    // finger offsets within a position band
    const fingerOffsets = [0.20, 0.45, 0.70, 0.88, 0.96]; // 1,2,3,4,1x

    const fingerX = (pIdx, fIdx) => posX(pIdx) + posW * (fingerOffsets[fIdx] ?? 0.2);

    return { W, H, left, right, top, bottom, posW, stringY, posX, fingerX };
  }, [unlockedPositions, unlockedStrings]);

  const renderViolinBody = useCallback(() => {
    return h('g', { className: 'violin-body-v3' },
      h('path', {
        d: 'M 80 80 Q 140 30 240 80 L 960 80 Q 1060 30 1100 80 L 1100 400 Q 1060 440 960 400 L 240 400 Q 140 440 80 400 Z',
        fill: 'var(--wood-dark, #8B4513)',
        stroke: '#654321',
        strokeWidth: 4,
        strokeLinejoin: 'round'
      }),
      h('rect', {
        x: 110, y: 100, width: 980, height: 300,
        rx: 20, fill: 'var(--wood-light, #A0522D)',
        stroke: '#654321', strokeWidth: 3
      }),
      // F-holes (stylized)
      h('path', { d: 'M 320 160 Q 340 140 360 160 T 400 200', fill: 'none', stroke: '#5D4037', strokeWidth: 2 }),
      h('path', { d: 'M 800 160 Q 820 140 840 160 T 880 200', fill: 'none', stroke: '#5D4037', strokeWidth: 2 })
    );
  }, []);

  const renderPositionMarkers = useCallback(() => {
    return h('g', { className: 'pos-markers-v3' },
      unlockedPositions.map((pos, i) => {
        const x = 280 + i * 160; // same look as your snippet, but safe for unlocked count
        const stringId = unlockedStrings[selectedString]?.id || 'G';
        const k = masteryKey(stringId, pos);
        const m = positionMastery[k] || { accuracy: 0 };
        const acc = clamp01(m.accuracy);

        const isCurrent = (pos === selectedPosition);
        const fill = isCurrent ? '#FFD700' : (acc >= 0.9 ? '#4CAF50' : acc >= 0.75 ? '#FF9800' : '#B0BEC5');

        return h('g', { key: `pos-${pos}` },
          h('rect', {
            x, y: 130, width: 12, height: 220, rx: 4,
            fill,
            className: `pos-marker ${acc >= 0.9 ? 'mastered' : ''}`
          }),
          h('text', {
            x: x + 6,
            y: 380,
            fontSize: 22,
            fontWeight: 'bold',
            fill: '#fff',
            textAnchor: 'middle'
          }, String(pos))
        );
      })
    );
  }, [unlockedPositions, unlockedStrings, selectedString, selectedPosition, positionMastery]);

  const renderString = useCallback((sIdx, active) => {
    const s = STRINGS[sIdx];
    const y = GEO.stringY(sIdx);

    return h('g', { key: `string-${s.id}`, className: `fb-string ${active ? 'active' : ''}` },
      h('line', {
        x1: GEO.left,
        y1: y,
        x2: GEO.right,
        y2: y,
        stroke: active ? s.color : 'rgba(255,255,255,0.55)',
        strokeWidth: active ? 5 : 3,
        opacity: active ? 1 : 0.8
      }),
      h('text', {
        x: GEO.left - 18,
        y: y + 7,
        fontSize: 18,
        fontWeight: 'bold',
        fill: active ? s.color : '#fff',
        textAnchor: 'end'
      }, s.id)
    );
  }, [GEO]);

  const renderFingerStop = useCallback((sIdx, pos, pIdx, finger, fIdx, masteryForPos) => {
    if (finger.extension && pos > 3) return null;

    const x = GEO.fingerX(pIdx, fIdx);
    const y = GEO.stringY(sIdx);

    const info = getNoteInfo(sIdx, pos, finger.id);

    const isSelected = (selectedString === sIdx && selectedPosition === pos && selectedFinger === finger.id);
    const isTarget = !!(targetNote && targetNote.midi === info.midi);
    const isAnswered = !!(userAnswer && userAnswer.midi === info.midi);

    // Visual weighting based on difficulty/confusion
    const diff = Number(info.difficulty) || 1;
    const confusionScore = Number(info.confusionScore) || 1;
    const weightGlow = Math.min(1, 0.25 + (diff - 1) * 0.3 + (confusionScore > 1 ? 0.25 : 0));

    let fill = 'rgba(255,255,255,0.18)';
    let stroke = 'rgba(255,255,255,0.35)';

    if (isSelected) { fill = 'rgba(255,255,255,0.30)'; stroke = '#fff'; }
    if ((mode === 'trainer' || mode === 'quiz') && isTarget) { fill = 'rgba(255,215,0,0.15)'; stroke = 'rgba(255,215,0,0.40)'; }
    if (isAnswered) { fill = 'rgba(76,175,80,0.33)'; stroke = '#4CAF50'; }

    const r = isSelected ? 18 : 14;

    const onPick = async () => {
      setSelectedString(sIdx);
      setSelectedPosition(pos);
      setSelectedFinger(finger.id);

      if (mode === 'explore') {
        playNote(sIdx, pos, finger.id, { duration: 0.9, vibrato: 0 });
      } else if (mode === 'trainer') {
        await checkAnswer(sIdx, pos, finger.id);
      } else if (mode === 'quiz') {
        // If no target, set it; if target exists, attempt answer
        if (!targetNote) {
          setTargetNote(info);
          questionStartRef.current = nowMs();
          setStatusLine(`Quiz target set: ${info.fullName}`);
          safeCall(a11y?.announce, `Quiz target set: ${info.fullName}`);
        } else {
          await checkAnswer(sIdx, pos, finger.id);
        }
      }
    };

    const aria = `${info.fullName} on ${STRINGS[sIdx].id} string, position ${pos}, finger ${finger.label}`;

    return h('g', { key: `stop-${sIdx}-${pos}-${finger.id}` },
      h('circle', {
        cx: x, cy: y, r,
        fill,
        stroke,
        strokeWidth: isSelected ? 3 : 2,
        style: { filter: `drop-shadow(0 0 ${Math.round(10 * weightGlow)}px rgba(255,255,255,${0.25 + 0.35 * weightGlow}))` },
        role: 'button',
        tabIndex: 0,
        'aria-label': aria,
        onClick: onPick,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick();
          }
        }
      }),
      isSelected && h('text', {
        x, y: y - 20,
        fontSize: 14,
        fill: '#fff',
        textAnchor: 'middle'
      }, info.name)
    );
  }, [
    GEO,
    mode,
    targetNote,
    userAnswer,
    selectedString,
    selectedPosition,
    selectedFinger,
    getNoteInfo,
    playNote,
    checkAnswer
  ]);

  const renderFinger = useCallback((finger, fIdx) => {
    // Not a literal finger; we draw “stops” across strings/positions.
    // This function exists to keep compatibility with your intended structure.
    return null;
  }, []);

  const renderTargetDisplay = useCallback((noteInfo) => {
    if (!noteInfo) return null;

    const label = `Find: ${noteInfo.fullName}`;
    const detail = `${noteInfo.string}${noteInfo.position}${noteInfo.finger}`;

    return h('g', { className: 'target-display-v3' },
      h('rect', {
        x: 360, y: 92, width: 480, height: 40, rx: 12,
        fill: 'rgba(0,0,0,0.35)',
        stroke: 'rgba(255,255,255,0.25)',
        strokeWidth: 2
      }),
      h('text', {
        x: 600, y: 118,
        fontSize: 20,
        fill: '#fff',
        textAnchor: 'middle',
        fontWeight: 'bold'
      }, `${label} • ${detail}`)
    );
  }, []);

  const fingerboardSVG = useMemo(() => {
    const currentStringId = STRINGS[selectedString]?.id || 'G';
    const key = masteryKey(currentStringId, selectedPosition);
    const m = positionMastery[key] || { accuracy: 0 };

    const aria = (mode === 'trainer' && targetNote)
      ? `Fingerboard trainer. Find ${targetNote.fullName}.`
      : `Fingerboard ${selectedPosition} position. Mastery ${(clamp01(m.accuracy) * 100).toFixed(0)} percent.`;

    return h('svg', {
      width: '100%',
      height: 480,
      viewBox: '0 0 1200 480',
      className: 'fingerboard-svg-v3',
      role: mode === 'trainer' ? 'application' : 'application',
      'aria-label': aria
    },
      renderViolinBody(),
      renderPositionMarkers(),

      // Strings
      STRINGS.slice(0, clampInt(config.strings, 1, 4)).map((s, sIdx) =>
        renderString(sIdx, selectedString === sIdx)
      ),

      // Stops: draw for every string/position/finger
      h('g', { className: 'stops-layer-v3' },
        STRINGS.slice(0, clampInt(config.strings, 1, 4)).map((s, sIdx) =>
          unlockedPositions.map((pos, pIdx) => {
            const mk = masteryKey(s.id, pos);
            const masteryForPos = positionMastery[mk] || { accuracy: 0 };
            return FINGERS.map((finger, fIdx) =>
              renderFingerStop(sIdx, pos, pIdx, finger, fIdx, masteryForPos)
            );
          })
        )
      ),

      // Target display (trainer)
      (mode === 'trainer' && targetNote) ? renderTargetDisplay(targetNote) : null
    );
  }, [
    mode,
    config.strings,
    selectedString,
    selectedPosition,
    targetNote,
    unlockedPositions,
    positionMastery,
    renderViolinBody,
    renderPositionMarkers,
    renderString,
    renderFingerStop,
    renderTargetDisplay
  ]);

  // -----------------------------
  // Derived stats
  // -----------------------------
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  const grade = accuracyGrade(accuracy);

  // -----------------------------
  // UI callbacks
  // -----------------------------
  const setModeAndMaybeStart = (id) => {
    setMode(id);
    safeCall(sessionTracker?.trackActivity, 'fingerboard', 'mode_change', { mode: id });
    if (id === 'trainer') nextQuestion();
  };

  const playSelection = () => playNote(selectedString, selectedPosition, selectedFinger, { duration: 1.0, vibrato: 0 });

  // -----------------------------
  // Guard: feature disabled
  // -----------------------------
  if (!enabled) {
    return h('div', { className: 'module-container fingerboard-v3 disabled', role: 'main' },
      h('header', { className: 'module-header elevated' },
        h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
        h('h1', null, '🎻 Fingerboard'),
      ),
      h('p', null, 'This module is disabled in this build.')
    );
  }

  // -----------------------------
  // Render
  // -----------------------------
  return h('div', { className: 'module-container fingerboard-v3', role: 'main' },

    // Header
    h('header', { className: 'module-header elevated' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h1', null, '🎻 Fingerboard v3.0.5'),
      h('div', { className: 'stats-live ml-enhanced', 'aria-live': 'polite' },
        h('div', { className: 'stat-card accuracy' },
          h('div', { className: 'stat-value' }, `${stats.correct}/${stats.total}`),
          h('small', null, `${accuracy}% (${grade})`)
        ),
        h('div', { className: 'stat-card streak' },
          h('div', { className: 'stat-value' },
            stats.streak > 5 ? '🔥' : stats.streak > 3 ? '⚡' : '',
            String(stats.streak)
          ),
          h('small', null, 'streak')
        ),
        h('div', { className: 'stat-card level' },
          h('div', { className: 'stat-value' }, `Lv${config.level}`),
          h('small', null, `${config.positions} pos • ${config.strings} str`)
        )
      )
    ),

    // Status / target
    h('div', { className: 'fb-status', role: 'status', 'aria-live': 'polite' },
      statusLine || (mode === 'trainer' ? `Find: ${targetNote?.fullName || '—'}` : 'Ready.')
    ),

    // Controls
    h('section', { className: 'fingerboard-controls-v3' },
      // Strings
      h('div', { className: 'toggle-group strings-v3' },
        STRINGS.slice(0, clampInt(config.strings, 1, 4)).map((string, i) =>
          h('button', {
            key: string.id,
            className: `toggle-btn string-btn-v3 ${selectedString === i ? 'active' : ''}`,
            style: {
              '--bg': string.color,
              '--glow': (positionMastery[masteryKey(string.id, selectedPosition)]?.accuracy || 0) >= 0.9 ? '#4CAF50' : ''
            },
            onClick: () => setSelectedString(i),
            'aria-label': `${string.name} string`
          }, string.id)
        )
      ),

      // Positions
      h('div', { className: 'toggle-group positions-v3' },
        unlockedPositions.map(pos => {
          const k = masteryKey(STRINGS[selectedString]?.id || 'G', pos);
          const mastered = (positionMastery[k]?.accuracy || 0) >= 0.9;
          return h('button', {
            key: pos,
            className: `toggle-btn pos-btn-v3 ${selectedPosition === pos ? 'active' : ''} ${mastered ? 'mastered' : ''}`,
            onClick: () => setSelectedPosition(pos)
          }, String(pos));
        })
      ),

      // Fingers
      h('div', { className: 'toggle-group fingers-v3' },
        FINGERS.map(f =>
          h('button', {
            key: f.id,
            className: `toggle-btn finger-btn-v3 ${selectedFinger === f.id ? 'active' : ''}`,
            onClick: () => setSelectedFinger(f.id),
            'aria-label': `Finger ${f.label}`
          }, f.label)
        )
      )
    ),

    // Modes
    h('div', { className: 'mode-selector fingerboard-modes-v3' },
      [
        { id: 'explore', label: '🌍 Explore', color: 'var(--primary)' },
        { id: 'quiz', label: '🧠 Quiz', color: 'var(--secondary)' },
        { id: 'trainer', label: '🎯 ML Trainer', color: 'var(--success)' }
      ].map(({ id, label, color }) =>
        h('button', {
          key: id,
          className: `mode-btn-v3 ${mode === id ? 'active' : ''}`,
          style: { '--mode-color': color },
          onClick: () => setModeAndMaybeStart(id)
        }, label)
      )
    ),

    // Main fingerboard + mastery
    h('section', { className: 'fingerboard-section-v3', 'aria-live': mode === 'trainer' ? 'assertive' : 'polite' },
      fingerboardSVG,

      // Actions
      h('div', { className: 'fingerboard-actions-v3' },
        mode !== 'trainer' && h('button', {
          className: `btn-play-large-v3 ${isPlaying ? 'playing' : ''}`,
          onClick: playSelection,
          disabled: isPlaying
        }, isPlaying ? '🔊 PLAYING…' : '🔊 Play Note'),

        mode === 'trainer' && h('button', {
          className: 'btn-next-v3',
          onClick: nextQuestion
        }, '🎯 Next Challenge')
      ),

      // Position mastery grid
      h('div', { className: 'fingerboard-mastery' },
        h('h3', null, 'Position Mastery'),
        h('div', { className: 'mastery-grid-v3' },
          unlockedPositions.map(pos => {
            const k = masteryKey(STRINGS[selectedString]?.id || 'G', pos);
            const m = positionMastery[k] || { accuracy: 0 };
            const pct = clamp01(m.accuracy) * 100;

            return h('div', {
              key: pos,
              className: `mastery-item ${pct >= 90 ? 'mastered' : 'needs-work'}`
            },
              h('strong', null, `Pos ${pos}`),
              h('div', { className: 'progress-bar' },
                h('div', {
                  className: 'progress-fill',
                  style: { width: `${pct.toFixed(0)}%` }
                })
              ),
              h('small', null, `${pct.toFixed(0)}%`)
            );
          })
        )
      )
    ),

    // Keyboard hints
    h('div', { className: 'keyboard-hints-v3' },
      h('div', null, h('kbd', null, '1-5'), ' Fingers (5 = 1×)'),
      h('div', null, h('kbd', null, 'TAB'), ' Next string'),
      h('div', null, h('kbd', null, '←/→'), ' Change position'),
      h('div', null, h('kbd', null, 'SPACE'), mode === 'trainer' ? 'Replay/Next' : 'Play'),
      h('div', null, h('kbd', null, 'ENTER'), (mode === 'trainer' || mode === 'quiz') ? 'Answer' : '—')
    )
  );
}