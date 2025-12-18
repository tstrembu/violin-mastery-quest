// js/components/MainMenu.js
// ===================================
// MAIN MENU - Mode Selection Hub v3.0.8 (Drop-in)
// Central navigation + ML stats + Coach preview
//
// Hardening / Fixes (without removing features):
// ✅ FAIL-SOFT: **NO static imports** (prevents “Importing a module script failed” if any dependency file is missing)
// ✅ Correct storage path usage (dynamic import ../config/storage.js)
// ✅ COACH_DATA key handled safely even if STORAGE_KEYS.COACH_DATA is absent
// ✅ Streak robust whether loadStreak() returns number/object/other
// ✅ Avoid stale state: uses loadedProfile directly
// ✅ Menu always renders, even if engines are partially missing
// ===================================

/* global React */

const { createElement: h, useState, useEffect } = React;

// ------------------------------
// Minimal fallbacks (only used if modules fail to import)
// ------------------------------
const FALLBACK = Object.freeze({
  profile: { name: 'Student' },
  stats: { xp: 0, accuracy: 0, totalQuestions: 0, progress: 0, xpToNextLevel: 0 },
  level: { level: 1, title: 'Beginner', badge: '🎵', xpToNext: 1000, progress: 0 },
  spaced: { dueToday: 0 },
});

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function safeStr(v, d = '') {
  return (typeof v === 'string' && v.trim()) ? v : d;
}

function getDefaultNavigate(onNavigate) {
  if (typeof onNavigate === 'function') return onNavigate;
  // fallback: set hash route
  return (route) => { window.location.hash = `#${String(route || 'menu').replace(/^#/, '')}`; };
}

