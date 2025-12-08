// ======================================
// INTERVALS v3.0 - ML-Adaptive 8-Engine Mastery
// Confusion Detection + Weighted Pool + Live Mastery
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef } = React;

import { INTERVALS, XPVALUES, CONFIG } from '../config/constants.js';
import { shuffle, getRandom, noteToMidi, midiToFreq } from '../utils/helpers.js';
import { audioEngine } from '../engines/audioEngine.js';
import { recordAnswer, addXP, awardPracticeXP } from '../engines/gamification.js';
import { updateItem, ITEM_TYPES, getDueItems } from '../engines/spacedRepetition.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { analyzePerformance, detectConfusion, checkMastery } from '../engines/analytics.js';
import { getAdaptiveConfig } from '../engines/difficultyAdapter.js';
import { loadJSON, STORAGE_KEYS } from '../config/storage.js';

export default function Intervals({ onBack, refreshStats, xp, streak, level }) {
  const [mode, setMode] = useState('visual');
  const [adaptiveConfig, setAdaptiveConfig] = useState({ level: 1, difficulty: 'easy', intervalPool: [] });
  const [currentInterval, setCurrentInterval] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0, perfectStreak: 0, avgResponseTime: 0 });
  const [baseNote, setBaseNote] = useState('C4');
  const [responseStart, setResponseStart] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [confusionPatterns, setConfusionPatterns] = useState({});
  const [masteredIntervals, setMasteredIntervals] = useState([]);
  const [recentPerformance, setRecentPerformance] = useState([]);
  const performanceLog = useRef([]);
  const autoAdvanceTimer = useRef(null);

  // ML-Weighted Interval Pool (from IntervalEarTester pattern)[file:3]
  const getIntervalPoolForLevel = useCallback((level) => {
    const pools = {
      1: INTERVALS.filter(i => ['unison', 'P4', 'P5', 'P8'].includes(i.id)), // Perfects
      2: INTERVALS.filter(i => i.difficulty === 'easy'),
      3: INTERVALS.filter(i => ['easy', 'medium'].includes(i.difficulty)),
      4: INTERVALS.filter(i => i.difficulty !== 'hard' && i.id !== 'A4'),
      5: INTERVALS.filter(i => i.id !== 'A4'), // All except tritone
      6: INTERVALS // Full pool
    };
    return pools[Math.min(6, level)] || pools[1];
  }, []);

  const calculateIntervalWeight = useCallback((interval, level) => {
    let weight = 1.0;
    
    // Reduce mastered intervals (but don't exclude for spaced repetition)
    if (masteredIntervals.includes(interval.id)) weight *= 0.3;
    
    // Boost confusion patterns
    const confusionCount = confusionPatterns[`${currentInterval?.id}-${interval.id}`] || 0;
    if (confusionCount > 0) weight *= (1 + confusionCount * 0.5);
    
    // Boost due SRS items
    const dueItems = getDueItems?.('intervals', 10);
    const isDue = dueItems?.some(item => 
      item.content?.interval === interval.id
    );
    if (isDue) weight *= 2.0;
    
    return weight;
  }, [masteredIntervals, confusionPatterns, currentInterval]);

  // Load adaptive config + mastered intervals
  const refreshAdaptiveConfig = useCallback(async () => {
    const config = await getAdaptiveConfig('intervals');
    const mastered = loadJSON(STORAGE_KEYS.MASTERY_INTERVALS, []);
    const recentPerf = performanceLog.current.slice(-20);
    
    const pool = getIntervalPoolForLevel(config.level).map(interval => ({
      ...interval,
      weight: calculateIntervalWeight(interval, config.level)
    })).filter(i => i.weight > 0);

    setAdaptiveConfig({
      ...config,
      intervalPool: pool
    });
    setMasteredIntervals(mastered);
    setRecentPerformance(recentPerf);
  }, [getIntervalPoolForLevel, calculateIntervalWeight]);

  // 🎯 ML-Weighted Next Question
  const nextQuestion = useCallback(() => {
    if (!adaptiveConfig.intervalPool?.length) return;
    
    // Weighted random selection[file:3]
    const totalWeight = adaptiveConfig.intervalPool.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedInterval = adaptiveConfig.intervalPool[0];
    
    for (const interval of adaptiveConfig.intervalPool) {
      random -= interval.weight;
      if (random <= 0) {
        selectedInterval = interval;
        break;
      }
    }

    // Violin range base note
    const range = CONFIG.VIOLINRANGEHIGH - CONFIG.VIOLINRANGELOW - selectedInterval.semitones;
    const baseMidi = CONFIG.VIOLINRANGELOW + Math.floor(Math.random() * range);
    const baseNoteName = midiToNote(baseMidi); // Assume utility exists

    setCurrentInterval(selectedInterval);
    setBaseNote(baseNoteName);
    setUserAnswer('');
    setShowAnswer(false);
    setPlayCount(0);
    setUsedHint(false);
    setResponseStart(Date.now());

    sessionTracker.trackActivity('intervals', 'question_shown', {
      interval: selectedInterval.id,
      difficulty: adaptiveConfig.difficulty,
      mode,
      level: adaptiveConfig.level,
      weight: selectedInterval.weight
    });
  }, [adaptiveConfig, mode]);

  // 🎯 Enhanced Answer Checking (8-Engine)[file:3]
  const checkAnswer = useCallback(async (intervalId) => {
    if (showAnswer || !currentInterval) return;

    const isCorrect = intervalId === currentInterval.id;
    const responseTime = Date.now() - responseStart;
    const plays = playCount;

    setUserAnswer(intervalId);
    setShowAnswer(true);

    // XP Calculation with ML bonuses[file:3]
    let xp = XPVALUES.CORRECTANSWER + 10;
    if (isCorrect) {
      if (stats.perfectStreak >= CONFIG.PERFECTSTREAKTHRESHOLD) 
        xp = Math.floor(xp * (stats.perfectStreak * 0.5));
      if (responseTime < CONFIG.SPEEDBONUSMS) 
        xp = Math.ceil(xp * 1.3);
      if (plays === 1) xp = Math.ceil(xp * 1.2); // First-try bonus
      xp += adaptiveConfig.level * 2; // Difficulty bonus
      if (usedHint) xp = Math.floor(xp * 0.5); // Hint penalty
    } else {
      xp = Math.floor(xp * 0.3);
    }

    // Update stats
    const newStreak = isCorrect ? stats.streak + 1 : 0;
    const newPerfectStreak = isCorrect && !usedHint && plays === 1 ? stats.perfectStreak + 1 : 0;
    const newAvgTime = Math.round(
      (stats.avgResponseTime * stats.total + responseTime) / (stats.total + 1)
    );

    setStats(prev => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: newStreak,
      perfectStreak: newPerfectStreak,
      avgResponseTime: newAvgTime
    }));

    // 8-ENGINE CASCADE
    recordAnswer('intervals', isCorrect, responseTime);
    await updateItem(`intervals_${currentInterval.id}`, 
      isCorrect ? (usedHint ? 4 : plays === 1 ? 5 : 4) : 2, 
      responseTime, {
        type: ITEM_TYPES.INTERVAL,
        interval: currentInterval.id,
        mode,
        semitones: currentInterval.semitones,
        plays,
        usedHint,
        level: adaptiveConfig.level
      });

    // Confusion detection[file:3]
    if (!isCorrect) {
      detectAndRecordConfusion(currentInterval.id, intervalId);
    } else {
      checkForMastery(currentInterval.id);
    }

    // Gamification + Audio
    const finalXP = awardPracticeXP('intervals', isCorrect, {
      streak: newStreak,
      perfectStreak: newPerfectStreak,
      difficulty: adaptiveConfig.level,
      responseTime,
      plays
    });
    addXP(finalXP, `intervals_${isCorrect ? 'correct' : 'incorrect'}`);
    audioEngine.playFeedback(isCorrect);

    // Auto-advance
    const delay = isCorrect ? CONFIG.AUTOADVANCEDELAY.CORRECT : CONFIG.AUTOADVANCEDELAY.WRONG;
    autoAdvanceTimer.current = setTimeout(nextQuestion, delay);

    // Session analytics every 10 questions
    if (stats.total % 10 === 0) {
      const acc = stats.correct / stats.total;
      recordPerformance('intervals', acc, stats.avgResponseTime / 1000, stats.correct, mode, adaptiveConfig.level);
    }
  }, [currentInterval, stats, playCount, usedHint, adaptiveConfig, mode, responseStart, nextQuestion]);

  // 🎯 Enhanced Audio Playback[file:3]
  const playInterval = useCallback(async () => {
    if (!currentInterval || !baseNote) return;
    
    setPlayCount(prev => prev + 1);
    const baseMidi = noteToMidi(baseNote);
    const freq1 = midiToFreq(baseMidi);
    const freq2 = midiToFreq(baseMidi + currentInterval.semitones);
    
    const playbackOptions = {
      melodic: () => audioEngine.playInterval(freq1, freq2, false, 1.5),
      harmonic: () => audioEngine.playInterval(freq1, freq2, true, 2.0),
      ascending: () => audioEngine.playInterval(freq1, freq2, false, 1.5, 'ascending'),
      descending: () => audioEngine.playInterval(freq2, freq1, false, 1.5, 'descending')
    }[mode] || playbackOptions.melodic;
    
    await playbackOptions();
    sessionTracker.trackActivity('intervals', 'interval_played', { 
      interval: currentInterval.id, 
      plays: playCount + 1 
    });
  }, [currentInterval, baseNote, mode, playCount]);

  // Difficulty adaptation every 5 questions[file:3]
  useEffect(() => {
    if (stats.total > 0 && stats.total % 5 === 0) {
      const recentAcc = recentPerformance.slice(-5).filter(p => p.correct).length / 5;
      adjustDifficulty('intervals', recentAcc, stats.avgResponseTime);
    }
  }, [stats.total]);

  // Initialize
  useEffect(() => {
    refreshAdaptiveConfig();
  }, []);

  useEffect(() => {
    if (adaptiveConfig.intervalPool.length > 0) nextQuestion();
  }, [adaptiveConfig.intervalPool.length, mode]);

  // Cleanup
  useEffect(() => () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
  }, []);

  const answerOptions = showAnswer ? [] : shuffle(
    adaptiveConfig.intervalPool.filter(i => i.id !== currentInterval?.id).slice(0, 6)
  );
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const sessionGrade = accuracy >= 95 ? 'S' : accuracy >= 90 ? 'A' : accuracy >= 80 ? 'B' : 
                      accuracy >= 70 ? 'C' : 'D';

  return h('div', { className: 'module-container intervals-v3' },
    // Header with ML stats
    h('header', { className: 'module-header elevated' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h1', null, '🎵 Intervals'),
      h('div', { className: 'stats-live', 'aria-live': 'polite' },
        h('div', { className: 'stat-card' },
          h('div', { className: `stat-value grade-${sessionGrade.toLowerCase()}` }, 
            `${stats.correct}/${stats.total}`),
          h('small', null, `${accuracy}% ${sessionGrade}`)
        ),
        h('div', { className: 'stat-card streak' },
          h('div', { className: 'stat-value' }, 
            stats.streak > 3 ? '🔥' : '', stats.streak),
          h('small', null, 'streak')
        ),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-value' }, masteredIntervals.length),
          h('small', null, 'mastered')
        )
      )
    ),

    // ML Controls
    h('div', { className: 'control-grid' },
      h('div', { className: 'mode-toggle' },
        ['visual', 'melodic', 'harmonic', 'mixed'].map(m =>
          h('button', {
            key: m,
            className: `btn ${mode === m ? 'btn-primary' : 'btn-outline'}`,
            onClick: () => setMode(m)
          }, m.charAt(0).toUpperCase() + m.slice(1))
        )
      ),
      h('div', { className: 'mode-toggle' },
        h('div', { className: 'difficulty-badge', style: { padding: 'var(--space-sm)' }},
          `Lv ${adaptiveConfig.level} (${adaptiveConfig.difficulty})`
        )
      )
    ),

    // Enhanced Question Display
    h('div', { className: 'card elevated' },
      h('div', { className: 'question-display', style: { textAlign: 'center' } },
        h('div', { className: 'interval-context' },
          h('div', { className: 'note-name large' }, baseNote),
          h('span', { style: { fontSize: '2rem', margin: '0 1rem' } }, '→'),
          h('div', { className: 'note-name large mystery' }, '?'),
          masteredIntervals.includes(currentInterval?.id) && 
          h('span', { className: 'mastery-icon', title: 'Mastered' }, '⭐')
        ),
        (mode === 'melodic' || mode === 'harmonic' || mode === 'mixed') && 
        h('button', {
          className: 'btn btn-primary btn-lg btn-play',
          onClick: playInterval,
          style: { width: '100%', margin: 'var(--space-lg) 0' }
        }, `🔊 Play (${playCount + 1}x)`)
      ),

      !showAnswer ? h('form', { onSubmit: e => { e.preventDefault(); checkAnswer(userAnswer); } },
        mode === 'visual' ? h('input', {
          type: 'text',
          value: userAnswer,
          onChange: e => setUserAnswer(e.target.value),
          placeholder: 'Type interval (P5, m3, etc.)',
          className: 'input-large',
          autoFocus: true
        }) : h('div', { className: 'answer-grid' },
          answerOptions.map((interval, i) =>
            h('button', {
              key: interval.id,
              className: `btn ${userAnswer === interval.id ? 'btn-primary' : 'btn-outline'} 
                ${masteredIntervals.includes(interval.id) ? 'mastered' : ''}`,
              style: { flex: 1, '--animation-delay': `${i * 50}ms` },
              onClick: e => {
                e.preventDefault();
                checkAnswer(interval.id);
              }
            }, interval.name)
          )
        ),
        h('button', {
          type: 'submit',
          className: 'btn btn-primary btn-lg',
          disabled: !userAnswer.trim() || !currentInterval
        }, '✅ Check Answer')
      ) : h('div', { className: `feedback-card ${isCorrect ? 'success' : 'error'}` },
        h('h3', null, currentInterval.name),
        h('div', { className: 'interval-details' },
          h('div', null, `${currentInterval.semitones} semitones`),
          h('div', { className: 'text-muted' }, `Example: ${currentInterval.example}`)
        ),
        h('div', { style: { display: 'flex', gap: 'var(--space-sm)' } },
          h('button', { className: 'btn btn-outline', onClick: playInterval }, '🔊 Replay'),
          h('button', { className: 'btn btn-primary', onClick: nextQuestion }, '➡️ Next')
        )
      )
    ),

    // Live Confusion Patterns (if any)
    Object.keys(confusionPatterns).filter(key => confusionPatterns[key] > 2).length > 0 &&
    h('div', { className: 'card card-warning' },
      h('h4', null, '⚠️ Confusion Patterns'),
      h('ul', null,
        Object.entries(confusionPatterns)
          .filter(([_, count]) => count > 2)
          .slice(0, 3)
          .map(([pattern, count]) => {
            const [correct, wrong] = pattern.split('-');
            return h('li', null, 
              `${INTERVALS.find(i => i.id === correct)?.name || correct} 
               ↔ ${INTERVALS.find(i => i.id === wrong)?.name || wrong} (${count}x)`
            );
          })
      )
    ),

    // Quick Reference (mastery-aware)
    h('div', { className: 'card' },
      h('h3', null, 'Quick Reference'),
      h('div', { className: 'module-grid' },
        adaptiveConfig.intervalPool.slice(0, 8).map(interval =>
          h('div', { 
            key: interval.id, 
            className: `interval-ref ${masteredIntervals.includes(interval.id) ? 'mastered' : ''}`,
            style: { cursor: 'pointer' },
            onClick: () => setCurrentInterval(interval)
          },
            h('div', { className: 'interval-name' }, interval.name),
            h('div', { className: 'interval-symbol' }, interval.symbol),
            h('small', { className: 'text-muted' }, interval.example)
          )
        )
      )
    )
  );
}

// Confusion Detection (from IntervalEarTester)[file:3]
async function detectAndRecordConfusion(correctId, wrongId) {
  const key = `${correctId}-${wrongId}`;
  setConfusionPatterns(prev => {
    const count = (prev[key] || 0) + 1;
    const updated = { ...prev, [key]: count };
    saveConfusionPatterns(updated);
    if (count >= CONFIG.CONFUSIONTHRESHOLD) {
      window.VMQToast.toastHelpers.confusionDetected(
        INTERVALS.find(i => i.id === correctId)?.name,
        INTERVALS.find(i => i.id === wrongId)?.name,
        count
      );
    }
    return updated;
  });
}
