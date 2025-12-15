// js/
// ======================================
// VMQ CONSTANTS - Complete Pedagogical Reference System - Violin Mastery Quest
// ======================================

import { VMQ_VERSION } from './version.js';
export { VMQ_VERSION }; // Re-export for convenience

// --------------------------------------
// STORAGE KEYS (single source of truth)
// Re-export from storage.js so older imports keep working:
//   import { STORAGE_KEYS } from './constants.js'
// --------------------------------------
export { STORAGE_KEYS } from './storage.js';

// ======================================
// INTERVALS - With Repertoire Mapping & Pedagogical Context
// ======================================

export const INTERVALS = [
  { 
    id: 'unison', 
    name: 'Unison', 
    semitones: 0, 
    example: 'C→C', 
    difficulty: 1,
    repertoire: [
      { piece: 'All repertoire', measure: 'Repeated notes', context: 'Fundamental' }
    ],
    suzukiLevel: 'All',
    tag: 'foundation'
  },
  { 
    id: 'm2', 
    name: 'Minor 2nd', 
    semitones: 1, 
    example: 'E→F', 
    difficulty: 2,
    repertoire: [
      { piece: 'Bach A-minor Concerto, Mvt. 2', measure: 'mm. 5-7', context: 'Chromatic descent' },
      { piece: 'Vivaldi A-minor, Mvt. 1', measure: 'mm. 12-15', context: 'Leading tone resolution' }
    ],
    etudes: ['Ševčík Op. 1 No. 14 (chromatic)'],
    suzukiLevel: 'Book 3-4',
    bielerNote: 'Requires finger contraction/extension',
    tag: 'chromatic'
  },
  { 
    id: 'M2', 
    name: 'Major 2nd', 
    semitones: 2, 
    example: 'C→D', 
    difficulty: 1,
    repertoire: [
      { piece: 'Twinkle Variations', measure: 'Theme', context: 'Stepwise melody' },
      { piece: 'French Folk Song', measure: 'entire', context: 'Scalar motion' },
      { piece: 'Concertino (Küchler)', measure: 'mm. 1-4', context: 'Scale passage' }
    ],
    etudes: ['Ševčík Op. 1 No. 1'],
    suzukiLevel: 'Book 1',
    bielerNote: 'Foundation of hand frame - 1st to 2nd finger',
    tag: 'scalar'
  },
  { 
    id: 'm3', 
    name: 'Minor 3rd', 
    semitones: 3, 
    example: 'A→C', 
    difficulty: 2,
    repertoire: [
      { piece: 'Bruch Concerto, Mvt. 1', measure: 'mm. 89-92', context: 'G minor arpeggio' },
      { piece: 'Seitz Concerto No. 2', measure: 'mm. 45-48', context: 'Minor voicing' }
    ],
    etudes: ['Kreutzer No. 13 (minor scales)'],
    suzukiLevel: 'Book 4-5',
    bielerNote: 'Low-2 finger position in minor keys',
    tag: 'minor'
  },
  { 
    id: 'M3', 
    name: 'Major 3rd', 
    semitones: 4, 
    example: 'C→E', 
    difficulty: 1,
    repertoire: [
      { piece: 'Vivaldi G-minor, Mvt. 3', measure: 'mm. 1-8', context: 'Broken chord' },
      { piece: 'Accolay Concerto', measure: 'mm. 33-36', context: 'A major arpeggio' }
    ],
    etudes: ['Kreutzer No. 2 (arpeggios)'],
    suzukiLevel: 'Book 2-3',
    bielerNote: 'High-2 finger position in major keys',
    tag: 'major'
  },
  { 
    id: 'P4', 
    name: 'Perfect 4th', 
    semitones: 5, 
    example: 'G→C', 
    difficulty: 2,
    repertoire: [
      { piece: 'Mendelssohn Concerto, Mvt. 1', measure: 'mm. 1-4', context: 'Opening theme leap' },
      { piece: 'Brahms Symphony No. 1', measure: 'Violin I, mm. 38', context: 'Orchestral voicing' }
    ],
    etudes: ['Kreutzer No. 9 (4th finger placement)'],
    suzukiLevel: 'Book 3-4',
    bielerNote: 'Hand frame foundation - 1st to 4th finger, defines position',
    tag: 'frame'
  },
  { 
    id: 'tritone', 
    name: 'Tritone (Aug 4th/Dim 5th)', 
    semitones: 6, 
    example: 'C→F#', 
    difficulty: 3,
    repertoire: [
      { piece: 'Modern works', measure: 'various', context: 'Tension/dissonance' }
    ],
    suzukiLevel: 'Book 6+',
    bielerNote: 'Chromatic awareness essential',
    tag: 'advanced'
  },
  { 
    id: 'P5', 
    name: 'Perfect 5th', 
    semitones: 7, 
    example: 'G→D', 
    difficulty: 1,
    repertoire: [
      { piece: 'Bach Double Concerto', measure: 'Mvt. 1, mm. 23-25', context: 'Harmonic framework' },
      { piece: 'Wieniawski Scherzo-Tarantelle', measure: 'mm. 89-96', context: 'Double-stop passage' }
    ],
    etudes: ['Ševčík Op. 1 No. 8 (5ths)'],
    suzukiLevel: 'Book 4+',
    bielerNote: 'String crossing preparation - anticipate both strings in double-stops',
    tag: 'ringing'
  },
  { 
    id: 'm6', 
    name: 'Minor 6th', 
    semitones: 8, 
    example: 'C→Ab', 
    difficulty: 3,
    repertoire: [
      { piece: 'Romantic works', measure: 'various', context: 'Expressive leap' }
    ],
    suzukiLevel: 'Book 5+',
    bielerNote: 'Requires position shift or extended hand frame',
    tag: 'leap'
  },
  { 
    id: 'M6', 
    name: 'Major 6th', 
    semitones: 9, 
    example: 'C→A', 
    difficulty: 2,
    repertoire: [
      { piece: 'Bach A-minor Sonata', measure: 'Mvt. 1, mm. 12-15', context: '6ths in 3rd position' },
      { piece: 'Vivaldi "Summer", Mvt. 3', measure: 'mm. 67-70', context: 'Rapid 6th leaps' }
    ],
    etudes: ['Ševčík Op. 1 No. 6'],
    suzukiLevel: 'Book 5-6',
    bielerNote: 'Common in double-stop passages',
    tag: 'double-stop'
  },
  { 
    id: 'm7', 
    name: 'Minor 7th', 
    semitones: 10, 
    example: 'C→Bb', 
    difficulty: 3,
    repertoire: [
      { piece: 'Jazz transcriptions', measure: 'various', context: 'Dominant 7th chords' }
    ],
    suzukiLevel: 'Book 6+',
    bielerNote: 'Position shift typically required',
    tag: 'jazz'
  },
  { 
    id: 'M7', 
    name: 'Major 7th', 
    semitones: 11, 
    example: 'C→B', 
    difficulty: 2,
    repertoire: [
      { piece: 'Contemporary classical', measure: 'various', context: 'Modern harmony' }
    ],
    suzukiLevel: 'Book 6+',
    bielerNote: 'Leading tone to tonic - strong resolution tendency',
    tag: 'leading-tone'
  },
  { 
    id: 'P8', 
    name: 'Octave', 
    semitones: 12, 
    example: 'C→C', 
    difficulty: 1,
    repertoire: [
      { piece: 'All repertoire', measure: 'Position shifts', context: 'Fundamental leap' }
    ],
    etudes: ['All Kreutzer études'],
    suzukiLevel: 'All levels',
    bielerNote: 'Essential for position changes and harmonic framework',
    tag: 'octave'
  }
];

