// js/engines/spacedRepetition.js
// ======================================
// VMQ SPACED REPETITION v2.1.5 — SM-2 Algorithm (drop-in replacement)
// Anki-inspired with violin-specific optimizations
//
// Fixes / Guarantees:
// ✅ Uses STORAGE_KEYS.SPACED_REPETITION
// ✅ Exports updateSRSReviews() for sessionTracker.js compatibility
// ✅ Fixes "grace window" bug (NO now*1.2 nonsense)
// ✅ Bulk add DOES NOT count as a lapse (even for existing items)
// ✅ Safe when called without await (sessionTracker endSession is sync)
// ✅ Avoids hard import of sessionTracker (prevents circular-import crashes)
// ======================================

import { saveJSON, loadJSON, STORAGE_KEYS } from '../config/storage.js';
import { addXP } from './gamification.js';

export const SM2_PARAMS = {
  INIT_REPS: 0,
  INIT_INTERVAL: 1, // days
  INIT_EFACTOR: 2.5,
  MAX_GRADE: 5,
  // canonical SM-2 early intervals (days)
  INTERVALS: [1, 6, 16],
  // optional violin-tuned multipliers by quality (1..5)
  EF_MULTIPLIERS: [0.2, 0.8, 1.0, 1.3, 1.6],
  MIN_EF: 1.3,
  MAX_INTERVAL: 365 * 6, // days
  // Optional guard (prevents runaway ease). If you don’t want it, set to Infinity.
  MAX_EF: 3.2
};

export const ITEM_TYPES = {
  FLASHCARD: 'flashcard',
  INTERVAL: 'interval',
  KEY_SIG: 'key',
  RHYTHM: 'rhythm',
  SCALE: 'scale',
  BIELER: 'bieler'
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function nowMs() { return Date.now(); }

/**
 * NOTE: We intentionally do NOT import sessionTracker here.
 * Instead, we dispatch an event that sessionTracker can optionally listen to.
 * Your sessionTracker already listens for 'vmq-srs-review' and funnels it to trackActivity('sm2', 'review', detail).
 */
function safeTrack(action, payload) {
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('vmq-srs-review', {
        detail: { action: String(action || 'event'), ...(payload || {}) }
      }));
    }
  } catch {
    // no-op
  }
}

// small helper: pick N unique random items (no external dependency)
function pickRandom(arr, n) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  const k = Math.max(0, Math.min(a.length, Math.trunc(n)));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

class SpacedRepEngine {
  constructor() {
    this.deck = new Map();
    this._initPromise = null;

    // persist coalescing (prevents storage thrash on rapid reviews)
    this._persistInFlight = null;
    this._persistQueued = false;

    this.init();
  }

  init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      let saved = {};
      try {
        saved = await Promise.resolve(loadJSON(STORAGE_KEYS.SPACED_REPETITION, {}));
      } catch (e) {
        console.warn('[SM-2] load failed, starting fresh:', e);
        saved = {};
      }

      const obj = isObj(saved) ? saved : {};
      this.deck = new Map(Object.entries(obj));
      // Ensure meta record is never treated as due (if present)
      if (this.deck.has('__vmq_srs_meta__')) {
        const meta = this.deck.get('__vmq_srs_meta__');
        if (meta && meta.type === 'meta') meta.due = Number.POSITIVE_INFINITY;
        this.deck.set('__vmq_srs_meta__', meta);
      }

