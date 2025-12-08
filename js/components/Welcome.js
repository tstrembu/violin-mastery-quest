// ======================================
// VMQ ONBOARDING v3.0 - ML-Powered Smart Start
// Seeds: Coach, Analytics, Difficulty, Gamification
// ======================================

const { createElement: h, useState, useEffect } = React;
import { saveJSON, loadJSON, STORAGE_KEYS } from '../config/storage.js';
import { addXP, unlockAchievement } from '../engines/gamification.js';
import { updateSettings } from '../engines/difficultyAdapter.js';

export default function Welcome({ onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: '',
    level: 'beginner', // beginner, intermediate, advanced
    goals: [],
    preferredTime: 'flexible', // morning, afternoon, evening, flexible
    practiceMinutes: 20, // daily target
    repertoire: 'suzuki1' // suzuki1-6, kreutzer, etc.
  });
  const [smartSuggestions, setSmartSuggestions] = useState([]);

  const STEPS = [
    {
      title: 'Welcome to Violin Mastery Quest! 🎻',
      subtitle: 'ML-Powered Practice',
      content: 'Based on Professor Ida Bieler\'s teaching method. Combines spaced repetition, adaptive difficulty, and intelligent coaching.',
      action: 'Begin →',
      icon: '🎻'
    },
    {
      title: 'What should we call you?',
      subtitle: 'Personalization',
      content: 'Your name helps us create a personalized learning journey.',
      input: 'name',
      icon: '👤'
    },
    {
      title: 'Your current level?',
      subtitle: 'Adaptive Difficulty',
      content: 'This calibrates our ML algorithm to your skill level.',
      input: 'level',
      icon: '📊'
    },
    {
      title: 'Practice preferences',
      subtitle: 'Smart Scheduling',
      content: 'Help our AI coach optimize your practice schedule.',
      input: 'preferences',
      icon: '⏰'
    },
    {
      title: 'What are your goals?',
      subtitle: 'Personalized Path',
      content: 'Select focus areas for your training (changeable anytime).',
      input: 'goals',
      icon: '🎯'
    },
    {
      title: 'You\'re all set! 🎉',
      subtitle: 'Ready to Practice',
      content: 'Your personalized training environment is ready.',
      action: 'Start Training →',
      icon: '🚀'
    }
  ];

  // Smart goal recommendations based on level
  useEffect(() => {
    const recommendations = generateGoalRecommendations(profile.level);
    setSmartSuggestions(recommendations);
  }, [profile.level]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = () => {
    // Save comprehensive profile
    const enrichedProfile = {
      ...profile,
      onboardingComplete: true,
      onboardedAt: Date.now(),
      version: '3.0'
    };
    saveJSON(STORAGE_KEYS.PROFILE, enrichedProfile);

    // Seed difficulty adapter
    const difficultyMapping = { beginner: 0.7, intermediate: 1.0, advanced: 1.3 };
    updateSettings?.({ 
      baseDifficulty: difficultyMapping[profile.level],
      adaptiveEnabled: true 
    });

    // Initialize coach with goals
    saveJSON(STORAGE_KEYS.COACHDATA, {
      goals: profile.goals,
      preferredTime: profile.preferredTime,
      targetMinutes: profile.practiceMinutes,
      learningStyle: inferLearningStyle(profile),
      initialized: Date.now()
    });

    // Award onboarding XP + achievement
    addXP(50, 'onboarding_complete', { source: 'system' });
    unlockAchievement('welcome_aboard', { level: profile.level });

    // Create first practice plan in analytics
    const initialStats = {
      total: 0,
      correct: 0,
      byModule: {},
      profile: {
        level: profile.level,
        goals: profile.goals,
        startDate: Date.now()
      }
    };
    saveJSON(STORAGE_KEYS.STATS, initialStats);

    // Log onboarding analytics event
    const analytics = loadJSON(STORAGE_KEYS.ANALYTICS, { events: [] });
    analytics.events = analytics.events || [];
    analytics.events.unshift({
      type: 'onboarding_complete',
      timestamp: Date.now(),
      profile: enrichedProfile
    });
    saveJSON(STORAGE_KEYS.ANALYTICS, analytics);

    onComplete();
  };

  const currentStep = STEPS[step];
  const canProceed = validateStep(currentStep, profile);

  return h('div', { className: 'module-container welcome-screen' },
    h('div', { className: 'card card-welcome', style: { 
      textAlign: 'center',
      maxWidth: '600px',
      margin: '0 auto'
    }},
      // Step icon
      h('div', { className: 'welcome-icon', style: {
        fontSize: 'clamp(3rem, 10vw, 5rem)',
        marginBottom: 'var(--space-lg)',
        animation: 'fadeInScale 0.5s ease-out'
      }}, currentStep.icon),

      // Title & Subtitle
      h('h1', { style: { marginBottom: 'var(--space-xs)' }}, currentStep.title),
      h('p', { 
        className: 'text-muted',
        style: { fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }
      }, currentStep.subtitle),
      
      h('p', { 
        style: { 
          fontSize: 'var(--font-size-lg)', 
          marginBottom: 'var(--space-xl)',
          lineHeight: 1.6
        } 
      }, currentStep.content),

      // Step-specific inputs
      currentStep.input === 'name' && renderNameInput(profile, setProfile),
      currentStep.input === 'level' && renderLevelInput(profile, setProfile),
      currentStep.input === 'preferences' && renderPreferencesInput(profile, setProfile),
      currentStep.input === 'goals' && renderGoalsInput(profile, setProfile, smartSuggestions),

      // Progress indicator
      h('div', { 
        style: { margin: 'var(--space-xl) 0 var(--space-lg)' },
        'aria-label': `Step ${step + 1} of ${STEPS.length}`
      },
        h('div', { className: 'progress-dots', style: {
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-md)'
        }},
          STEPS.map((_, i) =>
            h('div', {
              key: i,
              className: `progress-dot ${i === step ? 'active' : i < step ? 'complete' : ''}`,
              style: {
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: i <= step ? 'var(--primary)' : 'var(--border)',
                transition: 'all 0.3s ease'
              },
              'aria-label': `Step ${i + 1}${i === step ? ' (current)' : i < step ? ' (complete)' : ''}`
            })
          )
        ),
        h('div', { className: 'progress-bar' },
          h('div', { 
            className: 'progress-fill',
            style: { width: `${((step + 1) / STEPS.length) * 100}%` }
          })
        )
      ),

      // Navigation
      h('div', { 
        className: 'welcome-nav',
        style: { display: 'flex', gap: 'var(--space-sm)' } 
      },
        step > 0 && step < STEPS.length - 1 && h('button', {
          className: 'btn btn-outline',
          onClick: () => setStep(step - 1),
          'aria-label': 'Go back'
        }, '← Back'),
        
        h('button', {
          className: 'btn btn-primary btn-lg',
          onClick: handleNext,
          disabled: !canProceed,
          style: { flex: 1 },
          'aria-label': step === STEPS.length - 1 ? 'Complete onboarding' : 'Continue to next step'
        }, 
          step === STEPS.length - 1 ? '🎻 Start Training' : 
          currentStep.action || 'Next →'
        )
      ),

      // Skip option (for returning users)
      step === 0 && h('button', {
        className: 'btn-text',
        onClick: () => {
          saveJSON(STORAGE_KEYS.PROFILE, { 
            name: 'Student', 
            level: 'beginner',
            goals: [],
            onboardingComplete: true,
            skipped: true
          });
          onComplete();
        },
        style: { marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }
      }, 'Skip setup →')
    )
  );
}