// Derived index: id → interval for fast lookup in engines/analytics.
export const INTERVAL_INDEX = INTERVALS.reduce((map, interval) => {
  map[interval.id] = interval;
  return map;
}, {});

// ======================================
// KEY SIGNATURES - Complete Circle of Fifths (24 Keys)
// With Bieler Hand Maps
// ======================================

export const KEY_SIGNATURES = [
  // MAJOR KEYS - SHARPS
  {
    id: 'C', 
    name: 'C Major', 
    relativeMinor: 'A minor', 
    sharps: 0, 
    flats: 0,
    accidentals: [],
    bielerHandMap: 'Natural frame - G(0) D(0) A(0) E(0)',
    openStrings: ['G', 'D', 'A', 'E'],
    commonRepertoire: ['Twinkle Variations', 'French Folk Song', 'Lightly Row'],
    difficulty: 1,
    practiceNotes: 'Foundation key - natural hand position on all strings'
  },
  {
    id: 'G', 
    name: 'G Major', 
    relativeMinor: 'E minor', 
    sharps: 1, 
    flats: 0,
    accidentals: ['F#'],
    bielerHandMap: 'G(high-2) D(high-2) A(low-2) E(low-2)',
    openStrings: ['G', 'D', 'A', 'E'],
    commonRepertoire: ['Allegro (Suzuki 2)', 'Minuet 1', 'May Song'],
    difficulty: 1,
    practiceNotes: 'First sharp - F# on E string requires high-2 extension'
  },
  {
    id: 'D', 
    name: 'D Major', 
    relativeMinor: 'B minor', 
    sharps: 2, 
    flats: 0,
    accidentals: ['F#', 'C#'],
    bielerHandMap: 'G(high-2) D(high-2) A(high-2) E(low-2)',
    openStrings: ['D', 'A'],
    commonRepertoire: ['Chorus from Judas Maccabaeus', 'Bourrée (Handel)'],
    difficulty: 1,
    practiceNotes: 'Two sharps - C# requires high-2 on A string'
  },
  {
    id: 'A', 
    name: 'A Major', 
    relativeMinor: 'F# minor', 
    sharps: 3, 
    flats: 0,
    accidentals: ['F#', 'C#', 'G#'],
    bielerHandMap: 'G#(high-2) D(high-2) A(high-2) E(high-2)',
    openStrings: ['A', 'E'],
    commonRepertoire: ['Kreutzer No. 2', 'Ševčík Op. 1 No. 8'],
    difficulty: 2,
    practiceNotes: 'Three sharps - G# requires high-2 on G string'
  },
  {
    id: 'E', 
    name: 'E Major', 
    relativeMinor: 'C# minor', 
    sharps: 4, 
    flats: 0,
    accidentals: ['F#', 'C#', 'G#', 'D#'],
    bielerHandMap: 'G#(high-2) D#(high-2) A(high-2) E(high-2)',
    openStrings: ['E', 'A'],
    commonRepertoire: ['Gavotte (Gossec)', 'Partita No. 3 Preludio (Bach)'],
    difficulty: 2,
    practiceNotes: 'Four sharps - D# on D string, challenging hand frame'
  },
  {
    id: 'B', 
    name: 'B Major', 
    relativeMinor: 'G# minor', 
    sharps: 5, 
    flats: 0,
    accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'],
    bielerHandMap: 'G#(high-2) D#(high-2) A#(high-2) E(high-2)',
    openStrings: [],
    commonRepertoire: ['Orchestra excerpts', 'Advanced études'],
    difficulty: 3,
    practiceNotes: 'Five sharps - A# requires high-2 across all but E string'
  },
  {
    id: 'F#', 
    name: 'F# Major', 
    relativeMinor: 'D# minor', 
    sharps: 6, 
    flats: 0,
    accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
    bielerHandMap: 'G#(high-2) D#(high-2) A#(high-2) E#(high-2)',
    openStrings: [],
    commonRepertoire: ['Romantic repertoire', 'Tchaikovsky Concerto passages'],
    difficulty: 3,
    practiceNotes: 'Six sharps - E# = F natural, enharmonic thinking required'
  },
  {
    id: 'C#', 
    name: 'C# Major', 
    relativeMinor: 'A# minor', 
    sharps: 7, 
    flats: 0,
    accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],
    bielerHandMap: 'Every note shifted high-2 except open strings',
    openStrings: [],
    commonRepertoire: ['Rare - Beethoven String Quartet Op. 131'],
    difficulty: 4,
    practiceNotes: 'Seven sharps - theoretical key, enharmonic with Db Major'
  },

  // MAJOR KEYS - FLATS
  {
    id: 'F', 
    name: 'F Major', 
    relativeMinor: 'D minor', 
    sharps: 0, 
    flats: 1,
    accidentals: ['Bb'],
    bielerHandMap: 'G(low-2) D(low-2) A(low-1) E(low-1)',
    openStrings: ['C', 'F'] /* conceptual */,
    commonRepertoire: ['Suzuki Book 3', 'Mozart Concerto No. 3'],
    difficulty: 1,
    practiceNotes: 'One flat - Bb requires low-2 contraction on G string'
  },
  {
    id: 'Bb', 
    name: 'Bb Major', 
    relativeMinor: 'G minor', 
    sharps: 0, 
    flats: 2,
    accidentals: ['Bb', 'Eb'],
    bielerHandMap: 'G(low-2) D(low-2) A(low-2) E(low-1)',
    openStrings: [],
    commonRepertoire: ['Orchestra parts', 'Suzuki Book 4'],
    difficulty: 2,
    practiceNotes: 'Two flats - Eb on D string requires low-2'
  },
  {
    id: 'Eb', 
    name: 'Eb Major', 
    relativeMinor: 'C minor', 
    sharps: 0, 
    flats: 3,
    accidentals: ['Bb', 'Eb', 'Ab'],
    bielerHandMap: 'G(low-2) D(low-2) A(low-2) E(low-2)',
    openStrings: [],
    commonRepertoire: ['Beethoven Romances', 'Symphony excerpts'],
    difficulty: 2,
    practiceNotes: 'Three flats - Ab on A string'
  },
  {
    id: 'Ab', 
    name: 'Ab Major', 
    relativeMinor: 'F minor', 
    sharps: 0, 
    flats: 4,
    accidentals: ['Bb', 'Eb', 'Ab', 'Db'],
    bielerHandMap: 'G(low-2) D(low-2) A(low-2) E(low-2) with Db',
    openStrings: [],
    commonRepertoire: ['Romantic works', 'Brahms Concerto'],
    difficulty: 3,
    practiceNotes: 'Four flats - Db on D string'
  },
  {
    id: 'Db', 
    name: 'Db Major', 
    relativeMinor: 'Bb minor', 
    sharps: 0, 
    flats: 5,
    accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
    bielerHandMap: 'Low-2 dominant on all strings except E',
    openStrings: [],
    commonRepertoire: ['Chopin (transcriptions)', 'Late Romantic works'],
    difficulty: 3,
    practiceNotes: 'Five flats - Gb on G string'
  },
  {
    id: 'Gb', 
    name: 'Gb Major', 
    relativeMinor: 'Eb minor', 
    sharps: 0, 
    flats: 6,
    accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
    bielerHandMap: 'Extensive low-2 contraction - Cb = B natural',
    openStrings: [],
    commonRepertoire: ['Rare orchestral passages'],
    difficulty: 4,
    practiceNotes: 'Six flats - enharmonic thinking essential'
  },
  {
    id: 'Cb', 
    name: 'Cb Major', 
    relativeMinor: 'Ab minor', 
    sharps: 0, 
    flats: 7,
    accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
    bielerHandMap: 'Theoretical key - all notes contracted',
    openStrings: [],
    commonRepertoire: ['Theoretical only - use B Major instead'],
    difficulty: 4,
    practiceNotes: 'Seven flats - enharmonic with B Major'
  },

  // MINOR KEYS
  {
    id: 'Am', 
    name: 'A minor', 
    tonic: 'A',
    relativeMajor: 'C Major',
    sharps: 0, 
    flats: 0,
    accidentals: [],
    harmonicMinor: ['G#'],
    melodicMinor: ['F#', 'G#'],
    bielerHandMap: 'Same as C Major - add G#(high-2) for harmonic',
    commonRepertoire: ['Bach A-minor Concerto', 'Vivaldi A-minor Concerto'],
    difficulty: 1,
    practiceNotes: 'Natural minor = C Major. Harmonic: +G#. Melodic: +F#, G# ascending'
  },
  {
    id: 'Em', 
    name: 'E minor', 
    tonic: 'E',
    relativeMajor: 'G Major',
    sharps: 1, 
    flats: 0,
    accidentals: ['F#'],
    harmonicMinor: ['D#'],
    melodicMinor: ['C#', 'D#'],
    bielerHandMap: 'G Major frame + D#(high-2) for harmonic',
    commonRepertoire: ['Mendelssohn Concerto', 'Bach Partita'],
    difficulty: 1,
    practiceNotes: 'One sharp - D# for harmonic minor on D string'
  },
  {
    id: 'Bm', 
    name: 'B minor', 
    tonic: 'B',
    relativeMajor: 'D Major',
    sharps: 2, 
    flats: 0,
    accidentals: ['F#', 'C#'],
    harmonicMinor: ['A#'],
    melodicMinor: ['G#', 'A#'],
    bielerHandMap: 'D Major frame + A#(high-2) for harmonic',
    commonRepertoire: ['Romantic character pieces'],
    difficulty: 2,
    practiceNotes: 'Two sharps - A# for harmonic minor'
  },
  {
    id: 'F#m', 
    name: 'F# minor', 
    tonic: 'F#',
    relativeMajor: 'A Major',
    sharps: 3, 
    flats: 0,
    accidentals: ['F#', 'C#', 'G#'],
    harmonicMinor: ['E#'],
    melodicMinor: ['D#', 'E#'],
    bielerHandMap: 'A Major frame + E#(high-2) for harmonic',
    commonRepertoire: ['Wieniawski', 'Kreisler pieces'],
    difficulty: 2,
    practiceNotes: 'Three sharps - E# for harmonic minor'
  },
  {
    id: 'C#m', 
    name: 'C# minor', 
    tonic: 'C#',
    relativeMajor: 'E Major',
    sharps: 4, 
    flats: 0,
    accidentals: ['F#', 'C#', 'G#', 'D#'],
    harmonicMinor: ['B#'],
    melodicMinor: ['A#', 'B#'],
    bielerHandMap: 'E Major frame + B#(high-2) for harmonic',
    commonRepertoire: ['Late Romantic works'],
    difficulty: 3,
    practiceNotes: 'Four sharps - B# for harmonic minor'
  },
  {
    id: 'Dm', 
    name: 'D minor', 
    tonic: 'D',
    relativeMajor: 'F Major',
    sharps: 0, 
    flats: 1,
    accidentals: ['Bb'],
    harmonicMinor: ['C#'],
    melodicMinor: ['B♮', 'C#'],
    bielerHandMap: 'F Major frame + C#(high-2) for harmonic',
    commonRepertoire: ['Mozart Concerto No. 2', 'Sibelius Concerto'],
    difficulty: 1,
    practiceNotes: 'One flat - C# for harmonic creates unique hand shape'
  },
  {
    id: 'Gm', 
    name: 'G minor', 
    tonic: 'G',
    relativeMajor: 'Bb Major',
    sharps: 0, 
    flats: 2,
    accidentals: ['Bb', 'Eb'],
    harmonicMinor: ['F#'],
    melodicMinor: ['E♮', 'F#'],
    bielerHandMap: 'Bb Major frame + F#(high-2) for harmonic',
    commonRepertoire: ['Bach Sonatas', 'Bruch Concerto No. 1'],
    difficulty: 2,
    practiceNotes: 'Two flats - F# for harmonic minor'
  },
  {
    id: 'Cm', 
    name: 'C minor', 
    tonic: 'C',
    relativeMajor: 'Eb Major',
    sharps: 0, 
    flats: 3,
    accidentals: ['Bb', 'Eb', 'Ab'],
    harmonicMinor: ['B♮'],
    melodicMinor: ['A♮', 'B♮'],
    bielerHandMap: 'Eb Major frame + B♮ for harmonic',
    commonRepertoire: ['Beethoven works', 'Lalo Symphonie Espagnole'],
    difficulty: 2,
    practiceNotes: 'Three flats - B natural for harmonic minor'
  },
  {
    id: 'Fm', 
    name: 'F minor', 
    tonic: 'F',
    relativeMajor: 'Ab Major',
    sharps: 0, 
    flats: 4,
    accidentals: ['Bb', 'Eb', 'Ab', 'Db'],
    harmonicMinor: ['E♮'],
    melodicMinor: ['D♮', 'E♮'],
    bielerHandMap: 'Ab Major frame + E♮ for harmonic',
    commonRepertoire: ['Romantic salon pieces'],
    difficulty: 3,
    practiceNotes: 'Four flats - E natural for harmonic minor'
  }
];

