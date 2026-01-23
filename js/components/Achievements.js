// js/components/Achievements.js
// ======================================
// VMQ ACHIEVEMENTS v1.0.0 (Drop-in)
// - Prevents dead-end navigation for "Achievements".
// - Uses existing gamification storage if present; otherwise shows defaults.
// - React UMD (no JSX)
// ======================================

/* global React */

const { createElement: h, useEffect, useMemo, useState } = React;

const ACHIEVEMENT_CATALOG = Object.freeze([
  { id: 'first_note',        icon: '🎯', title: 'First Note',        desc: 'Record your first answer in any module.' },
  { id: 'first_streak',      icon: '🔥', title: '3‑Day Streak',      desc: 'Practice on 3 different days.' },
  { id: 'intervals_master',  icon: '🎵', title: 'Intervals Master',  desc: 'Reach strong accuracy in Intervals practice.' },
  { id: 'keys_master',       icon: '🔑', title: 'Keys Master',       desc: 'Reach strong accuracy in Key Signatures practice.' },
  { id: 'rhythm_master',     icon: '🥁', title: 'Rhythm Master',     desc: 'Reach strong accuracy in Rhythm practice.' },
  { id: 'bieler_master',     icon: '🎻', title: 'Bieler Explorer',   desc: 'Make solid progress in Bieler training content.' },
  { id: '100_questions',     icon: '💯', title: '100 Questions',     desc: 'Answer 100 total questions across modules.' },
  { id: '500_questions',     icon: '🏅', title: '500 Questions',     desc: 'Answer 500 total questions across modules.' },
  { id: '1000_questions',    icon: '🏆', title: '1000 Questions',    desc: 'Answer 1000 total questions across modules.' },
  { id: 'level_10',          icon: '⭐', title: 'Level 10',          desc: 'Reach Level 10 (XP milestone).' },
  { id: 'week_7',            icon: '📅', title: 'Week Warrior',      desc: 'Hit a best streak of 7 days.' },
  { id: 'month_30',          icon: '🗓️', title: '30‑Day Legend',     desc: 'Hit a best streak of 30 days.' },
  { id: 'year_100',          icon: '🧭', title: 'Century Streak',    desc: 'Hit a best streak of 100 days.' },
  { id: 'sm2_retention_85',  icon: '🧠', title: 'Retention 85%',     desc: 'Reach ≥85% retention in spaced repetition.' },
]);

function safeArray(v, fb = []) { return Array.isArray(v) ? v : fb; }
function safeObj(v, fb = {}) { return v && typeof v === 'object' ? v : fb; }

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsGetJSON(key, fb) {
  try {
    const raw = lsGet(key);
    if (raw == null) return fb;
    return JSON.parse(raw);
  } catch {
    return fb;
  }
}

