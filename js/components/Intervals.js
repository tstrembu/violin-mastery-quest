// ========================================================
// VMQ INTERVALS - Ear Training with Spaced Repetition
// ========================================================

const { createElement: h, useState, useEffect } = React;
import { INTERVAL_DEFINITIONS, ROOT_NOTES, PRAISE_MESSAGES } from '../config/constants.js';
import { selectNextItem, updateItem, getMasteryStats } from '../engines/spacedRepetition.js';
import { getDifficulty, getItemPool, getSpeedMultiplier, getDifficultyInfo } from '../engines/difficultyAdapter.js';
import { shuffle, getRandom } from '../utils/helpers.js';

export function Intervals({ onBack, onAnswer, audioEngine, showToast }) {
  const [currentItem, setCurrentItem] = useState(null);
  const [rootNote, setRootNote] = useState(null);
  const [options, setOptions] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);

  const difficultyInfo = getDifficultyInfo('intervals');
  const pool = getItemPool('intervals', INTERVAL_DEFINITIONS);

  // Generate first question on mount
  useEffect(() => {
    generateQuestion();
  }, []);

  /**
   * Generate new question
   */
  function generateQuestion() {
    if (pool.length === 0) {
      setFeedback('No intervals available for this difficulty level.');
      return;
    }

    // Use spaced repetition to select interval
    const itemIds = pool.map(item => item.id);
    const selectedId = selectNextItem(itemIds);
    const interval = pool.find(item => item.id === selectedId);

    // Random root note
    const root = getRandom(ROOT_NOTES);

    // Generate 4 options (correct + 3 distractors)
    const distractors = shuffle(pool.filter(item => item.id !== interval.id)).slice(0, 3);
    const allOptions = shuffle([interval, ...distractors]);

    setCurrentItem(interval);
    setRootNote(root);
    setOptions(allOptions);
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);

    // Auto-play the interval
    playInterval(root.midi, interval.semitones);

    // Update mastery stats
    const stats = getMasteryStats(itemIds);
    setMastery(stats);
  }

  /**
   * Play the current interval
   */
  function playInterval(rootMidi, semitones) {
    const speedMultiplier = getSpeedMultiplier(difficultyInfo.level);
    audioEngine.playInterval(rootMidi, semitones, { speedMultiplier });
  }

  /**
   * Handle answer selection
   */
  function handleAnswer(selectedItem) {
    if (answered) return;

    const isCorrect = selectedItem.id === currentItem.id;

    // Update spaced repetition
    updateItem(currentItem.id, isCorrect);

    // Update global stats
    onAnswer(isCorrect);

    // Show feedback
    if (isCorrect) {
      setFeedback(getRandom(PRAISE_MESSAGES));
      setFeedbackType('success');
      audioEngine.playFeedback(true);
    } else {
      setFeedback(`Not quite. This interval was a ${currentItem.label}.`);
      setFeedbackType('error');
      audioEngine.playFeedback(false);
    }

    setAnswered(true);

    // Auto-advance after delay
    setTimeout(() => {
      generateQuestion();
    }, 1800);
  }

  /**
   * Replay current interval
   */
  function handleReplay() {
    if (currentItem && rootNote) {
      playInterval(rootNote.midi, currentItem.semitones);
    }
  }

  /**
   * Toggle mastery view
   */
  function toggleMastery() {
    setShowMastery(!showMastery);
  }

  return h('div', { className: 'mode-container intervals-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', {
        className: 'btn-back',
        onClick: onBack
      }, '← Back'),
      h('h2', null, '🎵 Interval Training'),
      h('div', { className: 'difficulty-badge', 'data-level': difficultyInfo.level },
        difficultyInfo.label
      )
    ),

    // Main content
    h('div', { className: 'mode-content' },
      currentItem && h('div', { className: 'question-area' },
        h('p', { className: 'instruction' }, 'Listen and identify the interval:'),
        
        h('button', {
          className: 'btn btn-primary btn-play',
          onClick: handleReplay,
          disabled: !currentItem
        }, '🔊 Play Interval'),

        h('div', { className: 'hint-text' },
          `Root: ${rootNote?.note || '—'} • ${difficultyInfo.description}`
        )
      ),

      // Options
      h('div', { className: 'options-grid' },
        options.map(option =>
          h('button', {
            key: option.id,
            className: `btn btn-option ${answered && option.id === currentItem.id ? 'correct' : ''}`,
            onClick: () => handleAnswer(option),
            disabled: answered
          }, option.label)
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
          h('h3', null, 'Interval Mastery'),
          h('button', {
            className: 'btn-close',
            onClick: toggleMastery
          }, '×')
        ),
        h('div', { className: 'mastery-list' },
          mastery.slice(0, 10).map(stat =>
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