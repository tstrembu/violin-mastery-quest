// js/components/KeySignatures.js
// ========================================================
// VMQ KEY SIGNATURES v3.0 - ML-Enhanced
// Cooper's Key Signature & Bach Guide + Fingerboard Overlay
// Drop-in replacement: hardened imports + stable handMap prompts + safe engines
// ========================================================

const { createElement: h, useState, useEffect, useCallback, useMemo, useRef } = React;

import * as ConstMod from '../config/constants.js';
import * as SRSMod from '../engines/spacedRepetition.js';
import * as DiffMod from '../engines/difficultyAdapter.js';
import * as GameMod from '../engines/gamification.js';
import * as AnalyticsMod from '../engines/analytics.js';
import * as HelpersMod from '../utils/helpers.js';
import * as AudioMod from '../engines/audioEngine.js';
import * as KeyboardMod from '../utils/keyboard.js';
import * as A11yMod from '../utils/a11y.js';
import * as SessionMod from '../engines/sessionTracker.js';

// ---------------------------
// SAFE IMPORTS / FALLBACKS
// ---------------------------
const KEY_SIGNATURES = ConstMod.KEY_SIGNATURES || [];
const SHARP_ORDER = ConstMod.SHARP_ORDER || ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER  = ConstMod.FLAT_ORDER  || ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const PRAISE_MESSAGES = ConstMod.PRAISE_MESSAGES || ['Nice!', 'Great job!', 'Excellent!', 'Awesome!'];
const XP_VALUES = ConstMod.XP_VALUES || ConstMod.XPVALUES || { correct: 20 };

const selectNextItem = SRSMod.selectNextItem || null;
const updateItem = SRSMod.updateItem || null;
const getMasteryStats = SRSMod.getMasteryStats || null;
const getConfusionMatrix = SRSMod.getConfusionMatrix || null;
const getDueItems = SRSMod.getDueItems || null;

const getDifficulty = DiffMod.getDifficulty || null;
const getItemPool = DiffMod.getItemPool || null;
const getDifficultyInfo = DiffMod.getDifficultyInfo || null;
const getAdaptiveConfig = DiffMod.getAdaptiveConfig || null;

const addXP = GameMod.addXP || (() => {});
const recordStreak = GameMod.recordStreak || (() => {});
const getUserLevel = GameMod.getUserLevel || (() => 1);

const analyzeKeySignaturePerformance = AnalyticsMod.analyzeKeySignaturePerformance || null;
const predictSkillTransfer = AnalyticsMod.predictSkillTransfer || null;

const shuffle = HelpersMod.shuffle || ((arr) => [...arr].sort(() => Math.random() - 0.5));
const getRandom = HelpersMod.getRandom || ((arr) => arr[Math.floor(Math.random() * arr.length)]);
const normalizeText =
  HelpersMod.normalizeText ||
  ((s) => String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
  );
const debounce =
  HelpersMod.debounce ||
  ((fn, wait = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  });

const audioEngine = AudioMod.audioEngine || AudioMod.default || AudioMod;
const keyboard = KeyboardMod.keyboard || KeyboardMod.default || KeyboardMod;
const a11y = A11yMod.a11y || A11yMod.default || A11yMod || { announce: () => {} };
const sessionTracker = SessionMod.default || SessionMod.sessionTracker || SessionMod;

// ---------------------------
// SMALL UTILS
// ---------------------------
function safeCall(fn, ...args) {
  try { return fn?.(...args); } catch { return undefined; }
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function levenshteinDistance(a, b) {
  a = String(a || '');
  b = String(b || '');
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;

  const dp = Array.from({ length: n + 1 }, (_, i) => [i]);
  for (let j = 1; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = b[i - 1] === a[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j - 1] + 1, dp[i][j - 1] + 1, dp[i - 1][j] + 1);
    }
  }
  return dp[n][m];
}

function similarityScore(a, b) {
  a = normalizeText(a);
  b = normalizeText(b);
  if (!a.length || !b.length) return 0;
  const longer = a.length >= b.length ? a : b;
  const dist = levenshteinDistance(a, b);
  return (longer.length - dist) / longer.length;
}

