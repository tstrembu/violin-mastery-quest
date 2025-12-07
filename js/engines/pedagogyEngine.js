// ======================================
// PEDAGOGY ENGINE - Music Theory → Real Repertoire
// Progression ladders + passage analysis
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { INTERVALS, BIELER_TAXONOMY } from '../config/constants.js';

// ======================================
// PROGRESSION SYSTEM
// ======================================

/**
 * User's current level in any module
 */
export function getCurrentProgressionLevel(module) {
  const stats = loadJSON(STORAGE_KEYS.STATS, { byModule: {} });
  const moduleStats = stats.byModule[module] || { total: 0, correct: 0, avgResponseTime: 0 };
  
  const accuracy = moduleStats.total > 0 ? Math.round((moduleStats.correct / moduleStats.total) * 100) : 0;
  const avgTime = moduleStats.avgResponseTime || 5000;
  
  // Progression ladders by module
  const ladders = getProgressionLadders(module);
  
  // Find highest achieved level
  for (let i = ladders.length - 1; i >= 0; i--) {
    const level = ladders[i];
    if (accuracy >= level.reqAccuracy && avgTime <= level.reqTime) {
      return {
        current: level.name,
        progress: 100,
        next: ladders[i-1] ? ladders[i-1].name : 'Mastered!',
        repertoire: level.repertoire,
        unlocked: true
      };
    }
  }
  
  // Find current level in progress
  for (let i = 0; i < ladders.length; i++) {
    const level = ladders[i];
    if (accuracy < level.reqAccuracy || avgTime > level.reqTime) {
      const accProgress = Math.min(100, (accuracy / level.reqAccuracy) * 100);
      const timeProgress = Math.min(100, (level.reqTime / avgTime) * 100);
      const overall = Math.round((accProgress + timeProgress) / 2);
      
      return {
        current: level.name,
        progress: overall,
        next: ladders[i+1]?.name || 'Mastered!',
        repertoire: level.repertoire,
        gaps: {
          accuracyGap: level.reqAccuracy - accuracy,
          timeGap: avgTime - level.reqTime
        }
      };
    }
  }
  
  return { current: 'Beginner', progress: 0, next: ladders[0]?.name || 'Intervals', repertoire: [] };
}

/**
 * Module progression ladders
 */
function getProgressionLadders(module) {
  const ladders = {
    intervals: [
      { name: 'Perfect Intervals', reqAccuracy: 90, reqTime: 2000, repertoire: ['Bach A-minor Concerto'] },
      { name: 'Major/Minor', reqAccuracy: 85, reqTime: 2500, repertoire: ['Suzuki Bk1'] },
      { name: 'Compound', reqAccuracy: 80, reqTime: 3000, repertoire: ['Bruch Violin Concerto'] }
    ],
    keys: [
      { name: 'Sharps (C,G,D)', reqAccuracy: 95, reqTime: 1500, repertoire: ['Kreutzer Etudes'] },
      { name: 'Flats (F,Bb)', reqAccuracy: 90, reqTime: 2000, repertoire: ['Viotti'] },
      { name: 'Exotic (F#,Cb)', reqAccuracy: 85, reqTime: 2500, repertoire: ['Paganini Caprices'] }
    ],
    rhythm: [
      { name: 'Simple (4/4)', reqAccuracy: 90, reqTime: 2000, repertoire: ['Minuet in G'] },
      { name: 'Compound (6/8)', reqAccuracy: 85, reqTime: 2500, repertoire: ['Gavottes'] },
      { name: 'Syncopation', reqAccuracy: 80, reqTime: 3000, repertoire: ['Wieniawski'] }
    ],
    bieler: [
      { name: 'Left Hand Basics', reqAccuracy: 90, reqTime: 3000, repertoire: ['Suzuki Bk1'] },
      { name: 'Bow Functions', reqAccuracy: 85, reqTime: 3500, repertoire: ['Kreutzer'] },
      { name: 'Advanced', reqAccuracy: 80, reqTime: 4000, repertoire: ['Ysaye Sonatas'] }
    ]
  };
  return ladders[module] || ladders.intervals;
}

// ======================================
// REPERTOIRE MAPPING
// ======================================

/**
 * Real music examples for intervals
 */
export function getRepertoireForInterval(intervalId) {
  const interval = INTERVALS.find(i => i.id === intervalId);
  if (!interval) return null;
  
  return {
    interval: interval.name,
    semitones: interval.semitones,
    examples: interval.repertoire || [],
    etudes: interval.etudes || [],
    suzuki: interval.suzukiLevel || 'N/A',
    bielerNote: interval.bielerNote || 'Core interval for hand frame'
  };
}

