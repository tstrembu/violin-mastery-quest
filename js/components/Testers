// ======================================
// VMQ TESTERS v2.1.1 - Unified Adaptive Testing Framework
// Powers: Key Signatures, Tempo, Time Signatures, Arpeggios, Scales
// Integration: 6 Engines + Spaced Repetition + Analytics
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef, useMemo } = React;
import { KEY_SIGNATURES, INTERVALS, TIME_SIGNATURES, CHORD_TYPES, XP_VALUES } from '../config/constants.js';
import { audioEngine } from '../engines/audioEngine.js';
import { addXP, recordAnswer, getLevel } from '../engines/gamification.js';
import { shuffle, getRandom, formatDuration, clamp } from '../utils/helpers.js';
import { keyboard, a11y } from '../utils/keyboard.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { adjustDifficulty, getDifficultyConfig } from '../engines/difficultyAdapter.js';
import { addSRSItem, getNextReviewItems } from '../engines/spacedRepetition.js';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';

// ======================================
// CONFIGURATION
// ======================================
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

// ======================================
// ENHANCED TESTER FACTORY
// ======================================
function createTester({
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
  return function Tester({ onBack, showToast }) {
    // ======================================
    // STATE MANAGEMENT
    // ======================================
    const [question, setQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [answered, setAnswered] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [usedHint, setUsedHint] = useState(false);
    
    // Stats & Progress
    const [stats, setStats] = useState({ 
      correct: 0, 
      total: 0, 
      streak: 0,
      longestStreak: 0,
      perfectStreak: 0,
      avgResponseTime: 0,
      comboMultiplier: 1
    });
    
    const [difficulty, setDifficulty] = useState('intermediate');
    const [autoDifficulty, setAutoDifficulty] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    
    // Performance tracking
    const [recentPerformance, setRecentPerformance] = useState([]);
    const [sessionStartTime] = useState(Date.now());
    const questionStartTime = useRef(null);
    const consecutiveCorrect = useRef(0);
    const consecutiveWrong = useRef(0);
    
    // Audio state
    const audioQueue = useRef([]);
    const isAudioPlaying = useRef(false);

    // ======================================
    // DATA & CONFIGURATION
    // ======================================
    const data = useMemo(() => {
      const rawData = typeof getData === 'function' ? getData() : getData;
      
      // Support both object (with difficulty levels) and array formats
      if (Array.isArray(rawData)) {
        return {
          beginner: rawData.slice(0, Math.ceil(rawData.length * 0.3)),
          intermediate: rawData.slice(0, Math.ceil(rawData.length * 0.7)),
          advanced: rawData
        };
      }
      return rawData;
    }, [getData]);

    const difficultyConfig = useMemo(() => 
      getDifficultyConfig(type, difficulty), 
      [type, difficulty]
    );

    // ======================================
    // KEYBOARD SHORTCUTS
    // ======================================
    useEffect(() => {
      if (audioPlay) {
        keyboard.register('space', handlePlayAudio, `${title}: Play audio`);
      }
      keyboard.register('enter', () => {
        if (!answered && selected) handleAnswer(selected);
      }, 'Submit answer');
      
      keyboard.register('n', () => {
        if (answered) nextQuestion();
      }, 'Next question');
      
      keyboard.register('h', () => {
        if (enableHints && !answered && !usedHint) toggleHint();
      }, 'Show hint');

      // Number keys for quick selection (1-6)
      for (let i = 1; i <= 6; i++) {
        keyboard.register(i.toString(), () => {
          if (!answered && options[i - 1]) {
            handleAnswer(options[i - 1]);
          }
        }, `Select option ${i}`);
      }

      return () => {
        keyboard.unregister('space', 'enter', 'n', 'h', '1', '2', '3', '4', '5', '6');
      };
    }, [question, answered, selected, options, usedHint]);

    // ======================================
    // QUESTION GENERATION (Enhanced)
    // ======================================
    const nextQuestion = useCallback(() => {
      // Get data for current difficulty
      const levelData = data[difficulty] || data.intermediate || data;
      if (!levelData || levelData.length === 0) {
        console.error('[Tester] No data available for difficulty:', difficulty);
        return;
      }

      // Select item (weighted by SRS if enabled)
      const item = enableSRS 
        ? selectSRSWeightedItem(levelData, type)
        : getRandom(levelData);

      // Generate question type
      const qt = questionTypes.length > 0
        ? generateQuestionType(questionTypes, item)
        : { q: 'Identify', a: item.name || item.sig };

      // Generate distractors (wrong answers)
      const numOptions = clamp(
        difficultyConfig?.optionCount || 4,
        TESTER_CONFIG.MIN_OPTIONS,
        TESTER_CONFIG.MAX_OPTIONS
      );

      const distractors = generateDistractors(
        levelData,
        item,
        qt.a,
        numOptions - 1,
        difficultyConfig
      );

      const allOptions = shuffle([...distractors, qt.a]);

      // Set state
      setQuestion({
        ...qt,
        item,
        ref: item,
        id: `${type}-${Date.now()}`,
        startTime: Date.now(),
        difficulty
      });
      setOptions(allOptions);
      setSelected(null);
      setAnswered(false);
      setShowHint(false);
      setUsedHint(false);
      setIsPlaying(false);
      setShowFeedback(false);
      questionStartTime.current = Date.now();

      // Auto-play audio for ear training (if configured)
      if (audioPlay && difficultyConfig?.autoPlayAudio) {
        setTimeout(() => handlePlayAudio(), 300);
      }

      // Accessibility
      a11y.announce(`${title}: ${qt.q}. ${allOptions.length} options available.`);
    }, [difficulty, data, questionTypes, audioPlay, difficultyConfig]);

    // ======================================
    // AUDIO PLAYBACK (Enhanced)
    // ======================================
    const handlePlayAudio = useCallback(() => {
      if (!audioPlay || !question?.item || isAudioPlaying.current) return;

      setIsPlaying(true);
      isAudioPlaying.current = true;

      // Call audio function with callback
      const playbackPromise = audioPlay(question.item, () => {
        setIsPlaying(false);
        isAudioPlaying.current = false;
      });

      // Handle promise-based audio engines
      if (playbackPromise && playbackPromise.then) {
        playbackPromise
          .then(() => {
            setIsPlaying(false);
            isAudioPlaying.current = false;
          })
          .catch(err => {
            console.error('[Tester] Audio playback failed:', err);
            setIsPlaying(false);
            isAudioPlaying.current = false;
            showToast?.('Audio playback failed', 'error');
          });
      }

      a11y.announce('Playing audio');
    }, [audioPlay, question]);

    // ======================================
    // ANSWER HANDLING (Enhanced)
    // ======================================
    const handleAnswer = useCallback((choice) => {
      if (answered || !question) return;

      setSelected(choice);
      setAnswered(true);

      const responseTime = Date.now() - (questionStartTime.current || Date.now());
      const isCorrect = customValidation 
        ? customValidation(choice, question.a)
        : choice === question.a;

      // Calculate XP with bonuses
      let xp = 0;
      if (isCorrect) {
        xp = XP_VALUES.CORRECT_ANSWER;
        
        // Streak bonus
        if (stats.streak >= TESTER_CONFIG.STREAK_BONUS_THRESHOLD) {
          xp += Math.floor(stats.streak * 0.5);
        }
        
        // Speed bonus
        if (responseTime < TESTER_CONFIG.RESPONSE_TIME_BONUS_MS) {
          xp += Math.ceil(XP_VALUES.CORRECT_ANSWER * 0.3);
        }
        
        // Combo multiplier
        if (stats.comboMultiplier > 1) {
          xp = Math.floor(xp * stats.comboMultiplier);
        }
        
        // Penalty for using hint
        if (usedHint) {
          xp = Math.floor(xp * TESTER_CONFIG.HINT_PENALTY);
        }
      }

      // Update gamification engine
      recordAnswer(type, isCorrect, responseTime);
      if (xp > 0) addXP(xp);

      // Update stats
      setStats(prev => {
        const newStreak = isCorrect ? prev.streak + 1 : 0;
        const newPerfectStreak = isCorrect && !usedHint ? prev.perfectStreak + 1 : 0;
        const newCombo = isCorrect 
          ? Math.min(TESTER_CONFIG.COMBO_MULTIPLIER_MAX, prev.comboMultiplier + 0.1)
          : 1;

        const newAvgTime = prev.total === 0
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

      // Track performance
      setRecentPerformance(prev => {
        const newPerf = [...prev, { correct: isCorrect, time: responseTime }];
        return newPerf.slice(-20); // Keep last 20
      });

      // Update counters for difficulty adjustment
      if (isCorrect) {
        consecutiveCorrect.current++;
        consecutiveWrong.current = 0;
      } else {
        consecutiveWrong.current++;
        consecutiveCorrect.current = 0;
      }

      // Auto-adjust difficulty
      if (autoDifficulty && stats.total > 0 && stats.total % TESTER_CONFIG.DIFFICULTY_ADJUST_INTERVAL === 0) {
        adjustDifficultyLevel(isCorrect);
      }

      // SRS integration
      if (enableSRS) {
        addSRSItem({
          type,
          content: question.ref,
          question: question.q,
          answer: question.a,
          correct: isCorrect,
          responseTime
        });
      }

      // Feedback
      showAnswerFeedback(isCorrect, xp, responseTime);

      // Auto-advance
      setTimeout(() => {
        setShowFeedback(false);
        nextQuestion();
      }, TESTER_CONFIG.AUTO_ADVANCE_DELAY);

    }, [answered, question, stats, usedHint, autoDifficulty, enableSRS]);

    // ======================================
    // FEEDBACK SYSTEM
    // ======================================
    const showAnswerFeedback = useCallback((isCorrect, xp, responseTime) => {
      let message = '';
      let emoji = '';

      if (isCorrect) {
        // Positive feedback (varied based on performance)
        if (stats.perfectStreak >= TESTER_CONFIG.PERFECT_STREAK_THRESHOLD) {
          emoji = '🌟';
          message = `PERFECT STREAK ${stats.perfectStreak}! Master!`;
        } else if (stats.streak >= 5) {
          emoji = '🔥';
          message = `${stats.streak} STREAK! On fire!`;
        } else if (responseTime < 2000) {
          emoji = '⚡';
          message = `Lightning fast! +${xp} XP`;
        } else {
          emoji = '✅';
          message = `Correct! +${xp} XP`;
        }

        showToast?.(`${emoji} ${message}`, 'success');
        a11y.announce(`Correct! ${message}`);
      } else {
        // Constructive feedback
        emoji = '💡';
        message = `The answer was: ${question.a}`;
        
        if (consecutiveWrong.current >= 3) {
          message += ' - Try easier level?';
        }

        showToast?.(`${emoji} ${message}`, 'error');
        a11y.announce(`Incorrect. ${message}`);
      }

      setFeedbackMessage(message);
      setShowFeedback(true);
    }, [stats, question, consecutiveWrong]);

    // ======================================
    // DIFFICULTY ADJUSTMENT
    // ======================================
    const adjustDifficultyLevel = useCallback((lastCorrect) => {
      const recentAccuracy = recentPerformance.length > 0
        ? recentPerformance.filter(p => p.correct).length / recentPerformance.length
        : 0.5;

      const avgTime = stats.avgResponseTime;

      // Auto-adjust rules
      if (recentAccuracy > 0.85 && avgTime < 4000 && difficulty === 'beginner') {
        setDifficulty('intermediate');
        showToast?.('📈 Moving to Intermediate level!', 'success');
      } else if (recentAccuracy > 0.85 && avgTime < 3000 && difficulty === 'intermediate') {
        setDifficulty('advanced');
        showToast?.('🚀 Moving to Advanced level!', 'success');
      } else if (recentAccuracy < 0.5 && consecutiveWrong.current >= 5 && difficulty === 'advanced') {
        setDifficulty('intermediate');
        showToast?.('⚠️ Moving to Intermediate level', 'warning');
      } else if (recentAccuracy < 0.4 && consecutiveWrong.current >= 5 && difficulty === 'intermediate') {
        setDifficulty('beginner');
        showToast?.('💪 Moving to Beginner level - practice makes perfect!', 'info');
      }
    }, [recentPerformance, stats, difficulty, consecutiveWrong]);

    // ======================================
    // HINT SYSTEM
    // ======================================
    const toggleHint = useCallback(() => {
      if (!enableHints || answered || usedHint) return;
      
      setShowHint(prev => !prev);
      setUsedHint(true);
      
      showToast?.('💡 Hint shown (50% XP penalty)', 'info');
      a11y.announce('Hint revealed');
    }, [enableHints, answered, usedHint]);

    const generateHint = useCallback(() => {
      if (!question) return '';

      // Type-specific hints
      if (type === 'keys') {
        const accidentals = question.ref?.accidentals || 0;
        return accidentals >= 0 
          ? `Has ${accidentals} sharps`
          : `Has ${Math.abs(accidentals)} flats`;
      }
      
      if (type === 'intervals') {
        const semitones = question.ref?.semitones || 0;
        return `${semitones} semitones`;
      }

      if (type === 'tempo') {
        const bpm = question.ref?.bpm || 0;
        return bpm > 120 ? 'Fast tempo' : bpm > 80 ? 'Medium tempo' : 'Slow tempo';
      }

      return 'Think about the pattern...';
    }, [question, type]);

    // ======================================
    // INITIALIZATION
    // ======================================
    useEffect(() => {
      nextQuestion();
    }, []);

    // ======================================
    // COMPUTED VALUES
    // ======================================
    const accuracy = useMemo(() => 
      stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      [stats]
    );

    const streakIcon = useMemo(() => {
      if (stats.streak >= 10) return '🌟';
      if (stats.streak >= 5) return '🔥';
      if (stats.streak >= 3) return '⚡';
      return '';
    }, [stats.streak]);

    const gradeColor = useMemo(() => {
      if (accuracy >= 90) return 'grade-s';
      if (accuracy >= 80) return 'grade-a';
      if (accuracy >= 70) return 'grade-b';
      if (accuracy >= 60) return 'grade-c';
      return 'grade-d';
    }, [accuracy]);

    const sessionDuration = useMemo(() => 
      formatDuration(Date.now() - sessionStartTime),
      [sessionStartTime]
    );

    // ======================================
    // RENDER
    // ======================================
    return h('div', { 
      className: 'module-container tester',
      'data-module': type,
      role: 'main',
      'aria-label': title
    },
      // Header
      h('header', { className: 'module-header' },
        h('button', { 
          className: 'btn-back', 
          onClick: onBack,
          'aria-label': 'Go back'
        }, '← Back'),
        
        h('h1', null, `${icon} ${title}`),
        
        h('div', { className: 'stats-bar' },
          h('div', { className: 'stat-item' },
            h('span', { className: 'stat-label' }, 'Score'),
            h('span', { className: `stat-value ${gradeColor}` }, 
              `${stats.correct}/${stats.total}`
            )
          ),
          h('div', { className: 'stat-item' },
            h('span', { className: 'stat-label' }, 'Accuracy'),
            h('span', { className: 'stat-value' }, `${accuracy}%`)
          ),
          h('div', { className: 'stat-item streak-display' },
            h('span', { className: 'stat-label' }, 'Streak'),
            h('span', { className: 'stat-value streak' }, 
              `${streakIcon} ${stats.streak}`
            )
          ),
          h('div', { className: 'stat-item' },
            h('span', { className: 'stat-label' }, 'Time'),
            h('span', { className: 'stat-value' }, sessionDuration)
          )
        )
      ),

      // Progress indicator
      h('div', { className: 'progress-indicator' },
        h('div', { 
          className: 'progress-bar',
          role: 'progressbar',
          'aria-valuenow': accuracy,
          'aria-valuemin': 0,
          'aria-valuemax': 100
        },
          h('div', { 
            className: `progress-fill ${gradeColor}`,
            style: { width: `${accuracy}%` }
          })
        ),
        stats.comboMultiplier > 1 && h('div', { className: 'combo-badge' },
          `${stats.comboMultiplier.toFixed(1)}x COMBO`
        )
      ),

      // Question section
      h('section', { 
        className: 'question-section',
        'aria-live': 'polite',
        'aria-atomic': true
      },
        h('div', { className: 'question-card' },
          h('div', { className: 'question-header' },
            h('span', { className: 'question-number' }, 
              `Question ${stats.total + 1}`
            ),
            h('span', { className: `difficulty-badge difficulty-${difficulty}` },
              difficulty
            )
          ),
          
          h('h2', { className: 'question-text' }, question?.q || 'Loading...'),
          
          // Audio button
          audioPlay && h('button', {
            className: `btn-play ${isPlaying ? 'playing' : ''}`,
            onClick: handlePlayAudio,
            disabled: answered || isPlaying,
            'aria-label': isPlaying ? 'Audio playing...' : 'Play audio example',
            title: 'Play audio (Space)'
          },
            isPlaying 
              ? h('span', { className: 'audio-wave' }, '🔊')
              : h('span', null, '▶️ Play Audio')
          ),

          // Hint button
          enableHints && !answered && h('button', {
            className: `btn-hint ${showHint ? 'active' : ''}`,
            onClick: toggleHint,
            disabled: usedHint,
            title: 'Show hint (H) - 50% XP penalty'
          }, showHint ? '💡 Hint shown' : '💡 Need a hint?'),

          // Hint display
          showHint && h('div', { className: 'hint-box' },
            h('p', null, generateHint())
          )
        )
      ),

      // Options section
      h('section', { 
        className: 'options-section',
        role: 'radiogroup',
        'aria-label': 'Answer options'
      },
        options.map((opt, i) => {
          const isCorrectAnswer = opt === question?.a;
          const isSelected = opt === selected;
          const showAsCorrect = answered && isCorrectAnswer;
          const showAsWrong = answered && isSelected && !isCorrectAnswer;

          return h('button', {
            key: `${opt}-${i}`,
            className: `option-btn ${
              showAsCorrect ? 'correct' :
              showAsWrong ? 'wrong' :
              isSelected && !answered ? 'selected' : ''
            }`,
            onClick: () => !answered && handleAnswer(opt),
            disabled: answered,
            style: { '--animation-delay': `${i * 50}ms` },
            role: 'radio',
            'aria-checked': isSelected,
            'aria-label': `Option ${i + 1}: ${opt}`,
            title: `Press ${i + 1} to select`
          },
            h('span', { className: 'option-number' }, i + 1),
            h('span', { className: 'option-text' }, opt),
            showAsCorrect && h('span', { className: 'option-icon' }, '✓'),
            showAsWrong && h('span', { className: 'option-icon' }, '✗')
          );
        })
      ),

      // Feedback overlay
      showFeedback && h('div', { className: 'feedback-overlay' },
        h('div', { className: 'feedback-content' },
          h('p', null, feedbackMessage)
        )
      ),

      // Controls section
      h('div', { className: 'tester-controls' },
        h('div', { className: 'difficulty-controls' },
          h('label', null, 
            h('input', {
              type: 'checkbox',
              checked: autoDifficulty,
              onChange: (e) => setAutoDifficulty(e.target.checked)
            }),
            h('span', null, 'Auto-adjust difficulty')
          ),
          
          !autoDifficulty && h('div', { className: 'difficulty-toggle' },
            difficultyLevels.map(level =>
              h('button', {
                key: level,
                className: `btn-sm ${difficulty === level ? 'active' : ''}`,
                onClick: () => setDifficulty(level)
              }, level.charAt(0).toUpperCase() + level.slice(1))
            )
          )
        ),

        h('div', { className: 'kbd-hints' },
          h('div', { className: 'kbd-hint' },
            h('kbd', null, 'Space'),
            h('small', null, 'Play')
          ),
          h('div', { className: 'kbd-hint' },
            h('kbd', null, '1-6'),
            h('small', null, 'Select')
          ),
          h('div', { className: 'kbd-hint' },
            h('kbd', null, 'Enter'),
            h('small', null, 'Submit')
          ),
          enableHints && h('div', { className: 'kbd-hint' },
            h('kbd', null, 'H'),
            h('small', null, 'Hint')
          )
        )
      ),

      // Session summary (if streak broken or session long)
      stats.total > 0 && stats.total % 20 === 0 && h('div', { className: 'session-summary card' },
        h('h3', null, '📊 Session Milestone'),
        h('div', { className: 'summary-stats' },
          h('div', null, `${stats.total} questions completed`),
          h('div', null, `${accuracy}% accuracy`),
          h('div', null, `Best streak: ${stats.longestStreak}`),
          h('div', null, `Avg response: ${(stats.avgResponseTime / 1000).toFixed(1)}s`)
        ),
        h('button', { 
          className: 'btn btn-outline',
          onClick: () => onBack()
        }, 'View Full Analytics')
      )
    );
  };
}

// ======================================
// HELPER FUNCTIONS
// ======================================

/**
 * Generate question with dynamic templates
 */
function generateQuestionType(questionTypes, item) {
  const qt = getRandom(questionTypes);
  
  // Support both string and function answers
  const answer = typeof qt.a === 'function' ? qt.a(item) : qt.a;
  
  // Support dynamic questions with item substitution
  const question = qt.q.replace('#', item.name || item.sig || '');
  
  return {
    q: question,
    a: answer
  };
}

/**
 * Generate smart distractors (wrong answers)
 */
function generateDistractors(allData, correctItem, correctAnswer, count, config) {
  const distractors = [];
  const pool = allData.filter(item => {
    const itemAnswer = item.name || item.sig;
    return itemAnswer !== correctAnswer;
  });

  // Shuffle and prioritize similar items for harder difficulty
  const shuffled = shuffle(pool);
  
  // For harder difficulty, prefer items close to correct answer
  if (config?.preferSimilarDistractors) {
    shuffled.sort((a, b) => {
      const aSimilarity = calculateSimilarity(a, correctItem);
      const bSimilarity = calculateSimilarity(b, correctItem);
      return bSimilarity - aSimilarity;
    });
  }

  // Take required number of distractors
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    distractors.push(shuffled[i].name || shuffled[i].sig);
  }

  return distractors;
}

/**
 * Calculate similarity between items (for difficult distractors)
 */
function calculateSimilarity(item1, item2) {
  // Key signatures: compare accidental count
  if (item1.accidentals !== undefined && item2.accidentals !== undefined) {
    return 1 / (1 + Math.abs(item1.accidentals - item2.accidentals));
  }
  
  // Intervals: compare semitone distance
  if (item1.semitones !== undefined && item2.semitones !== undefined) {
    return 1 / (1 + Math.abs(item1.semitones - item2.semitones));
  }
  
  // Tempo: compare BPM
  if (item1.bpm !== undefined && item2.bpm !== undefined) {
    return 1 / (1 + Math.abs(item1.bpm - item2.bpm));
  }

  return 0.5; // Default: random
}

/**
 * Select item weighted by SRS algorithm
 */
function selectSRSWeightedItem(levelData, type) {
  const dueItems = getNextReviewItems?.(type, 5);
  
  // 30% chance to prioritize due reviews
  if (dueItems && dueItems.length > 0 && Math.random() < 0.3) {
    const dueItem = getRandom(dueItems);
    const matchingItem = levelData.find(item => 
      item.name === dueItem.content.name || 
      item.sig === dueItem.content.sig
    );
    
    if (matchingItem) return matchingItem;
  }

  // Otherwise, random selection
  return getRandom(levelData);
}

// ======================================
// SPECIFIC TESTER IMPLEMENTATIONS
// ======================================

/**
 * Key Signature Tester - Enhanced with multiple question types
 */
export const KeyTester = createTester({
  type: 'keys',
  title: 'Key Signature Tester',
  icon: '🎹',
  getData: () => ({
    beginner: KEY_SIGNATURES.slice(0, 7),      // C, G, D, F, Bb majors + relatives
    intermediate: KEY_SIGNATURES.slice(0, 12), // Up to 3 sharps/flats
    advanced: KEY_SIGNATURES                    // All keys
  }),
  questionTypes: [
    { q: 'What is the major key with # sharps/flats?', a: item => item.major },
    { q: 'What is the relative minor of #?', a: item => item.minor },
    { q: 'How many sharps/flats in #?', a: item => `${Math.abs(item.accidentals)}` },
    { q: 'Which key signature is this?', a: item => item.sig }
  ],
  enableSRS: true,
  enableHints: true
});

/**
 * Tempo Tester - Audio-enabled with metronome
 */
export const TempoTester = createTester({
  type: 'tempo',
  title: 'Tempo Recognition',
  icon: '⏱️',
  getData: () => [
    { name: 'Largo (40 BPM)', bpm: 40 },
    { name: 'Adagio (60 BPM)', bpm: 60 },
    { name: 'Andante (76 BPM)', bpm: 76 },
    { name: 'Moderato (108 BPM)', bpm: 108 },
    { name: 'Allegro (132 BPM)', bpm: 132 },
    { name: 'Presto (168 BPM)', bpm: 168 },
    { name: 'Prestissimo (200 BPM)', bpm: 200 }
  ],
  audioPlay: (item, callback) => {
    return audioEngine.playMetronome(item.bpm, 8, callback);
  },
  questionTypes: [
    { q: 'What tempo is this?', a: item => item.name }
  ],
  enableSRS: true,
  enableHints: true
});

/**
 * Time Signature Tester - Rhythm pattern recognition
 */
export const TimeSigTester = createTester({
  type: 'timesig',
  title: 'Time Signature Recognition',
  icon: '🎼',
  getData: () => [
    { name: '2/4 (March)', sig: '2/4', pattern: [1, 0] },
    { name: '3/4 (Waltz)', sig: '3/4', pattern: [1, 0, 0] },
    { name: '4/4 (Common time)', sig: '4/4', pattern: [1, 0, 0.5, 0] },
    { name: '6/8 (Compound duple)', sig: '6/8', pattern: [1, 0, 0, 0.7, 0, 0] },
    { name: '5/4 (Quintuple)', sig: '5/4', pattern: [1, 0, 0, 0.7, 0] },
    { name: '7/8 (Irregular)', sig: '7/8', pattern: [1, 0, 0.7, 0, 0.7, 0, 0] },
    { name: '9/8 (Compound triple)', sig: '9/8', pattern: [1, 0, 0, 0.7, 0, 0, 0.7, 0, 0] }
  ],
  audioPlay: (item, callback) => {
    return audioEngine.playRhythmPattern?.(item.pattern, 120, callback);
  },
  questionTypes: [
    { q: 'What time signature is this pattern?', a: item => item.name }
  ],
  enableSRS: true,
  enableHints: true
});

/**
 * Arpeggio/Chord Tester - Harmonic recognition
 */
export const ArpeggioTester = createTester({
  type: 'arpeggio',
  title: 'Chord Recognition',
  icon: '🎵',
  getData: () => [
    { name: 'Major Triad', id: 'major', intervals: [0, 4, 7] },
    { name: 'Minor Triad', id: 'minor', intervals: [0, 3, 7] },
    { name: 'Diminished Triad', id: 'dim', intervals: [0, 3, 6] },
    { name: 'Augmented Triad', id: 'aug', intervals: [0, 4, 8] },
    { name: 'Dominant 7th', id: 'dom7', intervals: [0, 4, 7, 10] },
    { name: 'Major 7th', id: 'maj7', intervals: [0, 4, 7, 11] },
    { name: 'Minor 7th', id: 'min7', intervals: [0, 3, 7, 10] },
    { name: 'Half-Diminished 7th', id: 'hdim7', intervals: [0, 3, 6, 10] }
  ],
  audioPlay: (item, callback) => {
    const root = 60; // Middle C
    const freqs = item.intervals.map(i => midiToFreq(root + i));
    return audioEngine.playArpeggio?.(freqs, callback);
  },
  questionTypes: [
    { q: 'What chord quality is this?', a: item => item.name }
  ],
  enableSRS: true,
  enableHints: false,
  difficultyLevels: ['beginner', 'intermediate', 'advanced']
});

/**
 * Scale Tester - Scale recognition
 */
export const ScaleTester = createTester({
  type: 'scales',
  title: 'Scale Recognition',
  icon: '🎹',
  getData: () => [
    { name: 'Major Scale', pattern: [2, 2, 1, 2, 2, 2, 1] },
    { name: 'Natural Minor', pattern: [2, 1, 2, 2, 1, 2, 2] },
    { name: 'Harmonic Minor', pattern: [2, 1, 2, 2, 1, 3, 1] },
    { name: 'Melodic Minor', pattern: [2, 1, 2, 2, 2, 2, 1] },
    { name: 'Dorian Mode', pattern: [2, 1, 2, 2, 2, 1, 2] },
    { name: 'Mixolydian Mode', pattern: [2, 2, 1, 2, 2, 1, 2] }
  ],
  audioPlay: (item, callback) => {
    const root = 60;
    const notes = [root];
    item.pattern.reduce((acc, step) => {
      const next = acc + step;
      notes.push(next);
      return next;
    }, root);
    
    const freqs = notes.map(midiToFreq);
    return audioEngine.playScale?.(freqs, callback);
  },
  questionTypes: [
    { q: 'What scale is this?', a: item => item.name }
  ],
  enableSRS: true,
  enableHints: true
});

// ======================================
// HELPER: MIDI to Frequency
// ======================================
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export default {
  KeyTester,
  TempoTester,
  TimeSigTester,
  ArpeggioTester,
  ScaleTester,
  createTester
};
