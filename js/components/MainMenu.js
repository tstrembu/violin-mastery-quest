// ===================================
// MAIN MENU - Mode Selection Hub v3.0
// Central navigation + ML stats + Coach preview
// ===================================

const { createElement: h, useState, useEffect } = React;

import { loadXP, loadStreak, getLevel, getStatsSummary } from '../engines/gamification.js';
import { analyzePerformance } from '../engines/analytics.js';
import { getReviewStats } from '../engines/spacedRepetition.js';
import { getCoachInsights } from '../engines/coachEngine.js';
import { STORAGE_KEYS } from './config/storage.js';
import { loadJSON } from '../config/storage.js';

export default function MainMenu({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [levelData, setLevelData] = useState({ level: 1, title: 'Beginner', badge: '🎵', progress: 0 });
  const [streak, setStreak] = useState(0);
  const [spacedStats, setSpacedStats] = useState({ dueToday: 0 });
  const [profile, setProfile] = useState({ name: 'Student' });
  const [perf, setPerf] = useState(null);          // Analytics overview
  const [coach, setCoach] = useState(null);        // Coach insights preview
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load core gamification + profile
    const summary = getStatsSummary();
    const xp = loadXP();
    const level = getLevel(xp);
    const streakData = loadStreak();

    setStats(summary);
    setLevelData({ ...level, progress: summary.progress || 0 });
    setStreak(streakData.current);
    setProfile(loadJSON(STORAGE_KEYS.PROFILE, { name: 'Student' }));

    // Load spaced repetition stats
    getReviewStats().then(setSpacedStats).catch(() => setSpacedStats({ dueToday: 0 }));

    // Lightweight analytics + coach snapshot for menu
    try {
      const analysis = analyzePerformance('week', {
        includePredictions: true,
        includePatterns: true,
        includeOptimization: false,
        includeBreakthrough: true
      });
      setPerf(analysis);

      const coachData = getCoachInsights?.({
        name: profile.name,
        level: level.level,
        goals: loadJSON(STORAGE_KEYS.COACHDATA, { goals: [] }).goals || []
      }) || null;
      setCoach(coachData);
    } catch (e) {
      // Fail soft; menu should always render
      setPerf(null);
      setCoach(null);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!stats || loading) {
    return h('div', { className: 'loading' }, 'Loading menu...');
  }

  const accuracy = stats.accuracy || 0;
  const colorClass = accuracy >= 85 ? 'success' : accuracy >= 70 ? 'warning' : 'danger';

  // Derive some “at a glance” metrics from analytics/coach if available
  const weeklyDays = perf?.trends?.sessionsPerDay ? Math.round(perf.trends.sessionsPerDay * 7) : null;
  const masteryCount = perf?.masteryZones?.length || 0;
  const topCoachRec = coach?.recommendations?.[0];

  return h('div', { className: 'module-container' },

    // Header
    h('header', { className: 'module-header' },
      h('h1', null, '🎻 Violin Mastery Quest'),
      h('div', { className: 'stats-inline', 'aria-live': 'polite' },
        h('span', null, levelData.badge),
        h('span', null, `Lv ${levelData.level}`)
      )
    ),

    // Hero Stats Card (now subtly ML‑aware)
    h('div', { className: 'card card-success' },
      h('div', { style: { textAlign: 'center', paddingBottom: 'var(--space-lg)' } },
        h('h2', null, profile.name),
        h('div', { className: 'stat-large' }, levelData.badge),
        h('h3', null, levelData.title),
        h('p', { className: 'text-muted' },
          `${stats.xp} XP • ${streak} day streak` +
          (weeklyDays ? ` • ${weeklyDays} days this week` : '')
        ),
        masteryCount > 0 && h('p', { className: 'text-success', style: { marginTop: '0.25rem' } },
          `Mastered ${masteryCount} module${masteryCount > 1 ? 's' : ''} so far`
        )
      )
    ),

    // Quick Stats Row (adds “SM‑2 Due” context)
    h('div', { className: 'grid-3' },
      h('div', { className: 'module-stat' },
        h('div', { className: 'stat-medium', style: { color: 'var(--success)' } },
          stats.totalQuestions.toLocaleString()
        ),
        h('p', { className: 'text-muted' }, 'Questions')
      ),
      h('div', { className: 'module-stat' },
        h('div', { className: `stat-medium ${colorClass}` }, `${accuracy}%`),
        h('p', { className: 'text-muted' }, 'Accuracy')
      ),
      h('div', { className: 'module-stat' },
        h('div', { className: 'stat-medium', style: { color: 'var(--primary)' } },
          spacedStats.dueToday || 0
        ),
        h('p', { className: 'text-muted' }, 'Due Today (SM‑2)')
      )
    ),

    // Coach Snapshot (micro‑panel from CoachEngine)
    coach && coach.recommendations && coach.recommendations.length > 0 && h('div', { className: 'card card-live' },
      h('div', { className: 'card-header' },
        h('h3', null, 'AI Coach Focus'),
        h('span', { className: 'badge badge-success' }, 'Smart Practice')
      ),
      h('div', { className: 'coach-insights' },
        h('div', {
          className: `insight insight-${topCoachRec.priority || 'medium'}`,
          role: 'button',
          tabIndex: 0,
          onClick: () => topCoachRec.action ? onNavigate(topCoachRec.action) : onNavigate('coach'),
          onKeyDown: (e) => { if (e.key === 'Enter') (topCoachRec.action ? onNavigate(topCoachRec.action) : onNavigate('coach')); }
        },
          h('div', { className: 'insight-header' },
            h('span', { className: 'insight-icon' }, topCoachRec.icon || '🎯'),
            h('strong', null, topCoachRec.area || 'Today\'s Focus')
          ),
          h('p', null, topCoachRec.suggestion || 'Tap to open detailed coach plan.')
        )
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
          onClick: () => onNavigate('keys')      // fixed handler
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
        }, `📚 Review (${spacedStats.dueToday || 0})`),
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

    // Progress Bar (using gamification next‑level data)
    h('div', { className: 'card' },
      h('div', { className: 'progress-bar', 'aria-label': 'Progress to next level' },
        h('div', {
          className: 'progress-fill',
          style: { width: `${levelData.progress || 0}%` }
        })
      ),
      h('p', {
        className: 'text-muted',
        style: { textAlign: 'center', marginTop: 'var(--space-sm)' }
      },
        `${stats.xpToNextLevel || 0} XP to Lv ${levelData.level + 1}`
      )
    )
  );
}