// Fast lookup: id → key signature (for KeySignatures module & analytics)
export const KEY_SIGNATURE_INDEX = KEY_SIGNATURES.reduce((map, keySig) => {
  map[keySig.id] = keySig;
  return map;
}, {});

// ======================================
// RHYTHM PATTERNS - Complete Library (40+ Patterns)
// ======================================

export const RHYTHM_PATTERNS = [
  // ELEMENTARY (Suzuki 1-2)
  { 
    id: 'whole', 
    pattern: '𝅝', 
    name: 'Whole Note',
    beats: 4,
    description: 'Four beats',
    appears: 'Long bow exercises',
    difficulty: 1,
    bpmRange: [60, 80],
    count: '1-2-3-4',
    suzukiLevel: 'Book 1'
  },
  { 
    id: 'half', 
    pattern: '𝅗𝅥 𝅗𝅥', 
    name: 'Half Notes',
    beats: 2,
    description: 'Two beats each',
    appears: 'Twinkle Theme, Lightly Row',
    difficulty: 1,
    bpmRange: [60, 100],
    count: '1-2 3-4',
    suzukiLevel: 'Book 1'
  },
  { 
    id: 'quarters', 
    pattern: '♩ ♩ ♩ ♩', 
    name: 'Quarter Notes',
    beats: 1,
    description: 'Steady beat',
    appears: 'Twinkle, French Folk Song',
    difficulty: 1,
    bpmRange: [60, 120],
    count: '1 2 3 4',
    suzukiLevel: 'Book 1'
  },
  { 
    id: 'eighths', 
    pattern: '♫ ♫ ♫ ♫', 
    name: 'Eighth Note Pairs',
    beats: 0.5,
    description: 'Two notes per beat',
    appears: 'Allegro, Perpetual Motion',
    difficulty: 1,
    bpmRange: [70, 120],
    count: '1-and 2-and 3-and 4-and',
    suzukiLevel: 'Book 1-2'
  },
  { 
    id: 'mississippi', 
    pattern: '♩ ♫ ♩', 
    name: 'Mississippi Rhythm',
    beats: 1,
    description: 'Quarter, two eighths, quarter',
    appears: 'Song of the Wind, Allegretto',
    difficulty: 1,
    bpmRange: [80, 120],
    count: '1 2-and 3',
    suzukiLevel: 'Book 1'
  },
  { 
    id: 'quarter_rest', 
    pattern: '𝄽', 
    name: 'Quarter Rest',
    beats: 1,
    description: 'One beat of silence',
    appears: 'All repertoire',
    difficulty: 1,
    bpmRange: [60, 120],
    count: '(rest)',
    suzukiLevel: 'All'
  },

  // INTERMEDIATE (Suzuki 3-5)
  { 
    id: 'dotted_quarter', 
    pattern: '♩. ♪', 
    name: 'Dotted Quarter + Eighth',
    beats: 1.5,
    description: 'Long-short pattern',
    appears: 'Gavotte (Gossec), Bourrée',
    difficulty: 2,
    bpmRange: [80, 132],
    count: '1-2-and',
    suzukiLevel: 'Book 3-4'
  },
  { 
    id: 'scotch_snap', 
    pattern: '♪ ♩.', 
    name: 'Scotch Snap',
    beats: 1.5,
    description: 'Short-long (reverse dotted)',
    appears: 'Scottish folk tunes',
    difficulty: 2,
    bpmRange: [90, 120],
    count: 'and-1-2',
    suzukiLevel: 'Book 4'
  },
  { 
    id: 'sixteenths_basic', 
    pattern: '♬♬ ♩', 
    name: 'Four Sixteenths + Quarter',
    beats: 1,
    description: 'Fast subdivision',
    appears: 'Minuet 3, Gavotte (Becker)',
    difficulty: 2,
    bpmRange: [60, 100],
    count: '1-e-and-a 2',
    suzukiLevel: 'Book 3'
  },
  { 
    id: 'triplet_quarter', 
    pattern: '⌣3⌣', 
    name: 'Quarter Note Triplet',
    beats: 1,
    description: 'Three notes per beat',
    appears: 'Waltzes, Bach movements',
    difficulty: 2,
    bpmRange: [72, 120],
    count: '1-and-a',
    suzukiLevel: 'Book 4'
  },
  { 
    id: 'eighth_two_sixteenth', 
    pattern: '♪♬', 
    name: 'Eighth + Two Sixteenths',
    beats: 1,
    description: 'Uneven subdivision',
    appears: 'Seitz Concerto movements',
    difficulty: 2,
    bpmRange: [80, 120],
    count: '1-and-a',
    suzukiLevel: 'Book 4'
  },
  { 
    id: 'two_sixteenth_eighth', 
    pattern: '♬♪', 
    name: 'Two Sixteenths + Eighth',
    beats: 1,
    description: 'Quick start pattern',
    appears: 'Baroque dance movements',
    difficulty: 2,
    bpmRange: [80, 120],
    count: '1-e-and',
    suzukiLevel: 'Book 4'
  },

  // ADVANCED (Suzuki 6+, Kreutzer)
  { 
    id: 'sixteenths_full', 
    pattern: '♬♬♬♬', 
    name: 'Sixteenth Notes',
    beats: 0.25,
    description: 'Full measure of sixteenths',
    appears: 'Vivaldi, Bach fast movements',
    difficulty: 3,
    bpmRange: [60, 120],
    count: '1-e-and-a 2-e-and-a',
    suzukiLevel: 'Book 5+'
  },
  { 
    id: 'dotted_eighth_sixteenth', 
    pattern: '♪. ♬', 
    name: 'Dotted Eighth + Sixteenth',
    beats: 1,
    description: 'French style rhythm',
    appears: 'Kreutzer No. 4, French overtures',
    difficulty: 3,
    bpmRange: [80, 144],
    count: '1-e-and-a',
    suzukiLevel: 'Book 6+'
  },
  { 
    id: 'sixteenth_dotted_eighth', 
    pattern: '♬ ♪.', 
    name: 'Sixteenth + Dotted Eighth',
    beats: 1,
    description: 'Scotch snap variation',
    appears: 'Bruch Concerto, Scottish Fantasy',
    difficulty: 3,
    bpmRange: [80, 132],
    count: '1-e-and',
    suzukiLevel: 'Book 6+'
  },
  { 
    id: 'sextuplet', 
    pattern: '⌣6⌣', 
    name: 'Sextuplet',
    beats: 1,
    description: 'Six notes per beat',
    appears: 'Romantic cadenzas',
    difficulty: 3,
    bpmRange: [60, 100],
    count: '1-ta-la-ta-la-ta',
    suzukiLevel: 'Advanced'
  },
  { 
    id: 'thirty_seconds', 
    pattern: '𝅘𝅥𝅰𝅘𝅥𝅰𝅘𝅥𝅰𝅘𝅥𝅰', 
    name: '32nd Notes',
    beats: 0.125,
    description: 'Ultra-fast subdivision',
    appears: 'Paganini, virtuoso passages',
    difficulty: 4,
    bpmRange: [50, 80],
    count: '1-ti-ti-ta',
    suzukiLevel: 'Expert'
  },

  // SYNCOPATION
  { 
    id: 'syncopation_basic', 
    pattern: '♪ ♩ ♪', 
    name: 'Basic Syncopation',
    beats: 1,
    description: 'Off-beat emphasis',
    appears: 'Jazz, modern works',
    difficulty: 2,
    bpmRange: [90, 140],
    count: 'and-1-and-2-and',
    suzukiLevel: 'Book 5+'
  },
  { 
    id: 'anticipation', 
    pattern: '♩ ♪ ♪ ♩', 
    name: 'Anticipation',
    beats: 2,
    description: 'Early resolution',
    appears: 'Latin-influenced pieces',
    difficulty: 2,
    bpmRange: [100, 140],
    count: '1 2-and-3',
    suzukiLevel: 'Book 5+'
  },

  // COMPOUND METER (6/8, 9/8, 12/8)
  { 
    id: 'six_eight_basic', 
    pattern: '♪♪♪ ♪♪♪', 
    name: '6/8 Basic',
    beats: 3,
    description: 'Two groups of three',
    appears: 'Gigue, Tarantellas',
    difficulty: 2,
    bpmRange: [60, 120],
    count: '1-2-3 4-5-6',
    suzukiLevel: 'Book 4+'
  },
  { 
    id: 'six_eight_dotted', 
    pattern: '♩. ♩.', 
    name: '6/8 Dotted Quarters',
    beats: 3,
    description: 'Slow 6/8 feel',
    appears: 'Slow movements in 6/8',
    difficulty: 1,
    bpmRange: [50, 100],
    count: '1-2-3 4-5-6',
    suzukiLevel: 'Book 3+'
  },
  { 
    id: 'sicilienne', 
    pattern: '♪♬ ♪♬', 
    name: 'Sicilienne',
    beats: 3,
    description: 'Dotted in 6/8',
    appears: 'Baroque Siciliennes',
    difficulty: 2,
    bpmRange: [60, 90],
    count: '1-a-3 4-a-6',
    suzukiLevel: 'Book 5+'
  },

  // POLYRHYTHMS & COMPLEX
  { 
    id: 'three_against_two', 
    pattern: '3:2', 
    name: 'Three Against Two',
    beats: 1,
    description: 'Polyrhythm',
    appears: 'Brahms, chamber music',
    difficulty: 4,
    bpmRange: [60, 90],
    count: 'Complex subdivision',
    suzukiLevel: 'Expert'
  },
  { 
    id: 'hemiola', 
    pattern: '♩♩♩', 
    name: 'Hemiola',
    beats: 3,
    description: '3=2 metric shift',
    appears: 'Baroque dances, Spanish music',
    difficulty: 3,
    bpmRange: [80, 120],
    count: 'Shifts emphasis',
    suzukiLevel: 'Advanced'
  },
  { 
    id: 'quintuplet', 
    pattern: '⌣5⌣', 
    name: 'Quintuplet',
    beats: 1,
    description: 'Five notes per beat',
    appears: 'Modern works, Bartók',
    difficulty: 4,
    bpmRange: [60, 90],
    count: '1-ta-ta-ta-ta',
    suzukiLevel: 'Expert'
  },

  // SPECIFIC REPERTOIRE PATTERNS
  { 
    id: 'bach_double', 
    pattern: '♬♬♬♬ continuous', 
    name: 'Bach Double Pattern',
    beats: 0.25,
    description: 'Constant sixteenths',
    appears: 'Bach D-minor Double Concerto',
    difficulty: 3,
    bpmRange: [72, 100],
    count: 'Continuous flow',
    suzukiLevel: 'Book 7+'
  },
  { 
    id: 'vivaldi_winter', 
    pattern: '♬♬♪ repeating', 
    name: 'Vivaldi Winter Tremolo',
    beats: 1,
    description: 'Repeated tremolo',
    appears: 'Four Seasons - Winter',
    difficulty: 2,
    bpmRange: [90, 120],
    count: 'Tremolo bowing',
    suzukiLevel: 'Book 6+'
  },

  // ORNAMENTS
  { 
    id: 'single_grace', 
    pattern: '𝄁 ♩', 
    name: 'Grace Note',
    beats: 0,
    description: 'Quick ornament before beat',
    appears: 'Baroque, Classical',
    difficulty: 2,
    bpmRange: [80, 120],
    count: 'Before beat',
    suzukiLevel: 'Book 4+'
  },
  { 
    id: 'trill_rhythm', 
    pattern: 'tr~~~', 
    name: 'Trill',
    beats: 'varies',
    description: 'Rapid alternation',
    appears: 'All classical periods',
    difficulty: 3,
    bpmRange: [60, 120],
    count: 'Rapid alternation',
    suzukiLevel: 'Book 5+'
  },
  { 
    id: 'mordent', 
    pattern: '♩≈', 
    name: 'Mordent',
    beats: 0,
    description: 'Quick 3-note turn',
    appears: 'Baroque, especially Bach',
    difficulty: 2,
    bpmRange: [60, 100],
    count: 'Quick ornament',
    suzukiLevel: 'Book 5+'
  },

  // BOWING TECHNIQUES
  { 
    id: 'spiccato_eighths', 
    pattern: '♪ ♪ ♪ ♪ (off string)', 
    name: 'Spiccato Eighths',
    beats: 0.5,
    description: 'Bouncing bow',
    appears: 'Allegro movements, Kreutzer',
    difficulty: 3,
    bpmRange: [100, 144],
    count: 'Bouncing bow',
    suzukiLevel: 'Book 6+'
  },
  { 
    id: 'tremolo_measured', 
    pattern: '♬♬♬♬ (repeated)', 
    name: 'Measured Tremolo',
    beats: 1,
    description: 'Rapid repeated notes',
    appears: 'Romantic works, Wagner',
    difficulty: 2,
    bpmRange: [60, 100],
    count: 'Rapid repetition',
    suzukiLevel: 'Book 5+'
  },
  { 
    id: 'pizz_quarters', 
    pattern: '♩pizz ♩pizz', 
    name: 'Pizzicato',
    beats: 1,
    description: 'Plucked notes',
    appears: 'Orchestra, Bartók',
    difficulty: 1,
    bpmRange: [80, 120],
    count: 'Plucked',
    suzukiLevel: 'Book 2+'
  }
];