// ---------------------------
// Fingerboard visualization component
// ---------------------------
function FingerboardMini({ keySignature, stringName, showCorrect = false }) {
  const strings = ['G', 'D', 'A', 'E'];
  const positions = [0, 1, 2, 3, 4]; // 0=open, 1..4 fingers

  const activeString = stringName || 'A';
  const map = keySignature?.handMap || {};
  const finger = String(map?.[activeString] ?? '0'); // e.g., "high2" / "low2"
  const isHigh = /high/i.test(finger);
  const isLow = /low/i.test(finger);
  const positionNum = parseInt(finger.replace(/high|low/gi, ''), 10) || 0;

  return h('div', {
      className: 'fingerboard-mini',
      role: 'img',
      'aria-label': `Violin fingerboard showing ${keySignature?.major || 'key'} on ${activeString} string`
    },
    h('div', { className: 'fingerboard-strings', 'aria-hidden': 'true' },
      strings.map(s => {
        const isActive = s === activeString;
        const sFinger = String(map?.[s] ?? '0');
        const sHigh = /high/i.test(sFinger);
        const sLow = /low/i.test(sFinger);
        const sPos = parseInt(sFinger.replace(/high|low/gi, ''), 10) || 0;

        return h('div', { key: s, className: `string ${isActive ? 'active' : ''}` },
          h('span', { className: 'string-label' }, s),
          positions.map(pos => {
            const shouldShow = showCorrect && isActive && pos === sPos;
            return h('div', {
              key: pos,
              className:
                `finger-position ${shouldShow ? 'correct' : ''} ` +
                `${(sHigh ? 'high' : '')} ${(sLow ? 'low' : '')}`,
              'data-position': pos
            });
          })
        );
      })
    ),
    showCorrect && h('div', { className: 'finger-hint' },
      `Finger ${positionNum} ${isHigh ? '(high position)' : isLow ? '(low position)' : ''}`.trim()
    )
  );
}

// ========================================================
// MAIN MODULE
// ========================================================

