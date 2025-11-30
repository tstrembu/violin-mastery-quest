// ========================================================
// VMQ HELPERS - Pure Utility Functions
// ========================================================

/**
 * Fisher-Yates shuffle
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled copy
 */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Get random element from array
 * @param {Array} array - Source array
 * @returns {*} Random element
 */
export function getRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Calculate accuracy percentage
 * @param {number} correct - Number correct
 * @param {number} total - Total attempts
 * @returns {number} Percentage (0-100)
 */
export function calculateAccuracy(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/**
 * Format large numbers with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Get time of day greeting
 * @returns {string} Greeting message
 */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Calculate days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Days difference
 */
export function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1 - date2) / oneDay));
}

/**
 * Normalize text for comparison (lowercase, trim, remove extra spaces)
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Fuzzy string match (simple token-based matching)
 * @param {string} answer - User's answer
 * @param {string} correct - Correct answer
 * @param {number} threshold - Match threshold (0-1)
 * @returns {boolean} Whether strings match closely enough
 */
export function fuzzyMatch(answer, correct, threshold = 0.6) {
  const answerTokens = normalizeText(answer).split(' ');
  const correctTokens = normalizeText(correct).split(' ');
  
  let matches = 0;
  answerTokens.forEach(token => {
    if (correctTokens.some(ct => ct.includes(token) || token.includes(ct))) {
      matches++;
    }
  });
  
  return (matches / Math.max(answerTokens.length, correctTokens.length)) >= threshold;
}

/**
 * Clamp number between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Deep clone object (simple version, doesn't handle circular refs)
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item));
  
  const cloned = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone(obj[key]);
  });
  return cloned;
}