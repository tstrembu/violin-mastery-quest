// js/engines/difficultyAdapter.js
// ======================================
// VMQ DIFFICULTY ADAPTER v2.0 (drop-in replacement)
// Real-time difficulty adjustment for 50+ modules
//
// Fixes:
// - Removes duplicate getAdaptiveConfig exports
// - Exposes clear, stable API: getAdaptiveConfig, recordPerformance, getDifficultyConfig
//
// Notes:
// - Keeps all current behaviors (XP-based global level, per-module adaptation,
//   SM-2 influence, recommendations/weakAreas mapping, persistence, reset, stats)
// - Defensive around async imports / missing trackers
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { sessionTracker } from './sessionTracker.js';
import { getStats as sm2Stats } from './spacedRepetition.js';
import { loadXP, getLevel } from './gamification.js';

/**
 * Difficulty Levels (Violin-optimized)
 */
const DIFFICULTY_LEVELS = {
  BEGINNER:     { id: 1, speed: 0.5,  accuracyTarget: 70, notes: 4,  tempo: 60  },
  INTERMEDIATE: { id: 2, speed: 0.75, accuracyTarget: 80, notes: 8,  tempo: 90  },
  ADVANCED:     { id: 3, speed: 1.0,  accuracyTarget: 85, notes: 12, tempo: 120 },
  EXPERT:       { id: 4, speed: 1.25, accuracyTarget: 90, notes: 16, tempo: 144 },
  MASTER:       { id: 5, speed: 1.5,  accuracyTarget: 95, notes: 20, tempo: 180 }
};

/**
 * Module Categories (VMQ 50+ modules)
 */
const MODULE_CATEGORIES = {
  EAR_TRAINING: ['intervalear', 'keytester', 'tempotester', 'arpeggiotester'],
  NOTE_READING: ['flashcards', 'snapshot', 'notelocator'],
  THEORY:       ['intervals', 'keys', 'rhythm', 'scaleslab'],
  TECHNIQUE:    ['bieler', 'bielerlab', 'fingerboard'],
  RHYTHM:       ['rhythmdrills', 'timesigtester']
};

/**
 * Adaptation Triggers
 */
