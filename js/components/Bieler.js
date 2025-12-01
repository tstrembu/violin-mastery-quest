// ========================================================
// VMQ BIELER - Technique Vocabulary with Fuzzy Matching
// ========================================================

const { createElement: h, useState, useEffect, useRef } = React;

// Imports
import { BIELER_VOCAB, TECHNIQUE_TASKS, PRAISE_MESSAGES } from '../config/constants.js';
import { selectNextItem, updateItem, getMasteryStats } from '../engines/spacedRepetition.js';
import { getDifficulty, getBielerPool, getDifficultyInfo } from '../engines/difficultyAdapter.js';
import { getRandom, fuzzyMatch, normalizeText } from '../utils/helpers.js';
import { awardXP, incrementDailyItems } from '../engines/gamification.js';
import { updateStats } from '../config/storage.js';

export function Bieler({ navigate, onAnswer, showToast }) {
  // ✅ Mode state
  const [mode, setMode] = useState('vocabulary'); // 'vocabulary' or 'scenario'
  
  // Vocabulary mode state
  const [currentTerm, setCurrentTerm] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);
  const [potentialXP, setPotentialXP] = useState(15);
  const inputRef = useRef(null);

  const difficultyInfo = getDifficultyInfo('bieler');
  const level = difficultyInfo.level;
  const pool = getBielerPool(level);

  // Generate first question
  useEffect(() => {
    if (mode === 'vocabulary') {
      generateQuestion();
    }
  }, [mode]);

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
    setPotentialXP(15);

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
   * Handle answer submission with gamification
   */
  function handleSubmit(e) {
    e.preventDefault();
    if (answered || !userAnswer.trim()) return;

    const isCorrect = checkAnswer(userAnswer, currentTerm);

    // Update spaced repetition
    updateItem(currentTerm.term, isCorrect);

    // Update stats
    updateStats('bieler', isCorrect);

    // Update global stats
    if (onAnswer) {
      onAnswer(isCorrect);
    }

    // ✅ Gamification
    if (isCorrect) {
      const result = awardXP(potentialXP, 'Bieler term mastered');
      incrementDailyItems();
      
      const praiseMsg = getRandom(PRAISE_MESSAGES);
      setFeedback(`${praiseMsg} +${potentialXP} XP`);
      setFeedbackType('success');
      showToast(`✓ ${praiseMsg} +${potentialXP} XP`, 'success');
    } else {
      setFeedback(`The full definition is: ${currentTerm.definition}`);
      setFeedbackType('error');
      showToast('Not quite. Review the definition.', 'error');
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
      updateStats('bieler', false);
      if (onAnswer) {
        onAnswer(false);
      }
    }
    generateQuestion();
  }

  /**
   * Toggle mastery view
   */
  function toggleMastery() {
    setShowMastery(!showMastery);
  }

  /**
   * Render vocabulary quiz mode
   */
  function renderVocabularyMode() {
    return h('div', null,
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
    );
  }

  /**
   * Render practice scenarios mode
   */
  function renderScenariosMode() {
    const categoryNames = {
      lefthand: 'Left Hand',
      righthand: 'Right Hand',
      bowstroke: 'Bow Strokes'
    };

    return h('div', { className: 'scenarios-content' },
      h('p', { style: { marginBottom: '24px', fontSize: '1.1rem' } },
        'Apply Professor Bieler\'s method in your practice:'
      ),
      
      ['lefthand', 'righthand', 'bowstroke'].map(category => {
        const categoryTasks = TECHNIQUE_TASKS.filter(t => t.category === category);
        
        return h('div', {
          key: category,
          style: { marginBottom: '32px' }
        },
          h('h3', { style: { color: 'var(--primary)', marginBottom: '16px' } }, 
            categoryNames[category]
          ),
          
          categoryTasks.map(task =>
            h('div', {
              key: task.id,
              style: {
                padding: '16px',
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                marginBottom: '12px',
                borderLeft: '4px solid var(--primary)'
              }
            },
              h('div', { 
                style: { 
                  fontWeight: 'bold', 
                  marginBottom: '8px',
                  color: 'var(--ink)'
                } 
              }, task.name),
              
              h('div', { 
                style: { 
                  fontSize: '0.9rem', 
                  marginBottom: '8px',
                  color: 'var(--ink-light)'
                } 
              }, task.description),
              
              task.bielerRef && h('div', {
                style: {
                  fontSize: '0.85rem',
                  color: 'var(--primary)',
                  fontStyle: 'italic'
                }
              }, `Bieler Reference: ${task.bielerRef}`)
            )
          )
        );
      })
    );
  }

  return h('div', { className: 'mode-container bieler-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { 
        className: 'btn-back', 
        onClick: () => navigate('menu') 
      }, '← Back'),
      h('h2', null, '🎻 Bieler Technique'),
      mode === 'vocabulary' && h('div', { 
        className: 'difficulty-badge', 
        'data-level': difficultyInfo.level 
      }, difficultyInfo.label)
    ),

    // Main content
    h('div', { className: 'mode-content' },
      // ✅ Mode selector
      h('div', { 
        className: 'card', 
        style: { marginBottom: '24px', background: 'var(--card)', padding: '16px' } 
      },
        h('div', { 
          style: { 
            display: 'flex', 
            gap: '12px',
            justifyContent: 'center'
          } 
        },
          h('button', {
            className: mode === 'vocabulary' ? 'btn btn-primary' : 'btn btn-secondary',
            onClick: () => setMode('vocabulary')
          }, '📝 Vocabulary Quiz'),
          
          h('button', {
            className: mode === 'scenario' ? 'btn btn-primary' : 'btn btn-secondary',
            onClick: () => setMode('scenario')
          }, '🎯 Practice Scenarios')
        )
      ),

      // ✅ Render appropriate mode
      mode === 'vocabulary' ? renderVocabularyMode() : renderScenariosMode()
    ),

    // Mastery overlay (only for vocabulary mode)
    mode === 'vocabulary' && showMastery && h('div', { 
      className: 'mastery-overlay',
      onClick: toggleMastery 
    },
      h('div', { 
        className: 'mastery-panel',
        onClick: (e) => e.stopPropagation()
      },
        h('div', { className: 'mastery-header' },
          h('h3', null, 'Vocabulary Mastery'),
          h('button', { className: 'btn-close', onClick: toggleMastery }, '×')
        ),
        h('div', { className: 'mastery-list' },
          mastery.length > 0
            ? mastery.slice(0, 15).map(stat =>
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
            : h('p', { 
                style: { 
                  textAlign: 'center', 
                  color: 'var(--ink-lighter)',
                  padding: '32px'
                } 
              }, 'No stats yet. Keep practicing!')
        )
      )
    )
  );
}

export default Bieler;
