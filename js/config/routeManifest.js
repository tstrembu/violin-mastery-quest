// js/config/routeManifest.js
// ======================================
// VMQ ROUTE MANIFEST v2.3.3 (Drop-in)
// Goals:
// - Keep existing exports + behavior (ROUTE_ALIASES, safeDecodeURIComponent,
//   normalizeRouteSlug, ROUTE_TO_COMPONENT_FILE)
// - Add robust normalization (trim, strip #/?, collapse slashes)
// - Support aliases (no breaking changes)
// - Provide safe helpers for query parsing without requiring callers to use them
// - Freeze exported maps to prevent accidental runtime mutation
// ======================================

/**
 * Canonical route aliases.
 * NOTE: Keep keys lowercase.
 */
export const ROUTE_ALIASES = Object.freeze({
  scaleslab: 'scales',
  practicejournal: 'journal',
  practiceplanner: 'practiceplanner',
  // Legacy / UI route variants
  'speed-drill': 'speeddrill',
  speeddrill: 'speeddrill',
  'tempo-trainer': 'tempotrainer',
  tempotrainer: 'tempotrainer',
  intervalear: 'interval-ear',
});

/**
 * Decode URI components safely (never throws).
 */
export function safeDecodeURIComponent(s) {
  const str = (s ?? '').toString();
  try {
    return decodeURIComponent(str);
  } catch {
    // Some strings are partially-encoded or malformed; return original.
    return str;
  }
}

/**
 * Normalize a route/slug/path into a canonical route key.
 * - Accepts values like: "ScalesLab", "/scaleslab", "#/scaleslab?x=1", "scaleslab/"
 * - Strips leading "#", "/", and querystring.
 * - Lowercases and applies ROUTE_ALIASES.
 */
export function normalizeRouteSlug(route) {
  let r = safeDecodeURIComponent(route);

  // Convert to string, trim.
  r = (r ?? '').toString().trim();

  // Remove leading hash marker if present.
  if (r.startsWith('#')) r = r.slice(1);

  // If a full URL was passed, keep only path-ish portion.
  // Example: "https://x/y#/scales" -> "/y#/scales" then handled below
  const protoIdx = r.indexOf('://');
  if (protoIdx !== -1) {
    const afterProto = r.slice(protoIdx + 3);
    const firstSlash = afterProto.indexOf('/');
    r = firstSlash !== -1 ? afterProto.slice(firstSlash) : '';
  }

  // Strip querystring first.
  const qIdx = r.indexOf('?');
  if (qIdx !== -1) r = r.slice(0, qIdx);

  // If there is still a hash in the middle (like "/y#/scales"), keep after hash.
  const hashIdx = r.indexOf('#');
  if (hashIdx !== -1) r = r.slice(hashIdx + 1);

  // Normalize slashes.
  r = r.replace(/\\/g, '/');      // windows slashes safety
  r = r.replace(/\/{2,}/g, '/');  // collapse
  r = r.replace(/^\/+/, '');      // leading
  r = r.replace(/\/+$/, '');      // trailing

  // Keep only first path segment.
  const seg = r.split('/').filter(Boolean)[0] || '';
  const slug = seg.toLowerCase();

  // Apply aliases.
  return ROUTE_ALIASES[slug] || slug;
}

/**
 * Canonical route -> component file mapping.
 * Values are relative filenames in your components directory (per your loader).
 */
export const ROUTE_TO_COMPONENT_FILE = Object.freeze({
  menu: 'MainMenu.js',
  welcome: 'Welcome.js',
  dashboard: 'Dashboard.js',
  analytics: 'Analytics.js',
  settings: 'Settings.js',

  intervals: 'Intervals.js',
  'interval-ear': 'IntervalEarTester.js',
  // Not currently a separate module file in this repo; route resolves to Intervals.
  'interval-sprint': 'Intervals.js',

  keys: 'KeySignatures.js',
  // Not currently a separate module file in this repo; route resolves to KeySignatures.
  'key-tester': 'KeySignatures.js',

  rhythm: 'Rhythm.js',
  // Not currently a separate module file in this repo; route resolves to Rhythm.
  'rhythm-drills': 'Rhythm.js',

  // Drill routes are served by Testers hub in this repo.
  tempotrainer: 'Testers.js',
  speeddrill: 'Testers.js',

  bieler: 'Bieler.js',
  // Not currently a separate module file in this repo; route resolves to Bieler.
  bielerlab: 'Bieler.js',
  fingerboard: 'Fingerboard.js',
  // Not currently a separate module file in this repo; route resolves to Fingerboard.
  notelocator: 'Fingerboard.js',
  scales: 'ScalesLab.js',

  // ✅ Required routes per your prompt:
  coach: 'CoachPanel.js',
  datamanager: 'DataManager.js',

  journal: 'PracticeJournal.js',
  flashcards: 'Flashcards.js',

  practiceplanner: 'PracticePlanner.js',
  achievements: 'Achievements.js',
  // Not currently a separate module file in this repo; route resolves to PracticePlanner.
  dailygoals: 'PracticePlanner.js',
  testers: 'Testers.js',
});

/* -------------------------------------------------------
   Optional helpers (non-breaking additions)
   ------------------------------------------------------- */

/**
 * Returns true if the route exists in ROUTE_TO_COMPONENT_FILE (after normalization).
 */
export function isKnownRoute(route) {
  const slug = normalizeRouteSlug(route);
  return Boolean(ROUTE_TO_COMPONENT_FILE[slug]);
}

/**
 * Get the component file for a route (after normalization).
 * Returns null if unknown.
 */
export function getComponentFileForRoute(route) {
  const slug = normalizeRouteSlug(route);
  return ROUTE_TO_COMPONENT_FILE[slug] || null;
}

/**
 * Parse a querystring safely into an object.
 * Accepts "?a=1&b=two" or "a=1&b=two".
 */
export function parseQueryString(qs) {
  const raw = (qs ?? '').toString().trim();
  const s = raw.startsWith('?') ? raw.slice(1) : raw;
  if (!s) return {};

  const out = {};
  for (const part of s.split('&')) {
    if (!part) continue;
    const [kRaw, ...rest] = part.split('=');
    const k = safeDecodeURIComponent(kRaw).trim();
    if (!k) continue;
    const v = safeDecodeURIComponent(rest.join('=')).trim();

    // support repeated keys as arrays
    if (Object.prototype.hasOwnProperty.call(out, k)) {
      if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    } else {
      out[k] = v;
    }
  }
  return out;
}