// js/components/Testers.js
// ======================================
// VMQ TESTERS v2.4.2 - Unified Adaptive Testing Framework (Drop-in)
// Powers: Key Signatures, Tempo, Time Signatures, Arpeggios/Chords, Scales
// Integrations: Gamification + SessionTracker + DifficultyAdapter + Spaced Repetition + Keyboard/A11y
// Notes:
// - React UMD (no JSX)
// - Uses namespace imports to avoid hard-failing on missing named exports
// - Provides a default "Testers Hub" component + named tester exports
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef, useMemo } = React;

import * as C from '../config/constants.js';
import * as Audio from '../engines/audioEngine.js';
import * as G from '../engines/gamification.js';
import * as H from '../utils/helpers.js';
import { keyboard, a11y } from '../utils/keyboard.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import * as D from '../engines/difficultyAdapter.js';
import * as SRS from '../engines/spacedRepetition.js';
import * as Store from '../config/storage.js';

// --------------------------------------
// CONFIG
// --------------------------------------
const TESTER_CONFIG = {
  MIN_OPTIONS: 3,
  MAX_OPTIONS: 6,
  AUTO_ADVANCE_DELAY: 1500,
  STREAK_BONUS_THRESHOLD: 3,
  PERFECT_STREAK_THRESHOLD: 10,
  RESPONSE_TIME_BONUS_MS: 5000,
  DIFFICULTY_ADJUST_INTERVAL: 5,
  COMBO_MULTIPLIER_MAX: 3,
  HINT_PENALTY: 0.5
};

const DEFAULT_XP_VALUES = {
  CORRECT_ANSWER: 5
};

function safeToast(showToast, msg, type = 'info') {
  try { if (typeof showToast === 'function') showToast(msg, type); } catch { /* noop */ }
}

function safeAnnounce(msg) {
  try { a11y?.announce?.(msg); } catch { /* noop */ }
}

function clamp(n, lo, hi) {
  const fn = H?.clamp;
  if (typeof fn === 'function') return fn(n, lo, hi);
  return Math.max(lo, Math.min(hi, n));
}

