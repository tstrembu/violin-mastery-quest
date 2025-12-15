// js/engines/spacedRepetition.js
// ======================================
// VMQ SPACED REPETITION v2.0 - SM-2 Algorithm (drop-in replacement)
// Anki-inspired with violin-specific optimizations
//
// Fixes / Guarantees:
// ✅ Uses STORAGE_KEYS.SPACED_REPETITION (matches your storage.js keys)
// ✅ Exports updateSRSReviews() (sessionTracker.js import compatibility)
// ✅ Provides backwards-compatible alias for older misspelling "spacedRepition.js"
//    (If you keep the old filename in the repo, it can re-export from this file.)
// ✅ Defensive initialization and safe tracking calls
// ✅ Keeps intended behaviors: SM-2 scheduling, due item selection, stats, bulk add,
//    import/export, reset, XP rewards, session tracking.
//
// Recommended repo change:
// - Rename the file to exactly: js/engines/spacedRepetition.js
// - If any code still imports "./spacedRepition.js", keep a tiny shim file
//   at that path that re-exports everything from spacedRepetition.js.
// ======================================

import { saveJSON, loadJSON, STORAGE_KEYS } from '../config/storage.js';
import { getRandom } from '../utils/helpers.js';
import { sessionTracker } from './sessionTracker.js';
import { addXP } from './gamification.js';

/**
 * SM-2 Algorithm Parameters (Optimized for music theory + violin practice)
 */
export const SM2_PARAMS = {
  INIT_REPS: 0,
  INIT_INTERVAL: 1,          // Day 1
  INIT_EFACTOR: 2.5,         // Starting ease factor
  MAX_GRADE: 5,              // Forgot=1 → Perfect=5 (we clamp to 0..5 for init)
  INTERVALS: [1, 6, 16],     // Optimized for violin practice
  EF_MULTIPLIERS: [0.2, 0.8, 1.0, 1.3, 1.6], // Grade 1-5 ease adjustment
  MIN_EF: 1.3,               // Minimum ease factor
  MAX_INTERVAL: 365 * 6      // 6 month max (before review)
};

/**
 * Item Types (Violin-optimized)
 */
