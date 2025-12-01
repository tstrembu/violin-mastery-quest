// ========================================================
// VMQ CONSTANTS - All Pedagogical Content
// Source: Ida Bieler Method, Cooper's Guide, Suzuki Method
// ========================================================

// -------------------- NOTES --------------------

export const NOTES = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 
  'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
];

export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SHARP_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];
export const FLAT_NOTES = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];

export const NOTE_ALIASES = {
  'c': 'C', 'c#': 'C#', 'c sharp': 'C#', 'csharp': 'C#', 'c♯': 'C#',
  'db': 'Db', 'd flat': 'Db', 'dflat': 'Db', 'd♭': 'Db',
  'd': 'D', 'd#': 'D#', 'd sharp': 'D#', 'dsharp': 'D#', 'd♯': 'D#',
  'eb': 'Eb', 'e flat': 'Eb', 'eflat': 'Eb', 'e♭': 'Eb',
  'e': 'E',
  'f': 'F', 'f#': 'F#', 'f sharp': 'F#', 'fsharp': 'F#', 'f♯': 'F#',
  'gb': 'Gb', 'g flat': 'Gb', 'gflat': 'Gb', 'g♭': 'Gb',
  'g': 'G', 'g#': 'G#', 'g sharp': 'G#', 'gsharp': 'G#', 'g♯': 'G#',
  'ab': 'Ab', 'a flat': 'Ab', 'aflat': 'Ab', 'a♭': 'Ab',
  'a': 'A', 'a#': 'A#', 'a sharp': 'A#', 'asharp': 'A#', 'a♯': 'A#',
  'bb': 'Bb', 'b flat': 'Bb', 'bflat': 'Bb', 'b♭': 'Bb',
  'b': 'B'
};

// -------------------- INTERVALS --------------------

export const INTERVAL_DEFINITIONS = [
  { 
    id: 'm2', 
    name: 'minor 2nd', 
    label: 'Minor 2nd',
    semitones: 1,
    commonIn: 'Chromatic scales, leading tones',
    example: 'E–F, B–C'
  },
  { 
    id: 'M2', 
    name: 'major 2nd', 
    label: 'Major 2nd',
    semitones: 2,
    commonIn: 'Most scales, melodies',
    example: 'C–D, G–A'
  },
  { 
    id: 'm3', 
    name: 'minor 3rd', 
    label: 'Minor 3rd',
    semitones: 3,
    commonIn: 'Minor keys, sad melodies',
    example: 'A–C (A minor)'
  },
  { 
    id: 'M3', 
    name: 'major 3rd', 
    label: 'Major 3rd',
    semitones: 4,
    commonIn: 'Major keys, bright sounds',
    example: 'C–E (C major)'
  },
  { 
    id: 'P4', 
    name: 'perfect 4th', 
    label: 'Perfect 4th',
    semitones: 5,
    commonIn: 'Position changes, tuning',
    example: 'G–C, D–G'
  },
  { 
    id: 'P5', 
    name: 'perfect 5th', 
    label: 'Perfect 5th',
    semitones: 7,
    commonIn: 'Open string tuning, shifts',
    example: 'G–D, D–A, A–E'
  },
  { 
    id: 'M6', 
    name: 'major 6th', 
    label: 'Major 6th',
    semitones: 9,
    commonIn: 'Wide melodies, leaps',
    example: 'C–A'
  },
  { 
    id: 'm7', 
    name: 'minor 7th', 
    label: 'Minor 7th',
    semitones: 10,
    commonIn: 'Dominant chords, tension',
    example: 'G–F (in C major)'
  },
  { 
    id: 'P8', 
    name: 'octave', 
    label: 'Octave',
    semitones: 12,
    commonIn: 'Position shifts, scales',
    example: 'Any note to same note higher'
  }
];

export const ROOT_NOTES = [
  { note: 'G', midi: 55 },
  { note: 'A', midi: 57 },
  { note: 'B', midi: 59 },
  { note: 'C', midi: 60 },
  { note: 'D', midi: 62 },
  { note: 'E', midi: 64 },
  { note: 'F', midi: 65 },
  { note: 'G', midi: 67 }
];

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// -------------------- RHYTHM PATTERNS --------------------

