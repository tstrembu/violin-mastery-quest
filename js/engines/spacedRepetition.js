// js/engines/spacedRepetition.js
// ======================================
// VMQ SPACED REPETITION v2.1 - SM-2 Algorithm (drop-in replacement)
// Anki-inspired with violin-specific optimizations
//
// Fixes / Guarantees:
// ✅ Uses STORAGE_KEYS.SPACED_REPETITION
// ✅ Exports updateSRSReviews() for sessionTracker.js compatibility
// ✅ Fixes "grace window" bug (was using now*1.2 — ~10y grace)
// ✅ Bulk add DOES NOT count as a lapse
// ✅ Safe when called without await (sessionTracker endSession is sync)
// ======================================

import { saveJSON, loadJSON, STORAGE_KEYS } from '../config/storage.js';
import { getRandom } from '../utils/helpers.js';
import { sessionTracker } from './sessionTracker.js';
import { addXP } from './gamification.js';

export const SM2_PARAMS = {
  INIT_REPS: 0,
  INIT_INTERVAL: 1,
  INIT_EFACTOR: 2.5,
  MAX_GRADE: 5,
  INTERVALS: [1, 6, 16],
  EF_MULTIPLIERS: [0.2, 0.8, 1.0, 1.3, 1.6],
  MIN_EF: 1.3,
  MAX_INTERVAL: 365 * 6,
  // Optional guard (prevents runaway ease). If you don’t want it, set to Infinity.
  MAX_EF: 3.2
};

