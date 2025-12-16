// js/components/Flashcards.js
// ======================================
// FLASHCARDS v3.0 - ML-Adaptive Note Reading
// SM-2 Enhanced • Confusion Detection • Position Mastery
// ======================================

const { createElement: h, useState, useEffect, useCallback, useRef } = React;

import { 
  NATURAL_NOTES, SHARPS, FLATS, XP_VALUES, POSITIONS, 
  LEGER_LINES 
} from '../config/constants.js';
import { 
  updateItem, getDueItems, getMasteryLevel, getConfusionPairs 
} from '../engines/spacedRepetition.js';
import { addXP, recordAnswer, getUserLevel } from '../engines/gamification.js';
import { analyzePerformance, getAdaptiveConfig } from '../engines/analytics.js';
import { keyboard, a11y } from '../utils/keyboard.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { audioEngine } from '../engines/audioEngine.js';
import { FEATURES } from '../config/version.js';

const FLASHCARD_POSITIONS = [
  { name: '1st Position', low: 'G3', high: 'E5', strings: 4, difficulty: 1 },
  { name: '3rd Position', low: 'B3', high: 'G5', strings: 4, difficulty: 2 },
  { name: '5th Position', low: 'D4', high: 'A5', strings: 4, difficulty: 3 }
];

