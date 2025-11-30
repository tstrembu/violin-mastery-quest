// ========================================================
// VMQ SETTINGS - Complete with Theme & Accessibility Toggles
// ========================================================

const { createElement: h, useState, useEffect } = React;
import { STORAGE_KEYS, loadJSON, saveJSON, clearAll, exportData, isStorageAvailable } from '../config/storage.js';
import { setDifficulty, DIFFICULTY_SETTINGS } from '../engines/difficultyAdapter.js';

export function Settings({ onBack, audioEngine, showToast }) {
  const [settings, setSettings] = useState(() => loadJSON(STORAGE_KEYS.SETTINGS, {
    muted: false,
    darkMode: false,
    highContrast: false,
    largeFonts: false,
    compactLayout: false
  }));

  const [difficulties, setDifficulties] = useState(() => loadJSON(STORAGE_KEYS.DIFFICULTY, {}));

  // ✨ Apply settings whenever they change
  useEffect(() => {
    saveJSON(STORAGE_KEYS.SETTINGS, settings);
    audioEngine.setMute(settings.muted);
    applyThemeSettings(settings);
  }, [settings]);

  /**
   * ✨ Apply theme and accessibility settings to DOM
   */
  function applyThemeSettings(settings) {
    const html = document.documentElement;

    // Dark mode
    if (settings.darkMode) {
      html.setAttribute('data-theme', 'dark');
    } else if (settings.highContrast) {
      html.setAttribute('data-theme', 'high-contrast');
    } else {
      html.setAttribute('data-theme', 'light');
    }

    // Large fonts
    if (settings.largeFonts) {
      html.setAttribute('data-font-size', 'large');
    } else {
      html.removeAttribute('data-font-size');
    }

    // Compact layout
    if (settings.compactLayout) {
      html.setAttribute('data-layout', 'compact');
    } else {
      html.removeAttribute('data-layout');
    }
  }

  /**
   * Toggle mute
   */
  function toggleMute() {
    setSettings(prev => ({ ...prev, muted: !prev.muted }));
    showToast?.(settings.muted ? '🔊 Sound enabled' : '🔇 Sound muted', 'info');
  }

  /**
   * ✨ Toggle dark mode
   */
  function toggleDarkMode() {
    setSettings(prev => ({ 
      ...prev, 
      darkMode: !prev.darkMode,
      highContrast: false // Disable high contrast when toggling dark mode
    }));
    showToast?.(!settings.darkMode ? '🌙 Dark mode enabled' : '☀️ Light mode enabled', 'info');
  }

  /**
   * ✨ Toggle high contrast mode
   */
  function toggleHighContrast() {
    setSettings(prev => ({ 
      ...prev, 
      highContrast: !prev.highContrast,
      darkMode: false // Disable dark mode when enabling high contrast
    }));
    showToast?.(
      !settings.highContrast ? 'High contrast enabled' : 'High contrast disabled', 
      'info'
    );
  }

  /**
   * ✨ Toggle large fonts
   */
  function toggleLargeFonts() {
    setSettings(prev => ({ ...prev, largeFonts: !prev.largeFonts }));
    showToast?.(
      !settings.largeFonts ? 'Large fonts enabled' : 'Normal fonts restored', 
      'info'
    );
  }

  /**
   * ✨ Toggle compact layout
   */
  function toggleCompactLayout() {
    setSettings(prev => ({ ...prev, compactLayout: !prev.compactLayout }));
    showToast?.(
      !settings.compactLayout ? 'Compact layout enabled' : 'Normal layout restored', 
      'info'
    );
  }

  /**
   * Change difficulty for a mode
   */
  function handleDifficultyChange(mode, level) {
    setDifficulty(mode, level);
    setDifficulties(prev => ({ ...prev, [mode]: level }));
    showToast?.(`${mode} difficulty set to ${level}`, 'success');
  }

  /**
   * Reset all progress
   */
  function handleReset() {
    if (confirm('Are you sure? This will erase all progress data.')) {
      clearAll();
      showToast?.('All progress reset', 'info');
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  /**
   * Export data
   */
  function handleExport() {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vmq-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('Progress exported', 'success');
  }

  const storageAvailable = isStorageAvailable();

  return h('div', { className: 'mode-container settings-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h2', null, '⚙️ Settings')
    ),

    // Main content
    h('div', { className: 'mode-content settings-content' },
      
      // ✨ Appearance Section
      h('section', { className: 'settings-section' },
        h('h3', null, 'Appearance'),
        
        h('label', { className: 'setting-item' },
          h('span', null, 'Dark Mode'),
          h('input', {
            type: 'checkbox',
            checked: settings.darkMode,
            onChange: toggleDarkMode,
            'aria-label': 'Toggle dark mode'
          })
        ),

        h('label', { className: 'setting-item' },
          h('span', null, 'High Contrast'),
          h('input', {
            type: 'checkbox',
            checked: settings.highContrast,
            onChange: toggleHighContrast,
            'aria-label': 'Toggle high contrast mode'
          })
        )
      ),

      // ✨ Accessibility Section
      h('section', { className: 'settings-section' },
        h('h3', null, 'Accessibility'),
        
        h('label', { className: 'setting-item' },
          h('span', null, 'Large Fonts'),
          h('input', {
            type: 'checkbox',
            checked: settings.largeFonts,
            onChange: toggleLargeFonts,
            'aria-label': 'Toggle large fonts'
          })
        ),

        h('label', { className: 'setting-item' },
          h('span', null, 'Compact Layout'),
          h('input', {
            type: 'checkbox',
            checked: settings.compactLayout,
            onChange: toggleCompactLayout,
            'aria-label': 'Toggle compact layout'
          })
        )
      ),

      // Audio settings
      h('section', { className: 'settings-section' },
        h('h3', null, 'Audio'),
        h('label', { className: 'setting-item' },
          h('span', null, 'Mute all sounds'),
          h('input', {
            type: 'checkbox',
            checked: settings.muted,
            onChange: toggleMute,
            'aria-label': 'Toggle sound mute'
          })
        )
      ),

      // Difficulty settings
      h('section', { className: 'settings-section' },
        h('h3', null, 'Difficulty Levels'),
        Object.keys(DIFFICULTY_SETTINGS).map(mode =>
          h('div', { key: mode, className: 'setting-item' },
            h('label', null, mode.charAt(0).toUpperCase() + mode.slice(1)),
            h('select', {
              value: difficulties[mode] || 'easy',
              onChange: (e) => handleDifficultyChange(mode, e.target.value),
              className: 'select-difficulty',
              'aria-label': `Difficulty for ${mode}`
            },
              ['easy', 'medium', 'hard'].map(level =>
                h('option', { key: level, value: level }, 
                  level.charAt(0).toUpperCase() + level.slice(1)
                )
              )
            )
          )
        )
      ),

      // Data management
      h('section', { className: 'settings-section' },
        h('h3', null, 'Data Management'),
        
        // Storage status indicator
        !storageAvailable && h('div', { 
          className: 'feedback feedback-warning',
          style: { marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }
        }, '⚠️ Private browsing detected. Progress will reset when you close the app.'),

        h('button', {
          className: 'btn btn-secondary',
          onClick: handleExport
        }, '📥 Export Progress'),
        
        h('button', {
          className: 'btn btn-danger',
          onClick: handleReset,
          style: { marginTop: '10px' }
        }, '🗑️ Reset All Progress')
      ),

      // About
      h('section', { className: 'settings-section' },
        h('h3', null, 'About'),
        h('p', { className: 'about-text' },
          'Violin Mastery Quest v1.0.0'
        ),
        h('p', { className: 'about-text' },
          'Built for serious young violinists. Pedagogy aligned with Ida Bieler Method and Suzuki tradition.'
        ),
        h('p', { className: 'about-text', style: { fontSize: 'var(--font-size-sm)', color: 'var(--ink-lighter)' } },
          `Storage: ${storageAvailable ? 'Available' : 'Unavailable (Private Mode)'}`
        )
      )
    )
  );
}
