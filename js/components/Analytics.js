/**
 * Analytics Component
 * Detailed progress tracking and insights
 */

import { 
  getAllModuleStats, 
  getProgressSummary,
  getStrengthsWeaknesses,
  getRecommendations 
} from '../engines/analytics.js';
import { 
  loadXP, 
  loadLevel, 
  loadStreak,
  loadAchievements 
} from '../config/storage.js';
import { ACHIEVEMENTS } from '../config/constants.js';

// Use React from the global UMD bundle
const { useState, useEffect } = React;

export default function Analytics({ navigate }) {
  const [summary, setSummary] = useState(null);
  const [moduleStats, setModuleStats] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = () => {
    setSummary(getProgressSummary());
    setModuleStats(getAllModuleStats());
    setAnalysis(getStrengthsWeaknesses());
    
    // Load achievements
    const unlockedIds = loadAchievements();
    const achievementsList = ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: unlockedIds.includes(ach.id)
    }));
    setAchievements(achievementsList);
  };

  return React.createElement('div', { className: 'container' },
    React.createElement('h2', null, '📈 Progress Analytics'),
    
    // Overall Summary
    summary && React.createElement('div', { className: 'card', style: { marginBottom: '20px' } },
      React.createElement('h3', null, 'Overall Progress'),
      React.createElement('div', { 
        style: { 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '20px',
          marginTop: '16px'
        }
      },
        React.createElement('div', null,
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Questions Answered'),
          React.createElement('div', { style: { fontSize: '1.8rem', fontWeight: 'bold', color: '#007bff' } }, 
            summary.totalQuestions
          )
        ),
        React.createElement('div', null,
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Overall Accuracy'),
          React.createElement('div', { style: { fontSize: '1.8rem', fontWeight: 'bold', color: '#28a745' } }, 
            `${summary.overallAccuracy}%`
          )
        ),
        React.createElement('div', null,
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Modules Mastered'),
          React.createElement('div', { style: { fontSize: '1.8rem', fontWeight: 'bold', color: '#ffc107' } }, 
            `${summary.masteredModules}/${summary.totalModules}`
          )
        ),
        React.createElement('div', null,
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Practice Streak'),
          React.createElement('div', { style: { fontSize: '1.8rem', fontWeight: 'bold' } },
            React.createElement('span', null, '🔥'),
            React.createElement('span', { style: { marginLeft: '8px' } }, loadStreak())
          )
        )
      )
    ),
    
    // Module Breakdown
    React.createElement('div', { className: 'card', style: { marginBottom: '20px' } },
      React.createElement('h3', null, 'Module Breakdown'),
      React.createElement('div', { style: { marginTop: '16px' } },
        moduleStats.map(module => 
          React.createElement('div', {
            key: module.id,
            style: { marginBottom: '20px' }
          },
            React.createElement('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }
            },
              React.createElement('span', null,
                React.createElement('span', { style: { fontSize: '1.2rem', marginRight: '8px' } }, module.icon),
                React.createElement('strong', null, module.name)
              ),
              React.createElement('span', {
                style: {
                  padding: '4px 12px',
                  background: module.status.color,
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.85rem'
                }
              }, module.status.label)
            ),
            React.createElement('div', { className: 'progress-wrapper' },
              React.createElement('div', {
                className: 'progress-bar',
                style: { width: `${module.accuracy}%` }
              })
            ),
            React.createElement('div', { 
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
    analysis && React.createElement('div', { className: 'analytics-grid' },
      // Strengths
      analysis.strengths.length > 0 && React.createElement('div', { className: 'analytics-card' },
        React.createElement('h3', null, '💪 Strengths'),
        analysis.strengths.map(module =>
          React.createElement('div', {
            key: module.id,
            className: 'stat-row'
          },
            React.createElement('span', null,
              React.createElement('span', { style: { marginRight: '8px' } }, module.icon),
              module.name
            ),
            React.createElement('strong', { style: { color: '#28a745' } }, `${module.accuracy}%`)
          )
        )
      ),
      
      // Weaknesses
      analysis.weaknesses.length > 0 && React.createElement('div', { className: 'analytics-card' },
        React.createElement('h3', null, '🎯 Areas to Improve'),
        analysis.weaknesses.map(module =>
          React.createElement('div', {
            key: module.id,
            className: 'stat-row'
          },
            React.createElement('span', null,
              React.createElement('span', { style: { marginRight: '8px' } }, module.icon),
              module.name
            ),
            React.createElement('strong', { style: { color: '#dc3545' } }, `${module.accuracy}%`)
          )
        )
      )
    ),
    
    // Achievements
    React.createElement('div', { className: 'card', style: { marginTop: '20px' } },
      React.createElement('h3', null, '🏆 Achievements'),
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '12px',
          marginTop: '16px'
        }
      },
        achievements.map(ach =>
          React.createElement('div', {
            key: ach.id,
            style: {
              padding: '16px',
              background: ach.unlocked ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa',
              color: ach.unlocked ? 'white' : '#6c757d',
              borderRadius: '8px',
              opacity: ach.unlocked ? 1 : 0.6
            }
          },
            React.createElement('div', { style: { fontSize: '2rem', marginBottom: '8px' } }, 
              ach.unlocked ? '🏆' : '🔒'
            ),
            React.createElement('div', { style: { fontWeight: 'bold', marginBottom: '4px' } }, ach.name),
            React.createElement('div', { style: { fontSize: '0.85rem' } }, ach.description),
            React.createElement('div', { style: { fontSize: '0.85rem', marginTop: '8px' } }, `${ach.xp} XP`)
          )
        )
      )
    ),
    
    // Navigation
    React.createElement('div', {
      style: {
        marginTop: '32px',
        display: 'flex',
        gap: '12px'
      }
    },
      React.createElement('button', {
        className: 'btn-primary',
        onClick: () => navigate('dashboard')
      }, '← Back to Dashboard'),
      
      React.createElement('button', {
        className: 'btn-secondary',
        onClick: () => navigate('menu')
      }, 'Main Menu')
    )
  );
}