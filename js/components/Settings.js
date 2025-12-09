PROMPT: Please review and analyze the module (part of the Violin Mastery Quest app hosted on GitHub) below. When making improvements, optimizations, please consider the entire app, preserve/build upon original functionality, add/improve sophisticated learning analytics/machine learning where applicable, as well as any other improvements, enhancements, optimizations, deeper integrations, etc. that significantly boost user enjoyment/engagement and their ability to learn/retain/apply. Please provide fully developed and complete code that is fully functional with the app as drop-in code.

Original file:

### ** `js/components/ Settings.js`** 


// ========================================================
// VMQ SETTINGS - Complete with Theme & Accessibility Toggles
// ========================================================

const { createElement: h, useState, useEffect } = React;

// Imports
import { 
  STORAGE_KEYS, 
  loadJSON, 
  saveJSON, 
  clearAll, 
  exportData as exportAllData,
  isStorageAvailable,
  loadProfile,
  saveProfile,
  loadXP,
  loadLevel,
  loadStreak,
  loadAchievements,
  loadStats
} from '../config/storage.js';
import { setDifficulty, DIFFICULTY_SETTINGS } from '../engines/difficultyAdapter.js';
import { PROFILE_TYPES } from '../config/constants.js';

export function Settings({ navigate, audioEngine, showToast }) {
  // Settings state
  const [settings, setSettings] = useState(() => loadJSON(STORAGE_KEYS.SETTINGS, {
    muted: false,
    darkMode: false,
    highContrast: false,
    largeFonts: false,
    compactLayout: false
  }));

  // Profile state
  const [profile, setProfile] = useState(() => loadProfile());

  // Difficulty state
  const [difficulties, setDifficulties] = useState(() => loadJSON(STORAGE_KEYS.DIFFICULTY, {}));

  // ✨ Apply settings whenever they change
  useEffect(() => {
    saveJSON(STORAGE_KEYS.SETTINGS, settings);
    if (audioEngine && audioEngine.setMute) {
      audioEngine.setMute(settings.muted);
    }
    applyThemeSettings(settings);
  }, [settings]);

  /**
   * ✨ Apply theme and accessibility settings to DOM
   */
  function applyThemeSettings(settings) {
    const html = document.documentElement;

    // Theme
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
      highContrast: false
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
      darkMode: false
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
   * ✨ Handle profile change
   */
  function handleProfileChange(newProfile) {
    setProfile(newProfile);
    saveProfile(newProfile);
    document.body.setAttribute('data-profile', newProfile);
    showToast?.('Profile updated', 'success');
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
   * ✨ Export all user data
   */
  function handleExport() {
    const data = {
      profile: loadProfile(),
      xp: loadXP(),
      level: loadLevel(),
      streak: loadStreak(),
      achievements: loadAchievements(),
      stats: loadStats(),
      settings: settings,
      difficulties: difficulties,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vmq-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast?.('Progress exported successfully', 'success');
  }

  /**
   * Reset all progress
   */
  function handleReset() {
    if (confirm('⚠️ Are you sure? This will erase ALL progress data including XP, achievements, and stats. This cannot be undone.')) {
      clearAll();
      showToast?.('All progress reset', 'info');
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  const storageAvailable = isStorageAvailable();

  return h('div', { className: 'mode-container settings-mode' },
    // Header
    h('header', { className: 'mode-header' },
      h('button', { 
        className: 'btn-back', 
        onClick: () => navigate('menu') 
      }, '← Back'),
      h('h2', null, '⚙️ Settings')
    ),

    // Main content
    h('div', { className: 'mode-content settings-content' },
      
      // ✨ Profile Selection Section
      h('section', { className: 'settings-section' },
        h('h3', null, '🎓 Profile Level'),
        h('p', { 
          style: { 
            fontSize: 'var(--font-size-sm)', 
            color: 'var(--ink-light)',
            marginBottom: 'var(--space-md)'
          } 
        }, 'Your profile helps customize practice goals and difficulty.'),
        
        Object.values(PROFILE_TYPES).map(profileType =>
          h('label', {
            key: profileType.id,
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-sm)',
              background: profile === profileType.id ? '#e7f3ff' : 'var(--bg)',
              border: `2px solid ${profile === profileType.id ? profileType.color : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              transition: 'all var(--transition-base)'
            },
            onMouseEnter: (e) => {
              if (profile !== profileType.id) {
                e.currentTarget.style.borderColor = profileType.color;
                e.currentTarget.style.background = 'var(--card)';
              }
            },
            onMouseLeave: (e) => {
              if (profile !== profileType.id) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg)';
              }
            }
          },
            h('input', {
              type: 'radio',
              name: 'profile',
              value: profileType.id,
              checked: profile === profileType.id,
              onChange: () => handleProfileChange(profileType.id),
              style: { marginRight: 'var(--space-md)', accentColor: profileType.color }
            }),
            h('div', null,
              h('div', { 
                style: { 
                  fontWeight: 'bold',
                  color: profileType.color,
                  marginBottom: 'var(--space-xs)'
                } 
              }, profileType.label),
              h('div', { 
                style: { 
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--ink-light)'
                }
              }, profileType.description)
            )
          )
        )
      ),
      
      // ✨ Appearance Section
      h('section', { className: 'settings-section' },
        h('h3', null, '🎨 Appearance'),
        
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
        h('h3', null, '♿ Accessibility'),
        
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
        h('h3', null, '🔊 Audio'),
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
        h('h3', null, '📊 Difficulty Levels'),
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
        h('h3', null, '💾 Data Management'),
        
        // Storage status indicator
        !storageAvailable && h('div', { 
          className: 'feedback feedback-warning',
          style: { marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }
        }, '⚠️ Private browsing detected. Progress will reset when you close the app.'),

        h('p', {
          style: {
            fontSize: 'var(--font-size-sm)',
            color: 'var(--ink-light)',
            marginBottom: 'var(--space-md)'
          }
        }, 'Export your progress as a backup file, or reset to start fresh.'),

        h('div', { style: { display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' } },
          h('button', {
            className: 'btn btn-secondary',
            onClick: handleExport
          }, '📥 Export Progress'),
          
          h('button', {
            className: 'btn btn-danger',
            onClick: handleReset
          }, '🗑️ Reset All Progress')
        )
      ),

      // About
      h('section', { className: 'settings-section' },
        h('h3', null, 'ℹ️ About'),
        h('p', { className: 'about-text' },
          '🎻 Violin Mastery Quest v1.0.0'
        ),
        h('p', { className: 'about-text' },
          'Built for serious young violinists. Pedagogy aligned with Ida Bieler Method and Suzuki tradition.'
        ),
        h('p', { 
          className: 'about-text', 
          style: { 
            fontSize: 'var(--font-size-sm)', 
            color: 'var(--ink-lighter)',
            marginTop: 'var(--space-md)'
          } 
        }, `Storage: ${storageAvailable ? '✅ Available' : '⚠️ Unavailable (Private Mode)'}`)
      )
    )
  );
}

export default Settings;
}