// ======================================
// PASSAGE ANALYSIS
// ======================================

/**
 * Analyze sheet music passage → recommended drills
 */
export function analyzePassage(passageText = '') {
  const analysis = {
    intervals: [],
    techniques: [],
    drills: [],
    difficulty: 'beginner'
  };
  
  const text = passageText.toLowerCase();
  
  // Interval detection
  INTERVALS.forEach(int => {
    if (text.includes(int.name.toLowerCase()) || text.includes(int.abbr)) {
      analysis.intervals.push({
        name: int.name,
        drill: 'intervals',
        module: `#intervals?focus=${int.id}`,
        why: 'Found in melodic lines'
      });
    }
  });
  
  // Technique detection
  Object.entries(BIELER_TAXONOMY.leftHand || {}).forEach(([key, func]) => {
    if (text.includes(func.name.toLowerCase())) {
      analysis.techniques.push({
        name: func.name,
        drill: 'bieler',
        module: '#bieler',
        exercises: func.exercises.slice(0, 2)
      });
    }
  });
  
  // Pattern challenges
  if (/shift|position|third|thirds/i.test(text)) {
    analysis.drills.push({
      module: 'keys',
      reason: 'Position changes require key familiarity',
      route: '#keys'
    });
  }
  
  if (/arpeggio|broken|chord/i.test(text)) {
    analysis.drills.push({
      module: 'intervals',
      reason: 'Arpeggios = stacked intervals (P5, M3)',
      route: '#intervals?focus=P5,M3'
    });
  }
  
  if (/staccato|spiccato|martelé/i.test(text)) {
    analysis.drills.push({
      module: 'bieler',
      reason: 'Bow articulation vocabulary',
      route: '#bieler?focus=bow_stroke'
    });
  }
  
  // Difficulty estimation
  const challengeCount = analysis.intervals.length + analysis.drills.length;
  analysis.difficulty = challengeCount > 4 ? 'advanced' : challengeCount > 2 ? 'intermediate' : 'beginner';
  
  return analysis;
}

// ======================================
// REPERTOIRE WORKSHOP
// ======================================

/**
 * Drill sequence for specific piece challenge
 */
export function generateRepertoireWorkshop(piece, measure, challenge) {
  const workshops = {
    intonation: [
      { module: 'intervals', duration: 5, goal: 'Perfect intervals in melody' },
      { module: 'keys', duration: 3, goal: 'Key context awareness' }
    ],
    rhythm: [
      { module: 'rhythm', duration: 7, goal: 'Pattern breakdown' },
      { module: 'intervals', duration: 3, goal: 'Rhythmic displacement' }
    ],
    bow: [
      { module: 'bieler', duration: 8, goal: 'Bow function matching' },
      { module: 'rhythm', duration: 4, goal: 'Bow-rhythm coordination' }
    ],
    shifts: [
      { module: 'keys', duration: 6, goal: 'New position hand frame' },
      { module: 'bieler', duration: 4, goal: 'Second Trained Function' }
    ]
  };
  
  const sequence = workshops[challenge.toLowerCase()] || workshops.bow;
  return {
    piece,
    measure,
    challenge,
    prepTime: sequence.reduce((sum, s) => sum + s.duration, 0),
    drills: sequence.map(d => ({
      ...d,
      route: `#${d.module}`
    }))
  };
}

// ======================================
// ROADMAP & PROGRESS
// ======================================

/**
 * Visual progress roadmap for module
 */
export function getProgressRoadmap(module) {
  const current = getCurrentProgressionLevel(module);
  const ladders = getProgressionLadders(module);
  
  return {
    currentLevel: current.current,
    progressPercent: current.progress,
    roadmap: ladders.map((level, i) => ({
      name: level.name,
      complete: i < ladders.findIndex(l => l.name === current.current),
      current: level.name === current.current,
      req: `${level.reqAccuracy}% @ ${level.reqTime}ms`,
      repertoire: level.repertoire.slice(0, 2).join(', ')
    }))
  };
}

// ======================================
// PROGRESS TRACKING
// ======================================

/**
 * Log repertoire milestone
 */
export function logRepertoireMilestone(piece, measure, module) {
  const milestones = loadJSON(STORAGE_KEYS.MILESTONES, []);
  milestones.push({
    piece,
    measure,
    module,
    date: new Date().toISOString(),
    level: getCurrentProgressionLevel(module).current
  });
  saveJSON(STORAGE_KEYS.MILESTONES, milestones.slice(-50)); // Last 50
  return milestones;
}

// ======================================
// QUICK EXPORTS
// ======================================

export function getQuickRepertoire(module) {
  const ladders = getProgressionLadders(module);
  return ladders[0]?.repertoire || [];
}