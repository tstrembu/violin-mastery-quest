/**
 * Dashboard Component
 * Main view showing daily goals, streak, quick module access
 */

import { useState, useEffect } from 'react';
import { 
  updateStreak, 
  getDailyGoalStatus, 
  getXPProgress,
  checkAchievements 
} from '../engines/gamification.js';
import { 
  loadXP, 
  loadLevel, 
  loadStreak,
  loadProfile 
} from '../config/storage.js';
import { getAllModuleStats, getRecommendations } from '../engines/analytics.js';

export default function Dashboard({ navigate, showToast }) {
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [profile, setProfile] = useState('intermediate');
  const [dailyGoal, setDailyGoal] = useState(null);
  const [xpProgress, setXPProgress] = useState(null);
  const [moduleStats, setModuleStats] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    // Load all dashboard data
    loadDashboardData();
  }, []);

  const loadDashboardData = () => {
    // Update streak on dashboard load
    const currentStreak = updateStreak();
    
    // Load user data
    const currentXP = loadXP();
    const currentLevel = loadLevel();
    const currentProfile = loadProfile();
    
    setXP(currentXP);
    setLevel(currentLevel);
    setStreak(currentStreak);
    setProfile(currentProfile);
    
    // Load progress data
    setXPProgress(getXPProgress());
    setDailyGoal(getDailyGoalStatus(currentProfile));
    setModuleStats(getAllModuleStats());
    setRecommendations(getRecommendations());
    
    // Check for achievements
    const newAchievements = checkAchievements('dashboard', { streak: currentStreak });
    if (newAchievements.length > 0) {
      newAchievements.forEach(achievement => {
        showToast(`🏆 Achievement Unlocked: ${achievement.name}!`, 'success');
      });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good morning';
    if (hour < 17) return '☀️ Good afternoon';
    return '🌙 Good evening';
  };

  const handleModuleClick = (moduleId) => {
    navigate(moduleId);
  };

  return React.createElement('div', { className: 'dashboard-container' },
    // Header Section
    React.createElement('div', { className: 'card' },
      React.createElement('h2', null, `${getGreeting()}, Violinist!`),
      
      // Stats Row
      React.createElement('div', { 
        style: { 
          display: 'flex', 
          gap: '20px', 
          marginTop: '16px',
          flexWrap: 'wrap'
        } 
      },
        // Level
        React.createElement('div', { style: { flex: '1', minWidth: '120px' } },
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Level'),
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#007bff' } }, 
            level
          )
        ),
        
        // XP
        React.createElement('div', { style: { flex: '1', minWidth: '120px' } },
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Total XP'),
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' } }, 
            xp
          )
        ),
        
        // Streak
        React.createElement('div', { style: { flex: '1', minWidth: '120px' } },
          React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, 'Streak'),
          React.createElement('div', { className: 'streak-indicator' }, 
            React.createElement('span', null, '🔥'),
            React.createElement('span', null, `${streak} days`)
          )
        )
      ),
      
      // XP Progress Bar
      xpProgress && !xpProgress.maxLevel && React.createElement('div', { style: { marginTop: '20px' } },
        React.createElement('div', { className: 'small', style: { marginBottom: '8px' } },
          `Progress to Level ${level + 1}: ${xpProgress.current}/${xpProgress.needed} XP`
        ),
        React.createElement('div', { className: 'xp-bar' },
          React.createElement('div', { 
            className: 'xp-bar-fill',
            style: { width: `${xpProgress.progress}%` }
          })
        )
      )
    ),
    
    // Daily Goal Card
    dailyGoal && React.createElement('div', { className: 'dashboard-card' },
      React.createElement('h3', null, '🎯 Today\'s Goal'),
      
      React.createElement('div', { className: 'goal-progress' },
        // XP Goal
        React.createElement('div', { className: 'goal-stat' },
          React.createElement('span', { className: 'goal-stat-label' }, 'XP Earned'),
          React.createElement('span', { className: 'goal-stat-value' }, 
            `${dailyGoal.xpEarned}/${dailyGoal.xpTarget}`
          )
        ),
        React.createElement('div', { className: 'progress-wrapper' },
          React.createElement('div', { 
            className: 'progress-bar',
            style: { width: `${dailyGoal.xpProgress}%` }
          })
        ),
        
        // Items Goal
        React.createElement('div', { className: 'goal-stat', style: { marginTop: '12px' } },
          React.createElement('span', { className: 'goal-stat-label' }, 'Items Completed'),
          React.createElement('span', { className: 'goal-stat-value' }, 
            `${dailyGoal.itemsCompleted}/${dailyGoal.itemsTarget}`
          )
        ),
        React.createElement('div', { className: 'progress-wrapper' },
          React.createElement('div', { 
            className: 'progress-bar',
            style: { width: `${dailyGoal.itemsProgress}%` }
          })
        )
      ),
      
      dailyGoal.completed && React.createElement('div', {
        style: {
          marginTop: '16px',
          padding: '12px',
          background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
          fontWeight: 'bold'
        }
      }, '✅ Daily Goal Completed!')
    ),
    
    // Recommendations Card
    recommendations.length > 0 && React.createElement('div', { className: 'dashboard-card' },
      React.createElement('h3', null, '💡 Recommended Practice'),
      React.createElement('div', null,
        recommendations.map(rec => 
          React.createElement('div', {
            key: rec.module,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              marginBottom: '8px',
              background: '#f8f9fa',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            },
            onClick: () => handleModuleClick(rec.module),
            onMouseEnter: (e) => e.currentTarget.style.transform = 'translateX(4px)',
            onMouseLeave: (e) => e.currentTarget.style.transform = 'translateX(0)'
          },
            React.createElement('span', { style: { fontSize: '1.5rem' } }, rec.icon),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontWeight: 'bold' } }, rec.name),
              React.createElement('div', { className: 'small', style: { color: '#6c757d' } }, rec.reason)
            ),
            React.createElement('span', null, '→')
          )
        )
      )
    ),
    
    // Quick Access Modules
    React.createElement('div', { className: 'dashboard-card', style: { gridColumn: '1 / -1' } },
      React.createElement('h3', null, '📚 Training Modules'),
      React.createElement('div', { className: 'module-grid' },
        moduleStats.map(module => 
          React.createElement('div', {
            key: module.id,
            className: 'module-card',
            onClick: () => handleModuleClick(module.id)
          },
            React.createElement('div', { style: { fontSize: '2rem', marginBottom: '8px' } }, module.icon),
            React.createElement('div', { className: 'module-card-title' }, module.name),
            React.createElement('div', { className: 'module-card-accuracy' },
              module.total > 0 
                ? `${module.accuracy}% accuracy (${module.total} attempts)`
                : 'Not started'
            ),
            React.createElement('div', {
              style: {
                marginTop: '8px',
                padding: '4px 8px',
                background: module.status.color,
                color: 'white',
                borderRadius: '4px',
                fontSize: '0.75rem',
                textAlign: 'center'
              }
            }, module.status.label)
          )
        )
      )
    ),
    
    // Bottom Navigation
    React.createElement('div', { 
      style: { 
        gridColumn: '1 / -1',
        display: 'flex',
        gap: '12px',
        marginTop: '20px'
      } 
    },
      React.createElement('button', {
        className: 'btn-primary',
        onClick: () => navigate('practicePlanner')
      }, '📝 Practice Planner'),
      
      React.createElement('button', {
        className: 'btn-secondary',
        onClick: () => navigate('analytics')
      }, '📈 View Analytics'),
      
      React.createElement('button', {
        className: 'btn-secondary',
        onClick: () => navigate('settings')
      }, '⚙️ Settings'),
      
      React.createElement('button', {
        className: 'btn-outline',
        onClick: () => navigate('menu')
      }, 'Main Menu')
    )
  );
}