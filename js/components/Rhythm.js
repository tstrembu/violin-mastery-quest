// ======================================
// RHYTHM v3.0 - ML-Adaptive Pattern Mastery
// Syncopation Detection + Tempo Adaptation + 8-Engine
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef } = React;

import { RHYTHM_PATTERNS, XPVALUES, TIME_SIGNATURES, CONFIG } from '../config/constants.js';
import { shuffle, getRandom, formatDuration } from '../utils/helpers.js';
import { audioEngine } from '../engines/audioEngine.js';
import { recordAnswer, addXP, awardPracticeXP } from '../engines/gamification.js';
import { updateItem, ITEM_TYPES, getDueItems } from '../engines/spacedRepetition.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { analyzePerformance, detectConfusion, checkMastery } from '../engines/analytics.js';
import { getAdaptiveConfig } from '../engines/difficultyAdapter.js';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';

export default function Rhythm({ onBack, showToast }) {
  const [mode, setMode] = useState('visual');
  const [timeSig, setTimeSig] = useState('4/4');
  const [tempo, setTempo] = useState(80);
  const [adaptiveConfig, setAdaptiveConfig] = useState({ level: 1, difficulty: 'easy', patternPool: [] });
  const [currentPattern, setCurrentPattern] = useState(null);
  const [userAnswer, setUserAnswer] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0, perfectStreak: 0, avgResponseTime: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [confusionPatterns, setConfusionPatterns] = useState({});
  const [masteredPatterns, setMasteredPatterns] = useState([]);
  const metronomeRef = useRef(null);
  const performanceLog = useRef([]);
  const autoAdvanceTimer = useRef(null);

  // ML-Weighted Pattern Pool[file:3]
  const getPatternPoolForLevel = useCallback((level, timeSig) => {
    const pools = {
      1: RHYTHM_PATTERNS.filter(p => p.difficulty === 'easy' && p.timeSig === timeSig && !p.syncopated),
      2: RHYTHM_PATTERNS.filter(p => ['easy'].includes(p.difficulty) && p.timeSig === timeSig),
      3: RHYTHM_PATTERNS.filter(p => ['easy', 'medium'].includes(p.difficulty) && p.timeSig === timeSig),
      4: RHYTHM_PATTERNS.filter(p => p.timeSig === timeSig && !p.complex),
      5: RHYTHM_PATTERNS.filter(p => p.timeSig === timeSig && p.syncopated),
      6: RHYTHM_PATTERNS.filter(p => p.timeSig === timeSig)
    };
    return pools[Math.min(6, level)] || pools[1];
  }, []);

  const calculatePatternWeight = useCallback((pattern) => {
    let weight = 1.0;
    
    // Reduce mastered patterns
    if (masteredPatterns.includes(pattern.id)) weight *= 0.3;
    
    // Boost confusion patterns (eighth vs sixteenth mixups)
    const confusionCount = confusionPatterns[pattern.id] || 0;
    if (confusionCount > 0) weight *= (1 + confusionCount * 0.5);
    
    // Boost due SRS items
    const dueItems = getDueItems?.('rhythm', 10);
    const isDue = dueItems?.some(item => item.content?.pattern === pattern.id);
    if (isDue) weight *= 2.0;
    
    // Tempo adaptation - harder at faster tempos
    if (tempo > 100) weight *= 1.2;
    
    return weight;
  }, [masteredPatterns, confusionPatterns, tempo]);

  // Load adaptive config
  const refreshAdaptiveConfig = useCallback(async () => {
    const config = await getAdaptiveConfig('rhythm');
    const mastered = loadJSON(STORAGE_KEYS.MASTERY_RHYTHM, []);
    
    const pool = getPatternPoolForLevel(config.level, timeSig).map(pattern => ({
      ...pattern,
      weight: calculatePatternWeight(pattern)
    })).filter(p => p.weight > 0);

    setAdaptiveConfig({ ...config, patternPool: pool });
    setMasteredPatterns(mastered);
  }, [timeSig, getPatternPoolForLevel, calculatePatternWeight]);

  // 🎯 ML-Weighted Next Pattern
  const nextQuestion = useCallback(() => {
    if (!adaptiveConfig.patternPool?.length) return;
    
    // Weighted selection[file:3]
    const totalWeight = adaptiveConfig.patternPool.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedPattern = adaptiveConfig.patternPool[0];
    
    for (const pattern of adaptiveConfig.patternPool) {
      random -= pattern.weight;
      if (random <= 0) {
        selectedPattern = pattern;
        break;
      }
    }

    setCurrentPattern(selectedPattern);
    setUserAnswer([]);
    setShowAnswer(false);
    setPlayCount(0);
    setUsedHint(false);

    sessionTracker.trackActivity('rhythm', 'pattern_shown', {
      pattern: selectedPattern.id,
      timeSig,
      tempo,
      difficulty: adaptiveConfig.difficulty,
      weight: selectedPattern.weight
    });
  }, [adaptiveConfig, timeSig, tempo]);

  // Enhanced pattern playback with beat-perfect timing
  const playPattern = useCallback(async () => {
    if (!currentPattern || isPlaying) return;
    
    setIsPlaying(true);
    setPlayCount(prev => prev + 1);
    let beatIndex = 0;
    const beatDuration = 60000 / tempo;
    
    const playBeat = async () => {
      if (beatIndex >= currentPattern.beats.length) {
        setIsPlaying(false);
        return;
      }
      
      const beat = currentPattern.beats[beatIndex];
      const isDownbeat = beatIndex % 4 === 0;
      
      // Precise rhythm playback
      switch (beat.value) {
        case 'quarter':
          await audioEngine.playMetronomeTick(isDownbeat, 0.4);
          break;
        case 'eighth':
          await audioEngine.playMetronomeTick(isDownbeat, 0.3);
          await new Promise(r => setTimeout(r, beatDuration / 2));
          await audioEngine.playMetronomeTick(false, 0.2);
          break;
        case 'sixteenth':
          await audioEngine.playMetronomeTick(isDownbeat, 0.25);
          await new Promise(r => setTimeout(r, beatDuration / 4));
          await audioEngine.playMetronomeTick(false, 0.15);
          await new Promise(r => setTimeout(r, beatDuration / 4));
          await audioEngine.playMetronomeTick(false, 0.15);
          break;
        case 'dotted-quarter':
          await audioEngine.playMetronomeTick(isDownbeat, 0.45);
          break;
        case 'half':
          await audioEngine.playMetronomeTick(isDownbeat, 0.6);
          break;
      }
      
      beatIndex++;
      setTimeout(playBeat, beatDuration);
    };
    
    playBeat();
  }, [currentPattern, tempo, isPlaying]);

  // 🎯 Enhanced Answer Checking (8-Engine)
  const checkAnswer = useCallback(async () => {
    if (!currentPattern || userAnswer.length === 0) return;
    
    const isCorrect = userAnswer.every((answer, i) => 
      answer === currentPattern.beats[i]?.value
    );
    const responseTime = Date.now() - (window.startTime || Date.now());

    setShowAnswer(true);

    // ML XP Calculation
    let xp = XPVALUES.CORRECTANSWER + 10;
    if (isCorrect) {
      if (stats.perfectStreak >= CONFIG.PERFECTSTREAKTHRESHOLD) 
        xp *= (stats.perfectStreak * 0.5);
      if (tempo > 100) xp *= 1.3; // Tempo bonus
      if (playCount === 1) xp *= 1.2;
      if (usedHint) xp *= 0.5;
      xp += adaptiveConfig.level * 2;
    } else {
      xp *= 0.3;
      detectRhythmConfusion(currentPattern.id, userAnswer);
    }

    // Update stats
    const newStreak = isCorrect ? stats.streak + 1 : 0;
    const newPerfectStreak = isCorrect && playCount === 1 && !usedHint ? stats.perfectStreak + 1 : 0;
    
    setStats(prev => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: newStreak,
      perfectStreak: newPerfectStreak
    }));

    // 8-Engine cascade
    recordAnswer('rhythm', isCorrect, responseTime);
    await updateItem(currentPattern.id, isCorrect ? (usedHint ? 4 : 5) : 2, responseTime, {
      type: ITEM_TYPES.RHYTHM,
      pattern: currentPattern.id,
      timeSig,
      tempo,
      beats: currentPattern.beats.length
    });

    const finalXP = awardPracticeXP('rhythm', isCorrect, {
      streak: newStreak,
      tempo,
      complexity: currentPattern.syncopated ? 2 : 1
    });
    audioEngine.playFeedback(isCorrect);
    
    showToast(isCorrect ? 'Perfect rhythm!' : 'Try again!', isCorrect ? 'success' : 'error');
    
    const delay = isCorrect ? 1500 : 2500;
    autoAdvanceTimer.current = setTimeout(nextQuestion, delay);
  }, [currentPattern, userAnswer, stats, tempo, playCount, usedHint, adaptiveConfig, timeSig, nextQuestion]);

  const stopMetronome = () => {
    if (metronomeRef.current) {
      metronomeRef.current.stop();
      metronomeRef.current = null;
    }
    audioEngine.stopAll();
  };

  // Watch config changes
  useEffect(() => {
    refreshAdaptiveConfig();
  }, [timeSig, tempo]);

  useEffect(() => {
    if (adaptiveConfig.patternPool.length > 0) nextQuestion();
  }, [adaptiveConfig.patternPool.length, mode]);

  useEffect(() => () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    stopMetronome();
  }, []);

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const sessionGrade = accuracy >= 95 ? 'S' : accuracy >= 90 ? 'A' : accuracy >= 80 ? 'B' : 
                      accuracy >= 70 ? 'C' : 'D';

  return h('div', { className: 'module-container rhythm-v3' },
    // ML Header
    h('header', { className: 'module-header elevated' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h2', null, '🥁 Rhythm'),
      h('div', { className: 'stats-live', 'aria-live': 'polite' },
        h('div', { className: 'stat-card' },
          h('div', { className: `stat-value grade-${sessionGrade.toLowerCase()}` }, 
            `${stats.correct}/${stats.total}`),
          h('small', null, `${accuracy}% ${sessionGrade}`)
        ),
        h('div', { className: 'stat-card streak' },
          h('div', { className: 'stat-value' }, stats.streak > 3 ? '🔥' : '', stats.streak),
          h('small', null, 'streak')
        ),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-value' }, masteredPatterns.length),
          h('small', null, 'mastered')
        )
      )
    ),

    // Enhanced Controls
    h('div', { style: { display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' } },
      h('div', { className: 'mode-toggle' },
        ['visual', 'audio', 'counting', 'mixed'].map(m =>
          h('button', {
            key: m,
            className: `btn ${mode === m ? 'btn-primary' : 'btn-outline'} btn-sm`,
            onClick: () => setMode(m)
          }, m.charAt(0).toUpperCase() + m.slice(1))
        )
      ),
      h('div', { className: 'mode-toggle' },
        TIME_SIGNATURES.map(ts =>
          h('button', {
            key: ts,
            className: `btn ${timeSig === ts ? 'btn-primary' : 'btn-outline'} btn-sm`,
            onClick: () => setTimeSig(ts)
          }, ts)
        )
      ),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' } },
        h('label', null, `Tempo: ${tempo} BPM`),
        h('input', {
          type: 'range', min: '60', max: '120', value: tempo,
          onChange: e => setTempo(Number(e.target.value)),
          className: 'slider'
        })
      ),
      h('div', { className: 'difficulty-badge' }, 
        `Lv ${adaptiveConfig.level}`
      )
    ),

    // Pattern Display (preserved UX)
    h('div', { className: 'card rhythm-display elevated' },
      h('div', { className: 'pattern-visual large' },
        currentPattern ? currentPattern.beats.map((beat, i) =>
          h('span', {
            key: i,
            className: `rhythm-note ${userAnswer[i] === beat.value ? 'selected' : ''} 
                       ${masteredPatterns.includes(currentPattern.id) ? 'mastered' : ''}`,
            style: { 
              background: beat.value === 'quarter' ? '#3b82f6' : 
                         beat.value === 'eighth' ? '#10b981' : 
                         beat.value === 'sixteenth' ? '#f59e0b' : 
                         beat.value === 'dotted-quarter' ? '#8b5cf6' : '#ef4444',
              color: 'white'
            }
          }, beat.symbol || beat.value[0].toUpperCase())
        ) : '---'
      ),

      h('div', { style: { display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' } },
        h('button', {
          className: 'btn btn-primary btn-lg btn-play',
          onClick: playPattern,
          disabled: !currentPattern || isPlaying
        }, isPlaying ? 'Playing...' : `▶️ Play (${playCount + 1}x)`),
        
        h('button', {
          className: 'btn btn-outline btn-lg',
          onClick: () => {
            if (metronomeRef.current) stopMetronome();
            else metronomeRef.current = audioEngine.startMetronome(tempo, 4);
          }
        }, metronomeRef.current ? '⏹️ Stop' : '⏰ Metro')
      ),

      // Answer Input (preserved)
      !showAnswer && (mode === 'visual' || mode === 'counting') && 
      h('form', { onSubmit: e => { e.preventDefault(); checkAnswer(); } },
        h('div', { className: 'grid-3', style: { gap: 'var(--space-sm)' } },
          ['quarter', 'eighth', 'sixteenth', 'half', 'dotted-quarter'].map(value =>
            h('button', {
              key: value,
              className: `btn ${userAnswer.includes(value) ? 'btn-primary' : 'btn-outline'}`,
              style: { flex: 1 },
              onClick: e => {
                e.preventDefault();
                setUserAnswer(prev => 
                  prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
                );
              }
            }, value.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '))
          )
        ),
        h('button', {
          type: 'submit',
          className: 'btn btn-primary btn-lg',
          disabled: userAnswer.length === 0,
          style: { width: '100%', marginTop: 'var(--space-md)' }
        }, '✅ Check Pattern')
      ),

      // Enhanced Feedback
      showAnswer && h('div', { className: `feedback-card ${isCorrect ? 'success' : 'error'} elevated` },
        h('h3', null, currentPattern.name),
        h('div', null, `${currentPattern.beats.length} beats • ${timeSig} • ${tempo}BPM`),
        masteredPatterns.includes(currentPattern.id) && 
        h('span', { className: 'badge badge-success' }, '⭐ Mastered'),
        h('div', { className: 'pattern-visual correct', style: { margin: 'var(--space-md) 0' } },
          currentPattern.beats.map((beat, i) =>
            h('span', { key: i, style: { background: '#10b981' } }, beat.symbol)
          )
        ),
        h('div', { style: { display: 'flex', gap: 'var(--space-sm)' } },
          h('button', { className: 'btn btn-outline', onClick: playPattern }, '▶️ Replay'),
          h('button', { className: 'btn btn-primary', onClick: nextQuestion }, '➡️ Next')
        )
      )
    ),

    // Confusion Patterns Warning
    Object.keys(confusionPatterns).filter(key => confusionPatterns[key] > 2).length > 0 &&
    h('div', { className: 'card card-warning' },
      h('h4', null, '⚠️ Rhythm Confusion'),
      Object.entries(confusionPatterns)
        .filter(([_, count]) => count > 2)
        .slice(0, 2)
        .map(([pattern, count]) => 
          h('div', null, `${pattern} (${count}x mixups)`)
        )
    ),

    // Reference (mastery-aware)
    h('div', { className: 'card' },
      h('h3', null, 'Patterns'),
      h('div', { className: 'module-grid' },
        adaptiveConfig.patternPool.slice(0, 6).map(pattern =>
          h('div', { 
            key: pattern.id, 
            className: `module-stat ${masteredPatterns.includes(pattern.id) ? 'mastered' : ''}`,
            style: { cursor: 'pointer' },
            onClick: () => setCurrentPattern(pattern)
          },
            h('h4', null, pattern.name),
            h('div', { className: 'pattern-visual small' },
              pattern.beats.map((beat, i) => 
                h('span', { key: i, style: { background: '#e2e8f0' } }, beat.symbol)
              )
            )
          )
        )
      )
    )
  );
}

// Rhythm confusion detection
function detectRhythmConfusion(patternId, wrongAnswer) {
  const key = `${patternId}-${wrongAnswer.join(',')}`;
  setConfusionPatterns(prev => {
    const count = (prev[key] || 0) + 1;
    const updated = { ...prev, [key]: count };
    saveJSON(STORAGE_KEYS.CONFUSION_RHYTHM, updated);
    return updated;
  });
}
