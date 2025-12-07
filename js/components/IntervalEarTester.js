// ======================================
// INTERVAL EAR TESTER v2.1.1 - Advanced AI Adaptive Ear Training
// Audio-First + SM-2 + ML Patterns + Confusion Detection + Full Engine Integration
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef, useMemo } = React;
import { INTERVALS, XP_VALUES } from '../config/constants.js';
import { 
  MUSIC, 
  getRandom, 
  shuffle, 
  accuracy, 
  mean, 
  standardDeviation,
  calculateTrend,
  analyzeLearningCurve,
  clamp
} from '../utils/helpers.js';
import { getDifficulty, recordPerformance, adjustDifficulty } from '../engines/difficultyAdapter.js';
import { updateItem, getDueItems, ITEM_TYPES } from '../engines/spacedRepetition.js';
import { addXP, recordAnswer, updateStreak } from '../engines/gamification.js';
import { keyboard, a11y } from '../utils/keyboard.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { getCoachInsights } from '../engines/coachEngine.js';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';

// ======================================
// CONFIGURATION
// ======================================
const CONFIG = {
  MIN_QUESTIONS_FOR_ADAPT: 5,
  AUTO_ADVANCE_DELAY: 1800,
  AUTO_ADVANCE_DELAY_WRONG: 2500,
  MAX_PLAYS_BEFORE_PENALTY: 3,
  SPEED_BONUS_MS: 5000,
  PERFECT_STREAK_THRESHOLD: 10,
  CONFUSION_THRESHOLD: 3, // Same wrong answer 3x = confusion pattern
  MASTERY_THRESHOLD: 90,
  VIOLIN_RANGE_LOW: 55, // G3
  VIOLIN_RANGE_HIGH: 88, // E5
};