export const RHYTHM_PATTERNS = [
  {
    id: 'quarters',
    pattern: '♩ ♩ ♩ ♩',
    description: 'Four quarter notes',
    appearsIn: 'Twinkle variations, French Folk Song',
    difficulty: 'easy',
    bpmRange: [60, 100]
  },
  {
    id: 'eighths',
    pattern: '♪♪ ♪♪ ♪♪ ♪♪',
    description: 'Eighth note pairs',
    appearsIn: 'Allegro, Perpetual Motion',
    difficulty: 'easy',
    bpmRange: [70, 120]
  },
  {
    id: 'quarter-eighths',
    pattern: '♩ ♪♪',
    description: 'Quarter and two eighths',
    appearsIn: 'Long Long Ago',
    difficulty: 'easy',
    bpmRange: [60, 100]
  },
  {
    id: 'dotted-1',
    pattern: '♩. ♪',
    description: 'Dotted quarter–eighth',
    appearsIn: 'Gavotte (Gossec), Humoresque',
    difficulty: 'medium',
    bpmRange: [72, 120]
  },
  {
    id: 'sixteenths',
    pattern: '♬♬♬♬',
    description: 'Four sixteenths',
    appearsIn: 'Bach A-minor Concerto',
    difficulty: 'medium',
    bpmRange: [60, 100]
  },
  {
    id: 'eighth-sixteenths',
    pattern: '♪ ♬♬',
    description: 'Eighth and two sixteenths',
    appearsIn: 'Vivaldi Concertos',
    difficulty: 'medium',
    bpmRange: [80, 120]
  },
  {
    id: 'triplet',
    pattern: '♪♪♪',
    description: 'Eighth note triplet',
    appearsIn: 'Kreutzer études, orchestra',
    difficulty: 'hard',
    bpmRange: [60, 140]
  },
  {
    id: 'syncopated',
    pattern: '♪ ♩ ♪',
    description: 'Off-beat syncopation',
    appearsIn: 'Contemporary pieces',
    difficulty: 'hard',
    bpmRange: [80, 140]
  },
  {
    id: 'dotted-sixteenths',
    pattern: '♬. ♬♬',
    description: 'Dotted sixteenth pattern',
    appearsIn: 'Virtuoso pieces, caprices',
    difficulty: 'hard',
    bpmRange: [60, 120]
  }
];

// -------------------- KEY SIGNATURES --------------------

export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export const KEY_SIGNATURES = [
  {
    id: 'C_major',
    major: 'C Major',
    minor: 'A minor',
    accidentals: 0,
    type: 'natural',
    handMap: {
      G: 'high2',
      D: 'low2',
      A: 'low2',
      E: 'low1'
    },
    openStrings: ['G', 'D', 'A', 'E'],
    appearsIn: 'Most Suzuki Book 1-2, simple pieces',
    difficulty: 'easy'
  },
  {
    id: 'G_major',
    major: 'G Major',
    minor: 'E minor',
    accidentals: 1,
    type: 'sharp',
    sharps: ['F'],
    handMap: {
      G: 'high2',
      D: 'high2',
      A: 'low2',
      E: 'low2'
    },
    openStrings: ['G', 'D', 'A', 'E'],
    appearsIn: 'Allegro, Perpetual Motion, May Song',
    difficulty: 'easy'
  },
  {
    id: 'D_major',
    major: 'D Major',
    minor: 'B minor',
    accidentals: 2,
    type: 'sharp',
    sharps: ['F', 'C'],
    handMap: {
      G: 'high2',
      D: 'high2',
      A: 'high2',
      E: 'low2'
    },
    openStrings: ['D', 'A'],
    appearsIn: 'Chorus from Judas Maccabaeus, Book 2+',
    difficulty: 'easy'
  },
  {
    id: 'A_major',
    major: 'A Major',
    minor: 'F♯ minor',
    accidentals: 3,
    type: 'sharp',
    sharps: ['F', 'C', 'G'],
    handMap: {
      G: 'high2',
      D: 'high2',
      A: 'high2',
      E: 'high2'
    },
    openStrings: ['A', 'E'],
    appearsIn: 'Kreutzer études, orchestra parts',
    difficulty: 'medium'
  },
  {
    id: 'F_major',
    major: 'F Major',
    minor: 'D minor',
    accidentals: -1,
    type: 'flat',
    flats: ['B'],
    handMap: {
      G: 'low2',
      D: 'low2',
      A: 'low1',
      E: 'low1'
    },
    openStrings: ['G', 'D'],
    appearsIn: 'Orchestra parts, Book 3+',
    difficulty: 'easy'
  },
  {
    id: 'Bb_major',
    major: 'B♭ Major',
    minor: 'G minor',
    accidentals: -2,
    type: 'flat',
    flats: ['B', 'E'],
    handMap: {
      G: 'low2',
      D: 'low2',
      A: 'low2',
      E: 'low1'
    },
    openStrings: ['G', 'D'],
    appearsIn: 'Orchestra, Book 4+',
    difficulty: 'medium'
  }
];