export default function Flashcards({ onBack, showToast, refreshStats }) {
  const [config, setConfig] = useState({ level: 1, notesPerSession: 8 });
  const [deck, setDeck] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0, accuracy: 0 });
  const [startTime, setStartTime] = useState(null);
  const [quality, setQuality] = useState(3);
  const [confusionPairs, setConfusionPairs] = useState([]);
  const [masteryByPosition, setMasteryByPosition] = useState({});
  const inputRef = useRef(null);
  const sessionRef = useRef(0);

  // 🎯 ML-Adaptive Deck Generation
  const generateMLDeck = useCallback(async () => {
    const userLevel = await getUserLevel();
    const adaptiveConfig = await getAdaptiveConfig('flashcards');
    const dueItems = await getDueItems('flashcards', 20);
    const confusionItems = await getConfusionPairs('flashcards');
    
    // Weighted pool: 40% due, 30% confusion, 30% new
    const pool = [
      ...dueItems.map(item => ({ ...item, weight: 3.0 })),
      ...confusionItems.map(item => ({ ...item, weight: 2.5 })),
      ...FLASHCARD_POSITIONS.flatMap(pos => 
        generatePositionNotes(pos, adaptiveConfig.notesPerSession / 3)
          .map(note => ({ note: note.note, position: pos.name, weight: 1.0 + (pos.difficulty * 0.5) }))
      )
    ];

    // ML-weighted selection
    const selectedDeck = weightedRandomSample(pool, adaptiveConfig.notesPerSession);
    
    setDeck(selectedDeck);
    setConfusionPairs(confusionItems.map(c => c.note));
    setConfig(adaptiveConfig);
    
    sessionTracker.trackActivity('flashcards', 'deck_generated', {
      size: selectedDeck.length,
      due: dueItems.length,
      confusion: confusionItems.length,
      userLevel
    });
  }, []);

  function generatePositionNotes(position, count) {
    const notes = generateNotesInRange(position.low, position.high);
    return notes.slice(0, count).map(note => ({ note, midi: noteToMidi(note) }));
  }

  // 🎯 Weighted Random Selection (ML)
  function weightedRandomSample(items, count) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    const result = [];
    
    for (let i = 0; i < count; i++) {
      let r = Math.random() * totalWeight;
      for (const item of items) {
        r -= item.weight || 1;
        if (r <= 0) {
          result.push(item);
          break;
        }
      }
    }
    return result;
  }

  const nextCard = useCallback(() => {
    if (deck.length === 0) return;
    
    // Prioritize due/confusion cards
    const dueCards = deck.filter(card => 
      getDueItems([card], 'flashcards').length > 0
    );
    const pool = dueCards.length > 0 ? dueCards : deck;
    
    const card = pool[Math.floor(Math.random() * pool.length)];
    setCurrentCard(card);
    setUserAnswer('');
    setShowAnswer(false);
    setStartTime(Date.now());
    setQuality(3);
    
    if (inputRef.current) inputRef.current.focus();
    
    a11y.announce(`Flashcard: ${card.position}`);
    sessionTracker.trackActivity('flashcards', 'card_viewed', { 
      position: card.position, 
      note: card.note 
    });
  }, [deck]);

  const checkAnswer = useCallback(async (e) => {
    e?.preventDefault();
    if (!userAnswer.trim() || !currentCard) return;
    
    const normalizedAnswer = normalizeNote(userAnswer.trim());
    const isCorrect = normalizedAnswer === normalizeNote(currentCard.note);
    const responseTime = Date.now() - startTime;
    
    // 🎯 ML Confusion Detection
    const confusionScore = confusionPairs.includes(currentCard.note) ? 1.2 : 1.0;
    
    setShowAnswer(true);
    
    // Record with ML context
    recordAnswer('flashcards', isCorrect, responseTime, {
      position: currentCard.position,
      note: currentCard.note,
      quality,
      confusionScore,
      userLevel: await getUserLevel()
    });
    
    const newStats = {
      correct: stats.correct + (isCorrect ? 1 : 0),
      total: stats.total + 1,
      streak: isCorrect ? stats.streak + 1 : 0,
      accuracy: Math.round((stats.correct + (isCorrect ? 1 : 0)) / (stats.total + 1) * 100)
    };
    setStats(newStats);
    
    // 🎯 Position-specific mastery tracking
    const positionKey = currentCard.position.toLowerCase();
    setMasteryByPosition(prev => ({
      ...prev,
      [positionKey]: {
        ...prev[positionKey],
        attempts: (prev[positionKey]?.attempts || 0) + 1,
        correct: (prev[positionKey]?.correct || 0) + (isCorrect ? 1 : 0)
      }
    }));

    if (isCorrect) {
      const positionMultiplier = FLASHCARD_POSITIONS.find(p => p.name === currentCard.position)?.difficulty || 1;
      const xp = Math.round(XP_VALUES.CORRECT_ANSWER * positionMultiplier * confusionScore);
      addXP(xp, 'flashcards', currentCard.note);
      showToast(`✅ ${currentCard.note} +${xp}XP`, 'success');
      a11y.announce(`Correct! ${currentCard.note}. Streak ${newStats.streak}`);
    } else {
      showToast(`❌ ${currentCard.note} (you said: ${normalizedAnswer})`, 'error');
      a11y.announce(`Incorrect. Correct answer: ${currentCard.note}`);
    }
    
    refreshStats?.();
  }, [currentCard, userAnswer, startTime, quality, stats, confusionPairs, refreshStats]);

  const setQualityRating = useCallback(async (q) => {
    setQuality(q);
    
    // 🎯 Enhanced SM-2 update with ML context
    await updateItem(currentCard.id || currentCard.note, q, Date.now() - startTime, {
      position: currentCard.position,
      confusion: confusionPairs.includes(currentCard.note)
    });
    
    sessionTracker.trackActivity('flashcards', 'quality_rated', { 
      quality: q, 
      position: currentCard.position 
    });
    
    // Auto-advance
    setTimeout(() => {
      if (stats.total + 1 >= config.notesPerSession) {
        generateMLDeck();
      } else {
        nextCard();
      }
    }, 800);
  }, [currentCard, stats.total, config.notesPerSession, confusionPairs, nextCard, generateMLDeck]);

  // 🎯 Keyboard Shortcuts + ARIA
  useEffect(() => {
    const shortcuts = {
      'Enter': checkAnswer,
      'Space': () => audioEngine.playNote(currentCard?.midi || 60, { volume: 0.7 }),
      '1': () => setQualityRating(1),
      '2': () => setQualityRating(2),
      '3': () => setQualityRating(3),
      '4': () => setQualityRating(4),
      '5': () => setQualityRating(5),
      'n': nextCard
    };
    
    Object.entries(shortcuts).forEach(([key, handler]) => {
      keyboard.register(key, handler, `Flashcards: ${key}`);
    });
    
    return () => {
      Object.keys(shortcuts).forEach(key => {
        keyboard.unregister(key);
      });
    };
  }, [checkAnswer, setQualityRating, nextCard, currentCard]);

  // 🎯 ML Deck initialization
  useEffect(() => {
    generateMLDeck();
  }, []);

  if (deck.length === 0) {
    return h('div', { className: 'module-container center' },
      h('div', { className: 'loading-spinner large' }),
      h('p', { className: 'text-muted' }, 'Generating ML deck...')
    );
  }

  const positionMastery = masteryByPosition[currentCard?.position?.toLowerCase()] || {};
  const positionAccuracy = positionMastery.attempts > 0 
    ? Math.round((positionMastery.correct / positionMastery.attempts) * 100) 
    : 0;

  return h('div', { className: 'module-container flashcards', role: 'main', 'aria-label': 'Note reading flashcards' },
    // Header with live stats
    h('header', { className: 'module-header' },
      h('button', { className: 'btn-back', onClick: onBack, 'aria-label': 'Back to menu' }, '← Back'),
      h('h1', null, '🎼 Note Flashcards'),
      h('div', { className: 'stats-bar', 'aria-live': 'polite' },
        h('span', null, `${stats.correct}/${stats.total} (${stats.accuracy}%)`),
        h('span', { className: 'streak-badge' }, `${stats.streak > 5 ? '🔥' : stats.streak > 2 ? '⚡' : ''}${stats.streak}`),
        h('span', null, `${currentCard?.position} • ${positionAccuracy}%`)
      )
    ),

    // 🎯 ML Staff Display
    h('section', { className: 'flashcard-section', 'aria-live': 'assertive', role: 'img', 'aria-label': `Note flashcard in ${currentCard?.position || 'unknown'}` },
      h('div', { className: 'staff-container' },
        h('svg', {
          width: '100%', 
          height: 280, 
          viewBox: '0 0 420 280',
          className: `staff-svg ${currentCard?.note && confusionPairs.includes(currentCard.note) ? 'confusion-highlight' : ''}`,
          role: 'img',
          'aria-label': `Note: ${currentCard?.note || 'loading'} in ${currentCard?.position || 'unknown'}`
        },
          // Dynamic ledger lines
          renderLedgerLines(currentCard?.note),
          
          // Staff lines (treble clef)
          [0,1,2,3,4].map(i =>
            h('line', {
              key: `staff-${i}`,
              x1: 50, y1: 100 + i * 16, x2: 370, y2: 100 + i * 16,
              stroke: 'var(--ink)', strokeWidth: 2.5
            })
          ),
          
          // Treble clef
          h('text', {
            x: 70, y: 155, fontSize: 52, fill: 'var(--ink)',
            fontFamily: 'serif', fontWeight: 'bold'
          }, '𝄞'),
          
          // 🎯 Note head with confusion glow
          currentCard && h('g', null,
            h('circle', {
              cx: 220, 
              cy: noteToLedgerY(currentCard.note),
              r: 14, 
              fill: confusionPairs.includes(currentCard.note) 
                ? 'var(--warning)' 
                : 'var(--primary)',
              stroke: 'var(--ink)', 
              strokeWidth: 2,
              className: 'note-head'
            }),
            
            // Note stem
            h('line', {
              x1: 220, 
              y1: noteToLedgerY(currentCard.note) - 10,
              x2: 220, 
              y2: noteToLedgerY(currentCard.note) - 60,
              stroke: 'var(--ink)', 
              strokeWidth: 3, 
              strokeLinecap: 'round'
            }),
            
            // 🎯 Confusion indicator
            confusionPairs.includes(currentCard.note) && h('circle', {
              cx: 220, cy: noteToLedgerY(currentCard.note),
              r: 18,
              fill: 'none',
              stroke: 'var(--warning)',
              strokeWidth: 3,
              strokeDasharray: '6,6',
              opacity: 0.7
            })
          )
        )
      ),

      // Position badge with mastery
      currentCard && h('div', { className: 'position-badge-container' },
        h('div', { className: `position-badge ${positionAccuracy >= 90 ? 'mastered' : positionAccuracy >= 70 ? 'good' : 'needs-work'}` },
          h('strong', null, currentCard.position),
          h('small', null, `${positionAccuracy}% mastery`)
        )
      )
    ),

    // Answer input phase
    !showAnswer ? h('form', { 
      className: 'answer-form', 
      onSubmit: checkAnswer, 
      role: 'search',
      'aria-label': 'Identify the note'
    },
      h('div', { className: 'input-group large' },
        h('input', {
          ref: inputRef,
          type: 'text',
          value: userAnswer,
          onChange: e => setUserAnswer(e.target.value),
          placeholder: 'G4, A#5, Bb3, C♯4...',
          className: `note-input ${confusionPairs.includes(currentCard?.note) ? 'confusion' : ''}`,
          autoComplete: 'off',
          maxLength: 5,
          'aria-describedby': 'note-help',
          'aria-label': 'Enter note name (ex: G4, A#5)'
        }),
        h('button', {
          type: 'submit',
          className: 'btn-submit btn-primary btn-lg',
          disabled: !userAnswer.trim(),
          'aria-label': 'Submit answer'
        }, '✅ Check')
      ),
      
      // Audio hint
      h('div', { className: 'audio-hint', role: 'button', tabIndex: 0, onClick: () => audioEngine.playNote(currentCard?.midi || 60), onKeyDown: e => e.key === 'Enter' && audioEngine.playNote(currentCard?.midi || 60) },
        h('kbd', null, 'SPACE'),
        h('small', null, 'Hear note'),
        currentCard && h('button', { className: 'btn-play-note', onClick: e => { e.stopPropagation(); audioEngine.playNote(currentCard.midi); } }, '🎵 Play')
      )
    ) 

    // Quality rating phase
    : h('div', { className: `feedback-card ${isCorrect ? 'success' : 'error'} elevated`, role: 'alert' },
      h('div', { className: 'feedback-header' },
        h('div', { className: `feedback-icon ${isCorrect ? 'success' : 'error'}` }, 
          isCorrect ? '✅' : '❌'
        ),
        h('h2', { className: 'feedback-note' }, currentCard.note),
        h('small', { className: 'feedback-answer' }, `You said: ${normalizeNote(userAnswer)}`)
      ),
      
      // 🎯 ML Quality Rating (1-5 SM-2)
      h('div', { 
        className: 'quality-buttons', 
        role: 'radiogroup', 
        'aria-label': 'Rate your recall quality',
        'aria-describedby': 'quality-help'
      },
        [1,2,3,4,5].map(q =>
          h('button', {
            key: q,
            className: `quality-btn q${q} ${quality === q ? 'active' : ''}`,
            onClick: () => setQualityRating(q),
            role: 'radio',
            'aria-checked': quality === q,
            'aria-label': `Quality ${q}: ${QUALITY_LABELS[q-1]}`,
            tabIndex: quality === q ? -1 : 0
          },
            h('span', { className: 'quality-number' }, q),
            h('small', { className: 'quality-label' }, QUALITY_LABELS[q-1])
          )
        )
      )
    ),

    // 🎯 Position Mastery Progress
    h('div', { className: 'position-mastery' },
      h('h3', null, 'Position Mastery'),
      h('div', { className: 'mastery-grid' },
        FLASHCARD_POSITIONS.map(pos =>
          h('div', { 
            key: pos.name, 
            className: `mastery-item ${masteryByPosition[pos.name.toLowerCase()]?.accuracy >= 90 ? 'mastered' : ''}`
          },
            h('strong', null, pos.name),
            h('div', { className: 'progress-bar small' },
              h('div', { 
                className: 'progress-fill', 
                style: { width: `${masteryByPosition[pos.name.toLowerCase()]?.accuracy || 0}%` }
              })
            ),
            h('small', null, `${masteryByPosition[pos.name.toLowerCase()]?.accuracy || 0}%`)
          )
        )
      )
    ),

    // Keyboard hints
    h('div', { className: 'keyboard-hints' },
      h('div', null, 
        h('kbd', null, '1-5'), 
        h('small', null, 'Quality rating')
      ),
      h('div', null, 
        h('kbd', null, 'SPACE'), 
        h('small', null, 'Play note')
      ),
      h('div', null, 
        h('kbd', null, 'N'), 
        h('small', null, 'Next card')
      )
    ),

    // Live session stats
    h('div', { className: 'session-status live' },
      h('span', { className: 'live-dot' }, '●'),
      h('small', null, `Session ${sessionRef.current} • ${config.notesPerSession} cards`)
    )
  );
}

