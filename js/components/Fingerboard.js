// ============================================================
// VMQ FINGERBOARD - SVG Fingerboard Visualization
// ============================================================

const { createElement: h, useState } = React;
import { FINGERBOARD_CONFIG, midiToNoteName } from '../config/constants.js';

export function Fingerboard({ onBack }) {
  const [selectedPosition, setSelectedPosition] = useState(1);
  const [highlightedNote, setHighlightedNote] = useState(null);

  const { strings, stringMidi, positions } = FINGERBOARD_CONFIG;

  /**
   * Get note for a specific position
   * @param {string} stringName - String name (G, D, A, or E)
   * @param {number} position - Position number (1-10)
   * @param {number} finger - Finger number (1-4)
   * @returns {string} Note name
   */
  function getNote(stringName, position, finger) {
    const openMidi = stringMidi[stringName];
    const semitones = (position - 1) * 2 + (finger - 1); // Simplified position model
    return midiToNoteName(openMidi + semitones);
  }

  /**
   * Handle position selection
   */
  function handlePositionClick(position) {
    setSelectedPosition(position);
    setHighlightedNote(null);
  }

  /**
   * Handle note hover/click
   */
  function handleNoteClick(stringName, finger) {
    const note = getNote(stringName, selectedPosition, finger);
    setHighlightedNote({ string: stringName, finger, note });
  }

  return h('div', { className: 'mode-container fingerboard-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { 
        className: 'btn-back', 
        onClick: onBack,
        'aria-label': 'Back to main menu'
      }, '← Back'),
      h('h2', null, '🎯 Fingerboard Reference')
    ),

    // Main content
    h('div', { className: 'mode-content' },
      h('div', { className: 'fingerboard-controls' },
        h('label', null, `Position: ${selectedPosition}`),
        h('div', { className: 'position-buttons' },
          positions.map(pos =>
            h('button', {
              key: pos,
              className: `btn-position ${pos === selectedPosition ? 'active' : ''}`,
              onClick: () => handlePositionClick(pos),
              'aria-label': `Position ${pos}`,
              'aria-pressed': pos === selectedPosition
            }, pos)
          )
        )
      ),

      // SVG Fingerboard
      h('svg', {
        className: 'fingerboard-svg',
        viewBox: '0 0 400 600',
        xmlns: 'http://www.w3.org/2000/svg',
        role: 'img',
        'aria-label': 'Violin fingerboard diagram showing notes in each position'
      },
        // Strings (G, D, A, E from left to right)
        strings.map((stringName, stringIdx) => {
          const x = 100 + stringIdx * 70; // Left to right: G=100, D=170, A=240, E=310
          return h('g', { key: stringName },
            // String line
            h('line', {
              x1: x, y1: 50,
              x2: x, y2: 550,
              stroke: '#666',
              strokeWidth: 2
            }),
            // String label at top
            h('text', {
              x, y: 30,
              textAnchor: 'middle',
              fontSize: 16,
              fontWeight: 'bold',
              fill: '#333'
            }, `${stringName}`)
          );
        }),

        // Fingers for selected position
        strings.map((stringName, stringIdx) => {
          const x = 100 + stringIdx * 70;
          return [1, 2, 3, 4].map(finger => {
            const y = 100 + (selectedPosition - 1) * 40 + (finger - 1) * 40;
            const note = getNote(stringName, selectedPosition, finger);
            const isHighlighted = highlightedNote?.string === stringName && highlightedNote?.finger === finger;

            return h('g', { key: `${stringName}-${finger}` },
              // Finger circle
              h('circle', {
                cx: x,
                cy: y,
                r: 15,
                fill: isHighlighted ? '#4a90e2' : '#e0e0e0',
                stroke: '#333',
                strokeWidth: 1,
                style: { cursor: 'pointer' },
                onClick: () => handleNoteClick(stringName, finger),
                role: 'button',
                'aria-label': `Finger ${finger} on ${stringName} string, note ${note}`
              }),
              // Finger number
              h('text', {
                x, y: y + 5,
                textAnchor: 'middle',
                fontSize: 12,
                fontWeight: 'bold',
                fill: '#000',
                style: { pointerEvents: 'none' }
              }, finger),
              // Note name (if highlighted)
              isHighlighted && h('text', {
                x: x + 25,
                y: y + 5,
                fontSize: 14,
                fontWeight: 'bold',
                fill: '#4a90e2'
              }, note)
            );
          });
        })
      ),

      // Info display
      highlightedNote && h('div', { 
        className: 'fingerboard-info',
        role: 'status',
        'aria-live': 'polite'
      },
        h('p', null,
          `Position ${selectedPosition}, Finger ${highlightedNote.finger} on ${highlightedNote.string} string: `,
          h('strong', null, highlightedNote.note)
        )
      ),

      h('div', { className: 'fingerboard-hint' },
        'Tap any circle to see the note name. Strings shown from violinist\'s perspective: G (left) to E (right).'
      )
    )
  );
}
