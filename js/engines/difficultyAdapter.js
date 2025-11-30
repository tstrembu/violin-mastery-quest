// ========================================================
// VMQ DIFFICULTY ADAPTER - Production Version
// Manages difficulty levels with robust error handling
// ========================================================

import { STORAGE_KEYS, loadJSON, saveJSON } from '../config/storage.js';
import { 
  INTERVAL_DEFINITIONS, 
  RHYTHM_PATTERNS, 
  NOTES, 
  NATURAL_NOTES,
  SHARP_NOTES,
  FLAT_NOTES,
  BIELER_VOCAB,
  KEY_SIGNATURES
} from '../config/constants.js';

/**
 * Difficulty settings for each mode
 */
export const DIFFICULTY_SETTINGS = {
  intervals: {
    easy: {
      label: 'Easy',
      description: 'Perfect intervals and 3rds',
      items: ['P4', 'P5', 'm3', 'M3', 'P8'],
      speedMultiplier: 0.6  // ✨ Slower for Cooper (was 0.8)
    },
    medium: {
      label: 'Medium',
      description: 'All common intervals',
      items: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'],
      speedMultiplier: 0.8  // ✨ Adjustable
    },
    hard: {
      label: 'Hard',
      description: 'All intervals including 7ths',
      items: null,
      speedMultiplier: 1.0
    }
  },

  rhythm: {
    easy: {
      label: 'Easy',
      description: 'Simple patterns, slow tempo',
      items: ['quarters', 'eighths', 'quarter-eighths'],
      bpmRange: [60, 90]
    },
    medium: {
      label: 'Medium',
      description: 'Dotted rhythms, moderate tempo',
      items: ['quarters', 'eighths', 'quarter-eighths', 'dotted-1', 'sixteenths', 'eighth-sixteenths'],
      bpmRange: [80, 120]
    },
    hard: {
      label: 'Hard',
      description: 'All patterns, faster tempo',
      items: null,
      bpmRange: [100, 160]
    }
  },

  flashcards: {
    easy: {
      label: 'Easy',
      description: 'Natural notes only',
      items: NATURAL_NOTES
    },
    medium: {
      label: 'Medium',
      description: 'Sharps and flats',
      items: [...NATURAL_NOTES, ...SHARP_NOTES]
    },
    hard: {
      label: 'Hard',
      description: 'All notes including enharmonics',
      items: null
    }
  },

  bieler: {
    easy: {
      label: 'Easy',
      description: 'Basic strokes and tempo markings',
      categories: ['bow_basic', 'tempo'],
      itemCount: 10
    },
    medium: {
      label: 'Medium',
      description: 'Advanced strokes and left hand',
      categories: ['bow_basic', 'bow_articulated', 'left_hand', 'tempo', 'dynamics'],
      itemCount: 15
    },
    hard: {
      label: 'Hard',
      description: 'All technique vocabulary',
      categories: null,
      itemCount: null
    }
  },

  keySignatures: {
    easy: {
      label: 'Easy',
      description: 'C, G, D, F major (Level 1)',
      items: ['C_major', 'G_major', 'D_major', 'F_major']
    },
    medium: {
      label: 'Medium',
      description: 'All Level 1 keys',
      items: ['C_major', 'G_major', 'D_major', 'A_major', 'F_major', 'Bb_major']
    },
    hard: {
      label: 'Hard',
      description: 'All keys including relative minors',
      items: null
    }
  }
};

export function getDifficulty(modeName) {
  try {
    const difficulties = loadJSON(STORAGE_KEYS.DIFFICULTY, {});
    return difficulties[modeName] || 'easy';
  } catch (err) {
    console.warn('Failed to load difficulty, using easy:', err);
    return 'easy';
  }
}

export function setDifficulty(modeName, level) {
  try {
    const difficulties = loadJSON(STORAGE_KEYS.DIFFICULTY, {});
    difficulties[modeName] = level;
    saveJSON(STORAGE_KEYS.DIFFICULTY, difficulties);
  } catch (err) {
    console.error('Failed to save difficulty:', err);
  }
}

export function getItemPool(modeName, allItems) {
  const level = getDifficulty(modeName);
  const settings = DIFFICULTY_SETTINGS[modeName];
  
  if (!settings || !settings[level]) {
    return allItems;
  }

  const config = settings[level];

  // No restriction: use full set
  if (!config.items) {
    return allItems;
  }

  // If items are primitive values (e.g. note names as strings)
  const first = allItems[0];
  if (typeof first !== 'object' || first === null) {
    return allItems.filter(item => config.items.includes(item));
  }

  // Default: objects with .id fields
  return allItems.filter(item => config.items.includes(item.id));
}

export function getBielerPool(level) {
  const config = DIFFICULTY_SETTINGS.bieler[level];
  
  if (!config) {
    return BIELER_VOCAB;
  }

  if (!config.categories) {
    return BIELER_VOCAB;
  }

  let filtered = BIELER_VOCAB.filter(item => 
    config.categories.includes(item.category)
  );

  if (config.itemCount && filtered.length > config.itemCount) {
    filtered = filtered.slice(0, config.itemCount);
  }

  return filtered;
}

export function getBpmRange(level) {
  const config = DIFFICULTY_SETTINGS.rhythm[level];
  return config?.bpmRange || [60, 120];
}

export function getSpeedMultiplier(level) {
  const config = DIFFICULTY_SETTINGS.intervals[level];
  return config?.speedMultiplier || 1.0;
}

export function autoAdjustDifficulty(modeName, recentAccuracy, questionCount) {
  if (questionCount < 10) {
    return null;
  }

  const currentLevel = getDifficulty(modeName);
  let newLevel = null;

  if (recentAccuracy >= 85 && currentLevel === 'easy') {
    newLevel = 'medium';
  } else if (recentAccuracy >= 90 && currentLevel === 'medium') {
    newLevel = 'hard';
  } else if (recentAccuracy < 40 && currentLevel === 'hard') {
    newLevel = 'medium';
  } else if (recentAccuracy < 35 && currentLevel === 'medium') {
    newLevel = 'easy';
  }

  if (newLevel && newLevel !== currentLevel) {
    setDifficulty(modeName, newLevel);
    return newLevel;
  }

  return null;
}

export function getDifficultyInfo(modeName) {
  const level = getDifficulty(modeName);
  const config = DIFFICULTY_SETTINGS[modeName]?.[level];

  return {
    level,
    label: config?.label || level,
    description: config?.description || ''
  };
}