      console.log(`[SM-2] Loaded ${this.deck.size} items`);
      return true;
    })();

    return this._initPromise;
  }

  async persist() {
    await this.init();

    // coalesce multiple persist() calls into one write
    if (this._persistInFlight) {
      this._persistQueued = true;
      return this._persistInFlight;
    }

    this._persistInFlight = (async () => {
      try {
        await Promise.resolve(saveJSON(
          STORAGE_KEYS.SPACED_REPETITION,
          Object.fromEntries(this.deck)
        ));
      } catch (e) {
        console.warn('[SM-2] save failed:', e);
      } finally {
        this._persistInFlight = null;
        if (this._persistQueued) {
          this._persistQueued = false;
          // schedule a trailing write
          await this.persist();
        }
      }
      return true;
    })();

    return this._persistInFlight;
  }

  normalizeQuality(q) {
    const n = Number(q);
    if (!Number.isFinite(n)) return 0;
    return clamp(Math.round(n), 0, SM2_PARAMS.MAX_GRADE);
  }

  _newItem(itemId, now, metadata) {
    const type = metadata?.type || ITEM_TYPES.FLASHCARD;
    return {
      id: String(itemId),
      reps: SM2_PARAMS.INIT_REPS,
      interval: SM2_PARAMS.INIT_INTERVAL,
      efactor: SM2_PARAMS.INIT_EFACTOR,
      due: now + SM2_PARAMS.INIT_INTERVAL * DAY_MS,
      lapses: 0,
      firstReview: now,
      createdAt: now,
      lastReview: undefined,

      type,
      // Any violin-specific metadata allowed:
      // prompt, answer, tags, skill, key, position, stringSet, etc.
      ...(isObj(metadata) ? metadata : {})
    };
  }

  getItem(itemId) {
    const id = String(itemId || '').trim();
    if (!id) return null;
    return this.deck.get(id) || null;
  }

  /**
   * Create or update an item using SM-2.
   * quality: 0..5 (0-2 fail, 3-5 pass)
   *
   * IMPORTANT:
   * - If the item is NEW and quality === 0, treat as "seed/initialize"
   *   (no lapse, no reps increment, due tomorrow).
   */
  async updateItem(itemId, quality, responseTime = 0, metadata = {}) {
    await this.init();

    const id = String(itemId || '').trim();
    if (!id) return { success: false, error: 'missing_itemId' };

    const q = this.normalizeQuality(quality);
    const now = nowMs();

    let item = this.deck.get(id);
    const wasExisting = !!item;

    const oldReps = item?.reps ?? 0;
    const oldInterval = item?.interval ?? SM2_PARAMS.INIT_INTERVAL;
    const oldEF = item?.efactor ?? SM2_PARAMS.INIT_EFACTOR;
    const oldLapses = item?.lapses ?? 0;

    if (!item) {
      item = this._newItem(id, now, metadata);
    } else if (metadata && isObj(metadata) && Object.keys(metadata).length) {
      // merge metadata without clobbering core fields
      item = { ...item, ...metadata, id: item.id };
      if (!item.type) item.type = ITEM_TYPES.FLASHCARD;
    }

    // -------------------------
    // SEED PATH (new items only)
    // -------------------------
    if (!wasExisting && q === 0) {
      item.due = now + SM2_PARAMS.INIT_INTERVAL * DAY_MS;
      item.lastReview = undefined;
      item.responseTime = 0;
      item.qualityHistory = Array.isArray(item.qualityHistory) ? item.qualityHistory : [];
      this.deck.set(id, item);
      await this.persist();

      safeTrack('seed_item', { itemId: id, type: item.type });
      return {
        success: true,
        item,
        wasNew: true,
        seeded: true,
        oldState: { reps: oldReps, interval: oldInterval, efactor: oldEF, lapses: oldLapses },
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
        const next = Math.round((oldInterval || 1) * (item.efactor || oldEF) * mult);
        item.interval = Math.min(Math.max(1, next), SM2_PARAMS.MAX_INTERVAL);
      }

      // canonical SM-2 EF update
      const nextEF =
        (item.efactor || oldEF) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

      item.efactor = clamp(nextEF, SM2_PARAMS.MIN_EF, SM2_PARAMS.MAX_EF);
    }

    item.due = now + item.interval * DAY_MS;
    item.lastReview = now;

    item.responseTime = Number.isFinite(Number(responseTime)) ? Number(responseTime) : 0;
    item.qualityHistory = Array.isArray(item.qualityHistory)
      ? [...item.qualityHistory.slice(-9), q]
      : [q];

    this.deck.set(id, item);
    await this.persist();

    safeTrack('review', {
      itemId: id,
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
        addXP(xp, 'sm2_review', { source: 'sm2', metadata: { itemId: id, type: item.type, q } });
      } catch {
        try { addXP(xp); } catch { /* no-op */ }
      }
    }

    return {
      success: true,
      item,
      wasNew: !wasExisting,
      seeded: false,
      oldState: { reps: oldReps, interval: oldInterval, efactor: oldEF, lapses: oldLapses },
      xp
    };
  }

  /**
   * Get due items for review
   * priority: lapsed first, then due date, then difficulty (lower EF first)
   */
  async getDueItems(type = null, limit = 50) {
    await this.init();

    const now = nowMs();
    const GRACE_MS = Math.round(DAY_MS * 0.2); // ~4.8 hours grace

    const dueItems = Array.from(this.deck.values())
      .filter(item => item && item.type !== 'meta')
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
    return filtered.slice(0, Math.max(0, Math.trunc(limit)));
  }

  async getReviewSession(type = null, count = 10) {
    const n = Math.max(1, Math.trunc(count));
    const due = await this.getDueItems(type, n * 2);
    return pickRandom(due, Math.min(n, due.length));
  }

  async getStats() {
    await this.init();

    const allItems = Array.from(this.deck.values()).filter(i => i && i.type !== 'meta');
    const now = nowMs();

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
            const last = Array.isArray(hist) ? hist.slice(-5) : [];
            return last.length > 0 && last.every(q => Number(q) >= 3);
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
   * Bulk add items safely:
   * - NEW items: seed (no lapse) and schedule due tomorrow
   * - EXISTING items: merge metadata ONLY (NO review, NO lapse, NO reps change)
   */
  async addBulkItems(items) {
    await this.init();

    const arr = Array.isArray(items) ? items : [];
    const now = nowMs();
    const results = [];

    for (const itemData of arr) {
      const id = String(itemData?.id || '').trim();
      if (!id) continue;

      const existing = this.deck.get(id);
      if (!existing) {
        // seed new item (quality=0 seed path)
        const seeded = await this.updateItem(id, 0, 0, itemData);
        results.push(seeded);
        continue;
      }

      // existing: merge metadata without affecting scheduling stats
      const merged = { ...existing, ...(isObj(itemData) ? itemData : {}), id: existing.id };
      if (!merged.type) merged.type = ITEM_TYPES.FLASHCARD;
      // preserve due/reps/lapses/efactor/interval unless explicitly provided (rare)
      merged.reps = existing.reps;
      merged.lapses = existing.lapses;
      merged.efactor = existing.efactor;
      merged.interval = existing.interval;
      merged.due = existing.due;
      merged.lastReview = existing.lastReview;
      merged.createdAt = existing.createdAt || now;

      this.deck.set(id, merged);
      results.push({ success: true, item: merged, wasNew: false, seeded: false, metadataOnly: true, xp: 0 });
    }

    if (results.length) {
      await this.persist();
      safeTrack('bulk_add', { count: results.length });
    }

    return results;
  }

  async resetItem(itemId) {
    await this.init();
    const id = String(itemId || '').trim();
    if (!id) return false;
    this.deck.delete(id);
    await this.persist();
    safeTrack('reset_item', { itemId: id });
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

      // Prefer the earlier due date if both exist (conservative)
      if (!existing || importedDue < existingDue) {
        this.deck.set(id, item);
      }
    }

    await this.persist();
    safeTrack('import_deck', { count: importedDeck.size });
    return true;
  }

  /**
   * Stores session-level summary inside a reserved meta record.
   * This is intentionally side-effect-free w.r.t. scheduling (no item updates).
   */
  async _updateSessionMeta({
    count = 0,
    correct = 0,
    wrong = 0,
    engagedMs = 0,
    sessionId = null,
    activity = 'SRS',
    reviews = []
  } = {}) {
    await this.init();

    const META_ID = '__vmq_srs_meta__';
    const now = nowMs();

    const meta = this.deck.get(META_ID) || {
      id: META_ID,
      type: 'meta',
      reps: 0,
      interval: 0,
      efactor: 0,
      due: Number.POSITIVE_INFINITY,
      lapses: 0,
      createdAt: now
    };

    meta.due = Number.POSITIVE_INFINITY;

    meta.lastSessionAt = now;
    meta.lastSessionReviewCount = Number(count) || 0;
    meta.totalReviews = (Number(meta.totalReviews) || 0) + (Number(count) || 0);

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
      reviewCount: Number(count) || 0,
      // store a tiny sample for debugging/analytics without bloating storage
      reviewSample: Array.isArray(reviews)
        ? reviews.slice(0, 20).map(r => ({
            ts: r?.ts || null,
            itemId: r?.itemId || r?.cardId || r?.id || null,
            correct: r?.correct ?? null,
            quality: r?.quality ?? null,
            responseTime: r?.responseTime ?? null,
            action: r?.action || null
          }))
        : []
    });
    meta.sessionLog = log.slice(0, 50);

    this.deck.set(META_ID, meta);
    await this.persist();

    safeTrack('session_reviews', { count: Number(count) || 0, totalReviews: meta.totalReviews });
    return { count: Number(count) || 0, totalReviews: meta.totalReviews, timestamp: now };
  }
}