export default function Achievements({ onBack, onNavigate, emitAnalyticsEvent }) {
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState([]);
  const [progress, setProgress] = useState({});
  const [summary, setSummary] = useState(null);

  const navigate = (route) => {
    try {
      if (typeof emitAnalyticsEvent === 'function') emitAnalyticsEvent('nav', 'click', { target: route });
    } catch {}
    if (typeof onNavigate === 'function') onNavigate(route);
    else window.location.hash = `#${String(route || 'menu').replace(/^#/, '')}`;
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      let G = null;
      let Store = null;

      try { G = await import('../engines/gamification.js'); } catch {}
      try { Store = await import('../config/storage.js'); } catch {}

      const STORAGE_KEYS = Store?.STORAGE_KEYS || {};
      const ACH_KEY = STORAGE_KEYS.ACHIEVEMENTS || 'vmq-achievements';

      const loadAchievements =
        typeof G?.loadAchievements === 'function'
          ? G.loadAchievements
          : () => lsGetJSON(ACH_KEY, { unlocked: [], progress: {} });

      const getStatsSummary =
        typeof G?.getStatsSummary === 'function'
          ? G.getStatsSummary
          : null;

      const a = safeObj(loadAchievements(), { unlocked: [], progress: {} });
      const unlockedIds = safeArray(a.unlocked, []);
      const prog = safeObj(a.progress, {});

      const sum = getStatsSummary ? safeObj(getStatsSummary(), null) : null;

      if (!alive) return;
      setUnlocked(unlockedIds);
      setProgress(prog);
      setSummary(sum);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, []);

  const catalog = useMemo(() => {
    const known = new Map(ACHIEVEMENT_CATALOG.map(x => [x.id, x]));
    // Include any unknown unlocked IDs so they still show up.
    const extra = unlocked
      .filter(id => !known.has(id))
      .map(id => ({ id, icon: '✅', title: id, desc: 'Unlocked achievement.' }));
    return [...ACHIEVEMENT_CATALOG, ...extra];
  }, [unlocked]);

  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);
  const unlockedList = useMemo(() => catalog.filter(a => unlockedSet.has(a.id)), [catalog, unlockedSet]);
  const lockedList = useMemo(() => catalog.filter(a => !unlockedSet.has(a.id)), [catalog, unlockedSet]);

  const Header = h(
    'div',
    { className: 'card elevated', style: { marginBottom: 'var(--space-xl)' } },
    h('div', { className: 'flex-row', style: { justifyContent: 'space-between', alignItems: 'center' } },
      h('div', null,
        h('h2', { style: { margin: 0 } }, '🏆 Achievements'),
        h('div', { className: 'text-muted', style: { marginTop: 'var(--space-xs)' } },
          `${unlockedList.length} unlocked • ${lockedList.length} remaining`
        )
      ),
      h('div', { className: 'flex-row', style: { gap: 'var(--space-sm)' } },
        h('button', { className: 'btn btn-secondary', onClick: () => (typeof onBack === 'function' ? onBack() : navigate('menu')) }, '← Menu'),
        h('button', { className: 'btn btn-primary', onClick: () => navigate('dashboard') }, '📊 Dashboard')
      )
    ),
    summary
      ? h('div', { style: { marginTop: 'var(--space-md)' } },
          h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-xs)' } },
            `Level ${summary.levelNumber || 1} • Accuracy ${summary.accuracy || 0}% • Streak ${summary.streak || 0} (best ${summary.bestStreak || 0})`
          )
        )
      : null
  );

  function AchievementCard(a, isUnlocked) {
    const pct = Number(progress?.[a.id]?.pct);
    const hasPct = Number.isFinite(pct);
    return h(
      'div',
      { key: a.id, className: `card ${isUnlocked ? 'card-success' : ''}`, style: { padding: 'var(--space-lg)' } },
      h('div', { className: 'flex-row', style: { alignItems: 'center', justifyContent: 'space-between' } },
        h('div', { className: 'flex-row', style: { alignItems: 'center', gap: 'var(--space-md)' } },
          h('div', { style: { fontSize: '2rem', width: '2.5rem', textAlign: 'center' } }, a.icon || '🏅'),
          h('div', null,
            h('div', { style: { fontWeight: 700 } }, a.title || a.id),
            h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)' } }, a.desc || '')
          )
        ),
        h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)' } },
          isUnlocked ? 'Unlocked ✅' : (hasPct ? `${Math.round(Math.max(0, Math.min(100, pct)))}%` : 'Locked 🔒')
        )
      )
    );
  }

  if (loading) {
    return h('div', { className: 'module-container' }, h('div', { className: 'loading' }, 'Loading achievements...'));
  }

  return h(
    'div',
    { className: 'module-container' },
    Header,
    h('div', { className: 'card elevated', style: { marginBottom: 'var(--space-xl)' } },
      h('div', { className: 'flex-row', style: { justifyContent: 'space-between', alignItems: 'center' } },
        h('h3', { style: { margin: 0 } }, 'Unlocked'),
        h('button', { className: 'btn btn-outline', onClick: () => navigate('planner') }, '📅 Plan next steps')
      ),
      h('div', { style: { marginTop: 'var(--space-md)', display: 'grid', gap: 'var(--space-md)' } },
        unlockedList.length ? unlockedList.map(a => AchievementCard(a, true)) : h('div', { className: 'text-muted' }, 'No achievements yet — start with Intervals or Flashcards!')
      )
    ),
    h('div', { className: 'card elevated' },
      h('h3', { style: { marginTop: 0 } }, 'Locked'),
      h('div', { className: 'text-muted', style: { marginBottom: 'var(--space-md)' } }, 'Keep practicing — many unlock automatically as you build consistency.'),
      h('div', { style: { display: 'grid', gap: 'var(--space-md)' } }, lockedList.map(a => AchievementCard(a, false)))
    )
  );
}
