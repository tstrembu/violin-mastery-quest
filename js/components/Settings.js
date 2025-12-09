// ========================================================
// VMQ SETTINGS v2.0 - Theme, Accessibility, Smart Difficulty
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
import {
  setDifficulty,
  DIFFICULTY_SETTINGS
} from '../engines/difficultyAdapter.js';
import { PROFILE_TYPES } from '../config/constants.js';

export function Settings({ navigate, audioEngine, showToast }) {
  // Settings state
  const [settings, setSettings] = useState(() =>
    loadJSON(STORAGE_KEYS.SETTINGS, {
      muted: false,
      darkMode: false,
      highContrast: false,
      largeFonts: false,
      compactLayout: false
    })
  );

  // Profile state
  const [profile, setProfile] = useState(() => loadProfile());

  // Difficulty state (per mode)
  const [difficulties, setDifficulties] = useState(() =>
    loadJSON(STORAGE_KEYS.DIFFICULTY, {})
  );

  // Lightweight learning summary for smart recommendations
  const [learningSummary, setLearningSummary] = useState(null);
  const [recommendedDifficulty, setRecommendedDifficulty] = useState(null);

  const storageAvailable = isStorageAvailable();

  // ✨ Apply settings whenever they change
  useEffect(() => {
    saveJSON(STORAGE_KEYS.SETTINGS, settings);

    // Audio
    if (audioEngine && typeof audioEngine.setMute === 'function') {
      audioEngine.setMute(settings.muted);
    }

    // Theme / layout attributes + PWA shell sync
    applyThemeSettings(settings, storageAvailable);
  }, [settings, audioEngine, storageAvailable]);

  // 📊 Load learning summary once for smart difficulty
  useEffect(() => {
    try {
      const statsRaw = loadStats() || {};
      const xp = loadXP?.() ?? 0;
      const level = loadLevel?.() ?? 1;
      const streak = loadStreak?.() ?? 0;
      const achievements = loadAchievements?.() ?? [];

      const total =
        statsRaw.total ??
        statsRaw.totalQuestions ??
        0;
      const correct =
        statsRaw.correct ??
        statsRaw.correctAnswers ??
        0;

      const accuracy =
        total > 0 ? Math.round((correct / total) * 100) : null;

      const avgResponseTime =
        statsRaw.avgResponseTime ??
        statsRaw.avgTimeMs ??
        null;

      const summary = {
        total,
        correct,
        accuracy,
        avgResponseTime,
        xp,
        level,
        streak,
        achievementsCount: Array.isArray(achievements)
          ? achievements.length
          : achievements.unlocked?.length ?? 0
      };

      setLearningSummary(summary);

      // Heuristic “ML‑style” global difficulty suggestion:
      // - < 70% => easy
      // - 70–85% => medium
      // - > 85% => hard
      if (accuracy == null || total < 30) {
        setRecommendedDifficulty(null);
      } else if (accuracy < 70) {
        setRecommendedDifficulty('easy');
      } else if (accuracy < 86) {
        setRecommendedDifficulty('medium');
      } else {
        setRecommendedDifficulty('hard');
      }
    } catch (e) {
      // Fail soft; settings UI must always work.
      setLearningSummary(null);
      setRecommendedDifficulty(null);
    }
  }, []);

  /**
   * ✨ Apply theme and accessibility settings to DOM
   * Also sync to localStorage keys the shell reads (vmq-theme, vmq-font-size)
   */
  function applyThemeSettings(currentSettings, canPersist) {
    const html = document.documentElement;

    // Theme resolution
    let theme = 'light';
    if (currentSettings.darkMode) {
      theme = 'dark';
    } else if (currentSettings.highContrast) {
      theme = 'high-contrast';
    }

    html.setAttribute('data-theme', theme);

    // Persist theme for PWA shell bootstrap, if storage is available
    if (canPersist) {
      try {
        localStorage.setItem('vmq-theme', theme);
      } catch (e) {
        // Ignore quota / private mode errors
      }
    }

    // Large fonts
    if (currentSettings.largeFonts) {
      html.setAttribute('data-font-size', 'large');
      if (canPersist) {
        try {
          localStorage.setItem('vmq-font-size', 'large');
        } catch (e) {}
      }
    } else {
      html.removeAttribute('data-font-size');
      if (canPersist) {
        try {
          localStorage.removeItem('vmq-font-size');
        } catch (e) {}
      }
    }

    // Compact layout
    if (currentSettings.compactLayout) {
      html.setAttribute('data-layout', 'compact');
    } else {
      html.removeAttribute('data-layout');
    }

    // Broadcast settings change for other engines (session tracker, coach) if they listen
    try {
      window.dispatchEvent(
        new CustomEvent('vmq-settings-changed', {
          detail: { settings: currentSettings }
        })
      );
    } catch (e) {
      // Non‑critical
    }
  }

  /**
   * Toggle mute (bug‑fixed messaging)
   */
  function toggleMute() {
    const nextMuted = !settings.muted;
    setSettings((prev) => ({ ...prev, muted: nextMuted }));
    showToast?.(
      nextMuted ? '🔇 Sound muted' : '🔊 Sound enabled',
      'info'
    );
  }

  /**
   * ✨ Toggle dark mode
   */
  function toggleDarkMode() {
    const nextDark = !settings.darkMode;
    setSettings((prev) => ({
      ...prev,
      darkMode: nextDark,
      highContrast: false
    }));
    showToast?.(
      nextDark ? '🌙 Dark mode enabled' : '☀️ Light mode enabled',
      'info'
    );
  }

  /**
   * ✨ Toggle high contrast mode
   */
  function toggleHighContrast() {
    const next = !settings.highContrast;
    setSettings((prev) => ({
      ...prev,
      highContrast: next,
      darkMode: false
    }));
    showToast?.(
      next ? 'High contrast enabled' : 'High contrast disabled',
      'info'
    );
  }

  /**
   * ✨ Toggle large fonts
   */
  function toggleLargeFonts() {
    const next = !settings.largeFonts;
    setSettings((prev) => ({ ...prev, largeFonts: next }));
    showToast?.(
      next ? 'Large fonts enabled' : 'Normal fonts restored',
      'info'
    );
  }

  /**
   * ✨ Toggle compact layout
   */
  function toggleCompactLayout() {
    const next = !settings.compactLayout;
    setSettings((prev) => ({ ...prev, compactLayout: next }));
    showToast?.(
      next ? 'Compact layout enabled' : 'Normal layout restored',
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
    setDifficulties((prev) => ({ ...prev, [mode]: level }));
    showToast?.(`${mode} difficulty set to ${level}`, 'success');
  }

  /**
   * ⚙️ Auto‑calibrate difficulty from stats
   * Uses global accuracy heuristic to set all modes at once.
   */
  function autoCalibrateDifficulty() {
    if (!recommendedDifficulty) return;

    const level = recommendedDifficulty;
    const modes = Object.keys(DIFFICULTY_SETTINGS || {});

    if (!modes.length) return;

    modes.forEach((mode) => {
      handleDifficultyChange(mode, level);
    });

    showToast?.(
      `Difficulty auto-calibrated to ${capitalize(level)} based on your recent performance.`,
      'success'
    );
  }

  /**
   * ✨ Export all user data
   */
  function handleExport() {
    try {
      // Prefer centralized engine export if available
      if (typeof exportAllData === 'function') {
        exportAllData();
        showToast?.('Progress exported successfully', 'success');
        return;
      }
    } catch (e) {
      // Fall back to manual export below
    }

    const data = {
      profile: loadProfile(),
      xp: loadXP(),
      level: loadLevel(),
      streak: loadStreak(),
      achievements: loadAchievements(),
      stats: loadStats(),
      settings,
      difficulties,
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
    if (
      confirm(
        '⚠️ Are you sure? This will erase ALL progress data including XP, achievements, and stats. This cannot be undone.'
      )
    ) {
      clearAll();
      showToast?.('All progress reset', 'info');
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // Derived display for smart difficulty summary
  const difficultySummaryText =
    learningSummary && learningSummary.accuracy != null
      ? `Overall accuracy ${learningSummary.accuracy}% over ${learningSummary.total} questions`
      : 'Not enough data yet to suggest a difficulty.';

  return h(
    'div',
    { className: 'mode-container settings-mode' },
    // Header
    h(
      'header',
      { className: 'mode-header' },
      h(
        'button',
        {
          className: 'btn-back',
          onClick: () => navigate?.('menu')
        },
        '← Back'
      ),
      h('h2', null, '⚙️ Settings')
    ),

    // Main content
    h(
      'div',
      { className: 'mode-content settings-content' },

      // ✨ Profile Selection Section
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '🎓 Profile Level'),
        h(
          'p',
          {
            style: {
              fontSize: 'var(--font-size-sm)',
              color: 'var(--ink-light)',
              marginBottom: 'var(--space-md)'
            }
          },
          'Your profile helps customize practice goals and difficulty.'
        ),

        Object.values(PROFILE_TYPES).map((profileType) =>
          h(
            'label',
            {
              key: profileType.id,
              style: {
                display: 'flex',
                alignItems: 'center',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-sm)',
                background:
                  profile === profileType.id
                    ? '#e7f3ff'
                    : 'var(--bg)',
                border: `2px solid ${
                  profile === profileType.id
                    ? profileType.color
                    : 'var(--border)'
                }`,
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                transition: 'all var(--transition-base)'
              },
              onMouseEnter: (e) => {
                if (profile !== profileType.id) {
                  e.currentTarget.style.borderColor =
                    profileType.color;
                  e.currentTarget.style.background =
                    'var(--card)';
                }
              },
              onMouseLeave: (e) => {
                if (profile !== profileType.id) {
                  e.currentTarget.style.borderColor =
                    'var(--border)';
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
              style: {
                marginRight: 'var(--space-md)',
                accentColor: profileType.color
              }
            }),
            h(
              'div',
              null,
              h(
                'div',
                {
                  style: {
                    fontWeight: 'bold',
                    color: profileType.color,
                    marginBottom: 'var(--space-xs)'
                  }
                },
                profileType.label
              ),
              h(
                'div',
                {
                  style: {
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--ink-light)'
                  }
                },
                profileType.description
              )
            )
          )
        )
      ),

      // ✨ Appearance Section
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '🎨 Appearance'),

        h(
          'label',
          { className: 'setting-item' },
          h('span', null, 'Dark Mode'),
          h('input', {
            type: 'checkbox',
            checked: settings.darkMode,
            onChange: toggleDarkMode,
            'aria-label': 'Toggle dark mode'
          })
        ),

        h(
          'label',
          { className: 'setting-item' },
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
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '♿ Accessibility'),

        h(
          'label',
          { className: 'setting-item' },
          h('span', null, 'Large Fonts'),
          h('input', {
            type: 'checkbox',
            checked: settings.largeFonts,
            onChange: toggleLargeFonts,
            'aria-label': 'Toggle large fonts'
          })
        ),

        h(
          'label',
          { className: 'setting-item' },
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
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '🔊 Audio'),
        h(
          'label',
          { className: 'setting-item' },
          h('span', null, 'Mute all sounds'),
          h('input', {
            type: 'checkbox',
            checked: settings.muted,
            onChange: toggleMute,
            'aria-label': 'Toggle sound mute'
          })
        )
      ),

      // 📈 Smart Difficulty (uses stored stats)
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '🤖 Smart Difficulty (beta)'),
        h(
          'p',
          {
            style: {
              fontSize: 'var(--font-size-sm)',
              color: 'var(--ink-light)',
              marginBottom: 'var(--space-xs)'
            }
          },
          difficultySummaryText
        ),
        recommendedDifficulty &&
          h(
            'p',
            {
              style: {
                fontSize: 'var(--font-size-sm)',
                color: 'var(--ink-light)',
                marginBottom: 'var(--space-md)'
              }
            },
            `Recommended global level: ${capitalize(
              recommendedDifficulty
            )} (you can still override per module).`
          ),
        h(
          'button',
          {
            className: 'btn btn-secondary',
            onClick: autoCalibrateDifficulty,
            disabled: !recommendedDifficulty
          },
          'Auto-calibrate difficulty'
        )
      ),

      // Difficulty settings
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '📊 Difficulty Levels'),
        Object.keys(DIFFICULTY_SETTINGS).map((mode) =>
          h(
            'div',
            { key: mode, className: 'setting-item' },
            h(
              'label',
              null,
              mode.charAt(0).toUpperCase() + mode.slice(1)
            ),
            h(
              'select',
              {
                value: difficulties[mode] || 'easy',
                onChange: (e) =>
                  handleDifficultyChange(mode, e.target.value),
                className: 'select-difficulty',
                'aria-label': `Difficulty for ${mode}`
              },
              ['easy', 'medium', 'hard'].map((level) =>
                h(
                  'option',
                  { key: level, value: level },
                  level.charAt(0).toUpperCase() + level.slice(1)
                )
              )
            )
          )
        )
      ),

      // Data management
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '💾 Data Management'),

        // Storage status indicator
        !storageAvailable &&
          h(
            'div',
            {
              className: 'feedback feedback-warning',
              style: {
                marginBottom: 'var(--space-md)',
                fontSize: 'var(--font-size-sm)'
              }
            },
            '⚠️ Private browsing detected. Progress will reset when you close the app.'
          ),

        h(
          'p',
          {
            style: {
              fontSize: 'var(--font-size-sm)',
              color: 'var(--ink-light)',
              marginBottom: 'var(--space-md)'
            }
          },
          'Export your progress as a backup file, or reset to start fresh.'
        ),

        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: 'var(--space-md)',
              flexWrap: 'wrap'
            }
          },
          h(
            'button',
            {
              className: 'btn btn-secondary',
              onClick: handleExport
            },
            '📥 Export Progress'
          ),

          h(
            'button',
            {
              className: 'btn btn-danger',
              onClick: handleReset
            },
            '🗑️ Reset All Progress'
          )
        )
      ),

      // About
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, 'ℹ️ About'),
        h(
          'p',
          { className: 'about-text' },
          '🎻 Violin Mastery Quest v1.0.0'
        ),
        h(
          'p',
          { className: 'about-text' },
          'Built for serious young violinists. Pedagogy aligned with Ida Bieler Method and Suzuki tradition.'
        ),
        h(
          'p',
          {
            className: 'about-text',
            style: {
              fontSize: 'var(--font-size-sm)',
              color: 'var(--ink-lighter)',
              marginTop: 'var(--space-md)'
            }
          },
          `Storage: ${
            storageAvailable
              ? '✅ Available'
              : '⚠️ Unavailable (Private Mode)'
          }`
        )
      )
    )
  );
}

export default Settings;
