// ========================================================
// VMQ INTERVALS - Ear Training with Spaced Repetition
// ========================================================

const { createElement: h, useState, useEffect } = React;

// Imports
import { INTERVAL_DEFINITIONS, ROOT_NOTES, PRAISE_MESSAGES } from '../config/constants.js';
import { selectNextItem, updateItem, getMasteryStats } from '../engines/spacedRepetition.js';
import { getDifficulty, getItemPool, getSpeedMultiplier, getDifficultyInfo } from '../engines/difficultyAdapter.js';
import { shuffle, getRandom } from '../utils/helpers.js';
import { awardXP, incrementDailyItems, checkAchievements } from '../engines/gamification.js';
import { getAccuracy } from '../engines/analytics.js';
import { updateStats } from '../config/storage.js';

export function Intervals({ navigate, onAnswer, audioEngine, showToast }) {
  const [currentItem, setCurrentItem] = useState(null);
  const [rootNote, setRootNote] = useState(null);
  const [options, setOptions] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);
  const [potentialXP, setPotentialXP] = useState(20);

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
    setPotentialXP(20); // Reset XP for new question

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
   * Handle answer selection with gamification
   */
  function handleAnswer(selectedItem) {
    if (answered) return;

    const isCorrect = selectedItem.id === currentItem.id;

    // Update spaced repetition
    updateItem(currentItem.id, isCorrect);

    // Update module stats
    updateStats('intervals', isCorrect);

    // Update global stats (if onAnswer provided)
    if (onAnswer) {
      onAnswer(isCorrect);
    }

    // ✅ Gamification
    if (isCorrect) {
      // Award XP
      const result = awardXP(potentialXP, 'Interval identified');
      incrementDailyItems();
      
      // Show success feedback
      const praiseMsg = getRandom(PRAISE_MESSAGES);
      setFeedback(`${praiseMsg} +${potentialXP} XP`);
      setFeedbackType('success');
      
      // Show toast
      showToast(`✓ ${praiseMsg} +${potentialXP} XP`, 'success');
      
      // Play success sound
      if (audioEngine.playFeedback) {
        audioEngine.playFeedback(true);
      }
      
      // Check for achievements
      const accuracy = getAccuracy('intervals');
      if (accuracy >= 90) {
        const newAchievements = checkAchievements('accuracy', { 
          module: 'intervals', 
          accuracy 
        });
        
        newAchievements.forEach(ach => {
          showToast(`🏆 Achievement: ${ach.name}!`, 'success');
        });
      }
    } else {
      // Show error feedback
      setFeedback(`Not quite. This interval was a ${currentItem.label}.`);
      setFeedbackType('error');
      showToast('Not quite. Try again!', 'error');
      
      // Play error sound
      if (audioEngine.playFeedback) {
        audioEngine.playFeedback(false);
      }
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
        onClick: () => navigate('menu')
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

        // ✅ Bieler Tip
        h('div', {
          style: {
            padding: '12px',
            background: '#e7f3ff',
            borderLeft: '4px solid #007bff',
            borderRadius: '4px',
            margin: '16px 0',
            fontSize: '0.9rem'
          }
        },
          h('strong', null, 'Bieler Tip: '),
          'Listen for the distance between notes. Small intervals (2nds, 3rds) are close together. Large intervals (6ths, 7ths) span more than an octave width on the fingerboard.'
        ),

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
    showMastery && h('div', { className: 'mastery-overlay', onClick: toggleMastery },
      h('div', { 
        className: 'mastery-panel',
        onClick: (e) => e.stopPropagation() // Prevent closing when clicking panel
      },
        h('div', { className: 'mastery-header' },
          h('h3', null, 'Interval Mastery'),
          h('button', {
            className: 'btn-close',
            onClick: toggleMastery
          }, '×')
        ),
        h('div', { className: 'mastery-list' },
          mastery.length > 0 
            ? mastery.slice(0, 10).map(stat =>
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
            : h('p', { style: { textAlign: 'center', color: '#6c757d' } }, 
                'No stats yet. Keep practicing!'
              )
        )
      )
    )
  );
}

export default Intervals;