// ======================================
// MAIN COMPONENT
// ======================================
export default function IntervalEarTester({ onBack, showToast, refreshStats, audioEngine }) {
  // ======================================
  // STATE MANAGEMENT
  // ======================================
  const [mode, setMode] = useState('melodic'); // melodic, harmonic, ascending, descending
  const [currentInterval, setCurrentInterval] = useState(null);
  const [baseMidi, setBaseMidi] = useState(60);
  const [userAnswer, setUserAnswer] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  
  // Performance tracking
  const [stats, setStats] = useState({ 
    correct: 0, 
    total: 0, 
    streak: 0,
    longestStreak: 0,
    perfectStreak: 0,
    avgResponseTime: 0
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [sessionStartTime] = useState(Date.now());
  
  // Advanced features
  const [recentPerformance, setRecentPerformance] = useState([]);
  const [confusionPatterns, setConfusionPatterns] = useState({});
  const [masteredIntervals, setMasteredIntervals] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [visualFeedback, setVisualFeedback] = useState(true);

  // Refs
  const questionHistory = useRef([]);
  const performanceLog = useRef([]);
  const autoAdvanceTimer = useRef(null);

  // 🎯 AI ADAPTIVE CONFIG (Enhanced)
  const [adaptiveConfig, setAdaptiveConfig] = useState({
    difficulty: 'beginner',
    level: 1,
    intervalPool: [],
    accuracyTarget: 75,
    optionCount: 4,
    allowRepeats: true,
    prioritizeDue: true
  });

  // ======================================
  // INITIALIZATION & ADAPTIVE SETUP
  // ======================================
  useEffect(() => {
    const initAdaptive = async () => {
      try {
        // Get difficulty from adapter
        const diff = await getDifficulty('interval-ear');
        
        // Get interval pool based on level
        const pool = getIntervalPoolForLevel(diff.level);
        
        // Load mastered intervals
        const mastered = loadMasteredIntervals();
        
        // Load confusion patterns
        const confusion = loadConfusionPatterns();
        
        setAdaptiveConfig({
          difficulty: getLevelName(diff.level),
          level: diff.level,
          intervalPool: pool,
          accuracyTarget: diff.config?.accuracyTarget || 75,
          optionCount: clamp(diff.config?.optionCount || 4, 3, 6),
          allowRepeats: diff.level < 3,
          prioritizeDue: diff.level >= 2
        });
        
        setMasteredIntervals(mastered);
        setConfusionPatterns(confusion);
        
        console.log(
          `[IntervalEar] AI Init: Lv${diff.level} (${pool.length} intervals)\n` +
          `  Mastered: ${mastered.length}, Confused: ${Object.keys(confusion).length}`
        );
        
        a11y.announce(`Interval Ear Training: Level ${diff.level}, ${mode} mode, ${pool.length} intervals`);
      } catch (error) {
        console.warn('[IntervalEar] Adaptive init failed:', error);
        // Fallback to beginner pool
        setAdaptiveConfig(prev => ({
          ...prev,
          intervalPool: getIntervalPoolForLevel(1)
        }));
      }
    };
    
    initAdaptive();
  }, [mode]);

  // ======================================
  // INTERVAL POOL GENERATION (ML-Enhanced)
  // ======================================
  const getIntervalPoolForLevel = useCallback((level) => {
    const pools = {
      1: INTERVALS.filter(i => ['unison', 'P4', 'P5', 'P8'].includes(i.id)), // Perfect intervals
      2: INTERVALS.filter(i => i.difficulty === 'easy'), // + M2, m2, M3, m3
      3: INTERVALS.filter(i => ['easy', 'medium'].includes(i.difficulty)), // + M6, m6
      4: INTERVALS.filter(i => i.difficulty !== 'hard' || i.id === 'M7'), // Most common
      5: INTERVALS.filter(i => i.id !== 'A4'), // All except tritone
      6: INTERVALS // All intervals including tritone
    };
    
    const basePool = pools[Math.min(6, level)] || pools[1];
    
    // Weight intervals based on confusion and mastery
    const weightedPool = basePool.map(interval => ({
      ...interval,
      weight: calculateIntervalWeight(interval, level)
    }));
    
    return weightedPool;
  }, [masteredIntervals, confusionPatterns]);

  const calculateIntervalWeight = useCallback((interval, level) => {
    let weight = 1.0;
    
    // Reduce weight for mastered intervals (but don't exclude for spaced repetition)
    if (masteredIntervals.includes(interval.id)) {
      weight *= 0.3;
    }
    
    // Increase weight for confused intervals
    const confusionCount = confusionPatterns[interval.id] || 0;
    if (confusionCount > 0) {
      weight *= (1 + confusionCount * 0.5);
    }
    
    // Increase weight for intervals in due SRS items
    const dueItems = getDueItems?.('interval', 10) || [];
    const isDue = dueItems.some(item => 
      item.content?.interval === interval.id && 
      item.content?.mode === mode
    );
    if (isDue) {
      weight *= 2.0;
    }
    
    return weight;
  }, [masteredIntervals, confusionPatterns, mode]);

  const getLevelName = (level) => {
    if (level <= 1) return 'beginner';
    if (level <= 2) return 'elementary';
    if (level <= 3) return 'intermediate';
    if (level <= 4) return 'advanced';
    return 'expert';
  };

  // ======================================
  // QUESTION GENERATION (ML-Weighted)
  // ======================================
  const nextQuestion = useCallback(() => {
    const pool = adaptiveConfig.intervalPool;
    if (!pool || pool.length === 0) {
      console.error('[IntervalEar] No intervals in pool');
      return;
    }

    // Weighted random selection
    const totalWeight = pool.reduce((sum, i) => sum + (i.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    let selectedInterval = pool[0];
    for (const interval of pool) {
      random -= (interval.weight || 1);
      if (random <= 0) {
        selectedInterval = interval;
        break;
      }
    }

    // Random base note in violin range
    const range = CONFIG.VIOLIN_RANGE_HIGH - CONFIG.VIOLIN_RANGE_LOW - selectedInterval.semitones;
    const base = CONFIG.VIOLIN_RANGE_LOW + Math.floor(Math.random() * range);
    
    // Ensure the interval stays in range
    const topNote = base + selectedInterval.semitones;
    if (topNote > CONFIG.VIOLIN_RANGE_HIGH) {
      base -= (topNote - CONFIG.VIOLIN_RANGE_HIGH);
    }
    
    setCurrentInterval(selectedInterval);
    setBaseMidi(base);
    setUserAnswer(null);
    setShowAnswer(false);
    setShowHint(false);
    setUsedHint(false);
    setPlayCount(0);
    setQuestionStartTime(Date.now());
    
    // Log question
    questionHistory.current.push({
      interval: selectedInterval.id,
      timestamp: Date.now(),
      mode,
      level: adaptiveConfig.level
    });
    
    // Auto-play if enabled
    if (autoPlay) {
      setTimeout(() => playInterval(), 300);
    }
    
    sessionTracker.trackActivity?.('interval-ear');
    a11y.announce(`New ${mode} interval question. Level ${adaptiveConfig.level}.`);
  }, [mode, adaptiveConfig, autoPlay]);

  // ======================================
  // AUDIO PLAYBACK (Enhanced)
  // ======================================
  const playInterval = useCallback(async () => {
    if (isPlaying || !currentInterval || !audioEngine) return;
    
    setIsPlaying(true);
    setPlayCount(prev => prev + 1);
    
    const freq1 = MUSIC.midiToFreq(baseMidi);
    const freq2 = MUSIC.midiToFreq(baseMidi + currentInterval.semitones);
    
    try {
      // Different playback modes
      const playbackOptions = {
        melodic: () => audioEngine.playInterval(freq1, freq2, false, 1.5),
        harmonic: () => audioEngine.playInterval(freq1, freq2, true, 2.0),
        ascending: () => audioEngine.playInterval(freq1, freq2, false, 1.5, 'ascending'),
        descending: () => audioEngine.playInterval(freq2, freq1, false, 1.5, 'descending')
      };
      
      const playFn = playbackOptions[mode] || playbackOptions.melodic;
      
      await playFn();
      
      setIsPlaying(false);
      a11y.announce(`Interval played. Play count: ${playCount + 1}`);
      
    } catch (error) {
      console.error('[IntervalEar] Audio playback failed:', error);
      setIsPlaying(false);
      showToast?.('Audio playback failed', 'error');
    }
  }, [isPlaying, currentInterval, baseMidi, mode, playCount, audioEngine]);

  // ======================================
  // ANSWER CHECKING (ML-Enhanced)
  // ======================================
  const checkAnswer = useCallback(async (intervalId) => {
    if (showAnswer || userAnswer) return;
    
    const isCorrect = intervalId === currentInterval.id;
    const responseTime = Date.now() - questionStartTime;
    const plays = playCount;
    
    setUserAnswer(intervalId);
    setShowAnswer(true);
    
    // Calculate XP with bonuses/penalties
    let xp = XP_VALUES.CORRECT_ANSWER || 10;
    
    if (isCorrect) {
      // Streak bonus
      const newStreak = stats.streak + 1;
      if (newStreak >= CONFIG.PERFECT_STREAK_THRESHOLD) {
        xp += Math.floor(newStreak * 0.5);
      }
      
      // Speed bonus
      if (responseTime < CONFIG.SPEED_BONUS_MS) {
        xp += Math.ceil(xp * 0.3);
      }
      
      // First-try bonus (no replays)
      if (plays === 1) {
        xp += Math.ceil(xp * 0.2);
      }
      
      // Difficulty bonus
      xp += adaptiveConfig.level * 2;
      
      // Hint penalty
      if (usedHint) {
        xp = Math.floor(xp * 0.5);
      }
    } else {
      xp = Math.floor(xp * 0.3); // Partial credit
    }

    // Update stats
    const newStreak = isCorrect ? stats.streak + 1 : 0;
    const newPerfectStreak = isCorrect && !usedHint && plays === 1 
      ? stats.perfectStreak + 1 
      : 0;
    
    setStats(prev => {
      const newTotal = prev.total + 1;
      const newCorrect = prev.correct + (isCorrect ? 1 : 0);
      const newAvgTime = Math.round(
        (prev.avgResponseTime * prev.total + responseTime) / newTotal
      );
      
      return {
        correct: newCorrect,
        total: newTotal,
        streak: newStreak,
        longestStreak: Math.max(prev.longestStreak, newStreak),
        perfectStreak: newPerfectStreak,
        avgResponseTime: newAvgTime
      };
    });

    // Track performance
    const performanceData = {
      correct: isCorrect,
      interval: currentInterval.id,
      responseTime,
      plays,
      usedHint,
      mode,
      level: adaptiveConfig.level,
      timestamp: Date.now()
    };
    
    performanceLog.current.push(performanceData);
    setRecentPerformance(prev => [...prev, performanceData].slice(-20));

    // 🎯 SM-2 INTEGRATION (Enhanced)
    const quality = isCorrect 
      ? (usedHint ? 4 : plays === 1 ? 5 : 4)
      : (plays > CONFIG.MAX_PLAYS_BEFORE_PENALTY ? 1 : 2);
    
    await updateItem(
      `interval_${currentInterval.id}_${mode}`,
      quality,
      responseTime,
      {
        type: ITEM_TYPES.INTERVAL,
        interval: currentInterval.id,
        mode,
        semitones: currentInterval.semitones,
        plays,
        usedHint,
        level: adaptiveConfig.level
      }
    );

    // 🎯 GAMIFICATION
    addXP(xp, `${mode} interval`);
    recordAnswer('interval-ear', isCorrect, responseTime, {
      mode,
      interval: currentInterval.id,
      plays,
      level: adaptiveConfig.level,
      hint: usedHint
    });
    updateStreak?.();

    // 🧠 CONFUSION PATTERN DETECTION
    if (!isCorrect) {
      detectAndRecordConfusion(currentInterval.id, intervalId);
    } else {
      checkForMastery(currentInterval.id);
    }

    // 🎯 DIFFICULTY ADAPTER (Every 5 questions)
    if (stats.total > 0 && stats.total % CONFIG.MIN_QUESTIONS_FOR_ADAPT === 0) {
      const recentAccuracy = accuracy(
        recentPerformance.slice(-CONFIG.MIN_QUESTIONS_FOR_ADAPT).filter(p => p.correct).length,
        CONFIG.MIN_QUESTIONS_FOR_ADAPT
      );
      
      await adjustDifficulty('interval-ear', recentAccuracy, stats.avgResponseTime / 1000);
      
      // Reload adaptive config
      const newDiff = await getDifficulty('interval-ear');
      if (newDiff.level !== adaptiveConfig.level) {
        setAdaptiveConfig(prev => ({
          ...prev,
          level: newDiff.level,
          difficulty: getLevelName(newDiff.level),
          intervalPool: getIntervalPoolForLevel(newDiff.level)
        }));
        
        showToast?.(
          `🎯 Level ${newDiff.level > adaptiveConfig.level ? 'up' : 'down'}: ${getLevelName(newDiff.level)}!`,
          newDiff.level > adaptiveConfig.level ? 'success' : 'info'
        );
      }
    }

    // Visual/audio feedback
    if (visualFeedback) {
      audioEngine?.playFeedback?.(isCorrect);
    }
    
    if (isCorrect) {
      const streakEmoji = newStreak >= 10 ? '🌟' : newStreak >= 5 ? '🔥' : newStreak >= 3 ? '⚡' : '';
      showToast?.(
        `✅ ${currentInterval.name}! +${xp} XP ${streakEmoji}${newStreak > 2 ? ` ${newStreak}` : ''}`,
        'success'
      );
      a11y.announce(`Correct! ${currentInterval.name}. Earned ${xp} XP. Streak: ${newStreak}`);
    } else {
      showToast?.(
        `❌ ${currentInterval.name} (${currentInterval.semitones} semitones)`,
        'error'
      );
      a11y.announce(`Incorrect. The answer was ${currentInterval.name}, ${currentInterval.semitones} semitones`);
    }

    // Auto-advance
    const delay = isCorrect 
      ? CONFIG.AUTO_ADVANCE_DELAY 
      : CONFIG.AUTO_ADVANCE_DELAY_WRONG;
    
    autoAdvanceTimer.current = setTimeout(() => {
      nextQuestion();
    }, delay);

  }, [
    currentInterval, 
    showAnswer, 
    userAnswer, 
    questionStartTime, 
    playCount,
    usedHint,
    mode, 
    stats, 
    adaptiveConfig,
    recentPerformance,
    audioEngine,
    visualFeedback
  ]);

  // ======================================
  // CONFUSION PATTERN DETECTION (ML)
  // ======================================
  const detectAndRecordConfusion = useCallback((correctId, wrongId) => {
    setConfusionPatterns(prev => {
      const key = `${correctId}_${wrongId}`;
      const count = (prev[key] || 0) + 1;
      
      const updated = { ...prev, [key]: count };
      
      // Save to storage
      saveConfusionPatterns(updated);
      
      // Alert if threshold reached
      if (count === CONFIG.CONFUSION_THRESHOLD) {
        const correct = INTERVALS.find(i => i.id === correctId);
        const wrong = INTERVALS.find(i => i.id === wrongId);
        
        showToast?.(
          `💡 Pattern detected: Confused ${correct?.name} with ${wrong?.name} ${count}x`,
          'warning'
        );
        
        console.log(`[IntervalEar] Confusion: ${correct?.name} → ${wrong?.name} (${count}x)`);
      }
      
      return updated;
    });
  }, []);

  const checkForMastery = useCallback((intervalId) => {
    // Check if interval should be marked as mastered
    const recentAttempts = performanceLog.current
      .filter(p => p.interval === intervalId && p.mode === mode)
      .slice(-10);
    
    if (recentAttempts.length >= 10) {
      const correctCount = recentAttempts.filter(a => a.correct).length;
      const avgTime = mean(recentAttempts.map(a => a.responseTime));
      
      if (correctCount >= 9 && avgTime < 4000) {
        if (!masteredIntervals.includes(intervalId)) {
          setMasteredIntervals(prev => {
            const updated = [...prev, intervalId];
            saveMasteredIntervals(updated);
            
            const interval = INTERVALS.find(i => i.id === intervalId);
            showToast?.(
              `🌟 Mastered: ${interval?.name} (${mode})!`,
              'success'
            );
            
            return updated;
          });
        }
      }
    }
  }, [mode, masteredIntervals]);

  // ======================================
  // HINT SYSTEM
  // ======================================
  const toggleHint = useCallback(() => {
    if (showAnswer) return;
    
    setShowHint(prev => !prev);
    setUsedHint(true);
    
    showToast?.('💡 Hint shown (50% XP penalty)', 'info');
    a11y.announce(`Hint: ${currentInterval?.semitones} semitones, ${currentInterval?.quality}`);
  }, [showAnswer, currentInterval]);

  // ======================================
  // MODE CHANGES
  // ======================================
  const handleModeChange = useCallback((newMode) => {
    if (newMode === mode) return;
    
    // Clear current question
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }
    
    setMode(newMode);
    setShowAnswer(false);
    setUserAnswer(null);
    
    a11y.announce(`Mode changed to ${newMode}`);
  }, [mode]);

  // ======================================
  // KEYBOARD SHORTCUTS
  // ======================================
  useEffect(() => {
    const answerPool = shuffle([...adaptiveConfig.intervalPool]).slice(0, adaptiveConfig.optionCount);
    
    keyboard.register('space', () => !showAnswer && playInterval(), 'Play interval');
    keyboard.register('h', toggleHint, 'Show hint');
    keyboard.register('n', () => showAnswer && nextQuestion(), 'Next question');
    
    // Number keys for answers
    for (let i = 1; i <= 6; i++) {
      keyboard.register(i.toString(), () => {
        if (!showAnswer && answerPool[i - 1]) {
          checkAnswer(answerPool[i - 1].id);
        }
      }, `Select answer ${i}`);
    }
    
    // Mode switching
    keyboard.register('m', () => {
      const modes = ['melodic', 'harmonic', 'ascending', 'descending'];
      const currentIndex = modes.indexOf(mode);
      handleModeChange(modes[(currentIndex + 1) % modes.length]);
    }, 'Toggle mode');
    
    keyboard.register('s', () => setShowStats(prev => !prev), 'Toggle stats');
    
    return () => {
      keyboard.unregister('space', 'h', 'n', 'm', 's', '1', '2', '3', '4', '5', '6');
    };
  }, [playInterval, checkAnswer, nextQuestion, toggleHint, showAnswer, adaptiveConfig, mode]);

  // ======================================
  // SESSION ANALYTICS
  // ======================================
  useEffect(() => {
    if (stats.total >= 10) {
      const acc = accuracy(stats.correct, stats.total);
      const avgTime = stats.avgResponseTime / 1000;
      
      recordPerformance('interval-ear', acc, avgTime, stats.correct, {
        mode,
        level: adaptiveConfig.level,
        intervalPool: adaptiveConfig.intervalPool.length,
        streak: stats.streak,
        longestStreak: stats.longestStreak
      });
      
      refreshStats?.();
    }
  }, [stats.total]);

  // Initialize first question
  useEffect(() => {
    if (adaptiveConfig.intervalPool.length > 0) {
      nextQuestion();
    }
  }, [adaptiveConfig.intervalPool.length, mode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  // ======================================
  // COMPUTED VALUES
  // ======================================
  const answerOptions = useMemo(() => {
    if (!currentInterval) return [];
    
    const pool = adaptiveConfig.intervalPool.filter(i => i.id !== currentInterval.id);
    const shuffled = shuffle(pool);
    const distractors = shuffled.slice(0, adaptiveConfig.optionCount - 1);
    
    return shuffle([currentInterval, ...distractors]);
  }, [currentInterval, adaptiveConfig.intervalPool, adaptiveConfig.optionCount]);

  const sessionAccuracy = useMemo(() => 
    stats.total > 0 ? accuracy(stats.correct, stats.total) : 0,
    [stats]
  );

  const sessionGrade = useMemo(() => {
    if (sessionAccuracy >= 95) return 'S';
    if (sessionAccuracy >= 90) return 'A';
    if (sessionAccuracy >= 80) return 'B';
    if (sessionAccuracy >= 70) return 'C';
    return 'D';
  }, [sessionAccuracy]);

  const learningCurve = useMemo(() => {
    if (recentPerformance.length < 5) return null;
    return analyzeLearningCurve(recentPerformance.map(p => ({
      accuracy: p.correct ? 100 : 0,
      timestamp: p.timestamp
    })));
  }, [recentPerformance]);

  const sessionDuration = useMemo(() => 
    Math.floor((Date.now() - sessionStartTime) / 1000),
    [sessionStartTime, stats.total] // Re-compute on stats change
  );

  // ======================================
  // RENDER
  // ======================================
  return h('div', { 
    className: 'module-container ear-trainer interval-ear',
    'data-module': 'interval-ear',
    role: 'main' 
  },
    // Header
    h('header', { className: 'module-header elevated' },
      h('button', { 
        className: 'btn-back', 
        onClick: onBack,
        'aria-label': 'Go back to main menu'
      }, '← Back'),
      
      h('h1', null, '👂 Interval Ear Training'),
      
      h('div', { className: 'header-badges' },
        h('div', { 
          className: `difficulty-badge level-${adaptiveConfig.level}`,
          'aria-label': `Level ${adaptiveConfig.level}, ${adaptiveConfig.difficulty}`
        },
          `Lv${adaptiveConfig.level} • ${adaptiveConfig.difficulty}`
        ),
        masteredIntervals.length > 0 && h('div', { className: 'mastery-badge' },
          `🌟 ${masteredIntervals.length} mastered`
        )
      )
    ),

    // Live Stats Bar
    h('div', { className: 'stats-live', 'aria-live': 'polite' },
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🎯'),
        h('div', { className: 'stat-content' },
          h('div', { className: `stat-value grade-${sessionGrade.toLowerCase()}` }, 
            `${stats.correct}/${stats.total}`
          ),
          h('small', null, `${sessionAccuracy}% (${sessionGrade})`)
        )
      ),
      
      h('div', { className: 'stat-card streak' },
        h('div', { className: 'stat-icon' }, 
          stats.streak >= 10 ? '🌟' : stats.streak >= 5 ? '🔥' : '⚡'
        ),
        h('div', { className: 'stat-content' },
          h('div', { className: 'stat-value' }, stats.streak),
          h('small', null, 'streak')
        )
      ),
      
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '⏱️'),
        h('div', { className: 'stat-content' },
          h('div', { className: 'stat-value' }, 
            `${Math.floor(sessionDuration / 60)}:${String(sessionDuration % 60).padStart(2, '0')}`
          ),
          h('small', null, 'time')
        )
      ),
      
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, playCount > CONFIG.MAX_PLAYS_BEFORE_PENALTY ? '🔊' : '🔉'),
        h('div', { className: 'stat-content' },
          h('div', { className: 'stat-value' }, playCount),
          h('small', null, 'plays')
        )
      )
    ),

    // Learning Progress Indicator
    learningCurve && h('div', { className: 'learning-progress' },
      h('div', { className: 'progress-label' },
        h('span', null, `Learning stage: ${learningCurve.stage}`),
        learningCurve.velocity > 0 && h('span', { className: 'trend-up' }, 
          `↗ +${learningCurve.velocity.toFixed(1)}%`
        )
      ),
      learningCurve.prediction && h('small', null,
        `${learningCurve.prediction.sessionsToMastery} sessions to mastery`
      )
    ),

    // Mode Selector
    h('div', { 
      className: 'mode-selector',
      role: 'radiogroup',
      'aria-label': 'Interval playback mode'
    },
      [
        { id: 'melodic', icon: '🎵', label: 'Melodic' },
        { id: 'harmonic', icon: '🎹', label: 'Harmonic' },
        { id: 'ascending', icon: '⬆️', label: 'Ascending' },
        { id: 'descending', icon: '⬇️', label: 'Descending' }
      ].map(m =>
        h('button', {
          key: m.id,
          className: `mode-btn ${mode === m.id ? 'active' : ''}`,
          role: 'radio',
          'aria-checked': mode === m.id,
          onClick: () => handleModeChange(m.id),
          title: m.label
        },
          h('span', { className: 'mode-icon' }, m.icon),
          h('span', { className: 'mode-label' }, m.label)
        )
      )
    ),

    // Main Playback Section
    h('section', { 
      className: 'playback-section',
      'aria-live': 'assertive',
      'aria-atomic': true
    },
      h('div', { className: 'playback-card elevated' },
        h('h2', { className: 'instruction' },
          `Listen and identify the interval`
        ),
        
        currentInterval && h('div', { className: 'interval-context' },
          h('small', null, 
            `${MUSIC.midiToNote(baseMidi)} → ${MUSIC.midiToNote(baseMidi + currentInterval.semitones)}`
          )
        ),
        
        // Main play button
        h('button', {
          className: `btn-play-main ${isPlaying ? 'playing pulse' : ''}`,
          onClick: playInterval,
          disabled: isPlaying || !audioEngine || !currentInterval,
          'aria-label': `Play ${mode} interval`
        },
          h('div', { className: 'play-icon' }, 
            isPlaying ? '🔊' : '▶️'
          ),
          h('div', { className: 'play-text' },
            h('span', { className: 'play-label' }, 
              isPlaying ? 'PLAYING...' : 'PLAY INTERVAL'
            ),
            h('small', null, 
              playCount > 0 
                ? `Played ${playCount}x${playCount > CONFIG.MAX_PLAYS_BEFORE_PENALTY ? ' (penalty)' : ''}`
                : 'Press SPACE or click'
            )
          )
        ),
        
        // Hint button
        h('button', {
          className: `btn-hint ${showHint ? 'active' : ''}`,
          onClick: toggleHint,
          disabled: showAnswer || usedHint,
          title: 'Show hint (50% XP penalty)'
        },
          showHint ? '💡 Hint shown' : '💡 Need a hint?'
        ),
        
        // Hint display
        showHint && currentInterval && h('div', { className: 'hint-box' },
          h('p', null,
            h('strong', null, 'Hint:'),
            ` ${currentInterval.semitones} semitones • ${currentInterval.quality}`,
            currentInterval.example && ` • Example: ${currentInterval.example}`
          )
        )
      )
    ),

    // Answer Section
    h('section', { className: 'answer-section' },
      !showAnswer ?
        // Answer grid
        h('div', { 
          className: 'answer-grid ear-grid',
          role: 'radiogroup',
          'aria-label': 'Answer options'
        },
          answerOptions.map((interval, i) =>
            h('button', {
              key: interval.id,
              className: `answer-btn interval-btn ${
                userAnswer === interval.id ? 'selected' : ''
              } ${
                masteredIntervals.includes(interval.id) ? 'mastered' : ''
              }`,
              onClick: () => checkAnswer(interval.id),
              disabled: showAnswer,
              role: 'radio',
              'aria-checked': userAnswer === interval.id,
              'aria-label': `${interval.name}, ${interval.semitones} semitones, ${interval.quality}`,
              style: { '--animation-delay': `${i * 50}ms` }
            },
              h('div', { className: 'interval-header' },
                h('span', { className: 'interval-name' }, interval.name),
                masteredIntervals.includes(interval.id) && 
                  h('span', { className: 'mastery-icon', title: 'Mastered' }, '⭐')
              ),
              h('div', { className: 'interval-meta' },
                h('small', null, `${interval.semitones}st • ${interval.quality}`)
              ),
              h('kbd', { className: 'shortcut-key' }, i + 1)
            )
          )
        )
      :
        // Feedback card
        h('div', {
          className: `feedback-card large ${
            userAnswer === currentInterval.id ? 'success' : 'error'
          }`,
          role: 'status',
          'aria-live': 'assertive'
        },
          h('div', { className: 'feedback-header' },
            h('div', { className: 'feedback-icon' },
              userAnswer === currentInterval.id ? '✅' : '❌'
            ),
            h('h3', null, currentInterval.name)
          ),
          
          h('div', { className: 'interval-details' },
            h('div', { className: 'detail-item' },
              h('span', { className: 'detail-label' }, 'Semitones:'),
              h('span', { className: 'detail-value' }, currentInterval.semitones)
            ),
            h('div', { className: 'detail-item' },
              h('span', { className: 'detail-label' }, 'Quality:'),
              h('span', { className: 'detail-value' }, currentInterval.quality)
            ),
            currentInterval.example && h('div', { className: 'detail-item' },
              h('span', { className: 'detail-label' }, 'Example:'),
              h('span', { className: 'detail-value' }, currentInterval.example)
            )
          ),
          
          userAnswer !== currentInterval.id && h('div', { className: 'confusion-note' },
            h('p', null, 
              `You selected: ${INTERVALS.find(i => i.id === userAnswer)?.name || 'Unknown'}`
            )
          ),
          
          h('div', { className: 'feedback-actions' },
            h('button', {
              className: 'btn btn-secondary',
              onClick: playInterval,
              disabled: isPlaying
            },
              isPlaying ? '🔊 Playing...' : '🔄 Replay'
            ),
            h('button', {
              className: 'btn btn-primary',
              onClick: nextQuestion
            }, '→ Next Question')
          )
        )
    ),

    // Stats Panel (Toggleable)
    showStats && h('div', { className: 'stats-panel card' },
      h('div', { className: 'panel-header' },
        h('h3', null, '📊 Session Statistics'),
        h('button', { 
          className: 'btn-close',
          onClick: () => setShowStats(false),
          'aria-label': 'Close statistics'
        }, '✕')
      ),
      
      h('div', { className: 'stats-grid' },
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Accuracy'),
          h('div', { className: 'stat-value' }, `${sessionAccuracy}%`)
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Avg Response'),
          h('div', { className: 'stat-value' }, 
            `${(stats.avgResponseTime / 1000).toFixed(1)}s`
          )
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Longest Streak'),
          h('div', { className: 'stat-value' }, stats.longestStreak)
        ),
        h('div', { className: 'stat-item' },
          h('div', { className: 'stat-label' }, 'Perfect Streak'),
          h('div', { className: 'stat-value' }, stats.perfectStreak)
        )
      ),
      
      Object.keys(confusionPatterns).length > 0 && h('div', { className: 'confusion-section' },
        h('h4', null, '💡 Confusion Patterns'),
        h('ul', null,
          Object.entries(confusionPatterns)
            .filter(([_, count]) => count >= 2)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([pattern, count]) => {
              const [correctId, wrongId] = pattern.split('_');
              const correct = INTERVALS.find(i => i.id === correctId);
              const wrong = INTERVALS.find(i => i.id === wrongId);
              
              return h('li', { key: pattern },
                `${correct?.name || '?'} confused with ${wrong?.name || '?'} (${count}x)`
              );
            })
        )
      )
    ),

    // Controls Bar
    h('div', { className: 'controls-bar' },
      h('div', { className: 'control-group' },
        h('label', { className: 'control-label' },
          h('input', {
            type: 'checkbox',
            checked: autoPlay,
            onChange: (e) => setAutoPlay(e.target.checked)
          }),
          h('span', null, 'Auto-play')
        ),
        h('label', { className: 'control-label' },
          h('input', {
            type: 'checkbox',
            checked: visualFeedback,
            onChange: (e) => setVisualFeedback(e.target.checked)
          }),
          h('span', null, 'Visual feedback')
        )
      ),
      
      h('button', {
        className: 'btn btn-sm btn-outline',
        onClick: () => setShowStats(prev => !prev)
      }, showStats ? 'Hide Stats' : 'Show Stats')
    ),

    // Keyboard Hints
    h('div', { className: 'keyboard-hints ear-hints' },
      h('div', { className: 'hint-group' },
        h('kbd', null, 'SPACE'),
        h('small', null, 'Play')
      ),
      h('div', { className: 'hint-group' },
        h('kbd', null, '1-6'),
        h('small', null, 'Answer')
      ),
      h('div', { className: 'hint-group' },
        h('kbd', null, 'H'),
        h('small', null, 'Hint')
      ),
      h('div', { className: 'hint-group' },
        h('kbd', null, 'M'),
        h('small', null, 'Mode')
      ),
      h('div', { className: 'hint-group' },
        h('kbd', null, 'S'),
        h('small', null, 'Stats')
      )
    )
  );
}

// ======================================
// HELPER FUNCTIONS (Storage)
// ======================================
function loadMasteredIntervals() {
  const data = loadJSON(STORAGE_KEYS.MASTERY, {});
  return data.intervalEar || [];
}

function saveMasteredIntervals(intervals) {
  const data = loadJSON(STORAGE_KEYS.MASTERY, {});
  data.intervalEar = intervals;
  saveJSON(STORAGE_KEYS.MASTERY, data);
}

function loadConfusionPatterns() {
  const data = loadJSON(STORAGE_KEYS.CONFUSION_PATTERNS, {});
  return data.intervalEar || {};
}

function saveConfusionPatterns(patterns) {
  const data = loadJSON(STORAGE_KEYS.CONFUSION_PATTERNS, {});
  data.intervalEar = patterns;
  saveJSON(STORAGE_KEYS.CONFUSION_PATTERNS, data);
}