export function KeySignatures({ onBack, onAnswer, showToast }) {
  // Core state
  const [currentKey, setCurrentKey] = useState(null);
  const [questionType, setQuestionType] = useState('major'); // major | minor | handMap
  const [handMapString, setHandMapString] = useState('A');   // stable per-question
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');      // success | error | hint
  const [answered, setAnswered] = useState(false);

  // Stats / UX
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);                // normalized display rows
  const [responseTimeMs, setResponseTimeMs] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showFingerboard, setShowFingerboard] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, accuracy: 0 });

  // ML-ish session context
  const [difficultyInfo, setDifficultyInfo] = useState({ level: 'medium', label: 'Medium', description: '' });
  const [pool, setPool] = useState([]);
  const [adaptiveConfig, setAdaptiveConfig] = useState({});

  const startTimeRef = useRef(0);
  const inputRef = useRef(null);
  const isMountedRef = useRef(true);

  // Init: load difficulty/pool/config then generate
  useEffect(() => {
    isMountedRef.current = true;

    (async () => {
      // DifficultyInfo (sync or async)
      let di = { level: 'medium', label: 'Medium', description: '' };
      try {
        const maybe = safeCall(getDifficultyInfo, 'keySignatures');
        di = (maybe && typeof maybe.then === 'function') ? await maybe : (maybe || di);
      } catch {}
      if (!isMountedRef.current) return;
      setDifficultyInfo(di);

      // Pool (respect difficultyAdapter if present)
      let p = KEY_SIGNATURES;
      try {
        const maybePool = safeCall(getItemPool, 'keySignatures', KEY_SIGNATURES);
        p = (maybePool && typeof maybePool.then === 'function') ? await maybePool : (maybePool || p);
      } catch {}
      p = safeArray(p);
      if (!isMountedRef.current) return;
      setPool(p);

      // Adaptive config (optional)
      let ac = {};
      try {
        const maybeAC = safeCall(getAdaptiveConfig, 'keySignatures');
        ac = (maybeAC && typeof maybeAC.then === 'function') ? await maybeAC : (maybeAC || {});
      } catch {}
      if (!isMountedRef.current) return;
      setAdaptiveConfig(ac);

      a11y.announce?.('Key Signatures module loaded');

      sessionTracker?.trackActivity?.('keySignatures', 'module-start', {
        difficulty: di?.level || di?.label || 'medium',
        poolSize: p.length
      });

      // First question
      generateQuestion(p, di);
      // Focus
      setTimeout(() => inputRef.current?.focus?.(), 0);
    })();

    return () => { isMountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts: H = hint, Esc = close mastery/back
  useEffect(() => {
    const onKey = (e) => {
      if (!isMountedRef.current) return;
      const k = e.key;

      if (k === 'h' || k === 'H') {
        e.preventDefault();
        showHint();
        return;
      }
      if (k === 'Escape') {
        e.preventDefault();
        if (showMastery) setShowMastery(false);
        else onBack?.();
      }
    };

    // Prefer your keyboard utility if present
    if (keyboard?.onKeydown && keyboard?.offKeydown) {
      keyboard.onKeydown(onKey);
      return () => keyboard.offKeydown(onKey);
    }

    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [showMastery, onBack]); // showHint is stable via function hoisting below

  // ---------------------------
  // QUESTION GENERATION
  // ---------------------------
  async function generateQuestion(poolOverride, diffOverride) {
    const p = safeArray(poolOverride || pool);
    const di = diffOverride || difficultyInfo;

    if (!p.length) {
      setFeedback('No key signatures available.');
      setFeedbackType('error');
      return;
    }

    // Due items
    let dueIds = [];
    try {
      const due = safeCall(getDueItems, 'keySignatures', 10);
      const dueList = (due && typeof due.then === 'function') ? await due : due;
      dueIds = safeArray(dueList).map(x => x?.id).filter(Boolean);
    } catch {}

    // Confusion matrix / weak keys
    let matrix = {};
    try {
      const cm = safeCall(getConfusionMatrix, 'keySignatures');
      matrix = (cm && typeof cm.then === 'function') ? await cm : (cm || {});
    } catch {}

    const weakIds = Object.entries(matrix || {})
      .filter(([_, data]) => (data?.attempts || 0) > 3 && (data?.accuracy ?? 100) < 70)
      .map(([id]) => id);

    // Decide question type (focus weakest type if possible)
    const optimalType = predictOptimalQuestionType(p);
    const selectedType = optimalType || getRandom(['major', 'minor', 'handMap']);
    const selectedString = getRandom(['G', 'D', 'A', 'E']);

    // Build weighted pool: due (3.0), weak (2.5), else (1.0)
    const weighted = [];
    const seen = new Set();

    dueIds.forEach(id => {
      const item = p.find(k => k.id === id);
      if (item) {
        weighted.push({ ...item, __weight: 3.0, __reason: 'due' });
        seen.add(item.id);
      }
    });

    weakIds.forEach(id => {
      if (seen.has(id)) return;
      const item = p.find(k => k.id === id);
      if (item) {
        weighted.push({ ...item, __weight: 2.5, __reason: 'weak' });
        seen.add(item.id);
      }
    });

    p.forEach(item => {
      if (seen.has(item.id)) return;
      weighted.push({ ...item, __weight: 1.0, __reason: 'random' });
    });

    const chosen = weightedRandomSelect(weighted);

    setCurrentKey(chosen);
    setQuestionType(selectedType);
    setHandMapString(selectedString);

    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);
    setHintsUsed(0);
    setShowFingerboard(false);
    setResponseTimeMs(0);
    startTimeRef.current = Date.now();

    // Update mastery snapshot for overlay
    refreshMasterySnapshot(p);

    sessionTracker?.trackActivity?.('keySignatures', 'question-generated', {
      keyId: chosen?.id,
      questionType: selectedType,
      reason: chosen?.__reason,
      difficulty: di?.level || di?.label || 'medium'
    });

    // Auto-hint if historically slow
    const predicted = predictResponseTime(chosen?.id, selectedType, di, matrix);
    if (predicted > 5000) {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!answered) showHint();
      }, 3000);
    }

    // focus input on new question
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }

  function refreshMasterySnapshot(p) {
    const ids = safeArray(p).map(k => k.id).filter(Boolean);
    let stats = [];
    try {
      stats = safeCall(getMasteryStats, ids) || [];
    } catch { stats = []; }

    // Normalize into display rows without assuming engine shape
    const rows = safeArray(stats).map((s) => {
      const id = s?.id ?? s?.keyId ?? s?.itemId;
      const seen = s?.seen ?? s?.attempts ?? 0;
      const correct = s?.correct ?? s?.right ?? 0;
      const accuracy = (typeof s?.accuracy === 'number')
        ? s.accuracy
        : (seen > 0 ? Math.round((correct / seen) * 100) : 0);

      const avgTime = s?.avgTime ?? s?.avgResponseTime ?? 0;
      const status =
        accuracy >= 90 ? 'mastered' :
        accuracy >= 75 ? 'good' :
        seen === 0 ? 'new' : 'needs-work';

      return { id, seen, correct, accuracy, avgTime, status, lastQuestionType: s?.lastQuestionType };
    });

    setMastery(rows);
  }

  function predictOptimalQuestionType(p) {
    // If mastery rows contain lastQuestionType, infer weakest type by average accuracy
    try {
      const ids = safeArray(p).map(k => k.id).filter(Boolean);
      const stats = safeArray(safeCall(getMasteryStats, ids));

      const buckets = { major: [], minor: [], handMap: [] };
      stats.forEach(s => {
        const t = s?.lastQuestionType;
        if (t && buckets[t]) buckets[t].push(s);
      });

      let weakest = null;
      let lowest = 101;

      Object.entries(buckets).forEach(([t, arr]) => {
        if (!arr.length) return;
        const avgAcc = arr.reduce((sum, s) => sum + (s?.accuracy ?? 0), 0) / arr.length;
        if (avgAcc < lowest) {
          lowest = avgAcc;
          weakest = t;
        }
      });

      return weakest;
    } catch {
      return null;
    }
  }

  function predictResponseTime(keyId, qType, di, matrix) {
    const hist = (matrix && keyId && matrix[keyId]) ? matrix[keyId] : null;
    const base = (hist?.avgTime || hist?.avgResponseTime || 3000);
    const level = di?.level || di?.label || 'medium';
    const mult = level === 'easy' ? 0.8 : level === 'hard' ? 1.2 : 1.0;
    // handMap is often slower
    const typeMult = qType === 'handMap' ? 1.15 : 1.0;
    return base * mult * typeMult;
  }

  function weightedRandomSelect(items) {
    const arr = safeArray(items).filter(x => (x?.__weight ?? x?.weight ?? 1) > 0);
    const total = arr.reduce((sum, it) => sum + (it.__weight ?? it.weight ?? 1), 0);
    if (!arr.length || total <= 0) return items?.[0] || null;

    let r = Math.random() * total;
    for (const it of arr) {
      r -= (it.__weight ?? it.weight ?? 1);
      if (r <= 0) return it;
    }
    return arr[0];
  }

  // ---------------------------
  // QUESTION/ANSWER TEXT
  // ---------------------------
  const questionText = useMemo(() => {
    if (!currentKey) return '';
    const abs = Math.abs(currentKey.accidentals || 0);
    const typ = currentKey.type === 'sharp' ? 'sharp' : 'flat';
    const plural = abs === 1 ? '' : 's';

    switch (questionType) {
      case 'major':
        if (abs === 0) return 'What is the major key with no sharps or flats?';
        return `What is the major key with ${abs} ${typ}${plural}?`;
      case 'minor':
        return `What is the relative minor of ${currentKey.major}?`;
      case 'handMap':
        return `In ${currentKey.major}, what is the 2nd finger on the ${handMapString} string? (high2 or low2)`;
      default:
        return '';
    }
  }, [currentKey, questionType, handMapString]);

  function checkAnswer(answer) {
    if (!currentKey) return false;
    const normalized = normalizeText(answer);

    switch (questionType) {
      case 'major':
        return normalizeText(currentKey.major) === normalized;
      case 'minor':
        return normalizeText(currentKey.minor) === normalized;
      case 'handMap': {
        const correct = currentKey?.handMap?.[handMapString];
        if (!correct) return false;
        return normalizeText(correct) === normalized;
      }
      default:
        return false;
    }
  }

  function getCorrectAnswer() {
    if (!currentKey) return '—';
    switch (questionType) {
      case 'major': return currentKey.major;
      case 'minor': return currentKey.minor;
      case 'handMap': return currentKey?.handMap?.[handMapString] || '—';
      default: return '—';
    }
  }

  // ---------------------------
  // HINTS
  // ---------------------------
  function showHint() {
    if (!currentKey || answered) return;

    const nextHints = hintsUsed + 1;
    setHintsUsed(nextHints);

    let hint = '';
    if (questionType === 'major') {
      const order = currentKey.type === 'sharp' ? SHARP_ORDER : FLAT_ORDER;
      hint = `Order: ${order.join(', ')}. (${currentKey.major} uses the first ${Math.abs(currentKey.accidentals || 0)}.)`;
    } else if (questionType === 'minor') {
      hint = `Relative minor is 3 half steps down: ${currentKey.major} → ${currentKey.minor}`;
    } else if (questionType === 'handMap') {
      hint = `On the ${handMapString} string: ${currentKey?.handMap?.[handMapString] || '—'}`;
      setShowFingerboard(true);
    }

    setFeedback(hint);
    setFeedbackType('hint');

    sessionTracker?.trackActivity?.('keySignatures', 'hint-used', {
      keyId: currentKey.id,
      questionType,
      hintsUsed: nextHints
    });
  }

  // ---------------------------
  // ML-ish typing hint
  // ---------------------------
  const debouncedLikelihood = useMemo(() => debounce((value) => {
    if (!inputRef.current || answered) return;
    const likely = similarityScore(value, getCorrectAnswer()) > 0.7;
    if (likely) inputRef.current.classList.add('likely-correct');
    else inputRef.current.classList.remove('likely-correct');
  }, 250), [answered, currentKey, questionType, handMapString]);

  // ---------------------------
  // SUBMIT
  // ---------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    if (answered || !String(userAnswer || '').trim() || !currentKey) return;

    const end = Date.now();
    const rt = Math.max(0, end - (startTimeRef.current || end));
    setResponseTimeMs(rt);

    const isCorrect = checkAnswer(userAnswer);
    setAnswered(true);

    // Record SRS: try a few common signatures safely
    try {
      if (updateItem) {
        // signature A: (id, correctBool, responseTime, questionType)
        if (updateItem.length >= 4) {
          await updateItem(currentKey.id, isCorrect, rt, questionType);
        } else {
          // signature B: (id, quality, responseTime, meta)
          const quality = isCorrect ? (hintsUsed ? 4 : 5) : 2;
          await updateItem(currentKey.id, quality, rt, {
            module: 'keySignatures',
            questionType,
            hintsUsed,
            keyId: currentKey.id
          });
        }
      }
    } catch {}

    // Parent callback
    try { onAnswer?.(isCorrect); } catch {}

    // Stats
    setSessionStats(prev => {
      const correct = prev.correct + (isCorrect ? 1 : 0);
      const total = prev.total + 1;
      return { correct, total, accuracy: Math.round((correct / total) * 100) };
    });

    // Feedback + XP + Audio
    if (isCorrect) {
      const praise = getRandom(PRAISE_MESSAGES);
      setFeedback(praise);
      setFeedbackType('success');

      const baseXP = XP_VALUES.correct ?? 20;
      const speedBonus = rt < 2000 ? 1.5 : rt < 4000 ? 1.2 : 1.0;
      const level = (difficultyInfo?.level || difficultyInfo?.label || 'medium');
      const difficultyBonus = level === 'hard' ? 1.3 : level === 'medium' ? 1.1 : 1.0;
      const hintPenalty = hintsUsed ? 0.7 : 1.0;
      const totalXP = Math.max(1, Math.floor(baseXP * speedBonus * difficultyBonus * hintPenalty));

      try { addXP(totalXP, 'key-signatures-correct'); } catch {}
      try { recordStreak?.('keySignatures', true); } catch {}
      showToast?.(`+${totalXP} XP! ${praise}`, 'success');

      try { audioEngine?.playSuccess?.(); } catch {}
    } else {
      const correctAnswer = getCorrectAnswer();
      setFeedback(`The correct answer is: ${correctAnswer}`);
      setFeedbackType('error');
      try { recordStreak?.('keySignatures', false); } catch {}
      showToast?.('Try again!', 'error');

      try { audioEngine?.playError?.(); } catch {}
    }

    // Analytics: performance + skill transfer (optional)
    setTimeout(async () => {
      await analyzePerformanceAndTransfer(isCorrect, rt);
    }, 350);

    // Auto-advance with adaptive-ish timing
    const nextDelay = isCorrect ? Math.max(1400, 2800 - rt) : 3800;
    setTimeout(() => {
      if (!isMountedRef.current) return;
      // clear likely-correct style
      inputRef.current?.classList?.remove?.('likely-correct');
      generateQuestion();
    }, nextDelay);
  }

  async function analyzePerformanceAndTransfer(isCorrect, rt) {
    if (!currentKey) return;

    try {
      if (analyzeKeySignaturePerformance) {
        const analysis = await analyzeKeySignaturePerformance(currentKey.id, {
          isCorrect,
          responseTime: rt,
          questionType,
          hintsUsed,
          difficulty: difficultyInfo?.level || difficultyInfo?.label || 'medium'
        });

        if (analysis?.breakthroughDetected && predictSkillTransfer) {
          const transfers = await predictSkillTransfer('keySignatures', currentKey.id);
          safeArray(transfers).forEach((t) => {
            if ((t?.confidence ?? 0) > 0.7) {
              const bonus = t?.bonusXP ?? 10;
              showToast?.(`${t?.targetModule || 'Another module'} may be easier now! +${bonus} XP`, 'success');
              try { addXP(bonus, 'skill-transfer'); } catch {}
              sessionTracker?.trackActivity?.('keySignatures', 'skill-transfer-detected', t);
            }
          });
        }
      }
    } catch {}
  }

  // Mastery overlay toggle
  function toggleMastery() {
    const willShow = !showMastery;
    setShowMastery(willShow);
    if (willShow) {
      refreshMasterySnapshot(pool);
      sessionTracker?.trackActivity?.('keySignatures', 'mastery-viewed');
    }
  }

  // Staff accidental display helpers
  const accidentalCount = Math.abs(currentKey?.accidentals || 0);
  const accidentalNotes = useMemo(() => {
    if (!currentKey || accidentalCount === 0) return [];
    const order = currentKey.type === 'sharp' ? SHARP_ORDER : FLAT_ORDER;
    return order.slice(0, accidentalCount);
  }, [currentKey, accidentalCount]);

  // ---------------------------
  // RENDER
  // ---------------------------
  return h('div', { className: 'mode-container keysig-mode', 'data-question-type': questionType },
    // Header
    h('header', { className: 'mode-header' },
      h('button', {
        className: 'btn-back',
        onClick: () => {
          sessionTracker?.trackActivity?.('keySignatures', 'module-exit', {
            sessionStats,
            // best effort duration
            duration: Date.now() - (startTimeRef.current || Date.now())
          });
          onBack?.();
        }
      }, '← Back'),
      h('h2', null, '🎼 Key Signatures'),
      h('div', { className: 'difficulty-badge', 'data-level': difficultyInfo?.level || 'medium' },
        difficultyInfo?.label || difficultyInfo?.level || 'Medium',
        h('span', { className: 'ml-indicator', title: 'Adaptive selection enabled' }, ' 🤖')
      )
    ),

    h('div', { className: 'mode-content' },
      currentKey ? h('div', { className: 'keysig-area' },
        // Key signature visual
        h('div', { className: 'keysig-visual' },
          h('div', { className: 'staff' },
            h('div', { className: 'clef' }, '𝄞'),
            h('div', { className: 'accidentals-display' },
              accidentalCount === 0
                ? h('span', { className: 'no-accidentals' }, 'No sharps or flats')
                : h('div', { className: `accidentals ${currentKey.type}` },
                    accidentalNotes.map((note, i) =>
                      h('span', {
                        key: i,
                        className: 'accidental',
                        'data-note': note
                      }, currentKey.type === 'sharp' ? '♯' : '♭')
                    )
                  )
            )
          )
        ),

        // Circle-of-fifths indicator (safe)
        h('div', { className: 'circle-indicator' },
          h('div', { className: 'circle-track' },
            h('div', {
              className: 'circle-marker',
              style: {
                '--position': (currentKey.circlePosition ?? 0),
                '--color': currentKey.type === 'sharp' ? '#3b82f6' : '#ef4444'
              }
            })
          ),
          h('div', { className: 'circle-label' },
            `${currentKey.major} (${(currentKey.accidentals > 0 ? '+' : '') + (currentKey.accidentals || 0)})`
          )
        ),

        // Question text
        h('p', { className: 'instruction', 'aria-live': 'polite' }, questionText),

        // Fingerboard overlay
        (questionType === 'handMap') && h(FingerboardMini, {
          keySignature: currentKey,
          stringName: handMapString,
          showCorrect: showFingerboard
        }),

        // Answer form
        h('form', { onSubmit: handleSubmit, className: 'answer-form' },
          h('input', {
            type: 'text',
            className: 'input-key',
            value: userAnswer,
            onChange: (e) => {
              const v = e.target.value;
              setUserAnswer(v);
              debouncedLikelihood(v);
            },
            placeholder: questionType === 'handMap' ? 'high2 or low2' : 'Key name…',
            disabled: answered,
            autoComplete: 'off',
            ref: inputRef,
            'aria-label': 'Answer input'
          }),
          h('div', { className: 'form-actions' },
            h('button', {
              type: 'button',
              className: 'btn btn-secondary btn-hint',
              onClick: showHint,
              disabled: answered || hintsUsed >= 2
            }, `Hint (${hintsUsed}/2)`),
            h('button', {
              type: 'submit',
              className: 'btn btn-primary',
              disabled: answered || !String(userAnswer || '').trim()
            }, 'Check')
          )
        ),

        // Session stats
        h('div', { className: 'session-stats' },
          h('div', { className: 'stat-item' },
            h('span', { className: 'stat-value' }, `${sessionStats.accuracy}%`),
            h('span', { className: 'stat-label' }, 'Accuracy')
          ),
          h('div', { className: 'stat-item' },
            h('span', { className: 'stat-value' }, `${sessionStats.correct}/${sessionStats.total}`),
            h('span', { className: 'stat-label' }, 'Correct')
          ),
          h('div', { className: 'stat-item' },
            h('span', { className: 'stat-value' }, `${Math.round((responseTimeMs || 0) / 1000)}s`),
            h('span', { className: 'stat-label' }, 'Time')
          )
        ),

        // Tiny reference line
        h('div', { className: 'hint-text' },
          [
            (difficultyInfo?.description || '').trim(),
            currentKey?.appearsIn ? `Appears in: ${currentKey.appearsIn}` : ''
          ].filter(Boolean).join(' • ')
        )
      ) : h('div', { className: 'card' }, 'Loading key signatures…'),

      // Feedback
      feedback && h('div', {
        className: `feedback feedback-${feedbackType}`,
        'aria-live': 'assertive'
      }, feedback),

      // Mastery toggle
      h('button', {
        className: 'btn btn-secondary btn-mastery-toggle',
        onClick: toggleMastery,
        'aria-expanded': showMastery
      }, showMastery ? 'Hide Circle of Fifths' : 'Show Circle of Fifths')
    ),

    // Mastery overlay
    showMastery && h('div', {
        className: 'mastery-overlay',
        onClick: (e) => {
          if (e.target && e.target.classList && e.target.classList.contains('mastery-overlay')) {
            setShowMastery(false);
          }
        }
      },
      h('div', { className: 'mastery-panel' },
        h('div', { className: 'mastery-header' },
          h('h3', null, 'Circle of Fifths Mastery'),
          h('button', { className: 'btn-close', onClick: toggleMastery, 'aria-label': 'Close mastery view' }, '×')
        ),

        // Simple circle grid (engine-agnostic)
        h('div', { className: 'circle-of-fifths' },
          h('div', { className: 'circle-major' },
            mastery.map(stat => {
              const keyObj = KEY_SIGNATURES.find(k => k.id === stat.id);
              if (!keyObj) return null;
              return h('div', {
                key: `major-${stat.id}`,
                className: `circle-key ${stat.status || ''}`,
                'data-key': keyObj.major,
                onClick: () => {
                  setCurrentKey(keyObj);
                  setQuestionType('major');
                  setUserAnswer('');
                  setAnswered(false);
                  setFeedback('');
                  setFeedbackType('');
                  setShowFingerboard(false);
                  setHintsUsed(0);
                  setShowMastery(false);
                  startTimeRef.current = Date.now();
                  setTimeout(() => inputRef.current?.focus?.(), 0);
                }
              },
                h('span', { className: 'key-name' }, keyObj.major),
                h('span', { className: 'key-accidentals' },
                  keyObj.accidentals === 0 ? '0' : `${keyObj.accidentals > 0 ? '+' : ''}${keyObj.accidentals}`
                ),
                (stat.accuracy > 0) && h('span', { className: 'key-mastery' }, `${stat.accuracy}%`)
              );
            })
          ),
          h('div', { className: 'circle-minor' },
            mastery.map(stat => {
              const keyObj = KEY_SIGNATURES.find(k => k.id === stat.id);
              if (!keyObj) return null;
              return h('div', {
                key: `minor-${stat.id}`,
                className: `circle-key ${stat.status || ''}`,
                'data-key': keyObj.minor,
                onClick: () => {
                  setCurrentKey(keyObj);
                  setQuestionType('minor');
                  setUserAnswer('');
                  setAnswered(false);
                  setFeedback('');
                  setFeedbackType('');
                  setShowFingerboard(false);
                  setHintsUsed(0);
                  setShowMastery(false);
                  startTimeRef.current = Date.now();
                  setTimeout(() => inputRef.current?.focus?.(), 0);
                }
              }, h('span', { className: 'key-name' }, keyObj.minor));
            })
          )
        ),

        h('div', { className: 'mastery-details' },
          h('div', { className: 'mastery-list' },
            mastery.map(stat => {
              const keyObj = KEY_SIGNATURES.find(k => k.id === stat.id);
              if (!keyObj) return null;
              return h('div', { key: stat.id, className: `mastery-item ${stat.status || ''}` },
                h('div', { className: 'mastery-item-name' }, `${keyObj.major} / ${keyObj.minor}`),
                h('div', { className: 'mastery-item-stats' },
                  `${stat.accuracy}% (${stat.correct}/${stat.seen}) • avg ${Math.round((stat.avgTime || 0) / 1000)}s`
                ),
                h('div', { className: 'mastery-item-bar' },
                  h('div', { className: 'mastery-item-fill', style: { width: `${Math.max(0, Math.min(100, stat.accuracy || 0))}%` } })
                )
              );
            })
          )
        )
      )
    )
  );
}

// Also export default for compatibility with default-import patterns
export default KeySignatures;