// For analytics/ML: difficulty buckets for quick aggregation.
export const DIFFICULTY_BANDS = {
  intervals: {
    easy: INTERVALS.filter(i => i.difficulty === 1).map(i => i.id),
    medium: INTERVALS.filter(i => i.difficulty === 2).map(i => i.id),
    hard: INTERVALS.filter(i => i.difficulty >= 3).map(i => i.id)
  },
  rhythm: {
    easy: RHYTHM_PATTERNS.filter(r => r.difficulty === 1).map(r => r.id),
    medium: RHYTHM_PATTERNS.filter(r => r.difficulty === 2).map(r => r.id),
    hard: RHYTHM_PATTERNS.filter(r => r.difficulty >= 3).map(r => r.id)
  }
};

// ======================================
// TEMPO MARKINGS - Complete List with BPM Ranges
// ======================================

export const TEMPO_MARKINGS = [
  { term: 'Larghissimo', bpm: 20, bpmRange: [20, 25], meaning: 'Extremely slow, solemn', emoji: '🐌' },
  { term: 'Grave',       bpm: 40, bpmRange: [25, 45], meaning: 'Very slow, serious',      emoji: '🕰️' },
  { term: 'Largo',       bpm: 50, bpmRange: [45, 60], meaning: 'Slow and large, broad',   emoji: '🐢' },
  { term: 'Lento',       bpm: 53, bpmRange: [45, 60], meaning: 'Very Slow',               emoji: '🚶‍♂️' },
  { term: 'Larghetto',   bpm: 63, bpmRange: [60, 66], meaning: 'Rather broadly',          emoji: '🎭' },
  { term: 'Adagio',      bpm: 71, bpmRange: [66, 76], meaning: 'Slow, majestic, stately', emoji: '👑' },
  { term: 'Adagietto',   bpm: 74, bpmRange: [72, 76], meaning: 'Slightly faster than adagio', emoji: '🌙' },
  { term: 'Andante',     bpm: 92, bpmRange: [76, 108], meaning: 'Walking pace',           emoji: '👣' },
  { term: 'Andantino',   bpm: 94, bpmRange: [80, 108], meaning: 'Slightly faster than andante', emoji: '🚶' },
  { term: 'Moderato',    bpm: 114, bpmRange: [108, 120], meaning: 'Moderate pace',        emoji: '🚶‍♀️' },
  { term: 'Allegretto',  bpm: 116, bpmRange: [112, 120], meaning: 'Medium pace with motion', emoji: '🎵' },
  { term: 'Allegro',     bpm: 144, bpmRange: [120, 156], meaning: 'Fast and happy cheerful', emoji: '😊' },
  { term: 'Vivace',      bpm: 172, bpmRange: [156, 176], meaning: 'Lively, brisk',        emoji: '⚡' },
  { term: 'Presto',      bpm: 184, bpmRange: [168, 200], meaning: 'Very fast',            emoji: '🏃' },
  { term: 'Prestissimo', bpm: 210, bpmRange: [200, 240], meaning: 'Extremely fast',       emoji: '🚀' }
];