// 🎯 Music Notation Helpers
function noteToLedgerY(note) {
  const noteMap = {
    'G3': 140, 'A3': 130, 'B3': 120, 'C4': 110, 'D4': 100, 'E4': 90,
    'F4': 80, 'G4': 70, 'A4': 60, 'B4': 50, 'C5': 40, 'D5': 30, 'E5': 20
  };
  return noteMap[note] || 100;
}

function renderLedgerLines(note) {
  const ledgerYs = [];
  const y = noteToLedgerY(note);
  
  if (y > 120) ledgerYs.push(y - 10);      // Below staff
  if (y < 30) ledgerYs.push(y + 10);       // Above staff
  
  return ledgerYs.map((ly, i) =>
    h('line', {
      key: `ledger-${i}`,
      x1: 180, y1: ly, x2: 260, y2: ly,
      stroke: 'var(--ink-light)', strokeWidth: 2,
      strokeLinecap: 'round'
    })
  );
}

function noteToMidi(note) {
  const noteMap = {
    'C4': 60, 'C#4': 61, 'D4': 62, 'D#4': 63, 'E4': 64, 'F4': 65,
    'F#4': 66, 'G4': 67, 'G#4': 68, 'A4': 69, 'A#4': 70, 'B4': 71,
    'C5': 72, 'C#5': 73, 'D5': 74, 'D#5': 75, 'E5': 76
  };
  return noteMap[note] || 60;
}

const QUALITY_LABELS = ['Forgot', 'Hard', 'Good', 'Easy', 'Perfect'];

function normalizeNote(note) {
  return note.replace(/[^A-Ga-g0-9#♯b♭]/g, '').replace('♯', '#').replace('♭', 'b').toUpperCase();
}

function generateNotesInRange(low, high) {
  const notes = [];
  // Implementation for note generation within range
  return notes;
}