// ======================================
// GLOBAL INSTANCE & EXPORTS
// ======================================
const spacedRepetition = new SpacedRepEngine();

export const updateItem = spacedRepetition.updateItem.bind(spacedRepetition);
export const getDueItems = spacedRepetition.getDueItems.bind(spacedRepetition);
export const getStats = spacedRepetition.getStats.bind(spacedRepetition);
export const addBulkItems = spacedRepetition.addBulkItems.bind(spacedRepetition);
export const resetItem = spacedRepetition.resetItem.bind(spacedRepetition);
export const getReviewSession = spacedRepetition.getReviewSession.bind(spacedRepetition);
export const exportDeck = spacedRepetition.exportDeck.bind(spacedRepetition);
export const importDeck = spacedRepetition.importDeck.bind(spacedRepetition);

export default spacedRepetition;

/**
 * ✅ sessionTracker.js compatibility export.
 * sessionTracker calls updateSRSReviews({ ...payload }) and does not await.
 * This MUST never throw synchronously, and MUST be safe if not awaited.
 *
 * Accepted shapes:
 * 1) updateSRSReviews({ sessionId, activity, engagedMs, correct, wrong, reviews: [...] })
 * 2) updateSRSReviews(correct, wrong, engagedMs)  (legacy)
 * 3) updateSRSReviews([reviewEvents...])          (counts + logs)
 */