// -------------------- BIELER VOCABULARY --------------------

export const BIELER_VOCAB = [
  {
    term: 'détaché',
    definition: 'Separate bow strokes played with relaxed right hand using natural arm weight and good contact between bow and string. The fundamental stroke for all violin playing.',
    acceptableAnswers: ['separate bow', 'basic stroke', 'single bow strokes'],
    category: 'bow_basic',
    trainedFunction: 'right_hand',
    difficulty: 'easy',
    appearsIn: 'Kreutzer No. 2, all repertoire'
  },
  {
    term: 'legato',
    definition: 'Smoothly connected notes under one bow. Smooth bow changes require decreasing bow speed just before the direction change while maintaining good string contact.',
    acceptableAnswers: ['smooth', 'connected', 'slurred'],
    category: 'bow_basic',
    trainedFunction: 'right_hand',
    difficulty: 'easy',
    appearsIn: 'Suzuki Book 1, most music'
  },
  {
    term: 'martelé',
    definition: 'Sharp articulated stroke in the upper half using flat hair and fast bow speed. The bow catches the string like collé then releases with the natural weight of the relaxed arm.',
    acceptableAnswers: ['hammered', 'sharp stroke', 'articulated'],
    category: 'bow_articulated',
    trainedFunction: 'right_hand',
    difficulty: 'medium',
    appearsIn: 'Kreutzer No. 7'
  },
  {
    term: 'collé',
    definition: 'Precise placement and pinching of the string with the bow using gripping stretching movements of the fingers. Can be silent placement only or articulated with pizzicato-like sound.',
    acceptableAnswers: ['pinch', 'grip', 'bow placement'],
    category: 'bow_articulated',
    trainedFunction: 'right_hand',
    difficulty: 'medium',
    appearsIn: 'Control exercises'
  },
  {
    term: 'spiccato',
    definition: 'Light bouncing stroke in the lower half that lifts from the string. Evolves from détaché by turning the wood of the bow out while using whole-arm motion from the shoulder.',
    acceptableAnswers: ['bouncing', 'off string', 'bounced bow'],
    category: 'bow_off_string',
    trainedFunction: 'right_hand',
    difficulty: 'medium',
    appearsIn: 'Kreutzer No. 2 variations'
  },
  {
    term: 'sautillé',
    definition: 'Virtuoso springing bow stroke produced by fast vertical flicking motion from the wrist. Light articulation uses outside of hair, stronger uses flat hair.',
    acceptableAnswers: ['springing', 'fast spiccato', 'bouncing fast'],
    category: 'bow_off_string',
    trainedFunction: 'right_hand',
    difficulty: 'hard',
    appearsIn: 'Fast passages, orchestra'
  },
  {
    term: 'First Trained Function',
    definition: 'Developing basic hand position so fingers fall into clear stable intervallic patterns with minimal effort. Fingers stay close to the string and remain down silently whenever possible.',
    acceptableAnswers: ['basic hand position', 'finger patterns', 'hand frame'],
    category: 'left_hand',
    trainedFunction: 'first_function',
    difficulty: 'easy',
    appearsIn: 'Ševčík Op. 1 No. 1, Kreutzer No. 9'
  },
  {
    term: 'Second Trained Function',
    definition: 'Hand placement in relation to individual strings. Hand frame stays the same while the arm adjusts for string crossings. Elbow and thumb travel together as a unit.',
    acceptableAnswers: ['string crossings', 'arm movement', 'string levels'],
    category: 'left_hand',
    trainedFunction: 'second_function',
    difficulty: 'easy',
    appearsIn: 'Ševčík Op. 1 Nos. 1-3, Kreutzer No. 6'
  },
  {
    term: 'Third Trained Function',
    definition: 'Division of fingerboard into positions and shifting technique. Block shifting maintains pressure while moving with bow reducing speed to minimize sliding sounds.',
    acceptableAnswers: ['shifting', 'positions', 'position changes'],
    category: 'left_hand',
    trainedFunction: 'third_function',
    difficulty: 'medium',
    appearsIn: 'Ševčík Op. 8, shifting exercises'
  },
  {
    term: 'Fourth Trained Function',
    definition: 'Varying uses colors speeds pressures dynamics and accentuations of vibrato to shape musical expression.',
    acceptableAnswers: ['vibrato', 'expression', 'tone color'],
    category: 'left_hand',
    trainedFunction: 'fourth_function',
    difficulty: 'medium',
    appearsIn: 'Lyrical pieces, slow movements'
  },
  {
    term: 'Allegro',
    definition: 'Fast tempo, lively and quick',
    acceptableAnswers: ['fast', 'quick', 'lively'],
    category: 'tempo',
    difficulty: 'easy',
    appearsIn: 'BWV 1041 mvt 1, Suzuki Allegro'
  },
  {
    term: 'Andante',
    definition: 'Walking pace, moderate and flowing',
    acceptableAnswers: ['walking', 'moderate', 'medium tempo'],
    category: 'tempo',
    difficulty: 'easy',
    appearsIn: 'BWV 1041 mvt 2, slow movements'
  },
  {
    term: 'Allegro assai',
    definition: 'Very fast with energy',
    acceptableAnswers: ['very fast', 'extremely fast', 'rapid'],
    category: 'tempo',
    difficulty: 'easy',
    appearsIn: 'BWV 1041 mvt 3, finales'
  },
  {
    term: 'Adagio',
    definition: 'Slow and stately, expressive',
    acceptableAnswers: ['slow', 'very slow', 'expressive'],
    category: 'tempo',
    difficulty: 'easy',
    appearsIn: 'Slow movements, cantabile sections'
  },
  {
    term: 'Presto',
    definition: 'Very fast, urgent',
    acceptableAnswers: ['very fast', 'extremely fast', 'rapid'],
    category: 'tempo',
    difficulty: 'easy',
    appearsIn: 'Vivaldi, virtuoso pieces'
  },
  {
    term: 'piano',
    definition: 'Soft, quiet',
    acceptableAnswers: ['soft', 'quiet', 'gentle'],
    category: 'dynamics',
    difficulty: 'easy',
    appearsIn: 'All music'
  },
  {
    term: 'forte',
    definition: 'Loud, strong',
    acceptableAnswers: ['loud', 'strong', 'powerful'],
    category: 'dynamics',
    difficulty: 'easy',
    appearsIn: 'All music'
  },
  {
    term: 'crescendo',
    definition: 'Gradually getting louder',
    acceptableAnswers: ['getting louder', 'increasing volume', 'building'],
    category: 'dynamics',
    difficulty: 'easy',
    appearsIn: 'All music'
  },
  {
    term: 'diminuendo',
    definition: 'Gradually getting softer',
    acceptableAnswers: ['getting softer', 'decreasing volume', 'fading'],
    category: 'dynamics',
    difficulty: 'easy',
    appearsIn: 'All music'
  }
];

