// js/engines/spacedRepition.js
// ======================================
// VMQ SPACED REPETITION v2.0 - SM-2 Algorithm
// Anki-inspired with violin-specific optimizations
// ======================================

import { saveJSON, loadJSON, STORAGE_KEYS } from '../config/storage.js';
import { getRandom } from '../utils/helpers.js';
import { sessionTracker } from './sessionTracker.js';
import { addXP } from './gamification.js';

/**
 * SM-2 Algorithm Parameters (Optimized for music theory)
 */
const SM2_PARAMS = {
  INIT_REPS: 0,
  INIT_INTERVAL: 1,      // Day 1
  INIT_EFACTOR: 2.5,     // Starting ease factor
  MAX_GRADE: 5,          // Forgot=1 → Perfect=5
  INTERVALS: [1, 6, 16], // Optimized for violin practice
  EF_MULTIPLIERS: [0.2, 0.8, 1.0, 1.3, 1.6], // Grade 1-5 ease adjustment
  MIN_EF: 1.3,           // Minimum ease factor
  MAX_INTERVAL: 365 * 6  // 6 month max (before review)
};

/**
 * Item Types (Violin-optimized)
 */
const ITEM_TYPES = {
  FLASHCARD: 'flashcard',    // Note reading
  INTERVAL: 'interval',      // Ear training
  KEY_SIG: 'key',            // Key signatures  
  RHYTHM: 'rhythm',          // Rhythm patterns
  SCALE: 'scale',            // Scale degrees
  BIELER: 'bieler'           // Technique functions
};

class SpacedRepEngine {
  constructor() {
    this.deck = new Map(); // In-memory cache
    this.init();
  }

  async init() {
    const saved = await loadJSON(STORAGE_KEYS.SPACED_REP, {});
    this.deck = new Map(Object.entries(saved));
    console.log(`[SM-2] Loaded ${this.deck.size} items`);
  }

  /**
   * Create or update spaced repetition item
   */
  async updateItem(itemId, quality, responseTime = 0, metadata = {}) {
    let item = this.deck.get(itemId);
    
    if (!item) {
      // New item
      item = {
        id: itemId,
        reps: 0,
        interval: SM2_PARAMS.INIT_INTERVAL,
        efactor: SM2_PARAMS.INIT_EFACTOR,
        due: Date.now() + SM2_PARAMS.INIT_INTERVAL * 24 * 60 * 60 * 1000,
        lapses: 0,
        firstReview: Date.now(),
        type: metadata.type || ITEM_TYPES.FLASHCARD,
        ...metadata
      };
    }

    // SM-2 Algorithm
    const oldReps = item.reps;
    const oldInterval = item.interval;
    
    if (quality < 3) {
      // Failed (grade 1-2)
      item.reps = 0;
      item.lapses++;
      item.interval = 1;
      // FIX: Decrease EF when quality < 3 (failure) as the item is harder.
      item.efactor = Math.max(SM2_PARAMS.MIN_EF, item.efactor - 0.2); 
    } else {
      // Passed (grade 3-5)
      item.reps++;
      
      if (item.reps === 1) {
        item.interval = 1;
      } else if (item.reps === 2) {
        item.interval = 6;
      } else {
        item.interval = Math.round(
          oldInterval * item.efactor * SM2_PARAMS.EF_MULTIPLIERS[quality - 1]
        );
        item.interval = Math.min(item.interval, SM2_PARAMS.MAX_INTERVAL);
      }
      
      item.efactor = Math.max(
        SM2_PARAMS.MIN_EF,
        item.efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );
    }

    // Schedule next review
    item.due = Date.now() + item.interval * 24 * 60 * 60 * 1000;
    item.lastReview = Date.now();
    item.responseTime = responseTime;
    item.qualityHistory = item.qualityHistory ? 
      [...item.qualityHistory.slice(-9), quality] : [quality];

    this.deck.set(itemId, item);
    await this.persist();
    
    // Track for analytics
    sessionTracker.trackActivity('sm2', 'review', {
      itemId, quality, reps: item.reps, interval: item.interval,
      type: item.type
    });

    // XP reward (scales with difficulty)
    const xp = Math.round(10 + (item.reps * 2) + (quality * 3));
    if (quality >= 4) addXP(xp);

    return {
      success: true,
      item,
      wasNew: oldReps === 0,
      xp
    };
  }

