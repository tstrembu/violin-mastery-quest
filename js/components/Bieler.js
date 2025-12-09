// ======================================
// VMQ BIELER v3.2 - Technique Vocabulary with ML Intelligence
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

export function Bieler({ navigate, onAnswer, showToast }) {
  // ✅ Mode state
  const [mode, setMode] = useState('vocabulary'); // 'vocabulary', 'scenario', 'lab'
  
  // Vocabulary mode state
  const [currentTerm, setCurrentTerm] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [mastery, setMastery] = useState([]);
  const [potentialXP, setPotentialXP] = useState(15);
  const [hintLevel, setHintLevel] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [streak, setStreak] = useState(0);
  const [challengeMode, setChallengeMode] = useState(false);
  
  // Analytics state
  const [responseTime, setResponseTime] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
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
  
  const inputRef = useRef(null);
  const responseTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);

  const difficultyInfo = getDifficultyInfo('bieler');
  const level = difficultyInfo.level;
  const pool = getBielerPool(level);

  // Initialize session tracking
  useEffect(() => {
    // Load streak
    setStreak(getStreak('bieler'));
    
    // Initialize voice recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserAnswer(transcript);
        handleSubmit(new Event('submit'));
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        showToast('Voice recognition failed. Please type your answer.', 'error');
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    // Session timer
    sessionTimerRef.current = setInterval(() => {
      trackTimeOnTask('bieler', Date.now() - sessionStartTime);
    }, 1000);
    
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, []);

  // Generate first question
  useEffect(() => {
    if (mode === 'vocabulary') {
      generateQuestion();
      // Coach integration
      const coachRec = getCoachRecommendation('bieler');
      if (coachRec && coachRec.priority === 'high') {
        showToast(`Coach suggests: ${coachRec.suggestion}`, 'info');
      }
    }
  }, [mode]);

  /**
   * Generate ML-enhanced question
   */
  const generateQuestion = useCallback(() => {
    if (pool.length === 0) {
      setFeedback('No vocabulary terms available.');
      return;
    }

    const termIds = pool.map(item => item.term);
    const selectedTerm = selectNextItem(termIds);
    const vocabItem = pool.find(item => item.term === selectedTerm);

    // Predict difficulty & adjust XP
    const predictedDifficulty = predictMasteryCurve(selectedTerm, 'bieler');
    const xpBase = 15;
    const xpBonus = Math.max(0, Math.round((predictedDifficulty - 0.5) * 10));
    const finalXP = xpBase + xpBonus;

    setCurrentTerm(vocabItem);
    setUserAnswer('');
    setFeedback('');
    setFeedbackType('');
    setAnswered(false);
    setPotentialXP(finalXP);
    setHintLevel(0);
    setResponseTime(0);
    setSessionStartTime(Date.now());

    // Update mastery stats
    const stats = getMasteryStats(termIds);
    setMastery(stats);

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
    
    // Track new question event
    trackEvent('bieler', 'question_generated', {
      term: selectedTerm,
      predictedDifficulty,
      xpReward: finalXP
    });
  }, [pool]);

  /**
   * Check if answer is acceptable with ML-enhanced scoring
   */
  const checkAnswer = useCallback((answer, term) => {
    const normalized = normalizeText(answer);
    const correctDef = normalizeText(term.definition);
    
    // Exact match
    if (normalized === correctDef) return { correct: true, score: 1.0 };

    // Check acceptable alternatives
    if (term.acceptableAnswers) {
      for (const acceptable of term.acceptableAnswers) {
        if (normalizeText(acceptable) === normalized) return { correct: true, score: 1.0 };
        if (fuzzyMatch(answer, acceptable, 0.7)) return { correct: true, score: 0.9 };
      }
    }

    // Fuzzy match with main definition
    const fuzzyScore = fuzzyMatch(answer, term.definition, 0.65);
    if (fuzzyScore) return { correct: true, score: 0.8 };
    
    // Semantic similarity (ML-enhanced)
    const semanticScore = calculateSemanticSimilarity(answer, term.definition);
    if (semanticScore > 0.7) return { correct: true, score: 0.7 };
    
    // Extract key concepts
    const keyConcepts = extractKeyConcepts(term.definition);
    const hasKeyConcepts = keyConcepts.some(concept => 
      normalized.includes(normalizeText(concept))
    );
    if (hasKeyConcepts) return { correct: false, score: 0.3, partial: true };

    return { correct: false, score: 0, partial: false };
  }, []);

  /**
   * Progressive hint system (4 levels)
   */
  const getHint = useCallback(() => {
    if (!currentTerm || hintLevel >= 4) return null;
    
    const newLevel = hintLevel + 1;
    setHintLevel(newLevel);
    setHintsUsed(hintsUsed + 1);
    
    trackHintUsage('bieler', currentTerm.term, newLevel);
    
    // Reduce XP for using hints
    setPotentialXP(prev => Math.max(5, prev - 3));
    
    switch (newLevel) {
      case 1:
        return `💡 First letter: "${currentTerm.definition[0]}"`;
      case 2:
        return `💡 Key concept: ${extractKeyConcepts(currentTerm.definition)[0] || 'technique'}`;
      case 3:
        return `💡 This relates to: ${currentTerm.category.replace('_', ' ')}`;
      case 4:
        return `💡 Full definition: ${currentTerm.definition}`;
      default:
        return null;
    }
  }, [currentTerm, hintLevel, hintsUsed]);

  /**
   * Handle answer submission with ML-enhanced gamification
   */
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (answered || !userAnswer.trim()) return;

    const result = checkAnswer(userAnswer, currentTerm);
    const timeTaken = Date.now() - sessionStartTime;
    setResponseTime(timeTaken);

    // Analyze response time
    const timeQuality = analyzeResponseTime(timeTaken, currentTerm.difficulty || 'medium');
    
    // Update spaced repetition with ML-enhanced scoring
    updateItem(currentTerm.term, result.correct, result.score, timeQuality);

    // Update stats
    updateStats('bieler', result.correct, timeTaken, result.score);
    
    // Update session stats
    const newTotal = sessionStats.total + 1;
    const newCorrect = sessionStats.correct + (result.correct ? 1 : 0);
    const newAvgTime = ((sessionStats.avgTime * sessionStats.total) + timeTaken) / newTotal;
    const newStats = {
      total: newTotal,
      correct: newCorrect,
      avgAccuracy: Math.round((newCorrect / newTotal) * 100),
      avgTime: Math.round(newAvgTime),
      breakthroughs: sessionStats.breakthroughs,
      plateaus: sessionStats.plateaus
    };
    setSessionStats(newStats);

    // Detect breakthroughs/plateaus
    if (result.correct && result.score >= 0.9 && timeQuality === 'fast') {
      const isBreakthrough = recordBreakthrough('bieler', currentTerm.term);
      if (isBreakthrough) {
        newStats.breakthroughs++;
        setSessionStats(newStats);
        unlockAchievement('bieler-breakthrough');
      }
    } else if (!result.correct && newStats.avgAccuracy < 60 && newTotal > 10) {
      const isPlateau = detectPlateau('bieler', newStats);
      if (isPlateau) {
        newStats.plateaus++;
        setSessionStats(newStats);
      }
    }

    // Update global stats
    if (onAnswer) {
      onAnswer(result.correct, result.score, timeQuality);
    }

    // ✅ Gamification with partial credit
    let xpEarned = 0;
    if (result.score >= 0.9) {
      xpEarned = potentialXP;
    } else if (result.score >= 0.7) {
      xpEarned = Math.floor(potentialXP * 0.7);
    } else if (result.partial) {
      xpEarned = Math.floor(potentialXP * 0.3);
    }

    if (result.correct || result.partial) {
      const xpResult = awardXP(xpEarned, 'Bieler technique practice');
      incrementDailyItems();
      recordStreak('bieler', result.correct);
      
      const praiseMsg = getRandom(PRAISE_MESSAGES);
      setFeedback(`${praiseMsg} +${xpEarned} XP (${Math.round(result.score * 100)}% match)`);
      setFeedbackType('success');
      showToast(`✓ ${praiseMsg} +${xpEarned} XP`, 'success');
      playFeedback(true, { streak: getStreak('bieler'), module: 'bieler', difficulty: level });
    } else {
      setFeedback(`The full definition is: ${currentTerm.definition}`);
      setFeedbackType('error');
      showToast('Not quite. Review the definition.', 'error');
      playFeedback(false, { module: 'bieler' });
      recordStreak('bieler', false);
    }

    setAnswered(true);
    setStreak(getStreak('bieler'));

    // Log to coach engine
    logBielerSession(currentTerm.term, result, timeTaken, xpEarned);

    // Auto-advance
    setTimeout(() => {
      generateQuestion();
    }, 2500);
  }, [currentTerm, userAnswer, answered, checkAnswer, onAnswer, potentialXP, sessionStats, sessionStartTime]);

  /**
   * Skip to next term
   */
  const handleSkip = useCallback(() => {
    if (!answered) {
      // Count as incorrect
      updateItem(currentTerm.term, false, 0, 'skipped');
      updateStats('bieler', false, 0, 0);
      recordStreak('bieler', false);
      if (onAnswer) {
        onAnswer(false, 0, 'skipped');
      }
    }
    generateQuestion();
  }, [currentTerm, answered, onAnswer, generateQuestion]);

  /**
   * Toggle mastery view
   */
  const toggleMastery = useCallback(() => {
    setShowMastery(!showMastery);
    trackEvent('bieler', 'mastery_view_toggled', { show: !showMastery });
  }, [showMastery]);

  /**
   * Start voice input
   */
  const startVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      showToast('Voice input not supported in this browser', 'error');
      return;
    }
    
    setIsListening(true);
    recognitionRef.current.start();
    trackEvent('bieler', 'voice_input_started');
  }, [showToast]);

  /**
   * Render vocabulary quiz mode with progressive hints
   */
  const renderVocabularyMode = useCallback(() => {
    const hintText = hintLevel > 0 ? getHint() : '';

    return h('div', { className: 'vocab-container' },
      currentTerm && h('div', { className: 'vocab-area' },
        h('div', { className: 'vocab-term-card', 'data-category': currentTerm.category },
          h('div', { className: 'vocab-term' }, currentTerm.term),
          currentTerm.category && h('div', { className: 'vocab-category' },
            currentTerm.category.replace(/_/g, ' ').toUpperCase()
          ),
          h('div', { className: 'vocab-difficulty', 'data-level': currentTerm.difficulty || 'medium' },
            `Difficulty: ${currentTerm.difficulty || 'medium'}`
          )
        ),
        
        h('p', { className: 'instruction' }, 
          'Define this technique (key concepts accepted):'
        ),

        h('form', { onSubmit: handleSubmit, className: 'answer-form' },
          h('textarea', {
            ref: inputRef,
            className: 'input-definition',
            value: userAnswer,
            onChange: (e) => setUserAnswer(e.target.value),
            placeholder: 'Your definition...',
            disabled: answered,
            rows: 4,
            'aria-label': `Define ${currentTerm.term}`,
            autoFocus: true
          }),
          
          // Voice input button
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
              disabled: answered || !userAnswer.trim(),
              'aria-label': 'Check answer'
            }, answered ? 'Next' : 'Check Answer'),
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
              onClick: getHint,
              'aria-label': 'Get a hint'
            }, `Hint (${4 - hintLevel} left)`)
          )
        ),

        // Progressive hint display
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

      // Feedback with rich content
      feedback && h('div', {
        className: `feedback feedback-${feedbackType} ${feedbackType === 'success' ? 'animate-success' : ''}`
      }, 
        h('div', { className: 'feedback-text' }, feedback),
        answered && h('div', { className: 'feedback-details' },
          h('div', null, `Time: ${responseTime}ms`),
          h('div', null, `Streak: ${streak}`),
          h('div', null, `Session: ${sessionStats.correct}/${sessionStats.total}`)
        )
      ),

      // Session stats bar
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

      // Action buttons
      h('div', { className: 'action-buttons' },
        h('button', {
          className: 'btn btn-secondary btn-mastery-toggle',
          onClick: toggleMastery,
          'aria-label': 'View mastery statistics'
        }, showMastery ? 'Hide Stats' : 'View Mastery Stats'),
        
        h('button', {
          className: `btn ${challengeMode ? 'btn-danger' : 'btn-outline'}`,
          onClick: () => setChallengeMode(!challengeMode),
          'aria-label': 'Toggle challenge mode'
        }, challengeMode ? 'Challenge ON' : 'Challenge Mode')
      )
    );
  }, [currentTerm, userAnswer, answered, feedback, feedbackType, hintLevel, sessionStats, streak, challengeMode, handleSubmit, handleSkip, getHint, toggleMastery]);

  /**
   * Render practice scenarios mode
   */
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

    return h('div', { className: 'scenarios-container' },
      h('header', { className: 'scenarios-header' },
        h('h3', null, '🎯 Bieler Practice Scenarios'),
        h('p', { className: 'scenarios-description' },
          'Apply Professor Bieler\'s method in your practice sessions'
        )
      ),
      
      ['lefthand', 'righthand', 'bowstroke'].map(category => {
        const categoryTasks = TECHNIQUE_TASKS.filter(t => t.category === category);
        const masteredCount = categoryTasks.filter(t => {
          const mastery = getMasteryStats([t.id]);
          return mastery.length > 0 && mastery[0].accuracy >= 80;
        }).length;
        
        return h('section', {
          key: category,
          className: 'scenario-category',
          'data-category': category
        },
          h('div', { className: 'category-header' },
            h('div', { className: 'category-title' },
              h('span', { className: 'category-icon' }, categoryIcons[category]),
              h('h4', null, categoryNames[category])
            ),
            h('div', { className: 'category-progress' },
              `${masteredCount}/${categoryTasks.length} mastered`
            )
          ),
          
          h('div', { className: 'tasks-grid' },
            categoryTasks.map(task => {
              const taskMastery = getMasteryStats([task.id]);
              const isMastered = taskMastery.length > 0 && taskMastery[0].accuracy >= 80;
              const attempts = taskMastery.length > 0 ? taskMastery[0].seen : 0;
              
              return h('div', {
                key: task.id,
                className: `task-card ${isMastered ? 'mastered' : ''}`,
                onClick: () => navigate('bielerlab', { task: task.id }),
                role: 'button',
                tabIndex: 0,
                'aria-label': `Practice ${task.name}`
              },
                h('div', { className: 'task-header' },
                  h('div', { className: 'task-name' }, task.name),
                  isMastered && h('div', { className: 'mastery-badge' }, '✓')
                ),
                
                h('div', { className: 'task-description' }, task.description),
                
                task.bielerRef && h('div', { className: 'task-reference' },
                  h('strong', null, 'Bieler: '), task.bielerRef
                ),
                
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

  /**
   * Render Bieler Lab mode (deep dive)
   */
  const renderLabMode = useCallback(() => {
    if (!currentTerm) return null;
    
    const taxonomy = BIELER_TAXONOMY[currentTerm.category];
    const relatedTasks = TECHNIQUE_TASKS.filter(t => 
      t.bielerRef && t.bielerRef.includes(currentTerm.term)
    );

    return h('div', { className: 'lab-container' },
      h('header', { className: 'lab-header' },
        h('h3', null, `🔬 Bieler Lab: ${currentTerm.term}`),
        h('button', {
          className: 'btn-back',
          onClick: () => setMode('vocabulary')
        }, '← Back to Quiz')
      ),
      
      h('div', { className: 'lab-content' },
        h('section', { className: 'lab-section concept-section' },
          h('h4', null, 'Core Concept'),
          h('p', { className: 'lab-description' }, currentTerm.definition),
          taxonomy && h('div', { className: 'taxonomy-info' },
            h('strong', null, 'Category: '),
            taxonomy.name
          )
        ),
        
        taxonomy && h('section', { className: 'lab-section principles-section' },
          h('h4', null, 'Key Principles'),
          h('ul', { className: 'principles-list' },
            taxonomy.keyPrinciples.map((principle, i) =>
              h('li', { key: i, className: 'principle-item' }, principle)
            )
          )
        ),
        
        relatedTasks.length > 0 && h('section', { className: 'lab-section exercises-section' },
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
        
        h('section', { className: 'lab-section reflection-section' },
          h('h4', null, 'Self-Assessment'),
          h('div', { className: 'reflection-prompts' },
            REFLECTION_PROMPTS.bieler.map((prompt, i) =>
              h('div', { key: i, className: 'reflection-card' },
                h('p', null, prompt.question),
                h('div', { className: 'reflection-options' },
                  prompt.options.map((option, j) =>
                    h('button', {
                      key: j,
                      className: 'btn-reflection',
                      onClick: () => {
                        trackEvent('bieler', 'reflection_response', {
                          term: currentTerm.term,
                          prompt: prompt.question,
                          response: option
                        });
                        showToast('Reflection recorded!', 'success');
                      }
                    }, option)
                  )
                )
              )
            )
          )
        )
      )
    );
  }, [currentTerm, mode]);

  // Main render
  return h('div', { className: 'bieler-component' },
    // Header with mode selector
    h('header', { className: 'bieler-header' },
      h('button', { 
        className: 'btn-back', 
        onClick: () => navigate('menu'),
        'aria-label': 'Back to menu'
      }, '← Back'),
      
      h('div', { className: 'header-center' },
        h('h2', { className: 'component-title' }, '🎻 Bieler Technique'),
        h('div', { className: 'difficulty-indicator', 'data-level': level },
          `${difficultyInfo.label} (Level ${level})`
        )
      ),
      
      h('div', { className: 'header-stats' },
        h('div', { className: 'stat-badge streak-badge' },
          h('span', { className: 'stat-value' }, streak),
          h('span', { className: 'stat-label' }, 'streak')
        )
      )
    ),

    // Mode selector
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

    // Main content
    h('div', { className: 'mode-content' },
      mode === 'vocabulary' ? renderVocabularyMode() :
      mode === 'scenario' ? renderScenariosMode() :
      renderLabMode()
    ),

    // Mastery overlay
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