const ADAPTATION_RULES = {
  SPEED_UP:         { accuracy: 90, streak: 5, sessions: 3 }, // Promote
  SLOW_DOWN:        { accuracy: 65, streak: 0, lapses: 2 },   // Demote
  STABILITY_WINDOW: 5,                                        // Reviews needed
  MAX_LEVEL_CHANGE: 1                                         // No jumps
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const safeNum = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const safeObj = (v, fallback = {}) => (v && typeof v === 'object' ? v : fallback);

function levelKeyFromId(levelId) {
  const keys = Object.keys(DIFFICULTY_LEVELS);
  return keys[clamp(levelId, 1, keys.length) - 1];
}

function configFromLevelId(levelId) {
  const key = levelKeyFromId(levelId);
  return DIFFICULTY_LEVELS[key];
}

class DifficultyAdapter {
  constructor() {
    this.performance = new Map(); // moduleId -> performance object
    this.globalLevel = 1;
    this._initPromise = null;
    this.init();
  }

  init() {
    // Ensure init runs once and can be awaited by callers if needed.
    if (!this._initPromise) {
      this._initPromise = (async () => {
        // loadJSON/saveJSON in your storage wrapper are synchronous, but treat as async-safe
        const saved = await loadJSON(STORAGE_KEYS.DIFFICULTY, {});
        this.performance = new Map(Object.entries(safeObj(saved, {})));

        // globalLevel from XP/level system
        const xp = loadXP();
        const lvl = getLevel(xp);
        // getLevel returns an object { level, ... }
        this.globalLevel = clamp(safeNum(lvl?.level, 1), 1, 20);

        console.log(`[Difficulty] Initialized: Global Lv${this.globalLevel}`);
      })();
    }
    return this._initPromise;
  }

  /**
   * Get current difficulty for a module.
   * Combines global level + module performance + SM-2 pressure.
   */
  async getDifficulty(moduleId) {
    await this.init();

    const perf = await this.getPerformance(moduleId);

    // Global level mapped into adapter 1..5 space
    const baseLevel = clamp(Math.min(5, this.globalLevel), 1, 5);

    // Per-module level (defaults to base level)
    const moduleLevel = clamp(safeNum(perf.level, baseLevel), 1, 5);

    // SM-2 pressure level (defaults to 3 if stats missing)
    const sm2Level = await this.getSM2Level(moduleId);

    // Weighted blend
    const blended = (baseLevel * 0.4) + (moduleLevel * 0.4) + (sm2Level * 0.2);
    const finalLevel = clamp(Math.round(blended), 1, 5);

    return {
      level: finalLevel,
      config: configFromLevelId(finalLevel),
      recommendation: this.getRecommendation(moduleId, finalLevel),
      performance: perf
    };
  }

  /**
   * Record performance and adapt module level.
   * `accuracy` is expected 0..100.
   * `speed` is a normalized factor; higher generally means faster/better.
   */
  async recordPerformance(moduleId, accuracy, speed, streak, metadata = {}) {
    await this.init();

    const perf = await this.getPerformance(moduleId);

    const acc = clamp(safeNum(accuracy, 0), 0, 100);
    const spd = safeNum(speed, 0);
    const st = clamp(Math.trunc(safeNum(streak, 0)), 0, 999);

    perf.sessions = (safeNum(perf.sessions, 0) + 1);

    // Running average of total accuracy
    const prevTotalAvg = safeNum(perf.totalAccuracy, 0);
    perf.totalAccuracy = ((prevTotalAvg * (perf.sessions - 1)) + acc) / perf.sessions;

    perf.recentAccuracy = acc;
    perf.speedHistory = Array.isArray(perf.speedHistory)
      ? [...perf.speedHistory.slice(-9), spd]
      : [spd];

    perf.accuracyHistory = Array.isArray(perf.accuracyHistory)
      ? [...perf.accuracyHistory.slice(-9), acc]
      : [acc];

    perf.streak = st;
    perf.lastSession = Date.now();

    // Optional: allow callers to pass lapses in metadata without changing signature
    // (keeps intended functionality if some module tracks "lapses")
    if (metadata && typeof metadata === 'object' && Number.isFinite(metadata.lapses)) {
      perf.lapses = clamp(Math.trunc(metadata.lapses), 0, 999);
    }

    // Adaptive level adjustment
    perf.level = await this.calculateModuleLevel(moduleId, perf);

    this.performance.set(moduleId, perf);
    await this.persist();

    // Track activity (defensive if tracker missing)
    sessionTracker?.trackActivity?.('difficulty', 'adapt', {
      module: moduleId,
      level: perf.level,
      accuracy: acc,
      speed: spd,
      streak: st,
      recommendation: this.getRecommendation(moduleId, perf.level),
      metadata: safeObj(metadata, {})
    });

    return perf.level;
  }

  /**
   * Calculate optimal module level from history.
   * Uses the last 5 accuracy samples by default.
   */
  async calculateModuleLevel(moduleId, perf) {
    const history = Array.isArray(perf.accuracyHistory) ? perf.accuracyHistory : [];

    const currentLevel = clamp(Math.trunc(safeNum(perf.level, 1)), 1, 5);

    // If insufficient history, keep current/base.
    if (history.length < ADAPTATION_RULES.STABILITY_WINDOW) {
      return currentLevel;
    }

    const lastN = history.slice(-ADAPTATION_RULES.STABILITY_WINDOW);
    const recentAvg = lastN.reduce((a, b) => a + safeNum(b, 0), 0) / lastN.length;

    // Promotion criteria
    if (
      recentAvg >= ADAPTATION_RULES.SPEED_UP.accuracy &&
      safeNum(perf.streak, 0) >= ADAPTATION_RULES.SPEED_UP.streak
    ) {
      return clamp(currentLevel + ADAPTATION_RULES.MAX_LEVEL_CHANGE, 1, 5);
    }

    // Demotion criteria
    if (
      recentAvg <= ADAPTATION_RULES.SLOW_DOWN.accuracy ||
      safeNum(perf.lapses, 0) >= ADAPTATION_RULES.SLOW_DOWN.lapses
    ) {
      return clamp(currentLevel - ADAPTATION_RULES.MAX_LEVEL_CHANGE, 1, 5);
    }

    return currentLevel;
  }

  /**
   * SM-2 integration: higher due ratio => struggling => lower difficulty.
   * Falls back gracefully if SM-2 stats aren't available.
   */
  async getSM2Level(moduleId) {
    try {
      const stats = await sm2Stats?.();
      const dueToday = safeNum(stats?.dueToday, 0);
      const total = Math.max(1, safeNum(stats?.total, 0));
      const dueRatio = dueToday / total;

      // dueRatio 0..1 -> subtract up to ~3 levels from 5
      return clamp(5 - Math.round(dueRatio * 3), 1, 5);
    } catch {
      return 3; // neutral fallback
    }
  }

  /**
   * Get performance data for module.
   * Ensures a complete schema exists for downstream code.
   */
  async getPerformance(moduleId) {
    await this.init();

    if (!this.performance.has(moduleId)) {
      const baseLevel = clamp(Math.min(5, this.globalLevel), 1, 5);

      this.performance.set(moduleId, {
        module: moduleId,
        level: baseLevel,
        sessions: 0,
        totalAccuracy: 0,
        recentAccuracy: 0,
        speedHistory: [],
        accuracyHistory: [],
        streak: 0,
        lapses: 0,
        lastSession: null
      });
    }

    return this.performance.get(moduleId);
  }

  /**
   * Global recommendations (used for weakAreas).
   */
  async getRecommendations() {
    await this.init();

    const recs = [];

    for (const [moduleId, perf] of this.performance) {
      // Compute difficulty (also attaches recommendation)
      const diff = await this.getDifficulty(moduleId);

      const recent = safeNum(perf?.recentAccuracy, 0);
      const sessions = safeNum(perf?.sessions, 0);
      const level = clamp(Math.trunc(safeNum(perf?.level, diff?.level || 1)), 1, 5);

      if (recent < 70 && sessions > 3) {
        recs.push({
          module: moduleId,
          action: 'focus',
          reason: `Struggling (${Math.round(recent)}%)`,
          priority: 'high',
          level
        });
      } else if (recent > 90 && level < 5) {
        const nextLevelKey = levelKeyFromId(level + 1);
        recs.push({
          module: moduleId,
          action: 'advance',
          reason: `Ready for ${nextLevelKey} (${DIFFICULTY_LEVELS[nextLevelKey].tempo}BPM)`,
          priority: 'medium',
          level
        });
      }
    }

    // Sort: high first, then medium; stable by module name within tier
    return recs.sort((a, b) => {
      const pa = a.priority === 'high' ? 0 : 1;
      const pb = b.priority === 'high' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.module).localeCompare(String(b.module));
    });
  }

  /**
   * Module category helper.
   */
  getCategory(moduleId) {
    for (const [category, modules] of Object.entries(MODULE_CATEGORIES)) {
      if (modules.includes(moduleId)) return category;
    }
    return 'general';
  }

  /**
   * Coaching recommendation string.
   */
  getRecommendation(moduleId, level) {
    const levelName = levelKeyFromId(level);
    const nextLevel = clamp(level + 1, 1, 5);

    if (level < 3) {
      return `Master ${levelName} before advancing`;
    }
    if (level < 5) {
      const nextLevelName = levelKeyFromId(nextLevel);
      return `Ready for ${nextLevelName} (${DIFFICULTY_LEVELS[nextLevelName].tempo}BPM)`;
    }
    return 'Mastery achieved!';
  }

  /**
   * Persist performance data.
   */
  async persist() {
    const data = Object.fromEntries(this.performance);
    await saveJSON(STORAGE_KEYS.DIFFICULTY, data);
  }

  /**
   * Reset module performance.
   */
  async resetModule(moduleId) {
    await this.init();
    this.performance.delete(moduleId);
    await this.persist();
    sessionTracker?.trackActivity?.('difficulty', 'reset_module', { module: moduleId });
    return true;
  }

  /**
   * Global stats.
   */
  async getGlobalStats() {
    await this.init();
    const modules = Array.from(this.performance.values());

    const avgLevel =
      modules.length > 0
        ? modules.reduce((sum, m) => sum + clamp(safeNum(m.level, 1), 1, 5), 0) / modules.length
        : 1;

    return {
      avgLevel,
      modulesAtMax: modules.filter(m => clamp(safeNum(m.level, 1), 1, 5) === 5).length,
      struggling: modules.filter(m => safeNum(m.recentAccuracy, 0) < 70).length
    };
  }
}