  /**
   * Get due items for review (priority: today → tomorrow → lapsed)
   */
  async getDueItems(type = null, limit = 50) {
    const now = Date.now();
    const dueItems = Array.from(this.deck.values())
      .filter(item => item.due <= now * 1.2) // 20% grace period
      .sort((a, b) => {
        // Priority: lapsed first, then due date, then difficulty
        const lapseA = a.lapses > 0 ? -10000 : 0;
        const lapseB = b.lapses > 0 ? -10000 : 0;
        return lapseA - lapseB || a.due - b.due || a.efactor - b.efactor;
      });

    // Filter by type if specified
    const filtered = type ? dueItems.filter(item => item.type === type) : dueItems;
    
    return filtered.slice(0, limit);
  }

  /**
   * Get stats for dashboard
   */
  async getStats() {
    const allItems = Array.from(this.deck.values());
    const now = Date.now();
    
    const dueToday = allItems.filter(item => 
      item.due <= now + 24 * 60 * 60 * 1000
    );
    
    const mature = allItems.filter(item => item.reps >= 3 && item.interval > 21);
    const lapsed = allItems.filter(item => item.lapses > 0);
    
    return {
      total: allItems.length,
      dueToday: dueToday.length,
      mature: mature.length,
      lapsed: lapsed.length,
      avgEF: allItems.length > 0 ? 
        allItems.reduce((sum, item) => sum + item.efactor, 0) / allItems.length : 0,
      retention: allItems.length > 0 ? 
        allItems.filter(item => item.qualityHistory?.slice(-5).every(q => q >= 3)).length / allItems.length : 0
    };
  }

  /**
   * Add new items in bulk (e.g., full fingerboard)
   */
  async addBulkItems(items) {
    const results = [];
    for (const itemData of items) {
      // Passing quality=0 (forgot) to initialize item with due date
      const result = await this.updateItem(itemData.id, 0, 0, itemData); 
      results.push(result);
    }
    await this.persist();
    return results;
  }

  /**
   * Reset specific item (forgets completely)
   */
  async resetItem(itemId) {
    this.deck.delete(itemId);
    await this.persist();
  }

  /**
   * Persist to storage (debounced)
   */
  async persist() {
    const data = Object.fromEntries(this.deck);
    await saveJSON(STORAGE_KEYS.SPACED_REP, data);
  }

  /**
   * Quick review session (get N due items)
   */
  async getReviewSession(type = null, count = 10) {
    const due = await this.getDueItems(type, count * 2);
    return getRandom(due, count);
  }

  /**
   * Export deck for backup
   */
  async exportDeck() {
    return Object.fromEntries(this.deck);
  }

  /**
   * Import deck (merge strategy)
   */
  async importDeck(deckData) {
    const importedDeck = new Map(Object.entries(deckData));
    for (const [id, item] of importedDeck) {
      const existing = this.deck.get(id);
      if (!existing || item.due < existing.due) {
        this.deck.set(id, item);
      }
    }
    await this.persist();
  }
}

// ======================================
// GLOBAL INSTANCE & EXPORTS
// ======================================

const spacedRep = new SpacedRepEngine();

export const updateItem = spacedRep.updateItem.bind(spacedRep);
export const getDueItems = spacedRep.getDueItems.bind(spacedRep);
export const getStats = spacedRep.getStats.bind(spacedRep);
export const addBulkItems = spacedRep.addBulkItems.bind(spacedRep);
export const resetItem = spacedRep.resetItem.bind(spacedRep);
export const getReviewSession = spacedRep.getReviewSession.bind(spacedRep);
export const exportDeck = spacedRep.exportDeck.bind(spacedRep);
export const importDeck = spacedRep.importDeck.bind(spacedRep);

export { ITEM_TYPES, SM2_PARAMS };

export default spacedRep;

// ======================================
// AUTO-INIT
// ======================================

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log('[SM-2] Violin-optimized spaced repetition ready');
  });
}