function shuffle(arr) {
  const fn = H?.shuffle;
  if (typeof fn === 'function') return fn(arr);
  // fallback Fisher–Yates
  const a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRandom(arr) {
  const fn = H?.getRandom;
  if (typeof fn === 'function') return fn(arr);
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDuration(ms) {
  const fn = H?.formatDuration;
  if (typeof fn === 'function') return fn(ms);
  // fallback: mm:ss
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function nowISO() {
  return new Date().toISOString();
}

function makeKey(...parts) {
  return parts.filter(Boolean).join(':');
}

function loadJSONSafe(key, fallback) {
  try {
    if (typeof Store.loadJSON === 'function') return Store.loadJSON(key, fallback);
  } catch { /* noop */ }
  return fallback;
}

function saveJSONSafe(key, value) {
  try {
    if (typeof Store.saveJSON === 'function') Store.saveJSON(key, value);
  } catch { /* noop */ }
}

function safeRegisterKey(keyName, fn, label) {
  try { keyboard?.register?.(keyName, fn, label); } catch { /* noop */ }
}
function safeUnregisterKeys(keys) {
  try {
    // Some VMQ versions support keyboard.unregister(...keys)
    if (typeof keyboard?.unregister === 'function') {
      keyboard.unregister(...keys);
      return;
    }
  } catch { /* noop */ }
  // Fallback: attempt per-key unregister if supported
  try {
    if (typeof keyboard?.unregisterKey === 'function') {
      keys.forEach(k => keyboard.unregisterKey(k));
    }
  } catch { /* noop */ }
}

function safeStartSession(activity) {
  try { sessionTracker?.startSession?.(activity); } catch { /* noop */ }
}
function safeEndSession(entry) {
  try { sessionTracker?.endSession?.(entry); } catch { /* noop */ }
}

function safeRecordAnswer(type, isCorrect, responseTime, meta = {}) {
  try {
    if (typeof G?.recordAnswer === 'function') {
      G.recordAnswer(type, isCorrect, responseTime, meta);
      return;
    }
  } catch { /* noop */ }
}

function safeAddXP(amount, source = 'tester', meta = {}) {
  try {
    if (typeof G?.addXP === 'function') {
      G.addXP(amount, source, meta);
      return;
    }
    if (typeof G?.awardXP === 'function') {
      G.awardXP(amount, source, meta);
      return;
    }
  } catch { /* noop */ }
}

function safeAddSRSItem(payload) {
  try {
    if (typeof SRS?.addSRSItem === 'function') return SRS.addSRSItem(payload);
    if (typeof SRS?.addItem === 'function') return SRS.addItem(payload);
  } catch { /* noop */ }
  return null;
}

function safeGetNextReviewItems(type, n) {
  try {
    if (typeof SRS?.getNextReviewItems === 'function') return SRS.getNextReviewItems(type, n);
    if (typeof SRS?.getDueItems === 'function') return SRS.getDueItems(type, n);
  } catch { /* noop */ }
  return [];
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// --------------------------------------
// FACTORY
// --------------------------------------
export function createTester({
  type,
  title,
  icon,
  getData,
  audioPlay,
  questionTypes = [],
  difficultyLevels = ['beginner', 'intermediate', 'advanced'],
  enableSRS = true,
  enableHints = false,
  customValidation = null
}) {
  return function Tester(props) {
    const { onBack, navigate, showToast } = props || {};

    const goBack = useCallback(() => {
      if (typeof onBack === 'function') return onBack();
      if (typeof navigate === 'function') return navigate('testers');
      try { window.location.hash = '#testers'; } catch { /* noop */ }
    }, [onBack, navigate]);

    // ----- state -----
    const [question, setQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [answered, setAnswered] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [usedHint, setUsedHint] = useState(false);

    const [difficulty, setDifficulty] = useState('intermediate');
    const [autoDifficulty, setAutoDifficulty] = useState(true);
    const [autoAdvance, setAutoAdvance] = useState(true);

    const [isPlaying, setIsPlaying] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    const [stats, setStats] = useState({
      correct: 0,
      total: 0,
      streak: 0,
      longestStreak: 0,
      perfectStreak: 0,
      avgResponseTime: 0,
      comboMultiplier: 1
    });

    // refs to avoid stale closures
    const statsRef = useRef(stats);
    const perfRef = useRef([]);
    const questionStartRef = useRef(null);
    const consecutiveCorrectRef = useRef(0);
    const consecutiveWrongRef = useRef(0);
    const isAudioPlayingRef = useRef(false);
    const advanceTimerRef = useRef(null);
    const sessionStartRef = useRef(Date.now());

    useEffect(() => { statsRef.current = stats; }, [stats]);

    // ----- persistent settings (non-breaking) -----
    const SETTINGS_KEY = useMemo(() => {
      const base = Store?.STORAGE_KEYS?.TESTERS_SETTINGS || 'vmq_testers_settings';
      return makeKey(base, type);
    }, [type]);

    useEffect(() => {
      const saved = loadJSONSafe(SETTINGS_KEY, null);
      if (saved && typeof saved === 'object') {
        if (saved.difficulty && difficultyLevels.includes(saved.difficulty)) setDifficulty(saved.difficulty);
        if (typeof saved.autoDifficulty === 'boolean') setAutoDifficulty(saved.autoDifficulty);
        if (typeof saved.autoAdvance === 'boolean') setAutoAdvance(saved.autoAdvance);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      saveJSONSafe(SETTINGS_KEY, { difficulty, autoDifficulty, autoAdvance, updatedAt: nowISO() });
    }, [SETTINGS_KEY, difficulty, autoDifficulty, autoAdvance]);

    // ----- data normalization -----
    const dataByDifficulty = useMemo(() => {
      const raw = (typeof getData === 'function') ? getData() : getData;
      if (Array.isArray(raw)) {
        const n = raw.length;
        const b = raw.slice(0, Math.max(1, Math.ceil(n * 0.35)));
        const i = raw.slice(0, Math.max(1, Math.ceil(n * 0.75)));
        return { beginner: b, intermediate: i, advanced: raw };
      }
      if (raw && typeof raw === 'object') return raw;
      return { beginner: [], intermediate: [], advanced: [] };
    }, [getData]);

    const difficultyConfig = useMemo(() => {
      try {
        if (typeof D?.getDifficultyConfig === 'function') return D.getDifficultyConfig(type, difficulty);
      } catch { /* noop */ }
      return { optionCount: 4, autoPlayAudio: false, preferSimilarDistractors: difficulty === 'advanced' };
    }, [type, difficulty]);

    // ----- keyboard -----
    const nextQuestionRef = useRef(null); // will be set after definition

    const handlePlayAudio = useCallback(() => {
      if (!audioPlay || !question?.item || isAudioPlayingRef.current) return;

      setIsPlaying(true);
      isAudioPlayingRef.current = true;

      const done = () => {
        setIsPlaying(false);
        isAudioPlayingRef.current = false;
      };

      try {
        const maybePromise = audioPlay(question.item, done);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(done).catch((err) => {
            console.error('[Tester] Audio playback failed:', err);
            done();
            safeToast(showToast, 'Audio playback failed', 'error');
          });
        }
      } catch (err) {
        console.error('[Tester] Audio playback failed:', err);
        done();
        safeToast(showToast, 'Audio playback failed', 'error');
      }

      safeAnnounce('Playing audio');
    }, [audioPlay, question, showToast]);

    // ----- helpers -----
    const buildQuestionText = useCallback((qt, item) => {
      const base = String(qt?.q || 'Identify');
      const fallbackToken = (item?.name || item?.sig || item?.major || item?.minor || 'this');
      // legacy "#" token
      let s = base.includes('#') ? base.replaceAll('#', String(fallbackToken)) : base;

      // optional richer tokens (safe; no requirement)
      s = s
        .replaceAll('{name}', String(item?.name ?? ''))
        .replaceAll('{sig}', String(item?.sig ?? ''))
        .replaceAll('{major}', String(item?.major ?? ''))
        .replaceAll('{minor}', String(item?.minor ?? ''))
        .replaceAll('{bpm}', String(item?.bpm ?? ''))
        .replaceAll('{accidentals}', String(item?.accidentals ?? ''));

      return s.trim();
    }, []);

    const resolveAnswer = useCallback((qt, item) => {
      const a = qt?.a;
      if (typeof a === 'function') return a(item);
      return a;
    }, []);

    const calculateSimilarity = useCallback((item1, item2) => {
      // key sigs
      if (item1?.accidentals != null && item2?.accidentals != null) {
        return 1 / (1 + Math.abs(item1.accidentals - item2.accidentals));
      }
      // intervals
      if (item1?.semitones != null && item2?.semitones != null) {
        return 1 / (1 + Math.abs(item1.semitones - item2.semitones));
      }
      // tempo
      if (item1?.bpm != null && item2?.bpm != null) {
        return 1 / (1 + Math.abs(item1.bpm - item2.bpm));
      }
      return 0.5;
    }, []);

    const generateDistractors = useCallback((poolItems, correctItem, correctAnswer, count) => {
      const pool = (Array.isArray(poolItems) ? poolItems : []).filter(it => {
        const ans = (it?.name ?? it?.sig ?? it?.major ?? it?.minor ?? '');
        return String(ans) !== String(correctAnswer);
      });

      let candidates = shuffle(pool);

      if (difficultyConfig?.preferSimilarDistractors) {
        candidates = candidates.sort((a, b) => calculateSimilarity(b, correctItem) - calculateSimilarity(a, correctItem));
      }

      const out = [];
      const seen = new Set([String(correctAnswer)]);

      for (const it of candidates) {
        if (out.length >= count) break;
        const ans = (it?.name ?? it?.sig ?? it?.major ?? it?.minor ?? '');
        const key = String(ans);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
      }

      // fill if small pool
      while (out.length < count && pool.length > 0) {
        const it = getRandom(pool);
        const ans = (it?.name ?? it?.sig ?? it?.major ?? it?.minor ?? '');
        const key = String(ans);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
      }

      return out;
    }, [calculateSimilarity, difficultyConfig]);

    const selectSRSWeightedItem = useCallback((levelData) => {
      if (!enableSRS) return getRandom(levelData);
      const due = safeGetNextReviewItems(type, 6);
      // ~30% chance to serve a due review
      if (Array.isArray(due) && due.length > 0 && Math.random() < 0.3) {
        const dueItem = getRandom(due);
        const target = dueItem?.content || dueItem?.ref || dueItem;
        const match = (Array.isArray(levelData) ? levelData : []).find(it => {
          return (
            (it?.name && target?.name && String(it.name) === String(target.name)) ||
            (it?.sig && target?.sig && String(it.sig) === String(target.sig))
          );
        });
        if (match) return match;
      }
      return getRandom(levelData);
    }, [enableSRS, type]);

    // ----- question generation -----
    const nextQuestion = useCallback(() => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }

      const levelData = dataByDifficulty?.[difficulty] || dataByDifficulty?.intermediate || [];
      if (!Array.isArray(levelData) || levelData.length === 0) {
        console.warn('[Tester] No data for', type, 'difficulty', difficulty);
        setQuestion(null);
        setOptions([]);
        return;
      }

      const item = selectSRSWeightedItem(levelData);
      if (!item) return;

      const qtRaw = (Array.isArray(questionTypes) && questionTypes.length > 0)
        ? getRandom(questionTypes)
        : { q: 'Identify', a: (item?.name ?? item?.sig ?? item?.major ?? item?.minor) };

      const q = buildQuestionText(qtRaw, item);
      const a = resolveAnswer(qtRaw, item);

      const optionCount = clamp(
        Number(difficultyConfig?.optionCount || 4),
        TESTER_CONFIG.MIN_OPTIONS,
        TESTER_CONFIG.MAX_OPTIONS
      );

      const distractors = generateDistractors(levelData, item, a, optionCount - 1);
      const allOptions = shuffle([String(a), ...distractors]);

      setQuestion({
        id: `${type}-${Date.now()}`,
        item,
        q,
        a: String(a),
        difficulty,
        startTime: Date.now()
      });
      setOptions(allOptions);
      setSelected(null);
      setAnswered(false);
      setShowHint(false);
      setUsedHint(false);
      setShowFeedback(false);
      setFeedbackMessage('');
      questionStartRef.current = Date.now();

      safeAnnounce(`${title}. ${q}. ${allOptions.length} options.`);
      if (audioPlay && difficultyConfig?.autoPlayAudio) {
        setTimeout(() => handlePlayAudio(), 250);
      }
    }, [
      audioPlay,
      buildQuestionText,
      dataByDifficulty,
      difficulty,
      difficultyConfig,
      generateDistractors,
      handlePlayAudio,
      questionTypes,
      resolveAnswer,
      selectSRSWeightedItem,
      title,
      type
    ]);

    nextQuestionRef.current = nextQuestion;

    // ----- feedback -----
    const showAnswerFeedback = useCallback((isCorrect, xp, responseTime, correctAnswer) => {
      let msg = '';
      if (isCorrect) {
        const st = statsRef.current;
        const nextStreak = st.streak + 1;

        if (st.perfectStreak >= TESTER_CONFIG.PERFECT_STREAK_THRESHOLD) {
          msg = `🌟 PERFECT STREAK! +${xp} XP`;
        } else if (nextStreak >= 10) {
          msg = `🔥 ${nextStreak} streak! +${xp} XP`;
        } else if (responseTime < 2000) {
          msg = `⚡ Fast! +${xp} XP`;
        } else {
          msg = `✅ Correct! +${xp} XP`;
        }

        safeToast(showToast, msg, 'success');
        safeAnnounce(msg);
      } else {
        msg = `💡 Correct answer: ${correctAnswer}`;
        if (consecutiveWrongRef.current >= 3) msg += ' • Consider lowering difficulty.';
        safeToast(showToast, msg, 'error');
        safeAnnounce(msg);
      }

      setFeedbackMessage(msg);
      setShowFeedback(true);
    }, [showToast]);

    // ----- difficulty auto-adjust -----
    const adjustDifficultyLevel = useCallback((nextPerf) => {
      const perf = Array.isArray(nextPerf) ? nextPerf : perfRef.current;
      const st = statsRef.current;

      const recent = perf.slice(-20);
      const acc = recent.length ? (recent.filter(p => p.correct).length / recent.length) : 0.5;
      const avgTime = st.avgResponseTime || 0;

      // Move up
      if (acc > 0.85 && avgTime > 0 && avgTime < 3500 && difficulty === 'beginner') {
        setDifficulty('intermediate');
        safeToast(showToast, '📈 Moving to Intermediate!', 'success');
        return;
      }
      if (acc > 0.85 && avgTime > 0 && avgTime < 3000 && difficulty === 'intermediate') {
        setDifficulty('advanced');
        safeToast(showToast, '🚀 Moving to Advanced!', 'success');
        return;
      }

      // Move down
      if (acc < 0.5 && consecutiveWrongRef.current >= 5 && difficulty === 'advanced') {
        setDifficulty('intermediate');
        safeToast(showToast, '⚠️ Back to Intermediate', 'warning');
        return;
      }
      if (acc < 0.4 && consecutiveWrongRef.current >= 5 && difficulty === 'intermediate') {
        setDifficulty('beginner');
        safeToast(showToast, '💪 Back to Beginner (build fundamentals)', 'info');
        return;
      }
    }, [difficulty, showToast]);

    // ----- hint system -----
    const toggleHint = useCallback(() => {
      if (!enableHints || answered || usedHint) return;
      setShowHint(v => !v);
      setUsedHint(true);
      safeToast(showToast, '💡 Hint shown (XP reduced)', 'info');
      safeAnnounce('Hint revealed');
    }, [enableHints, answered, usedHint, showToast]);

    const generateHint = useCallback(() => {
      if (!question?.item) return '';
      const it = question.item;

      if (type === 'keys') {
        const a = Number(it.accidentals || 0);
        if (a === 0) return 'No sharps/flats (C major / A minor family)';
        return a > 0 ? `${a} sharps` : `${Math.abs(a)} flats`;
      }
      if (type === 'intervals') {
        const s = Number(it.semitones || 0);
        return `${s} semitones`;
      }
      if (type === 'tempo') {
        const bpm = Number(it.bpm || 0);
        if (!bpm) return 'Listen for the pulse speed';
        return bpm > 140 ? 'Fast tempo' : bpm > 90 ? 'Medium tempo' : 'Slow tempo';
      }
      if (type === 'timesig') {
        const sig = String(it.sig || '');
        if (sig) return `Beat grouping hint: ${sig}`;
      }
      return 'Focus on the pattern / feel';
    }, [question, type]);

    // ----- answer handling -----
    const handleAnswer = useCallback((choice) => {
      if (answered || !question) return;

      const responseTime = Date.now() - (questionStartRef.current || Date.now());
      const correctAnswer = String(question.a);
      const chosen = String(choice);

      const isCorrect = (typeof customValidation === 'function')
        ? !!customValidation(chosen, correctAnswer, question)
        : chosen === correctAnswer;

      setSelected(chosen);
      setAnswered(true);

      // update streak refs
      if (isCorrect) {
        consecutiveCorrectRef.current += 1;
        consecutiveWrongRef.current = 0;
      } else {
        consecutiveWrongRef.current += 1;
        consecutiveCorrectRef.current = 0;
      }

      // XP calculation
      const xpValues = C?.XP_VALUES || DEFAULT_XP_VALUES;
      const baseXP = Number(xpValues?.CORRECT_ANSWER ?? DEFAULT_XP_VALUES.CORRECT_ANSWER);
      let xp = 0;

      if (isCorrect) {
        const st = statsRef.current;
        xp = baseXP;

        if (st.streak >= TESTER_CONFIG.STREAK_BONUS_THRESHOLD) {
          xp += Math.floor(st.streak * 0.5);
        }
        if (responseTime < TESTER_CONFIG.RESPONSE_TIME_BONUS_MS) {
          xp += Math.ceil(baseXP * 0.3);
        }
        if (st.comboMultiplier > 1) {
          xp = Math.floor(xp * st.comboMultiplier);
        }
        if (usedHint) {
          xp = Math.floor(xp * TESTER_CONFIG.HINT_PENALTY);
        }
      }

      // engines
      safeRecordAnswer(type, isCorrect, responseTime, { difficulty, usedHint });
      if (xp > 0) safeAddXP(xp, `tester:${type}`, { difficulty, usedHint });

      // stats update (functional)
      setStats(prev => {
        const newStreak = isCorrect ? prev.streak + 1 : 0;
        const newPerfectStreak = (isCorrect && !usedHint) ? (prev.perfectStreak + 1) : 0;
        const newCombo = isCorrect
          ? Math.min(TESTER_CONFIG.COMBO_MULTIPLIER_MAX, (prev.comboMultiplier + 0.1))
          : 1;

        const newAvgTime = (prev.total === 0)
          ? responseTime
          : Math.round((prev.avgResponseTime * prev.total + responseTime) / (prev.total + 1));

        return {
          correct: prev.correct + (isCorrect ? 1 : 0),
          total: prev.total + 1,
          streak: newStreak,
          longestStreak: Math.max(prev.longestStreak, newStreak),
          perfectStreak: newPerfectStreak,
          avgResponseTime: newAvgTime,
          comboMultiplier: newCombo
        };
      });

      // performance tracking
      const nextPerf = (perfRef.current || []).concat([{ correct: isCorrect, time: responseTime }]).slice(-20);
      perfRef.current = nextPerf;

      // auto difficulty adjustment (every N questions)
      const nextTotal = (statsRef.current.total || 0) + 1;
      if (autoDifficulty && nextTotal > 0 && nextTotal % TESTER_CONFIG.DIFFICULTY_ADJUST_INTERVAL === 0) {
        adjustDifficultyLevel(nextPerf);
        try { D?.adjustDifficulty?.(type, { recentPerformance: nextPerf, difficulty }); } catch { /* noop */ }
      }

      // SRS
      if (enableSRS) {
        safeAddSRSItem({
          type,
          content: question.item,
          question: question.q,
          answer: correctAnswer,
          correct: isCorrect,
          responseTime,
          timestamp: Date.now()
        });
      }

      // feedback
      showAnswerFeedback(isCorrect, xp, responseTime, correctAnswer);

      // auto-advance
      if (autoAdvance) {
        advanceTimerRef.current = setTimeout(() => {
          setShowFeedback(false);
          nextQuestionRef.current?.();
        }, TESTER_CONFIG.AUTO_ADVANCE_DELAY);
      }
    }, [
      answered,
      autoAdvance,
      autoDifficulty,
      customValidation,
      difficulty,
      enableSRS,
      question,
      showAnswerFeedback,
      type,
      usedHint,
      adjustDifficultyLevel
    ]);

    // ----- init / lifecycle -----
    useEffect(() => {
      safeStartSession(`tester:${type}`);
      nextQuestion();

      return () => {
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        const elapsedMs = Date.now() - (sessionStartRef.current || Date.now());
        safeEndSession({ activity: `tester:${type}`, elapsedMs, timestamp: Date.now() });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ----- keyboard bindings -----
    useEffect(() => {
      // play audio
      if (audioPlay) safeRegisterKey('space', handlePlayAudio, `${title}: Play audio`);

      // submit (if selection made) — (kept for compatibility; selection auto-submits on click/key anyway)
      safeRegisterKey('enter', () => {
        if (!answered && selected != null) handleAnswer(selected);
      }, `${title}: Submit`);

      // next
      safeRegisterKey('n', () => {
        if (answered) {
          setShowFeedback(false);
          nextQuestionRef.current?.();
        }
      }, `${title}: Next`);

      // hint
      if (enableHints) safeRegisterKey('h', () => {
        if (enableHints && !answered && !usedHint) toggleHint();
      }, `${title}: Hint`);

      // number keys for selection (1–6)
      for (let i = 1; i <= 6; i++) {
        safeRegisterKey(String(i), () => {
          if (answered) return;
          const opt = options[i - 1];
          if (opt != null) handleAnswer(opt);
        }, `${title}: Option ${i}`);
      }

      return () => {
        safeUnregisterKeys(['space', 'enter', 'n', 'h', '1', '2', '3', '4', '5', '6']);
      };
    }, [
      audioPlay,
      answered,
      enableHints,
      handleAnswer,
      handlePlayAudio,
      options,
      selected,
      title,
      toggleHint,
      usedHint
    ]);

    // if difficulty changes, immediately serve a new question at that level
    useEffect(() => {
      if (!question) return;
      // small delay to avoid clobbering mid-feedback
      if (!answered) nextQuestionRef.current?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [difficulty]);

    // ----- computed -----
    const accuracy = useMemo(() => {
      return stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    }, [stats]);

    const streakIcon = useMemo(() => {
      if (stats.streak >= 10) return '🌟';
      if (stats.streak >= 5) return '🔥';
      if (stats.streak >= 3) return '⚡';
      return '';
    }, [stats.streak]);

    const gradeClass = useMemo(() => {
      if (accuracy >= 90) return 'grade-s';
      if (accuracy >= 80) return 'grade-a';
      if (accuracy >= 70) return 'grade-b';
      if (accuracy >= 60) return 'grade-c';
      return 'grade-d';
    }, [accuracy]);

    const sessionDuration = useMemo(() => {
      return formatDuration(Date.now() - (sessionStartRef.current || Date.now()));
    }, [stats.total]); // update occasionally

    // ----- render -----
    return h('div', { className: 'container tester', 'data-module': `tester:${type}`, role: 'main' },
      // Header
      h('div', { className: 'card', style: { marginBottom: '16px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
          h('button', { className: 'btn-outline', onClick: goBack, type: 'button' }, '← Back'),
          h('h2', { style: { margin: 0 } }, `${icon} ${title}`),
          h('div', { className: 'small', style: { color: 'var(--muted, #6c757d)' } }, sessionDuration)
        ),

        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '10px',
            marginTop: '12px'
          }
        },
          h('div', null, h('div', { className: 'small' }, 'Score'), h('div', { className: `stat-value ${gradeClass}` }, `${stats.correct}/${stats.total}`)),
          h('div', null, h('div', { className: 'small' }, 'Accuracy'), h('div', { className: 'stat-value' }, `${accuracy}%`)),
          h('div', null, h('div', { className: 'small' }, 'Streak'), h('div', { className: 'stat-value' }, `${streakIcon} ${stats.streak}`)),
          h('div', null, h('div', { className: 'small' }, 'Avg Time'), h('div', { className: 'stat-value' }, `${(stats.avgResponseTime / 1000).toFixed(1)}s`))
        ),

        h('div', { style: { marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
          h('label', { className: 'small', style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('input', {
              type: 'checkbox',
              checked: autoDifficulty,
              onChange: (e) => setAutoDifficulty(!!e.target.checked)
            }),
            'Auto difficulty'
          ),
          h('label', { className: 'small', style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('input', {
              type: 'checkbox',
              checked: autoAdvance,
              onChange: (e) => setAutoAdvance(!!e.target.checked)
            }),
            'Auto advance'
          ),
          !autoDifficulty && h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            ...difficultyLevels.map(level =>
              h('button', {
                key: level,
                type: 'button',
                className: (difficulty === level) ? 'btn-primary' : 'btn-outline',
                onClick: () => setDifficulty(level)
              }, level)
            )
          )
        )
      ),

      // Question Card
      h('div', { className: 'card', style: { marginBottom: '16px' }, 'aria-live': 'polite' },
        h('div', { className: 'small', style: { display: 'flex', justifyContent: 'space-between', color: 'var(--muted, #6c757d)' } },
          h('span', null, `Difficulty: ${difficulty}`),
          h('span', null, `Q${stats.total + 1}`)
        ),

        h('h3', { style: { marginTop: '8px' } }, question?.q || 'Loading…'),

        audioPlay && h('button', {
          type: 'button',
          className: 'btn-secondary',
          onClick: handlePlayAudio,
          disabled: isPlaying,
          style: { marginTop: '8px' }
        }, isPlaying ? '🔊 Playing…' : '▶️ Play (Space)'),

        enableHints && !answered && h('button', {
          type: 'button',
          className: showHint ? 'btn-primary' : 'btn-outline',
          onClick: toggleHint,
          disabled: usedHint,
          style: { marginTop: '8px', marginLeft: audioPlay ? '8px' : 0 }
        }, showHint ? '💡 Hint shown' : '💡 Hint (H)'),

        showHint && h('div', {
          style: {
            marginTop: '10px',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface-2, #f8f9fa)'
          }
        }, h('div', { className: 'small' }, generateHint()))
      ),

      // Options
      h('div', { className: 'card' },
        options.map((opt, idx) => {
          const optStr = String(opt);
          const isCorrect = answered && question && optStr === String(question.a);
          const isWrongPick = answered && selected != null && optStr === String(selected) && !isCorrect;

          return h('button', {
            key: `${optStr}-${idx}`,
            type: 'button',
            className: isCorrect ? 'btn-success' : isWrongPick ? 'btn-danger' : 'btn-outline',
            onClick: () => { if (!answered) handleAnswer(optStr); },
            disabled: answered,
            style: { width: '100%', textAlign: 'left', marginBottom: '8px', display: 'flex', gap: '10px', alignItems: 'center' },
            title: `Press ${idx + 1} to select`
          },
            h('span', { style: { minWidth: '22px', fontWeight: 700 } }, idx + 1),
            h('span', { style: { flex: 1 } }, optStr),
            isCorrect ? h('span', null, '✓') : isWrongPick ? h('span', null, '✗') : null
          );
        }),

        showFeedback && h('div', { className: 'small', style: { marginTop: '10px', color: 'var(--muted, #6c757d)' } }, feedbackMessage),

        h('div', { style: { marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          h('button', {
            type: 'button',
            className: 'btn-secondary',
            onClick: () => {
              setShowFeedback(false);
              nextQuestionRef.current?.();
            }
          }, 'Next (N)'),
          answered && h('button', {
            type: 'button',
            className: 'btn-outline',
            onClick: () => {
              // replay audio after answer (useful for ear training)
              handlePlayAudio();
            }
          }, audioPlay ? 'Replay Audio' : 'Review'),
          h('button', {
            type: 'button',
            className: 'btn-outline',
            onClick: goBack
          }, 'Exit')
        ),

        h('div', { className: 'small', style: { marginTop: '10px', color: 'var(--muted, #6c757d)' } },
          'Shortcuts: 1–6 select • Enter submit • N next • Space play • H hint'
        )
      )
    );
  };
}

// --------------------------------------
// TESTER IMPLEMENTATIONS
// --------------------------------------

// --- Key Signature Tester ---
export const KeyTester = createTester({
  type: 'keys',
  title: 'Key Signature Tester',
  icon: '🎹',
  getData: () => {
    const keys = Array.isArray(C?.KEY_SIGNATURES) ? C.KEY_SIGNATURES : [];
    return {
      beginner: keys.slice(0, 7),
      intermediate: keys.slice(0, 12),
      advanced: keys
    };
  },
  questionTypes: [
    { q: 'What is the major key for #?', a: (item) => item?.major ?? item?.name ?? item?.sig },
    { q: 'What is the relative minor of #?', a: (item) => item?.minor ?? item?.name ?? item?.sig },
    { q: 'How many sharps/flats in #?', a: (item) => String(Math.abs(Number(item?.accidentals || 0))) },
    { q: 'Which key signature is this?', a: (item) => item?.sig ?? item?.name ?? item?.major }
  ],
  enableSRS: true,
  enableHints: true
});

// --- Tempo Tester ---
export const TempoTester = createTester({
  type: 'tempo',
  title: 'Tempo Recognition',
  icon: '⏱️',
  getData: () => ([
    { name: 'Largo (40 BPM)', bpm: 40 },
    { name: 'Adagio (60 BPM)', bpm: 60 },
    { name: 'Andante (76 BPM)', bpm: 76 },
    { name: 'Moderato (108 BPM)', bpm: 108 },
    { name: 'Allegro (132 BPM)', bpm: 132 },
    { name: 'Presto (168 BPM)', bpm: 168 },
    { name: 'Prestissimo (200 BPM)', bpm: 200 }
  ]),
  audioPlay: (item, done) => {
    const bpm = Number(item?.bpm || 0);
    const engine = Audio?.audioEngine;
    try {
      if (engine?.playMetronome) return engine.playMetronome(bpm, 8, done);
    } catch { /* noop */ }
    done?.();
    return null;
  },
  questionTypes: [{ q: 'What tempo is this?', a: (item) => item?.name }],
  enableSRS: true,
  enableHints: true
});

// --- Time Signature Tester ---
export const TimeSigTester = createTester({
  type: 'timesig',
  title: 'Time Signature Recognition',
  icon: '🎼',
  getData: () => ([
    { name: '2/4 (March)', sig: '2/4', pattern: [1, 0] },
    { name: '3/4 (Waltz)', sig: '3/4', pattern: [1, 0, 0] },
    { name: '4/4 (Common time)', sig: '4/4', pattern: [1, 0, 0.5, 0] },
    { name: '6/8 (Compound duple)', sig: '6/8', pattern: [1, 0, 0, 0.7, 0, 0] },
    { name: '5/4 (Quintuple)', sig: '5/4', pattern: [1, 0, 0, 0.7, 0] },
    { name: '7/8 (Irregular)', sig: '7/8', pattern: [1, 0, 0.7, 0, 0.7, 0, 0] },
    { name: '9/8 (Compound triple)', sig: '9/8', pattern: [1, 0, 0, 0.7, 0, 0, 0.7, 0, 0] }
  ]),
  audioPlay: (item, done) => {
    const engine = Audio?.audioEngine;
    try {
      if (engine?.playRhythmPattern) return engine.playRhythmPattern(item?.pattern || [], 120, done);
    } catch { /* noop */ }
    done?.();
    return null;
  },
  questionTypes: [{ q: 'What time signature is this pattern?', a: (item) => item?.name }],
  enableSRS: true,
  enableHints: true
});

// --- Chord/Arpeggio Tester ---
export const ArpeggioTester = createTester({
  type: 'arpeggio',
  title: 'Chord Recognition',
  icon: '🎵',
  getData: () => ([
    { name: 'Major Triad', id: 'major', intervals: [0, 4, 7] },
    { name: 'Minor Triad', id: 'minor', intervals: [0, 3, 7] },
    { name: 'Diminished Triad', id: 'dim', intervals: [0, 3, 6] },
    { name: 'Augmented Triad', id: 'aug', intervals: [0, 4, 8] },
    { name: 'Dominant 7th', id: 'dom7', intervals: [0, 4, 7, 10] },
    { name: 'Major 7th', id: 'maj7', intervals: [0, 4, 7, 11] },
    { name: 'Minor 7th', id: 'min7', intervals: [0, 3, 7, 10] },
    { name: 'Half-Diminished 7th', id: 'hdim7', intervals: [0, 3, 6, 10] }
  ]),
  audioPlay: (item, done) => {
    const engine = Audio?.audioEngine;
    try {
      const root = 60; // middle C
      const freqs = (item?.intervals || []).map(i => midiToFreq(root + i));
      if (engine?.playArpeggio) return engine.playArpeggio(freqs, done);
      if (engine?.playChord) return engine.playChord(freqs, done);
    } catch { /* noop */ }
    done?.();
    return null;
  },
  questionTypes: [{ q: 'What chord quality is this?', a: (item) => item?.name }],
  enableSRS: true,
  enableHints: false
});

// --- Scale Tester ---
export const ScaleTester = createTester({
  type: 'scales',
  title: 'Scale Recognition',
  icon: '🎹',
  getData: () => ([
    { name: 'Major Scale', pattern: [2, 2, 1, 2, 2, 2, 1] },
    { name: 'Natural Minor', pattern: [2, 1, 2, 2, 1, 2, 2] },
    { name: 'Harmonic Minor', pattern: [2, 1, 2, 2, 1, 3, 1] },
    { name: 'Melodic Minor', pattern: [2, 1, 2, 2, 2, 2, 1] },
    { name: 'Dorian Mode', pattern: [2, 1, 2, 2, 2, 1, 2] },
    { name: 'Mixolydian Mode', pattern: [2, 2, 1, 2, 2, 1, 2] }
  ]),
  audioPlay: (item, done) => {
    const engine = Audio?.audioEngine;
    try {
      const root = 60;
      const notes = [root];
      (item?.pattern || []).reduce((acc, step) => {
        const next = acc + step;
        notes.push(next);
        return next;
      }, root);

      const freqs = notes.map(midiToFreq);
      if (engine?.playScale) return engine.playScale(freqs, done);
      if (engine?.playMelody) return engine.playMelody(freqs, done);
    } catch { /* noop */ }
    done?.();
    return null;
  },
  questionTypes: [{ q: 'What scale is this?', a: (item) => item?.name }],
  enableSRS: true,
  enableHints: true
});

// --------------------------------------
// DEFAULT HUB COMPONENT (Route: "testers")
// --------------------------------------
export default function Testers({ navigate, showToast }) {
  const [active, setActive] = useState(null);

  const items = useMemo(() => ([
    { id: 'keys', title: 'Key Signatures', icon: '🎹', component: KeyTester, desc: 'Sharps/flats, relatives, recognition.' },
    { id: 'tempo', title: 'Tempo', icon: '⏱️', component: TempoTester, desc: 'Metronome tempo recognition.' },
    { id: 'timesig', title: 'Time Signatures', icon: '🎼', component: TimeSigTester, desc: 'Pattern-based meter recognition.' },
    { id: 'arpeggio', title: 'Chords', icon: '🎵', component: ArpeggioTester, desc: 'Chord-quality ear training.' },
    { id: 'scales', title: 'Scales', icon: '🎹', component: ScaleTester, desc: 'Scale-type recognition.' }
  ]), []);

  const go = useCallback((route) => {
    try {
      if (typeof navigate === 'function') return navigate(route);
      window.location.hash = `#${route}`;
    } catch {
      try { window.location.hash = `#${route}`; } catch { /* noop */ }
    }
  }, [navigate]);

  if (active) {
    const entry = items.find(x => x.id === active);
    const Comp = entry?.component;
    if (!Comp) setActive(null);

    return Comp
      ? h(Comp, {
          navigate,
          showToast,
          onBack: () => setActive(null)
        })
      : h('div', { className: 'container' }, 'Loading…');
  }

  return h('div', { className: 'container' },
    h('h2', null, '🧪 Testers'),
    h('p', null, 'Choose a tester. Difficulty and progress adapt as you practice.'),

    h('div', { style: { display: 'grid', gap: '12px' } },
      ...items.map(it =>
        h('div', { key: it.id, className: 'card' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' } },
            h('div', null,
              h('h3', { style: { margin: 0 } }, `${it.icon} ${it.title}`),
              h('div', { className: 'small', style: { color: 'var(--muted, #6c757d)', marginTop: '6px' } }, it.desc)
            ),
            h('button', {
              type: 'button',
              className: 'btn-primary',
              onClick: () => setActive(it.id)
            }, 'Start')
          )
        )
      )
    ),

    h('div', { style: { marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      h('button', { type: 'button', className: 'btn-secondary', onClick: () => go('menu') }, 'Main Menu'),
      h('button', { type: 'button', className: 'btn-outline', onClick: () => go('dashboard') }, 'Dashboard')
    )
  );
}