// ======================================
// GLOBAL INSTANCE
// ======================================
const difficultyAdapter = new DifficultyAdapter();

// ======================================
// CLEAR PUBLIC API (no duplicate exports)
// ======================================

/**
 * Router-friendly adapter: getAdaptiveConfig()
 * Returns `weakAreas` in a predictable format.
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
        level: clamp(Math.trunc(safeNum(perf.level, rec.level || 1)), 1, 5)
      };
    })
  };
}

/**
 * Primary API for modules to log a session outcome.
 */
export const recordPerformance = difficultyAdapter.recordPerformance.bind(difficultyAdapter);

/**
 * Convenience: get the full computed difficulty bundle { level, config, recommendation, performance }.
 */
export const getDifficultyConfig = difficultyAdapter.getDifficulty.bind(difficultyAdapter);

/**
 * Back-compat: some code may have imported `getDifficulty`.
 */
export const getDifficulty = getDifficultyConfig;

/**
 * Optional: other helpers that components may rely on.
 */
export const getRecommendations = difficultyAdapter.getRecommendations.bind(difficultyAdapter);
export const getGlobalStats = difficultyAdapter.getGlobalStats.bind(difficultyAdapter);
export const resetModule = difficultyAdapter.resetModule.bind(difficultyAdapter);

// Constants remain exportable for UI/debugging/tests
export { DIFFICULTY_LEVELS, MODULE_CATEGORIES, ADAPTATION_RULES };

// Default export is the singleton instance (unchanged intent)
export default difficultyAdapter;