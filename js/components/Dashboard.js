// js/components/Dashboard.js
// ======================================
// VMQ DASHBOARD v3.0 - ML-Powered Learning Intelligence
// Full Analytics v3.0 + Coach + Gamification + Session + SM-2
// ======================================

import { loadJSON, STORAGE_KEYS } from '../config/storage.js';

// Use namespace imports to avoid hard-crashes when some named exports don’t exist yet.
import * as G from '../engines/gamification.js';
import * as Coach from '../engines/coachEngine.js';
import * as Session from '../engines/sessionTracker.js';
import * as Diff from '../engines/difficultyAdapter.js';
import * as A from '../engines/analytics.js';
import * as SR from '../engines/spacedRepetition.js';

const { createElement: h, useState, useEffect, useMemo, useCallback } = React;

function safeFn(mod, name, fallback = null) {
  const fn = mod && typeof mod[name] === 'function' ? mod[name] : fallback;
  return fn;
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const k = keyFn(x);
    if (k == null) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

export default function Dashboard({ onBack, onNavigate, refreshStats }) {
  const [stats, setStats] = useState(null);
  const [xp, setXP] = useState(0);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [level, setLevel] = useState({ level: 1, title: 'Beginner', badge: '🎻' });
  const [insights, setInsights] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [sm2Stats, setSM2Stats] = useState(null);
  const [timeframe, setTimeframe] = useState('week');
  const [loading, setLoading] = useState(true);

  const loadXP = safeFn(G, 'loadXP', () => 0);
  const loadStreak = safeFn(G, 'loadStreak', () => ({ current: 0, longest: 0 }));
  const getLevel = safeFn(G, 'getLevel', () => ({ level: 1, title: 'Beginner', badge: '🎻', xpToNext: 1000 }));
  const getNextLevelProgress = safeFn(G, 'getNextLevelProgress', (xpVal) => {
    const required = 1000;
    const cur = Math.max(0, Number(xpVal) || 0);
    return { current: cur % required, required, percentage: Math.min(100, Math.round(((cur % required) / required) * 100)) };
  });

  const getCoachInsights = safeFn(Coach, 'getCoachInsights', () => ({ recommendations: [] }));

  const getRecentSessions = safeFn(Session, 'getRecentSessions', async () => []);
  const getWeeklyStats = safeFn(Session, 'getWeeklyStats', async () => null);

  // (Optional) future use inside dashboard
  const getModuleDifficulty = safeFn(Diff, 'getModuleDifficulty', () => null);

  const analyzePerformance = safeFn(A, 'analyzePerformance', async () => null);
  const generateSmartRecommendations = safeFn(A, 'generateSmartRecommendations', null);

  const getSM2Stats = safeFn(SR, 'getStats', null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      const loadedStats = loadJSON(STORAGE_KEYS.STATS, {
        total: 0,
        correct: 0,
        byModule: {},
        byDifficulty: { easy: 0, medium: 0, hard: 0 },
      });

      const currentXP = loadXP();
      const streakData = loadStreak();
      const currentLevel = getLevel(currentXP);

      const [
        mlAnalysis,
        coachData,
        sessions,
        weekly,
        sm2,
      ] = await Promise.all([
        analyzePerformance(timeframe, {
          includePredictions: true,
          includePatterns: true,
          includeOptimization: true,
          includeBreakthrough: true,
        }).catch(() => null),

        // coach is typically sync; keep safe either way
        Promise.resolve(getCoachInsights(loadedStats)).catch(() => ({ recommendations: [] })),

        getRecentSessions(timeframe).catch(() => []),
        getWeeklyStats().catch(() => null),
        Promise.resolve(getSM2Stats ? getSM2Stats() : null).catch(() => null),
      ]);

      // If analytics engine is missing / returns null, build a minimal analysis fallback
      const fallbackAnalysis = mlAnalysis || {
        modules: Object.entries(loadedStats.byModule || {}).map(([moduleKey, m]) => {
          const total = Number(m.total || 0);
          const correct = Number(m.correct || 0);
          const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
          return {
            moduleKey,
            module: m.name || moduleKey,
            attempts: total,
            total,
            correct,
            accuracy,
            difficulty: m.difficulty || 'medium',
            mastery: accuracy,
          };
        }),
        recommendations: [],
        predictions: null,
        trends: null,
        retentionMetrics: null,
      };

      setStats(loadedStats);
      setXP(currentXP);
      setStreak(streakData);
      setLevel(currentLevel);
      setAnalysis(fallbackAnalysis);
      setInsights(coachData);
      setRecentSessions(Array.isArray(sessions) ? sessions : []);
      setWeeklyStats(weekly);
      setSM2Stats(sm2);

      if (typeof refreshStats === 'function') {
        // keep parent state synced if provided
        refreshStats();
      }
    } catch (err) {
      console.error('[Dashboard v3.0] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, analyzePerformance, getCoachInsights, getRecentSessions, getWeeklyStats, getSM2Stats, loadXP, loadStreak, getLevel, refreshStats]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const metrics = useMemo(() => {
    if (!stats || !analysis) return null;

    const total = Number(stats.total || 0);
    const correct = Number(stats.correct || 0);

    const overallAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const grade =
      overallAccuracy >= 95 ? 'S' :
      overallAccuracy >= 90 ? 'A' :
      overallAccuracy >= 80 ? 'B' :
      overallAccuracy >= 70 ? 'C' :
      overallAccuracy >= 60 ? 'D' : 'F';

    const gradeColor =
      grade === 'S' || grade === 'A' ? 'success' :
      grade === 'B' || grade === 'C' ? 'warning' : 'danger';

    const moduleStats = (analysis.modules || []).map((mod) => {
      const accuracy = Number(mod.accuracy ?? 0);
      const attempts = Number(mod.attempts ?? mod.total ?? 0);
      const mastery = Number(mod.mastery ?? accuracy);
      return {
        ...mod,
        accuracy,
        attempts,
        mastery,
        grade: accuracy >= 90 ? 'A' : accuracy >= 80 ? 'B' : accuracy >= 70 ? 'C' : 'D',
        needsWork: accuracy < 75 && attempts > 5,
        mastered: mastery >= 90,
        breakthroughReady: !!analysis?.predictions?.breakthroughModules?.some(
          (b) => b.moduleKey === mod.moduleKey
        ),
      };
    });

    const retention = Number(analysis?.retentionMetrics?.currentRetention ?? 0);

    return {
      overallAccuracy,
      grade,
      gradeColor,
      moduleStats,
      practiceStreak: Number(analysis?.trends?.currentStreak ?? 0),
      weeklyDays: analysis?.trends?.sessionsPerDay ? Math.round(Number(analysis.trends.sessionsPerDay) * 7) : 0,
      velocity: Number(analysis?.predictions?.nextWeekAccuracy?.predicted ?? 0),
      plateauRisk: analysis?.predictions?.plateauRisk?.risk || 'low',
      retention,
      totalModules: moduleStats.length,
      masteredModules: moduleStats.filter((m) => m.mastered).length,
      breakthroughCount: moduleStats.filter((m) => m.breakthroughReady).length,
    };
  }, [stats, analysis]);

  const fusedRecommendations = useMemo(() => {
    const coachRecs = (insights?.recommendations || []).map((r) => ({ ...r, _src: 'coach' }));
    const mlRecs = (analysis?.recommendations || []).map((r) => ({ ...r, _src: 'ml' }));

    let fused = coachRecs.concat(mlRecs);

    // If analytics engine provides a fusion helper, prefer it
    if (generateSmartRecommendations) {
      try {
        fused = generateSmartRecommendations({ coachRecs, mlRecs, stats, analysis }) || fused;
      } catch {}
    }

    // Dedupe by (title/message/action)
    fused = uniqBy(fused, (r) => `${r.title || ''}::${r.message || r.suggestion || ''}::${r.action || ''}`);

    return fused.slice(0, 5);
  }, [insights, analysis, stats, generateSmartRecommendations]);

  if (loading) {
    return h('div', { className: 'module-container' },
      h('div', { className: 'loading-screen' },
        h('div', { className: 'loading-spinner' }),
        h('p', null, 'Loading ML insights...')
      )
    );
  }

  if (!stats || !metrics) {
    return h('div', { className: 'module-container' },
      h('div', { className: 'card card-warning' },
        h('h3', null, '📊 No Data Yet'),
        h('p', null, 'Complete training modules to unlock your dashboard.'),
        h('button', {
          className: 'btn btn-primary',
          onClick: () => onNavigate('intervals'),
        }, '🎵 Start with Intervals →')
      )
    );
  }

  const nextLevelProgress = getNextLevelProgress(xp);

  return h('div', { className: 'module-container dashboard' },

    // Header
    h('header', { className: 'module-header' },
      h('button', { className: 'btn-back', onClick: onBack }, '← Back'),
      h('h2', null, '📊 Dashboard'),
      h('div', { className: 'stats-inline' },
        h('span', { className: 'live-dot', 'aria-live': 'polite' }),
        h('span', null, 'ML-Powered Insights')
      )
    ),

    // Hero Card
    h('div', { className: 'card card-elevated hero-card' },
      h('div', { className: 'hero-content' },
        h('div', { className: 'level-badge-large' },
          h('div', { className: 'badge-icon' }, level.badge),
          h('div', { className: 'badge-info' },
            h('h3', null, level.title),
            h('p', { className: 'text-muted' }, `Level ${level.level}`)
          )
        ),
        h('div', { className: 'hero-stats' },
          h('div', { className: 'stat-card compact' },
            h('div', { className: 'stat-value' }, Number(xp || 0).toLocaleString()),
            h('div', { className: 'stat-label' }, 'Total XP')
          ),
          h('div', { className: 'stat-card compact streak' },
            h('div', { className: 'stat-value' }, `${streak.current || 0} 🔥`),
            h('div', { className: 'stat-label' }, 'Day Streak')
          ),
          h('div', { className: 'stat-card compact' },
            h('div', { className: `stat-value grade-${metrics.grade}` }, metrics.grade),
            h('div', { className: 'stat-label' }, 'Grade')
          )
        )
      ),

      // Next Level Progress
      h('div', { className: 'progress-section' },
        h('div', { className: 'progress-label' },
          h('span', null, `To Level ${level.level + 1}`),
          h('span', { className: 'text-muted' },
            `${nextLevelProgress.current}/${nextLevelProgress.required} XP`
          )
        ),
        h('div', { className: 'progress-bar' },
          h('div', {
            className: 'progress-fill',
            style: { width: `${nextLevelProgress.percentage}%` },
          })
        )
      ),

      // ML Prediction Banner
      analysis?.predictions && h('div', { className: 'ml-prediction-banner' },
        h('div', null,
          h('strong', null, '🎯 Next Week Prediction'),
          h('span', { className: 'text-muted' },
            `${analysis.predictions.nextWeekAccuracy?.predicted ?? '?'}% accuracy`
          )
        ),
        analysis.predictions.nextWeekAccuracy?.trend &&
        analysis.predictions.nextWeekAccuracy.trend !== 'stable' &&
        h('span', { className: `prediction-trend ${analysis.predictions.nextWeekAccuracy.trend}` },
          analysis.predictions.nextWeekAccuracy.trend
        )
      )
    ),

    // Quick Stats
    h('div', { className: 'stats-grid-5' },
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🎯'),
        h('div', { className: 'stat-value' }, Number(stats.total || 0).toLocaleString()),
        h('div', { className: 'stat-label' }, 'Questions')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '✅'),
        h('div', {
          className: 'stat-value',
          style: { color: `var(--${metrics.gradeColor})` },
        }, `${metrics.overallAccuracy}%`),
        h('div', { className: 'stat-label' }, 'Accuracy')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '⭐'),
        h('div', { className: 'stat-value' }, `${metrics.masteredModules}/${metrics.totalModules}`),
        h('div', { className: 'stat-label' }, 'Mastered')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🧠'),
        h('div', { className: 'stat-value' }, `${Number(metrics.retention || 0).toFixed(0)}%`),
        h('div', { className: 'stat-label' }, 'Retention')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🚀'),
        h('div', { className: 'stat-value' }, metrics.breakthroughCount),
        h('div', { className: 'stat-label' }, 'Breakthroughs Ready')
      )
    ),

    // Smart Recommendations
    h('div', { className: 'card card-live' },
      h('div', { className: 'card-header' },
        h('h3', null, '🎯 Smart Recommendations'),
        h('span', { className: 'badge badge-primary' }, 'ML + Coach')
      ),
      h('div', { className: 'coach-insights' },
        (fusedRecommendations || []).map((rec, i) =>
          h('div', {
            key: i,
            className: `insight insight-${rec.priority || 'medium'}`,
            onClick: rec.action ? () => onNavigate(String(rec.action).replace('#', '')) : null,
            style: { cursor: rec.action ? 'pointer' : 'default' },
            title: rec.reasoning || rec.message,
          },
            h('div', { className: 'insight-header' },
              h('span', { className: 'insight-icon' }, rec.icon || '💡'),
              h('strong', null, rec.title || rec.area || 'Recommendation'),
              (rec.priority === 'urgent' || rec.priority === 'high') &&
              h('span', { className: 'badge badge-danger' }, rec.priority)
            ),
            h('p', null, rec.message || rec.suggestion || ''),
            rec.mlConfidence != null && h('small', { className: 'ml-confidence' },
              `ML Confidence: ${(Number(rec.mlConfidence) * 100).toFixed(0)}%`
            )
          )
        )
      )
    ),

    // Breakthrough Opportunities
    analysis?.predictions?.breakthroughModules?.length > 0 &&
    h('div', { className: 'card card-breakthrough' },
      h('div', { className: 'card-header' },
        h('h3', null, '🚀 Breakthrough Ready'),
        h('span', { className: 'badge badge-success' }, `${analysis.predictions.breakthroughModules.length} modules`)
      ),
      h('div', { className: 'breakthrough-list' },
        analysis.predictions.breakthroughModules.slice(0, 3).map((mod, i) =>
          h('div', { key: i, className: 'breakthrough-item', onClick: () => onNavigate(mod.moduleKey) },
            h('div', null,
              h('strong', null, mod.module),
              h('small', { className: 'text-muted' },
                `${mod.breakthroughLikelihood}% chance • ~${mod.estimatedDays} days`
              )
            ),
            h('span', { className: 'breakthrough-score' }, `+${(95 - mod.currentAccuracy).toFixed(0)}%`)
          )
        )
      )
    ),

    // Module Mastery
    h('div', { className: 'card' },
      h('div', { className: 'card-header' },
        h('h3', null, '📊 Module Mastery'),
        h('div', { className: 'timeframe-toggle' },
          ['week', 'month', 'all'].map((tf) =>
            h('button', {
              key: tf,
              className: `btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-outline'}`,
              onClick: () => setTimeframe(tf),
            }, tf.charAt(0).toUpperCase() + tf.slice(1))
          )
        )
      ),
      metrics.moduleStats.length === 0
        ? h('div', { className: 'empty-state' },
            h('p', { className: 'text-muted' }, 'Practice modules to see your mastery progress'),
            h('button', { className: 'btn btn-primary', onClick: () => onNavigate('intervals') }, '🎵 Start Intervals'))
        : h('div', { className: 'module-performance-list' },
            metrics.moduleStats.slice(0, 8).map((mod) =>
              h('div', {
                key: mod.moduleKey || mod.module,
                className: `module-performance-item ${mod.mastered ? 'mastered' : ''} ${mod.breakthroughReady ? 'breakthrough' : ''}`,
                onClick: () => onNavigate(mod.moduleKey || String(mod.module || '').toLowerCase().replace(/\s+/g, '')),
              },
                h('div', { className: 'module-info' },
                  h('div', { className: 'module-name' },
                    h('h4', null, mod.module),
                    mod.mastered && h('span', { className: 'badge badge-success' }, '⭐'),
                    mod.breakthroughReady && h('span', { className: 'badge badge-primary' }, '🚀'),
                    mod.needsWork && h('span', { className: 'badge badge-warning' }, '⚠️')
                  ),
                  h('div', { className: 'module-meta' },
                    h('span', { className: 'text-muted' }, `${mod.attempts || 0} att`),
                    h('span', { className: `difficulty-badge difficulty-${mod.difficulty || 'medium'}` }, mod.difficulty || 'med')
                  )
                ),
                h('div', { className: 'module-stats' },
                  h('div', { className: `accuracy-badge grade-${mod.grade}` }, `${mod.accuracy}%`),
                  h('div', { className: 'progress-mini' },
                    h('div', { className: 'progress-bar' },
                      h('div', { className: 'progress-fill', style: { width: `${mod.accuracy}%` } })
                    )
                  ),
                  mod.mastery != null && h('div', { className: 'mastery-score' }, `M:${mod.mastery}%`)
                ),
                h('div', { className: 'module-action' }, h('span', { className: 'arrow' }, '→'))
              )
            )
          )
    ),

    // Weekly + Retention
    h('div', { className: 'grid-2' },
      weeklyStats?.days && h('div', { className: 'card' },
        h('h3', null, '📅 This Week'),
        h('div', { className: 'weekly-chart' },
          weeklyStats.days.map((day, i) =>
            h('div', { key: i, className: 'day-column' },
              h('div', {
                className: 'day-bar',
                style: {
                  height: `${Math.min(100, (Number(day.questions || 0) / Math.max(1, weeklyStats.maxDaily || 1)) * 100)}%`,
                  background: (day.questions || 0) > 0 ? 'var(--success)' : 'var(--border)',
                },
              }),
              h('div', { className: 'day-label' }, String(day.name || '').slice(0, 1))
            )
          )
        ),
        h('div', { className: 'weekly-summary' },
          h('span', null, `${weeklyStats.totalQuestions || 0} questions`),
          h('span', { className: 'text-muted' }, `Avg ${Math.round(weeklyStats.avgDaily || 0)}/day`)
        )
      ),

      sm2Stats && h('div', { className: 'card' },
        h('h3', null, '🧠 Retention'),
        h('div', { className: 'retention-metrics' },
          h('div', { className: 'stat-large' }, `${Number(metrics.retention || 0).toFixed(0)}%`),
          h('div', { className: 'retention-breakdown' },
            h('div', null, `📚 ${sm2Stats.dueToday || 0} due`),
            h('div', null, `⭐ ${sm2Stats.mature || 0} mature`)
          )
        ),
        h('div', { className: 'progress-bar' },
          h('div', { className: 'progress-fill', style: { width: `${Number(metrics.retention || 0)}%` } })
        )
      )
    ),

    // Recent Sessions
    Array.isArray(recentSessions) && recentSessions.length > 0 && h('div', { className: 'card' },
      h('h3', null, '🕐 Recent'),
      h('div', { className: 'session-list compact' },
        recentSessions.slice(0, 4).map((session, i) =>
          h('div', { key: i, className: 'session-item compact' },
            h('div', { className: 'session-icon' }, getModuleIcon(session.module)),
            h('div', { className: 'session-info compact' },
              h('div', null, session.module),
              h('div', { className: 'session-meta compact' },
                h('span', null, `${session.accuracy}%`),
                h('span', null, `+${session.xpGained}XP`)
              )
            )
          )
        )
      )
    )
  );
}

function getModuleIcon(moduleName) {
  const icons = {
    intervals: '🎵',
    keysignatures: '🎼',
    rhythm: '🥁',
    bieler: '🎻',
    fingerboard: '🎸',
    scales: '🎹',
    'interval-ear': '👂',
    flashcards: '🗂️',
  };
  return icons[String(moduleName || '').toLowerCase()] || '📚';
}