// Fast lookup for tempo terms → BPM range.
export const TEMPO_INDEX = TEMPO_MARKINGS.reduce((map, t) => {
  map[t.term.toLowerCase()] = t;
  return map;
}, {});

// ======================================
// BIELER TAXONOMY - Complete Left & Right Hand Systems
// ======================================

export const BIELER_TAXONOMY = {
  leftHand: {
    firstFunction: {
      name: 'First Trained Function',
      description: 'Hand frame - stable intervallic patterns',
      keyPrinciples: [
        'Perfect 4th between 1st & 4th finger',
        'Fingers fall on left side of fingertips',
        'Extension/contraction for semitones'
      ],
      repertoire: [
        { piece: 'Seitz Concerto No. 2', context: 'Hand frame stability in 1st position' },
        { piece: 'Vivaldi A-minor', context: 'Consistent finger spacing' }
      ],
      exercises: ['Ševčík Op. 1 No. 1', 'Kreutzer No. 9']
    },
    secondFunction: {
      name: 'Second Trained Function',
      description: 'String crossing with stable hand frame',
      keyPrinciples: [
        'Hand frame stays same, arm adjusts',
        'Elbow moves toward body for lower strings',
        'Anticipate fifths - prepare both strings'
      ],
      repertoire: [
        { piece: 'Bach Double Concerto', context: 'Rapid string crossings, mm. 45-60' },
        { piece: 'Bruch Concerto', context: 'Mvt. 1 arpeggio passages' }
      ],
      exercises: ['Ševčík Op. 1 No. 1-3 on all strings', 'Kreutzer No. 6']
    },
    shifting: {
      name: 'Shifting',
      description: 'Position changes along the fingerboard',
      keyPrinciples: [
        'Light thumb contact',
        'Hand shape preservation',
        'Anticipatory motion',
        'Guide finger usage'
      ],
      repertoire: [
        { piece: 'Seitz Concerto No. 2', context: '1st to 3rd position shifts' },
        { piece: 'Accolay Concerto', context: 'Smooth position changes' }
      ],
      exercises: ['Ševčík Op. 8 (shifting exercises)', 'Kreutzer No. 10']
    },
    vibrato: {
      name: 'Vibrato',
      description: 'Oscillating pitch for expressive tone',
      keyPrinciples: [
        'Wrist flexibility',
        'Arm weight support',
        'Even oscillation',
        'Pitch center return'
      ],
      repertoire: [
        { piece: 'Bruch Concerto', context: 'Expressive phrases' },
        { piece: 'Meditation from Thaïs', context: 'Sustained vibrato' }
      ],
      exercises: ['Slow scales with vibrato', 'Vibrato studies']
    },
    intonation: {
      name: 'Intonation',
      description: 'Accurate pitch production',
      keyPrinciples: [
        'Ringing tones with open strings',
        'Half-step frames',
        'Resonance feedback',
        'Relaxed finger pressure'
      ],
      repertoire: [
        { piece: 'All repertoire', context: 'Fundamental requirement' }
      ],
      exercises: ['Ševčík Op. 1 entire', 'Scale studies']
    }
  },
  rightHand: {
    bowHold: {
      name: 'Bow Hold',
      description: 'Foundation of sound production',
      keyPrinciples: [
        'Flexible thumb',
        'Index finger contact point',
        'Middle finger balance',
        'Pinky curved support'
      ],
      repertoire: [
        { piece: 'All repertoire', context: 'Fundamental technique' }
      ]
    },
    bowDivision: {
      name: 'Bow Division',
      description: 'Distributing bow length appropriately',
      keyPrinciples: [
        'Proportional lengths for note values',
        'Speed control',
        'Pressure variation',
        'Sound point selection'
      ],
      repertoire: [
        { piece: 'Bach Sonatas and Partitas', context: 'Long sustained notes' },
        { piece: 'Kreutzer études', context: 'Bow distribution practice' }
      ],
      exercises: ['Ševčík Op. 2 (bow exercises)', 'Kreutzer No. 1']
    },
    soundPoint: {
      name: 'Sound Point (Contact Point)',
      description: 'Where bow contacts string',
      keyPrinciples: [
        'Bridge to fingerboard spectrum',
        'Pressure/velocity ratio',
        'Tone color variation',
        'String crossing preparation'
      ],
      repertoire: [
        { piece: 'All repertoire', context: 'Tone color control' }
      ],
      exercises: ['Sound point exploration exercises']
    },
    bowChanges: {
      name: 'Bow Changes',
      description: 'Smooth transitions at frog and tip',
      keyPrinciples: [
        'Circular motion',
        'Weight transfer',
        'Hair release',
        'Finger flexibility'
      ],
      repertoire: [
        { piece: 'Kreutzer études', context: 'Smooth bow changes' },
        { piece: 'All lyrical passages', context: 'Seamless legato' }
      ],
      exercises: ['Bow change studies', 'Kreutzer No. 4']
    },
    detache: {
      name: 'Détaché',
      description: 'Separate bow strokes',
      keyPrinciples: [
        'Natural arm weight',
        'Good contact',
        'Clear articulation'
      ],
      repertoire: [
        { piece: 'Kreutzer No. 2', context: 'Entire étude' },
        { piece: 'Sibelius Concerto', context: 'Mvt. 1 opening' }
      ]
    },
    spiccato: {
      name: 'Spiccato',
      description: 'Controlled bouncing bow',
      keyPrinciples: [
        'Natural bow bounce',
        'Light contact',
        'Consistent height'
      ],
      repertoire: [
        { piece: 'Mendelssohn Concerto', context: 'Finale' },
        { piece: 'Many allegro movements', context: 'Fast passages' }
      ]
    }
  }
};

