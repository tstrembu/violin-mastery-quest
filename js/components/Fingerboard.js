/**
 * Fingerboard Trainer - ENHANCED VERSION
 * Position and note location training with Bieler hand-frame integration
 */

import { useState, useEffect } from 'react';
import { FINGERBOARD_NOTES } from '../config/constants.js';
import { playNote } from '../engines/audioEngine.js';
import { awardXP, incrementDailyItems } from '../engines/gamification.js';
import { updateStats } from '../config/storage.js';

export default function Fingerboard({ navigate, showToast }) {
  const [mode, setMode] = useState('position'); // 'position' or 'noteIdentify'
  const [selectedString, setSelectedString] = useState('G');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [hintsUsed, setHintsUsed] = useState(0);
  const [potentialXP, setPotentialXP] = useState(20);

  useEffect(() => {
    generateQuestion();
  }, [mode, selectedString]);

  const generateQuestion = () => {
    const stringNotes = FINGERBOARD_NOTES[selectedString];
    
    if (mode === 'position') {
      // Ask: "Which finger plays this note in 1st position?"
      const firstPositionNotes = stringNotes.filter(n => n.position === 1);
      const question = firstPositionNotes[Math.floor(Math.random() * firstPositionNotes.length)];
      
      // Generate options (fingers 0-4)
      const correctFinger = question.finger;
      const allFingers = [0, 1, 2, 3, 4];
      const wrongFingers = allFingers.filter(f => f !== correctFinger);
      const selectedWrong = wrongFingers.sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [correctFinger, ...selectedWrong].sort(() => Math.random() - 0.5);
      
      setCurrentQuestion(question);
      setOptions(opts);
    } else {
      // Ask: "What note is played by finger X in position Y?"
      const question = stringNotes[Math.floor(Math.random() * stringNotes.length)];
      
      // Generate note options
      const allNotes = Array.from(new Set(stringNotes.map(n => n.note)));
      const wrongNotes = allNotes.filter(n => n !== question.note);
      const selectedWrong = wrongNotes.sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [question.note, ...selectedWrong].sort(() => Math.random() - 0.5);
      
      setCurrentQuestion(question);
      setOptions(opts);
    }
    
    setShowFeedback(false);
    setHintsUsed(0);
    setPotentialXP(20);
  };

  const handleAnswer = (answer) => {
    const correct = mode === 'position' 
      ? answer === currentQuestion.finger
      : answer === currentQuestion.note;
    
    const newStats = {
      correct: stats.correct + (correct ? 1 : 0),
      total: stats.total + 1
    };
    setStats(newStats);
    
    // Update global stats
    updateStats('fingerboard', correct);
    
    if (correct) {
      const xpAwarded = potentialXP;
      const result = awardXP(xpAwarded, 'Fingerboard correct answer');
      incrementDailyItems();
      showToast(`✓ Correct! +${xpAwarded} XP`, 'success');
      
      // Wait a moment then generate new question
      setTimeout(() => generateQuestion(), 1500);
    } else {
      showToast('Not quite. Try again!', 'error');
    }
    
    setShowFeedback(true);
  };

  const playCurrentNote = () => {
    if (currentQuestion) {
      playNote(currentQuestion.midi);
    }
  };

  const getHint = () => {
    if (hintsUsed >= 2) return;
    
    setHintsUsed(hintsUsed + 1);
    setPotentialXP(Math.max(5, potentialXP - 10));
    
    if (hintsUsed === 0) {
      // First hint: position info
      showToast(`Position: ${currentQuestion.position}`, 'info');
    } else {
      // Second hint: hand frame context
      const handFrameInfo = getHandFrameContext(currentQuestion);
      showToast(handFrameInfo, 'info');
    }
  };

  const getHandFrameContext = (note) => {
    if (note.position === 1) {
      if (note.finger <= 2) {
        return 'Lower hand frame (1-2-3 pattern)';
      } else {
        return 'Upper hand frame (1-2-34 pattern)';
      }
    } else if (note.position === 3) {
      return '3rd position - shift from 1st position';
    }
    return `Position ${note.position}`;
  };

  const getFingerName = (finger) => {
    const names = ['Open', '1st', '2nd', '3rd', '4th'];
    return names[finger] || finger;
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return React.createElement('div', { className: 'container' },
    React.createElement('h2', null, '🎻 Fingerboard Trainer'),
    
    // Mode Selection
    React.createElement('div', { className: 'card', style: { marginBottom: '16px' } },
      React.createElement('h3', null, 'Training Mode'),
      React.createElement('div', { style: { display: 'flex', gap: '12px' } },
        React.createElement('button', {
          className: mode === 'position' ? 'btn-primary' : 'btn-outline',
          onClick: () => setMode('position')
        }, 'Find the Finger'),
        React.createElement('button', {
          className: mode === 'noteIdentify' ? 'btn-primary' : 'btn-outline',
          onClick: () => setMode('noteIdentify')
        }, 'Identify the Note')
      )
    ),
    
    // String Selection
    React.createElement('div', { className: 'card', style: { marginBottom: '16px' } },
      React.createElement('h3', null, 'Select String'),
      React.createElement('div', { style: { display: 'flex', gap: '12px' } },
        ['E', 'A', 'D', 'G'].map(string =>
          React.createElement('button', {
            key: string,
            className: selectedString === string ? 'btn-primary' : 'btn-outline',
            onClick: () => setSelectedString(string)
          }, `${string} String`)
        )
      )
    ),
    
    // Question Card
    currentQuestion && React.createElement('div', { className: 'card', style: { marginBottom: '16px' } },
      React.createElement('h3', null, 
        mode === 'position'
          ? `Which finger plays ${currentQuestion.note}${currentQuestion.octave} on the ${selectedString} string?`
          : `What note is played by ${getFingerName(currentQuestion.finger)} finger in position ${currentQuestion.position}?`
      ),
      
      // Play Note Button
      React.createElement('button', {
        className: 'btn-info',
        onClick: playCurrentNote,
        style: { marginBottom: '16px' }
      }, '🔊 Play Note'),
      
      // Bieler Context
      React.createElement('div', {
        style: {
          padding: '12px',
          background: '#e7f3ff',
          borderLeft: '4px solid #007bff',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '0.9rem'
        }
      },
        React.createElement('strong', null, 'Bieler Context: '),
        getHandFrameContext(currentQuestion)
      ),
      
      // Options
      React.createElement('div', { className: 'answer-grid' },
        options.map(opt =>
          React.createElement('button', {
            key: opt,
            className: 'btn-secondary',
            onClick: () => handleAnswer(opt),
            disabled: showFeedback
          }, mode === 'position' ? getFingerName(opt) : opt)
        )
      ),
      
      // Hints & Actions
      React.createElement('div', {
        style: {
          marginTop: '16px',
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between'
        }
      },
        React.createElement('button', {
          className: 'btn-outline',
          onClick: getHint,
          disabled: hintsUsed >= 2
        }, `💡 Hint (${hintsUsed}/2)`),
        React.createElement('div', { className: 'small' },
          `Potential XP: ${potentialXP}`
        )
      )
    ),
    
    // Stats
    React.createElement('div', { className: 'card', style: { marginBottom: '16px' } },
      React.createElement('h3', null, 'Session Stats'),
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          textAlign: 'center'
        }
      },
        React.createElement('div', null,
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Accuracy'),
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' } },
            `${accuracy}%`
          )
        ),
        React.createElement('div', null,
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Correct'),
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#007bff' } },
            stats.correct
          )
        ),
        React.createElement('div', null,
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Total'),
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold' } },
            stats.total
          )
        )
      )
    ),
    
    // Position Reference
    React.createElement('div', { className: 'card' },
      React.createElement('h3', null, 'Position Reference'),
      React.createElement('div', { style: { fontSize: '0.9rem', lineHeight: 1.8 } },
        React.createElement('p', null,
          React.createElement('strong', null, '1st Position: '),
          'Most common position, hand frame at top of fingerboard'
        ),
        React.createElement('p', null,
          React.createElement('strong', null, '3rd Position: '),
          'Shift up from 1st, commonly used in intermediate repertoire'
        ),
        React.createElement('p', null,
          React.createElement('strong', null, 'Hand Frame Patterns: '),
          '1-2-3-4 (whole steps) or 1-2-34 (half step between 3-4)'
        ),
        React.createElement('p', {
          style: {
            marginTop: '12px',
            padding: '12px',
            background: '#fff3cd',
            borderRadius: '4px',
            borderLeft: '4px solid #ffc107'
          }
        },
          React.createElement('strong', null, 'Bieler Technique: '),
          'Focus on hand frame integrity and smooth shifts. Thumb releases during shifts, fingers maintain their relative positions.'
        )
      )
    ),
    
    // Navigation
    React.createElement('div', {
      style: {
        marginTop: '24px',
        display: 'flex',
        gap: '12px'
      }
    },
      React.createElement('button', {
        className: 'btn-primary',
        onClick: () => navigate('dashboard')
      }, '← Back to Dashboard'),
      React.createElement('button', {
        className: 'btn-secondary',
        onClick: () => navigate('menu')
      }, 'Main Menu')
    )
  );
}