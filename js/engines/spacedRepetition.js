// ========================================================
// VMQ SPACED REPETITION ENGINE
// Priority-based algorithm for adaptive learning
// ========================================================

import { STORAGE_KEYS, loadJSON, saveJSON } from '../config/storage.js';

/**
 * Get the item database
 * @returns {Object} Database of all items
 */
function getDb() {
  return loadJSON(STORAGE_KEYS.ITEMS, {});
}

/**
 * Save the item database
 * @param {Object} db - Database to save
 */
function saveDb(db) {
  saveJSON(STORAGE_KEYS.ITEMS, db);
}

/**
 * Initialize an item if it doesn't exist
 * @param {string} id - Item ID
 * @returns {Object} Item record
 */
export function initializeItem(id) {
  const db = getDb();
  if (!db[id]) {
    db[id] = {
      seen: 0,
      correct: 0,
      lastSeen: null,
      created: Date.now()
    };
    saveDb(db);
  }
  return db[id];
}

/**
 * Update item after an answer
 * @param {string} id - Item ID
 * @param {boolean} isCorrect - Whether answer was correct
 */
export function updateItem(id, isCorrect) {
  const db = getDb();
  const record = db[id] || initializeItem(id);

  record.seen += 1;
  if (isCorrect) {
    record.correct += 1;
  }
  record.lastSeen = Date.now();

  db[id] = record;
  saveDb(db);
}

/**
 * Calculate priority score for an item
 * Higher score = needs more practice
 * @param {Object} record - Item record
 * @returns {number} Priority score
 */
function calculatePriority(record) {
  if (!record || record.seen === 0) {
    return 100; // New items get high priority
  }

  const accuracy = record.correct / record.seen;
  const recencyBonus = record.lastSeen 
    ? Math.max(0, 1 - (Date.now() - record.lastSeen) / (7 * 24 * 60 * 60 * 1000)) // Decay over 7 days
    : 1;

  // Priority increases when:
  // - Accuracy is low (1 - accuracy)
  // - Item was seen recently (recencyBonus)
  // - Item has been seen multiple times but still struggling
  const basePriority = (1 - accuracy) * 100;
  const experienceWeight = Math.min(record.seen / 10, 1); // Cap at 10 attempts
  
  return basePriority * (0.7 + 0.3 * recencyBonus) * (0.5 + 0.5 * experienceWeight);
}

/**
 * Select next item from candidate pool using priority
 * @param {Array<string>} candidateIds - Array of item IDs to choose from
 * @returns {string} Selected item ID
 */
export function selectNextItem(candidateIds) {
  if (!candidateIds || candidateIds.length === 0) {
    throw new Error('selectNextItem: candidateIds array is empty');
  }

  const db = getDb();
  
  // Calculate priority for each candidate
  const candidates = candidateIds.map(id => {
    const record = db[id] || { seen: 0, correct: 0, lastSeen: null };
    return {
      id,
      priority: calculatePriority(record),
      record
    };
  });

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  // Weighted random selection from top 30%
  const topCandidates = candidates.slice(0, Math.max(1, Math.ceil(candidates.length * 0.3)));
  
  // Calculate total weight
  const totalWeight = topCandidates.reduce((sum, c) => sum + c.priority, 0);
  
  // Random weighted selection
  let random = Math.random() * totalWeight;
  for (const candidate of topCandidates) {
    random -= candidate.priority;
    if (random <= 0) {
      return candidate.id;
    }
  }

  // Fallback to highest priority
  return candidates[0].id;
}

/**
 * Get mastery statistics for a set of items
 * @param {Array<string>} ids - Item IDs
 * @returns {Array<Object>} Array of mastery stats sorted by priority
 */
export function getMasteryStats(ids) {
  const db = getDb();
  
  const stats = ids.map(id => {
    const record = db[id] || { seen: 0, correct: 0, lastSeen: null };
    const accuracy = record.seen > 0 ? Math.round((record.correct / record.seen) * 100) : 0;
    const priority = calculatePriority(record);

    return {
      id,
      seen: record.seen,
      correct: record.correct,
      accuracy,
      priority: Math.round(priority),
      status: accuracy >= 80 ? 'mastered' : accuracy >= 50 ? 'learning' : 'needs-work'
    };
  });

  // Sort by priority (highest first)
  stats.sort((a, b) => b.priority - a.priority);

  return stats;
}

/**
 * Reset an item (for testing or fresh start)
 * @param {string} id - Item ID
 */
export function resetItem(id) {
  const db = getDb();
  delete db[id];
  saveDb(db);
}

/**
 * Reset all items in a category/mode
 * @param {Array<string>} ids - Item IDs to reset
 */
export function resetItems(ids) {
  const db = getDb();
  ids.forEach(id => delete db[id]);
  saveDb(db);
}

/**
 * Get overall statistics
 * @returns {Object} Overall stats
 */
export function getOverallStats() {
  const db = getDb();
  const items = Object.values(db);

  if (items.length === 0) {
    return { totalItems: 0, totalSeen: 0, totalCorrect: 0, accuracy: 0 };
  }

  const totalSeen = items.reduce((sum, item) => sum + item.seen, 0);
  const totalCorrect = items.reduce((sum, item) => sum + item.correct, 0);
  const accuracy = totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : 0;

  return {
    totalItems: items.length,
    totalSeen,
    totalCorrect,
    accuracy
  };
}