// ======================================
// BIELER VOCABULARY - Complete Terminology
// ======================================

export const BIELER_VOCAB = [
  // Left Hand
  { term: 'Hand Frame',  definition: 'Perfect 4th between 1st and 4th finger', category: 'left_hand',  appearsIn: 'First Trained Function' },
  { term: 'Extension',   definition: 'Stretching hand frame for high-2',      category: 'left_hand',  appearsIn: 'Sharp keys' },
  { term: 'Contraction', definition: 'Compressing hand frame for low-2',      category: 'left_hand',  appearsIn: 'Flat keys' },
  { term: 'High-2',      definition: '2nd finger close to 3rd (sharp keys)',  category: 'left_hand',  appearsIn: 'G, D, A Major' },
  { term: 'Low-2',       definition: '2nd finger close to 1st (flat keys)',   category: 'left_hand',  appearsIn: 'F, Bb Major' },
  { term: 'Low-1',       definition: '1st finger backward extension',         category: 'left_hand',  appearsIn: 'F Major on E string' },
  { term: 'Fingers Down',definition: 'Keeping fingers on string when not playing', category: 'left_hand', appearsIn: 'First Trained Function' },
  { term: 'Left-Side Contact', definition: 'Placing fingers on left side of fingertip', category: 'left_hand', appearsIn: 'All technique' },
  { term: 'Guide Finger', definition: 'Finger that slides during position shifts', category: 'left_hand', appearsIn: 'Shifting technique' },
  { term: 'Ringing Tone', definition: 'In-tune note that resonates with open string', category: 'left_hand', appearsIn: 'Intonation practice' },
  
  // Right Hand
  { term: 'Contact Point', definition: 'Where bow meets string (sound point)', category: 'right_hand', appearsIn: 'Tone production' },
  { term: 'Bow Division',  definition: 'Distributing bow length for musical phrases', category: 'right_hand', appearsIn: 'All repertoire' },
  { term: 'Détaché',       definition: 'Separate bow strokes', category: 'right_hand', appearsIn: 'Basic technique' },
  { term: 'Legato',        definition: 'Smooth, connected bow strokes', category: 'right_hand', appearsIn: 'Lyrical passages' },
  { term: 'Spiccato',      definition: 'Controlled bouncing bow', category: 'right_hand', appearsIn: 'Fast passages' },
  { term: 'Sautillé',      definition: 'Fast, on-the-string bouncing', category: 'right_hand', appearsIn: 'Virtuoso works' },
  { term: 'Martelé',       definition: 'Hammered bow stroke', category: 'right_hand', appearsIn: 'Accented passages' },
  { term: 'Staccato',      definition: 'Multiple notes in one bow direction, separated', category: 'right_hand', appearsIn: 'Advanced technique' },
  { term: 'Collé',         definition: 'Pinched stroke at string', category: 'right_hand', appearsIn: 'Advanced bow technique' },
  { term: 'Ricochet',      definition: 'Thrown, bouncing bow stroke', category: 'right_hand', appearsIn: 'Paganini, virtuoso works' },
  
  // Musical Terms
  { term: 'Ringing Tone',  definition: 'Perfect intonation creating sympathetic resonance', category: 'intonation', appearsIn: 'All practice' },
  { term: 'Harmonic',      definition: 'Lightly touched overtone', category: 'technique', appearsIn: 'Advanced repertoire' },
  { term: 'Sul ponticello',definition: 'Bowing near the bridge', category: 'right_hand', appearsIn: 'Special effects' },
  { term: 'Sul tasto',     definition: 'Bowing over the fingerboard', category: 'right_hand', appearsIn: 'Soft, ethereal tone' },
  { term: 'Portamento',    definition: 'Audible slide between notes', category: 'left_hand', appearsIn: 'Expressive playing' },
  { term: 'Glissando',     definition: 'Continuous pitch slide', category: 'left_hand', appearsIn: 'Contemporary works' }
];

