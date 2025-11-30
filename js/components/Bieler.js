// ========================================================
// VMQ BIELER - Technique Vocabulary with Fuzzy Matching
// ========================================================

const { createElement: h, useState, useEffect, useRef } = React;
import { BIELER_VOCAB, PRAISE_MESSAGES } from '../config/constants.js';
import { selectNextItem, updateItem, getMasteryStats } from '../engines/spacedRepetition.js';
import { getDifficulty, getBielerPool, getDifficultyInfo } from '../engines/difficultyAdapter.js';
import { getRandom, fuzzyMatch, normalizeText } from '../utils/helpers.js';

export function Bieler({ onBack, onAnswer, showToast }) {
  const [currentTerm, setCurrentTerm] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);
  const inputRef = useRef(null);

  const difficultyInfo = getDifficultyInfo('bieler');
  const level = difficultyInfo.level;
  const pool = getBielerPool(level);

  // Generate first question
  useEffect(() => {
    generateQuestion();
  }, []);

  /**
   * Generate new question
   */
  function generateQuestion() {
    if (pool.length === 0) {
      setFeedback('No vocabulary terms available.');
      return;
    }

    const termIds = pool.map(item => item.term);
    const selectedTerm = selectNextItem(termIds);
    const vocabItem = pool.find(item => item.term === selectedTerm);

    setCurrentTerm(vocabItem);
    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);

    // Update mastery stats
    const stats = getMasteryStats(termIds);
    setMastery(stats);

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  /**
   * Check if answer is acceptable
   */
  function checkAnswer(answer, term) {
    const normalized = normalizeText(answer);
    const correctDef = normalizeText(term.definition);
    
    // Exact match
    if (normalized === correctDef) return true;

    // Check acceptable alternatives
    if (term.acceptableAnswers) {
      for (const acceptable of term.acceptableAnswers) {
        if (normalizeText(acceptable) === normalized) return true;
        if (fuzzyMatch(answer, acceptable, 0.7)) return true;
      }
    }

    // Fuzzy match with main definition
    return fuzzyMatch(answer, term.definition, 0.65);
  }

  /**
   * Handle answer submission
   */
  function handleSubmit(e) {
    e.preventDefault();
    if (answered || !userAnswer.trim()) return;

    const isCorrect = checkAnswer(userAnswer, currentTerm);

    // Update spaced repetition
    updateItem(currentTerm.term, isCorrect);

    // Update global stats
    onAnswer(isCorrect);

    // Show feedback
    if (isCorrect) {
      setFeedback(getRandom(PRAISE_MESSAGES));
      setFeedbackType('success');
    } else {
      setFeedback(`The full definition is: ${currentTerm.definition}`);
      setFeedbackType('error');
    }

    setAnswered(true);

    // Auto-advance
    setTimeout(() => {
      generateQuestion();
    }, 2500);
  }

  /**
   * Skip to next term
   */
  function handleSkip() {
    if (!answered) {
      // Count as incorrect
      updateItem(currentTerm.term, false);
      onAnswer(false);
    }
    generateQuestion();
  }

  /**
   * Toggle mastery view
   */
  function toggleMastery() {
    setShowMastery(!showMastery);
  }

  return h('div', { className: 'mode-container bieler-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h2', null, '🎻 Bieler Technique Vocabulary'),
      h('div', { className: 'difficulty-badge', 'data-level': difficultyInfo.level },
        difficultyInfo.label
      )
    ),

    // Main content
    h('div', { className: 'mode-content' },
      currentTerm && h('div', { className: 'vocab-area' },
        h('div', { className: 'vocab-term-card' },
          h('div', { className: 'vocab-term' }, currentTerm.term),
          currentTerm.category && h('div', { className: 'vocab-category' },
            currentTerm.category.replace(/_/g, ' ')
          )
        ),
        
        h('p', { className: 'instruction' }, 'Define this term (key concepts are fine):'),

        h('form', { onSubmit: handleSubmit, className: 'answer-form' },
          h('textarea', {
            ref: inputRef,
            className: 'input-definition',
            value: userAnswer,
            onChange: (e) => setUserAnswer(e.target.value),
            placeholder: 'Your definition...',
            disabled: answered,
            rows: 3
          }),
          h('div', { className: 'form-actions' },
            h('button', {
              type: 'submit',
              className: 'btn btn-primary',
              disabled: answered || !userAnswer.trim()
            }, 'Check'),
            h('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: handleSkip,
              disabled: answered
            }, 'Skip')
          )
        ),

        h('div', { className: 'hint-text' },
          `Appears in: ${currentTerm.appearsIn || 'various contexts'}`
        )
      ),

      // Feedback
      feedback && h('div', {
        className: `feedback feedback-${feedbackType}`
      }, feedback),

      // Mastery toggle
      h('button', {
        className: 'btn btn-secondary btn-mastery-toggle',
        onClick: toggleMastery
      }, showMastery ? 'Hide Stats' : 'Show Mastery Stats')
    ),

    // Mastery overlay
    showMastery && h('div', { className: 'mastery-overlay' },
      h('div', { className: 'mastery-panel' },
        h('div', { className: 'mastery-header' },
          h('h3', null, 'Vocabulary Mastery'),
          h('button', { className: 'btn-close', onClick: toggleMastery }, '×')
        ),
        h('div', { className: 'mastery-list' },
          mastery.slice(0, 15).map(stat =>
            h('div', {
              key: stat.id,
              className: 'mastery-item',
              'data-status': stat.status
            },
              h('div', { className: 'mastery-item-name' }, stat.id),
              h('div', { className: 'mastery-item-stats' },
                `${stat.accuracy}% (${stat.correct}/${stat.seen})`
              ),
              h('div', { className: 'mastery-item-bar' },
                h('div', {
                  className: 'mastery-item-fill',
                  style: { width: `${stat.accuracy}%` }
                })
              )
            )
          )
        )
      )
    )
  );
}