// -------------------- FINGERBOARD --------------------

export const FINGERBOARD_CONFIG = {
  strings: ['G', 'D', 'A', 'E'],
  stringMidi: { G: 55, D: 62, A: 69, E: 76 },
  positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  fingers: [1, 2, 3, 4]
};

export function midiToNoteName(midi) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return noteNames[midi % 12];
}

export const FINGERBOARD_NOTES = {
  G: [
    { position: 0, finger: 0, note: 'G', octave: 3, midi: 55 },
    { position: 1, finger: 1, note: 'A', octave: 3, midi: 57 },
    { position: 1, finger: 2, note: 'B', octave: 3, midi: 59 },
    { position: 1, finger: 3, note: 'C', octave: 4, midi: 60 },
    { position: 1, finger: 4, note: 'D', octave: 4, midi: 62 },
    { position: 3, finger: 1, note: 'C', octave: 4, midi: 60 },
    { position: 3, finger: 2, note: 'D', octave: 4, midi: 62 },
    { position: 3, finger: 3, note: 'E', octave: 4, midi: 64 },
    { position: 3, finger: 4, note: 'F#', octave: 4, midi: 66 }
  ],
  D: [
    { position: 0, finger: 0, note: 'D', octave: 4, midi: 62 },
    { position: 1, finger: 1, note: 'E', octave: 4, midi: 64 },
    { position: 1, finger: 2, note: 'F#', octave: 4, midi: 66 },
    { position: 1, finger: 3, note: 'G', octave: 4, midi: 67 },
    { position: 1, finger: 4, note: 'A', octave: 4, midi: 69 }
  ],
  A: [
    { position: 0, finger: 0, note: 'A', octave: 4, midi: 69 },
    { position: 1, finger: 1, note: 'B', octave: 4, midi: 71 },
    { position: 1, finger: 2, note: 'C#', octave: 5, midi: 73 },
    { position: 1, finger: 3, note: 'D', octave: 5, midi: 74 },
    { position: 1, finger: 4, note: 'E', octave: 5, midi: 76 }
  ],
  E: [
    { position: 0, finger: 0, note: 'E', octave: 5, midi: 76 },
    { position: 1, finger: 1, note: 'F#', octave: 5, midi: 78 },
    { position: 1, finger: 2, note: 'G#', octave: 5, midi: 80 },
    { position: 1, finger: 3, note: 'A', octave: 5, midi: 81 },
    { position: 1, finger: 4, note: 'B', octave: 5, midi: 83 }
  ]
};

