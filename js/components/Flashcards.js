// ========================================================
// VMQ FLASHCARDS - Note Name Recognition with SR
// ========================================================

const { createElement: h, useState, useEffect, useRef } = React;
import { NOTES, NOTE_ALIASES, PRAISE_MESSAGES } from '../config/constants.js';
import { selectNextItem, updateItem, getMasteryStats } from '../engines/spacedRepetition.js';
import { getDifficulty, getItemPool, getDifficultyInfo } from '../engines/difficultyAdapter.js';
import { getRandom, normalizeText } from '../utils/helpers.js';

export function Flashcards({ onBack, onAnswer, showToast }) {
  const [currentNote, setCurrentNote] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);
  const inputRef = useRef(null);

  const difficultyInfo = getDifficultyInfo('flashcards');
  const pool = getItemPool('flashcards', NOTES);

  // Generate first question
  useEffect(() => {
    generateQuestion();
  }, []);

  /**
   * Generate new question
   */
  function generateQuestion() {
    if (pool.length === 0) {
      setFeedback('No notes available for this difficulty level.');
      return;
    }

    const selectedNote = selectNextItem(pool);
    setCurrentNote(selectedNote);
    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);

    // Update mastery stats
    const stats = getMasteryStats(pool);
    setMastery(stats);

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  /**
   * Normalize user input
   */
  function normalizeNote(input) {
    const normalized = normalizeText(input);
    return NOTE_ALIASES[normalized] || input.trim();
  }

  /**
   * Handle answer submission
   */
  function handleSubmit(e) {
    e.preventDefault();
    if (answered || !userAnswer.trim()) return;

    const normalizedAnswer = normalizeNote(userAnswer);
    const isCorrect = normalizedAnswer === currentNote;

    // Update spaced repetition
    updateItem(currentNote, isCorrect);

    // Update global stats
    onAnswer(isCorrect);

    // Show feedback
    if (isCorrect) {
      setFeedback(getRandom(PRAISE_MESSAGES));
      setFeedbackType('success');
    } else {
      setFeedback(`The correct answer is ${currentNote}`);
      setFeedbackType('error');
    }

    setAnswered(true);

    // Auto-advance
    setTimeout(() => {
      generateQuestion();
    }, 1500);
  }

  /**
   * Toggle mastery view
   */
  function toggleMastery() {
    setShowMastery(!showMastery);
  }

  return h('div', { className: 'mode-container flashcards-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h2', null, '📝 Note Reading'),
      h('div', { className: 'difficulty-badge', 'data-level': difficultyInfo.level },
        difficultyInfo.label
      )
    ),

    // Main content
    h('div', { className: 'mode-content' },
      currentNote && h('div', { className: 'flashcard-area' },
        h('div', { className: 'flashcard' },
          h('div', { className: 'flashcard-note' }, currentNote)
        ),
        
        h('p', { className: 'instruction' }, 'What note is this?'),

        h('form', { onSubmit: handleSubmit, className: 'answer-form' },
          h('input', {
            ref: inputRef,
            type: 'text',
            className: 'input-note',
            value: userAnswer,
            onChange: (e) => setUserAnswer(e.target.value),
            placeholder: 'Type note name...',
            disabled: answered,
            autoComplete: 'off',
            autoCapitalize: 'off'
          }),
          h('button', {
            type: 'submit',
            className: 'btn btn-primary',
            disabled: answered || !userAnswer.trim()
          }, 'Check')
        ),

        h('div', { className: 'hint-text' },
          `Tip: Type F#, F sharp, or F♯ • ${difficultyInfo.description}`
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
          h('h3', null, 'Note Mastery'),
          h('button', { className: 'btn-close', onClick: toggleMastery }, '×')
        ),
        h('div', { className: 'mastery-list' },
          mastery.slice(0, 12).map(stat =>
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