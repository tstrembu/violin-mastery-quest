/**
 * Analytics Engine
 * Generates insights and recommendations from user data
 */

import { loadStats } from '../config/storage.js';

/**
 * Get accuracy for a module
 * @param {string} moduleName - Module identifier
 * @returns {number} Accuracy percentage (0-100)
 */
export function getAccuracy(moduleName) {
  const stats = loadStats();
  const moduleStats = stats[moduleName] || { correct: 0, total: 0 };
  
  if (moduleStats.total === 0) return 0;
  
  return Math.round((moduleStats.correct / moduleStats.total) * 100);
}

/**
 * Get all module statistics
 * @returns {array} Array of module stats
 */
export function getAllModuleStats() {
  const stats = loadStats();
  const modules = [
    { id: 'intervals', name: 'Interval Training', icon: '🎵' },
    { id: 'keySignatures', name: 'Key Signatures', icon: '🎹' },
    { id: 'rhythm', name: 'Rhythm', icon: '🥁' },
    { id: 'flashcards', name: 'Note Reading', icon: '📖' },
    { id: 'bieler', name: 'Bieler Vocabulary', icon: '📚' },
    { id: 'fingerboard', name: 'Fingerboard', icon: '🎻' }
  ];
  
  return modules.map(module => {
    const moduleStats = stats[module.id] || { correct: 0, total: 0 };
    const accuracy = moduleStats.total > 0 
      ? Math.round((moduleStats.correct / moduleStats.total) * 100)
      : 0;
    
    return {
      ...module,
      correct: moduleStats.correct,
      total: moduleStats.total,
      accuracy,
      status: getStatusFromAccuracy(accuracy)
    };
  });
}

/**
 * Determine status from accuracy
 */
function getStatusFromAccuracy(accuracy) {
  if (accuracy >= 90) return { label: 'Mastered', color: '#28a745' };
  if (accuracy >= 75) return { label: 'Proficient', color: '#17a2b8' };
  if (accuracy >= 60) return { label: 'Developing', color: '#ffc107' };
  if (accuracy > 0) return { label: 'Needs Practice', color: '#dc3545' };
  return { label: 'Not Started', color: '#6c757d' };
}

/**
 * Generate practice recommendations
 * @returns {array} Recommended modules to practice
 */
export function getRecommendations() {
  const moduleStats = getAllModuleStats();
  const recommendations = [];
  
  // Recommend modules with lowest accuracy (that have been attempted)
  const attemptedModules = moduleStats.filter(m => m.total > 0);
  attemptedModules.sort((a, b) => a.accuracy - b.accuracy);
  
  // Top 3 weakest areas
  const weakest = attemptedModules.slice(0, 3);
  weakest.forEach(module => {
    recommendations.push({
      module: module.id,
      name: module.name,
      icon: module.icon,
      reason: `${module.accuracy}% accuracy - practice needed`,
      priority: 'high'
    });
  });
  
  // Modules not yet attempted
  const notAttempted = moduleStats.filter(m => m.total === 0);
  if (notAttempted.length > 0) {
    recommendations.push({
      module: notAttempted[0].id,
      name: notAttempted[0].name,
      icon: notAttempted[0].icon,
      reason: 'Try this module to discover new skills',
      priority: 'medium'
    });
  }
  
  return recommendations.slice(0, 4); // Max 4 recommendations
}

/**
 * Get overall progress summary
 * @returns {object} Summary statistics
 */
export function getProgressSummary() {
  const moduleStats = getAllModuleStats();
  const attemptedModules = moduleStats.filter(m => m.total > 0);
  
  const totalQuestions = moduleStats.reduce((sum, m) => sum + m.total, 0);
  const totalCorrect = moduleStats.reduce((sum, m) => sum + m.correct, 0);
  const overallAccuracy = totalQuestions > 0 
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;
  
  const masteredModules = attemptedModules.filter(m => m.accuracy >= 90).length;
  const totalModules = moduleStats.length;
  
  return {
    totalQuestions,
    totalCorrect,
    overallAccuracy,
    masteredModules,
    totalModules,
    modulesAttempted: attemptedModules.length
  };
}

/**
 * Get strength and weakness analysis
 * @returns {object} { strengths: [], weaknesses: [] }
 */
export function getStrengthsWeaknesses() {
  const moduleStats = getAllModuleStats();
  const attemptedModules = moduleStats.filter(m => m.total >= 5); // Min 5 attempts
  
  const strengths = attemptedModules
    .filter(m => m.accuracy >= 80)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);
  
  const weaknesses = attemptedModules
    .filter(m => m.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
  
  return { strengths, weaknesses };
}