// For semantic search / ML coach: quick grouping by category.
export const BIELER_VOCAB_BY_CATEGORY = BIELER_VOCAB.reduce((acc, term) => {
  if (!acc[term.category]) acc[term.category] = [];
  acc[term.category].push(term);
  return acc;
}, {});

// ======================================
// PROGRESSION LADDERS - Suzuki + Conservatory System
// ======================================

export const PROGRESSION_LADDERS = {
  intervals: [
    {
      level: 'Suzuki 1-2',
      requirements: {
        intervals: ['M2', 'm2', 'M3'],
        positions: ['1st position only'],
        accuracy: 80,
        responseTime: 5000
      },
      repertoire: ['Twinkle Variations', 'Long Long Ago', 'May Song'],
      nextMilestone: 'Suzuki 3-4'
    },
    {
      level: 'Suzuki 3-4',
      requirements: {
        intervals: ['M2', 'm2', 'M3', 'm3', 'P4', 'P5'],
        positions: ['1st, 3rd position intro'],
        accuracy: 85,
        responseTime: 3000
      },
      repertoire: ['Gavotte (Bach)', 'Minuet 3', 'Concertino (Küchler)'],
      nextMilestone: 'Suzuki 5-6'
    },
    {
      level: 'Suzuki 5-6',
      requirements: {
        intervals: ['All intervals through octave'],
        positions: ['1st-5th position'],
        accuracy: 88,
        responseTime: 2500
      },
      repertoire: ['Vivaldi A-minor', 'Seitz Concerto No. 2'],
      nextMilestone: 'Pre-College'
    },
    {
      level: 'Pre-College (Gr. 8-10)',
      requirements: {
        intervals: ['All intervals + compound'],
        positions: ['All positions'],
        accuracy: 90,
        responseTime: 2000
      },
      repertoire: ['Viotti No. 23', 'de Bériot No. 9', 'Accolay Concerto'],
      nextMilestone: 'Conservatory'
    },
    {
      level: 'Conservatory (Pre-Professional)',
      requirements: {
        intervals: ['All + enharmonic recognition'],
        positions: ['All positions'],
        accuracy: 95,
        responseTime: 1500
      },
      repertoire: ['Bruch Concerto', 'Mendelssohn Concerto', 'Mozart Concertos'],
      nextMilestone: 'Professional'
    }
  ]
};

