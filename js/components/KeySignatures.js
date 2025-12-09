// ========================================================
// VMQ KEY SIGNATURES v3.0 - ML-Enhanced
// Cooper's Key Signature & Bach Guide + Fingerboard Overlay
// ========================================================

const { createElement: h, useState, useEffect, useCallback, useMemo, useRef } = React;
import { 
  KEY_SIGNATURES, 
  SHARP_ORDER, 
  FLAT_ORDER, 
  PRAISE_MESSAGES,
  AUDIO_URLS,
  XP_VALUES
} from '../config/constants.js';
import { 
  selectNextItem, 
  updateItem, 
  getMasteryStats,
  getConfusionMatrix,
  getDueItems,
  predictOptimalInterval
} from '../engines/spacedRepetition.js';
import { 
  getDifficulty, 
  getItemPool, 
  getDifficultyInfo,
  getAdaptiveConfig
} from '../engines/difficultyAdapter.js';
import { addXP, recordStreak, getUserLevel } from '../engines/gamification.js';
import { 
  analyzeKeySignaturePerformance,
  predictSkillTransfer
} from '../engines/analytics.js';
import { shuffle, getRandom, normalizeText, debounce } from '../utils/helpers.js';
import { audioEngine } from '../engines/audioEngine.js';
import { keyboard } from '../utils/keyboard.js';
import { a11y } from '../utils/a11y.js';
import sessionTracker from '../engines/sessionTracker.js';

// Fingerboard visualization component
function FingerboardMini({ keySignature, string, position, showCorrect = false }) {
  const strings = ['G', 'D', 'A', 'E'];
  const positions = [0, 1, 2, 3, 4]; // 0 = open string
  
  return h('div', { className: 'fingerboard-mini', role: 'img', 'aria-label': `Violin fingerboard showing ${keySignature} on ${string} string` },
    h('div', { className: 'fingerboard-strings' },
      strings.map(s => {
        const isActiveString = s === string;
        const fingerPosition = keySignature.handMap?.[s] || '0';
        const isHigh = fingerPosition.includes('high');
        const positionNum = parseInt(fingerPosition.replace(/high|low/, '')) || 0;
        
        return h('div', {
          key: s,
          className: `string ${isActiveString ? 'active' : ''}`,
          'aria-hidden': 'true'
        },
          h('span', { className: 'string-label' }, s),
          positions.map(pos => {
            const isCorrectPos = isActiveString && pos === positionNum;
            const shouldShow = showCorrect && isCorrectPos;
            
            return h('div', {
              key: pos,
              className: `finger-position ${shouldShow ? 'correct' : ''} ${isHigh ? 'high' : 'low'}`,
              'data-position': pos
            });
          })
        );
      })
    ),
    showCorrect && h('div', { className: 'finger-hint' }, 
      `Finger ${positionNum} ${isHigh ? '(high position)' : '(low position)'}`
    )
  );
}