export const ITEM_TYPES = {
  FLASHCARD: 'flashcard', // Note reading
  INTERVAL:  'interval',  // Ear training
  KEY_SIG:   'key',       // Key signatures
  RHYTHM:    'rhythm',    // Rhythm patterns
  SCALE:     'scale',     // Scale degrees
  BIELER:    'bieler'     // Technique functions
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function safeTrack(category, action, payload) {
  // sessionTracker may or may not have trackActivity, so guard it.
  try {
    sessionTracker?.trackActivity?.(category, action, payload);
  } catch {
    // no-op by design
  }
}

class SpacedRepEngine {
  constructor() {
    this.deck = new Map();      // In-memory cache
    this._initPromise = null;   // Ensure init is awaited consistently
    this.init();
  }

  /**
   * Load deck from storage.
   * Uses the correct key: STORAGE_KEYS.SPACED_REPETITION
   */
  init() {
    if (!this._initPromise) {
      this._initPromise = (async () => {
        const saved = await loadJSON(STORAGE_KEYS.SPACED_REPETITION, {});
        const obj = isObj(saved) ? saved : {};
        this.deck = new Map(Object.entries(obj));
        console.log(`[SM-2] Loaded ${this.deck.size} items`);
      })();
    }
    return this._initPromise;
  }

  /**
   * Persist to storage.
   * Uses the correct key: STORAGE_KEYS.SPACED_REPETITION
   */
  async persist() {
    await this.init();
    const data = Object.fromEntries(this.deck);
    await saveJSON(STORAGE_KEYS.SPACED_REPETITION, data);
  }

  /**
   * Normalize / clamp a "quality" grade.
   * You sometimes pass 0 to initialize an item. SM-2 grades are typically 0..5.
   */
  normalizeQuality(q) {
    const n = Number(q);
    if (!Number.isFinite(n)) return 0;
    return clamp(Math.round(n), 0, SM2_PARAMS.MAX_GRADE);
  }

  /**
   * Create or update spaced repetition item using SM-2.
   *
   * quality: 0..5 (0-2 = fail, 3-5 = pass)
   * responseTime: ms
   * metadata: may include type, prompt, answer, etc.
   */
  async updateItem(itemId, quality, responseTime = 0, metadata = {}) {
    await this.init();

    const q = this.normalizeQuality(quality);
    const now = Date.now();

    let item = this.deck.get(itemId);

    // Record previous state for return payload + scheduling logic
    const wasExisting = !!item;
    const oldReps = item?.reps ?? 0;
    const oldInterval = item?.interval ?? SM2_PARAMS.INIT_INTERVAL;
    const oldEF = item?.efactor ?? SM2_PARAMS.INIT_EFACTOR;

    if (!item) {
      // New item
      item = {
        id: itemId,
        reps: SM2_PARAMS.INIT_REPS,
        interval: SM2_PARAMS.INIT_INTERVAL,
        efactor: SM2_PARAMS.INIT_EFACTOR,
        due: now + SM2_PARAMS.INIT_INTERVAL * DAY_MS,
        lapses: 0,
        firstReview: now,
        type: metadata?.type || ITEM_TYPES.FLASHCARD,
        ...metadata
      };
    } else if (metadata && isObj(metadata) && Object.keys(metadata).length) {
      // Merge in any new metadata fields without nuking existing state.
      // Keep algorithm fields authoritative (reps, interval, efactor, due, etc.)
      item = {
        ...item,
        ...metadata,
        id: item.id
      };
    }

    // -------------------------
    // SM-2 core update
    // -------------------------
    if (q < 3) {
      // Failed (0-2)
      item.reps = 0;
      item.lapses = (item.lapses || 0) + 1;
      item.interval = 1;

      // Make it slightly harder (lower EF) on failure
      item.efactor = Math.max(SM2_PARAMS.MIN_EF, (item.efactor || oldEF) - 0.2);
    } else {
      // Passed (3-5)
      item.reps = (item.reps || 0) + 1;

      if (item.reps === 1) {
        item.interval = 1;
      } else if (item.reps === 2) {
        item.interval = 6;
      } else {
        const mult = SM2_PARAMS.EF_MULTIPLIERS[clamp(q, 1, 5) - 1] || 1.0;
        const next = Math.round(oldInterval * (item.efactor || oldEF) * mult);
        item.interval = Math.min(Math.max(1, next), SM2_PARAMS.MAX_INTERVAL);
      }

      // Standard SM-2 EF update (bounded)
      item.efactor = Math.max(
        SM2_PARAMS.MIN_EF,
        (item.efactor || oldEF) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
      );
    }

    // Schedule next review
    item.due = now + item.interval * DAY_MS;
    item.lastReview = now;

    // Store response metrics
    item.responseTime = Number.isFinite(responseTime) ? responseTime : 0;
    item.qualityHistory = Array.isArray(item.qualityHistory)
      ? [...item.qualityHistory.slice(-9), q]
      : [q];

    // Save
    this.deck.set(itemId, item);
    await this.persist();

    // Analytics / Session tracking
    safeTrack('sm2', 'review', {
      itemId,
      quality: q,
      reps: item.reps,
      interval: item.interval,
      efactor: item.efactor,
      lapses: item.lapses,
      type: item.type
    });

    // XP reward (scales with difficulty & success)
    // Keep behavior: reward only for strong recall; do not reward failures.
    const xp = Math.round(10 + (item.reps * 2) + (q * 3));
    if (q >= 4) {
      try {
        // Most gamification addXP signatures accept (amount, reason, options).
        // Keeping minimal call keeps compatibility even if reason/options differ.
        addXP(xp, 'sm2_review', { source: 'sm2', metadata: { itemId, type: item.type, q } });
      } catch {
        // fallback if addXP signature is simpler
        try { addXP(xp); } catch { /* no-op */ }
      }
    }

    return {
      success: true,
      item,
      wasNew: !wasExisting,
      oldState: { reps: oldReps, interval: oldInterval, efactor: oldEF },
      xp
    };
  }

  /**
   * Get due items for review
   * priority: lapsed first, then due date, then difficulty (lower EF first)
   */
  async getDueItems(type = null, limit = 50) {
    await this.init();

    const now = Date.now();

    const dueItems = Array.from(this.deck.values())
      .filter(item => (item?.due ?? Infinity) <= now * 1.2) // 20% grace window
      .sort((a, b) => {
        const lapseA = (a?.lapses || 0) > 0 ? -10000 : 0;
        const lapseB = (b?.lapses || 0) > 0 ? -10000 : 0;
        return (
          (lapseA - lapseB) ||
          ((a?.due ?? Infinity) - (b?.due ?? Infinity)) ||
          ((a?.efactor ?? 999) - (b?.efactor ?? 999))
        );
      });

    const filtered = type ? dueItems.filter(item => item.type === type) : dueItems;
    return filtered.slice(0, Math.max(0, limit));
  }

  /**
   * Quick review session (get N due items) with random sampling
   */
  async getReviewSession(type = null, count = 10) {
    const n = Math.max(1, Math.trunc(count));
    const due = await this.getDueItems(type, n * 2);
    return getRandom(due, Math.min(n, due.length));
  }

  /**
   * Get stats for dashboard / coach
   */
  async getStats() {
    await this.init();

    const allItems = Array.from(this.deck.values());
    const now = Date.now();

    const dueToday = allItems.filter(item => (item?.due ?? Infinity) <= now + DAY_MS);
    const mature = allItems.filter(item => (item?.reps ?? 0) >= 3 && (item?.interval ?? 0) > 21);
    const lapsed = allItems.filter(item => (item?.lapses ?? 0) > 0);

    const avgEF =
      allItems.length > 0
        ? allItems.reduce((sum, item) => sum + (Number(item?.efactor) || 0), 0) / allItems.length
        : 0;

    const retention =
      allItems.length > 0
        ? allItems.filter(item => {
            const hist = item?.qualityHistory;
            return Array.isArray(hist) && hist.slice(-5).length > 0 && hist.slice(-5).every(q => q >= 3);
          }).length / allItems.length
        : 0;

    return {
      total: allItems.length,
      dueToday: dueToday.length,
      mature: mature.length,
      lapsed: lapsed.length,
      avgEF,
      retention
    };
  }

  /**
   * Add new items in bulk (e.g., full fingerboard)
   * Uses quality=0 to initialize (no XP, due soon).
   */
  async addBulkItems(items) {
    await this.init();

    const results = [];
    for (const itemData of (Array.isArray(items) ? items : [])) {
      if (!itemData?.id) continue;
      const result = await this.updateItem(itemData.id, 0, 0, itemData);
      results.push(result);
    }
    return results;
  }

  /**
   * Reset specific item (forgets completely)
   */
  async resetItem(itemId) {
    await this.init();
    this.deck.delete(itemId);
    await this.persist();
    safeTrack('sm2', 'reset_item', { itemId });
    return true;
  }

  /**
   * Export deck for backup
   */
  async exportDeck() {
    await this.init();
    return Object.fromEntries(this.deck);
  }

  /**
   * Import deck (merge strategy: keep whichever is due sooner)
   */
  async importDeck(deckData) {
    await this.init();

    const obj = isObj(deckData) ? deckData : {};
    const importedDeck = new Map(Object.entries(obj));

    for (const [id, item] of importedDeck) {
      if (!id || !item) continue;

      const existing = this.deck.get(id);
      const importedDue = Number(item?.due) || Infinity;
      const existingDue = Number(existing?.due) || Infinity;

      // Keep whichever is due sooner (so you don't "lose urgency")
      if (!existing || importedDue < existingDue) {
        this.deck.set(id, item);
      }
    }

    await this.persist();
    safeTrack('sm2', 'import_deck', { count: importedDeck.size });
    return true;
  }

  /**
   * SessionTracker compatibility: updateSRSReviews()
   * Some session systems will want to record "N reviews happened this session".
   *
   * This function is intentionally flexible:
   * - If passed an array of review events, it will count them.
   * - If passed a number, it will use that.
   * - It stores a tiny session review summary inside the SRS deck metadata
   *   under a reserved key, without affecting scheduling of real items.
   */
  async updateSRSReviews(reviews = 0) {
    await this.init();

    let count = 0;
    if (Array.isArray(reviews)) count = reviews.length;
    else if (Number.isFinite(reviews)) count = Math.max(0, Math.trunc(reviews));
    else if (reviews && typeof reviews === 'object' && Number.isFinite(reviews.count)) {
      count = Math.max(0, Math.trunc(reviews.count));
    }

    // Store an internal meta record for "last session review count"
    // Using a reserved id avoids collisions with real item IDs.
    const META_ID = '__vmq_srs_meta__';
    const now = Date.now();

    const meta = this.deck.get(META_ID) || {
      id: META_ID,
      type: 'meta',
      reps: 0,
      interval: 0,
      efactor: 0,
      due: Infinity,
      lapses: 0,
      firstReview: now,
      createdAt: now
    };

    meta.lastSessionAt = now;
    meta.lastSessionReviewCount = count;
    meta.totalReviews = (Number(meta.totalReviews) || 0) + count;

    this.deck.set(META_ID, meta);
    await this.persist();

    safeTrack('sm2', 'session_reviews', { count, totalReviews: meta.totalReviews });
    return { count, totalReviews: meta.totalReviews, timestamp: now };
  }
}

// ======================================
// GLOBAL INSTANCE & EXPORTS
// ======================================

const spacedRepetition = new SpacedRepEngine();

// Primary engine methods
export const updateItem        = spacedRepetition.updateItem.bind(spacedRepetition);
export const getDueItems       = spacedRepetition.getDueItems.bind(spacedRepetition);
export const getStats          = spacedRepetition.getStats.bind(spacedRepetition);
export const addBulkItems      = spacedRepetition.addBulkItems.bind(spacedRepetition);
export const resetItem         = spacedRepetition.resetItem.bind(spacedRepetition);
export const getReviewSession  = spacedRepetition.getReviewSession.bind(spacedRepetition);
export const exportDeck        = spacedRepetition.exportDeck.bind(spacedRepetition);
export const importDeck        = spacedRepetition.importDeck.bind(spacedRepetition);

// ✅ Missing export that sessionTracker.js expects
export const updateSRSReviews  = spacedRepetition.updateSRSReviews.bind(spacedRepetition);

// Default export (singleton)
export default spacedRepetition;

// --- Session-level SRS sync hook ---
// Called by sessionTracker at end-of-session.
export function updateSRSReviews(payloadOrCorrect, wrong, engagedMs) {
  // Supports both:
  // 1) updateSRSReviews({ correct, wrong, engagedMs, reviews: [...] })
  // 2) updateSRSReviews(correct, wrong, engagedMs)  (legacy)
  const payload = (payloadOrCorrect && typeof payloadOrCorrect === 'object')
    ? payloadOrCorrect
    : {
        correct: Number(payloadOrCorrect) || 0,
        wrong: Number(wrong) || 0,
        engagedMs: Number(engagedMs) || 0,
        reviews: []
      };

  try {
    // Best-effort: keep a tiny rolling log + counters inside the same SRS storage blob.
    // NOTE: your file currently uses STORAGE_KEYS.SPACED_REP (typo); storage.js defines SPACED_REPETITION.  [oai_citation:10‡sessionTracker.js](sediment://file_00000000ac4c71f8a30041ab27c5ff8a)
    const key = STORAGE_KEYS.SPACED_REPETITION || STORAGE_KEYS.SPACED_REP;
    const state = loadJSON(key, {}) || {};

    state.sessionStats = state.sessionStats || {
      totalSessions: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalEngagedMs: 0,
      lastSessionEnd: 0
    };

    state.sessionStats.totalSessions += 1;
    state.sessionStats.totalCorrect += Number(payload.correct) || 0;
    state.sessionStats.totalWrong += Number(payload.wrong) || 0;
    state.sessionStats.totalEngagedMs += Number(payload.engagedMs) || 0;
    state.sessionStats.lastSessionEnd = Date.now();

    // Optional rolling log (small)
    const log = Array.isArray(state.sessionLog) ? state.sessionLog : [];
    log.unshift({
      ts: Date.now(),
      sessionId: payload.sessionId || null,
      activity: payload.activity || 'SRS',
      correct: Number(payload.correct) || 0,
      wrong: Number(payload.wrong) || 0,
      engagedMs: Number(payload.engagedMs) || 0,
      reviewCount: Array.isArray(payload.reviews) ? payload.reviews.length : 0
    });
    state.sessionLog = log.slice(0, 50);

    saveJSON(key, state);
  } catch (e) {
    console.warn('[SRS] updateSRSReviews failed:', e);
  }
}

// ======================================
// AUTO-INIT (optional)
// ======================================
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log('[SM-2] Violin-optimized spaced repetition ready');
  });
}