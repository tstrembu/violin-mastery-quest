// js/utils/helpers.js
// ======================================
// VMQ UTILITIES HELPERS v3.0.0 (CLEAN + COMPLETE)
// Music Theory + Quiz + Analytics + DOM + Perf + URL + Async
// ======================================

/* --------------------------------------
   Environment helpers
-------------------------------------- */
export const DEVICE = (() => {
  if (typeof window === 'undefined') return { isBrowser: false };
  const ua = navigator.userAgent || '';
  return {
    isBrowser: true,
    ua,
    isIOS: /iPad|iPhone|iPod/.test(ua),
    isAndroid: /Android/.test(ua),
    isMobile: /Mobi|Android|iPhone|iPad|iPod/.test(ua),
    prefersReducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
    prefersDarkMode: () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
  };
})();

/* --------------------------------------
   🎵 MUSIC THEORY - Enhanced Violin/MIDI
-------------------------------------- */
export const MUSIC = {
  // Note → MIDI (C4=60, G3=55, E5=76)
  noteToMidi(note) {
    const noteMap = {
      C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4,
      F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8,
      A: 9, 'A#': 10, Bb: 10, B: 11
    };
    if (typeof note !== 'string') return null;
    const match = note.trim().match(/^([A-G][#b]?)(-?\d+)$/);
    if (!match) return null;
    const [, noteName, octave] = match;
    const pc = noteMap[noteName];
    if (pc === undefined) return null;
    return (parseInt(octave, 10) + 1) * 12 + pc;
  },

  // MIDI → Note name with octave (sharp spelling)
  midiToNote(midi) {
    const n = Number(midi);
    if (!Number.isFinite(n)) return null;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(n / 12) - 1;
    const noteName = noteNames[((n % 12) + 12) % 12];
    return `${noteName}${octave}`;
  },

  // MIDI → Frequency (A4=440Hz)
  midiToFreq(midi) {
    const n = Number(midi);
    if (!Number.isFinite(n)) return 0;
    return 440 * Math.pow(2, (n - 69) / 12);
  },

  // Frequency → MIDI
  freqToMidi(freq) {
    const f = Number(freq);
    if (!Number.isFinite(f) || f <= 0) return null;
    return Math.round(69 + 12 * Math.log2(f / 440));
  },

  // Cents deviation from target MIDI
  getCentsDeviation(freq, targetMidi) {
    const f = Number(freq);
    const t = Number(targetMidi);
    if (!Number.isFinite(f) || f <= 0 || !Number.isFinite(t)) return 0;
    const actualMidi = 69 + 12 * Math.log2(f / 440);
    return Math.round((actualMidi - t) * 100);
  },

  // Violin open strings (G3=55, D4=62, A4=69, E5=76)
  VIOLIN_STRINGS: [55, 62, 69, 76],
  STRING_NAMES: ['G', 'D', 'A', 'E'],
  STRING_FREQS: [196.0, 293.66, 440.0, 659.25],

  // Position → Semitones (simple model)
  positionToSemitones(pos, finger = 1) {
    const p = Math.max(1, Math.floor(Number(pos) || 1));
    const f = Math.min(4, Math.max(1, Math.floor(Number(finger) || 1)));
    const positionOffset = (p - 1) * 4;
    const fingerOffset = (f - 1);
    return positionOffset + fingerOffset;
  },

  // Semitones → Position + Finger
  semitonesToPosition(semitones) {
    const s = Math.max(0, Math.floor(Number(semitones) || 0));
    const position = Math.floor(s / 4) + 1;
    const finger = (s % 4) + 1;
    return { position, finger };
  },

  // Get note for string + position + finger
  getNote(stringIdx, position, finger = 1) {
    const si = Number(stringIdx);
    if (!Number.isFinite(si) || si < 0 || si > 3) return null;
    const openString = this.VIOLIN_STRINGS[si];
    const semitones = this.positionToSemitones(position, finger);
    const midi = openString + semitones;
    return this.midiToNote(midi);
  },

  // Interval semitones → Name (method version)
  getIntervalName(semitones) {
    return getIntervalName(semitones);
  },

  // Interval quality
  getIntervalQuality(semitones) {
    const mod = ((Number(semitones) || 0) % 12 + 12) % 12;
    const perfect = [0, 5, 7];
    const major = [2, 4, 9, 11];
    const minor = [1, 3, 8, 10];

    if (perfect.includes(mod)) return 'Perfect';
    if (major.includes(mod)) return 'Major';
    if (minor.includes(mod)) return 'Minor';
    return mod === 6 ? 'Augmented/Diminished' : 'Unknown';
  },

  getScaleDegree(degree) {
    const degrees = {
      1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant',
      5: 'Dominant', 6: 'Submediant', 7: 'Leading Tone'
    };
    return degrees[Number(degree)] || 'Unknown';
  },

  getChordQuality(intervals) {
    if (!Array.isArray(intervals)) return 'Unknown';
    const sorted = [...intervals].map(n => Number(n)).filter(Number.isFinite).sort((a, b) => a - b);
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

  // Bieler frame validation (span in semitones)
  isValidHandFrame(f1Midi, f4Midi) {
    const a = Number(f1Midi), b = Number(f4Midi);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const span = b - a;
    return span >= 4 && span <= 6;
  },

  // Simple difficulty heuristic
  getFingeringDifficulty(position, stringIdx, targetMidi) {
    const pos = Number(position) || 1;
    const str = Number(stringIdx) || 0;

    const positionPenalty = pos > 3 ? 2 : pos > 1 ? 1 : 0;
    const stringCrossingPenalty = str !== 1 ? 1 : 0;

    // crude extension guess: if target note is far above open string
    let extensionPenalty = 0;
    const t = Number(targetMidi);
    if (Number.isFinite(t)) {
      const open = this.VIOLIN_STRINGS[Math.min(3, Math.max(0, str))];
      const span = t - open;
      if (span >= 10) extensionPenalty = 1;
      if (span >= 16) extensionPenalty = 2;
    }

    return positionPenalty + stringCrossingPenalty + extensionPenalty;
  }
};

/* --------------------------------------
   🎼 Interval utilities (standalone)
-------------------------------------- */

/**
 * Calculate interval distance between two frequencies in semitones.
 */
export function calculateInterval(freq1, freq2) {
  const f1 = Number(freq1), f2 = Number(freq2);
  if (!Number.isFinite(f1) || !Number.isFinite(f2) || f1 <= 0 || f2 <= 0) return 0;
  return Math.round(12 * Math.log2(f2 / f1));
}

/**
 * Single, canonical interval name exporter (no duplicates).
 */
export function getIntervalName(semitones) {
  const s = Math.abs(Math.round(Number(semitones) || 0));
  const mod = s % 12;

  const names = {
    0: 'Unison',
    1: 'Minor 2nd',
    2: 'Major 2nd',
    3: 'Minor 3rd',
    4: 'Major 3rd',
    5: 'Perfect 4th',
    6: 'Tritone',
    7: 'Perfect 5th',
    8: 'Minor 6th',
    9: 'Major 6th',
    10: 'Minor 7th',
    11: 'Major 7th'
  };

  if (s === 12) return 'Octave';
  if (s < 12) return names[mod] || 'Unknown';

  const octaves = Math.floor(s / 12);
  const rem = s % 12;
  const remName = rem === 0 ? '' : ` + ${names[rem] || 'Unknown'}`;
  return `${octaves} Octave${octaves > 1 ? 's' : ''}${remName}`;
}

export function isPitchAccurate(actual, target, tolerance = 50) {
  const a = Number(actual), t = Number(target), tol = Number(tolerance);
  if (!Number.isFinite(a) || !Number.isFinite(t) || a <= 0 || t <= 0) return false;
  const cents = 1200 * Math.log2(a / t);
  return Math.abs(cents) <= (Number.isFinite(tol) ? tol : 50);
}

/* --------------------------------------
   🎯 DOM helpers
-------------------------------------- */
export function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

export function $(sel, root = document) {
  return root?.querySelector?.(sel) ?? null;
}

export function $$(sel, root = document) {
  return Array.from(root?.querySelectorAll?.(sel) ?? []);
}

/* --------------------------------------
   🎲 Random + shuffle
-------------------------------------- */
export function getRandom(array, exclude = []) {
  if (!Array.isArray(array) || array.length === 0) return null;
  const ex = Array.isArray(exclude) ? exclude : [exclude];
  const valid = array.filter(item => !ex.includes(item));
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

export function getRandomWeighted(items, weightFn) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const fn = typeof weightFn === 'function' ? weightFn : (() => 1);
  const weights = items.map(i => Math.max(0, Number(fn(i)) || 0));
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
 * ✅ getDistractors: picks "count" plausible distractors from a pool,
 * avoiding the correct answer and anything in `exclude`.
 *
 * Works for strings, numbers, objects (by reference), etc.
 */
export function getDistractors(correct, pool, count = 3, exclude = []) {
  const ex = new Set([correct, ...(Array.isArray(exclude) ? exclude : [exclude])]);
  const source = Array.isArray(pool) ? pool : [];

  const candidates = source.filter(x => !ex.has(x));
  if (candidates.length <= count) return candidates;

  // Mild "plausibility": if numbers, prefer closer values
  if (typeof correct === 'number') {
    return candidates
      .map(v => ({ v, d: Math.abs(Number(v) - correct) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.max(count * 3, count))
      .map(o => o.v)
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  }

  return sample(candidates, count);
}

/* --------------------------------------
   📊 Stats
-------------------------------------- */
export function accuracy(correct, total) {
  const c = Number(correct) || 0;
  const t = Number(total) || 0;
  return t > 0 ? Math.round((c / t) * 100) : 0;
}

export function grade(acc) {
  const a = Number(acc) || 0;
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
  const s = Number(streak) || 0;
  if (s >= 100) return '👑 Legend';
  if (s >= 50) return '🏆 Champion';
  if (s >= 30) return '💎 Master';
  if (s >= 14) return '⭐ Expert';
  if (s >= 7) return '🔥 Strong';
  if (s >= 3) return '💪 Good';
  return '🌱 Starting';
}

export function sum(numbers) {
  if (!Array.isArray(numbers)) return 0;
  return numbers.reduce((s, n) => s + (Number(n) || 0), 0);
}

export function average(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

export function mean(numbers) {
  return average(numbers);
}

export function median(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sorted = [...numbers].map(n => Number(n)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function standardDeviation(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const vals = numbers.map(n => Number(n)).filter(Number.isFinite);
  if (!vals.length) return 0;
  const avg = mean(vals);
  const squareDiffs = vals.map(n => (n - avg) ** 2);
  return Math.sqrt(mean(squareDiffs));
}

export function percentile(numbers, p) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sorted = [...numbers].map(n => Number(n)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const pct = Math.min(100, Math.max(0, Number(p) || 0));
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

export function zScore(value, numbers) {
  const v = Number(value) || 0;
  const std = standardDeviation(numbers);
  if (std === 0) return 0;
  return (v - mean(numbers)) / std;
}

export function calculateTrend(values, windowSize = 5) {
  if (!Array.isArray(values) || values.length < windowSize) return 'insufficient_data';
  const recent = values.slice(-windowSize);
  const older = values.slice(-windowSize * 2, -windowSize);
  if (older.length === 0) return 'neutral';

  const recentAvg = mean(recent);
  const olderAvg = mean(older);
  if (olderAvg === 0) return 'neutral';

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  if (change > 10) return 'improving';
  if (change < -10) return 'declining';
  if (Math.abs(change) < 3) return 'plateau';
  return 'neutral';
}

export function detectPattern(data, patternFn) {
  if (!Array.isArray(data) || typeof patternFn !== 'function') return [];
  const patterns = [];
  for (let i = 0; i < data.length; i++) {
    const pattern = patternFn(data, i);
    if (pattern) patterns.push({ index: i, ...pattern });
  }
  return patterns;
}

export function movingAverage(values, windowSize = 3) {
  if (!Array.isArray(values) || values.length < windowSize) return Array.isArray(values) ? values : [];
  const result = [];
  for (let i = 0; i <= values.length - windowSize; i++) {
    result.push(mean(values.slice(i, i + windowSize)));
  }
  return result;
}

export function exponentialMovingAverage(values, alpha = 0.3) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const a = Math.min(1, Math.max(0, Number(alpha) || 0.3));
  const result = [Number(values[0]) || 0];
  for (let i = 1; i < values.length; i++) {
    const v = Number(values[i]) || 0;
    result.push(a * v + (1 - a) * result[i - 1]);
  }
  return result;
}

export function statsSummary(numbers = []) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, stdev: 0 };
  }
  const vals = numbers.map(n => Number(n)).filter(Number.isFinite);
  if (!vals.length) return { count: 0, min: 0, max: 0, mean: 0, median: 0, stdev: 0 };
  return {
    count: vals.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    mean: mean(vals),
    median: median(vals),
    stdev: standardDeviation(vals),
    p25: percentile(vals, 25),
    p75: percentile(vals, 75)
  };
}

/* --------------------------------------
   🧠 Learning analytics
-------------------------------------- */
export function analyzeLearningCurve(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 3) {
    return { stage: 'beginning', velocity: 0, prediction: null };
  }

  const accuracies = sessions.map(s => Number(s?.accuracy) || 0);
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
    const sessionsNeeded = Math.ceil((90 - recentAccuracy) / (velocity / 5 || 1));
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
    consistency: Math.max(0, 100 - Math.round(standardDeviation(accuracies.slice(-10)))),
    prediction
  };
}

export function detectLearningPlateaus(sessions, threshold = 5) {
  if (!Array.isArray(sessions) || sessions.length < threshold) return [];
  const accuracies = sessions.map(s => Number(s?.accuracy) || 0);
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
  const correct = Number(moduleData?.correct) || 0;
  const total = Number(moduleData?.total) || 0;
  const avgTime = Number(moduleData?.avgTime) || 5000;
  const lastPracticed = Number(moduleData?.lastPracticed) || 0;

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
  if (!Array.isArray(recentSessions) || recentSessions.length < 3) return null;
  const accuracies = recentSessions.map(s => Number(s?.accuracy) || 0);
  const smoothed = exponentialMovingAverage(accuracies, 0.4);
  const prediction = smoothed[smoothed.length - 1];
  const confidence = 100 - Math.min(100, standardDeviation(accuracies));
  return {
    predictedAccuracy: Math.round(prediction),
    confidence: Math.round(confidence),
    trend: calculateTrend(accuracies)
  };
}

/* --------------------------------------
   ⏱️ Time helpers
-------------------------------------- */
export function formatDuration(ms) {
  const n = Math.max(0, Number(ms) || 0);
  const s = Math.floor(n / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatDurationShort(ms) {
  const n = Math.max(0, Number(ms) || 0);
  const s = Math.floor(n / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDate(timestamp) {
  const t = Number(timestamp) || 0;
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
  const diff = Date.now() - (Number(timestamp) || 0);
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
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'day';
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export function isToday(timestamp) {
  const d = new Date(Number(timestamp) || 0);
  return d.toDateString() === new Date().toDateString();
}

export function isThisWeek(timestamp) {
  const t = Number(timestamp) || 0;
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  return t >= weekAgo && t <= now;
}

/* --------------------------------------
   🔧 Utility: clamp + text normalization
-------------------------------------- */
export function clamp(value, min, max) {
  const v = Number(value) || 0;
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return v;
  return Math.min(hi, Math.max(lo, v));
}

export function normalizeText(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize?.('NFKC') ?? String(text ?? '').trim().replace(/\s+/g, ' ');
}

export function sanitizeFilename(name) {
  return normalizeText(name)
    .replace(/[\/\\?%*:|"<>]/g, '-') // windows-illegal
    .replace(/\.+$/g, '')           // trailing dots
    .slice(0, 120) || 'file';
}

export function titleCase(str) {
  return normalizeText(str)
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function truncate(str, maxLen = 80) {
  const s = String(str ?? '');
  const m = Math.max(0, Number(maxLen) || 80);
  if (s.length <= m) return s;
  return s.slice(0, Math.max(0, m - 1)) + '…';
}

export function slugify(str) {
  return normalizeText(str)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function pluralize(word, n) {
  const count = Number(n) || 0;
  if (count === 1) return word;
  return word.endsWith('s') ? word : `${word}s`;
}

/* --------------------------------------
   🧩 Equality / memo helpers
-------------------------------------- */
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

  // Arrays
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }

  // Objects
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export function memoize(fn, keyFn) {
  const cache = new Map();
  const kf = typeof keyFn === 'function' ? keyFn : (...args) => JSON.stringify(args);
  return function (...args) {
    const key = kf(...args);
    if (cache.has(key)) return cache.get(key);
    const val = fn(...args);
    cache.set(key, val);
    return val;
  };
}

export function debounce(fn, wait = 150) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function throttle(fn, wait = 150) {
  let last = 0;
  let trailing = null;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(trailing);
      trailing = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/* --------------------------------------
   🧪 Performance helpers
-------------------------------------- */
export function measurePerformance(label, fn) {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { label, ms: Math.round(ms * 100) / 100, result };
}

export async function measureAsync(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { label, ms: Math.round(ms * 100) / 100, result };
}

/* --------------------------------------
   🆔 IDs + hashing
-------------------------------------- */
export function generateId(prefix = 'id') {
  const p = String(prefix || 'id');
  try {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return `${p}-${buf[0].toString(16)}${buf[1].toString(16)}`;
  } catch {
    return `${p}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }
}

// Fast stable hash (FNV-1a-ish)
export function hashString(str) {
  const s = String(str ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/* --------------------------------------
   🧺 Collections
-------------------------------------- */
export function groupBy(items, keyFn) {
  const fn = typeof keyFn === 'function' ? keyFn : (x) => x?.[keyFn];
  const out = {};
  for (const item of (items || [])) {
    const k = String(fn(item));
    (out[k] ||= []).push(item);
  }
  return out;
}

/**
 * Aggregate by timeframe (daily/weekly/monthly)
 * items must have .timestamp (ms) or .date (parseable)
 */
export function aggregateByTimeframe(items = [], timeframe = 'daily') {
  const tf = String(timeframe);
  const getKey = (t) => {
    const d = new Date(t);
    if (tf === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (tf === 'weekly') {
      // ISO-ish week key: year + weekNumber
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
      return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }
    // daily
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const buckets = {};
  for (const it of items) {
    const t = Number(it?.timestamp) || Date.parse(it?.date) || 0;
    const key = getKey(t);
    (buckets[key] ||= []).push(it);
  }
  return buckets;
}

/* --------------------------------------
   🎮 Streak helpers (generic)
-------------------------------------- */
export function calculateStreak(days = []) {
  // days = array of timestamps (ms) or Date-like values for completed practice days
  const set = new Set(
    (days || []).map(d => {
      const t = Number(d) || Date.parse(d) || 0;
      const dt = new Date(t);
      return dt.toDateString();
    })
  );

  let streak = 0;
  for (let i = 0; ; i++) {
    const dt = new Date(Date.now() - i * 86400000);
    if (set.has(dt.toDateString())) streak++;
    else break;
  }
  return streak;
}

/* --------------------------------------
   🎻 Violin mapping helpers
-------------------------------------- */
export function getNoteName(midi) {
  return MUSIC.midiToNote(midi);
}

export function positionFromNote(stringIdx, midi) {
  const si = Number(stringIdx);
  const m = Number(midi);
  if (!Number.isFinite(si) || !Number.isFinite(m) || si < 0 || si > 3) return null;
  const open = MUSIC.VIOLIN_STRINGS[si];
  const semis = m - open;
  if (semis < 0) return null;
  return MUSIC.semitonesToPosition(semis);
}

/**
 * Find best fingering (simple heuristic):
 * returns { stringIdx, position, finger, midi, note }
 */
export function findBestFingering(targetMidi) {
  const t = Number(targetMidi);
  if (!Number.isFinite(t)) return null;

  const candidates = [];
  for (let s = 0; s < 4; s++) {
    const open = MUSIC.VIOLIN_STRINGS[s];
    const semis = t - open;
    if (semis < 0) continue;

    const { position, finger } = MUSIC.semitonesToPosition(semis);
    const diff = MUSIC.getFingeringDifficulty(position, s, t);
    candidates.push({ stringIdx: s, position, finger, midi: t, note: MUSIC.midiToNote(t), difficulty: diff });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.difficulty - b.difficulty);
  const best = candidates[0];
  delete best.difficulty;
  return best;
}

/* --------------------------------------
   🧠 Quiz helpers
-------------------------------------- */
export function optionsGrid(options = [], columns = 2) {
  const cols = Math.max(1, Math.floor(Number(columns) || 2));
  const rows = [];
  for (let i = 0; i < options.length; i += cols) {
    rows.push(options.slice(i, i + cols));
  }
  return rows;
}

/**
 * generateQuiz({
 *   question: '...',
 *   correct: 'A',
 *   pool: [...],
 *   count: 4,
 *   shuffle: true
 * })
 */
export function generateQuiz({ question, correct, pool = [], count = 4, doShuffle = true, meta = {} } = {}) {
  const distractorCount = Math.max(0, (Number(count) || 4) - 1);
  const distractors = getDistractors(correct, pool, distractorCount);
  const options = [correct, ...distractors];
  const finalOptions = doShuffle ? shuffle(options) : options;

  return {
    id: generateId('quiz'),
    question: String(question ?? ''),
    correct,
    options: finalOptions,
    meta
  };
}

/* --------------------------------------
   🌐 URL + hash param helpers (router support)
-------------------------------------- */
export function getQueryParam(key, defaultValue = null, search = null) {
  const k = String(key ?? '');
  const params = new URLSearchParams(search ?? window.location.search);
  return params.get(k) ?? defaultValue;
}

export function setQueryParam(key, value, replace = true) {
  const k = String(key ?? '');
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === '') url.searchParams.delete(k);
  else url.searchParams.set(k, String(value));
  if (replace) window.history.replaceState({}, '', url.toString());
  else window.history.pushState({}, '', url.toString());
}

export function getAllQueryParams(search = null) {
  const params = new URLSearchParams(search ?? window.location.search);
  return Object.fromEntries(params.entries());
}

export function getHashRoute() {
  return decodeURIComponent((window.location.hash || '').replace(/^#/, '')) || '';
}

export function setHashRoute(route, replace = false) {
  const r = String(route ?? '');
  const encoded = `#${encodeURIComponent(r)}`;
  if (replace) window.location.replace(encoded);
  else window.location.hash = encoded;
}

/* --------------------------------------
   🎯 XP helpers (generic gamification)
-------------------------------------- */
export function xpToLevel(xp) {
  const x = Math.max(0, Number(xp) || 0);
  // simple curve: level^2 * 100
  return Math.floor(Math.sqrt(x / 100));
}

export function levelToXP(level) {
  const l = Math.max(0, Math.floor(Number(level) || 0));
  return l * l * 100;
}

export function levelProgress(xp) {
  const x = Math.max(0, Number(xp) || 0);
  const level = xpToLevel(x);
  const base = levelToXP(level);
  const next = levelToXP(level + 1);
  const pct = next === base ? 0 : Math.round(((x - base) / (next - base)) * 100);
  return { level, xp: x, nextXP: next, progressPct: clamp(pct, 0, 100) };
}

export function calculateXPReward({ correct = false, streak = 0, difficulty = 'medium', ms = 0 } = {}) {
  let xp = correct ? 10 : 2;
  const s = Number(streak) || 0;
  if (s >= 7) xp += 3;
  if (s >= 14) xp += 5;

  const diff = String(difficulty);
  if (diff === 'easy') xp += 0;
  if (diff === 'medium') xp += 2;
  if (diff === 'hard') xp += 5;

  const time = Number(ms) || 0;
  if (correct && time > 0) {
    // small bonus for faster correct answers
    const bonus = clamp(Math.round(3000 / time), 0, 3);
    xp += bonus;
  }

  return Math.max(1, xp);
}

/* --------------------------------------
   🎨 Color helpers
-------------------------------------- */
export function getGradeColor(acc) {
  const a = Number(acc) || 0;
  if (a >= 90) return '#16a34a';
  if (a >= 75) return '#2563eb';
  if (a >= 60) return '#f59e0b';
  return '#dc2626';
}

export function interpolateColor(hexA, hexB, t = 0.5) {
  const parse = (h) => {
    const s = String(h || '').replace('#', '');
    const v = s.length === 3
      ? s.split('').map(ch => ch + ch).join('')
      : s.padEnd(6, '0').slice(0, 6);
    const n = parseInt(v, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  const a = parse(hexA);
  const b = parse(hexB);
  const tt = clamp(t, 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * tt);
  const g = Math.round(a.g + (b.g - a.g) * tt);
  const bl = Math.round(a.b + (b.b - a.b) * tt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/* --------------------------------------
   ✅ Validation + sanitization
-------------------------------------- */
export function isValidEmail(email) {
  const s = String(email ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function isValidURL(url) {
  try {
    const u = new URL(String(url ?? ''));
    return !!u.protocol && !!u.host;
  } catch {
    return false;
  }
}

/**
 * Minimal safe HTML escaping (for user-generated text).
 */
export function sanitizeHTML(unsafe) {
  const s = String(unsafe ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* --------------------------------------
   ⏳ Async helpers
-------------------------------------- */
export function sleep(ms = 0) {
  return new Promise(res => setTimeout(res, Math.max(0, Number(ms) || 0)));
}

export async function timeout(promise, ms = 5000, message = 'Timed out') {
  const t = Math.max(0, Number(ms) || 0);
  let id;
  const timer = new Promise((_, rej) => {
    id = setTimeout(() => rej(new Error(message)), t);
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(id);
  }
}

export async function retry(fn, { retries = 2, delay = 200 } = {}) {
  let lastErr;
  const r = Math.max(0, Math.floor(Number(retries) || 0));
  for (let i = 0; i <= r; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < r) await sleep(delay);
    }
  }
  throw lastErr;
}

export async function batchProcess(items, handler, batchSize = 20) {
  const arr = Array.isArray(items) ? items : [];
  const fn = typeof handler === 'function' ? handler : async () => null;
  const size = Math.max(1, Math.floor(Number(batchSize) || 20));
  const results = [];
  for (let i = 0; i < arr.length; i += size) {
    const chunk = arr.slice(i, i + size);
    // eslint-disable-next-line no-await-in-loop
    const out = await Promise.all(chunk.map(fn));
    results.push(...out);
  }
  return results;
}

/* --------------------------------------
   📥 Download / Clipboard / File import
-------------------------------------- */
export function downloadJSON(data, filename = 'data.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const name = sanitizeFilename(filename.endsWith('.json') ? filename : `${filename}.json`);
  return downloadBlob(blob, name);
}

export function downloadCSV(rows, filename = 'data.csv') {
  const name = sanitizeFilename(filename.endsWith('.csv') ? filename : `${filename}.csv`);
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  return downloadBlob(blob, name);
}

function toCSV(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  // rows can be array of arrays or array of objects
  if (Array.isArray(rows[0])) {
    return rows.map(r => r.map(csvCell).join(',')).join('\n');
  }
  const keys = Object.keys(rows[0] || {});
  const header = keys.map(csvCell).join(',');
  const body = rows.map(obj => keys.map(k => csvCell(obj?.[k])).join(',')).join('\n');
  return `${header}\n${body}`;
}

function csvCell(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob, filename) {
  if (typeof document === 'undefined') return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  return true;
}

export async function copyToClipboard(text) {
  const s = String(text ?? '');
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.left = '-10000px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const f = file;
      if (!f) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result || 'null')));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('File read failed'));
      reader.readAsText(f);
    } catch (e) {
      reject(e);
    }
  });
}

/* --------------------------------------
   ✅ Default export (complete, no stubs)
-------------------------------------- */
export default {
  DEVICE,

  // Music
  MUSIC,
  calculateInterval,
  getIntervalName,
  isPitchAccurate,

  // DOM
  createElement,
  $,
  $$,

  // Random
  getRandom,
  getRandomWeighted,
  shuffle,
  sample,
  getDistractors,

  // Stats / analytics
  accuracy,
  grade,
  streakGrade,
  sum,
  average,
  mean,
  median,
  standardDeviation,
  percentile,
  zScore,
  statsSummary,
  calculateTrend,
  detectPattern,
  movingAverage,
  exponentialMovingAverage,
  analyzeLearningCurve,
  detectLearningPlateaus,
  calculateMastery,
  predictNextPerformance,

  // Time
  formatDuration,
  formatDurationShort,
  formatDate,
  formatRelativeTime,
  getTimeOfDay,
  isToday,
  isThisWeek,

  // Utility
  clamp,
  normalizeText,
  sanitizeFilename,
  titleCase,
  truncate,
  slugify,
  pluralize,

  // Equality / perf / memo
  shallowEqual,
  deepEqual,
  memoize,
  debounce,
  throttle,
  measurePerformance,
  measureAsync,

  // IDs/hashing
  generateId,
  hashString,

  // Collections
  groupBy,
  aggregateByTimeframe,
  calculateStreak,

  // Violin helpers
  getNoteName,
  positionFromNote,
  findBestFingering,

  // Quiz
  optionsGrid,
  generateQuiz,

  // URL/hash
  getQueryParam,
  setQueryParam,
  getAllQueryParams,
  getHashRoute,
  setHashRoute,

  // XP
  xpToLevel,
  levelToXP,
  levelProgress,
  calculateXPReward,

  // Color
  getGradeColor,
  interpolateColor,

  // Validation/sanitize
  isValidEmail,
  isValidURL,
  sanitizeHTML,

  // Async / IO
  sleep,
  retry,
  timeout,
  batchProcess,
  downloadJSON,
  downloadCSV,
  copyToClipboard,
  readJSONFile
};