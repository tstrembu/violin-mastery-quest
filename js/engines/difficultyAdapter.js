// ======================================
// VMQ DIFFICULTY ADAPTER v2.0 - Production AI
// Real-time difficulty adjustment for 50+ modules
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { sessionTracker } from './sessionTracker.js';
import { getStats as sm2Stats } from './spacedRepetition.js';
import { loadXP, getLevel } from './gamification.js';

/**
 * Difficulty Levels (Violin-optimized)
 */
const DIFFICULTY_LEVELS = {
  // ... (Difficulty Levels remain unchanged)
  BEGINNER: { id: 1, speed: 0.5, accuracyTarget: 70, notes: 4, tempo: 60 },
  INTERMEDIATE: { id: 2, speed: 0.75, accuracyTarget: 80, notes: 8, tempo: 90 },
  ADVANCED: { id: 3, speed: 1.0, accuracyTarget: 85, notes: 12, tempo: 120 },
  EXPERT: { id: 4, speed: 1.25, accuracyTarget: 90, notes: 16, tempo: 144 },
  MASTER: { id: 5, speed: 1.5, accuracyTarget: 95, notes: 20, tempo: 180 }
};

/**
 * Module Categories (VMQ 50+ modules)
 */
const MODULE_CATEGORIES = {
  // ... (Module Categories remain unchanged)
  EAR_TRAINING: ['intervalear', 'keytester', 'tempotester', 'arpeggiotester'],
  NOTE_READING: ['flashcards', 'snapshot', 'notelocator'],
  THEORY: ['intervals', 'keys', 'rhythm', 'scaleslab'],
  TECHNIQUE: ['bieler', 'bielerlab', 'fingerboard'],
  RHYTHM: ['rhythmdrills', 'timesigtester']
};

/**
 * Adaptation Triggers
 */
const ADAPTATION_RULES = {
  // ... (Adaptation Rules remain unchanged)
  SPEED_UP: { accuracy: 90, streak: 5, sessions: 3 },    // Promote
  SLOW_DOWN: { accuracy: 65, streak: 0, lapses: 2 },     // Demote
  STABILITY_WINDOW: 5,                                   // Reviews needed
  MAX_LEVEL_CHANGE: 1                                    // No jumps
};

class DifficultyAdapter {
  constructor() {
    this.performance = new Map();  // module → performance data
    this.globalLevel = 1;
    this.init();
  }

  async init() {
    const saved = await loadJSON(STORAGE_KEYS.DIFFICULTY, {});
    this.performance = new Map(Object.entries(saved));
    
    // Set global level from XP
    const xp = loadXP();
    this.globalLevel = getLevel(xp).level;
    
    console.log(`[Difficulty] Initialized: Global Lv${this.globalLevel}`);
  }

  /**
   * Get current difficulty for module
   */
  async getDifficulty(moduleId) {
    const perf = await this.getPerformance(moduleId);
    const category = this.getCategory(moduleId);
    
    // Combine global level + module performance + SM-2 stats
    const baseLevel = Math.min(5, this.globalLevel);
    const moduleLevel = perf.level || baseLevel;
    const sm2Level = await this.getSM2Level(moduleId);
    
    const finalLevel = Math.max(1, Math.min(5, 
      (baseLevel * 0.4 + moduleLevel * 0.4 + sm2Level * 0.2)
    ));
    
    // Find the closest valid level ID (1-5)
    const levelId = Math.round(finalLevel);
    
    return {
      level: levelId,
      config: DIFFICULTY_LEVELS[Object.keys(DIFFICULTY_LEVELS)[levelId - 1]],
      recommendation: this.getRecommendation(moduleId, levelId),
      performance: perf
    };
  }

  /**
   * Record performance and adapt
   */
  async recordPerformance(moduleId, accuracy, speed, streak, metadata = {}) {
    const perf = await this.getPerformance(moduleId);
    
    perf.sessions = (perf.sessions || 0) + 1;
    perf.totalAccuracy = ((perf.totalAccuracy || 0) * (perf.sessions - 1) + accuracy) / perf.sessions;
    perf.recentAccuracy = accuracy;  // Last session
    
    perf.speedHistory = perf.speedHistory ? 
      [...perf.speedHistory.slice(-9), speed] : [speed];
    perf.accuracyHistory = perf.accuracyHistory ? 
      [...perf.accuracyHistory.slice(-9), accuracy] : [accuracy];
    
    perf.streak = streak;
    perf.lastSession = Date.now();
    
    // Adaptive level adjustment
    perf.level = await this.calculateModuleLevel(moduleId, perf);
    
    this.performance.set(moduleId, perf);
    await this.persist();
    
    // Track globally
    sessionTracker.trackActivity('difficulty', 'adapt', {
      module: moduleId,
      level: perf.level,
      accuracy,
      recommendation: this.getRecommendation(moduleId, perf.level)
    });
    
    return perf.level;
  }