export function KeySignatures({ onBack, onAnswer, showToast }) {
  // State
  const [currentKey, setCurrentKey] = useState(null);
  const [questionType, setQuestionType] = useState('major');
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);
  const [responseTime, setResponseTime] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showFingerboard, setShowFingerboard] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, accuracy: 0 });
  
  // Refs
  const startTimeRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Get difficulty and pool
  const difficultyInfo = useMemo(() => getDifficultyInfo('keySignatures'), []);
  const pool = useMemo(() => getItemPool('keySignatures', KEY_SIGNATURES), [difficultyInfo]);

  // ML: Get adaptive config for this session
  const adaptiveConfig = useMemo(() => getAdaptiveConfig('keySignatures'), []);

  // Generate first question
  useEffect(() => {
    generateQuestion();
    
    // Focus management
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Announce to screen reader
    a11y.announce('Key Signatures module loaded');
    
    // Track module start
    sessionTracker.trackActivity('keySignatures', 'module-start', {
      difficulty: difficultyInfo.level,
      poolSize: pool.length
    });
    
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        showHint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showMastery) {
          setShowMastery(false);
        } else {
          onBack();
        }
      }
    };
    
    keyboard.onKeydown(handleKeyPress);
    return () => keyboard.offKeydown(handleKeyPress);
  }, [showMastery, currentKey, questionType]);

  // ML: Generate adaptive question
  async function generateQuestion() {
    if (pool.length === 0) {
      setFeedback('No key signatures available.');
      return;
    }

    // ML: Get due items from spaced repetition
    const dueKeyIds = getDueItems('keySignatures', 10).map(item => item.id);
    
    // ML: Get confusion matrix to find weak keys
    const confusionMatrix = getConfusionMatrix('keySignatures');
    const weakKeys = Object.entries(confusionMatrix)
      .filter(([keyId, data]) => data.accuracy < 70 && data.attempts > 3)
      .map(([keyId]) => keyId);
    
    // ML: Predict optimal question type based on performance
    const optimalType = predictOptimalQuestionType();
    
    // Build weighted pool: 40% due, 30% weak, 30% random
    const weightedPool = [];
    
    // Add due items with high weight
    dueKeyIds.forEach(id => {
      const key = pool.find(k => k.id === id);
      if (key) weightedPool.push({ ...key, weight: 3.0, reason: 'due' });
    });
    
    // Add weak items
    weakKeys.forEach(id => {
      const key = pool.find(k => k.id === id);
      if (key && !weightedPool.find(w => w.id === id)) {
        weightedPool.push({ ...key, weight: 2.5, reason: 'weak' });
      }
    });
    
    // Add random items
    pool.forEach(key => {
      if (!weightedPool.find(w => w.id === key.id)) {
        weightedPool.push({ ...key, weight: 1.0, reason: 'random' });
      }
    });
    
    // ML: Select based on weights
    const selectedKey = weightedRandomSelect(weightedPool);
    const selectedType = optimalType || getRandom(['major', 'minor', 'handMap']);
    
    setCurrentKey(selectedKey);
    setQuestionType(selectedType);
    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);
    setHintsUsed(0);
    setShowFingerboard(false);
    startTimeRef.current = Date.now();
    
    // Update mastery stats
    const keyIds = pool.map(k => k.id);
    const stats = getMasteryStats(keyIds);
    setMastery(stats);
    
    // Track question generation
    sessionTracker.trackActivity('keySignatures', 'question-generated', {
      keyId: selectedKey.id,
      questionType: selectedType,
      reason: selectedKey.reason,
      difficulty: difficultyInfo.level
    });
    
    // ML: Predict response time
    const predictedTime = predictResponseTime(selectedKey.id, selectedType);
    if (predictedTime > 5000) {
      // Auto-show hint for challenging questions
      setTimeout(() => {
        if (!answered) showHint();
      }, 3000);
    }
  }

  // ML: Predict optimal question type
  function predictOptimalQuestionType() {
    const stats = getMasteryStats(pool.map(k => k.id));
    const typeStats = {
      major: stats.filter(s => s.lastQuestionType === 'major'),
      minor: stats.filter(s => s.lastQuestionType === 'minor'),
      handMap: stats.filter(s => s.lastQuestionType === 'handMap')
    };
    
    // Find weakest type
    let weakestType = 'major';
    let lowestAccuracy = 100;
    
    Object.entries(typeStats).forEach(([type, typeStats]) => {
      if (typeStats.length > 0) {
        const avgAccuracy = typeStats.reduce((sum, s) => sum + s.accuracy, 0) / typeStats.length;
        if (avgAccuracy < lowestAccuracy) {
          lowestAccuracy = avgAccuracy;
          weakestType = type;
        }
      }
    });
    
    return weakestType;
  }

  // ML: Predict response time
  function predictResponseTime(keyId, questionType) {
    const matrix = getConfusionMatrix('keySignatures');
    const history = matrix[keyId] || { avgTime: 3000, attempts: 0 };
    
    // Base time adjusted by difficulty
    const baseTime = history.avgTime || 3000;
    const difficultyMultiplier = difficultyInfo.level === 'easy' ? 0.8 : 
                                 difficultyInfo.level === 'hard' ? 1.2 : 1.0;
    
    return baseTime * difficultyMultiplier;
  }

  // Weighted random selection
  function weightedRandomSelect(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item;
    }
    
    return items[0];
  }

  // Get question text
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

  // Get current string for handMap
  function getCurrentString() {
    if (questionType !== 'handMap') return null;
    const match = getQuestionText().match(/on the (\w) string/);
    return match ? match[1] : null;
  }

  // Check answer
  function checkAnswer(answer) {
    const normalized = normalizeText(answer);

    switch (questionType) {
      case 'major':
        return normalizeText(currentKey.major) === normalized;
      case 'minor':
        return normalizeText(currentKey.minor) === normalized;
      case 'handMap':
        const string = getCurrentString();
        if (!string) return false;
        const correctAnswer = currentKey.handMap[string];
        return normalized === normalizeText(correctAnswer);
      default:
        return false;
    }
  }

  // Get correct answer
  function getCorrectAnswer() {
    switch (questionType) {
      case 'major':
        return currentKey.major;
      case 'minor':
        return currentKey.minor;
      case 'handMap':
        const string = getCurrentString();
        return string ? currentKey.handMap[string] : '—';
      default:
        return '—';
    }
  }

  // Show hint
  function showHint() {
    setHintsUsed(prev => prev + 1);
    
    let hint = '';
    switch (questionType) {
      case 'major':
        hint = `Remember: ${currentKey.major} has ${currentKey.accidentals > 0 ? 'sharps' : 'flats'} in this order: ${currentKey.type === 'sharp' ? SHARP_ORDER.join(', ') : FLAT_ORDER.join(', ')}`;
        break;
      case 'minor':
        hint = `Relative minor is 3 half steps down from major. ${currentKey.major} → ${currentKey.minor}`;
        break;
      case 'handMap':
        const string = getCurrentString();
        hint = `On the ${string} string: ${currentKey.handMap[string]}`;
        setShowFingerboard(true);
        break;
    }
    
    setFeedback(hint);
    setFeedbackType('hint');
    
    // Track hint usage
    sessionTracker.trackActivity('keySignatures', 'hint-used', {
      keyId: currentKey.id,
      questionType,
      hintsUsed: hintsUsed + 1
    });
  }

  // Handle answer submission
  async function handleSubmit(e) {
    e.preventDefault();
    if (answered || !userAnswer.trim()) return;

    const endTime = Date.now();
    const responseTime = endTime - startTimeRef.current;
    const isCorrect = checkAnswer(userAnswer);

    // Update spaced repetition
    updateItem(currentKey.id, isCorrect, responseTime, questionType);

    // Update stats
    const newSessionStats = {
      correct: sessionStats.correct + (isCorrect ? 1 : 0),
      total: sessionStats.total + 1,
      accuracy: Math.round(((sessionStats.correct + (isCorrect ? 1 : 0)) / (sessionStats.total + 1)) * 100)
    };
    setSessionStats(newSessionStats);

    // Callback to parent
    onAnswer(isCorrect);

    // Show feedback
    if (isCorrect) {
      const praise = getRandom(PRAISE_MESSAGES);
      setFeedback(praise);
      setFeedbackType('success');
      
      // ML: XP bonus based on difficulty and speed
      const baseXP = XP_VALUES.correct;
      const speedBonus = responseTime < 2000 ? 1.5 : responseTime < 4000 ? 1.2 : 1.0;
      const difficultyBonus = difficultyInfo.level === 'hard' ? 1.3 : 
                              difficultyInfo.level === 'medium' ? 1.1 : 1.0;
      const totalXP = Math.floor(baseXP * speedBonus * difficultyBonus);
      
      addXP(totalXP, 'key-signatures-correct');
      
      // Show XP popup
      showToast(`+${totalXP} XP! ${praise}`, 'success');
      
      // Play audio feedback
      if (!settings.muted) {
        audioEngine.playSuccess();
        // Play tonic drone for ear training
        setTimeout(() => {
          const tonic = currentKey.major;
          const note = tonic.match(/[A-G]#?/)[0];
          audioEngine.playDrone(note);
        }, 300);
      }
    } else {
      const correctAnswer = getCorrectAnswer();
      setFeedback(`The correct answer is: ${correctAnswer}`);
      setFeedbackType('error');
      
      // Play error sound
      if (!settings.muted) {
        audioEngine.playError();
      }
    }

    setAnswered(true);

    // ML: Analyze performance for skill transfer
    setTimeout(async () => {
      await analyzePerformanceAndTransfer(isCorrect, responseTime);
    }, 500);

    // Auto-advance with ML-optimized timing
    const nextDelay = isCorrect ? 
      Math.max(1500, 3000 - responseTime) : // Faster for correct, slower for incorrect
      4000;
    
    setTimeout(() => {
      generateQuestion();
    }, nextDelay);
  }

  // ML: Analyze performance and detect skill transfer
  async function analyzePerformanceAndTransfer(isCorrect, responseTime) {
    // Analyze key signature performance
    const analysis = await analyzeKeySignaturePerformance(currentKey.id, {
      isCorrect,
      responseTime,
      questionType,
      hintsUsed,
      difficulty: difficultyInfo.level
    });
    
    // Check for skill transfer to other modules
    if (analysis.breakthroughDetected) {
      const transfers = await predictSkillTransfer('keySignatures', currentKey.id);
      
      transfers.forEach(transfer => {
        if (transfer.confidence > 0.7) {
          showToast(`${transfer.targetModule} will be easier now! +${transfer.bonusXP} XP`, 'success');
          addXP(transfer.bonusXP, 'skill-transfer');
          
          // Track transfer
          sessionTracker.trackActivity('keySignatures', 'skill-transfer-detected', transfer);
        }
      });
    }
  }

  // Toggle mastery view
  function toggleMastery() {
    const willShow = !showMastery;
    setShowMastery(willShow);
    
    if (willShow) {
      // Refresh stats
      const keyIds = pool.map(k => k.id);
      const stats = getMasteryStats(keyIds);
      setMastery(stats);
      
      // Track view
      sessionTracker.trackActivity('keySignatures', 'mastery-viewed');
    }
  }

  // Debounced input handler for ML timing
  const handleInputChange = useCallback(
    debounce((value) => {
      if (value.length > 0 && !answered) {
        // ML: Predict if answer is likely correct
        const isLikelyCorrect = predictAnswerLikelihood(value);
        if (isLikelyCorrect) {
          inputRef.current?.classList.add('likely-correct');
        } else {
          inputRef.current?.classList.remove('likely-correct');
        }
      }
    }, 300),
    [answered, currentKey, questionType]
  );

  // ML: Predict answer likelihood based on partial input
  function predictAnswerLikelihood(partialAnswer) {
    const normalized = normalizeText(partialAnswer);
    const correctAnswer = normalizeText(getCorrectAnswer());
    
    // Simple heuristic: measure similarity
    const similarity = calculateSimilarity(normalized, correctAnswer);
    return similarity > 0.7;
  }

  function calculateSimilarity(str1, str2) {
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Levenshtein distance normalized
    const longer = str1.length > str2.length ? str1 : str2;
    const distance = levenshteinDistance(str1, str2);
    return (longer.length - distance) / longer.length;
  }

  function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Get current string for fingerboard
  const currentString = getCurrentString();

  return h('div', { 
    className: 'mode-container keysig-mode', 
    ref: containerRef,
    'data-question-type': questionType
  },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { className: 'btn-back', onClick: () => {
        sessionTracker.trackActivity('keySignatures', 'module-exit', {
          sessionStats,
          duration: Date.now() - startTimeRef.current
        });
        onBack();
      }}, '← Back'),
      h('h2', null, '🎼 Key Signatures'),
      h('div', { className: 'difficulty-badge', 'data-level': difficultyInfo.level },
        difficultyInfo.label,
        mlContext.isWarmingUp ? null : h('span', { className: 'ml-indicator', title: 'ML optimized' }, '🤖')
      )
    ),

    // Main content
    h('div', { className: 'mode-content' },
      currentKey && h('div', { className: 'keysig-area' },
        // Visual key signature display
        h('div', { className: 'keysig-visual' },
          h('div', { className: 'staff' },
            h('div', { className: 'clef' }, '𝄞'),
            h('div', { className: 'accidentals-display' },
              currentKey.accidentals === 0 
                ? h('span', { className: 'no-accidentals' }, 'No sharps or flats')
                : h('div', { className: `accidentals ${currentKey.type}` },
                    Array.from({ length: Math.abs(currentKey.accidentals) }, (_, i) =>
                      h('span', {
                        key: i,
                        className: 'accidental',
                        'data-note': currentKey.type === 'sharp' ? SHARP_ORDER[i] : FLAT_ORDER[i]
                      }, currentKey.type === 'sharp' ? '♯' : '♭')
                    )
                  )
            )
          )
        ),

        // Circle of fifths position indicator
        h('div', { className: 'circle-indicator' },
          h('div', { className: 'circle-track' },
            h('div', { 
              className: 'circle-marker',
              style: { 
                '--position': currentKey.circlePosition || 0,
                '--color': currentKey.type === 'sharp' ? '#3b82f6' : '#ef4444'
              }
            })
          ),
          h('div', { className: 'circle-label' }, 
            `${currentKey.major} (${currentKey.accidentals > 0 ? '+' : ''}${currentKey.accidentals})`
          )
        ),

        // Question instruction
        h('p', { className: 'instruction', 'aria-live': 'polite' }, getQuestionText()),

        // Fingerboard overlay (for handMap questions)
        questionType === 'handMap' && h(FingerboardMini, {
          keySignature: currentKey,
          string: currentString,
          showCorrect: showFingerboard
        }),

        // Answer form
        h('form', { onSubmit: handleSubmit, className: 'answer-form' },
          h('input', {
            type: 'text',
            className: 'input-key',
            value: userAnswer,
            onChange: (e) => {
              setUserAnswer(e.target.value);
              handleInputChange(e.target.value);
            },
            placeholder: questionType === 'handMap' ? 'high2 or low2' : 'Key name...',
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
              disabled: answered || !userAnswer.trim()
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
            h('span', { className: 'stat-value' }, `${Math.round(responseTime / 1000)}s`),
            h('span', { className: 'stat-label' }, 'Time')
          )
        ),

        // Hint text
        h('div', { className: 'hint-text' },
          `${difficultyInfo.description} • Appears in: ${currentKey.appearsIn}`
        )
      ),

      // Feedback with ARIA live
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

    // Mastery overlay with Circle of Fifths
    showMastery && h('div', { className: 'mastery-overlay', onClick: (e) => {
      if (e.target.classList.contains('mastery-overlay')) {
        setShowMastery(false);
      }
    } },
      h('div', { className: 'mastery-panel' },
        h('div', { className: 'mastery-header' },
          h('h3', null, 'Circle of Fifths Mastery'),
          h('button', { className: 'btn-close', onClick: toggleMastery, 'aria-label': 'Close mastery view' }, '×')
        ),
        
        // Circle of Fifths visualization
        h('div', { className: 'circle-of-fifths' },
          h('div', { className: 'circle-major' },
            mastery.map(stat => {
              const key = KEY_SIGNATURES.find(k => k.id === stat.id);
              if (!key) return null;
              
              return h('div', {
                key: `major-${stat.id}`,
                className: `circle-key ${stat.status}`,
                'data-key': key.major,
                onClick: () => {
                  // Jump to this key
                  setCurrentKey(key);
                  setQuestionType('major');
                  setUserAnswer('');
                  setShowMastery(false);
                }
              },
                h('span', { className: 'key-name' }, key.major),
                h('span', { className: 'key-accidentals' }, 
                  key.accidentals === 0 ? 'C' : `${key.accidentals > 0 ? '+' : ''}${key.accidentals}`
                ),
                stat.accuracy > 0 && h('span', { className: 'key-mastery' }, `${stat.accuracy}%`)
              );
            })
          ),
          
          h('div', { className: 'circle-minor' },
            mastery.map(stat => {
              const key = KEY_SIGNATURES.find(k => k.id === stat.id);
              if (!key) return null;
              
              return h('div', {
                key: `minor-${stat.id}`,
                className: `circle-key ${stat.status}`,
                'data-key': key.minor,
                onClick: () => {
                  setCurrentKey(key);
                  setQuestionType('minor');
                  setUserAnswer('');
                  setShowMastery(false);
                }
              },
                h('span', { className: 'key-name' }, key.minor)
              );
            })
          )
        ),
        
        // Mastery details
        h('div', { className: 'mastery-details' },
          h('div', { className: 'mastery-list' },
            mastery.map(stat => {
              const key = KEY_SIGNATURES.find(k => k.id === stat.id);
              if (!key) return null;
              
              return h('div', {
                key: stat.id,
                className: `mastery-item ${stat.status}`,
                'data-status': stat.status
              },
                h('div', { className: 'mastery-item-name' }, 
                  `${key.major} / ${key.minor}`
                ),
                h('div', { className: 'mastery-item-stats' },
                  `${stat.accuracy}% (${stat.correct}/${stat.seen}) • avg ${Math.round(stat.avgTime / 1000)}s`
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
    )
  );
}