// Quick lookup: ladder level → requirements (for analytics dashboards).
export const PROGRESSION_INDEX = PROGRESSION_LADDERS.intervals.reduce((m, step) => {
  m[step.level] = step.requirements;
  return m;
}, {});

// ======================================
// REFLECTION PROMPTS - Metacognitive Development
// ======================================

export const REFLECTION_PROMPTS = {
  lowAccuracy: {
    trigger: (accuracy) => accuracy < 70,
    question: 'What felt difficult? (Select all that apply)',
    options: [
      'Visual clarity (reading staff)',
      'Speed (couldn\'t decide fast enough)',
      'Hand coordination (left/right sync)',
      'Muscle memory (position felt unfamiliar)',
      'Concept understanding (theory gaps)'
    ]
  },
  highAccuracy: {
    trigger: (accuracy) => accuracy >= 85,
    question: 'What helped you succeed?',
    options: [
      'Clear mental image',
      'Relaxed hand frame',
      'Consistent contact point',
      'Focused listening',
      'Slow, deliberate practice'
    ]
  },
  longSession: {
    trigger: (durationMinutes) => durationMinutes > 20,
    question: 'How was your focus throughout the session?',
    options: [
      'Sharp throughout',
      'Started strong, faded later',
      'Took multiple breaks',
      'Hard to focus today'
    ]
  }
};