// ======================================
// INPUT RENDERERS
// ======================================

function renderNameInput(profile, setProfile) {
  return h('div', { style: { marginBottom: 'var(--space-lg)' }},
    h('input', {
      type: 'text',
      value: profile.name,
      onChange: (e) => setProfile({ ...profile, name: e.target.value }),
      onKeyDown: (e) => {
        if (e.key === 'Enter' && profile.name.trim()) {
          e.preventDefault();
          // Trigger next (would need callback)
        }
      },
      placeholder: 'Enter your name',
      autoFocus: true,
      className: 'input-large',
      'aria-label': 'Your name',
      style: { 
        width: '100%',
        maxWidth: '400px',
        padding: 'var(--space-md)',
        fontSize: 'var(--font-size-lg)',
        textAlign: 'center',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius-md)'
      }
    })
  );
}

function renderLevelInput(profile, setProfile) {
  const levels = [
    { id: 'beginner', label: 'Beginner', desc: 'Suzuki Books 1-2', icon: '🌱' },
    { id: 'intermediate', label: 'Intermediate', desc: 'Suzuki Books 3-5', icon: '🎵' },
    { id: 'advanced', label: 'Advanced', desc: 'Kreutzer, Concerti', icon: '🎻' }
  ];

  return h('div', { 
    className: 'level-selector',
    style: { marginBottom: 'var(--space-lg)' } 
  },
    levels.map(lvl =>
      h('button', {
        key: lvl.id,
        className: `level-card ${profile.level === lvl.id ? 'active' : ''}`,
        onClick: () => setProfile({ ...profile, level: lvl.id }),
        'aria-pressed': profile.level === lvl.id,
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-lg)',
          marginBottom: 'var(--space-md)',
          border: `2px solid ${profile.level === lvl.id ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          background: profile.level === lvl.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }
      },
        h('div', { style: { fontSize: '2rem', marginBottom: 'var(--space-sm)' }}, lvl.icon),
        h('strong', null, lvl.label),
        h('small', { className: 'text-muted' }, lvl.desc)
      )
    )
  );
}

function renderPreferencesInput(profile, setProfile) {
  const times = [
    { id: 'morning', label: 'Morning', icon: '🌅', desc: '6am-12pm' },
    { id: 'afternoon', label: 'Afternoon', icon: '☀️', desc: '12pm-6pm' },
    { id: 'evening', label: 'Evening', icon: '🌙', desc: '6pm-12am' },
    { id: 'flexible', label: 'Flexible', icon: '🔄', desc: 'Any time' }
  ];

  return h('div', { style: { marginBottom: 'var(--space-lg)' }},
    // Practice time
    h('div', { style: { marginBottom: 'var(--space-xl)' }},
      h('h4', { style: { marginBottom: 'var(--space-md)' }}, 'When do you usually practice?'),
      h('div', { className: 'grid-2' },
        times.map(time =>
          h('button', {
            key: time.id,
            className: `btn ${profile.preferredTime === time.id ? 'btn-primary' : 'btn-outline'}`,
            onClick: () => setProfile({ ...profile, preferredTime: time.id }),
            style: { 
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              padding: 'var(--space-md)'
            }
          },
            h('span', null, `${time.icon} ${time.label}`),
            h('small', { className: 'text-muted' }, time.desc)
          )
        )
      )
    ),

    // Daily target
    h('div', null,
      h('h4', { style: { marginBottom: 'var(--space-md)' }}, 
        `Daily practice goal: ${profile.practiceMinutes} min`
      ),
      h('input', {
        type: 'range',
        min: 10,
        max: 60,
        step: 5,
        value: profile.practiceMinutes,
        onChange: (e) => setProfile({ ...profile, practiceMinutes: parseInt(e.target.value) }),
        style: { width: '100%' },
        'aria-label': 'Daily practice minutes'
      }),
      h('div', { 
        style: { 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--ink-light)',
          marginTop: 'var(--space-sm)'
        }
      },
        h('span', null, '10 min'),
        h('span', null, '30 min'),
        h('span', null, '60 min')
      )
    )
  );
}

function renderGoalsInput(profile, setProfile, smartSuggestions) {
  const allGoals = [
    { id: 'intonation', label: 'Improve intonation', icon: '🎯', category: 'technique' },
    { id: 'keys', label: 'Master key signatures', icon: '🔑', category: 'theory' },
    { id: 'rhythm', label: 'Rhythm precision', icon: '🥁', category: 'rhythm' },
    { id: 'bieler', label: 'Bieler technique', icon: '🎻', category: 'technique' },
    { id: 'sightreading', label: 'Sight reading', icon: '📖', category: 'reading' },
    { id: 'eartraining', label: 'Ear training', icon: '👂', category: 'aural' },
    { id: 'scales', label: 'Scales & arpeggios', icon: '🎹', category: 'technique' },
    { id: 'memorization', label: 'Memorization', icon: '🧠', category: 'memory' }
  ];

  return h('div', { style: { marginBottom: 'var(--space-lg)', textAlign: 'left' }},
    // Smart suggestions banner
    smartSuggestions.length > 0 && h('div', { 
      className: 'smart-suggestion-banner',
      style: {
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid var(--primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        marginBottom: 'var(--space-lg)'
      }
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }},
        h('span', null, '💡'),
        h('strong', null, 'Recommended for your level')
      ),
      h('div', { style: { marginTop: 'var(--space-sm)' }},
        smartSuggestions.map(goalId =>
          h('button', {
            key: goalId,
            className: 'btn btn-sm btn-outline',
            style: { marginRight: 'var(--space-sm)', marginBottom: 'var(--space-sm)' },
            onClick: () => {
              if (!profile.goals.includes(goalId)) {
                setProfile({ ...profile, goals: [...profile.goals, goalId] });
              }
            }
          }, 
            `+ ${allGoals.find(g => g.id === goalId)?.label || goalId}`
          )
        )
      )
    ),

    // All goals
    allGoals.map(goal =>
      h('label', {
        key: goal.id,
        className: 'goal-checkbox',
        style: { 
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-sm)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          background: profile.goals.includes(goal.id) ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
        }
      },
        h('input', {
          type: 'checkbox',
          checked: profile.goals.includes(goal.id),
          onChange: (e) => {
            const newGoals = e.target.checked
              ? [...profile.goals, goal.id]
              : profile.goals.filter(g => g !== goal.id);
            setProfile({ ...profile, goals: newGoals });
          },
          style: { marginRight: 'var(--space-md)' }
        }),
        h('span', { style: { fontSize: '1.5rem', marginRight: 'var(--space-md)' }}, goal.icon),
        h('span', null, goal.label)
      )
    )
  );
}

// ======================================
// HELPER FUNCTIONS
// ======================================

function validateStep(step, profile) {
  if (step.input === 'name') return profile.name.trim().length > 0;
  if (step.input === 'level') return profile.level !== '';
  if (step.input === 'goals') return profile.goals.length >= 1;
  return true;
}

function generateGoalRecommendations(level) {
  const recommendations = {
    beginner: ['keys', 'rhythm', 'sightreading'],
    intermediate: ['intonation', 'scales', 'eartraining'],
    advanced: ['bieler', 'memorization', 'eartraining']
  };
  return recommendations[level] || [];
}

function inferLearningStyle(profile) {
  // Simple heuristic based on goals
  const hasAural = profile.goals.includes('eartraining');
  const hasTechnique = profile.goals.includes('bieler') || profile.goals.includes('intonation');
  const hasTheory = profile.goals.includes('keys') || profile.goals.includes('sightreading');

  if (hasAural && hasTechnique) return 'kinesthetic-auditory';
  if (hasTheory && hasAural) return 'visual-auditory';
  if (hasTechnique && hasTheory) return 'kinesthetic-visual';
  return 'balanced';
}
