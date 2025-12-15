// js/components/Settings.js
// ========================================================
// VMQ SETTINGS v2.1.5 - Theme, Accessibility, Smart Difficulty
// (Drop-in replacement: removes dependency on undefined storage helpers)
// ========================================================

import {
  STORAGE_KEYS,
  loadJSON,
  saveJSON,
  storage,          // <-- exported in your storage.js
  cleanupAllData    // <-- exported in your storage.js
} from '../config/storage.js';

import { setDifficulty, DIFFICULTY_SETTINGS } from '../engines/difficultyAdapter.js';
import { PROFILE_TYPES } from '../config/constants.js';

const { createElement: h, useState, useEffect, useMemo } = React;

// Canonical keys only (let storage.js handle legacy migration/candidates)
const KEY_PROFILE      = STORAGE_KEYS.PROFILE;
const KEY_SETTINGS     = STORAGE_KEYS.SETTINGS;
const KEY_DIFFICULTY   = STORAGE_KEYS.DIFFICULTY;
const KEY_ACHIEVEMENTS = STORAGE_KEYS.ACHIEVEMENTS;
const KEY_STATS        = STORAGE_KEYS.STATS;
const KEY_ANALYTICS    = STORAGE_KEYS.ANALYTICS;

const KEY_XP     = STORAGE_KEYS.XP;
const KEY_STREAK = STORAGE_KEYS.STREAK;