// -------------------- FEEDBACK MESSAGES --------------------

export const PRAISE_MESSAGES = [
  'Excellent! 🎵',
  'Perfect! ✨',
  'Great job! 🌟',
  'Wonderful! 🎻',
  'Bravo! 👏',
  'Superb! 🎶',
  'Outstanding! ⭐',
  'Nicely done! 🎼'
];

export const ENCOURAGEMENT_MESSAGES = [
  'Not quite, but keep trying!',
  'Almost! Try again.',
  'Good effort! Review and try again.',
  'Close! Listen carefully.',
  'Keep practicing!'
];

// -------------------- GAMIFICATION --------------------

export const XP_VALUES = {
  CORRECT_ANSWER: 10,
  PERFECT_ANSWER: 25,
  STREAK_BONUS: 5,
  TECHNIQUE_COMPLETE: 15,
  PRACTICE_ITEM_DONE: 5,
  DAILY_GOAL_MET: 50
};

export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 250 },
  { level: 4, xp: 500 },
  { level: 5, xp: 1000 },
  { level: 6, xp: 2000 },
  { level: 7, xp: 3500 },
  { level: 8, xp: 5500 },
  { level: 9, xp: 8000 },
  { level: 10, xp: 12000 }
];

export const PROFILE_TYPES = {
  INTERMEDIATE: {
    id: 'intermediate',
    label: 'Intermediate (Suzuki 4-6)',
    description: 'Building solid technique foundations',
    color: '#007bff'
  },
  ADVANCED: {
    id: 'advanced',
    label: 'Advanced (Suzuki 7-10)',
    description: 'Refining artistry and control',
    color: '#28a745'
  },
  CONSERVATORY: {
    id: 'conservatory',
    label: 'Conservatory Prep',
    description: 'Professional-level mastery',
    color: '#dc3545'
  }
};

