// ======================================
// MAIN MENU - Mode Selection Hub
// Central navigation + stats overview
// ======================================

const { createElement: h, useState, useEffect } = React;

import { loadXP, loadStreak, getLevel, getStatsSummary } from '../engines/gamification.js';
import { analyzePerformance } from '../engines/analytics.js';
import { getReviewStats } from '../engines/spacedRepetition.js';
import { STORAGE_KEYS } from '../config/constants.js';
import { loadJSON } from '../config/storage.js';

export default function MainMenu({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [levelData, setLevelData] = useState({ level: 1, title: 'Beginner', badge: '🎵' });
  const [streak, setStreak] = useState(0);
  const [spacedStats, setSpacedStats] = useState({ dueToday: 0 });
  const [profile, setProfile] = useState({ name: 'Student' });

  useEffect(() => {
    // Load all stats on mount
    const summary = getStatsSummary();
    const level = getLevel(loadXP());
    const streakData = loadStreak();
    
    setStats(summary);
    setLevelData(level);
    setStreak(streakData.current);
    setProfile(loadJSON(STORAGE_KEYS.PROFILE, { name: 'Student' }));
    
    // Spaced repetition stats
    getReviewStats().then(setSpacedStats);
  }, []);

  if (!stats) {
    return h('div', { className: 'loading' }, 'Loading menu...');
  }

  const accuracy = stats.accuracy || 0;
  const colorClass = accuracy >= 85 ? 'success' : accuracy >= 70 ? 'warning' : 'danger';

  return h('div', { className: 'module-container' },
    // Header
    h('header', { className: 'module-header' },
      h('h1', null, '🎻 Violin Mastery Quest'),
      h('div', { className: 'stats-inline' },
        h('span', null, levelData.badge),
        h('span', null, `Lv ${levelData.level}`)
      )
    ),

    // Hero Stats Card
    h('div', { className: 'card card-success' },
      h('div', { style: { textAlign: 'center', paddingBottom: 'var(--space-lg)' } },
        h('h2', null, profile.name),
        h('div', { className: 'stat-large' }, levelData.badge),
        h('h3', null, levelData.title),
        h('p', { className: 'text-muted' }, `${stats.xp} XP • ${streak} day streak`)
      )
    ),

    // Quick Stats Row
    h('div', { className: 'grid-3' },
      h('div', { className: 'module-stat' },
        h('div', { className: 'stat-medium', style: { color: 'var(--success)' } }, stats.totalQuestions),
        h('p', { className: 'text-muted' }, 'Questions')
      ),
      h('div', { className: 'module-stat' },
        h('div', { className: `stat-medium ${colorClass}` }, `${accuracy}%`),
        h('p', { className: 'text-muted' }, 'Accuracy')
      ),
      h('div', { className: 'module-stat' },
        h('div', { className: 'stat-medium', style: { color: 'var(--primary)' } }, spacedStats.dueToday),
        h('p', { className: 'text-muted' }, 'Due Today')
      )
    ),

    // Primary Training Modules
    h('div', { className: 'card' },
      h('h3', null, 'Training Modules'),
      h('div', { className: 'grid-2' },
        h('button', {
          className: 'btn btn-primary btn-lg',
          onClick: () => onNavigate('intervals')
        }, '🎵 Intervals'),
        h('button', {
          className: 'btn btn-primary btn-lg',
          onNavigate: () => onNavigate('keys')
        }, '🔑 Key Signatures'),
        h('button', {
          className: 'btn btn-primary btn-lg',
          onClick: () => onNavigate('rhythm')
        }, '🥁 Rhythm'),
        h('button', {
          className: 'btn btn-primary btn-lg',
          onClick: () => onNavigate('scales')
        }, '🎼 Scales')
      )
    ),

    // Secondary Modules + Tools
    h('div', { className: 'card' },
      h('h3', null, 'Ear Training & Tools'),
      h('div', { className: 'grid-2' },
        h('button', {
          className: 'btn btn-outline',
          onClick: () => onNavigate('interval-ear')
        }, '👂 Interval Ear'),
        h('button', {
          className: 'btn btn-outline',
          onClick: () => onNavigate('speed-drill')
        }, '⚡ Speed Drill'),
        h('button', {
          className: 'btn btn-outline',
          onClick: () => onNavigate('spaced-rep')
        }, `📚 Review (${spacedStats.dueToday})`),
        h('button', {
          className: 'btn btn-outline',
          onClick: () => onNavigate('fingerboard')
        }, '🎻 Fingerboard')
      )
    ),

    // Quick Actions
    h('div', { className: 'card' },
      h('h3', null, 'Quick Actions'),
      h('div', { className: 'grid-2' },
        h('button', {
          className: 'btn btn-primary',
          onClick: () => onNavigate('dashboard')
        }, '📊 Dashboard'),
        h('button', {
          className: 'btn btn-primary',
          onClick: () => onNavigate('planner')
        }, '📅 Planner'),
        h('button', {
          className: 'btn btn-outline',
          onClick: () => onNavigate('achievements')
        }, '🏆 Achievements'),
        h('button', {
          className: 'btn btn-outline',
          onClick: () => onNavigate('settings')
        }, '⚙️ Settings')
      )
    ),

    // Progress Bar
    h('div', { className: 'card' },
      h('div', { className: 'progress-bar' },
        h('div', {
          className: 'progress-fill',
          style: { width: `${levelData.progress || 0}%` }
        })
      ),
      h('p', {
        className: 'text-muted',
        style: { textAlign: 'center', marginTop: 'var(--space-sm)' }
      },
        `${stats.xpToNextLevel || 0} XP to ${levelData.level + 1}`
      )
    )
  );
}