// ======================================
// VMQ UTILITIES HELPERS v2.1.1 - Advanced Learning Analytics + ML Patterns
// Music Theory + AI + Performance + Analytics Optimized
// ======================================

/**
 * 🎵 MUSIC THEORY - Enhanced Violin/MIDI Production
 */
export const MUSIC = {
  // Note → MIDI (C4=60, G3=55, E5=76)
  noteToMidi(note) {
    const noteMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
      'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
      'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const match = note.match(/^([A-G][#b]?)(-?\d+)$/);
    if (!match) return null;
    const [, noteName, octave] = match;
    return (parseInt(octave) + 1) * 12 + noteMap[noteName];
  },

  // MIDI → Note name with octave
  midiToNote(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = noteNames[midi % 12];
    return `${noteName}${octave}`;
  },

  // MIDI → Frequency (A4=440Hz)
  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  // Frequency → MIDI (for tuner features)
  freqToMidi(freq) {
    return Math.round(69 + 12 * Math.log2(freq / 440));
  },

  // Cents deviation from perfect pitch
  getCentsDeviation(freq, targetMidi) {
    const actualMidi = 69 + 12 * Math.log2(freq / 440);
    return Math.round((actualMidi - targetMidi) * 100);
  },

  // Violin open strings (G3=55, D4=62, A4=69, E5=76)
  VIOLIN_STRINGS: [55, 62, 69, 76],
  STRING_NAMES: ['G', 'D', 'A', 'E'],
  STRING_FREQS: [196.00, 293.66, 440.00, 659.25],

  // Position → Semitones (violin spacing)
  positionToSemitones(pos, finger = 1) {
    // Violin positions: 1st pos (fingers 1-4), 2nd pos (+2 semitones), etc.
    const positionOffset = (pos - 1) * 4; // Each position shifts 4 semitones
    const fingerOffset = (finger - 1); // Fingers 1-4 within position
    return positionOffset + fingerOffset;
  },
  
  // js/utils/audioHelpers.js - Missing utility functions
  /**
   * Calculate interval distance between two frequencies
   * @param {number} freq1 - First frequency
   * @param {number} freq2 - Second frequency
   * @returns {number} Interval in semitones
   */
  export function calculateInterval(freq1, freq2) {
    return Math.round(12 * Math.log2(freq2 / freq1));
  }
  
  /**
   * Get interval name from semitone distance
   * @param {number} semitones - Distance in semitones
   * @returns {string} Interval name
   */
  export function getIntervalName(semitones) {
    const intervals = {
      0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd',
      4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th',
      8: 'Minor 6th', 9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th',
      12: 'Octave'
    };
    return intervals[Math.abs(semitones) % 12] || 'Unknown';
  }
  
  /**
   * Check if pitch is within acceptable range of target
   * @param {number} actual - Actual frequency
   * @param {number} target - Target frequency
   * @param {number} tolerance - Tolerance in cents (default 50)
   * @returns {boolean}
   */
  export function isPitchAccurate(actual, target, tolerance = 50) {
    const cents = 1200 * Math.log2(actual / target);
    return Math.abs(cents) <= tolerance;
  }

  // Semitones → Position + Finger
  semitonesToPosition(semitones) {
    const position = Math.floor(semitones / 4) + 1;
    const finger = (semitones % 4) + 1;
    return { position, finger };
  },

  // Get note for string + position + finger
  getNote(stringIdx, position, finger = 1) {
    if (stringIdx < 0 || stringIdx > 3) return null;
    const openString = this.VIOLIN_STRINGS[stringIdx];
    const semitones = this.positionToSemitones(position, finger);
    const midi = openString + semitones;
    return this.midiToNote(midi);
  },

  // Interval semitones → Name
  getIntervalName(semitones) {
    const intervals = {
      0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd',
      4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th',
      8: 'Minor 6th', 9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th',
      12: 'Octave'
    };
    return intervals[semitones % 12] || 'Unknown';
  },

  // Interval quality (for pedagogy)
  getIntervalQuality(semitones) {
    const mod = semitones % 12;
    const perfect = [0, 5, 7, 12];
    const major = [2, 4, 9, 11];
    const minor = [1, 3, 8, 10];
    
    if (perfect.includes(mod)) return 'Perfect';
    if (major.includes(mod)) return 'Major';
    if (minor.includes(mod)) return 'Minor';
    return mod === 6 ? 'Augmented/Diminished' : 'Unknown';
  },

  // Scale degree name
  getScaleDegree(degree) {
    const degrees = {
      1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant',
      5: 'Dominant', 6: 'Submediant', 7: 'Leading Tone'
    };
    return degrees[degree] || 'Unknown';
  },

  // Chord quality from intervals
  getChordQuality(intervals) {
    const sorted = [...intervals].sort((a, b) => a - b);
    const pattern = sorted.join(',');
    
    const chords = {
      '0,4,7': 'Major',
      '0,3,7': 'Minor',
      '0,3,6': 'Diminished',
      '0,4,8': 'Augmented',
      '0,4,7,10': 'Dominant 7th',
      '0,4,7,11': 'Major 7th',
      '0,3,7,10': 'Minor 7th',
      '0,3,6,10': 'Half-Diminished 7th',
      '0,3,6,9': 'Fully Diminished 7th'
    };
    
    return chords[pattern] || 'Unknown';
  },

  // Bieler Method: Hand frame validation
  isValidHandFrame(finger1Midi, finger4Midi) {
    const span = finger4Midi - finger1Midi;
    return span >= 4 && span <= 6; // Perfect 4th is 5 semitones (acceptable range)
  },

  // Calculate fingering difficulty (for adaptive difficulty)
  getFingeringDifficulty(position, string, targetNote) {
    const difficulty = {
      position: position > 3 ? 2 : position > 1 ? 1 : 0,
      stringCrossing: string !== 1 ? 1 : 0,
      extension: 0 // Could calculate based on hand frame
    };
    return difficulty.position + difficulty.stringCrossing + difficulty.extension;
  }
};

