// js/utils/helpers.js
// ======================================
// VMQ UTILITIES HELPERS v3.0.1
// Music Theory + UX + Analytics + Safety
// ======================================

/**
 * Small internal helpers (not exported)
 */
function _clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function _safeNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function _escapeHTML(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * 🎵 MUSIC THEORY - Enhanced Violin/MIDI Production
 */
export const MUSIC = {
  NOTE_MAP: {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4,
    F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8,
    A: 9, 'A#': 10, Bb: 10, B: 11,
  },

  NOTE_NAMES_SHARP: ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],
  NOTE_NAMES_FLAT:  ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'],

  // Note → MIDI (C4=60)
  noteToMidi(note) {
    const match = String(note).trim().match(/^([A-G])([#b]?)(-?\d+)$/);
    if (!match) return null;
    const [, letter, accidental, oct] = match;
    const key = `${letter}${accidental || ''}`;
    const semitone = this.NOTE_MAP[key];
    if (semitone === undefined) return null;
    const octave = parseInt(oct, 10);
    return (octave + 1) * 12 + semitone;
  },

  // MIDI → Note name with octave (sharp spelling by default)
  midiToNote(midi, { preferFlats = false } = {}) {
    const m = Math.round(_safeNumber(midi, NaN));
    if (!Number.isFinite(m)) return null;
    const octave = Math.floor(m / 12) - 1;
    const pc = ((m % 12) + 12) % 12;
    const name = preferFlats ? this.NOTE_NAMES_FLAT[pc] : this.NOTE_NAMES_SHARP[pc];
    return `${name}${octave}`;
  },

  // MIDI → Frequency (A4=440Hz)
  midiToFreq(midi) {
    const m = _safeNumber(midi, NaN);
    if (!Number.isFinite(m)) return null;
    return 440 * Math.pow(2, (m - 69) / 12);
  },

  // Frequency → MIDI (nearest semitone)
  freqToMidi(freq) {
    const f = _safeNumber(freq, NaN);
    if (!Number.isFinite(f) || f <= 0) return null;
    return Math.round(69 + 12 * Math.log2(f / 440));
  },

  // Cents deviation from perfect pitch (targetMidi required)
  getCentsDeviation(freq, targetMidi) {
    const f = _safeNumber(freq, NaN);
    const t = _safeNumber(targetMidi, NaN);
    if (!Number.isFinite(f) || f <= 0 || !Number.isFinite(t)) return null;
    const actualMidi = 69 + 12 * Math.log2(f / 440);
    return Math.round((actualMidi - t) * 100);
  },

  // Violin open strings (G3=55, D4=62, A4=69, E5=76)
  VIOLIN_STRINGS: [55, 62, 69, 76],
  STRING_NAMES: ['G', 'D', 'A', 'E'],
  STRING_FREQS: [196.0, 293.66, 440.0, 659.25],

  // Position → Semitones (simple pedagogy model: 4 semitones per “position block”)
  positionToSemitones(pos, finger = 1) {
    const p = Math.max(1, Math.floor(_safeNumber(pos, 1)));
    const f = _clamp(Math.floor(_safeNumber(finger, 1)), 1, 4);
    const positionOffset = (p - 1) * 4;
    const fingerOffset = (f - 1);
    return positionOffset + fingerOffset;
  },

  // Semitones → Position + Finger (inverse of the simplified model)
  semitonesToPosition(semitones) {
    const s = Math.max(0, Math.floor(_safeNumber(semitones, 0)));
    const position = Math.floor(s / 4) + 1;
    const finger = (s % 4) + 1;
    return { position, finger };
  },

  // Get note for string + position + finger
  getNote(stringIdx, position, finger = 1, opts) {
    const si = Math.floor(_safeNumber(stringIdx, -1));
    if (si < 0 || si > 3) return null;
    const openString = this.VIOLIN_STRINGS[si];
    const semitones = this.positionToSemitones(position, finger);
    return this.midiToNote(openString + semitones, opts);
  },

  // Interval semitones → Name
  getIntervalName(semitones) {
    const s = Math.abs(Math.floor(_safeNumber(semitones, 0))) % 12;
    const intervals = {
      0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd',
      4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone',
      7: 'Perfect 5th', 8: 'Minor 6th', 9: 'Major 6th',
      10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave',
    };
    return intervals[s] || 'Unknown';
  },

  // Interval quality (for pedagogy)
  getIntervalQuality(semitones) {
    const mod = Math.abs(Math.floor(_safeNumber(semitones, 0))) % 12;
    if ([0, 5, 7].includes(mod)) return 'Perfect';
    if ([2, 4, 9, 11].includes(mod)) return 'Major';
    if ([1, 3, 8, 10].includes(mod)) return 'Minor';
    if (mod === 6) return 'Augmented/Diminished';
    return 'Unknown';
  },

  // Scale degree name
  getScaleDegree(degree) {
    const d = Math.floor(_safeNumber(degree, 0));
    const degrees = {
      1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant',
      5: 'Dominant', 6: 'Submediant', 7: 'Leading Tone',
    };
    return degrees[d] || 'Unknown';
  },

  // Chord quality from intervals (semitones above root, including 0)
  getChordQuality(intervals) {
    const sorted = [...(intervals || [])]
      .map(n => Math.floor(_safeNumber(n, 0)))
      .sort((a, b) => a - b);
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
      '0,3,6,9': 'Fully Diminished 7th',
    };
    return chords[pattern] || 'Unknown';
  },

  // Bieler Method: Hand frame validation (1–4 span)
  isValidHandFrame(finger1Midi, finger4Midi) {
    const a = _safeNumber(finger1Midi, NaN);
    const b = _safeNumber(finger4Midi, NaN);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const span = b - a;
    return span >= 4 && span <= 6;
  },

  // Heuristic: fingering difficulty score (lower is easier)
  getFingeringDifficulty(position, stringIdx /* 0..3 */, targetMidi) {
    const pos = Math.max(1, Math.floor(_safeNumber(position, 1)));
    const si = Math.floor(_safeNumber(stringIdx, 1));

    // position cost
    const positionCost = pos > 5 ? 3 : pos > 3 ? 2 : pos > 1 ? 1 : 0;

    // crossing cost (favor A/D strings slightly for beginners)
    const crossingCost = (si === 1 || si === 2) ? 0 : 1;

    // extension cost (very rough)
    let extensionCost = 0;
    const tm = _safeNumber(targetMidi, NaN);
    if (Number.isFinite(tm) && si >= 0 && si <= 3) {
      const open = this.VIOLIN_STRINGS[si];
      const semis = tm - open;
      const { finger } = this.semitonesToPosition(Math.max(0, semis));
      if (finger === 4 && pos <= 2) extensionCost = 1; // 4th finger in low positions
    }

    return positionCost + crossingCost + extensionCost;
  },
};

/**
 * Calculate interval distance between two frequencies (rounded semitones)
 */
export function calculateInterval(freq1, freq2) {
  const f1 = _safeNumber(freq1, NaN);
  const f2 = _safeNumber(freq2, NaN);
  if (!Number.isFinite(f1) || !Number.isFinite(f2) || f1 <= 0 || f2 <= 0) return null;
  return Math.round(12 * Math.log2(f2 / f1));
}

/**
 * Get interval name from semitone distance (standalone convenience)
 */
export function getIntervalName(semitones) {
  return MUSIC.getIntervalName(semitones);
}

/**
 * Check if pitch is within acceptable range of target (in cents)
 */
export function isPitchAccurate(actual, target, tolerance = 50) {
  const a = _safeNumber(actual, NaN);
  const t = _safeNumber(target, NaN);
  const tol = Math.max(0, _safeNumber(tolerance, 50));
  if (!Number.isFinite(a) || !Number.isFinite(t) || a <= 0 || t <= 0) return false;
  const cents = 1200 * Math.log2(a / t);
  return Math.abs(cents) <= tol;
}

/**
 * 🎯 DOM Helpers
 */
export function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = String(text);
  return el;
}
export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

/**
 * 🎲 Random + Shuffle
 */
export function getRandom(array, exclude = []) {
  if (!Array.isArray(array) || array.length === 0) return null;
  const ex = new Set(exclude);
  const valid = array.filter(x => !ex.has(x));
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

export function getRandomWeighted(items, weightFn) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const weights = items.map((it, i) => Math.max(0, _safeNumber(weightFn?.(it, i), 0)));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
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
 * ✅ Quiz helpers (implemented)
 */
export function getDistractors(correctValue, pool, count = 3, { avoidNear = true } = {}) {
  const c = correctValue;
  const n = Math.max(0, Math.floor(_safeNumber(count, 3)));
  const candidates = Array.isArray(pool) && pool.length ? [...new Set(pool)] : [];

  // If no pool provided, generate numeric distractors around the correct value.
  if (candidates.length === 0 && Number.isFinite(_safeNumber(c, NaN))) {
    const deltas = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
    for (const d of deltas) candidates.push(c + d);
  }

  const filtered = candidates.filter(v => v !== c && v != null);
  const safe = avoidNear && Number.isFinite(_safeNumber(c, NaN))
    ? filtered.filter(v => Math.abs(_safeNumber(v, 1e9) - c) >= 1)
    : filtered;

  return sample(safe.length ? safe : filtered, n);
}

export function optionsGrid(options, cols = 2) {
  const list = Array.isArray(options) ? options : [];
  const c = Math.max(1, Math.floor(_safeNumber(cols, 2)));
  const rows = [];
  for (let i = 0; i < list.length; i += c) rows.push(list.slice(i, i + c));
  return rows;
}

export function generateQuiz({
  prompt,
  correct,
  distractorPool = [],
  numOptions = 4,
  shuffleOptions = true,
  meta = {},
} = {}) {
  const n = Math.max(2, Math.floor(_safeNumber(numOptions, 4)));
  const distractors = getDistractors(correct, distractorPool, n - 1);
  let options = [correct, ...distractors];
  if (shuffleOptions) options = shuffle(options);

  return {
    id: generateId('quiz'),
    prompt: String(prompt ?? ''),
    correct,
    options,
    meta: { ...meta },
    createdAt: Date.now(),
  };
}

/**
 * 📊 Statistics
 */
export function accuracy(correct, total) {
  const c = _safeNumber(correct, 0);
  const t = _safeNumber(total, 0);
  return t > 0 ? Math.round((c / t) * 100) : 0;
}

export function grade(acc) {
  const a = _safeNumber(acc, 0);
  if (a >= 97) return 'S+';
  if (a >= 95) return 'S';
  if (a >= 90) return 'A';
  if (a >= 85) return 'B+';
  if (a >= 80) return 'B';
  if (a >= 75) return 'C+';
  if (a >= 70) return 'C';
  if (a >= 60) return 'D';
  return 'F';
}

export function streakGrade(streak) {
  const s = _safeNumber(streak, 0);
  if (s >= 100) return '👑 Legend';
  if (s >= 50) return '🏆 Champion';
  if (s >= 30) return '💎 Master';
  if (s >= 14) return '⭐ Expert';
  if (s >= 7) return '🔥 Strong';
  if (s >= 3) return '💪 Good';
  return '🌱 Starting';
}

export function mean(numbers) {
  const arr = Array.isArray(numbers) ? numbers : [];
  if (arr.length === 0) return 0;
  const sum = arr.reduce((s, n) => s + _safeNumber(n, 0), 0);
  return sum / arr.length;
}

export function median(numbers) {
  const arr = (Array.isArray(numbers) ? numbers : [])
    .map(n => _safeNumber(n, NaN))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

export function standardDeviation(numbers) {
  const arr = (Array.isArray(numbers) ? numbers : [])
    .map(n => _safeNumber(n, NaN))
    .filter(Number.isFinite);
  if (arr.length === 0) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(n => (n - avg) ** 2);
  return Math.sqrt(mean(squareDiffs));
}

export function percentile(numbers, p) {
  const arr = (Array.isArray(numbers) ? numbers : [])
    .map(n => _safeNumber(n, NaN))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const pp = _clamp(_safeNumber(p, 0), 0, 100);
  const idx = Math.ceil((pp / 100) * arr.length) - 1;
  return arr[_clamp(idx, 0, arr.length - 1)];
}

export function zScore(value, numbers) {
  const arr = (Array.isArray(numbers) ? numbers : [])
    .map(n => _safeNumber(n, NaN))
    .filter(Number.isFinite);
  const avg = mean(arr);
  const sd = standardDeviation(arr);
  const v = _safeNumber(value, 0);
  return sd === 0 ? 0 : (v - avg) / sd;
}

export function calculateTrend(values, windowSize = 5) {
  const arr = (Array.isArray(values) ? values : []).map(v => _safeNumber(v, NaN)).filter(Number.isFinite);
  const w = Math.max(2, Math.floor(_safeNumber(windowSize, 5)));
  if (arr.length < w) return 'insufficient_data';

  const recent = arr.slice(-w);
  const older = arr.slice(-w * 2, -w);
  if (older.length === 0) return 'neutral';

  const recentAvg = mean(recent);
  const olderAvg = mean(older);
  const change = olderAvg === 0 ? 0 : ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100;

  if (change > 10) return 'improving';
  if (change < -10) return 'declining';
  if (Math.abs(change) < 3) return 'plateau';
  return 'neutral';
}

export function detectPattern(data, patternFn) {
  const arr = Array.isArray(data) ? data : [];
  const fn = typeof patternFn === 'function' ? patternFn : null;
  if (!fn) return [];
  const patterns = [];
  for (let i = 0; i < arr.length; i++) {
    const p = fn(arr, i);
    if (p) patterns.push({ index: i, ...p });
  }
  return patterns;
}

export function movingAverage(values, windowSize = 3) {
  const arr = (Array.isArray(values) ? values : []).map(v => _safeNumber(v, NaN)).filter(Number.isFinite);
  const w = Math.max(1, Math.floor(_safeNumber(windowSize, 3)));
  if (arr.length <= w) return arr;
  const out = [];
  for (let i = 0; i <= arr.length - w; i++) out.push(mean(arr.slice(i, i + w)));
  return out;
}

export function exponentialMovingAverage(values, alpha = 0.3) {
  const arr = (Array.isArray(values) ? values : []).map(v => _safeNumber(v, NaN)).filter(Number.isFinite);
  const a = _clamp(_safeNumber(alpha, 0.3), 0.01, 0.99);
  if (arr.length === 0) return [];
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(a * arr[i] + (1 - a) * out[i - 1]);
  return out;
}

/**
 * 🧠 Learning analytics
 */
export function analyzeLearningCurve(sessions) {
  const s = Array.isArray(sessions) ? sessions : [];
  if (s.length < 3) return { stage: 'beginning', velocity: 0, prediction: null };

  const accuracies = s.map(x => _safeNumber(x?.accuracy, 0));
  const recentAccuracy = mean(accuracies.slice(-5));
  const earlierAccuracy = mean(accuracies.slice(0, 5));
  const velocity = recentAccuracy - earlierAccuracy;

  let stage = 'developing';
  if (recentAccuracy >= 90) stage = 'mastery';
  else if (recentAccuracy >= 75) stage = 'competent';
  else if (velocity > 10) stage = 'accelerating';
  else if (Math.abs(velocity) < 3 && s.length > 10) stage = 'plateau';

  let prediction = null;
  if (velocity > 0 && recentAccuracy < 90) {
    const sessionsNeeded = Math.ceil((90 - recentAccuracy) / (velocity / 5 || 1));
    prediction = {
      sessionsToMastery: Math.max(1, sessionsNeeded),
      estimatedDays: Math.ceil(sessionsNeeded / 2),
    };
  }

  return {
    stage,
    velocity: Math.round(velocity * 10) / 10,
    recentAccuracy: Math.round(recentAccuracy),
    trend: calculateTrend(accuracies),
    consistency: _clamp(100 - Math.round(standardDeviation(accuracies.slice(-10))), 0, 100),
    prediction,
  };
}

export function detectLearningPlateaus(sessions, threshold = 5) {
  const s = Array.isArray(sessions) ? sessions : [];
  const accuracies = s.map(x => _safeNumber(x?.accuracy, 0));
  const t = Math.max(3, Math.floor(_safeNumber(threshold, 5)));
  const plateaus = [];

  for (let i = t; i <= accuracies.length; i++) {
    const window = accuracies.slice(i - t, i);
    const variance = standardDeviation(window);
    const avg = mean(window);
    if (variance < 5 && avg < 85) {
      plateaus.push({ startIndex: i - t, endIndex: i - 1, accuracy: Math.round(avg), duration: t });
    }
  }
  return plateaus;
}

export function calculateMastery(moduleData) {
  const md = moduleData || {};
  const correct = _safeNumber(md.correct, 0);
  const total = _safeNumber(md.total, 0);
  const avgTime = _safeNumber(md.avgTime, 5000);
  const lastPracticed = _safeNumber(md.lastPracticed, 0);

  if (total < 5) return { level: 'novice', score: 0 };

  const accuracyScore = (correct / total) * 100;
  const volumeScore = Math.min(100, (total / 50) * 100);
  const speedScore = Math.max(0, 100 - (avgTime / 100));
  const recencyScore = Math.max(
    0,
    100 - ((Date.now() - lastPracticed) / (7 * 24 * 60 * 60 * 1000)) * 100
  );

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
  const s = Array.isArray(recentSessions) ? recentSessions : [];
  if (s.length < 3) return null;

  const accuracies = s.map(x => _safeNumber(x?.accuracy, 0));
  const smoothed = exponentialMovingAverage(accuracies, 0.4);
  const prediction = smoothed[smoothed.length - 1];
  const confidence = 100 - Math.min(100, standardDeviation(accuracies));

  return {
    predictedAccuracy: Math.round(prediction),
    confidence: Math.round(confidence),
    trend: calculateTrend(accuracies),
  };
}

/**
 * ⏱️ TIME formatting
 */
export function formatDuration(ms) {
  const v = Math.max(0, _safeNumber(ms, 0));
  const s = Math.floor(v / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatDurationShort(ms) {
  const v = Math.max(0, _safeNumber(ms, 0));
  const s = Math.floor(v / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

export function formatDate(timestamp) {
  const t = _safeNumber(timestamp, 0);
  const date = new Date(t);
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
  const t = _safeNumber(timestamp, 0);
  const diff = Date.now() - t;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(t);
}

export function getTimeOfDay(hour) {
  const h = Math.floor(_safeNumber(hour, new Date().getHours()));
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export function isToday(timestamp) {
  const t = _safeNumber(timestamp, 0);
  return new Date(t).toDateString() === new Date().toDateString();
}

export function isThisWeek(timestamp) {
  const t = _safeNumber(timestamp, 0);
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  return t >= weekAgo && t <= now;
}

/**
 * 🧰 General utilities (implemented)
 */
export function debounce(fn, wait = 150) {
  let t = null;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), Math.max(0, _safeNumber(wait, 150)));
  };
}

export function throttle(fn, wait = 150) {
  let last = 0;
  let t = null;
  return function throttled(...args) {
    const now = Date.now();
    const w = Math.max(0, _safeNumber(wait, 150));
    const remaining = w - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else if (!t) {
      t = setTimeout(() => {
        t = null;
        last = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };
}

export function memoize(fn, keyFn) {
  const cache = new Map();
  return function memoized(...args) {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const val = fn.apply(this, args);
    cache.set(key, val);
    return val;
  };
}

export function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!Object.prototype.hasOwnProperty.call(b, k) || !Object.is(a[k], b[k])) return false;
  return true;
}

export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (!a || !b || typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }

  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export function measurePerformance(label, fn) {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { label: label || 'measure', ms: Math.round(ms * 100) / 100, result };
}

export async function measureAsync(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { label: label || 'measureAsync', ms: Math.round(ms * 100) / 100, result };
}

export function generateId(prefix = 'id') {
  const p = String(prefix);
  if (crypto?.randomUUID) return `${p}_${crypto.randomUUID()}`;
  const rnd = Math.random().toString(16).slice(2);
  return `${p}_${Date.now().toString(16)}_${rnd}`;
}

export function clamp(n, min, max) {
  return _clamp(_safeNumber(n, 0), _safeNumber(min, 0), _safeNumber(max, 1));
}

export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function sanitizeFilename(name, replacement = '_') {
  const r = String(replacement);
  return String(name ?? 'file')
    .replace(/[\/\\?%*:|"<>]/g, r)
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashString(str) {
  // Simple non-crypto hash (fast) – for bucketing, not security
  const s = String(str ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function groupBy(items, keyFn) {
  const arr = Array.isArray(items) ? items : [];
  const fn = typeof keyFn === 'function' ? keyFn : (x) => x;
  return arr.reduce((acc, item) => {
    const k = fn(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

export function sum(numbers) {
  return (Array.isArray(numbers) ? numbers : []).reduce((s, n) => s + _safeNumber(n, 0), 0);
}

export function average(numbers) {
  const arr = Array.isArray(numbers) ? numbers : [];
  return arr.length ? sum(arr) / arr.length : 0;
}

export function statsSummary(numbers) {
  const arr = (Array.isArray(numbers) ? numbers : []).map(n => _safeNumber(n, NaN)).filter(Number.isFinite);
  if (arr.length === 0) return { count: 0, min: 0, max: 0, mean: 0, median: 0, sd: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    count: arr.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: mean(sorted),
    median: median(sorted),
    sd: standardDeviation(sorted),
  };
}

export function calculateStreak(events, { isSuccess = (e) => !!e?.success } = {}) {
  const arr = Array.isArray(events) ? events : [];
  let streak = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (isSuccess(arr[i])) streak += 1;
    else break;
  }
  return streak;
}

export function aggregateByTimeframe(items, getTime, { bucket = 'day' } = {}) {
  const arr = Array.isArray(items) ? items : [];
  const gt = typeof getTime === 'function' ? getTime : (x) => x?.timestamp;
  const fmt = (ts) => {
    const d = new Date(_safeNumber(ts, 0));
    if (bucket === 'week') {
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    if (bucket === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return groupBy(arr, (x) => fmt(gt(x)));
}

/**
 * 🎻 Note helpers (implemented)
 */
export function getNoteName(midi, { preferFlats = false } = {}) {
  return MUSIC.midiToNote(midi, { preferFlats });
}

export function positionFromNote(stringIdx, midi) {
  const si = Math.floor(_safeNumber(stringIdx, -1));
  const m = Math.floor(_safeNumber(midi, NaN));
  if (si < 0 || si > 3 || !Number.isFinite(m)) return null;
  const open = MUSIC.VIOLIN_STRINGS[si];
  const semis = Math.max(0, m - open);
  return MUSIC.semitonesToPosition(semis);
}

export function findBestFingering(targetMidi, { preferredString = null, maxPosition = 7 } = {}) {
  const tm = Math.floor(_safeNumber(targetMidi, NaN));
  if (!Number.isFinite(tm)) return null;

  const strings = [0, 1, 2, 3];
  const candidates = [];

  for (const si of strings) {
    if (preferredString != null && si !== preferredString) continue;
    const open = MUSIC.VIOLIN_STRINGS[si];
    const semis = tm - open;
    if (semis < 0) continue;

    const { position, finger } = MUSIC.semitonesToPosition(semis);
    if (position > Math.max(1, Math.floor(_safeNumber(maxPosition, 7)))) continue;

    candidates.push({
      stringIdx: si,
      stringName: MUSIC.STRING_NAMES[si],
      position,
      finger,
      difficulty: MUSIC.getFingeringDifficulty(position, si, tm),
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.difficulty - b.difficulty);
  return candidates[0];
}

/**
 * Async + resilience helpers
 */
export function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, _safeNumber(ms, 0))));
}

export async function retry(fn, { retries = 2, delayMs = 150 } = {}) {
  const r = Math.max(0, Math.floor(_safeNumber(retries, 2)));
  const d = Math.max(0, _safeNumber(delayMs, 150));
  let lastErr = null;
  for (let i = 0; i <= r; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (i < r) await sleep(d * (i + 1));
    }
  }
  throw lastErr;
}

export function timeout(promise, ms = 3000) {
  const t = Math.max(0, _safeNumber(ms, 3000));
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${t}ms`)), t)),
  ]);
}

export async function batchProcess(items, fn, { batchSize = 25, delayMs = 0 } = {}) {
  const arr = Array.isArray(items) ? items : [];
  const bs = Math.max(1, Math.floor(_safeNumber(batchSize, 25)));
  const out = [];
  for (let i = 0; i < arr.length; i += bs) {
    const chunk = arr.slice(i, i + bs);
    // eslint-disable-next-line no-await-in-loop
    const res = await Promise.all(chunk.map((x, idx) => fn(x, i + idx)));
    out.push(...res);
    if (delayMs > 0) await sleep(delayMs);
  }
  return out;
}

/**
 * Download / clipboard / file helpers
 */
export function downloadJSON(filename, data) {
  const name = sanitizeFilename(filename || 'data.json');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.endsWith('.json') ? name : `${name}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename, rows) {
  const name = sanitizeFilename(filename || 'data.csv');
  const arr = Array.isArray(rows) ? rows : [];
  const csv = arr.map(r => Array.isArray(r) ? r.map(x => `"${String(x ?? '').replaceAll('"', '""')}"`).join(',') : '').join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.endsWith('.csv') ? name : `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text) {
  const t = String(text ?? '');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(t);
    return true;
  }
  // Fallback
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.position = 'fixed';
  ta.style.left = '-10000px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) return reject(new Error('readJSONFile: expected File'));
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || 'null')));
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsText(file);
  });
}

/**
 * String helpers
 */
export function pluralize(n, singular, plural = null) {
  const num = _safeNumber(n, 0);
  return num === 1 ? singular : (plural ?? `${singular}s`);
}

export function titleCase(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function truncate(str, max = 120, ellipsis = '…') {
  const s = String(str ?? '');
  const m = Math.max(0, Math.floor(_safeNumber(max, 120)));
  if (s.length <= m) return s;
  return s.slice(0, Math.max(0, m - ellipsis.length)) + ellipsis;
}

export function slugify(str) {
  return normalizeText(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * URL / routing helpers
 */
export function getQueryParam(key, url = window.location.href) {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

export function setQueryParam(key, value, url = window.location.href) {
  const u = new URL(url);
  if (value == null) u.searchParams.delete(key);
  else u.searchParams.set(key, String(value));
  return u.toString();
}

export function getAllQueryParams(url = window.location.href) {
  try {
    const u = new URL(url);
    return Object.fromEntries(u.searchParams.entries());
  } catch {
    return {};
  }
}

export function getHashRoute() {
  const h = window.location.hash || '';
  return h.startsWith('#') ? h.slice(1) : h;
}

export function setHashRoute(route) {
  const r = String(route ?? '');
  window.location.hash = r.startsWith('#') ? r : `#${r}`;
}

/**
 * XP helpers (works with any XP_VALUES shape)
 */
export function xpToLevel(xp, thresholds = [0, 100, 250, 450, 700, 1000, 1400, 1900]) {
  const x = Math.max(0, Math.floor(_safeNumber(xp, 0)));
  let lvl = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (x >= thresholds[i]) lvl = i + 1;
  }
  return lvl;
}

export function levelToXP(level, thresholds = [0, 100, 250, 450, 700, 1000, 1400, 1900]) {
  const l = Math.max(1, Math.floor(_safeNumber(level, 1)));
  return thresholds[_clamp(l - 1, 0, thresholds.length - 1)];
}

export function levelProgress(xp, thresholds = [0, 100, 250, 450, 700, 1000, 1400, 1900]) {
  const x = Math.max(0, Math.floor(_safeNumber(xp, 0)));
  const lvl = xpToLevel(x, thresholds);
  const cur = levelToXP(lvl, thresholds);
  const next = levelToXP(lvl + 1, thresholds);
  const denom = Math.max(1, next - cur);
  return { level: lvl, withinLevel: x - cur, needed: next - x, pct: _clamp(((x - cur) / denom) * 100, 0, 100) };
}

export function calculateXPReward({ correct = false, speedMs = null, streak = 0 } = {}, XP_VALUES = null) {
  const base = _safeNumber(XP_VALUES?.answerCorrect ?? XP_VALUES?.correct ?? 10, 10);
  const wrong = _safeNumber(XP_VALUES?.answerWrong ?? XP_VALUES?.wrong ?? 0, 0);
  const speedBonus = _safeNumber(XP_VALUES?.speedBonus ?? 3, 3);
  const streakBonus = _safeNumber(XP_VALUES?.streakBonus ?? 1, 1);

  if (!correct) return Math.max(0, wrong);

  let xp = base;
  const s = _safeNumber(speedMs, NaN);
  if (Number.isFinite(s) && s > 0 && s < 2000) xp += speedBonus;
  xp += Math.min(10, Math.floor(_safeNumber(streak, 0) / 5)) * streakBonus;
  return Math.max(0, Math.floor(xp));
}

export function getGradeColor(letter) {
  const g = String(letter ?? '').toUpperCase();
  if (g.startsWith('S')) return '#7c3aed';
  if (g === 'A') return '#16a34a';
  if (g.startsWith('B')) return '#0ea5e9';
  if (g.startsWith('C')) return '#f59e0b';
  if (g === 'D') return '#f97316';
  return '#ef4444';
}

export function interpolateColor(a, b, t) {
  const tt = _clamp(_safeNumber(t, 0), 0, 1);
  const parse = (hex) => {
    const h = String(hex ?? '').replace('#', '').padEnd(6, '0').slice(0, 6);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * tt);
  const g = Math.round(g1 + (g2 - g1) * tt);
  const bb = Math.round(b1 + (b2 - b1) * tt);
  return `#${[r, g, bb].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

export function isValidEmail(email) {
  const s = String(email ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function isValidURL(url) {
  try {
    // eslint-disable-next-line no-new
    new URL(String(url ?? ''));
    return true;
  } catch {
    return false;
  }
}

export function sanitizeHTML(input) {
  // VMQ default: escape all. If you later want allowlists, do it centrally here.
  return _escapeHTML(input);
}

/**
 * Device info (safe, always defined)
 */
export const DEVICE = (() => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
    || (navigator.standalone === true);
  return { ua, isIOS, isAndroid, isSafari, isStandalone };
})();

/**
 * Default export (kept for older imports)
 */
export default {
  MUSIC,

  calculateInterval,
  getIntervalName,
  isPitchAccurate,

  createElement, $, $$,

  getRandom,
  getRandomWeighted,
  shuffle,
  sample,

  getDistractors,
  optionsGrid,
  generateQuiz,

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
  sanitizeHTML,
  DEVICE,
};