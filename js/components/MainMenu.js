// ========================================================
// VMQ MAIN MENU - Home Screen
// ========================================================

const { createElement: h } = React;
import { calculateAccuracy } from '../utils/helpers.js';

export function MainMenu({ stats, onSelectMode }) {
  const accuracy = calculateAccuracy(stats.correct, stats.total);

  return h('div', { className: 'main-menu' },
    // Header
    h('header', { className: 'menu-header' },
      h('h1', { className: 'app-title' }, '🎻 Violin Mastery Quest'),
      h('p', { className: 'app-subtitle' }, 'Adaptive practice for serious young violinists')
    ),

    // Stats summary
    h('div', { className: 'stats-summary' },
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-value' }, stats.total || 0),
        h('div', { className: 'stat-label' }, 'Questions')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-value' }, stats.correct || 0),
        h('div', { className: 'stat-label' }, 'Correct')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-value' }, `${accuracy}%`),
        h('div', { className: 'stat-label' }, 'Accuracy')
      )
    ),

    // ✅ NEW: Quick Actions
    h('div', { 
      style: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      } 
    },
      h('button', {
        className: 'btn btn-primary',
        onClick: () => onSelectMode('dashboard')
      }, '📊 Dashboard'),
      
      h('button', {
        className: 'btn btn-primary',
        onClick: () => onSelectMode('practicePlanner')
      }, '📝 Practice Planner'),
      
      h('button', {
        className: 'btn btn-secondary',
        onClick: () => onSelectMode('analytics')
      }, '📈 Analytics')
    ),

    // Mode buttons
    h('div', { className: 'mode-grid' },
      h('button', {
        className: 'mode-card mode-card-primary',
        onClick: () => onSelectMode('intervals')
      },
        h('div', { className: 'mode-icon' }, '🎵'),
        h('div', { className: 'mode-title' }, 'Intervals'),
        h('div', { className: 'mode-description' }, 'Ear training with melodic intervals')
      ),

      h('button', {
        className: 'mode-card mode-card-primary',
        onClick: () => onSelectMode('keySignatures')
      },
        h('div', { className: 'mode-icon' }, '🎼'),
        h('div', { className: 'mode-title' }, 'Key Signatures'),
        h('div', { className: 'mode-description' }, 'Learn keys and Bieler hand maps')
      ),

      h('button', {
        className: 'mode-card mode-card-primary',
        onClick: () => onSelectMode('flashcards')
      },
        h('div', { className: 'mode-icon' }, '📝'),
        h('div', { className: 'mode-title' }, 'Note Reading'),
        h('div', { className: 'mode-description' }, 'Quick note name identification')
      ),

      h('button', {
        className: 'mode-card mode-card-primary',
        onClick: () => onSelectMode('bieler')
      },
        h('div', { className: 'mode-icon' }, '🎻'),
        h('div', { className: 'mode-title' }, 'Bieler Technique'),
        h('div', { className: 'mode-description' }, 'Bow strokes and trained functions')
      ),

      h('button', {
        className: 'mode-card mode-card-secondary',
        onClick: () => onSelectMode('rhythm')
      },
        h('div', { className: 'mode-icon' }, '🥁'),
        h('div', { className: 'mode-title' }, 'Rhythm'),
        h('div', { className: 'mode-description' }, 'Pattern recognition and timing')
      ),

      h('button', {
        className: 'mode-card mode-card-secondary',
        onClick: () => onSelectMode('fingerboard')
      },
        h('div', { className: 'mode-icon' }, '🎯'),
        h('div', { className: 'mode-title' }, 'Fingerboard'),
        h('div', { className: 'mode-description' }, 'Position visualization tool')
      )
    ),

    // Settings button
    h('button', {
      className: 'btn btn-secondary settings-btn',
      onClick: () => onSelectMode('settings')
    }, '⚙️ Settings')
  );
}

export default MainMenu;