/**
 * 🎯 CORE VMQ - Enhanced Random + Shuffle
 */
export function getRandom(array, exclude = []) {
  if (!Array.isArray(array) || array.length === 0) return null;
  const valid = array.filter(item => !exclude.includes(item));
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

export function getRandomWeighted(items, weightFn) {
  const weights = items.map(weightFn);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  
  return items[items.length - 1];
}

export function shuffle(array) {
  if (!Array.isArray(array)) return [];
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sample(array, count) {
  if (!Array.isArray(array) || count <= 0) return [];
  return shuffle(array).slice(0, Math.min(count, array.length));
}

/**
 * 📊 ADVANCED STATISTICS - ML-Style Analytics
 */
export function accuracy(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export function grade(accuracy) {
  if (accuracy >= 97) return 'S+';
  if (accuracy >= 95) return 'S';
  if (accuracy >= 90) return 'A';
  if (accuracy >= 85) return 'B+';
  if (accuracy >= 80) return 'B';
  if (accuracy >= 75) return 'C+';
  if (accuracy >= 70) return 'C';
  if (accuracy >= 60) return 'D';
  return 'F';
}

export function streakGrade(streak) {
  if (streak >= 100) return '👑 Legend';
  if (streak >= 50) return '🏆 Champion';
  if (streak >= 30) return '💎 Master';
  if (streak >= 14) return '⭐ Expert';
  if (streak >= 7) return '🔥 Strong';
  if (streak >= 3) return '💪 Good';
  return '🌱 Starting';
}

// Statistical measures
export function mean(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

export function median(numbers) {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

export function standardDeviation(numbers) {
  if (!numbers.length) return 0;
  const avg = mean(numbers);
  const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

export function percentile(numbers, p) {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function zScore(value, numbers) {
  const avg = mean(numbers);
  const stdDev = standardDeviation(numbers);
  return stdDev === 0 ? 0 : (value - avg) / stdDev;
}

// Trend analysis
export function calculateTrend(values, windowSize = 5) {
  if (values.length < windowSize) return 'insufficient_data';
  
  const recent = values.slice(-windowSize);
  const older = values.slice(-windowSize * 2, -windowSize);
  
  if (older.length === 0) return 'neutral';
  
  const recentAvg = mean(recent);
  const olderAvg = mean(older);
  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (change > 10) return 'improving';
  if (change < -10) return 'declining';
  if (Math.abs(change) < 3) return 'plateau';
  return 'neutral';
}

export function detectPattern(data, patternFn) {
  const patterns = [];
  for (let i = 0; i < data.length; i++) {
    const pattern = patternFn(data, i);
    if (pattern) patterns.push({ index: i, ...pattern });
  }
  return patterns;
}

// Moving average (smoothing)
export function movingAverage(values, windowSize = 3) {
  if (values.length < windowSize) return values;
  
  const result = [];
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    result.push(mean(window));
  }
  return result;
}

// Exponential moving average (more weight to recent)
export function exponentialMovingAverage(values, alpha = 0.3) {
  if (!values.length) return [];
  
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * 🧠 LEARNING ANALYTICS - Pattern Recognition
 */
export function analyzeLearningCurve(sessions) {
  if (!sessions || sessions.length < 3) {
    return { 
      stage: 'beginning', 
      velocity: 0, 
      prediction: null 
    };
  }

  const accuracies = sessions.map(s => s.accuracy || 0);
  const times = sessions.map(s => s.timestamp);
  
  // Calculate learning velocity (accuracy improvement per session)
  const recentAccuracy = mean(accuracies.slice(-5));
  const earlierAccuracy = mean(accuracies.slice(0, 5));
  const velocity = recentAccuracy - earlierAccuracy;
  
  // Determine learning stage
  let stage = 'developing';
  if (recentAccuracy >= 90) stage = 'mastery';
  else if (recentAccuracy >= 75) stage = 'competent';
  else if (velocity > 10) stage = 'accelerating';
  else if (Math.abs(velocity) < 3 && sessions.length > 10) stage = 'plateau';
  
  // Predict sessions to mastery (90% accuracy)
  let prediction = null;
  if (velocity > 0 && recentAccuracy < 90) {
    const sessionsNeeded = Math.ceil((90 - recentAccuracy) / (velocity / 5));
    prediction = {
      sessionsToMastery: Math.max(1, sessionsNeeded),
      estimatedDays: Math.ceil(sessionsNeeded / 2) // Assuming ~2 sessions/day
    };
  }
  
  return {
    stage,
    velocity: Math.round(velocity * 10) / 10,
    recentAccuracy: Math.round(recentAccuracy),
    trend: calculateTrend(accuracies),
    consistency: 100 - Math.round(standardDeviation(accuracies.slice(-10))),
    prediction
  };
}

export function detectLearningPlateaus(sessions, threshold = 5) {
  const accuracies = sessions.map(s => s.accuracy || 0);
  const plateaus = [];
  
  for (let i = threshold; i < accuracies.length; i++) {
    const window = accuracies.slice(i - threshold, i);
    const variance = standardDeviation(window);
    const avg = mean(window);
    
    if (variance < 5 && avg < 85) {
      plateaus.push({
        startIndex: i - threshold,
        endIndex: i,
        accuracy: Math.round(avg),
        duration: threshold
      });
    }
  }
  
  return plateaus;
}

export function calculateMastery(moduleData) {
  const { correct = 0, total = 0, avgTime = 5000, lastPracticed = 0 } = moduleData;
  
  if (total < 5) return { level: 'novice', score: 0 };
  
  const accuracyScore = (correct / total) * 100;
  const volumeScore = Math.min(100, (total / 50) * 100); // 50 questions = 100%
  const speedScore = Math.max(0, 100 - (avgTime / 100)); // Under 10s = 100%
  const recencyScore = Math.max(0, 100 - ((Date.now() - lastPracticed) / (7 * 24 * 60 * 60 * 1000)) * 100);
  
  const masteryScore = Math.round(
    accuracyScore * 0.5 +
    volumeScore * 0.2 +
    speedScore * 0.2 +
    recencyScore * 0.1
  );
  
  let level = 'novice';
  if (masteryScore >= 90) level = 'expert';
  else if (masteryScore >= 75) level = 'advanced';
  else if (masteryScore >= 60) level = 'intermediate';
  else if (masteryScore >= 40) level = 'developing';
  
  return { level, score: masteryScore };
}

export function predictNextPerformance(recentSessions) {
  if (recentSessions.length < 3) return null;
  
  const accuracies = recentSessions.map(s => s.accuracy);
  const smoothed = exponentialMovingAverage(accuracies, 0.4);
  const prediction = smoothed[smoothed.length - 1];
  
  const confidence = 100 - Math.min(100, standardDeviation(accuracies));
  
  return {
    predictedAccuracy: Math.round(prediction),
    confidence: Math.round(confidence),
    trend: calculateTrend(accuracies)
  };
}

/**
 * ⏱️ TIME - Enhanced Journal + Session Production
 */
export function formatDuration(ms) {
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatDurationShort(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  const daysDiff = Math.floor((today - date) / 86400000);
  if (daysDiff < 7) return `${daysDiff} days ago`;
  if (daysDiff < 30) return `${Math.floor(daysDiff / 7)} weeks ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

export function getTimeOfDay(hour) {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export function isToday(timestamp) {
  return new Date(timestamp).toDateString() === new Date().toDateString();
}

export function isThisWeek(timestamp) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  return timestamp >= weekAgo && timestamp <= now;
}

/**
 * 🎮 GAME - Enhanced VMQ Production
 */
export function getDistractors(correct, pool, count = 3, similarityFn = null) {
  let candidates = pool.filter(item => {
    const itemValue = typeof item === 'object' ? item.name || item.sig : item;
    const correctValue = typeof correct === 'object' ? correct.name || correct.sig : correct;
    return itemValue !== correctValue;
  });
  
  // Sort by similarity if function provided (for harder questions)
  if (similarityFn && typeof correct === 'object') {
    candidates = candidates.sort((a, b) => {
      const simA = similarityFn(a, correct);
      const simB = similarityFn(b, correct);
      return simB - simA; // Most similar first
    });
  } else {
    candidates = shuffle(candidates);
  }
  
  return candidates
    .slice(0, count)
    .map(item => typeof item === 'object' ? item.name || item.sig : item);
}

export function optionsGrid(correct, distractors) {
  const correctValue = typeof correct === 'object' ? correct.name || correct.sig : correct;
  return shuffle([correctValue, ...distractors]);
}

export function generateQuiz(items, count, optionsPerQ = 4) {
  const selected = sample(items, count);
  
  return selected.map(item => ({
    question: item,
    correct: typeof item === 'object' ? item.name || item.sig : item,
    options: optionsGrid(
      item,
      getDistractors(item, items, optionsPerQ - 1)
    )
  }));
}

/**
 * 🚀 PERFORMANCE - Enhanced React + 50+ modules
 */
export function debounce(fn, ms) {
  let timeout;
  return function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function throttle(fn, limit) {
  let inThrottle;
  return function throttled(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function memoize(fn) {
  const cache = new Map();
  return function memoized(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

export function shallowEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  return keys1.every(key => obj1[key] === obj2[key]);
}

export function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  return keys1.every(key => deepEqual(obj1[key], obj2[key]));
}

// Performance monitoring
export function measurePerformance(fn, label = 'operation') {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  return result;
}

export async function measureAsync(fn, label = 'async operation') {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  return result;
}

/**
 * 💾 STORAGE - Enhanced Journal + SM-2 Production
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

export function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9_\-\.]/gi, '_').toLowerCase();
}

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * 📈 VMQ ANALYTICS - Enhanced Coach + Dashboard
 */
export function groupBy(array, keyFn) {
  if (!Array.isArray(array)) return {};
  return array.reduce((acc, item) => {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function average(numbers) {
  return mean(numbers); // Use enhanced mean function
}

export function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

export function statsSummary(data) {
  if (!data || data.length === 0) {
    return {
      avgAccuracy: 0,
      best: 0,
      worst: 100,
      sessions: 0,
      totalTime: 0,
      consistency: 0
    };
  }

  const accuracies = data.map(d => d.accuracy || 0).filter(a => a > 0);
  
  return {
    avgAccuracy: Math.round(mean(accuracies)),
    medianAccuracy: Math.round(median(accuracies)),
    best: Math.max(...accuracies, 0),
    worst: Math.min(...accuracies, 100),
    sessions: data.length,
    totalTime: data.reduce((sum, d) => sum + (d.engagedMs || d.duration || 0), 0),
    consistency: Math.round(100 - standardDeviation(accuracies)),
    totalQuestions: data.reduce((sum, d) => sum + (d.total || 0), 0)
  };
}

export function calculateStreak(sessions, dateKey = 'date') {
  if (!sessions || sessions.length === 0) return 0;
  
  const sorted = [...sessions].sort((a, b) => 
    new Date(b[dateKey]) - new Date(a[dateKey])
  );
  
  let streak = 1;
  const today = new Date().setHours(0, 0, 0, 0);
  const mostRecent = new Date(sorted[0][dateKey]).setHours(0, 0, 0, 0);
  
  // Must have practiced today or yesterday
  if ((today - mostRecent) > 86400000) return 0;
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = new Date(sorted[i][dateKey]).setHours(0, 0, 0, 0);
    const next = new Date(sorted[i + 1][dateKey]).setHours(0, 0, 0, 0);
    const diff = (current - next) / 86400000;
    
    if (diff === 1) {
      streak++;
    } else if (diff > 1) {
      break;
    }
  }
  
  return streak;
}

export function aggregateByTimeframe(data, timeframe = 'week', valueFn = (d) => d.total) {
  const now = Date.now();
  const cutoffs = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  };
  
  const cutoff = cutoffs[timeframe] || cutoffs.week;
  const filtered = data.filter(item => now - item.timestamp < cutoff);
  
  return {
    total: sum(filtered.map(valueFn)),
    average: mean(filtered.map(valueFn)),
    count: filtered.length,
    data: filtered
  };
}

/**
 * 🎵 VIOLIN PRODUCTION - Enhanced NoteLocator/Fingerboard
 */
export function getNoteName(stringIdx, position, finger = 1) {
  if (stringIdx < 0 || stringIdx > 3) return null;
  const open = MUSIC.VIOLIN_STRINGS[stringIdx];
  const semitones = MUSIC.positionToSemitones(position, finger);
  const midi = open + semitones;
  return MUSIC.midiToNote(midi);
}

export function positionFromNote(noteMidi, stringIdx) {
  if (stringIdx < 0 || stringIdx > 3) return null;
  const open = MUSIC.VIOLIN_STRINGS[stringIdx];
  const semitones = noteMidi - open;
  const { position } = MUSIC.semitonesToPosition(semitones);
  return clamp(position, 1, 7); // Positions 1-7 common
}

export function findBestFingering(targetMidi, allowedStrings = [0, 1, 2, 3]) {
  const options = [];
  
  for (const stringIdx of allowedStrings) {
    const openString = MUSIC.VIOLIN_STRINGS[stringIdx];
    const semitones = targetMidi - openString;
    
    if (semitones >= 0 && semitones <= 24) { // Up to 6th position
      const { position, finger } = MUSIC.semitonesToPosition(semitones);
      const difficulty = MUSIC.getFingeringDifficulty(position, stringIdx, targetMidi);
      
      options.push({
        string: MUSIC.STRING_NAMES[stringIdx],
        stringIdx,
        position,
        finger,
        difficulty,
        semitones
      });
    }
  }
  
  // Sort by difficulty (easiest first)
  return options.sort((a, b) => a.difficulty - b.difficulty);
}

/**
 * 🚀 ASYNC - Enhanced Production retry + sleep
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry(fn, maxAttempts = 3, delayMs = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await sleep(delayMs * (attempt + 1)); // Exponential backoff
      console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying...`);
    }
  }
}

export async function timeout(promise, ms, message = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
}

export async function batchProcess(items, processFn, batchSize = 10, delayMs = 100) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
    
    if (i + batchSize < items.length) {
      await sleep(delayMs); // Prevent overwhelming the system
    }
  }
  
  return results;
}

/**
 * 💾 EXPORT - Enhanced Journal + DataManager
 */
export function downloadJSON(data, filename = 'vmq-export.json') {
  const str = JSON.stringify(data, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(filename);
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(data, filename = 'vmq-export.csv') {
  if (!Array.isArray(data) || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];
  
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(filename);
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for browsers without clipboard API
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const success = document.execCommand('copy');
    document.body.removeChild(el);
    return success;
  }
}

export async function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        resolve(json);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * 🎯 VMQ UX - Enhanced Mobile + Accessibility
 */
export const DEVICE = {
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
  isAndroid: /Android/i.test(navigator.userAgent),
  isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  isStandalone: window.matchMedia('(display-mode: standalone)').matches,
  orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  screenSize: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'
};

export function pluralize(count, singular, plural = null) {
  const word = count === 1 ? singular : (plural || singular + 's');
  return `${count} ${word}`;
}

export function titleCase(str) {
  if (typeof str !== 'string') return '';
  return str.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function truncate(str, maxLength, suffix = '...') {
  if (typeof str !== 'string' || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

export function slugify(str) {
  return str.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 🔗 ROUTING - Enhanced Hash + Query Production
 */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function setQueryParam(name, value) {
  const url = new URL(window.location);
  if (value === null || value === undefined) {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  window.history.replaceState({}, '', url);
}

export function getAllQueryParams() {
  const params = {};
  new URLSearchParams(window.location.search).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export function getHashRoute() {
  return window.location.hash.slice(1) || 'home';
}

export function setHashRoute(route) {
  window.location.hash = route;
}

/**
 * 🎮 VMQ GAMIFICATION - Enhanced XP + Levels
 */
export function xpToLevel(xp) {
  // Exponential leveling: Level 1 = 0-1000 XP, Level 2 = 1000-2500 XP, etc.
  return Math.floor(Math.sqrt(xp / 500)) + 1;
}

export function levelToXP(level) {
  // XP required to reach level
  return Math.pow(level - 1, 2) * 500;
}

export function levelProgress(currentXp) {
  const currentLevel = xpToLevel(currentXp);
  const levelStart = levelToXP(currentLevel);
  const levelEnd = levelToXP(currentLevel + 1);
  
  return {
    level: currentLevel,
    current: currentXp - levelStart,
    required: levelEnd - levelStart,
    percentage: Math.round(((currentXp - levelStart) / (levelEnd - levelStart)) * 100)
  };
}

export function calculateXPReward(accuracy, timeMs, baseXP = 10) {
  let xp = baseXP;
  
  // Accuracy bonus
  if (accuracy >= 100) xp *= 2;
  else if (accuracy >= 90) xp *= 1.5;
  else if (accuracy >= 80) xp *= 1.2;
  else if (accuracy < 50) xp *= 0.5;
  
  // Speed bonus (under 3 seconds)
  if (timeMs < 3000) xp *= 1.3;
  else if (timeMs < 5000) xp *= 1.1;
  
  return Math.round(xp);
}

/**
 * 🎨 COLOR & VISUALIZATION
 */
export function getGradeColor(accuracy) {
  if (accuracy >= 95) return '#10b981'; // Green
  if (accuracy >= 90) return '#3b82f6'; // Blue
  if (accuracy >= 80) return '#8b5cf6'; // Purple
  if (accuracy >= 70) return '#f59e0b'; // Amber
  if (accuracy >= 60) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

export function interpolateColor(color1, color2, factor) {
  // Simple RGB interpolation
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);
  
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * 🔍 VALIDATION
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * 🎯 UTILITY EXPORTS
 */
export default {
  MUSIC,
  getRandom,
  getRandomWeighted,
  shuffle,
  sample,
  accuracy,
  grade,
  streakGrade,
  mean,
  median,
  standardDeviation,
  percentile,
  zScore,
  calculateTrend,
  detectPattern,
  movingAverage,
  exponentialMovingAverage,
  analyzeLearningCurve,
  detectLearningPlateaus,
  calculateMastery,
  predictNextPerformance,
  formatDuration,
  formatDurationShort,
  formatDate,
  formatRelativeTime,
  getTimeOfDay,
  isToday,
  isThisWeek,
  getDistractors,
  optionsGrid,
  generateQuiz,
  debounce,
  throttle,
  memoize,
  shallowEqual,
  deepEqual,
  measurePerformance,
  measureAsync,
  generateId,
  clamp,
  normalizeText,
  sanitizeFilename,
  hashString,
  groupBy,
  average,
  sum,
  statsSummary,
  calculateStreak,
  aggregateByTimeframe,
  getNoteName,
  positionFromNote,
  findBestFingering,
  sleep,
  retry,
  timeout,
  batchProcess,
  downloadJSON,
  downloadCSV,
  copyToClipboard,
  readJSONFile,
  DEVICE,
  pluralize,
  titleCase,
  truncate,
  slugify,
  getQueryParam,
  setQueryParam,
  getAllQueryParams,
  getHashRoute,
  setHashRoute,
  xpToLevel,
  levelToXP,
  levelProgress,
  calculateXPReward,
  getGradeColor,
  interpolateColor,
  isValidEmail,
  isValidURL,
  sanitizeHTML
};