// ------------------------------
// Component
// ------------------------------
export default function MainMenu({ onNavigate }) {
  const navigate = getDefaultNavigate(onNavigate);

  const [stats, setStats] = useState(null);
  const [levelData, setLevelData] = useState({ level: 1, title: 'Beginner', badge: '🎵', progress: 0 });
  const [streak, setStreak] = useState(0);
  const [spacedStats, setSpacedStats] = useState({ dueToday: 0 });
  const [profile, setProfile] = useState({ name: 'Student' });
  const [perf, setPerf] = useState(null);
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const emitDiag = (type, detail) => {
      try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
    };

    const run = async () => {
      // Dynamic imports so a missing optional module never bricks MainMenu itself.
      let storage = null;
      let gamification = null;
      let analytics = null;
      let spaced = null;
      let coachEngine = null;

      try { storage = await import('../config/storage.js'); }
      catch (e) { emitDiag('vmq-module-load-failed', { label: 'storage', path: '../config/storage.js', error: String(e) }); }

      try { gamification = await import('../engines/gamification.js'); }
      catch (e) { emitDiag('vmq-module-load-failed', { label: 'gamification', path: '../engines/gamification.js', error: String(e) }); }

      try { analytics = await import('../engines/analytics.js'); }
      catch (e) { emitDiag('vmq-module-load-failed', { label: 'analytics', path: '../engines/analytics.js', error: String(e) }); }

      try { spaced = await import('../engines/spacedRepetition.js'); }
      catch (e) { emitDiag('vmq-module-load-failed', { label: 'spacedRepetition', path: '../engines/spacedRepetition.js', error: String(e) }); }

      // coachEngine is optional; fail-soft
      try { coachEngine = await import('../engines/coachEngine.js'); }
      catch (e) { emitDiag('vmq-module-load-failed', { label: 'coachEngine', path: '../engines/coachEngine.js', error: String(e) }); }

      // Storage helpers
      const STORAGE_KEYS = storage?.STORAGE_KEYS || {};
      const loadJSON = storage?.loadJSON || ((key, fb) => {
        try {
          const raw = localStorage.getItem(String(key));
          return raw == null ? fb : JSON.parse(raw);
        } catch {
          return fb;
        }
      });

      // Gamification helpers
      const loadXP = gamification?.loadXP;
      const loadStreak = gamification?.loadStreak;
      const getLevel = gamification?.getLevel;
      const getStatsSummary = gamification?.getStatsSummary;

      // Analytics helpers
      const analyzePerformance = analytics?.analyzePerformance;

      // Spaced repetition helpers
      const getReviewStats = spaced?.getReviewStats;

      // Coach helpers
      const getCoachInsights = coachEngine?.getCoachInsights;

      try {
        // --- Core stats ---
        const summary = (typeof getStatsSummary === 'function') ? (getStatsSummary() || null) : null;
        const xp = safeNum(typeof loadXP === 'function' ? loadXP() : 0, 0);

        const level = (typeof getLevel === 'function')
          ? (getLevel(xp) || FALLBACK.level)
          : FALLBACK.level;

        // streak can be: { current }, or number, or something else
        const streakRaw = (typeof loadStreak === 'function') ? loadStreak() : 0;
        const streakValue =
          typeof streakRaw === 'number'
            ? safeNum(streakRaw, 0)
            : safeNum(streakRaw?.current ?? streakRaw ?? 0, 0);

        // ✅ Load profile ONCE and use it immediately (avoid stale state)
        const loadedProfile =
          loadJSON(STORAGE_KEYS.PROFILE || 'vmq-profile', FALLBACK.profile) || FALLBACK.profile;

        if (!alive) return;

        // Build stats object with safe defaults
        const totalQuestions = safeNum(summary?.totalQuestions ?? summary?.questions ?? 0, 0);
        const accuracy = safeNum(summary?.accuracy ?? 0, 0);
        const progress = safeNum(summary?.progress ?? 0, 0);

        const xpToNextLevel =
          safeNum(level?.xpToNext ?? 0, 0) > 0
            ? Math.max(0, safeNum(level.xpToNext, 0) - xp)
            : safeNum(summary?.xpToNextLevel ?? 0, 0);

        setStats({
          xp,
          accuracy,
          totalQuestions,
          progress,
          xpToNextLevel,
        });

        setLevelData({
          level: safeNum(level?.level ?? 1, 1),
          title: safeStr(level?.title, 'Beginner'),
          badge: safeStr(level?.badge, '🎵'),
          progress,
        });

        setStreak(streakValue);
        setProfile(loadedProfile);

        // --- Spaced repetition stats (async) ---
        try {
          if (typeof getReviewStats === 'function') {
            const sr = await getReviewStats();
            if (alive) setSpacedStats(sr || FALLBACK.spaced);
          } else {
            if (alive) setSpacedStats(FALLBACK.spaced);
          }
        } catch {
          if (alive) setSpacedStats(FALLBACK.spaced);
        }

        // --- Lightweight analytics + coach snapshot ---
        try {
          if (typeof analyzePerformance === 'function') {
            const analysis = analyzePerformance('week', {
              includePredictions: true,
              includePatterns: true,
              includeOptimization: false,
              includeBreakthrough: true,
            }) || null;
            if (alive) setPerf(analysis);
          } else {
            if (alive) setPerf(null);
          }

          // ✅ COACH_DATA key name handled safely
          const coachKey = STORAGE_KEYS.COACH_DATA || 'vmq-coach-data';
          const coachStore = loadJSON(coachKey, { goals: [] }) || { goals: [] };
          const goals = Array.isArray(coachStore.goals) ? coachStore.goals : [];

          const coachData =
            (typeof getCoachInsights === 'function')
              ? (getCoachInsights({
                  name: loadedProfile?.name || 'Student',
                  level: safeNum(level?.level ?? 1, 1),
                  goals,
                }) || null)
              : null;

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

  const accuracy = safeNum(stats.accuracy ?? 0, 0);
  const colorClass = accuracy >= 85 ? 'success' : accuracy >= 70 ? 'warning' : 'danger';

  const weeklyDays =
    perf?.trends?.sessionsPerDay != null ? Math.round(safeNum(perf.trends.sessionsPerDay, 0) * 7) : null;

  const masteryCount = safeNum(perf?.masteryZones?.length || 0, 0);
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
        h('span', null, `Lv ${safeNum(levelData.level, 1)}`)
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
          `${safeNum(stats.xp ?? 0, 0)} XP • ${safeNum(streak, 0)} day streak` + (weeklyDays ? ` • ${weeklyDays} days this week` : '')
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
          safeNum(stats.totalQuestions ?? 0, 0).toLocaleString()
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
          safeNum(spacedStats?.dueToday || 0, 0)
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
              onClick: () => (topCoachRec?.action ? navigate(topCoachRec.action) : navigate('coach')),
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  (topCoachRec?.action ? navigate(topCoachRec.action) : navigate('coach'));
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
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => navigate('intervals') }, '🎵 Intervals'),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => navigate('keys') }, '🔑 Key Signatures'),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => navigate('rhythm') }, '🥁 Rhythm'),
        h('button', { className: 'btn btn-primary btn-lg', onClick: () => navigate('scales') }, '🎼 Scales')
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
        h('button', { className: 'btn btn-outline', onClick: () => navigate('interval-ear') }, '👂 Interval Ear'),
        h('button', { className: 'btn btn-outline', onClick: () => navigate('speed-drill') }, '⚡ Speed Drill'),
        h('button', { className: 'btn btn-outline', onClick: () => navigate('spaced-rep') },
          `📚 Review (${safeNum(spacedStats?.dueToday || 0, 0)})`
        ),
        h('button', { className: 'btn btn-outline', onClick: () => navigate('fingerboard') }, '🎻 Fingerboard')
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
        h('button', { className: 'btn btn-primary', onClick: () => navigate('dashboard') }, '📊 Dashboard'),
        h('button', { className: 'btn btn-primary', onClick: () => navigate('planner') }, '📅 Planner'),
        h('button', { className: 'btn btn-outline', onClick: () => navigate('achievements') }, '🏆 Achievements'),
        h('button', { className: 'btn btn-outline', onClick: () => navigate('settings') }, '⚙️ Settings')
      )
    ),

    // Progress Bar
    h(
      'div',
      { className: 'card' },
      h(
        'div',
        { className: 'progress-bar', 'aria-label': 'Progress to next level' },
        h('div', { className: 'progress-fill', style: { width: `${safeNum(levelData.progress || 0, 0)}%` } })
      ),
      h(
        'p',
        { className: 'text-muted', style: { textAlign: 'center', marginTop: 'var(--space-sm)' } },
        `${safeNum(stats.xpToNextLevel || 0, 0)} XP to Lv ${safeNum(levelData.level || 1, 1) + 1}`
      )
    )
  );
}
