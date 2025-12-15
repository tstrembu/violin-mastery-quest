// js/engines/analytics.js
/**
 * Analytics Component
 * Detailed progress tracking and insights
 */

import {
  getAllModuleStats,
  getProgressSummary,
  getStrengthsWeaknesses
} from '../engines/analytics.js';

import {
  loadStreak,
  loadAchievements
} from '../config/storage.js';

import { ACHIEVEMENTS } from '../config/constants.js';
import { VMQ_ROUTES } from '../utils/router.js';

// Use React from the global UMD bundle
const { createElement: h, useState, useEffect } = React;

export default function Analytics({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [moduleStats, setModuleStats] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    const s = getProgressSummary();
    const stats = getAllModuleStats();
    const a = getStrengthsWeaknesses();

    const unlockedIds = loadAchievements();
    const achievementsList = ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: unlockedIds.includes(ach.id)
    }));

    setSummary(s);
    setModuleStats(stats);
    setAnalysis(a);
    setAchievements(achievementsList);
  }, []);

  return h('div', { className: 'container' },
    h('h2', null, '📈 Progress Analytics'),

    // Overall Summary
    summary && h('div', { className: 'card', style: { marginBottom: '20px' } },
      h('h3', null, 'Overall Progress'),
      h('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '20px',
          marginTop: '16px'
        }
      },
        h('div', null,
          h('div', { className: 'small', style: { color: '#6c757d' } }, 'Questions Answered'),
          h('div', { style: { fontSize: '1.8rem', fontWeight: 'bold', color: '#007bff' } },
            summary.totalQuestions
          )
        ),
        h('div', null,
          h('div', { className: 'small', style: { color: '#6c757d' } }, 'Overall Accuracy'),
          h('div', { style: { fontSize: '1.8rem', fontWeight: 'bold', color: '#28a745' } },
            `${summary.overallAccuracy}%`
          )
        ),
        h('div', null,
          h('div', { className: 'small', style: { color: '#6c757d' } }, 'Modules Mastered'),
          h('div', { style: { fontSize: '1.8rem', fontWeight: 'bold', color: '#ffc107' } },
            `${summary.masteredModules}/${summary.totalModules}`
          )
        ),
        h('div', null,
          h('div', { className: 'small', style: { color: '#6c757d' } }, 'Practice Streak'),
          h('div', { style: { fontSize: '1.8rem', fontWeight: 'bold' } },
            h('span', null, '🔥'),
            h('span', { style: { marginLeft: '8px' } }, loadStreak())
          )
        )
      )
    ),

    // Module Breakdown
    h('div', { className: 'card', style: { marginBottom: '20px' } },
      h('h3', null, 'Module Breakdown'),
      h('div', { style: { marginTop: '16px' } },
        moduleStats.map(module =>
          h('div', {
            key: module.id,
            style: { marginBottom: '20px' }
          },
            h('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }
            },
              h('span', null,
                h('span', { style: { fontSize: '1.2rem', marginRight: '8px' } }, module.icon),
                h('strong', null, module.name)
              ),
              h('span', {
                style: {
                  padding: '4px 12px',
                  background: module.status.color,
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.85rem'
                }
              }, module.status.label)
            ),
            h('div', { className: 'progress-wrapper' },
              h('div', {
                className: 'progress-bar',
                style: { width: `${module.accuracy}%` }
              })
            ),
            h('div', {
              className: 'small',
              style: {
                marginTop: '4px',
                color: '#6c757d'
              }
            }, `${module.accuracy}% accuracy • ${module.correct}/${module.total} correct`)
          )
        )
      )
    ),

    // Strengths & Weaknesses
    analysis && h('div', { className: 'analytics-grid' },

      // Strengths
      analysis.strengths.length > 0 && h('div', { className: 'analytics-card' },
        h('h3', null, '💪 Strengths'),
        analysis.strengths.map(module =>
          h('div', {
            key: module.id,
            className: 'stat-row'
          },
            h('span', null,
              h('span', { style: { marginRight: '8px' } }, module.icon),
              module.name
            ),
            h('strong', { style: { color: '#28a745' } }, `${module.accuracy}%`)
          )
        )
      ),

      // Weaknesses
      analysis.weaknesses.length > 0 && h('div', { className: 'analytics-card' },
        h('h3', null, '🎯 Areas to Improve'),
        analysis.weaknesses.map(module =>
          h('div', {
            key: module.id,
            className: 'stat-row'
          },
            h('span', null,
              h('span', { style: { marginRight: '8px' } }, module.icon),
              module.name
            ),
            h('strong', { style: { color: '#dc3545' } }, `${module.accuracy}%`)
          )
        )
      )
    ),

    // Achievements
    h('div', { className: 'card', style: { marginTop: '20px' } },
      h('h3', null, '🏆 Achievements'),
      h('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '12px',
          marginTop: '16px'
        }
      },
        achievements.map(ach =>
          h('div', {
            key: ach.id,
            style: {
              padding: '16px',
              background: ach.unlocked
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#f8f9fa',
              color: ach.unlocked ? 'white' : '#6c757d',
              borderRadius: '8px',
              opacity: ach.unlocked ? 1 : 0.6
            }
          },
            h('div', { style: { fontSize: '2rem', marginBottom: '8px' } },
              ach.unlocked ? '🏆' : '🔒'
            ),
            h('div', { style: { fontWeight: 'bold', marginBottom: '4px' } }, ach.name),
            h('div', { style: { fontSize: '0.85rem' } }, ach.description),
            h('div', { style: { fontSize: '0.85rem', marginTop: '8px' } }, `${ach.xp} XP`)
          )
        )
      )
    ),

    // Navigation
    h('div', {
      style: {
        marginTop: '32px',
        display: 'flex',
        gap: '12px'
      }
    },
      h('button', {
        className: 'btn-primary',
        onClick: () => onNavigate(VMQ_ROUTES.DASHBOARD)
      }, '← Back to Dashboard'),

      h('button', {
        className: 'btn-secondary',
        onClick: () => onNavigate(VMQ_ROUTES.MENU)
      }, 'Main Menu')
    )
  );
}

