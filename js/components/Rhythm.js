// ========================================================
// VMQ RHYTHM - Rhythm Pattern Recognition
// ========================================================

const { createElement: h, useState, useEffect } = React;
import { RHYTHM_PATTERNS, PRAISE_MESSAGES } from '../config/constants.js';
import { selectNextItem, updateItem, getMasteryStats } from '../engines/spacedRepetition.js';
import { getDifficulty, getItemPool, getBpmRange, getDifficultyInfo } from '../engines/difficultyAdapter.js';
import { shuffle, getRandom, clamp } from '../utils/helpers.js';

export function Rhythm({ onBack, onAnswer, audioEngine, showToast }) {
  const [currentPattern, setCurrentPattern] = useState(null);
  const [options, setOptions] = useState([]);
  const [bpm, setBpm] = useState(80);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);

  const difficultyInfo = getDifficultyInfo('rhythm');
  const pool = getItemPool('rhythm', RHYTHM_PATTERNS);
  const [minBpm, maxBpm] = getBpmRange(difficultyInfo.level);

  // Generate first question
  useEffect(() => {
    generateQuestion();
  }, []);

  /**
   * Generate new question
   */
  function generateQuestion() {
    if (pool.length === 0) {
      setFeedback('No rhythm patterns available.');
      return;
    }

    const patternIds = pool.map(p => p.id);
    const selectedId = selectNextItem(patternIds);
    const pattern = pool.find(p => p.id === selectedId);

    // Generate 4 options
    const distractors = shuffle(pool.filter(p => p.id !== pattern.id)).slice(0, 3);
    const allOptions = shuffle([pattern, ...distractors]);

    setCurrentPattern(pattern);
    setOptions(allOptions);
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);

    // Auto-play rhythm (simplified - just beeps for now)
    playRhythm(pattern);

    // Update mastery stats
    const stats = getMasteryStats(patternIds);
    setMastery(stats);
  }

  /**
   * Play rhythm pattern (simplified)
   */
  function playRhythm(pattern) {
    // Simplified: play steady beeps
    // In a full implementation, this would parse the pattern and play actual rhythms
    const beatDuration = 60 / bpm;
    [0, 1, 2, 3].forEach(i => {
      setTimeout(() => {
        audioEngine.beep(440, 0.1);
      }, i * beatDuration * 1000);
    });
  }

  /**
   * Handle answer selection
   */
  function handleAnswer(selectedPattern) {
    if (answered) return;

    const isCorrect = selectedPattern.id === currentPattern.id;

    // Update spaced repetition
    updateItem(currentPattern.id, isCorrect);

    // Update global stats
    onAnswer(isCorrect);

    // Show feedback
    if (isCorrect) {
      setFeedback(getRandom(PRAISE_MESSAGES));
      setFeedbackType('success');
      audioEngine.playFeedback(true);
    } else {
      setFeedback(`Not quite. This was: ${currentPattern.description}`);
      setFeedbackType('error');
      audioEngine.playFeedback(false);
    }

    setAnswered(true);

    // Auto-advance
    setTimeout(() => {
      generateQuestion();
    }, 1800);
  }

  /**
   * Handle BPM change
   */
  function handleBpmChange(e) {
    const newBpm = clamp(parseInt(e.target.value), minBpm, maxBpm);
    setBpm(newBpm);
  }

  /**
   * Replay rhythm
   */
  function handleReplay() {
    if (currentPattern) {
      playRhythm(currentPattern);
    }
  }

  /**
   * Toggle mastery view
   */
  function toggleMastery() {
    setShowMastery(!showMastery);
  }

  return h('div', { className: 'mode-container rhythm-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h2', null, '🥁 Rhythm Training'),
      h('div', { className: 'difficulty-badge', 'data-level': difficultyInfo.level },
        difficultyInfo.label
      )
    ),

    // Main content
    h('div', { className: 'mode-content' },
      currentPattern && h('div', { className: 'rhythm-area' },
        h('div', { className: 'rhythm-display' },
          h('div', { className: 'rhythm-pattern' }, currentPattern.pattern)
        ),

        h('p', { className: 'instruction' }, 'Which rhythm pattern is this?'),

        h('div', { className: 'bpm-control' },
          h('label', null, `Tempo: ${bpm} BPM`),
          h('input', {
            type: 'range',
            min: minBpm,
            max: maxBpm,
            value: bpm,
            onChange: handleBpmChange,
            className: 'bpm-slider'
          })
        ),

        h('button', {
          className: 'btn btn-primary btn-play',
          onClick: handleReplay
        }, '🔊 Play Rhythm')
      ),

      // Options
      h('div', { className: 'options-grid' },
        options.map(option =>
          h('button', {
            key: option.id,
            className: `btn btn-option ${answered && option.id === currentPattern.id ? 'correct' : ''}`,
            onClick: () => handleAnswer(option),
            disabled: answered
          },
            h('div', { className: 'option-pattern' }, option.pattern),
            h('div', { className: 'option-description' }, option.description)
          )
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
          h('h3', null, 'Rhythm Mastery'),
          h('button', { className: 'btn-close', onClick: toggleMastery }, '×')
        ),
        h('div', { className: 'mastery-list' },
          mastery.map(stat =>
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