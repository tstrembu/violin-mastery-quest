// js/components/MainMenu.js
// ===================================
// MAIN MENU - Mode Selection Hub v3.0.5 (Drop-in)
// Central navigation + ML stats + Coach preview
//
// Fixes:
// ✅ Avoid stale state: uses loadedProfile directly (state updates are async)
// ✅ Fix incorrect import path for STORAGE_KEYS ("../config/storage.js", not "./config/storage.js")
// ✅ Fix COACH_DATA key name (was COACHDATA)
// ✅ Make streak robust whether loadStreak() returns number/object
// ✅ Fail-soft across engines; menu always renders
// ===================================

const { createElement: h, useState, useEffect } = React;

import { loadXP, loadStreak, getLevel, getStatsSummary } from '../engines/gamification.js';
import { analyzePerformance } from '../engines/analytics.js';
import { getReviewStats } from '../engines/spacedRepetition.js';
import { getCoachInsights } from '../engines/coachEngine.js';
import { STORAGE_KEYS, loadJSON } from '../config/storage.js';

export default function MainMenu({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [levelData, setLevelData] = useState({
    level: 1, title: 'Beginner', badge: '🎵', progress: 0
  });
  const [streak, setStreak] = useState(0);
  const [spacedStats, setSpacedStats] = useState({ dueToday: 0 });
  const [profile, setProfile] = useState({ name: 'Student' });
  const [perf, setPerf] = useState(null);
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        // --- Core stats ---
        const summary = getStatsSummary?.() || null;
        const xp = Number(loadXP?.() ?? 0) || 0;
        const level = getLevel?.(xp) || { level: 1, title: 'Beginner', badge: '🎵' };

        // streak can be: { current }, or number, or something else
        const streakRaw = loadStreak?.();
        const streakValue =
          typeof streakRaw === 'number'
            ? streakRaw
            : (Number(streakRaw?.current ?? streakRaw ?? 0) || 0);

        // ✅ Load profile ONCE and use it immediately (avoid stale state)
        const loadedProfile =
          loadJSON(STORAGE_KEYS.PROFILE, { name: 'Student' }) || { name: 'Student' };

        if (!alive) return;

        setStats(summary || { xp, accuracy: 0, totalQuestions: 0, progress: 0 });
        setLevelData({ ...level, progress: (summary?.progress ?? 0) });
        setStreak(streakValue);
        setProfile(loadedProfile);

        // --- Spaced repetition stats (async) ---
        try {
          const sr = await getReviewStats();
          if (alive) setSpacedStats(sr || { dueToday: 0 });
        } catch {
          if (alive) setSpacedStats({ dueToday: 0 });
        }

        // --- Lightweight analytics + coach snapshot ---
        try {
          const analysis = analyzePerformance?.('week', {
            includePredictions: true,
            includePatterns: true,
            includeOptimization: false,
            includeBreakthrough: true
          }) || null;

          if (alive) setPerf(analysis);

          const coachStore = loadJSON(STORAGE_KEYS.COACH_DATA, { goals: [] }) || { goals: [] };
          const goals = Array.isArray(coachStore.goals) ? coachStore.goals : [];

          const coachData =
            getCoachInsights?.({
              name: loadedProfile?.name || 'Student', // ✅ use loadedProfile, not state
              level: level.level || 1,
              goals
            }) || null;

          if (alive) setCoach(coachData);
        } catch {
          if (alive) {
            setPerf(null);
            setCoach(null);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();

    return () => { alive = false; };
  }, []);

  if (!stats || loading) {
    return h('div', { className: 'loading' }, 'Loading menu...');
  }

  const accuracy = Number(stats.accuracy ?? 0) || 0;
  const colorClass = accuracy >= 85 ? 'success' : accuracy >= 70 ? 'warning' : 'danger';

  const weeklyDays =
    perf?.trends?.sessionsPerDay != null ? Math.round(perf.trends.sessionsPerDay * 7) : null;

  const masteryCount = perf?.masteryZones?.length || 0;
  const topCoachRec = coach?.recommendations?.[0];

  return h(
    'div',
    { className: 'module-container' },

    // Header
    h(
      'header',
      { className: 'module-header' },
      h('h1', null, '🎻 Violin Mastery Quest'),
      h(
        'div',
        { className: 'stats-inline', 'aria-live': 'polite' },
        h('span', null, levelData.badge),
        h('span', null, `Lv ${levelData.level}`)
      )
    ),

    // Hero Stats Card
    h(
      'div',
      { className: 'card card-success' },
      h(
        'div',
        { style: { textAlign: 'center', paddingBottom: 'var(--space-lg)' } },
        h('h2', null, profile?.name || 'Student'),
        h('div', { className: 'stat-large' }, levelData.badge),
        h('h3', null, levelData.title),
        h(
          'p',
          { className: 'text-muted' },
          `${stats.xp ?? 0} XP • ${streak} day streak` + (weeklyDays ? ` • ${weeklyDays} days this week` : '')
        ),
        masteryCount > 0 &&
          h(
            'p',
            { className: 'text-success', style: { marginTop: '0.25rem' } },
            `Mastered ${masteryCount} module${masteryCount > 1 ? 's' : ''} so far`
          )
      )
    ),

    // Quick Stats Row
    h(
      'div',
      { className: 'grid-3' },
      h(
        'div',
        { className: 'module-stat' },
        h(
          'div',
          { className: 'stat-medium', style: { color: 'var(--success)' } },
          Number(stats.totalQuestions ?? 0).toLocaleString()
        ),
        h('p', { className: 'text-muted' }, 'Questions')
      ),
      h(
        'div',
        { className: 'module-stat' },
        h('div', { className: `stat-medium ${colorClass}` }, `${accuracy}%`),
        h('p', { className: 'text-muted' }, 'Accuracy')
      ),
      h(
        'div',
        { className: 'module-stat' },
        h(
          'div',
          { className: 'stat-medium', style: { color: 'var(--primary)' } },
          spacedStats?.dueToday || 0
        ),
        h('p', { className: 'text-muted' }, 'Due Today (SM-2)')
      )
    ),

    // Coach Snapshot
    coach && coach.recommendations && coach.recommendations.length > 0 &&
      h(
        'div',
        { className: 'card card-live' },
        h(
          'div',
          { className: 'card-header' },
          h('h3', null, 'AI Coach Focus'),
          h('span', { className: 'badge badge-success' }, 'Smart Practice')
        ),
        h(
          'div',
          { className: 'coach-insights' },
          h(
            'div',
            {
              className: `insight insight-${topCoachRec?.priority || 'medium'}`,
              role: 'button',
              tabIndex: 0,
              onClick: () => (topCoachRec?.action ? onNavigate(topCoachRec.action) : onNavigate('coach')),
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  (topCoachRec?.action ? onNavigate(topCoachRec.action) : onNavigate('coach'));
                }
              }
            },
            h(
              'div',
              { className: 'insight-header' },
              h('span', { className: 'insight-icon' }, topCoachRec?.icon || '🎯'),
              h('strong', null, topCoachRec?.area || "Today's Focus")
            ),
            h('p', null, topCoachRec?.suggestion || 'Tap to open detailed coach plan.')
          )
        )
      ),

    // Primary Training Modules
    h(
      'div',
      { className: 'card' },
      h('h3', null, 'Training Modules'),
      h(
        'div',
        { className: 'grid-2' },
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => onNavigate('intervals') }, '🎵 Intervals'),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => onNavigate('keys') }, '🔑 Key Signatures'),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => onNavigate('rhythm') }, '🥁 Rhythm'),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => onNavigate('scales') }, '🎼 Scales')
      )
    ),

    // Secondary Modules + Tools
    h(
      'div',
      { className: 'card' },
      h('h3', null, 'Ear Training & Tools'),
      h(
        'div',
        { className: 'grid-2' },
        h('button', { className: 'btn btn-outline', onClick: () => onNavigate('interval-ear') }, '👂 Interval Ear'),
        h('button', { className: 'btn btn-outline', onClick: () => onNavigate('speed-drill') }, '⚡ Speed Drill'),
        h('button', { className: 'btn btn-outline', onClick: () => onNavigate('spaced-rep') },
          `📚 Review (${spacedStats?.dueToday || 0})`
        ),
        h('button', { className: 'btn btn-outline', onClick: () => onNavigate('fingerboard') }, '🎻 Fingerboard')
      )
    ),

    // Quick Actions
    h(
      'div',
      { className: 'card' },
      h('h3', null, 'Quick Actions'),
      h(
        'div',
        { className: 'grid-2' },
        h('button', { className: 'btn btn-primary', onClick: () => onNavigate('dashboard') }, '📊 Dashboard'),
        h('button', { className: 'btn btn-primary', onClick: () => onNavigate('planner') }, '📅 Planner'),
        h('button', { className: 'btn btn-outline', onClick: () => onNavigate('achievements') }, '🏆 Achievements'),
        h('button', { className: 'btn btn-outline', onClick: () => onNavigate('settings') }, '⚙️ Settings')
      )
    ),

    // Progress Bar
    h(
      'div',
      { className: 'card' },
      h(
        'div',
        { className: 'progress-bar', 'aria-label': 'Progress to next level' },
        h('div', { className: 'progress-fill', style: { width: `${levelData.progress || 0}%` } })
      ),
      h(
        'p',
        { className: 'text-muted', style: { textAlign: 'center', marginTop: 'var(--space-sm)' } },
        `${stats.xpToNextLevel || 0} XP to Lv ${Number(levelData.level || 1) + 1}`
      )
    )
  );
}