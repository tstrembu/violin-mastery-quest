// js/components/Bieler.js
// ======================================
// VMQ BIELER v3.0.5 - Technique Vocabulary with ML Intelligence
// Progressive Hints • Adaptive Difficulty • Voice Input • Analytics
// ======================================

const { createElement: h, useState, useEffect, useRef, useMemo, useCallback } = React;

// Imports
import {
  BIELER_VOCAB,
  TECHNIQUE_TASKS,
  PRAISE_MESSAGES,
  BIELER_TAXONOMY,
  REFLECTION_PROMPTS
} from '../config/constants.js';

import {
  selectNextItem,
  updateItem,
  getMasteryStats,
  getConfusionMatrix,
  recordConfusion
} from '../engines/spacedRepetition.js';

import {
  getDifficulty,
  getBielerPool,
  getDifficultyInfo,
  analyzeResponseTime,
  predictMasteryCurve
} from '../engines/difficultyAdapter.js';

import {
  getRandom,
  fuzzyMatch,
  normalizeText,
  calculateSemanticSimilarity,
  extractKeyConcepts
} from '../utils/helpers.js';

import {
  awardXP,
  incrementDailyItems,
  recordStreak,
  getStreak,
  unlockAchievement
} from '../engines/gamification.js';

import {
  updateStats,
  getSessionStats,
  recordBreakthrough,
  detectPlateau
} from '../config/storage.js';

import {
  playFeedback,
  playSuccess,
  playHintReveal
} from '../engines/audioEngine.js';

import {
  getCoachRecommendation,
  logBielerSession
} from '../engines/coachEngine.js';

import {
  trackEvent,
  trackTimeOnTask,
  trackHintUsage
} from '../engines/analytics.js';

