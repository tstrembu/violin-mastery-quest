// ======================================
// VMQ DASHBOARD v2.1.1 - Enhanced Learning Insights
// Integrates: Gamification, Coach, Analytics, Session Tracking, Pedagogy
// ======================================

const { createElement: h, useState, useEffect, useMemo } = React;
import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { loadXP, loadStreak, getLevel, getNextLevelProgress } from '../engines/gamification.js';
import { getCoachInsights } from '../engines/coachEngine.js';
import { getRecentSessions, getWeeklyStats } from '../engines/sessionTracker.js';
import { getModuleDifficulty } from '../engines/difficultyAdapter.js';

export default function Dashboard({ onBack, onNavigate, refreshStats }) {
  const [stats, setStats] = useState(null);
  const [xp, setXP] = useState(0);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [level, setLevel] = useState({ level: 1, title: 'Beginner', badge: '🎻' });
  const [insights, setInsights] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [timeframe, setTimeframe] = useState('week'); // week, month, all
  const [loading, setLoading] = useState(true);

  // Load all data
  useEffect(() => {
    loadDashboardData();
  }, [timeframe]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Core stats
      const loadedStats = loadJSON(STORAGE_KEYS.STATS, {
        total: 0,
        correct: 0,
        byModule: {},
        byDifficulty: { easy: 0, medium: 0, hard: 0 }
      });

      // Gamification data
      const currentXP = loadXP();
      const streakData = loadStreak();
      const currentLevel = getLevel(currentXP);

      // Coach insights (AI-powered recommendations)
      const coachData = getCoachInsights(loadedStats);

      // Session tracking
      const sessions = getRecentSessions(timeframe);
      const weekly = getWeeklyStats();

      setStats(loadedStats);
      setXP(currentXP);
      setStreak(streakData);
      setLevel(currentLevel);
      setInsights(coachData);
      setRecentSessions(sessions);
      setWeeklyStats(weekly);
    } catch (error) {
      console.error('[Dashboard] Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Computed metrics
  const metrics = useMemo(() => {
    if (!stats) return null;

    const overallAccuracy = stats.total > 0 
      ? Math.round((stats.correct / stats.total) * 100) 
      : 0;

    const grade = overallAccuracy >= 95 ? 'S' :
                  overallAccuracy >= 90 ? 'A' :
                  overallAccuracy >= 80 ? 'B' :
                  overallAccuracy >= 70 ? 'C' :
                  overallAccuracy >= 60 ? 'D' : 'F';

    const gradeColor = grade === 'S' || grade === 'A' ? 'success' :
                       grade === 'B' || grade === 'C' ? 'warning' : 'danger';

    // Module performance
    const moduleStats = Object.entries(stats.byModule || {}).map(([module, data]) => {
      const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      const difficulty = getModuleDifficulty(module);
      
      return {
        module,
        accuracy,
        total: data.total,
        correct: data.correct,
        difficulty,
        grade: accuracy >= 90 ? 'A' : accuracy >= 80 ? 'B' : accuracy >= 70 ? 'C' : 'D',
        needsWork: accuracy < 75 && data.total > 5,
        mastered: accuracy >= 90 && data.total >= 20
      };
    }).sort((a, b) => b.total - a.total);

    // Practice consistency (from weekly stats)
    const practiceStreak = weeklyStats?.streak || 0;
    const avgDaily = weeklyStats?.avgDaily || 0;

    // Learning velocity (XP per day)
    const velocity = weeklyStats?.xpPerDay || 0;

    return {
      overallAccuracy,
      grade,
      gradeColor,
      moduleStats,
      practiceStreak,
      avgDaily,
      velocity,
      totalModules: moduleStats.length,
      masteredModules: moduleStats.filter(m => m.mastered).length
    };
  }, [stats, weeklyStats]);

  if (loading) {
    return h('div', { className: 'module-container' },
      h('div', { className: 'loading-screen' },
        h('div', { className: 'loading-spinner' }),
        h('p', null, 'Loading dashboard...')
      )
    );
  }

  if (!stats || !metrics) {
    return h('div', { className: 'module-container' },
      h('div', { className: 'card card-warning' },
        h('h3', null, '📊 No Data Yet'),
        h('p', null, 'Complete training modules to see your dashboard.'),
        h('button', { 
          className: 'btn btn-primary', 
          onClick: () => onNavigate('intervals') 
        }, 'Start Training →')
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
        h('span', { className: 'live-dot' }),
        h('span', null, 'Live Stats')
      )
    ),

    // Hero Card - Level & Streak
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
            h('div', { className: 'stat-value grade', className: `grade-${metrics.grade}` }, 
              metrics.grade
            ),
            h('div', { className: 'stat-label' }, 'Overall Grade')
          )
        )
      ),
      
      // Progress to next level
      h('div', { className: 'progress-section' },
        h('div', { className: 'progress-label' },
          h('span', null, `Progress to Level ${level.level + 1}`),
          h('span', { className: 'text-muted' }, 
            `${nextLevelProgress.current} / ${nextLevelProgress.required} XP`
          )
        ),
        h('div', { className: 'progress-bar' },
          h('div', { 
            className: 'progress-fill',
            style: { width: `${nextLevelProgress.percentage}%` }
          })
        )
      )
    ),

    // Quick Stats Grid
    h('div', { className: 'stats-grid-4' },
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '🎯'),
        h('div', { className: 'stat-value' }, stats.total.toLocaleString()),
        h('div', { className: 'stat-label' }, 'Total Questions')
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
        h('div', { className: 'stat-icon' }, '📚'),
        h('div', { className: 'stat-value' }, 
          `${metrics.masteredModules}/${metrics.totalModules}`
        ),
        h('div', { className: 'stat-label' }, 'Modules Mastered')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-icon' }, '⚡'),
        h('div', { className: 'stat-value' }, Math.round(metrics.velocity)),
        h('div', { className: 'stat-label' }, 'XP/Day')
      )
    ),

    // Coach Insights (AI Recommendations)
    insights && insights.recommendations.length > 0 && h('div', { className: 'card card-live' },
      h('div', { className: 'card-header' },
        h('h3', null, '🤖 AI Coach Recommendations'),
        h('span', { className: 'badge badge-success' }, 'Powered by Pedagogy Engine')
      ),
      h('div', { className: 'coach-insights' },
        insights.recommendations.slice(0, 4).map((rec, i) =>
          h('div', { 
            key: i, 
            className: `insight insight-${rec.priority}`,
            onClick: rec.action ? () => onNavigate(rec.action) : null,
            style: { cursor: rec.action ? 'pointer' : 'default' }
          },
            h('div', { className: 'insight-header' },
              h('span', { className: 'insight-icon' }, rec.icon || '💡'),
              h('strong', null, rec.area),
              rec.priority === 'urgent' && h('span', { className: 'badge badge-danger' }, 'Focus')
            ),
            h('p', null, rec.suggestion),
            rec.action && h('span', { className: 'insight-cta' }, '→ Practice Now')
          )
        )
      )
    ),

    // Module Performance Breakdown
    h('div', { className: 'card' },
      h('div', { className: 'card-header' },
        h('h3', null, '📈 Module Performance'),
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
            h('p', { className: 'text-muted' }, '📚 Complete training modules to see performance data'),
            h('button', { 
              className: 'btn btn-primary', 
              onClick: () => onNavigate('intervals') 
            }, 'Start Training')
          )
        : h('div', { className: 'module-performance-list' },
            metrics.moduleStats.map(mod =>
              h('div', { 
                key: mod.module, 
                className: 'module-performance-item',
                onClick: () => onNavigate(mod.module.toLowerCase())
              },
                h('div', { className: 'module-info' },
                  h('div', { className: 'module-name' },
                    h('h4', null, mod.module),
                    mod.mastered && h('span', { className: 'badge badge-success' }, '⭐ Mastered'),
                    mod.needsWork && h('span', { className: 'badge badge-warning' }, '⚠️ Needs Work')
                  ),
                  h('div', { className: 'module-meta' },
                    h('span', { className: 'text-muted' }, `${mod.total} attempts`),
                    h('span', { className: 'difficulty-badge', className: `difficulty-${mod.difficulty}` },
                      mod.difficulty
                    )
                  )
                ),
                h('div', { className: 'module-stats' },
                  h('div', { 
                    className: 'accuracy-badge',
                    className: `grade-${mod.grade}` 
                  }, `${mod.accuracy}%`),
                  h('div', { className: 'progress-mini' },
                    h('div', { className: 'progress-bar' },
                      h('div', { 
                        className: 'progress-fill',
                        style: { width: `${mod.accuracy}%` }
                      })
                    )
                  )
                ),
                h('div', { className: 'module-action' },
                  h('span', { className: 'arrow' }, '→')
                )
              )
            )
          )
    ),

    // Weekly Practice Activity
    weeklyStats && h('div', { className: 'card' },
      h('h3', null, '📅 Weekly Activity'),
      h('div', { className: 'weekly-chart' },
        weeklyStats.days.map((day, i) =>
          h('div', { key: i, className: 'day-column' },
            h('div', { 
              className: 'day-bar',
              style: { 
                height: `${Math.min(100, (day.questions / weeklyStats.maxDaily) * 100)}%`,
                background: day.questions > 0 ? 'var(--success)' : 'var(--border)'
              },
              title: `${day.questions} questions on ${day.name}`
            }),
            h('div', { className: 'day-label' }, day.name.slice(0, 1))
          )
        )
      ),
      h('div', { className: 'weekly-summary' },
        h('span', null, `${weeklyStats.totalQuestions} questions this week`),
        h('span', { className: 'text-muted' }, 
          `Avg: ${Math.round(weeklyStats.avgDaily)}/day`
        )
      )
    ),

    // Recent Sessions
    recentSessions.length > 0 && h('div', { className: 'card' },
      h('h3', null, '🕐 Recent Sessions'),
      h('div', { className: 'session-list' },
        recentSessions.slice(0, 5).map((session, i) =>
          h('div', { key: i, className: 'session-item' },
            h('div', { className: 'session-icon' },
              getModuleIcon(session.module)
            ),
            h('div', { className: 'session-info' },
              h('div', { className: 'session-module' }, session.module),
              h('div', { className: 'session-meta' },
                h('span', { className: 'text-muted' }, formatRelativeTime(session.timestamp)),
                h('span', null, `${session.duration}min`)
              )
            ),
            h('div', { className: 'session-stats' },
              h('span', { 
                className: 'session-accuracy',
                style: { color: session.accuracy >= 80 ? 'var(--success)' : 'var(--warning)' }
              }, `${session.accuracy}%`),
              h('span', { className: 'text-muted' }, `+${session.xpGained} XP`)
            )
          )
        )
      )
    ),

    // Achievements Preview
    h('div', { className: 'card' },
      h('div', { className: 'card-header' },
        h('h3', null, '🏆 Recent Achievements'),
        h('button', { 
          className: 'btn btn-sm btn-outline',
          onClick: () => onNavigate('achievements')
        }, 'View All')
      ),
      h('div', { className: 'achievements-preview' },
        getRecentAchievements().map((achievement, i) =>
          h('div', { key: i, className: 'achievement-badge' },
            h('div', { className: 'achievement-icon' }, achievement.icon),
            h('div', { className: 'achievement-name' }, achievement.name)
          )
        )
      )
    ),

    // Quick Actions
    h('div', { className: 'card' },
      h('h3', null, '⚡ Quick Actions'),
      h('div', { className: 'grid-2' },
        h('button', { 
          className: 'btn btn-primary btn-lg', 
          onClick: () => onNavigate('intervals') 
        }, 
          h('span', null, '🎵'),
          h('span', null, 'Practice Intervals')
        ),
        h('button', { 
          className: 'btn btn-primary btn-lg', 
          onClick: () => onNavigate('keys') 
        }, 
          h('span', null, '🎼'),
          h('span', null, 'Study Keys')
        ),
        h('button', { 
          className: 'btn btn-secondary btn-lg', 
          onClick: () => onNavigate('rhythm') 
        }, 
          h('span', null, '🥁'),
          h('span', null, 'Rhythm Drills')
        ),
        h('button', { 
          className: 'btn btn-secondary btn-lg', 
          onClick: () => onNavigate('flashcards') 
        }, 
          h('span', null, '🗂️'),
          h('span', null, 'Flashcards (SM-2)')
        )
      )
    ),

    // Practice Planner Link
    h('div', { className: 'card card-cta' },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        h('div', null,
          h('h3', null, '📋 Practice Planner'),
          h('p', { className: 'text-muted' }, 'Create a structured practice routine based on your goals')
        ),
        h('button', { 
          className: 'btn btn-primary',
          onClick: () => onNavigate('planner')
        }, 'Open Planner →')
      )
    )
  );
}

// ======================================
// HELPER FUNCTIONS
// ======================================

function getModuleIcon(moduleName) {
  const icons = {
    Intervals: '🎵',
    KeySignatures: '🎼',
    Rhythm: '🥁',
    Bieler: '🎻',
    Fingerboard: '🎸',
    Scales: '🎹',
    EarTraining: '👂',
    Flashcards: '🗂️'
  };
  return icons[moduleName] || '📚';
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getRecentAchievements() {
  const achievements = loadJSON(STORAGE_KEYS.ACHIEVEMENTS, { unlocked: [] });
  return achievements.unlocked.slice(-3).reverse();
}
