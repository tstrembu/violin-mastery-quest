// js/components/ScalesLab.js - Scales Lab v3.0
// Unified Harmony Explorer + ML-Adaptive Trainer + Interactive Quiz
// Production-ready with fallback safety + deep analytics integration

const { createElement: h, useState, useEffect, useCallback, useMemo, useRef } = React;

import { midiToFreq, NATURAL_NOTES, SHARPS, FLATS } from '../config/constants.js';
import audioEngine from '../engines/audioEngine.js';
import { updateItem, ITEMTYPES, getDueItems, getMasteryByScaleRoot, getConfusionMatrix } from '../engines/spacedRepetition.js';
import { awardPracticeXP, recordAnswer, getUserLevel } from '../engines/gamification.js';
import { getAdaptiveConfig, updateStats, analyzePerformance } from '../engines/analytics.js';
import { keyboard, a11y } from '../utils/keyboard.js';
import sessionTracker from '../engines/sessionTracker.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SCALE_TYPES = [
  { id: 'major',          name: 'Major',          pattern: [2,2,1,2,2,2,1], color: '#4CAF50', emoji: '🔑', difficulty: 1.0 },
  { id: 'minor_natural',  name: 'Natural Minor',  pattern: [2,1,2,2,1,2,2], color: '#FF9800', emoji: '🌿', difficulty: 1.2 },
  { id: 'minor_harmonic', name: 'Harmonic Minor', pattern: [2,1,2,2,1,3,1], color: '#F44336', emoji: '🎻', difficulty: 1.5 },
  { id: 'minor_melodic',  name: 'Melodic Minor',  pattern: [2,1,2,2,2,2,1], color: '#9C27B0', emoji: '✨', difficulty: 1.6 },
  { id: 'pentatonic',     name: 'Major Pentatonic', pattern: [2,2,3,2,3], color: '#2196F3', emoji: '⭐', difficulty: 0.8 },
  { id: 'blues',          name: 'Blues',         pattern: [3,2,1,1,3,2], color: '#795548', emoji: '🎸', difficulty: 1.3 }
];

const ROOTS = [
  { midi: 60, name: 'C'  }, { midi: 61, name: 'C#' }, { midi: 62, name: 'D'  },
  { midi: 63, name: 'D#' }, { midi: 64, name: 'E'  }, { midi: 65, name: 'F'  },
  { midi: 66, name: 'F#' }, { midi: 67, name: 'G'  }, { midi: 68, name: 'G#' },
  { midi: 69, name: 'A'  }, { midi: 70, name: 'A#' }, { midi: 71, name: 'B'  }
];

const MODES = [
  { id: 'explore',  label: 'Explore',    description: 'Click notes to learn scale degrees', icon: '🎛️' },
  { id: 'trainer',  label: 'ML Trainer', description: 'Adaptive practice focusing on weak areas', icon: '🤖' },
  { id: 'quiz',     label: 'Quiz',       description: 'Identify scale types by ear', icon: '📝' }
];

// ============================================================================
// UTILITIES
// ============================================================================

function getOrdinalSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function midiNoteName(midi) {
  const notes = [...NATURAL_NOTES, ...SHARPS, ...FLATS];
  const name = notes[midi % 12] || NATURAL_NOTES[midi % 12] || '?';
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// Mastery color scale (HSL green = 120°, red = 0°)
function getMasteryHSL(mastery) {
  const clamp = Math.max(0, Math.min(1, mastery || 0));
  const hue = clamp * 120; // Red (0°) → Green (120°)
  return `hsl(${Math.round(hue)}, 70%, 50%)`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ScalesLab({ onBack, showToast, refreshStats }) {
  // ========================================================================
  // STATE - CORE PLAYBACK
  // ========================================================================
  const [root, setRoot] = useState(60);
  const [scaleType, setScaleType] = useState('major');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState('updown');
  const [tempo, setTempo] = useState(80);
  const [currentScale, setCurrentScale] = useState([]);
  const [highlightedNote, setHighlightedNote] = useState(-1);

  // ========================================================================
  // STATE - ML & ANALYTICS
  // ========================================================================
  const [adaptiveConfig, setAdaptiveConfig] = useState(null);
  const [scaleMastery, setScaleMastery] = useState({});     // scale-root → mastery %
  const [confusionPairs, setConfusionPairs] = useState([]); // Frequently confused scales
  const [userLevel, setUserLevel] = useState(1);

  // ========================================================================
  // STATE - MODE-SPECIFIC
  // ========================================================================
  const [mode, setMode] = useState('explore');
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, streak: 0, accuracy: 0 });

  // Quiz mode
  const [quizTarget, setQuizTarget] = useState(null);       // { degree, midi } for degree quiz
  const [quizScaleTarget, setQuizScaleTarget] = useState(null); // { root, scaleType } for scale quiz
  const [quizProgress, setQuizProgress] = useState({ current: 0, score: 0, maxScore: 10 });
  const quizStartRef = useRef(null);

  // Trainer mode - weak scale pool
  const [trainerPool, setTrainerPool] = useState([]);
  const trainerStartRef = useRef(null);

  const currentScaleData = SCALE_TYPES.find(s => s.id === scaleType) || SCALE_TYPES[0];
  const rootName = ROOTS.find(r => r.midi === root)?.name || midiNoteName(root);

  // ========================================================================
  // MEMOIZED: Scale note calculation
  // ========================================================================
  const scaleNotes = useMemo(() => {
    const pattern = currentScaleData.pattern;
    const notes = [root];
    let current = root;
    pattern.forEach(interval => {
      current += interval;
      notes.push(current);
    });
    return notes;
  }, [root, currentScaleData]);

  // ========================================================================
  // INITIALIZATION: Load ML config, mastery, confusion data
  // ========================================================================
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Parallel load for performance
        const [
          level,
          config,
          mastery,
          confusion
        ] = await Promise.allSettled([
          getUserLevel?.().catch(() => 1),
          getAdaptiveConfig?.('scaleslab').catch(() => ({})),
          getMasteryByScaleRoot?.('scaleslab').catch(() => ({})),
          getConfusionMatrix?.('scaleslab').catch(() => ({ pairs: [] }))
        ]).then(results => [
          results[0].status === 'fulfilled' ? results[0].value : 1,
          results[1].status === 'fulfilled' ? results[1].value : {},
          results[2].status === 'fulfilled' ? results[2].value : {},
          results[3].status === 'fulfilled' ? results[3].value : { pairs: [] }
        ]);

        if (cancelled) return;

        setUserLevel(level);
        setAdaptiveConfig(config);
        setScaleMastery(mastery);
        setConfusionPairs(confusion.pairs || []);

        // Adaptive tempo if not yet set by user
        if (config?.targetTempo && tempo === 80) {
          setTempo(Math.round(config.targetTempo));
        }

        // Log session entry
        sessionTracker.trackActivity?.('scaleslab', 'init', {
          userLevel: level,
          weakScales: Object.keys(mastery).filter(k => mastery[k] < 0.8).length,
          confusionCount: confusion.pairs?.length || 0
        });
      } catch (err) {
        console.warn('[ScalesLab] Init failed gracefully', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // Run once on mount

  // ========================================================================
  // PLAYBACK: Scale playback with proper mode handling
  // ========================================================================
  const playScale = useCallback(() => {
    if (isPlaying) return;

    const notes = scaleNotes;
    if (!notes.length) return;

    let sequence = notes;
    if (playMode === 'down') {
      sequence = [...notes].reverse();
    } else if (playMode === 'updown') {
      sequence = [...notes, ...notes.slice(0, -1).reverse()];
    }

    setCurrentScale(sequence);
    setIsPlaying(true);

    sessionTracker.trackActivity?.('scaleslab', 'play', {
      root: rootName,
      type: scaleType,
      tempo,
      mode: playMode,
      difficulty: currentScaleData.difficulty
    });

    const intervalMs = 60000 / tempo;
    let noteIndex = 0;
    const startTs = performance.now?.() || Date.now();

    const playNext = () => {
      if (noteIndex >= sequence.length) {
        setIsPlaying(false);
        setHighlightedNote(-1);

        const endTs = performance.now?.() || Date.now();
        const duration = endTs - startTs;

        // Record playback as successful session
        try {
          if (typeof updateStats === 'function') {
            updateStats('scaleslab', true, duration / sequence.length, {
              root,
              scaleType,
              mode: playMode,
              notes: sequence.length,
              tempo
            });
          }
        } catch (err) {
          console.warn('[ScalesLab] updateStats failed', err);
        }

        // Increment local session stats
        setSessionStats(prev => ({
          correct: prev.correct + 1,
          total: prev.total + 1,
          streak: prev.streak + 1,
          accuracy: Math.round(((prev.correct + 1) / (prev.total + 1)) * 100)
        }));

        return;
      }

      const midi = sequence[noteIndex];
      const freq = midiToFreq(midi);

      // Use violin timbre if available, fallback to triangle
      if (audioEngine.playViolinNote) {
        audioEngine.playViolinNote?.(freq, 1.0, 'medium', root, scaleType);
      } else {
        audioEngine.playTone?.(freq, 0.6, 'triangle');
      }

      setHighlightedNote(noteIndex);
      a11y.announce?.(
        `${rootName} ${currentScaleData.name} ${playMode} note ${noteIndex + 1} of ${sequence.length}`
      );

      noteIndex += 1;
      setTimeout(playNext, intervalMs);
    };

    playNext();
  }, [scaleNotes, isPlaying, playMode, rootName, scaleType, tempo, currentScaleData]);

  // ========================================================================
  // EXPLORE MODE: Simple note interaction
  // ========================================================================
  const handleExploreClick = useCallback(
    (midi, index) => {
      audioEngine.playTone?.(midiToFreq(midi), 0.7, 'sine');
      setHighlightedNote(index);

      try {
        recordAnswer?.('scaleslab', true, 300);
        sessionTracker.trackActivity?.('scaleslab', 'explore_note', {
          midi,
          index,
          root: rootName,
          type: scaleType
        });
      } catch (err) {
        console.warn('[ScalesLab] explore tracking failed', err);
      }

      showToast(midiNoteName(midi), 'success');
    },
    [rootName, scaleType, showToast]
  );

  // ========================================================================
  // TRAINER MODE: Adaptive weak-scale practice
  // ========================================================================
  const initTrainerMode = useCallback(async () => {
    try {
      // Build weighted pool: weak scales 3× priority, others 1×
      const poolEntries = [];

      Object.entries(scaleMastery).forEach(([key, mastery]) => {
        const weight = mastery < 0.7 ? 3 : mastery < 0.85 ? 2 : 1;
        poolEntries.push({ key, mastery, weight });
      });

      // If no data, fallback to all scales
      if (!poolEntries.length) {
        SCALE_TYPES.slice(0, Math.min(4, userLevel + 1)).forEach(scale => {
          ROOTS.slice(0, 6).forEach(r => {
            poolEntries.push({ key: `${scale.id}-${r.midi}`, mastery: 0.5, weight: 1 });
          });
        });
      }

      setTrainerPool(poolEntries);
      trainerStartRef.current = Date.now();

      sessionTracker.trackActivity?.('scaleslab', 'trainer_start', {
        poolSize: poolEntries.length,
        weakCount: poolEntries.filter(p => p.mastery < 0.7).length
      });
    } catch (err) {
      console.warn('[ScalesLab] trainer init failed', err);
    }
  }, [scaleMastery, userLevel]);

  const nextTrainerQuestion = useCallback(() => {
    if (!trainerPool.length) return;

    // Weighted random selection
    const totalWeight = trainerPool.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    let selected = trainerPool[0];

    for (const item of trainerPool) {
      r -= item.weight;
      if (r <= 0) {
        selected = item;
        break;
      }
    }

    // Parse key: "scale_id-midi"
    const [scaleId, rootMidi] = selected.key.split('-');
    setScaleType(scaleId);
    setRoot(parseInt(rootMidi, 10));
    setHighlightedNote(-1);

    trainerStartRef.current = Date.now();
    a11y.announce?.(`Practice ${scaleId} from ${ROOTS.find(r => r.midi === parseInt(rootMidi, 10))?.name}`);
  }, [trainerPool]);

  // ========================================================================
  // QUIZ MODE: Identify scale degree
  // ========================================================================
  const generateDegreeQuiz = useCallback(() => {
    const notes = scaleNotes;
    if (!notes.length) return;

    const degree = Math.floor(Math.random() * notes.length);
    const midi = notes[degree];

    setQuizTarget({ degree, midi });
    quizStartRef.current = Date.now();
    setHighlightedNote(-1);

    a11y.announce?.(
      `Find the ${degree + 1}${getOrdinalSuffix(degree + 1)} degree of ${rootName} ${currentScaleData.name}`
    );
  }, [scaleNotes, rootName, currentScaleData]);

  const generateScaleQuiz = useCallback(() => {
    if (!trainerPool.length) {
      // Fallback: random scale + root
      const scale = SCALE_TYPES[Math.floor(Math.random() * SCALE_TYPES.length)];
      const r = ROOTS[Math.floor(Math.random() * ROOTS.length)];
      setQuizScaleTarget({ scaleType: scale.id, root: r.midi });
    } else {
      // Weighted selection: weak scales more frequent
      const totalWeight = trainerPool.reduce((sum, item) => sum + item.weight, 0);
      let r = Math.random() * totalWeight;
      let selected = trainerPool[0];

      for (const item of trainerPool) {
        r -= item.weight;
        if (r <= 0) {
          selected = item;
          break;
        }
      }

      const [scaleId, rootMidi] = selected.key.split('-');
      setQuizScaleTarget({ scaleType: scaleId, root: parseInt(rootMidi, 10) });
    }

    quizStartRef.current = Date.now();
  }, [trainerPool]);

  // Handle degree-based quiz answer
  const handleDegreeAnswer = useCallback(
    async (midi, index) => {
      if (!quizTarget) return;

      const isCorrect = index === quizTarget.degree;
      const responseTime = quizStartRef.current ? Date.now() - quizStartRef.current : 0;

      audioEngine.playTone?.(midiToFreq(midi), 0.7, isCorrect ? 'sine' : 'triangle');

      try {
        // Record answer
        recordAnswer?.('scaleslab', isCorrect, responseTime);

        // SM-2 tracking: scale degree
        const degreeKey = `scale:${rootName}:${scaleType}:${quizTarget.degree + 1}`;
        const quality = isCorrect ? 4 : 1;
        await updateItem?.(degreeKey, quality, responseTime, {
          type: ITEMTYPES.SCALE,
          root: rootName,
          scaleType,
          degree: quizTarget.degree + 1
        });

        // Analytics
        if (typeof updateStats === 'function') {
          updateStats('scaleslab', isCorrect, responseTime, {
            root: rootName,
            scaleType,
            degree: quizTarget.degree + 1,
            mode: 'quiz'
          });
        }
      } catch (err) {
        console.warn('[ScalesLab] degree answer tracking failed', err);
      }

      // Update session stats
      setSessionStats(prev => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
        streak: isCorrect ? prev.streak + 1 : 0,
        accuracy: Math.round(((prev.correct + (isCorrect ? 1 : 0)) / (prev.total + 1)) * 100)
      }));

      // XP award
      try {
        const difficulty = currentScaleData.difficulty;
        const xp = await awardPracticeXP?.(
          'scaleslab',
          isCorrect,
          sessionStats.streak + (isCorrect ? 1 : 0),
          difficulty,
          responseTime
        );

        if (isCorrect) {
          showToast(
            xp ? `${midiNoteName(midi)} ✓ +${xp}XP` : `${midiNoteName(midi)} ✓`,
            'success'
          );
        } else {
          showToast(`Target: ${midiNoteName(quizTarget.midi)}`, 'error');
        }
      } catch (err) {
        console.warn('[ScalesLab] XP award failed', err);
      }

      // Next question
      setTimeout(() => {
        generateDegreeQuiz();
      }, 700);
    },
    [quizTarget, rootName, scaleType, currentScaleData, sessionStats.streak, showToast, generateDegreeQuiz]
  );

  // ========================================================================
  // KEYBOARD SHORTCUTS
  // ========================================================================
  useEffect(() => {
    keyboard.register?.('space', playScale, 'Play scale');
    keyboard.register?.('arrowleft', () => setRoot(prev => Math.max(48, prev - 1)), 'Previous root');
    keyboard.register?.('arrowright', () => setRoot(prev => Math.min(84, prev + 1)), 'Next root');
    keyboard.register?.('u', () => setPlayMode('up'), 'Upward');
    keyboard.register?.('d', () => setPlayMode('down'), 'Downward');
    keyboard.register?.('b', () => setPlayMode('updown'), 'Up & Down');
    keyboard.register?.(
      'q',
      () => {
        if (mode === 'explore') setMode('quiz');
        else if (mode === 'quiz') setMode('trainer');
        else setMode('explore');
      },
      'Cycle modes'
    );

    return () => {
      keyboard.unregister?.('space', 'arrowleft', 'arrowright', 'u', 'd', 'b', 'q');
    };
  }, [playScale, mode]);

  // ========================================================================
  // EFFECTS: Mode-specific initialization
  // ========================================================================
  useEffect(() => {
    if (mode === 'trainer') {
      initTrainerMode();
    } else if (mode === 'quiz') {
      generateDegreeQuiz();
      sessionTracker.trackActivity?.('scaleslab', 'quiz_start', { root: rootName, type: scaleType });
    }
  }, [mode, initTrainerMode, generateDegreeQuiz, rootName, scaleType]);

  // ========================================================================
  // RENDER
  // ========================================================================
  const masteryForCurrent = scaleMastery[`${scaleType}-${root}`] || 0;
  const isWeakScale = masteryForCurrent < 0.7;

  return h('div', { className: 'module-container scales-lab-v3', role: 'main' },
    // ======================================================================
    // HEADER
    // ======================================================================
    h('header', { className: 'module-header scales-header' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h1', null, '🎼 Scales Lab'),
      h('div', { className: 'header-stats', 'aria-live': 'polite', 'aria-atomic': 'true' },
        h('span', { className: 'stat accuracy' },
          `${sessionStats.correct}/${sessionStats.total}`,
          h('small', null, `${sessionStats.accuracy}%`)
        ),
        h('span', { className: 'stat streak' },
          sessionStats.streak >= 5 ? '🔥' : '',
          sessionStats.streak,
          h('small', null, 'streak')
        ),
        h('span', { className: 'stat mastery' },
          `${Math.round(masteryForCurrent * 100)}%`,
          h('small', null, 'mastery')
        )
      )
    ),

    // ======================================================================
    // MODE SELECTOR
    // ======================================================================
    h('section', { className: 'mode-selector' },
      MODES.map(m =>
        h('button', {
          key: m.id,
          className: `mode-btn ${mode === m.id ? 'active' : ''}`,
          onClick: () => setMode(m.id),
          title: m.description
        },
          `${m.icon} ${m.label}`,
          h('small', null, m.description)
        )
      )
    ),

    // ======================================================================
    // CONTROLS: Root & Scale selection
    // ======================================================================
    h('div', { className: 'scales-controls' },
      h('div', { className: 'control-group' },
        h('label', null, 'Root:'),
        h('div', { className: 'root-selector' },
          ROOTS.map(r => {
            const mastery = scaleMastery[`${scaleType}-${r.midi}`] || 0;
            const isWeak = mastery < 0.7;
            return h('button', {
              key: r.midi,
              className: `root-btn ${root === r.midi ? 'active' : ''} ${isWeak ? 'needs-work' : ''}`,
              style: {
                backgroundColor: currentScaleData.color,
                opacity: isWeak ? 0.8 : 1
              },
              onClick: () => {
                setRoot(r.midi);
                a11y.announce?.(`${r.name} root selected`);
                if (mode === 'quiz') generateDegreeQuiz();
              }
            }, r.name);
          })
        )
      ),

      h('div', { className: 'control-group' },
        h('label', null, 'Scale:'),
        h('div', { className: 'scale-selector' },
          SCALE_TYPES.map(scale => {
            const isConfused = confusionPairs.includes(`${scale.id}-${root}`);
            return h('button', {
              key: scale.id,
              className: `scale-btn ${scaleType === scale.id ? 'active' : ''} ${isConfused ? 'confusion' : ''}`,
              style: { backgroundColor: scale.color },
              onClick: () => {
                setScaleType(scale.id);
                a11y.announce?.(`${scale.name} scale selected`);
                if (mode === 'quiz') generateDegreeQuiz();
              },
              title: isConfused ? 'Commonly confused scale' : ''
            },
              `${scale.emoji} ${scale.name}`
            );
          })
        )
      )
    ),

    // ======================================================================
    // PLAYBACK CONTROLS
    // ======================================================================
    h('div', { className: 'playback-controls' },
      h('div', { className: 'tempo-control' },
        h('label', null, `Tempo: ${tempo} BPM`),
        h('input', {
          type: 'range',
          min: 40,
          max: 160,
          step: 4,
          value: tempo,
          onChange: e => setTempo(parseInt(e.target.value, 10)),
          className: 'tempo-slider',
          'aria-label': 'Tempo in beats per minute'
        }),
        adaptiveConfig?.targetTempo && h('small', { className: 'adaptive-hint' },
          `AI suggests: ${Math.round(adaptiveConfig.targetTempo)} BPM`
        )
      ),

      h('div', { className: 'play-controls' },
        h('button', {
          className: `btn-play ${isPlaying ? 'playing' : ''}`,
          onClick: playScale,
          disabled: isPlaying || mode === 'quiz',
          'aria-label': 'Play scale'
        }, isPlaying ? '🔊 Playing...' : '▶️ Play Scale'),

        h('div', { className: 'play-mode-toggle' },
          ['up', 'down', 'updown'].map(pm =>
            h('button', {
              key: pm,
              className: `btn-sm ${playMode === pm ? 'active' : ''}`,
              onClick: () => setPlayMode(pm)
            }, pm.toUpperCase())
          )
        )
      )
    ),

    // ======================================================================
    // MODE-SPECIFIC CONTENT
    // ======================================================================

    // Explore mode: just the staff visualization
    mode === 'explore' && h('div', { className: 'explore-content' },
      'Select a root and scale, then click notes or press SPACE to play.'
    ),

    // Trainer mode: weak scale focus
    mode === 'trainer' && h('section', { className: 'trainer-content' },
      h('div', { className: 'trainer-prompt' },
        h('strong', null, `Practice ${rootName} ${currentScaleData.name}`),
        h('small', null, `Mastery: ${Math.round(masteryForCurrent * 100)}%`),
        h('button', { className: 'btn-next', onClick: nextTrainerQuestion }, 'Skip → Next Weak Scale')
      )
    ),

    // Quiz mode: identify scale degree
    mode === 'quiz' && quizTarget && h('section', { className: 'quiz-content' },
      h('div', { className: 'quiz-prompt' },
        h('h3', null, `Find the ${quizTarget.degree + 1}${getOrdinalSuffix(quizTarget.degree + 1)} degree`),
        h('small', null, 'Click a note on the staff below')
      )
    ),

    // ======================================================================
    // SCALE VISUALIZATION (STAFF)
    // ======================================================================
    h('section', { className: 'scale-visualizer' },
      h('div', { className: 'scale-staff' },
        h('svg', {
          width: '100%',
          height: 200,
          viewBox: '0 0 1000 200',
          className: 'scale-svg',
          role: 'img',
          'aria-label': `${rootName} ${currentScaleData.name} scale - mastery ${Math.round(masteryForCurrent * 100)}%`
        },
          // Staff lines
          [0, 1, 2, 3, 4].map(i =>
            h('line', {
              key: `staff-${i}`,
              x1: 50,
              y1: 60 + i * 25,
              x2: 950,
              y2: 60 + i * 25,
              stroke: 'var(--ink)',
              strokeWidth: 2
            })
          ),

          // Treble clef
          h('text', { x: 80, y: 140, fontSize: 50, fill: 'var(--ink)', fontFamily: 'serif' }, '𝄞'),

          // Notes
          scaleNotes.map((midi, i) => {
            const x = 200 + i * 110;
            const y = 140 - (midi % 12) * 8;

            // For trainer/quiz: show mastery coloring
            let fill = 'var(--primary)';
            if (mode !== 'explore') {
              fill = getMasteryHSL(scaleMastery[`${scaleType}-${root}-note-${i}`] || 0.5);
            }

            return h('g', { key: `note-${i}` },
              h('circle', {
                cx: x,
                cy: y,
                r: i === highlightedNote ? 16 : 12,
                fill: i === highlightedNote ? currentScaleData.color : fill,
                stroke: 'var(--ink)',
                strokeWidth: 2,
                className: `scale-note ${i === highlightedNote ? 'active' : ''}`,
                role: 'button',
                tabIndex: 0,
                onClick: () => {
                  if (mode === 'explore') {
                    handleExploreClick(midi, i);
                  } else if (mode === 'quiz' && quizTarget) {
                    handleDegreeAnswer(midi, i);
                  }
                },
                onKeyDown: e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (mode === 'explore') {
                      handleExploreClick(midi, i);
                    } else if (mode === 'quiz' && quizTarget) {
                      handleDegreeAnswer(midi, i);
                    }
                  }
                }
              }),
              h('text', {
                x,
                y: y + 5,
                textAnchor: 'middle',
                fontSize: 14,
                fill: i === highlightedNote ? 'white' : 'currentColor',
                fontWeight: 'bold'
              }, NATURAL_NOTES[midi % 12])
            );
          })
        )
      ),

      // Scale info
      h('div', { className: 'scale-info' },
        h('div', null,
          h('strong', null, `${rootName} ${currentScaleData.name}`),
          h('small', null, `${currentScaleData.pattern.join(' - ')} semitones`)
        ),
        h('div', { className: `mastery-badge ${masteryForCurrent >= 0.85 ? 'mastered' : masteryForCurrent >= 0.7 ? 'good' : 'needs-work'}` },
          `Mastery: ${Math.round(masteryForCurrent * 100)}%`
        ),
        h('div', { className: 'keyboard-hints' },
          h('kbd', null, 'SPACE'),
          h('small', null, 'Play'),
          h('kbd', null, '←→'),
          h('small', null, 'Root'),
          h('kbd', null, 'Q'),
          h('small', null, 'Next mode')
        )
      )
    ),

    // ======================================================================
    // LIVE SESSION
    // ======================================================================
    h('div', { className: 'session-status' },
      h('span', { className: 'live-dot' }, '●'),
      h('small', null, sessionTracker.getCurrentSession?.()?.activity || 'Scales Lab v3.0')
    )
  );
}