// ---------------------------
// Small safety helpers
// ---------------------------
function safeFn(fn, ...args) {
  try {
    return (typeof fn === 'function') ? fn(...args) : undefined;
  } catch (_) {
    return undefined;
  }
}
function safeToast(showToast, msg, type = 'info') {
  try { showToast && showToast(msg, type); } catch (_) {}
}
function toTitleCase(str) {
  return String(str || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------
// Quality mapping for SM-2 style engines
// updateItem(itemId, quality0to5, responseTimeMs, metadata)
// ---------------------------
function toSM2Quality({ correct, score, partial, timeQuality }) {
  let q = 0;

  if (correct) {
    if (score >= 0.90) q = 5;
    else if (score >= 0.75) q = 4;
    else q = 3;
  } else if (partial) {
    q = 2;
  } else {
    q = 0;
  }

  // Optional time-based nudges (never exceed bounds)
  if (timeQuality === 'fast') q = Math.min(5, q + 1);
  if (timeQuality === 'slow') q = Math.max(0, q - 1);

  return q;
}

// ---------------------------
// Main Component
// ---------------------------
export function Bieler({ navigate, onAnswer, showToast }) {
  // ✅ Mode state
  const [mode, setMode] = useState('vocabulary'); // 'vocabulary', 'scenario', 'lab'

  // Vocabulary mode state
  const [currentTerm, setCurrentTerm] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);

  // Mastery overlay
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);

  // XP & hinting
  const [potentialXP, setPotentialXP] = useState(15);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintText, setHintText] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);

  // Streak/challenge
  const [streak, setStreak] = useState(0);
  const [challengeMode, setChallengeMode] = useState(false);

  // Analytics state
  const [responseTime, setResponseTime] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    correct: 0,
    avgAccuracy: 0,
    avgTime: 0,
    breakthroughs: 0,
    plateaus: 0
  });

  // Voice input
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Refs for timing & stability
  const inputRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const mountedRef = useRef(false);
  const autoAdvanceTimerRef = useRef(null);

  // Latest values for voice callback safety
  const currentTermRef = useRef(null);
  const userAnswerRef = useRef('');
  const answeredRef = useRef(false);

  useEffect(() => { currentTermRef.current = currentTerm; }, [currentTerm]);
  useEffect(() => { userAnswerRef.current = userAnswer; }, [userAnswer]);
  useEffect(() => { answeredRef.current = answered; }, [answered]);

  // Difficulty/pool (with safe fallbacks)
  const difficultyInfo = useMemo(() => {
    const info = safeFn(getDifficultyInfo, 'bieler');
    if (info && typeof info === 'object') return info;
    return { level: 1, label: 'Standard' };
  }, []);

  const level = Number(difficultyInfo.level) || 1;

  const pool = useMemo(() => {
    const p = safeFn(getBielerPool, level);
    if (Array.isArray(p) && p.length) return p;
    return Array.isArray(BIELER_VOCAB) ? BIELER_VOCAB : [];
  }, [level]);

  // ---------------------------
  // Initialization
  // ---------------------------
  useEffect(() => {
    mountedRef.current = true;

    // Load streak
    setStreak(safeFn(getStreak, 'bieler') || 0);

    // Initialize voice recognition if available
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      try {
        const r = new SpeechRecognition();
        r.continuous = false;
        r.interimResults = false;
        r.lang = 'en-US';

        r.onresult = (event) => {
          const transcript = event?.results?.[0]?.[0]?.transcript || '';
          if (!mountedRef.current) return;

          // Populate answer, then submit on next tick using refs (avoids stale closures)
          setUserAnswer(transcript);
          setTimeout(() => {
            // Prevent submitting if already answered
            if (answeredRef.current) return;
            const termNow = currentTermRef.current;
            const ansNow = String(userAnswerRef.current || transcript || '').trim();
            if (!termNow || !ansNow) return;

            // We call the same handler used by form submit:
            safeFn(_submitAnswerRef.current);
          }, 0);
        };

        r.onerror = () => {
          if (!mountedRef.current) return;
          setIsListening(false);
          safeToast(showToast, 'Voice recognition failed. Please type your answer.', 'error');
        };

        r.onend = () => {
          if (!mountedRef.current) return;
          setIsListening(false);
        };

        recognitionRef.current = r;
      } catch (_) {
        recognitionRef.current = null;
      }
    }

    // Session timer: time-on-task
    const timer = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      safeFn(trackTimeOnTask, 'bieler', elapsed);
    }, 1000);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      try { recognitionRef.current?.abort?.(); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // Coach suggestion (on entering vocab mode)
  // ---------------------------
  useEffect(() => {
    if (mode !== 'vocabulary') return;
    const coachRec = safeFn(getCoachRecommendation, 'bieler');
    if (coachRec && coachRec.priority === 'high' && coachRec.suggestion) {
      safeToast(showToast, `Coach suggests: ${coachRec.suggestion}`, 'info');
    }
  }, [mode, showToast]);

  // ---------------------------
  // Generate question
  // ---------------------------
  const generateQuestion = useCallback(() => {
    if (!Array.isArray(pool) || pool.length === 0) {
      setFeedback('No vocabulary terms available.');
      setFeedbackType('error');
      return;
    }

    // Candidate IDs
    const termIds = pool.map(item => item?.term).filter(Boolean);
    if (!termIds.length) {
      setFeedback('No vocabulary term IDs found.');
      setFeedbackType('error');
      return;
    }

    // Select next term via SRS helper (fallback to random)
    const selectedTerm = safeFn(selectNextItem, termIds) || termIds[Math.floor(Math.random() * termIds.length)];
    const vocabItem = pool.find(item => item?.term === selectedTerm) || pool[0];

    // Predict mastery/difficulty & adjust XP (safe fallbacks)
    const predicted = safeFn(predictMasteryCurve, selectedTerm, 'bieler');
    const predictedDifficulty = (typeof predicted === 'number' && Number.isFinite(predicted)) ? predicted : 0.5;

    const xpBase = 15;
    const xpBonus = Math.max(0, Math.round((predictedDifficulty - 0.5) * 10));
    const finalXP = xpBase + xpBonus;

    // Reset state for new question
    setCurrentTerm(vocabItem);
    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);
    setPotentialXP(finalXP);
    setHintLevel(0);
    setHintText('');
    setHintsUsed(0);
    setResponseTime(0);

    // Start timer
    startTimeRef.current = Date.now();

    // Update mastery stats
    const stats = safeFn(getMasteryStats, termIds);
    setMastery(Array.isArray(stats) ? stats : []);

    // Focus input
    setTimeout(() => inputRef.current?.focus?.(), 80);

    // Analytics
    safeFn(trackEvent, 'bieler', 'question_generated', {
      term: selectedTerm,
      predictedDifficulty,
      xpReward: finalXP,
      level
    });

  }, [pool, level]);

  // Start first question when entering vocabulary mode
  useEffect(() => {
    if (mode === 'vocabulary') generateQuestion();
  }, [mode, generateQuestion]);

  // ---------------------------
  // Answer scoring (exact/fuzzy/semantic/key concepts)
  // ---------------------------
  const checkAnswer = useCallback((answer, term) => {
    const ans = String(answer || '');
    const t = term || {};
    const def = String(t.definition || '');

    const normalized = safeFn(normalizeText, ans) || String(ans).trim().toLowerCase();
    const correctDef = safeFn(normalizeText, def) || String(def).trim().toLowerCase();

    if (!def) return { correct: false, score: 0, partial: false };

    // Exact match
    if (normalized && normalized === correctDef) return { correct: true, score: 1.0, partial: false };

    // Acceptable answers
    const acceptable = Array.isArray(t.acceptableAnswers) ? t.acceptableAnswers : [];
    for (const a of acceptable) {
      const na = safeFn(normalizeText, a) || String(a).trim().toLowerCase();
      if (na && na === normalized) return { correct: true, score: 1.0, partial: false };
      const fuzzyOk = safeFn(fuzzyMatch, ans, a, 0.7);
      if (fuzzyOk) return { correct: true, score: 0.9, partial: false };
    }

    // Fuzzy match against definition
    const fuzzyDefOk = safeFn(fuzzyMatch, ans, def, 0.65);
    if (fuzzyDefOk) return { correct: true, score: 0.8, partial: false };

    // Semantic similarity
    const sem = safeFn(calculateSemanticSimilarity, ans, def);
    if (typeof sem === 'number' && sem > 0.7) return { correct: true, score: 0.7, partial: false };

    // Key concepts (partial credit)
    const keys = safeFn(extractKeyConcepts, def);
    const keyConcepts = Array.isArray(keys) ? keys : String(def).split(/\s+/).slice(0, 3);
    const hasKey = keyConcepts.some(c => {
      const nc = safeFn(normalizeText, c) || String(c).trim().toLowerCase();
      return nc && normalized.includes(nc);
    });

    if (hasKey) return { correct: false, score: 0.3, partial: true };

    return { correct: false, score: 0, partial: false };
  }, []);

  // ---------------------------
  // Confusion logging (optional feature)
  // If the user answer looks like another term, record confusion current -> other
  // ---------------------------
  const maybeRecordConfusion = useCallback((answerText, termNow) => {
    const ans = String(answerText || '').trim();
    const termId = termNow?.term;
    if (!ans || !termId || !Array.isArray(pool) || pool.length < 2) return;

    // Find a different term whose *term label* matches the answer (fuzzy)
    const hit = pool.find(item => {
      if (!item?.term || item.term === termId) return false;
      const ok = safeFn(fuzzyMatch, ans, item.term, 0.75);
      return !!ok;
    });

    if (hit?.term) {
      safeFn(recordConfusion, termId, hit.term);
      safeFn(trackEvent, 'bieler', 'confusion_recorded', { from: termId, to: hit.term });
    }
  }, [pool]);

  // ---------------------------
  // Progressive hint system (4 levels)
  // IMPORTANT: No state mutations during render.
  // Hints are revealed only on button click.
  // ---------------------------
  const revealHint = useCallback(() => {
    if (!currentTerm || hintLevel >= 4) return;

    const nextLevel = hintLevel + 1;
    setHintLevel(nextLevel);
    setHintsUsed(v => v + 1);

    // Track hint usage + reduce XP
    safeFn(trackHintUsage, 'bieler', currentTerm.term, nextLevel);
    setPotentialXP(prev => Math.max(5, (Number(prev) || 0) - 3));

    // Build hint text
    const def = String(currentTerm.definition || '');
    const keys = safeFn(extractKeyConcepts, def);
    const keyConcepts = Array.isArray(keys) ? keys : def.split(/\s+/).slice(0, 3);

    let text = '';
    if (nextLevel === 1) {
      text = `💡 First letter: "${def[0] || ''}"`;
    } else if (nextLevel === 2) {
      text = `💡 Key concept: ${keyConcepts[0] || 'technique'}`;
    } else if (nextLevel === 3) {
      const cat = String(currentTerm.category || '').replace(/_/g, ' ').trim();
      text = `💡 This relates to: ${cat || 'a technique concept'}`;

      // Optional: show common confusion info if available
      const cm = safeFn(getConfusionMatrix) || {};
      const prefix = `${String(currentTerm.term)}→`;
      const candidates = Object.entries(cm)
        .filter(([k]) => k.startsWith(prefix))
        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
        .slice(0, 1);

      if (candidates.length) {
        const to = candidates[0][0].split('→')[1];
        if (to) text += `\n💡 Commonly confused with: ${to}`;
      }
    } else if (nextLevel === 4) {
      text = `💡 Full definition: ${def}`;
    }

    setHintText(text);

    // Audio cue
    safeFn(playHintReveal);

    // Analytics
    safeFn(trackEvent, 'bieler', 'hint_revealed', {
      term: currentTerm.term,
      level: nextLevel,
      hintsUsed: nextLevel,
      xpNow: potentialXP
    });
  }, [currentTerm, hintLevel, potentialXP]);

  // ---------------------------
  // Submit handler (core logic)
  // ---------------------------
  const _submitAnswerRef = useRef(null);

  const handleSubmit = useCallback((e) => {
    try { e?.preventDefault?.(); } catch (_) {}

    if (answered || !currentTerm) return;
    const ans = String(userAnswer || '').trim();
    if (!ans) return;

    const result = checkAnswer(ans, currentTerm);

    const timeTaken = Date.now() - (startTimeRef.current || Date.now());
    setResponseTime(timeTaken);

    // Analyze response time
    const tq = safeFn(analyzeResponseTime, timeTaken, currentTerm?.difficulty || 'medium');
    const timeQuality = (typeof tq === 'string' && tq) ? tq : (timeTaken < 2500 ? 'fast' : timeTaken < 7000 ? 'ok' : 'slow');

    // Record confusion if applicable (optional)
    if (!result.correct) maybeRecordConfusion(ans, currentTerm);

    // ✅ Spaced repetition update
    // Expected signature: updateItem(itemId, quality0..5, responseTimeMs, metadataObj)
    const q = toSM2Quality({ ...result, timeQuality });
    safeFn(updateItem, currentTerm.term, q, timeTaken, {
      type: 'bieler',
      category: currentTerm.category,
      difficulty: currentTerm.difficulty || 'medium',
      score: result.score,
      partial: !!result.partial,
      timeQuality,
      hintsUsed
    });

    // ✅ Storage stats update (optional signature: updateStats(module, correct, ms, score))
    safeFn(updateStats, 'bieler', !!result.correct, timeTaken, Number(result.score) || 0);

    // Session aggregates
    setSessionStats(prev => {
      const newTotal = prev.total + 1;
      const newCorrect = prev.correct + (result.correct ? 1 : 0);
      const newAvgTime = ((prev.avgTime * prev.total) + timeTaken) / newTotal;
      const next = {
        ...prev,
        total: newTotal,
        correct: newCorrect,
        avgAccuracy: Math.round((newCorrect / newTotal) * 100),
        avgTime: Math.round(newAvgTime)
      };

      // Breakthrough / plateau detection
      try {
        if (result.correct && result.score >= 0.9 && timeQuality === 'fast') {
          const isBreakthrough = safeFn(recordBreakthrough, 'bieler', currentTerm.term);
          if (isBreakthrough) {
            next.breakthroughs = (next.breakthroughs || 0) + 1;
            safeFn(unlockAchievement, 'bieler-breakthrough');
          }
        } else if (!result.correct && next.avgAccuracy < 60 && newTotal > 10) {
          const isPlateau = safeFn(detectPlateau, 'bieler', next);
          if (isPlateau) next.plateaus = (next.plateaus || 0) + 1;
        }
      } catch (_) {}

      return next;
    });

    // Global callback
    safeFn(onAnswer, !!result.correct, Number(result.score) || 0, timeQuality);

    // ✅ Gamification with partial credit
    let xpEarned = 0;
    if (result.score >= 0.9) xpEarned = potentialXP;
    else if (result.score >= 0.7) xpEarned = Math.floor(potentialXP * 0.7);
    else if (result.partial) xpEarned = Math.floor(potentialXP * 0.3);

    if (result.correct || result.partial) {
      safeFn(awardXP, xpEarned, 'Bieler technique practice');
      safeFn(incrementDailyItems);
      safeFn(recordStreak, 'bieler', !!result.correct);

      const praise = safeFn(getRandom, PRAISE_MESSAGES) || 'Nice!';
      setFeedback(`${praise} +${xpEarned} XP (${Math.round((Number(result.score) || 0) * 100)}% match)`);
      setFeedbackType('success');

      safeToast(showToast, `✓ ${praise} +${xpEarned} XP`, 'success');

      // Audio (feedback + optional success)
      safeFn(playFeedback, true, { streak: safeFn(getStreak, 'bieler') || 0, module: 'bieler', difficulty: level });
      if (result.score >= 0.9) safeFn(playSuccess);

    } else {
      setFeedback(`The full definition is: ${currentTerm.definition}`);
      setFeedbackType('error');

      safeToast(showToast, 'Not quite. Review the definition.', 'error');
      safeFn(playFeedback, false, { module: 'bieler' });

      safeFn(recordStreak, 'bieler', false);
    }

    setAnswered(true);
    setStreak(safeFn(getStreak, 'bieler') || 0);

    // Coach log
    safeFn(logBielerSession, currentTerm.term, result, timeTaken, xpEarned);

    // Analytics
    safeFn(trackEvent, 'bieler', 'answer_submitted', {
      term: currentTerm.term,
      correct: !!result.correct,
      partial: !!result.partial,
      score: Number(result.score) || 0,
      timeTaken,
      timeQuality,
      xpEarned,
      hintsUsed,
      level
    });

    // Auto-advance
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      // Only advance if still mounted
      if (!mountedRef.current) return;
      generateQuestion();
    }, challengeMode ? 1500 : 2500);

  }, [
    answered,
    currentTerm,
    userAnswer,
    checkAnswer,
    hintsUsed,
    potentialXP,
    level,
    challengeMode,
    generateQuestion,
    onAnswer,
    showToast,
    maybeRecordConfusion
  ]);

  // Expose submit function to voice callback via ref (avoids stale closure)
  useEffect(() => { _submitAnswerRef.current = () => handleSubmit({ preventDefault: () => {} }); }, [handleSubmit]);

  // ---------------------------
  // Skip handler
  // ---------------------------
  const handleSkip = useCallback(() => {
    if (!currentTerm) return;

    if (!answered) {
      // Treat as incorrect/skip
      safeFn(updateItem, currentTerm.term, 0, 0, { type: 'bieler', skipped: true });
      safeFn(updateStats, 'bieler', false, 0, 0);
      safeFn(recordStreak, 'bieler', false);
      safeFn(onAnswer, false, 0, 'skipped');

      safeFn(trackEvent, 'bieler', 'skipped', { term: currentTerm.term });
    }

    // Clear pending auto-advance
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);

    generateQuestion();
  }, [currentTerm, answered, generateQuestion, onAnswer]);

  // ---------------------------
  // Mastery toggle
  // ---------------------------
  const toggleMastery = useCallback(() => {
    setShowMastery(prev => !prev);
    safeFn(trackEvent, 'bieler', 'mastery_view_toggled', { show: !showMastery });

    // Refresh mastery stats when opening
    if (!showMastery && Array.isArray(pool) && pool.length) {
      const termIds = pool.map(x => x?.term).filter(Boolean);
      const stats = safeFn(getMasteryStats, termIds);
      setMastery(Array.isArray(stats) ? stats : []);
    }
  }, [showMastery, pool]);

  // ---------------------------
  // Voice input start
  // ---------------------------
  const startVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      safeToast(showToast, 'Voice input not supported in this browser', 'error');
      return;
    }
    if (answered) return;

    setIsListening(true);
    safeFn(trackEvent, 'bieler', 'voice_input_started', { term: currentTerm?.term || null });

    try { recognitionRef.current.start(); }
    catch (_) {
      setIsListening(false);
      safeToast(showToast, 'Voice recognition failed to start.', 'error');
    }
  }, [answered, currentTerm, showToast]);

  // ---------------------------
  // Render: Vocabulary Mode
  // ---------------------------
  const renderVocabularyMode = useCallback(() => {
    return h('div', { className: 'vocab-container' },

      currentTerm && h('div', { className: 'vocab-area' },

        h('div', { className: 'vocab-term-card', 'data-category': currentTerm.category },
          h('div', { className: 'vocab-term' }, currentTerm.term),

          currentTerm.category && h('div', { className: 'vocab-category' },
            String(currentTerm.category).replace(/_/g, ' ').toUpperCase()
          ),

          h('div', { className: 'vocab-difficulty', 'data-level': currentTerm.difficulty || 'medium' },
            `Difficulty: ${currentTerm.difficulty || 'medium'}`
          )
        ),

        h('p', { className: 'instruction' }, 'Define this technique (key concepts accepted):'),

        h('form', { onSubmit: handleSubmit, className: 'answer-form' },

          h('textarea', {
            ref: inputRef,
            className: 'input-definition',
            value: userAnswer,
            onChange: (e) => setUserAnswer(e.target.value),
            placeholder: 'Your definition...',
            disabled: answered,
            rows: 4,
            'aria-label': currentTerm ? `Define ${currentTerm.term}` : 'Define technique',
            autoFocus: true
          }),

          !answered && h('button', {
            type: 'button',
            className: `btn-voice ${isListening ? 'listening' : ''}`,
            onClick: startVoiceInput,
            'aria-label': 'Use voice input'
          }, isListening ? '🎤 Listening...' : '🎤 Voice'),

          h('div', { className: 'form-actions' },

            h('button', {
              type: 'submit',
              className: 'btn btn-primary btn-lg',
              disabled: answered || !String(userAnswer || '').trim(),
              'aria-label': 'Check answer'
            }, 'Check Answer'),

            h('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: handleSkip,
              disabled: answered,
              'aria-label': 'Skip this term'
            }, 'Skip'),

            !answered && hintLevel < 4 && h('button', {
              type: 'button',
              className: 'btn btn-hint',
              onClick: revealHint,
              'aria-label': 'Get a hint'
            }, `Hint (${4 - hintLevel} left)`)
          )
        ),

        hintText && h('div', { className: 'hint-display' }, hintText),

        h('div', { className: 'context-info' },
          h('div', { className: 'appears-in' },
            h('strong', null, 'Appears in: '),
            currentTerm.appearsIn || 'Various contexts'
          ),
          currentTerm.bielerRef && h('div', { className: 'bieler-ref' },
            h('strong', null, 'Bieler Reference: '),
            currentTerm.bielerRef
          )
        )
      ),

      feedback && h('div', { className: `feedback feedback-${feedbackType}` },
        h('div', { className: 'feedback-text' }, feedback),
        h('div', { className: 'feedback-details' },
          h('div', null, `Time: ${responseTime}ms`),
          h('div', null, `Hints used: ${hintsUsed}`),
          h('div', null, `Streak: ${streak}`),
          h('div', null, `Session: ${sessionStats.correct}/${sessionStats.total}`)
        )
      ),

      h('div', { className: 'session-stats-bar' },
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-value' }, `${sessionStats.avgAccuracy}%`),
          h('div', { className: 'stat-label' }, 'Accuracy')
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-value' }, `${sessionStats.avgTime}ms`),
          h('div', { className: 'stat-label' }, 'Avg Time')
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-value' }, streak),
          h('div', { className: 'stat-label' }, 'Streak')
        )
      ),

      h('div', { className: 'action-buttons' },
        h('button', {
          className: 'btn btn-secondary btn-mastery-toggle',
          onClick: toggleMastery,
          'aria-label': 'View mastery statistics'
        }, showMastery ? 'Hide Stats' : 'View Mastery Stats'),

        h('button', {
          className: `btn ${challengeMode ? 'btn-danger' : 'btn-outline'}`,
          onClick: () => setChallengeMode(v => !v),
          'aria-label': 'Toggle challenge mode'
        }, challengeMode ? 'Challenge ON' : 'Challenge Mode')
      )
    );
  }, [
    currentTerm,
    userAnswer,
    answered,
    isListening,
    hintLevel,
    hintText,
    hintsUsed,
    feedback,
    feedbackType,
    responseTime,
    streak,
    sessionStats,
    showMastery,
    challengeMode,
    handleSubmit,
    handleSkip,
    revealHint,
    toggleMastery,
    startVoiceInput
  ]);

  // ---------------------------
  // Render: Scenarios Mode
  // ---------------------------
  const renderScenariosMode = useCallback(() => {
    const categoryNames = {
      lefthand: 'Left Hand Trained Functions',
      righthand: 'Right Hand Trained Functions',
      bowstroke: 'Bow Strokes & Articulations'
    };

    const categoryIcons = {
      lefthand: '🖐️',
      righthand: '🎻',
      bowstroke: '🎵'
    };

    const groups = ['lefthand', 'righthand', 'bowstroke'];

    return h('div', { className: 'scenarios-container' },

      h('header', { className: 'scenarios-header' },
        h('h3', null, '🎯 Bieler Practice Scenarios'),
        h('p', { className: 'scenarios-description' },
          'Apply Professor Bieler\'s method in your practice sessions'
        )
      ),

      groups.map(category => {
        const tasks = (Array.isArray(TECHNIQUE_TASKS) ? TECHNIQUE_TASKS : []).filter(t => t?.category === category);

        const masteredCount = tasks.filter(t => {
          const m = safeFn(getMasteryStats, [t.id]);
          return Array.isArray(m) && m[0] && m[0].accuracy >= 80;
        }).length;

        return h('section', { key: category, className: 'scenario-category', 'data-category': category },

          h('div', { className: 'category-header' },
            h('div', { className: 'category-title' },
              h('span', { className: 'category-icon' }, categoryIcons[category]),
              h('h4', null, categoryNames[category] || toTitleCase(category))
            ),
            h('div', { className: 'category-progress' }, `${masteredCount}/${tasks.length} mastered`)
          ),

          h('div', { className: 'tasks-grid' },
            tasks.map(task => {
              const m = safeFn(getMasteryStats, [task.id]);
              const isMastered = Array.isArray(m) && m[0] && m[0].accuracy >= 80;
              const attempts = Array.isArray(m) && m[0] ? (m[0].seen || 0) : 0;

              const go = () => {
                safeFn(trackEvent, 'bieler', 'scenario_open', { taskId: task.id, taskName: task.name });
                if (typeof navigate === 'function') navigate('bielerlab', { task: task.id });
              };

              const onKeyDown = (e) => {
                const k = e?.key;
                if (k === 'Enter' || k === ' ') { e.preventDefault(); go(); }
              };

              return h('div', {
                key: task.id,
                className: `task-card ${isMastered ? 'mastered' : ''}`,
                onClick: go,
                onKeyDown,
                role: 'button',
                tabIndex: 0,
                'aria-label': `Practice ${task.name}`
              },
                h('div', { className: 'task-header' },
                  h('div', { className: 'task-name' }, task.name),
                  isMastered && h('div', { className: 'mastery-badge' }, '✓')
                ),
                h('div', { className: 'task-description' }, task.description),
                task.bielerRef && h('div', { className: 'task-reference' }, h('strong', null, 'Bieler: '), task.bielerRef),
                h('div', { className: 'task-stats' },
                  h('div', { className: 'stat' },
                    h('span', { className: 'stat-value' }, attempts),
                    h('span', { className: 'stat-label' }, 'attempts')
                  )
                ),
                h('div', { className: 'task-difficulty', 'data-level': task.difficulty || 'medium' },
                  `Difficulty: ${task.difficulty || 'medium'}`
                )
              );
            })
          )
        );
      })
    );
  }, [navigate]);

  // ---------------------------
  // Render: Lab Mode (deep dive + reflection)
  // ---------------------------
  const renderLabMode = useCallback(() => {
    if (!currentTerm) {
      return h('div', { className: 'lab-container' },
        h('header', { className: 'lab-header' },
          h('h3', null, '🔬 Bieler Lab'),
          h('button', { className: 'btn-back', onClick: () => setMode('vocabulary') }, '← Back to Quiz')
        ),
        h('p', null, 'Select a term from Vocabulary mode to explore it in the Lab.')
      );
    }

    const taxonomy = (BIELER_TAXONOMY && currentTerm.category)
      ? BIELER_TAXONOMY[currentTerm.category]
      : null;

    const relatedTasks = (Array.isArray(TECHNIQUE_TASKS) ? TECHNIQUE_TASKS : [])
      .filter(t => t?.bielerRef && String(t.bielerRef).includes(String(currentTerm.term)));

    const prompts = (REFLECTION_PROMPTS && Array.isArray(REFLECTION_PROMPTS.bieler))
      ? REFLECTION_PROMPTS.bieler
      : [];

    return h('div', { className: 'lab-container' },

      h('header', { className: 'lab-header' },
        h('h3', null, `🔬 Bieler Lab: ${currentTerm.term}`),
        h('button', { className: 'btn-back', onClick: () => setMode('vocabulary') }, '← Back to Quiz')
      ),

      h('div', { className: 'lab-content' },

        h('section', { className: 'lab-section concept-section' },
          h('h4', null, 'Core Concept'),
          h('p', { className: 'lab-description' }, currentTerm.definition),
          taxonomy && taxonomy.name && h('div', { className: 'taxonomy-info' }, h('strong', null, 'Category: '), taxonomy.name)
        ),

        taxonomy && Array.isArray(taxonomy.keyPrinciples) && taxonomy.keyPrinciples.length > 0 &&
          h('section', { className: 'lab-section principles-section' },
            h('h4', null, 'Key Principles'),
            h('ul', { className: 'principles-list' },
              taxonomy.keyPrinciples.map((p, i) => h('li', { key: i, className: 'principle-item' }, p))
            )
          ),

        relatedTasks.length > 0 &&
          h('section', { className: 'lab-section exercises-section' },
            h('h4', null, 'Practice Exercises'),
            h('div', { className: 'exercises-grid' },
              relatedTasks.map(task =>
                h('div', { key: task.id, className: 'exercise-card' },
                  h('h5', null, task.name),
                  h('p', null, task.description)
                )
              )
            )
          ),

        prompts.length > 0 &&
          h('section', { className: 'lab-section reflection-section' },
            h('h4', null, 'Self-Assessment'),
            h('div', { className: 'reflection-prompts' },
              prompts.map((prompt, i) => {
                const options = Array.isArray(prompt?.options) ? prompt.options : [];
                return h('div', { key: i, className: 'reflection-card' },
                  h('p', null, prompt.question || 'Reflection'),
                  h('div', { className: 'reflection-options' },
                    options.map((option, j) =>
                      h('button', {
                        key: j,
                        className: 'btn-reflection',
                        onClick: () => {
                          safeFn(trackEvent, 'bieler', 'reflection_response', {
                            term: currentTerm.term,
                            prompt: prompt.question,
                            response: option
                          });
                          safeToast(showToast, 'Reflection recorded!', 'success');
                        }
                      }, option)
                    )
                  )
                );
              })
            )
          )
      )
    );
  }, [currentTerm, showToast]);

  // ---------------------------
  // Main render
  // ---------------------------
  return h('div', { className: 'bieler-component' },

    h('header', { className: 'bieler-header' },

      h('button', {
        className: 'btn-back',
        onClick: () => safeFn(navigate, 'menu'),
        'aria-label': 'Back to menu'
      }, '← Back'),

      h('div', { className: 'header-center' },
        h('h2', { className: 'component-title' }, '🎻 Bieler Technique'),
        h('div', { className: 'difficulty-indicator', 'data-level': level },
          `${difficultyInfo.label || 'Standard'} (Level ${level})`
        )
      ),

      h('div', { className: 'header-stats' },
        h('div', { className: 'stat-badge streak-badge' },
          h('span', { className: 'stat-value' }, streak),
          h('span', { className: 'stat-label' }, 'streak')
        )
      )
    ),

    h('nav', { className: 'mode-nav', role: 'tablist' },
      ['vocabulary', 'scenario', 'lab'].map(m =>
        h('button', {
          key: m,
          className: `mode-tab ${mode === m ? 'active' : ''}`,
          onClick: () => setMode(m),
          role: 'tab',
          'aria-selected': mode === m,
          'aria-controls': `${m}-panel`
        }, m === 'vocabulary' ? '📝 Vocabulary' : m === 'scenario' ? '🎯 Scenarios' : '🔬 Lab')
      )
    ),

    h('div', { className: 'mode-content' },
      mode === 'vocabulary' ? renderVocabularyMode() :
      mode === 'scenario' ? renderScenariosMode() :
      renderLabMode()
    ),

    showMastery && h('div', {
      className: 'mastery-overlay',
      onClick: toggleMastery,
      'aria-hidden': 'true'
    },
      h('div', {
        className: 'mastery-panel',
        onClick: (e) => e.stopPropagation(),
        role: 'dialog',
        'aria-labelledby': 'mastery-title'
      },

        h('div', { className: 'mastery-header' },
          h('h3', { id: 'mastery-title' }, 'Vocabulary Mastery'),
          h('button', {
            className: 'btn-close',
            onClick: toggleMastery,
            'aria-label': 'Close mastery view'
          }, '×')
        ),

        h('div', { className: 'mastery-content' },
          mastery.length > 0
            ? h('div', { className: 'mastery-grid' },
                mastery.slice(0, 20).map(stat =>
                  h('div', {
                    key: stat.id,
                    className: `mastery-item ${stat.status}`,
                    'data-status': stat.status
                  },
                    h('div', { className: 'mastery-info' },
                      h('div', { className: 'mastery-item-name' }, stat.id),
                      h('div', { className: 'mastery-item-meta' },
                        `${stat.correct}/${stat.seen} • ${stat.accuracy}%`
                      )
                    ),
                    h('div', { className: 'mastery-progress-bar' },
                      h('div', {
                        className: 'mastery-progress-fill',
                        style: { width: `${stat.accuracy}%` }
                      })
                    ),
                    h('div', { className: 'mastery-status' }, stat.status)
                  )
                )
              )
            : h('p', { className: 'empty-mastery' },
                'No stats yet. Keep practicing to see your mastery grow!'
              )
        )
      )
    )
  );
}