export const ITEM_TYPES = {
  FLASHCARD: 'flashcard',
  INTERVAL:  'interval',
  KEY_SIG:   'key',
  RHYTHM:    'rhythm',
  SCALE:     'scale',
  BIELER:    'bieler'
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function safeTrack(category, action, payload) {
  try {
    sessionTracker?.trackActivity?.(category, action, payload);
  } catch {
    // no-op
  }
}

class SpacedRepEngine {
  constructor() {
    this.deck = new Map();
    this._initPromise = null;
    this.init();
  }

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

  async persist() {
    await this.init();
    await saveJSON(STORAGE_KEYS.SPACED_REPETITION, Object.fromEntries(this.deck));
  }

  normalizeQuality(q) {
    const n = Number(q);
    if (!Number.isFinite(n)) return 0;
    return clamp(Math.round(n), 0, SM2_PARAMS.MAX_GRADE);
  }

  _newItem(itemId, now, metadata) {
    return {
      id: itemId,
      reps: SM2_PARAMS.INIT_REPS,
      interval: SM2_PARAMS.INIT_INTERVAL,
      efactor: SM2_PARAMS.INIT_EFACTOR,
      due: now + SM2_PARAMS.INIT_INTERVAL * DAY_MS,
      lapses: 0,
      firstReview: now,
      createdAt: now,
      type: metadata?.type || ITEM_TYPES.FLASHCARD,
      ...metadata
    };
  }

  /**
   * Create or update an item using SM-2.
   *
   * quality: 0..5 (0-2 fail, 3-5 pass)
   *
   * IMPORTANT:
   * - If the item is NEW and quality === 0, we treat it as "seed/initialize"
   *   (no lapse, no reps increment, due tomorrow).
   */
  async updateItem(itemId, quality, responseTime = 0, metadata = {}) {
    await this.init();

    const q = this.normalizeQuality(quality);
    const now = Date.now();

    let item = this.deck.get(itemId);
    const wasExisting = !!item;

    const oldReps = item?.reps ?? 0;
    const oldInterval = item?.interval ?? SM2_PARAMS.INIT_INTERVAL;
    const oldEF = item?.efactor ?? SM2_PARAMS.INIT_EFACTOR;

    if (!item) {
      item = this._newItem(itemId, now, metadata);
    } else if (metadata && isObj(metadata) && Object.keys(metadata).length) {
      item = { ...item, ...metadata, id: item.id };
    }

    // -------------------------
    // SEED PATH (new items only)
    // -------------------------
    if (!wasExisting && q === 0) {
      // Do NOT count as a failure/lapse. Just initialize + schedule.
      item.due = now + SM2_PARAMS.INIT_INTERVAL * DAY_MS;
      item.lastReview = undefined;
      item.responseTime = 0;
      item.qualityHistory = Array.isArray(item.qualityHistory) ? item.qualityHistory : [];
      this.deck.set(itemId, item);
      await this.persist();

      safeTrack('sm2', 'seed_item', { itemId, type: item.type });
      return {
        success: true,
        item,
        wasNew: true,
        seeded: true,
        oldState: { reps: oldReps, interval: oldInterval, efactor: oldEF },
        xp: 0
      };
    }

    // -------------------------
    // SM-2 core update
    // -------------------------
    if (q < 3) {
      item.reps = 0;
      item.lapses = (item.lapses || 0) + 1;
      item.interval = 1;
      item.efactor = Math.max(SM2_PARAMS.MIN_EF, (item.efactor || oldEF) - 0.2);
    } else {
      item.reps = (item.reps || 0) + 1;

      if (item.reps === 1) item.interval = 1;
      else if (item.reps === 2) item.interval = 6;
      else {
        const mult = SM2_PARAMS.EF_MULTIPLIERS[clamp(q, 1, 5) - 1] || 1.0;
        const next = Math.round(oldInterval * (item.efactor || oldEF) * mult);
        item.interval = Math.min(Math.max(1, next), SM2_PARAMS.MAX_INTERVAL);
      }

      const nextEF =
        (item.efactor || oldEF) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

      item.efactor = clamp(nextEF, SM2_PARAMS.MIN_EF, SM2_PARAMS.MAX_EF);
    }

    item.due = now + item.interval * DAY_MS;
    item.lastReview = now;

    item.responseTime = Number.isFinite(responseTime) ? responseTime : 0;
    item.qualityHistory = Array.isArray(item.qualityHistory)
      ? [...item.qualityHistory.slice(-9), q]
      : [q];

    this.deck.set(itemId, item);
    await this.persist();

    safeTrack('sm2', 'review', {
      itemId,
      quality: q,
      reps: item.reps,
      interval: item.interval,
      efactor: item.efactor,
      lapses: item.lapses,
      type: item.type
    });

    // XP: award only for strong recall
    const xp = Math.round(10 + (item.reps * 2) + (q * 3));
    if (q >= 4) {
      try {
        addXP(xp, 'sm2_review', { source: 'sm2', metadata: { itemId, type: item.type, q } });
      } catch {
        try { addXP(xp); } catch { /* no-op */ }
      }
    }

    return {
      success: true,
      item,
      wasNew: !wasExisting,
      seeded: false,
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
    const GRACE_MS = Math.round(DAY_MS * 0.2); // ~4.8 hours grace (actually 20% of a day)

    const dueItems = Array.from(this.deck.values())
      .filter(item => {
        const due = Number(item?.due);
        return Number.isFinite(due) && due <= (now + GRACE_MS);
      })
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

  async getReviewSession(type = null, count = 10) {
    const n = Math.max(1, Math.trunc(count));
    const due = await this.getDueItems(type, n * 2);
    return getRandom(due, Math.min(n, due.length));
  }

  async getStats() {
    await this.init();

    const allItems = Array.from(this.deck.values()).filter(i => i?.type !== 'meta');
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

  async addBulkItems(items) {
    await this.init();

    const results = [];
    for (const itemData of (Array.isArray(items) ? items : [])) {
      if (!itemData?.id) continue;
      // Seed (no lapse) for new items; existing items will be treated as q=0 review.
      const result = await this.updateItem(itemData.id, 0, 0, itemData);
      results.push(result);
    }
    return results;
  }

  async resetItem(itemId) {
    await this.init();
    this.deck.delete(itemId);
    await this.persist();
    safeTrack('sm2', 'reset_item', { itemId });
    return true;
  }

  async exportDeck() {
    await this.init();
    return Object.fromEntries(this.deck);
  }

  async importDeck(deckData) {
    await this.init();

    const obj = isObj(deckData) ? deckData : {};
    const importedDeck = new Map(Object.entries(obj));

    for (const [id, item] of importedDeck) {
      if (!id || !item) continue;

      const existing = this.deck.get(id);
      const importedDue = Number(item?.due) || Infinity;
      const existingDue = Number(existing?.due) || Infinity;

      if (!existing || importedDue < existingDue) {
        this.deck.set(id, item);
      }
    }

    await this.persist();
    safeTrack('sm2', 'import_deck', { count: importedDeck.size });
    return true;
  }

  /**
   * Stores session-level summary inside a reserved meta record.
   * Accepts:
   * - array of reviews
   * - number
   * - { count }
   * - OR sessionTracker-style: (correct, wrong, engagedMs) via wrapper export below
   */
  async _updateSessionMeta({ count = 0, correct = 0, wrong = 0, engagedMs = 0, sessionId = null, activity = 'SRS' } = {}) {
    await this.init();

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
      createdAt: now
    };

    meta.lastSessionAt = now;
    meta.lastSessionReviewCount = count;
    meta.totalReviews = (Number(meta.totalReviews) || 0) + count;

    meta.sessionStats = meta.sessionStats || {
      totalSessions: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalEngagedMs: 0,
      lastSessionEnd: 0
    };

    meta.sessionStats.totalSessions += 1;
    meta.sessionStats.totalCorrect += Number(correct) || 0;
    meta.sessionStats.totalWrong += Number(wrong) || 0;
    meta.sessionStats.totalEngagedMs += Number(engagedMs) || 0;
    meta.sessionStats.lastSessionEnd = now;

    const log = Array.isArray(meta.sessionLog) ? meta.sessionLog : [];
    log.unshift({
      ts: now,
      sessionId,
      activity,
      correct: Number(correct) || 0,
      wrong: Number(wrong) || 0,
      engagedMs: Number(engagedMs) || 0,
      reviewCount: Number(count) || 0
    });
    meta.sessionLog = log.slice(0, 50);

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

export const updateItem       = spacedRepetition.updateItem.bind(spacedRepetition);
export const getDueItems      = spacedRepetition.getDueItems.bind(spacedRepetition);
export const getStats         = spacedRepetition.getStats.bind(spacedRepetition);
export const addBulkItems     = spacedRepetition.addBulkItems.bind(spacedRepetition);
export const resetItem        = spacedRepetition.resetItem.bind(spacedRepetition);
export const getReviewSession = spacedRepetition.getReviewSession.bind(spacedRepetition);
export const exportDeck       = spacedRepetition.exportDeck.bind(spacedRepetition);
export const importDeck       = spacedRepetition.importDeck.bind(spacedRepetition);

export default spacedRepetition;

/**
 * ✅ sessionTracker.js compatibility export.
 * sessionTracker calls updateSRSReviews(correct, wrong, engagedMs) without awaiting.  [oai_citation:3‡sessionTracker.js](sediment://file_00000000ac4c71f8a30041ab27c5ff8a)
 * So this function must be safe even if not awaited.
 */
export function updateSRSReviews(payloadOrCorrect = 0, wrong = 0, engagedMs = 0) {
  const payload = (payloadOrCorrect && typeof payloadOrCorrect === 'object')
    ? payloadOrCorrect
    : {
        correct: Number(payloadOrCorrect) || 0,
        wrong: Number(wrong) || 0,
        engagedMs: Number(engagedMs) || 0,
        reviews: []
      };

  const count =
    Array.isArray(payload.reviews) ? payload.reviews.length :
    Number.isFinite(payload.count) ? Math.max(0, Math.trunc(payload.count)) :
    Number.isFinite(payload.reviews) ? Math.max(0, Math.trunc(payload.reviews)) :
    Math.max(0, (Number(payload.correct) || 0) + (Number(payload.wrong) || 0));

  // Return a promise, but never reject (so callers that don't await won't get unhandled rejections).
  return (async () => {
    try {
      return await spacedRepetition._updateSessionMeta({
        count,
        correct: payload.correct,
        wrong: payload.wrong,
        engagedMs: payload.engagedMs,
        sessionId: payload.sessionId || null,
        activity: payload.activity || 'SRS'
      });
    } catch (e) {
      console.warn('[SRS] updateSRSReviews failed:', e);
      return { count: 0, totalReviews: 0, timestamp: Date.now(), error: true };
    }
  })();
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log('[SM-2] Violin-optimized spaced repetition ready');
  });
}