// Local helper (since isStorageAvailable is not exported in your storage.js)
function isStorageAvailableSafe() {
  try {
    const k = '__vmq_storage_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

// --------------------------
// Defaults
// --------------------------
const DEFAULT_SETTINGS = {
  muted: false,
  darkMode: false,
  highContrast: false,
  largeFonts: false,
  compactLayout: false
};

const DEFAULT_PROFILE = {
  name: '',
  level: 'beginner',
  goals: [],
  preferredTime: 'flexible',
  practiceMinutes: 20,
  repertoire: 'suzuki1',
  onboardingComplete: false
};

// --------------------------
// Safe loaders (no missing imports)
// --------------------------
function loadProfileSafe() {
  const p = loadJSON(KEY_PROFILE, DEFAULT_PROFILE);
  return (p && typeof p === 'object') ? { ...DEFAULT_PROFILE, ...p } : { ...DEFAULT_PROFILE };
}

function saveProfileSafe(profile) {
  saveJSON(KEY_PROFILE, profile);
}

function loadGamificationSafe() {
  const g = loadJSON(KEY_GAMIFICATION, null);
  if (g && typeof g === 'object') return g;

  // Back-compat: some builds store these separately
  const xp = loadJSON(KEY('XP', 'vmq_xp'), null);
  const level = loadJSON(KEY('LEVEL', 'vmq_level'), null);
  const streak = loadJSON(KEY('STREAK', 'vmq_streak'), null);

  return {
    xp: Number.isFinite(Number(xp)) ? Number(xp) : 0,
    level: Number.isFinite(Number(level)) ? Number(level) : 1,
    streak: Number.isFinite(Number(streak)) ? Number(streak) : 0
  };
}

function loadAchievementsSafe() {
  const a1 = loadJSON(KEY_ACHIEVEMENTS, null);
  if (Array.isArray(a1)) return a1;
  if (a1 && typeof a1 === 'object') {
    if (Array.isArray(a1.unlocked)) return a1.unlocked;
    if (Array.isArray(a1.list)) return a1.list;
  }

  // Back-compat: sometimes bundled into gamification
  const g = loadGamificationSafe();
  if (Array.isArray(g.achievements)) return g.achievements;

  return [];
}

function loadStatsSafe() {
  // Prefer analytics stats object if your app stores them there
  const a = loadJSON(KEY_ANALYTICS, null);
  if (a && typeof a === 'object' && ('total' in a || 'correct' in a || 'byModule' in a)) return a;

  const s = loadJSON(KEY_STATS, null);
  if (s && typeof s === 'object') return s;

  // Back-compat: some apps store stats in ANALYTICS even as { events: [] }
  const a2 = loadJSON(KEY_ANALYTICS, {});
  return (a2 && typeof a2 === 'object') ? a2 : {};
}

// --------------------------
// DOM theme application
// --------------------------
function applyThemeSettings(currentSettings, canPersist) {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;

  // Theme resolution
  let theme = 'light';
  if (currentSettings.darkMode) theme = 'dark';
  else if (currentSettings.highContrast) theme = 'high-contrast';

  html.setAttribute('data-theme', theme);

  if (canPersist) {
    try { localStorage.setItem('vmq-theme', theme); } catch {}
  }

  // Large fonts
  if (currentSettings.largeFonts) {
    html.setAttribute('data-font-size', 'large');
    if (canPersist) {
      try { localStorage.setItem('vmq-font-size', 'large'); } catch {}
    }
  } else {
    html.removeAttribute('data-font-size');
    if (canPersist) {
      try { localStorage.removeItem('vmq-font-size'); } catch {}
    }
  }

  // Compact layout
  if (currentSettings.compactLayout) html.setAttribute('data-layout', 'compact');
  else html.removeAttribute('data-layout');

  // Broadcast settings change for listeners
  try {
    window.dispatchEvent(new CustomEvent('vmq-settings-changed', { detail: { settings: currentSettings } }));
  } catch {}
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

export function Settings({ navigate, audioEngine, showToast }) {
  const storageAvailable = isStorageAvailable?.() ?? true;

  const [settings, setSettings] = useState(() => {
    const s = loadJSON(KEY_SETTINGS, DEFAULT_SETTINGS);
    return (s && typeof s === 'object') ? { ...DEFAULT_SETTINGS, ...s } : { ...DEFAULT_SETTINGS };
  });

  const [profile, setProfile] = useState(() => loadProfileSafe());

  const [difficulties, setDifficulties] = useState(() =>
    loadJSON(KEY_DIFFICULTY, {})
  );

  const [learningSummary, setLearningSummary] = useState(null);
  const [recommendedDifficulty, setRecommendedDifficulty] = useState(null);

  // Apply persisted theme/profile on mount
  useEffect(() => {
    try { document.body?.setAttribute?.('data-profile', profile?.level || profile?.profile || profile?.id || 'beginner'); } catch {}
    applyThemeSettings(settings, storageAvailable);
  }, []); // eslint-disable-line

  // Persist settings + apply to DOM/audio whenever they change
  useEffect(() => {
    saveJSON(KEY_SETTINGS, settings);

    if (audioEngine && typeof audioEngine.setMute === 'function') {
      audioEngine.setMute(!!settings.muted);
    }

    applyThemeSettings(settings, storageAvailable);
  }, [settings, audioEngine, storageAvailable]);

  // Ensure difficulty engine is synchronized with stored values (mount)
  useEffect(() => {
    const modes = Object.keys(DIFFICULTY_SETTINGS || {});
    modes.forEach((mode) => {
      const level = (difficulties && difficulties[mode]) ? difficulties[mode] : 'easy';
      setDifficulty?.(mode, level);
    });
  }, [difficulties]);

  // Load learning summary once for smart difficulty
  useEffect(() => {
    try {
      const statsRaw = loadStatsSafe();
      const g = loadGamificationSafe();
      const achievements = loadAchievementsSafe();

      const total =
        statsRaw.total ??
        statsRaw.totalQuestions ??
        statsRaw.questions ??
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
        xp: Number(g?.xp) || 0,
        level: Number(g?.level) || 1,
        streak: Number(g?.streak) || 0,
        achievementsCount: Array.isArray(achievements) ? achievements.length : 0
      };

      setLearningSummary(summary);

      // Heuristic global difficulty suggestion
      if (accuracy == null || total < 30) setRecommendedDifficulty(null);
      else if (accuracy < 70) setRecommendedDifficulty('easy');
      else if (accuracy < 86) setRecommendedDifficulty('medium');
      else setRecommendedDifficulty('hard');
    } catch {
      setLearningSummary(null);
      setRecommendedDifficulty(null);
    }
  }, []);

  // Toggles
  function toggleMute() {
    const nextMuted = !settings.muted;
    setSettings((prev) => ({ ...prev, muted: nextMuted }));
    showToast?.(nextMuted ? '🔇 Sound muted' : '🔊 Sound enabled', 'info');
  }

  function toggleDarkMode() {
    const nextDark = !settings.darkMode;
    setSettings((prev) => ({ ...prev, darkMode: nextDark, highContrast: false }));
    showToast?.(nextDark ? '🌙 Dark mode enabled' : '☀️ Light mode enabled', 'info');
  }

  function toggleHighContrast() {
    const next = !settings.highContrast;
    setSettings((prev) => ({ ...prev, highContrast: next, darkMode: false }));
    showToast?.(next ? 'High contrast enabled' : 'High contrast disabled', 'info');
  }

  function toggleLargeFonts() {
    const next = !settings.largeFonts;
    setSettings((prev) => ({ ...prev, largeFonts: next }));
    showToast?.(next ? 'Large fonts enabled' : 'Normal fonts restored', 'info');
  }

  function toggleCompactLayout() {
    const next = !settings.compactLayout;
    setSettings((prev) => ({ ...prev, compactLayout: next }));
    showToast?.(next ? 'Compact layout enabled' : 'Normal layout restored', 'info');
  }

  function handleProfileChange(newProfileId) {
    const next = { ...profile, level: newProfileId };
    setProfile(next);
    saveProfileSafe(next);
    try { document.body.setAttribute('data-profile', newProfileId); } catch {}
    showToast?.('Profile updated', 'success');
  }

  function handleDifficultyChange(mode, level) {
    try { setDifficulty?.(mode, level); } catch {}

    const next = { ...(difficulties || {}), [mode]: level };
    setDifficulties(next);
    saveJSON(KEY_DIFFICULTY, next);

    showToast?.(`${mode} difficulty set to ${level}`, 'success');
  }

  function autoCalibrateDifficulty() {
    if (!recommendedDifficulty) return;

    const level = recommendedDifficulty;
    const modes = Object.keys(DIFFICULTY_SETTINGS || {});
    if (!modes.length) return;

    modes.forEach((mode) => handleDifficultyChange(mode, level));

    showToast?.(
      `Difficulty auto-calibrated to ${capitalize(level)} based on your recent performance.`,
      'success'
    );
  }

  function handleExport() {
    try {
      if (typeof exportAllData === 'function') {
        exportAllData();
        showToast?.('Progress exported successfully', 'success');
        return;
      }
    } catch {}

    const statsRaw = loadStatsSafe();
    const g = loadGamificationSafe();

    const data = {
      profile: loadProfileSafe(),
      gamification: g,
      achievements: loadAchievementsSafe(),
      stats: statsRaw,
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

  function handleReset() {
    if (
      confirm(
        '⚠️ Are you sure? This will erase ALL progress data including XP, achievements, and stats. This cannot be undone.'
      )
    ) {
      try { clearAll?.(); }
      catch {
        [KEY_PROFILE, KEY_SETTINGS, KEY_DIFFICULTY, KEY_STATS, KEY_ANALYTICS].forEach((k) => {
          try { saveJSON(k, null); } catch {}
        });
      }
      showToast?.('All progress reset', 'info');
      setTimeout(() => window.location.reload(), 800);
    }
  }

  const difficultySummaryText = useMemo(() => {
    return learningSummary && learningSummary.accuracy != null
      ? `Overall accuracy ${learningSummary.accuracy}% over ${learningSummary.total} questions`
      : 'Not enough data yet to suggest a difficulty.';
  }, [learningSummary]);

  return h(
    'div',
    { className: 'mode-container settings-mode' },
    // Header
    h(
      'header',
      { className: 'mode-header' },
      h(
        'button',
        { className: 'btn-back', onClick: () => navigate?.('menu') },
        '← Back'
      ),
      h('h2', null, '⚙️ Settings')
    ),

    // Main content
    h(
      'div',
      { className: 'mode-content settings-content' },

      // Profile selection
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
                background: (profile?.level === profileType.id) ? '#e7f3ff' : 'var(--bg)',
                border: `2px solid ${ (profile?.level === profileType.id) ? profileType.color : 'var(--border)' }`,
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                transition: 'all var(--transition-base)'
              },
              onMouseEnter: (e) => {
                if (profile?.level !== profileType.id) {
                  e.currentTarget.style.borderColor = profileType.color;
                  e.currentTarget.style.background = 'var(--card)';
                }
              },
              onMouseLeave: (e) => {
                if (profile?.level !== profileType.id) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg)';
                }
              }
            },
            h('input', {
              type: 'radio',
              name: 'profile',
              value: profileType.id,
              checked: profile?.level === profileType.id,
              onChange: () => handleProfileChange(profileType.id),
              style: { marginRight: 'var(--space-md)', accentColor: profileType.color }
            }),
            h(
              'div',
              null,
              h(
                'div',
                { style: { fontWeight: 'bold', color: profileType.color, marginBottom: 'var(--space-xs)' } },
                profileType.label
              ),
              h(
                'div',
                { style: { fontSize: 'var(--font-size-sm)', color: 'var(--ink-light)' } },
                profileType.description
              )
            )
          )
        )
      ),

      // Appearance
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '🎨 Appearance'),

        h('label', { className: 'setting-item' },
          h('span', null, 'Dark Mode'),
          h('input', { type: 'checkbox', checked: !!settings.darkMode, onChange: toggleDarkMode, 'aria-label': 'Toggle dark mode' })
        ),

        h('label', { className: 'setting-item' },
          h('span', null, 'High Contrast'),
          h('input', { type: 'checkbox', checked: !!settings.highContrast, onChange: toggleHighContrast, 'aria-label': 'Toggle high contrast mode' })
        )
      ),

      // Accessibility
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '♿ Accessibility'),

        h('label', { className: 'setting-item' },
          h('span', null, 'Large Fonts'),
          h('input', { type: 'checkbox', checked: !!settings.largeFonts, onChange: toggleLargeFonts, 'aria-label': 'Toggle large fonts' })
        ),

        h('label', { className: 'setting-item' },
          h('span', null, 'Compact Layout'),
          h('input', { type: 'checkbox', checked: !!settings.compactLayout, onChange: toggleCompactLayout, 'aria-label': 'Toggle compact layout' })
        )
      ),

      // Audio
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '🔊 Audio'),
        h('label', { className: 'setting-item' },
          h('span', null, 'Mute all sounds'),
          h('input', { type: 'checkbox', checked: !!settings.muted, onChange: toggleMute, 'aria-label': 'Toggle sound mute' })
        )
      ),

      // Smart difficulty
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '🤖 Smart Difficulty (beta)'),
        h('p', {
          style: { fontSize: 'var(--font-size-sm)', color: 'var(--ink-light)', marginBottom: 'var(--space-xs)' }
        }, difficultySummaryText),

        recommendedDifficulty && h('p', {
          style: { fontSize: 'var(--font-size-sm)', color: 'var(--ink-light)', marginBottom: 'var(--space-md)' }
        }, `Recommended global level: ${capitalize(recommendedDifficulty)} (you can still override per module).`),

        h('button', {
          className: 'btn btn-secondary',
          onClick: autoCalibrateDifficulty,
          disabled: !recommendedDifficulty
        }, 'Auto-calibrate difficulty')
      ),

      // Difficulty per mode
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, '📊 Difficulty Levels'),
        Object.keys(DIFFICULTY_SETTINGS || {}).map((mode) =>
          h('div', { key: mode, className: 'setting-item' },
            h('label', null, mode.charAt(0).toUpperCase() + mode.slice(1)),
            h('select', {
              value: (difficulties && difficulties[mode]) || 'easy',
              onChange: (e) => handleDifficultyChange(mode, e.target.value),
              className: 'select-difficulty',
              'aria-label': `Difficulty for ${mode}`
            },
              ['easy', 'medium', 'hard'].map((level) =>
                h('option', { key: level, value: level }, capitalize(level))
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

        !storageAvailable && h('div', {
          className: 'feedback feedback-warning',
          style: { marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }
        }, '⚠️ Private browsing detected. Progress will reset when you close the app.'),

        h('p', {
          style: { fontSize: 'var(--font-size-sm)', color: 'var(--ink-light)', marginBottom: 'var(--space-md)' }
        }, 'Export your progress as a backup file, or reset to start fresh.'),

        h('div', { style: { display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' } },
          h('button', { className: 'btn btn-secondary', onClick: handleExport }, '📥 Export Progress'),
          h('button', { className: 'btn btn-danger', onClick: handleReset }, '🗑️ Reset All Progress')
        )
      ),

      // About
      h(
        'section',
        { className: 'settings-section' },
        h('h3', null, 'ℹ️ About'),
        h('p', { className: 'about-text' }, '🎻 Violin Mastery Quest v1.0.0'),
        h('p', { className: 'about-text' },
          "Built for serious young violinists. Pedagogy aligned with Ida Bieler Method and Suzuki tradition."
        ),
        h('p', {
          className: 'about-text',
          style: { fontSize: 'var(--font-size-sm)', color: 'var(--ink-lighter)', marginTop: 'var(--space-md)' }
        }, `Storage: ${storageAvailable ? '✅ Available' : '⚠️ Unavailable (Private Mode)'}`)
      )
    )
  );
}

export default Settings;