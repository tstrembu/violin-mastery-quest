// ======================================
// VMQ REPERTOIRE PLANS - Structured Practice
// Adaptive plans by skill level + analytics
// ======================================

// Core practice plans by skill level
export const REPERTOIRE_PLANS = {
  beginner: {
    name: '🎵 Beginner Foundation',
    focus: 'Basic technique + note reading',
    duration: 30,
    modules: [
      { module: 'intervals', duration: 5, focus: 'P4, P5, P8' },
      { module: 'keys', duration: 5, focus: 'C, G, F Major' },
      { module: 'rhythm', duration: 5, focus: 'quarter, eighth' },
      { module: 'bieler', duration: 10, focus: 'bow hold, posture' },
      { module: 'dashboard', duration: 5, focus: 'review progress' }
    ]
  },
  
  intermediate: {
    name: '🎻 Intermediate Development',
    focus: 'Key expansion + rhythm precision',
    duration: 45,
    modules: [
      { module: 'intervals', duration: 8, focus: 'm3, M3, m6, M6' },
      { module: 'keys', duration: 8, focus: 'D, A, Bb, Eb Major' },
      { module: 'rhythm', duration: 8, focus: 'dotted, triplets' },
      { module: 'bieler', duration: 12, focus: 'vibrato, bow speed' },
      { module: 'analytics', duration: 9, focus: 'weak spot analysis' }
    ]
  },
  
  advanced: {
    name: '🎼 Advanced Mastery',
    focus: 'Professional technique + artistry',
    duration: 60,
    modules: [
      { module: 'intervals', duration: 10, focus: 'tritone, M7, m7' },
      { module: 'keys', duration: 10, focus: 'B, F#, C#, Ab Major' },
      { module: 'rhythm', duration: 10, focus: 'syncopation, 16ths' },
      { module: 'bieler', duration: 15, focus: 'sound point, spiccato' },
      { module: 'settings', duration: 15, focus: 'technique refinement' }
    ]
  },
  
  daily: {
    name: '📅 Daily Maintenance',
    focus: 'Spaced repetition + weak areas',
    duration: 20,
    modules: [
      { module: 'intervals', duration: 5, focus: 'review' },
      { module: 'rhythm', duration: 5, focus: 'review' },
      { module: 'bieler', duration: 5, focus: 'daily technique' },
      { module: 'dashboard', duration: 5, focus: 'streaks + XP' }
    ]
  }
};

// Generate custom plan based on available time
export function generatePracticePlan(level = 'beginner', availableTime = 30) {
  const basePlan = REPERTOIRE_PLANS[level] || REPERTOIRE_PLANS.beginner;
  const timeRatio = Math.min(2, Math.max(0.5, availableTime / basePlan.duration)); // 50-200%
  
  return {
    ...basePlan,
    generatedAt: new Date().toISOString(),
    availableTime,
    timeRatio: Math.round(timeRatio * 100),
    modules: basePlan.modules.map(mod => ({
      ...mod,
      duration: Math.max(3, Math.round(mod.duration * timeRatio))
    }))
  };
}

// Smart daily plan from user stats (MVP simplified)
export function generateDailyPlan(stats = {}, xp = 0) {
  const levelIndex = xp > 500 ? 2 : xp > 100 ? 1 : 0;
  const level = ['beginner', 'intermediate', 'advanced'][levelIndex];
  
  // Detect weak modules (accuracy < 75%)
  const weakModules = [];
  Object.entries(stats.byModule || {}).forEach(([module, data]) => {
    if (data.total > 5 && (data.correct / data.total) < 0.75) {
      weakModules.push(module);
    }
  });
  
  const plan = {
    date: new Date().toISOString().split('T')[0],
    level,
    weakModules: weakModules.slice(0, 2),
    totalDuration: 25,
    sections: [
      // Weakness focus (double time)
      ...weakModules.slice(0, 2).map(module => ({
        module,
        focus: 'accuracy building',
        duration: 8,
        priority: 'high'
      })),
      
      // Daily Bieler technique
      {
        module: 'bieler',
        focus: level === 'advanced' ? 'advanced' : 'fundamentals',
        duration: 5,
        priority: 'medium'
      },
      
      // Review strongest module
      {
        module: 'intervals',
        focus: 'maintenance',
        duration: 4,
        priority: 'low'
      },
      
      // Progress review
      {
        module: 'dashboard',
        focus: 'streaks + XP',
        duration: 5,
        priority: 'medium'
      }
    ]
  };
  
  return plan;
}

// Get plan recommendation by time available
export function getRecommendedPlan(availableTime) {
  if (availableTime <= 20) return 'daily';
  if (availableTime <= 35) return 'beginner';
  if (availableTime <= 50) return 'intermediate';
  return 'advanced';
}

// Export current user's plan (for PracticePlanner component)
export function getUserPlan(profile, stats, availableTime) {
  const level = profile?.level || 'beginner';
  return generatePracticePlan(level, availableTime);
}
