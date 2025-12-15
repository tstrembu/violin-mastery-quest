// js/config/routeManifest.js
export const ROUTE_ALIASES = {
  scaleslab: 'scales',
  practicejournal: 'journal',
  practiceplanner: 'practiceplanner'
};

export function safeDecodeURIComponent(s) {
  try { return decodeURIComponent(s); } catch { return s || ''; }
}

export function normalizeRouteSlug(route) {
  const r = (route || '').toString().trim().toLowerCase();
  return ROUTE_ALIASES[r] || r;
}

export const ROUTE_TO_COMPONENT_FILE = {
  menu: 'MainMenu.js',
  welcome: 'Welcome.js',
  dashboard: 'Dashboard.js',
  analytics: 'Analytics.js',
  settings: 'Settings.js',

  intervals: 'Intervals.js',
  'interval-ear': 'IntervalEarTester.js',
  'interval-sprint': 'IntervalSprint.js',

  keys: 'KeySignatures.js',
  'key-tester': 'KeyTester.js',

  rhythm: 'Rhythm.js',
  'rhythm-drills': 'RhythmDrills.js',

  tempotrainer: 'TempoTrainer.js',
  speeddrill: 'SpeedDrill.js',

  bieler: 'Bieler.js',
  bielerlab: 'BielerLab.js',
  fingerboard: 'Fingerboard.js',
  notelocator: 'NoteLocator.js',
  scales: 'ScalesLab.js',

  coach: 'CoachPanel.js',
  journal: 'PracticeJournal.js',
  flashcards: 'Flashcards.js',

  practiceplanner: 'PracticePlanner.js',
  achievements: 'Achievements.js',
  dailygoals: 'DailyGoals.js',
  datamanager: 'DataManager.js',
  testers: 'Testers.js'
};