export function updateSRSReviews(payloadOrCorrect = 0, wrong = 0, engagedMs = 0) {
  // Return a promise, but never throw synchronously.
  return (async () => {
    try {
      // 1) Array form
      if (Array.isArray(payloadOrCorrect)) {
        const reviews = payloadOrCorrect;
        const count = reviews.length;
        // Try to infer correct/wrong if present
        const inferredCorrect = reviews.reduce((s, r) => s + ((r?.correct === true) ? 1 : 0), 0);
        const inferredWrong = reviews.reduce((s, r) => s + ((r?.correct === false) ? 1 : 0), 0);

        return await spacedRepetition._updateSessionMeta({
          count,
          correct: inferredCorrect,
          wrong: inferredWrong,
          engagedMs: 0,
          sessionId: null,
          activity: 'SRS',
          reviews
        });
      }

      // 2) Object payload form
      const isPayloadObj = isObj(payloadOrCorrect);
      const payload = isPayloadObj
        ? payloadOrCorrect
        : {
            correct: Number(payloadOrCorrect) || 0,
            wrong: Number(wrong) || 0,
            engagedMs: Number(engagedMs) || 0,
            reviews: []
          };

      const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
      const count =
        Number.isFinite(payload.count) ? Math.max(0, Math.trunc(payload.count)) :
        reviews.length ? reviews.length :
        Math.max(0, (Number(payload.correct) || 0) + (Number(payload.wrong) || 0));

      return await spacedRepetition._updateSessionMeta({
        count,
        correct: Number(payload.correct) || 0,
        wrong: Number(payload.wrong) || 0,
        engagedMs: Number(payload.engagedMs) || 0,
        sessionId: payload.sessionId || null,
        activity: payload.activity || 'SRS',
        reviews
      });
    } catch (e) {
      console.warn('[SRS] updateSRSReviews failed:', e);
      return { count: 0, totalReviews: 0, timestamp: nowMs(), error: true };
    }
  })();
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log('[SM-2] Violin-optimized spaced repetition ready');
  });
}
