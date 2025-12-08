// ======================================
// VMQ DASHBOARD v3.0 - ML-Powered Learning Intelligence
// Full Analytics v3.0 + Coach + Gamification + Session + SM-2
// ======================================

const { createElement: h, useState, useEffect, useMemo, useCallback } = React;
import { loadJSON, STORAGE_KEYS } from '../config/storage.js';
import { loadXP, loadStreak, getLevel, getNextLevelProgress } from '../engines/gamification.js';
import { getCoachInsights } from '../engines/coachEngine.js';
import { getRecentSessions, getWeeklyStats } from '../engines/sessionTracker.js';
import { getModuleDifficulty } from '../engines/difficultyAdapter.js';
import { analyzePerformance, generateSmartRecommendations } from '../engines/analytics.js';
import { getStats as getSM2Stats } from '../engines/spacedRepetition.js';

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

  // Load all ML-powered data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Core stats
      const loadedStats = loadJSON(STORAGE_KEYS.STATS, {
        total: 0, correct: 0, byModule: {}, byDifficulty: { easy: 0, medium: 0, hard: 0 }
      });

      // Gamification
      const currentXP = loadXP();
      const streakData = loadStreak();
      const currentLevel = getLevel(currentXP);

      // ML Analytics (v3.0 full power)
      const mlAnalysis = await analyzePerformance(timeframe, {
        includePredictions: true,
        includePatterns: true,
        includeOptimization: true,
        includeBreakthrough: true
      });

      // Coach insights
      const coachData = getCoachInsights(loadedStats);

      // Session tracking
      const sessions = await getRecentSessions(timeframe);
      const weekly = await getWeeklyStats();

      // SM-2 integration
      const sm2 = getSM2Stats ? getSM2Stats() : null;

      setStats(loadedStats);
      setXP(currentXP);
      setStreak(streakData);
      setLevel(currentLevel);
      setAnalysis(mlAnalysis);
      setInsights(coachData);
      setRecentSessions(sessions);
      setWeeklyStats(weekly);
      setSM2Stats(sm2);
    } catch (error) {
      console.error('[Dashboard v3.0] Load failed:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Enhanced computed metrics with ML predictions
  const metrics = useMemo(() => {
    if (!stats || !analysis) return null;

    const overallAccuracy = stats.total > 0 
      ? Math.round((stats.correct / stats.total) * 100) : 0;

    const grade = overallAccuracy >= 95 ? 'S' :
                  overallAccuracy >= 90 ? 'A' :
                  overallAccuracy >= 80 ? 'B' :
                  overallAccuracy >= 70 ? 'C' :
                  overallAccuracy >= 60 ? 'D' : 'F';

    const gradeColor = grade === 'S' || grade === 'A' ? 'success' :
                       grade === 'B' || grade === 'C' ? 'warning' : 'danger';

    // Module performance with ML mastery scoring
    const moduleStats = analysis.modules?.map(mod => ({
      ...mod,
      grade: mod.accuracy >= 90 ? 'A' : mod.accuracy >= 80 ? 'B' : 
             mod.accuracy >= 70 ? 'C' : 'D',
      needsWork: mod.accuracy < 75 && mod.attempts > 5,
      mastered: mod.mastery >= 90,
      breakthroughReady: analysis.predictions?.breakthroughModules?.some(
        b => b.moduleKey === mod.moduleKey
      )
    })) || [];

    return {
      overallAccuracy,
      grade,
      gradeColor,
      moduleStats,
      practiceStreak: analysis.trends?.currentStreak || 0,
      weeklyDays: analysis.trends?.sessionsPerDay ? 
        Math.round(analysis.trends.sessionsPerDay * 7) : 0,
      velocity: analysis.predictions?.nextWeekAccuracy?.predicted || 0,
      plateauRisk: analysis.predictions?.plateauRisk?.risk || 'low',
      retention: analysis.retentionMetrics?.currentRetention || 0,
      totalModules: moduleStats.length,
      masteredModules: moduleStats.filter(m => m.mastered).length,
      breakthroughCount: moduleStats.filter(m => m.breakthroughReady).length
    };
  }, [stats, analysis]);

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
          onClick: () => onNavigate('intervals') 
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

    // Hero Card - Enhanced with ML predictions
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
            h('div', { className: 'stat-value' }, xp.toLocaleString()),
            h('div', { className: 'stat-label' }, 'Total XP')
          ),
          h('div', { className: 'stat-card compact streak' },
            h('div', { className: 'stat-value' }, `${streak.current} 🔥`),
            h('div', { className: 'stat-label' }, 'Day Streak')
          ),
          h('div', { className: 'stat-card compact' },
            h('div', { 
              className: `stat-value grade-${metrics.grade}` 
            }, metrics.grade),
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
            style: { width: `${nextLevelProgress.percentage}%` }
          })
        )
      ),

      // ML Prediction Banner
      analysis.predictions && h('div', { className: 'ml-prediction-banner' },
        h('div', null,
          h('strong', null, '🎯 Next Week Prediction'),
          h('span', { className: 'text-muted' }, 
            `${analysis.predictions.nextWeekAccuracy?.predicted || '?'}% accuracy`
          )
        ),
        analysis.predictions.nextWeekAccuracy?.trend !== 'stable' &&
        h('span', { 
          className: `prediction-trend ${analysis.predictions.nextWeekAccuracy.trend}` 
        },
          analysis.predictions.nextWeekAccuracy.trend
        )
      )
    ),

    // ML Quick Stats (5 key metrics)
    h('div', { className: 'stats-grid-5' },
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🎯'),
        h('div', { className: 'stat-value' }, stats.total.toLocaleString()),
        h('div', { className: 'stat-label' }, 'Questions')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '✅'),
        h('div', { 
          className: 'stat-value',
          style: { color: `var(--${metrics.gradeColor})` }
        }, `${metrics.overallAccuracy}%`),
        h('div', { className: 'stat-label' }, 'Accuracy')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '⭐'),
        h('div', { className: 'stat-value' }, 
          `${metrics.masteredModules}/${metrics.totalModules}`),
        h('div', { className: 'stat-label' }, 'Mastered')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🧠'),
        h('div', { className: 'stat-value' }, `${metrics.retention?.toFixed(0)}%`),
        h('div', { className: 'stat-label' }, 'Retention')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🚀'),
        h('div', { className: 'stat-value' }, metrics.breakthroughCount),
        h('div', { className: 'stat-label' }, 'Breakthroughs Ready')
      )
    ),

    // Smart Recommendations (ML + Coach fusion)
    h('div', { className: 'card card-live' },
      h('div', { className: 'card-header' },
        h('h3', null, '🎯 Smart Recommendations'),
        h('span', { className: 'badge badge-primary' }, 'ML + Coach')
      ),
      h('div', { className: 'coach-insights' },
        (insights?.recommendations || []).slice(0, 3).concat(
          analysis?.recommendations?.slice(0, 2) || []
        ).map((rec, i) =>
          h('div', { 
            key: i, 
            className: `insight insight-${rec.priority || 'medium'}`,
            onClick: rec.action ? () => onNavigate(rec.action.replace('#', '')) : null,
            style: { cursor: rec.action ? 'pointer' : 'default' },
            title: rec.reasoning || rec.message
          },
            h('div', { className: 'insight-header' },
              h('span', { className: 'insight-icon' }, rec.icon || '💡'),
              h('strong', null, rec.title || rec.area),
              (rec.priority === 'urgent' || rec.priority === 'high') &&
              h('span', { className: 'badge badge-danger' }, rec.priority)
            ),
            h('p', null, rec.message || rec.suggestion),
            rec.mlConfidence && h('small', { className: 'ml-confidence' },
              `ML Confidence: ${(rec.mlConfidence * 100).toFixed(0)}%`
            )
          )
        )
      )
    ),

    // Breakthrough Opportunities (ML-powered)
    analysis?.predictions?.breakthroughModules?.length > 0 && 
    h('div', { className: 'card card-breakthrough' },
      h('div', { className: 'card-header' },
        h('h3', null, '🚀 Breakthrough Ready'),
        h('span', { className: 'badge badge-success' }, 
          `${analysis.predictions.breakthroughModules.length} modules`
        )
      ),
      h('div', { className: 'breakthrough-list' },
        analysis.predictions.breakthroughModules.slice(0, 3).map((mod, i) =>
          h('div', { 
            key: i, 
            className: 'breakthrough-item',
            onClick: () => onNavigate(mod.moduleKey)
          },
            h('div', null,
              h('strong', null, mod.module),
              h('small', { className: 'text-muted' }, 
                `${mod.breakthroughLikelihood}% chance • ~${mod.estimatedDays} days`
              )
            ),
            h('span', { className: 'breakthrough-score' }, 
              `+${(95 - mod.currentAccuracy).toFixed(0)}%`
            )
          )
        )
      )
    ),

    // Module Performance with ML mastery scores
    h('div', { className: 'card' },
      h('div', { className: 'card-header' },
        h('h3', null, '📊 Module Mastery'),
        h('div', { className: 'timeframe-toggle' },
          ['week', 'month', 'all'].map(tf =>
            h('button', {
              key: tf,
              className: `btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-outline'}`,
              onClick: () => setTimeframe(tf)
            }, tf.charAt(0).toUpperCase() + tf.slice(1))
          )
        )
      ),
      metrics.moduleStats.length === 0 
        ? h('div', { className: 'empty-state' },
            h('p', { className: 'text-muted' }, 
              'Practice modules to see your mastery progress'),
            h('button', { className: 'btn btn-primary', onClick: () => onNavigate('intervals') },
              '🎵 Start Intervals'))
        : h('div', { className: 'module-performance-list' },
            metrics.moduleStats.slice(0, 8).map(mod =>
              h('div', { 
                key: mod.moduleKey || mod.module, 
                className: `module-performance-item 
                  ${mod.mastered ? 'mastered' : ''} 
                  ${mod.breakthroughReady ? 'breakthrough' : ''}`,
                onClick: () => onNavigate(mod.moduleKey || mod.module.toLowerCase().replace(/\s+/g, ''))
              },
                h('div', { className: 'module-info' },
                  h('div', { className: 'module-name' },
                    h('h4', null, mod.module),
                    mod.mastered && h('span', { className: 'badge badge-success' }, '⭐'),
                    mod.breakthroughReady && h('span', { className: 'badge badge-primary' }, '🚀'),
                    mod.needsWork && h('span', { className: 'badge badge-warning' }, '⚠️')
                  ),
                  h('div', { className: 'module-meta' },
                    h('span', { className: 'text-muted' }, `${mod.attempts || mod.total} att`),
                    h('span', { className: `difficulty-badge difficulty-${mod.difficulty}` },
                      mod.difficulty || 'med'
                    )
                  )
                ),
                h('div', { className: 'module-stats' },
                  h('div', { className: `accuracy-badge grade-${mod.grade}` }, 
                    `${mod.accuracy}%`),
                  h('div', { className: 'progress-mini' },
                    h('div', { className: 'progress-bar' },
                      h('div', { 
                        className: 'progress-fill',
                        style: { width: `${mod.accuracy}%` }
                      })
                    )
                  ),
                  mod.mastery && h('div', { className: 'mastery-score' }, 
                    `M:${mod.mastery}%`
                  )
                ),
                h('div', { className: 'module-action' },
                  h('span', { className: 'arrow' }, '→')
                )
              )
            )
          )
    ),

    // Weekly + Retention Chart
    h('div', { className: 'grid-2' },
      // Weekly Activity
      weeklyStats && h('div', { className: 'card' },
        h('h3', null, '📅 This Week'),
        h('div', { className: 'weekly-chart' },
          weeklyStats.days.map((day, i) =>
            h('div', { key: i, className: 'day-column' },
              h('div', { 
                className: 'day-bar',
                style: { 
                  height: `${Math.min(100, (day.questions / weeklyStats.maxDaily) * 100)}%`,
                  background: day.questions > 0 ? 'var(--success)' : 'var(--border)'
                }
              }),
              h('div', { className: 'day-label' }, day.name.slice(0, 1))
            )
          )
        ),
        h('div', { className: 'weekly-summary' },
          h('span', null, `${weeklyStats.totalQuestions} questions`),
          h('span', { className: 'text-muted' }, `Avg ${Math.round(weeklyStats.avgDaily)}/day`)
        )
      ),

      // SM-2 Retention
      sm2Stats && h('div', { className: 'card' },
        h('h3', null, '🧠 Retention'),
        h('div', { className: 'retention-metrics' },
          h('div', { className: 'stat-large' }, `${metrics.retention?.toFixed(0)}%`),
          h('div', { className: 'retention-breakdown' },
            h('div', null, `📚 ${sm2Stats.dueToday || 0} due`),
            h('div', null, `⭐ ${sm2Stats.mature || 0} mature`)
          )
        ),
        h('div', { className: 'progress-bar' },
          h('div', { 
            className: 'progress-fill',
            style: { width: `${metrics.retention || 0}%` }
          })
        )
      )
    ),

    // Recent Sessions (condensed)
    recentSessions.length > 0 && h('div', { className: 'card' },
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

// Enhanced helper functions
function getModuleIcon(moduleName) {
  const icons = {
    'intervals': '🎵', 'keysignatures': '🎼', 'rhythm': '🥁', 
    'bieler': '🎻', 'fingerboard': '🎸', 'scales': '🎹',
    'interval-ear': '👂', 'flashcards': '🗂️'
  };
  return icons[moduleName?.toLowerCase()] || '📚';
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 60000);
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff/60)}h ago`;
}