export const STORAGE_KEYS = {
  STATS: 'vmq.stats',
  XP: 'vmq.xp',
  LEVEL: 'vmq.level',
  STREAK: 'vmq.streak',
  LAST_PRACTICE: 'vmq.lastPractice',
  PROFILE: 'vmq.profile',
  ACHIEVEMENTS: 'vmq.achievements',
  DAILY_GOAL: 'vmq.dailyGoal',
  ITEM_RATINGS: 'vmq.itemRatings',
  PRACTICE_PLAN: 'vmq.practicePlan',
  SETTINGS: 'vmq.settings',
  DIFFICULTY: 'vmq.difficulty'
};

export const ACHIEVEMENTS = [
  { id: 'first_steps', name: 'First Steps', description: 'Complete first practice session', xp: 0 },
  { id: 'week_warrior', name: 'Week Warrior', description: '7-day streak', xp: 100 },
  { id: 'interval_master', name: 'Interval Master', description: '90% accuracy in intervals', xp: 500 },
  { id: 'rhythm_expert', name: 'Rhythm Expert', description: '90% accuracy in rhythm', xp: 500 },
  { id: 'key_sage', name: 'Key Sage', description: 'Master all key signatures', xp: 750 },
  { id: 'bieler_scholar', name: 'Bieler Scholar', description: '90% on vocabulary quiz', xp: 1000 },
  { id: 'practice_dedicated', name: 'Practice Dedicated', description: '30-day streak', xp: 2000 }
];

export const TECHNIQUE_TASKS = [
  { id: 'lh_basic_position', name: 'Basic Left Hand Position', description: 'Violin on collarbone, wrist straight, fingers curved', category: 'lefthand', bielerRef: 'Trained Function 1' },
  { id: 'lh_finger_articulation', name: 'Finger Articulation', description: 'Finger motion from whole arm, not isolated pressure', category: 'lefthand', bielerRef: 'Trained Function 1' },
  { id: 'lh_finger_replacement', name: 'Finger Replacement', description: 'Hand rotation while maintaining frame', category: 'lefthand', bielerRef: 'Trained Function 2' },
  { id: 'lh_hand_frame', name: 'Hand Frame Patterns', description: 'Practice 1-2-3-4 and 1-2-34 patterns', category: 'lefthand', bielerRef: 'Hand Frame' },
  { id: 'lh_shifting', name: 'Shifting Practice', description: 'Smooth position changes with thumb release', category: 'lefthand', bielerRef: 'Position Work' },
  { id: 'lh_vibrato', name: 'Vibrato Development', description: 'Arm vibrato with relaxed wrist', category: 'lefthand', bielerRef: 'Sound Production' },
  { id: 'rh_bow_hold', name: 'Bow Hold', description: 'Thumb bent, fingers relaxed, pinky curved', category: 'righthand', bielerRef: 'Bow Hold' },
  { id: 'rh_contact_point', name: 'Contact Point Awareness', description: 'Play at bridge, middle, fingerboard', category: 'righthand', bielerRef: 'Contact Point' },
  { id: 'rh_bow_distribution', name: 'Bow Distribution', description: 'Equal sound across entire bow', category: 'righthand', bielerRef: 'Trained Function 3' },
  { id: 'bs_detache', name: 'Détaché', description: 'Smooth separate bows, consistent speed', category: 'bowstroke', bielerRef: 'Détaché' },
  { id: 'bs_martele', name: 'Martelé', description: 'Hammered stroke with fast attack', category: 'bowstroke', bielerRef: 'Martelé' },
  { id: 'bs_legato', name: 'Legato', description: 'Connected strokes in one bow', category: 'bowstroke', bielerRef: 'Legato' },
  { id: 'bs_spiccato', name: 'Spiccato', description: 'Controlled off-string bounce', category: 'bowstroke', bielerRef: 'Spiccato' },
  { id: 'bs_staccato', name: 'Staccato', description: 'Multiple notes in one bow direction', category: 'bowstroke', bielerRef: 'Staccato' }
];

export const DAILY_GOALS = {
  BEGINNER: { minutes: 15, xpTarget: 50, itemsTarget: 10 },
  INTERMEDIATE: { minutes: 30, xpTarget: 100, itemsTarget: 20 },
  ADVANCED: { minutes: 45, xpTarget: 150, itemsTarget: 30 },
  CONSERVATORY: { minutes: 60, xpTarget: 200, itemsTarget: 40 }
};
