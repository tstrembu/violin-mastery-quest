// ========================================================
// VMQ KEY SIGNATURES - Cooper's Key Signature & Bach Guide
// ========================================================

const { createElement: h, useState, useEffect } = React;
import { KEY_SIGNATURES, SHARP_ORDER, FLAT_ORDER, PRAISE_MESSAGES } from '../config/constants.js';
import { selectNextItem, updateItem, getMasteryStats } from '../engines/spacedRepetition.js';
import { getDifficulty, getItemPool, getDifficultyInfo } from '../engines/difficultyAdapter.js';
import { shuffle, getRandom, normalizeText } from '../utils/helpers.js';

export function KeySignatures({ onBack, onAnswer, showToast }) {
  const [currentKey, setCurrentKey] = useState(null);
  const [questionType, setQuestionType] = useState('major'); // major, minor, handMap
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);

  const difficultyInfo = getDifficultyInfo('keySignatures');
  const pool = getItemPool('keySignatures', KEY_SIGNATURES);

  // Generate first question
  useEffect(() => {
    generateQuestion();
  }, []);

  /**
   * Generate new question
   */
  function generateQuestion() {
    if (pool.length === 0) {
      setFeedback('No key signatures available.');
      return;
    }

    const keyIds = pool.map(k => k.id);
    const selectedId = selectNextItem(keyIds);
    const key = pool.find(k => k.id === selectedId);

    // Random question type
    const types = ['major', 'minor', 'handMap'];
    const type = getRandom(types);

    setCurrentKey(key);
    setQuestionType(type);
    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);

    // Update mastery stats
    const stats = getMasteryStats(keyIds);
    setMastery(stats);
  }

  /**
   * Get question text
   */
  function getQuestionText() {
    if (!currentKey) return '';

    switch (questionType) {
      case 'major':
        return `What is the major key with ${Math.abs(currentKey.accidentals)} ${currentKey.type === 'sharp' ? 'sharp' : 'flat'}${Math.abs(currentKey.accidentals) !== 1 ? 's' : ''}?`;
      case 'minor':
        return `What is the relative minor of ${currentKey.major}?`;
      case 'handMap':
        const string = getRandom(['G', 'D', 'A', 'E']);
        return `In ${currentKey.major}, what is the 2nd finger on the ${string} string? (high2 or low2)`;
      default:
        return '';
    }
  }

  /**
   * Check answer
   */
  function checkAnswer(answer) {
    const normalized = normalizeText(answer);

    switch (questionType) {
      case 'major':
        return normalizeText(currentKey.major) === normalized;
      case 'minor':
        return normalizeText(currentKey.minor) === normalized;
      case 'handMap':
        // Extract string from question
        const question = getQuestionText();
        const stringMatch = question.match(/on the (\w) string/);
        if (!stringMatch) return false;
        const string = stringMatch[1];
        const correctAnswer = currentKey.handMap[string];
        return normalized === normalizeText(correctAnswer);
      default:
        return false;
    }
  }

  /**
   * Get correct answer
   */
  function getCorrectAnswer() {
    switch (questionType) {
      case 'major':
        return currentKey.major;
      case 'minor':
        return currentKey.minor;
      case 'handMap':
        const question = getQuestionText();
        const stringMatch = question.match(/on the (\w) string/);
        if (!stringMatch) return '—';
        const string = stringMatch[1];
        return currentKey.handMap[string];
      default:
        return '—';
    }
  }

  /**
   * Handle answer submission
   */
  function handleSubmit(e) {
    e.preventDefault();
    if (answered || !userAnswer.trim()) return;

    const isCorrect = checkAnswer(userAnswer);

    // Update spaced repetition
    updateItem(currentKey.id, isCorrect);

    // Update global stats
    onAnswer(isCorrect);

    // Show feedback
    if (isCorrect) {
      setFeedback(getRandom(PRAISE_MESSAGES));
      setFeedbackType('success');
    } else {
      setFeedback(`The correct answer is: ${getCorrectAnswer()}`);
      setFeedbackType('error');
    }

    setAnswered(true);

    // Auto-advance
    setTimeout(() => {
      generateQuestion();
    }, 2000);
  }

  /**
   * Toggle mastery view
   */
  function toggleMastery() {
    setShowMastery(!showMastery);
  }

  return h('div', { className: 'mode-container keysig-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h2', null, '🎼 Key Signatures'),
      h('div', { className: 'difficulty-badge', 'data-level': difficultyInfo.level },
        difficultyInfo.label
      )
    ),

    // Main content
    h('div', { className: 'mode-content' },
      currentKey && h('div', { className: 'keysig-area' },
        h('div', { className: 'keysig-display' },
          h('div', { className: 'accidentals' },
            currentKey.accidentals === 0 
              ? 'No sharps or flats'
              : `${Math.abs(currentKey.accidentals)} ${currentKey.type === 'sharp' ? '♯' : '♭'}${Math.abs(currentKey.accidentals) > 1 ? 's' : ''}`
          )
        ),

        h('p', { className: 'instruction' }, getQuestionText()),

        h('form', { onSubmit: handleSubmit, className: 'answer-form' },
          h('input', {
            type: 'text',
            className: 'input-key',
            value: userAnswer,
            onChange: (e) => setUserAnswer(e.target.value),
            placeholder: questionType === 'handMap' ? 'high2 or low2' : 'Key name...',
            disabled: answered,
            autoComplete: 'off'
          }),
          h('button', {
            type: 'submit',
            className: 'btn btn-primary',
            disabled: answered || !userAnswer.trim()
          }, 'Check')
        ),

        h('div', { className: 'hint-text' },
          `${difficultyInfo.description} • Appears in: ${currentKey.appearsIn}`
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
      }, showMastery ? 'Hide Stats' : 'Show Key Mastery')
    ),

    // Mastery overlay
    showMastery && h('div', { className: 'mastery-overlay' },
      h('div', { className: 'mastery-panel' },
        h('div', { className: 'mastery-header' },
          h('h3', null, 'Key Signature Mastery'),
          h('button', { className: 'btn-close', onClick: toggleMastery }, '×')
        ),
        h('div', { className: 'mastery-list' },
          mastery.map(stat => {
            const key = KEY_SIGNATURES.find(k => k.id === stat.id);
            return h('div', {
              key: stat.id,
              className: 'mastery-item',
              'data-status': stat.status
            },
              h('div', { className: 'mastery-item-name' }, 
                key ? `${key.major} / ${key.minor}` : stat.id
              ),
              h('div', { className: 'mastery-item-stats' },
                `${stat.accuracy}% (${stat.correct}/${stat.seen})`
              ),
              h('div', { className: 'mastery-item-bar' },
                h('div', {
                  className: 'mastery-item-fill',
                  style: { width: `${stat.accuracy}%` }
                })
              )
            );
          })
        )
      )
    )
  );
}