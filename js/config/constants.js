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

// Note name normalization for input matching
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

// Root notes for interval generation (first position range)
export const ROOT_NOTES = [
  { note: 'G', midi: 55 },  // Open G string
  { note: 'A', midi: 57 },
  { note: 'B', midi: 59 },
  { note: 'C', midi: 60 },  // Middle C
  { note: 'D', midi: 62 },
  { note: 'E', midi: 64 },
  { note: 'F', midi: 65 },
  { note: 'G', midi: 67 }
];

// MIDI to frequency conversion
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// -------------------- RHYTHM PATTERNS --------------------

export const RHYTHM_PATTERNS = [
  // Elementary (Suzuki Book 1-2)
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
  
  // Intermediate (Suzuki Book 3-5)
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
  
  // Advanced
  {
    id: 'triplet',
    pattern: '♪♪♪',
    description: 'Eighth note triplet',
    appearsIn: 'Kreutzer études, orchestra',
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

// -------------------- KEY SIGNATURES (Cooper's Guide) --------------------

// Sharp and flat orders
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];  // Father Charles Goes Down And Ends Battle
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];   // Battle Ends And Down Goes Charles Father

export const KEY_SIGNATURES = [
  // Level 1 - Everyday keys
  {
    id: 'C_major',
    major: 'C Major',
    minor: 'A minor',
    accidentals: 0,
    type: 'natural',
    handMap: {
      G: 'high2',  // B
      D: 'low2',   // F
      A: 'low2',   // C
      E: 'low1'    // F
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
      G: 'high2',  // B
      D: 'high2',  // F♯
      A: 'low2',   // C
      E: 'low2'    // G
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
      G: 'high2',  // B
      D: 'high2',  // F♯
      A: 'high2',  // C♯
      E: 'low2'    // G
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
      G: 'high2',  // B (really G♯–B in context)
      D: 'high2',  // F♯
      A: 'high2',  // C♯
      E: 'high2'   // G♯
    },
    openStrings: ['A', 'E'],
    appearsIn: 'Kreutzer études, orchestra parts',
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
      G: 'low2',   // B♭
      D: 'low2',   // F
      A: 'low1',   // B♭
      E: 'low1'    // F
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
      G: 'low2',   // B♭
      D: 'low2',   // F
      A: 'low2',   // C
      E: 'low1'    // F
    },
    openStrings: ['G', 'D'],
    appearsIn: 'Orchestra, Book 4+',
    difficulty: 'medium'
  }
];

// -------------------- BIELER VOCABULARY --------------------
// Source: IDA BIELER METHOD by Lucia Kobza

export const BIELER_VOCAB = [
  // BOW STROKES - BASIC
  {
    term: 'détaché',
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
    term: 'martelé',
    definition: 'Sharp articulated stroke in the upper half using flat hair and fast bow speed. The bow catches the string like collé then releases with the natural weight of the relaxed arm.',
    acceptableAnswers: ['hammered', 'sharp stroke', 'articulated'],
    category: 'bow_articulated',
    trainedFunction: 'right_hand',
    difficulty: 'medium',
    appearsIn: 'Kreutzer No. 7'
  },
  {
    term: 'collé',
    definition: 'Precise placement and pinching of the string with the bow using gripping stretching movements of the fingers. Can be silent placement only or articulated with pizzicato-like sound.',
    acceptableAnswers: ['pinch', 'grip', 'bow placement'],
    category: 'bow_articulated',
    trainedFunction: 'right_hand',
    difficulty: 'medium',
    appearsIn: 'Control exercises'
  },
  {
    term: 'spiccato',
    definition: 'Light bouncing stroke in the lower half that lifts from the string. Evolves from détaché by turning the wood of the bow out while using whole-arm motion from the shoulder.',
    acceptableAnswers: ['bouncing', 'off string', 'bounced bow'],
    category: 'bow_off_string',
    trainedFunction: 'right_hand',
    difficulty: 'medium',
    appearsIn: 'Kreutzer No. 2 variations'
  },
  {
    term: 'sautillé',
    definition: 'Virtuoso springing bow stroke produced by fast vertical flicking motion from the wrist. Light articulation uses outside of hair, stronger uses flat hair.',
    acceptableAnswers: ['springing', 'fast spiccato', 'bouncing fast'],
    category: 'bow_off_string',
    trainedFunction: 'right_hand',
    difficulty: 'hard',
    appearsIn: 'Fast passages, orchestra'
  },

  // LEFT HAND - TRAINED FUNCTIONS
  {
    term: 'First Trained Function',
    definition: 'Developing basic hand position so fingers fall into clear stable intervallic patterns with minimal effort. Fingers stay close to the string and remain down silently whenever possible.',
    acceptableAnswers: ['basic hand position', 'finger patterns', 'hand frame'],
    category: 'left_hand',
    trainedFunction: 'first_function',
    difficulty: 'easy',
    appearsIn: 'Ševčík Op. 1 No. 1, Kreutzer No. 9'
  },
  {
    term: 'Second Trained Function',
    definition: 'Hand placement in relation to individual strings. Hand frame stays the same while the arm adjusts for string crossings. Elbow and thumb travel together as a unit.',
    acceptableAnswers: ['string crossings', 'arm movement', 'string levels'],
    category: 'left_hand',
    trainedFunction: 'second_function',
    difficulty: 'easy',
    appearsIn: 'Ševčík Op. 1 Nos. 1-3, Kreutzer No. 6'
  },
  {
    term: 'Third Trained Function',
    definition: 'Division of fingerboard into positions and shifting technique. Block shifting maintains pressure while moving with bow reducing speed to minimize sliding sounds.',
    acceptableAnswers: ['shifting', 'positions', 'position changes'],
    category: 'left_hand',
    trainedFunction: 'third_function',
    difficulty: 'medium',
    appearsIn: 'Ševčík Op. 8, shifting exercises'
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

  // TEMPO MARKINGS
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

  // DYNAMICS
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

// -------------------- FINGERBOARD DATA --------------------

export const FINGERBOARD_CONFIG = {
  strings: ['E', 'A', 'D', 'G'],
  stringMidi: { G: 55, D: 62, A: 69, E: 76 },  // Open string MIDI values
  positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  fingers: [1, 2, 3, 4]
};

// Generate note name from MIDI
export function midiToNoteName(midi) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return noteNames[midi % 12];
}

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