  /**
   * Calculate optimal module level
   */
  async calculateModuleLevel(moduleId, perf) {
    const history = perf.accuracyHistory || [];
    
    if (history.length < ADAPTATION_RULES.STABILITY_WINDOW) {
      return perf.level || 1;
    }
    
    const recentAvg = history.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const currentLevel = perf.level || 1;
    
    // Promotion criteria
    if (recentAvg >= ADAPTATION_RULES.SPEED_UP.accuracy && 
        perf.streak >= ADAPTATION_RULES.SPEED_UP.streak) {
      return Math.min(5, currentLevel + ADAPTATION_RULES.MAX_LEVEL_CHANGE);
    }
    
    // Demotion criteria  
    if (recentAvg <= ADAPTATION_RULES.SLOW_DOWN.accuracy || 
        perf.lapses >= ADAPTATION_RULES.SLOW_DOWN.lapses) {
      return Math.max(1, currentLevel - ADAPTATION_RULES.MAX_LEVEL_CHANGE);
    }
    
    return currentLevel;
  }

  /**
   * SM-2 integration for difficulty
   */
  async getSM2Level(moduleId) {
    const stats = await sm2Stats();
    const dueRatio = stats.dueToday / Math.max(1, stats.total);
    
    // High due ratio = struggling → lower difficulty
    return Math.max(1, 5 - Math.round(dueRatio * 3));
  }

  /**
   * Get performance data for module
   */
  async getPerformance(moduleId) {
    if (!this.performance.has(moduleId)) {
      this.performance.set(moduleId, {
        module: moduleId,
        level: this.globalLevel,
        sessions: 0,
        totalAccuracy: 0,
        recentAccuracy: 0,
        speedHistory: [],
        accuracyHistory: [],
        streak: 0,
        lapses: 0
      });
    }
    return this.performance.get(moduleId);
  }

  /**
   * Global recommendations (used for weakAreas)
   */
  async getRecommendations() {
    const recs = [];
    
    for (const [moduleId, perf] of this.performance) {
      const diff = await this.getDifficulty(moduleId);
      
      if (perf.recentAccuracy < 70 && perf.sessions > 3) {
        recs.push({
          module: moduleId,
          action: 'focus',
          reason: `Struggling (${Math.round(perf.recentAccuracy)}%)`,
          priority: 'high'
        });
      } else if (perf.recentAccuracy > 90 && perf.level < 5) {
        // Find the next level's ID string ('INTERMEDIATE', etc.)
        const nextLevelId = Object.keys(DIFFICULTY_LEVELS)[Math.min(4, perf.level)]; 
        recs.push({
          module: moduleId,
          action: 'advance', 
          reason: `Ready for ${nextLevelId} (${DIFFICULTY_LEVELS[nextLevelId].tempo}BPM)`,
          priority: 'medium'
        });
      }
    }
    
    return recs.sort((a, b) => b.priority === 'high' ? -1 : 1); // high priority first
  }

  /**
   * Module category helper
   */
  getCategory(moduleId) {
    for (const [category, modules] of Object.entries(MODULE_CATEGORIES)) {
      if (modules.includes(moduleId)) return category;
    }
    return 'general';
  }

  /**
   * Generate coaching recommendation
   */
  getRecommendation(moduleId, level) {
    const levelName = Object.keys(DIFFICULTY_LEVELS)[level - 1];
    const nextLevel = Math.min(5, level + 1);
    
    if (level < 3) {
      return `Master ${levelName} before advancing`;
    } else if (level < 5) {
      const nextLevelName = Object.keys(DIFFICULTY_LEVELS)[nextLevel - 1];
      return `Ready for ${nextLevelName} (${DIFFICULTY_LEVELS[nextLevelName].tempo}BPM)`;
    }
    return 'Mastery achieved!';
  }

  /**
   * Persist performance data
   */
  async persist() {
    const data = Object.fromEntries(this.performance);
    await saveJSON(STORAGE_KEYS.DIFFICULTY, data);
  }

  /**
   * Reset module performance
   */
  async resetModule(moduleId) {
    this.performance.delete(moduleId);
    await this.persist();
  }

  /**
   * Global stats
   */
  async getGlobalStats() {
    const modules = Array.from(this.performance.values());
    return {
      avgLevel: modules.length > 0 ? 
        modules.reduce((sum, m) => sum + (m.level || 1), 0) / modules.length : 1,
      modulesAtMax: modules.filter(m => (m.level || 1) === 5).length,
      struggling: modules.filter(m => m.recentAccuracy < 70).length
    };
  }
}

// ======================================
// GLOBAL INSTANCE
// ======================================

const difficultyAdapter = new DifficultyAdapter();

/**
 * 🎯 FIXED: Adapter for router.js dependency: getAdaptiveConfig()
 * Maps the internal recommendations to the router's expected format (weakAreas).
 */
export async function getAdaptiveConfig() {
    const weakAreas = await difficultyAdapter.getRecommendations();
    
    return {
        weakAreas: weakAreas.map(rec => {
            const perf = difficultyAdapter.performance.get(rec.module) || {};
            return {
                module: rec.module,
                reason: rec.reason,
                priority: rec.priority,
                level: perf.level || 1
            }
        })
    };
}


export const getDifficulty = difficultyAdapter.getDifficulty.bind(difficultyAdapter);
export const recordPerformance = difficultyAdapter.recordPerformance.bind(difficultyAdapter);
export const getRecommendations = difficultyAdapter.getRecommendations.bind(difficultyAdapter);
export const getGlobalStats = difficultyAdapter.getGlobalStats.bind(difficultyAdapter);
export const resetModule = difficultyAdapter.resetModule.bind(difficultyAdapter);
// Export the new function
export { getAdaptiveConfig }; 

export { DIFFICULTY_LEVELS, MODULE_CATEGORIES, ADAPTATION_RULES };

export default difficultyAdapter;