// ================================
// COMPAT HELPERS (Dashboard + Modules)
// Add to bottom of js/engines/analytics.js
// ================================

import { loadJSON, STORAGE_KEYS } from '../config/storage.js';

/**
 * Detect learning plateau risk from recent practice history.
 * Returns { risk: 'low'|'medium'|'high', score: 0..1, reason }
 */
export function detectPlateau(history = [], opts = {}) {
  const items = Array.isArray(history) ? history.slice(-Math.max(10, opts.window || 14)) : [];
  if (items.length < 6) return { risk: 'low', score: 0, reason: 'insufficient-data' };

  const acc = items.map((s) => Number(s.accuracy ?? 0)).filter((n) => Number.isFinite(n));
  const xp = items.map((s) => Number(s.xpGained ?? 0)).filter((n) => Number.isFinite(n));

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);

  const firstHalf = acc.slice(0, Math.floor(acc.length / 2));
  const secondHalf = acc.slice(Math.floor(acc.length / 2));

  const deltaAcc = avg(secondHalf) - avg(firstHalf);
  const avgXp = avg(xp);

  // score: flat/declining accuracy + low XP gains => higher plateau likelihood
  let score = 0;
  if (deltaAcc < 1) score += 0.45;
  if (deltaAcc < -2) score += 0.25;
  if (avgXp < 15) score += 0.20;
  if (items.length < 10) score -= 0.10;

  score = Math.max(0, Math.min(1, score));

  const risk = score > 0.66 ? 'high' : score > 0.33 ? 'medium' : 'low';
  const reason =
    risk === 'high' ? 'accuracy-flat-and-low-xp' :
    risk === 'medium' ? 'accuracy-slowing' :
    'steady-progress';

  return { risk, score, reason };
}

/**
 * Fingerboard-specific analysis (lightweight + safe).
 * Accepts sessions filtered for fingerboard modules, returns weaknesses/patterns.
 */
export function analyzeFingerboardPerformance(sessions = []) {
  const items = Array.isArray(sessions) ? sessions : [];
  if (!items.length) return { weakStrings: [], weakPositions: [], summary: 'no-data' };

  // These fields are optional; your components can start writing them over time:
  // session.string, session.position, session.intervalType, etc.
  const by = (key) => {
    const map = {};
    for (const s of items) {
      const k = s?.[key];
      if (!k) continue;
      const bucket = (map[k] ||= { total: 0, correct: 0 });
      bucket.total += Number(s.total || 1);
      bucket.correct += Number(s.correct || (s.accuracy != null ? Math.round((s.accuracy / 100) * (s.total || 1)) : 0));
    }
    return Object.entries(map).map(([k, v]) => {
      const acc = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
      return { key: k, accuracy: acc, total: v.total };
    });
  };

  const strings = by('string').sort((a, b) => a.accuracy - b.accuracy);
  const positions = by('position').sort((a, b) => a.accuracy - b.accuracy);

  return {
    weak