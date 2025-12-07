// ======================================
// VMQ UTILITIES v2.0 - 50+ Module Production
// Music + AI + Performance Optimized
// ======================================

/**
 * 🎵 MUSIC THEORY - Violin/MIDI Production
 */
export const MUSIC = {
  // Note → MIDI (C4=60, G3=55, E5=76)
  noteToMidi(note) {
    const noteMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
      'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
      'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const match = note.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return null;
    const [, noteName, octave] = match;
    return (parseInt(octave) + 1) * 12 + noteMap[noteName];
  },

  // MIDI → Frequency (A4=440Hz)
  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  // Violin open strings (G3=55, D4=62, A4=69, E5=76)
  VIOLIN_STRINGS: [55, 62, 69, 76],
  STRING_NAMES: ['G3', 'D4', 'A4', 'E5'],

  // Position → Semitones (violin spacing)
  positionToSemitones(pos, finger = 1) {
    return (pos - 1) * 4 + (finger - 1) * 2;
  },

  // Interval quality
  getIntervalQuality(semitones) {
    const perfect = [0, 3, 4, 7];
    const majorMinor = [1, 2, 5, 6, 8, 10];
    if (perfect.includes(semitones)) return 'Perfect';
    if (majorMinor.includes(semitones)) return semitones <= 6 ? 'Major' : 'Minor';
    return 'Augmented/Diminished';
  }
};

/**
 * 🎯 CORE VMQ - Random + Shuffle (50+ modules)
 */
export function getRandom(array, exclude = []) {
  const valid = array.filter(item => !exclude.includes(item));
  return valid[Math.floor(Math.random() * valid.length)];
}

export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 📊 AI STATS - SM-2 + Analytics Production
 */
export function accuracy(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export function grade(accuracy) {
  return accuracy >= 95 ? 'S' : accuracy >= 90 ? 'A' : accuracy >= 85 ? 'B' :
         accuracy >= 80 ? 'C' : accuracy >= 70 ? 'D' : 'F';
}

export function streakGrade(streak) {
  return streak >= 30 ? '🏆 Master' : streak >= 14 ? '⭐ Pro' : 
         streak >= 7 ? '🔥 Hot' : streak >= 3 ? '💪 Good' : 'New';
}

/**
 * ⏱️ TIME - Journal + Session Production
 */
export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (date.toDateString() === today) return 'Today';
  if (date.toDateString() === yesterday) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * 🎮 GAME - VMQ Production (Snapshot/SpeedDrill)
 */
export function getDistractors(correct, pool, count = 3) {
  return shuffle(pool.filter(n => n !== correct)).slice(0, count);
}

export function optionsGrid(correct, distractors) {
  return shuffle([correct, ...distractors]);
}

/**
 * 🚀 PERFORMANCE - React + 50+ modules
 */
export function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

export function throttle(fn, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function shallowEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every(key => obj1[key] === obj2[key]);
}

/**
 * 💾 STORAGE - Journal + SM-2 Production
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * 📈 VMQ ANALYTICS - Coach + Dashboard
 */
export function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function average(numbers) {
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
}

export function statsSummary(data) {
  const accs = data.map(d => d.accuracy || 0).filter(a => a > 0);
  return {
    avgAccuracy: Math.round(average(accs)),
    best: Math.max(...accs),
    sessions: data.length,
    totalTime: data.reduce((sum, d) => sum + (d.engagedMs || 0), 0)
  };
}

/**
 * 🎵 VIOLIN PRODUCTION - NoteLocator/Fingerboard
 */
export function getNoteName(stringIdx, position, finger = 1) {
  const open = MUSIC.VIOLIN_STRINGS[stringIdx];
  const semitones = MUSIC.positionToSemitones(position, finger);
  const midi = open + semitones;
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return noteNames[midi % 12];
}

export function positionFromNote(noteMidi, stringIdx) {
  const open = MUSIC.VIOLIN_STRINGS[stringIdx];
  const semitones = noteMidi - open;
  const pos = Math.floor(semitones / 4) + 1;
  return clamp(pos, 1, 5);
}

/**
 * 🚀 ASYNC - Production retry + sleep
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function retry(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); }
    catch (e) { if (i === maxAttempts - 1) throw e; await sleep(1000 * (i + 1)); }
  }
}

/**
 * 💾 EXPORT - Journal + DataManager
 */
export function downloadJSON(data, filename) {
  const str = JSON.stringify(data, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text; el.style.opacity = '0';
    document.body.appendChild(el); el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

/**
 * 🎯 VMQ UX - Mobile + Accessibility
 */
export const DEVICE = {
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent),
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
  isTouch: 'ontouchstart' in window
};

export function pluralize(count, singular, plural = null) {
  return `${count} ${count === 1 ? singular : (plural || singular + 's')}`;
}

export function titleCase(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * 🔗 ROUTING - Hash + Query Production
 */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function setQueryParam(name, value) {
  const url = new URL(window.location);
  url.searchParams.set(name, value);
  window.history.replaceState({}, '', url);
}

/**
 * 🎮 VMQ GAMIFICATION - XP + Levels
 */
export function xpToLevel(xp) {
  return Math.floor(xp / 1000) + 1;
}

export function levelProgress(currentXp) {
  const level = xpToLevel(currentXp);
  const levelStart = (level - 1) * 1000;
  const levelEnd = level * 1000;
  return Math.round(((currentXp - levelStart) / (levelEnd - levelStart)) * 100);
}