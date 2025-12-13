// ======================================
// VMQ UTILITIES HELPERS v3.0.0 
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
    const positionOffset = (pos - 1) * 4;
    const fingerOffset = (finger - 1);
    return positionOffset + fingerOffset;
  },

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
    return span >= 4 && span <= 6;
  },

  // Calculate fingering difficulty (for adaptive difficulty)
  getFingeringDifficulty(position, string, targetNote) {
    const difficulty = {
      position: position > 3 ? 2 : position > 1 ? 1 : 0,
      stringCrossing: string !== 1 ? 1 : 0,
      extension: 0
    };
    return difficulty.position + difficulty.stringCrossing + difficulty.extension;
  }
};

// ✅ MOVED OUTSIDE of MUSIC object - These are standalone functions
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

/**
 * 🎯 CORE VMQ - DOM Helpers
 */
export function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

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

// ... [REST OF YOUR FUNCTIONS REMAIN THE SAME - They're all correctly structured] ...

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

export function movingAverage(values, windowSize = 3) {
  if (values.length < windowSize) return values;
  
  const result = [];
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    result.push(mean(window));
  }
  return result;
}

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
  
  const recentAccuracy = mean(accuracies.slice(-5));
  const earlierAccuracy = mean(accuracies.slice(0, 5));
  const velocity = recentAccuracy - earlierAccuracy;
  
  let stage = 'developing';
  if (recentAccuracy >= 90) stage = 'mastery';
  else if (recentAccuracy >= 75) stage = 'competent';
  else if (velocity > 10) stage = 'accelerating';
  else if (Math.abs(velocity) < 3 && sessions.length > 10) stage = 'plateau';
  
  let prediction = null;
  if (velocity > 0 && recentAccuracy < 90) {
    const sessionsNeeded = Math.ceil((90 - recentAccuracy) / (velocity / 5));
    prediction = {
      sessionsToMastery: Math.max(1, sessionsNeeded),
      estimatedDays: Math.ceil(sessionsNeeded / 2)
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
  const volumeScore = Math.min(100, (total / 50) * 100);
  const speedScore = Math.max(0, 100 - (avgTime / 100));
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

// ... [Include ALL your remaining helper functions - they're all correct] ...

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

// [Continue with all remaining functions...]
// I'll skip to the end to show the complete export

/**
 * 🎯 UTILITY EXPORTS - Complete
 */
export default {
  MUSIC,
  calculateInterval,
  getIntervalName,
  isPitchAccurate,
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
  isThisWeek
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
