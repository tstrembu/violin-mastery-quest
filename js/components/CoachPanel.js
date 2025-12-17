// js/components/CoachPanel.js

/* =========================================================
   VMQ — CoachPanel.js (Drop-in)
   Purpose:
   - “Coach view” for parent/teacher/coach:
       • quick overview (activity + data health)
       • notes + goals (stored locally)
       • lightweight insights from available VMQ data
       • exportable coach report (text + JSON)
       • optional data inspector (read-only by default)
   - Works in plain ESM + React UMD (no JSX)
   - Safe for iOS Safari + GitHub Pages

   Design goals:
   - Never assume any engine exists.
   - Never break the app if schemas change.
   - Prefer “best-effort” parsing and clear messaging.

   Exports:
   - default export: CoachPanelRoute (React component)
   - named export: CoachPanelRoute
   - named export: CoachPanel (class utility, optional)
   ========================================================= */

const ReactGlobal = (typeof React !== 'undefined') ? React : null;
if (!ReactGlobal) {
  throw new Error('VMQ CoachPanel requires React (UMD) to be loaded before this module.');
}

const {
  createElement: h,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} = ReactGlobal;

/* -----------------------------
   Tiny helpers
----------------------------- */
function nowISO() {
  try { return new Date().toISOString(); } catch { return String(Date.now()); }
}

function safeJSONParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (e) { return { ok: false, error: e }; }
}

function safeJSONStringify(obj, space = 2) {
  try { return { ok: true, value: JSON.stringify(obj, null, space) }; }
  catch (e) { return { ok: false, error: e }; }
}

function approxBytes(str) {
  if (!str) return 0;
  return String(str).length * 2; // rough UTF-16 estimate
}

function humanBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatLocalTime(isoLike) {
  try {
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return String(isoLike || '');
    return d.toLocaleString();
  } catch {
    return String(isoLike || '');
  }
}

function downloadTextFile(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

function lsGet(key, fallback = '') {
  try {
    const v = localStorage.getItem(key);
    return (v === null || v === undefined) ? fallback : v;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, String(value)); return true; }
  catch { return false; }
}

function listLocalStorageKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.sort((a, b) => a.localeCompare(b));
    return keys;
  } catch {
    return [];
  }
}

function readLocalStorageKey(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

/* -----------------------------
   VMQ key heuristics
----------------------------- */
const DEFAULT_KEY_PREFIXES = [
  'vmq',
  'VMQ',
  'session',
  'practice',
  'journal',
  'analytics',
  'spaced',
  'sr',
  'sm2',
  'difficulty',
  'achieve',
  'goal',
  'badge',
  'streak'
];

function isLikelyVMQKey(key) {
  const k = String(key || '');
  const lower = k.toLowerCase();
  if (lower.startsWith('vmq')) return true;
  return DEFAULT_KEY_PREFIXES.some((p) => lower.startsWith(String(p).toLowerCase()));
}

function guessVMQVersion() {
  // best-effort
  const v = window.VMQ?.version || window.VMQ?.VERSION || window.__VMQ_VERSION__;
  return v ? String(v) : 'unknown';
}

/* =========================================================
   CoachPanel utility class (optional programmatic use)
   ========================================================= */
export class CoachPanel {
  constructor(opts = {}) {
    this.namespace = opts.namespace || 'vmq';
  }

  snapshot() {
    const keys = listLocalStorageKeys();
    const vmqKeys = keys.filter(isLikelyVMQKey);

    // lightweight data sources
    const metrics = (window.vmqMetrics || window.__vmqMetrics__ || null);

    return {
      meta: {
        app: 'VMQ',
        namespace: this.namespace,
        version: guessVMQVersion(),
        capturedAt: nowISO(),
        url: window.location.href
      },
      sources: {
        hasWindowMetrics: !!metrics,
        localStorageKeyCount: keys.length,
        vmqKeyCount: vmqKeys.length
      },
      keys: {
        all: keys,
        vmq: vmqKeys
      }
    };
  }

  buildReportText({ notes = '', goals = '', highlights = [] } = {}) {
    const snap = this.snapshot();

    const lines = [];
    lines.push('VMQ — Coach Report');
    lines.push('------------------');
    lines.push(`Captured: ${formatLocalTime(snap.meta.capturedAt)}`);
    lines.push(`VMQ Version: ${snap.meta.version}`);
    lines.push(`URL: ${snap.meta.url}`);
    lines.push('');
    lines.push('Data Health');
    lines.push(`- localStorage keys: ${snap.sources.localStorageKeyCount}`);
    lines.push(`- likely VMQ keys:   ${snap.sources.vmqKeyCount}`);
    lines.push(`- window metrics:    ${snap.sources.hasWindowMetrics ? 'present' : 'not detected'}`);
    lines.push('');

    if (highlights.length) {
      lines.push('Highlights');
      highlights.forEach((h) => lines.push(`- ${h}`));
      lines.push('');
    }

    if (goals.trim()) {
      lines.push('Goals / Focus');
      lines.push(goals.trim());
      lines.push('');
    }

    if (notes.trim()) {
      lines.push('Coach Notes');
      lines.push(notes.trim());
      lines.push('');
    }

    lines.push('Key List (likely VMQ)');
    snap.keys.vmq.slice(0, 50).forEach((k) => lines.push(`- ${k}`));
    if (snap.keys.vmq.length > 50) lines.push(`… plus ${snap.keys.vmq.length - 50} more`);
    lines.push('');
    return lines.join('\n');
  }
}

/* =========================================================
   UI Pieces
   ========================================================= */
function StatusBar({ kind, text }) {
  const cls = `status ${kind || 'muted'} small`;
  return h('div', { className: cls, role: 'status', 'aria-live': 'polite' }, text || '');
}

function Chip({ className, children }) {
  return h('span', { className: className || 'chip', style: { padding: '0.5rem 0.75rem' } }, children);
}

function SectionTitle({ children }) {
  return h('h2', { style: { margin: '0 0 0.5rem 0' } }, children);
}

function MonoTextArea({ value, onChange, rows = 8, placeholder = '' }) {
  return h('textarea', {
    className: 'mono',
    value: value || '',
    placeholder,
    rows,
    style: {
      width: '100%',
      padding: '0.75rem',
      borderRadius: '12px',
      resize: 'vertical'
    },
    onChange: (e) => onChange?.(e.target.value)
  });
}

function SmallInput({ value, onChange, placeholder }) {
  return h('input', {
    type: 'text',
    className: 'note-input',
    value: value || '',
    placeholder: placeholder || '',
    onChange: (e) => onChange?.(e.target.value),
    style: { width: '100%' }
  });
}

/* =========================================================
   Insight extraction (best-effort)
   ========================================================= */
function tryParseAnyJSON(value) {
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return { ok: false };
  return safeJSONParse(trimmed);
}

function computeHighlightsFromData({ vmqKeys, keyToValue }) {
  const highlights = [];

  // 1) Streak-ish keys
  const streakKey = vmqKeys.find(k => k.toLowerCase().includes('streak'));
  if (streakKey) {
    const v = keyToValue.get(streakKey) || '';
    const parsed = tryParseAnyJSON(v);
    if (parsed.ok && parsed.value) {
      // try common shapes
      const n = parsed.value.days || parsed.value.count || parsed.value.streak;
      if (typeof n === 'number') highlights.push(`Streak detected: ${n} day(s) (${streakKey})`);
      else highlights.push(`Streak data present (${streakKey})`);
    } else if (v) {
      highlights.push(`Streak data present (${streakKey})`);
    }
  }

  // 2) Session-ish keys
  const sessionKeys = vmqKeys.filter(k => k.toLowerCase().includes('session'));
  if (sessionKeys.length) {
    highlights.push(`Session keys detected: ${sessionKeys.length}`);
  }

  // 3) Spaced repetition / due-ish keys
  const srKey = vmqKeys.find(k => k.toLowerCase().includes('spaced') || k.toLowerCase().includes('sm2') || k.toLowerCase().includes('sr'));
  if (srKey) highlights.push(`Spaced repetition data detected (${srKey})`);

  // 4) Goals
  const goalsKey = vmqKeys.find(k => k.toLowerCase().includes('goal'));
  if (goalsKey) highlights.push(`Goals data detected (${goalsKey})`);

  // 5) Metrics presence
  if (window.vmqMetrics || window.__vmqMetrics__) highlights.push('window metrics detected (vmqMetrics)');

  if (!highlights.length) {
    highlights.push('No strong structured signals detected — still OK; data may live in different keys/schemas.');
  }

  return highlights;
}

/* =========================================================
   Route Component
   ========================================================= */
function CoachPanelRoute() {
  const coachRef = useRef(null);
  if (!coachRef.current) coachRef.current = new CoachPanel({ namespace: 'vmq' });

  const NOTES_KEY = 'vmq-coach-notes';
  const GOALS_KEY = 'vmq-coach-goals';

  const [status, setStatus] = useState({ kind: 'muted', text: 'Ready.' });

  const [onlyVMQ, setOnlyVMQ] = useState(true);
  const [search, setSearch] = useState('');

  const [notes, setNotes] = useState(() => lsGet(NOTES_KEY, ''));
  const [goals, setGoals] = useState(() => lsGet(GOALS_KEY, ''));

  const [allKeys, setAllKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedPreview, setSelectedPreview] = useState('');

  const refresh = useCallback(() => {
    const keys = listLocalStorageKeys();
    setAllKeys(keys);
    setStatus({ kind: 'ok', text: `Refreshed. Found ${keys.length} localStorage key(s).` });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Persist notes/goals
  useEffect(() => {
    lsSet(NOTES_KEY, notes);
    window.dispatchEvent(new CustomEvent('vmq-coach-notes', { detail: { updatedAt: nowISO() } }));
  }, [notes]);

  useEffect(() => {
    lsSet(GOALS_KEY, goals);
    window.dispatchEvent(new CustomEvent('vmq-coach-goals', { detail: { updatedAt: nowISO() } }));
  }, [goals]);

  const vmqKeys = useMemo(() => {
    const base = onlyVMQ ? allKeys.filter(isLikelyVMQKey) : allKeys.slice();
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(k => String(k).toLowerCase().includes(q));
  }, [allKeys, onlyVMQ, search]);

  const keyToValue = useMemo(() => {
    const map = new Map();
    vmqKeys.forEach((k) => {
      const v = readLocalStorageKey(k);
      map.set(k, v || '');
    });
    return map;
  }, [vmqKeys]);

  const approxVMQBytes = useMemo(() => {
    let total = 0;
    vmqKeys.forEach((k) => {
      total += approxBytes(k);
      total += approxBytes(keyToValue.get(k) || '');
    });
    return total;
  }, [vmqKeys, keyToValue]);

  const highlights = useMemo(() => {
    return computeHighlightsFromData({ vmqKeys, keyToValue });
  }, [vmqKeys, keyToValue]);

  const dataHealth = useMemo(() => {
    const hasMetrics = !!(window.vmqMetrics || window.__vmqMetrics__);
    const vmqCount = vmqKeys.length;
    const badgeKind = (vmqCount === 0) ? 'warn' : (hasMetrics ? 'ok' : 'warn');
    const text =
      (vmqCount === 0)
        ? 'No VMQ-like keys detected in localStorage.'
        : (hasMetrics
          ? 'VMQ keys detected and window metrics present.'
          : 'VMQ keys detected, but window metrics not detected (may be normal).');
    return { kind: badgeKind, text, hasMetrics };
  }, [vmqKeys]);

  const openKeyPreview = useCallback((k) => {
    const raw = readLocalStorageKey(k) || '';
    setSelectedKey(k);
    if (!raw) {
      setSelectedPreview('');
      setStatus({ kind: 'warn', text: `Key "${k}" is empty or unreadable.` });
      return;
    }

    const parsed = tryParseAnyJSON(raw);
    if (parsed.ok) {
      const pretty = safeJSONStringify(parsed.value, 2);
      setSelectedPreview(pretty.ok ? pretty.value : raw);
      setStatus({ kind: 'ok', text: `Previewing parsed JSON for "${k}".` });
    } else {
      // show a safe slice
      const slice = raw.length > 5000 ? `${raw.slice(0, 5000)}\n\n… (truncated)` : raw;
      setSelectedPreview(slice);
      setStatus({ kind: 'ok', text: `Previewing raw value for "${k}".` });
    }
  }, []);

  const exportCoachReportText = useCallback(async () => {
    const text = coachRef.current.buildReportText({ notes, goals, highlights });
    try {
      const ok = await copyToClipboard(text);
      setStatus({ kind: ok ? 'ok' : 'warn', text: ok ? 'Coach report copied to clipboard.' : 'Copy failed (browser restriction).' });
    } catch (e) {
      setStatus({ kind: 'warn', text: `Copy failed: ${String(e?.message || e)}` });
    }
  }, [notes, goals, highlights]);

  const downloadCoachReportText = useCallback(() => {
    const text = coachRef.current.buildReportText({ notes, goals, highlights });
    const date = nowISO().replace(/[:.]/g, '-');
    downloadTextFile(`vmq-coach-report-${date}.txt`, text, 'text/plain');
    setStatus({ kind: 'ok', text: 'Coach report downloaded.' });
  }, [notes, goals, highlights]);

  const downloadCoachReportJSON = useCallback(() => {
    const snap = coachRef.current.snapshot();
    const payload = {
      ...snap,
      coach: {
        notes,
        goals,
        highlights
      },
      // include a small, safe sample of VMQ keys (NOT all values)
      sample: {
        keyCount: vmqKeys.length,
        approxBytes: approxVMQBytes,
        topKeys: vmqKeys.slice(0, 50)
      }
    };
    const s = safeJSONStringify(payload, 2);
    if (!s.ok) {
      setStatus({ kind: 'danger', text: 'Could not serialize JSON report.' });
      return;
    }
    const date = nowISO().replace(/[:.]/g, '-');
    downloadTextFile(`vmq-coach-report-${date}.json`, s.value, 'application/json');
    setStatus({ kind: 'ok', text: 'Coach JSON report downloaded.' });
  }, [notes, goals, highlights, vmqKeys, approxVMQBytes]);

  const clearCoachNotes = useCallback(() => {
    if (!window.confirm('Clear Coach Notes and Goals on this device?')) return;
    setNotes('');
    setGoals('');
    setStatus({ kind: 'ok', text: 'Cleared coach notes and goals.' });
  }, []);

  return h('main', { className: 'module-container' }, [

    // Header
    h('div', { className: 'module-header elevated' }, [
      h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' } }, [
        h('div', null, [
          h('h1', { style: { margin: 0 } }, 'Coach Panel'),
          h('p', { className: 'muted', style: { margin: '0.25rem 0 0 0' } },
            'High-level view for parents/teachers: notes, focus areas, and best-effort insights from available VMQ data.'
          )
        ]),
        h('div', { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } }, [
          h('button', { className: 'btn btn-secondary', type: 'button', onClick: refresh }, 'Refresh'),
          h('button', { className: 'btn btn-secondary', type: 'button', onClick: () => window.history.back() }, 'Back')
        ])
      ])
    ]),

    // Overview
    h('div', { className: 'card elevated', style: { marginTop: '1rem' } }, [
      SectionTitle({ children: 'Overview' }),

      h('div', { className: 'row', style: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' } }, [
        Chip({ className: `chip ${dataHealth.kind}`, children: dataHealth.kind === 'ok' ? 'Healthy' : 'Check' }),
        Chip({ className: 'chip', children: `VMQ keys: ${vmqKeys.length}` }),
        Chip({ className: 'chip', children: `Approx size: ${humanBytes(approxVMQBytes)}` }),
        Chip({ className: 'chip', children: `VMQ version: ${guessVMQVersion()}` })
      ]),

      h('p', { className: 'muted small', style: { marginTop: '0.75rem' } }, dataHealth.text),

      h('details', { style: { marginTop: '0.5rem' } }, [
        h('summary', { className: 'muted' }, 'Highlights (best-effort)'),
        h('ul', { className: 'muted small', style: { marginTop: '0.5rem', lineHeight: 1.45 } },
          highlights.map((t) => h('li', null, t))
        )
      ]),

      StatusBar({ kind: status.kind, text: status.text })
    ]),

    // Notes + Goals
    h('div', { className: 'card elevated', style: { marginTop: '1rem' } }, [
      SectionTitle({ children: 'Coach Notes & Goals' }),
      h('p', { className: 'muted small' },
        'These are saved locally on this device (localStorage). Use them for weekly focus, reminders, lesson notes, and accountability.'
      ),

      h('div', { className: 'row', style: { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' } }, [
        h('div', null, [
          h('label', { className: 'muted small' }, 'Goals / Focus (short, actionable)'),
          MonoTextArea({
            value: goals,
            onChange: setGoals,
            rows: 5,
            placeholder: 'Example: This week — (1) bow weight: “polish the string”, (2) shift map: 1st→3rd positions, (3) rhythm drill: 8ths/16ths accuracy…'
          })
        ]),
        h('div', null, [
          h('label', { className: 'muted small' }, 'Coach Notes (context + observations)'),
          MonoTextArea({
            value: notes,
            onChange: setNotes,
            rows: 8,
            placeholder: 'Example: Monday — excellent musical intention; needs bigger sound; remind: fulcrum/lever concept; watch left-hand frame on 2nd finger…'
          })
        ])
      ]),

      h('div', { className: 'row', style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' } }, [
        h('button', { className: 'btn btn-primary', type: 'button', onClick: exportCoachReportText }, 'Copy Coach Report (Text)'),
        h('button', { className: 'btn btn-secondary', type: 'button', onClick: downloadCoachReportText }, 'Download Text'),
        h('button', { className: 'btn btn-secondary', type: 'button', onClick: downloadCoachReportJSON }, 'Download JSON'),
        h('button', { className: 'btn btn-secondary', type: 'button', onClick: clearCoachNotes }, 'Clear Notes/Goals')
      ])
    ]),

    // Data Inspector
    h('div', { className: 'card elevated', style: { marginTop: '1rem', marginBottom: '2rem' } }, [
      SectionTitle({ children: 'Data Inspector (Read-Only)' }),
      h('p', { className: 'muted small' },
        'This is a safe viewer for localStorage keys. It does not edit VMQ data. Use it to confirm what data exists and whether it looks like valid JSON.'
      ),

      h('div', { className: 'row', style: { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' } }, [
        h('label', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } }, [
          h('input', {
            type: 'checkbox',
            checked: onlyVMQ,
            onChange: (e) => setOnlyVMQ(!!e.target.checked)
          }),
          h('span', null, 'Show VMQ keys only')
        ]),
        h('div', { style: { flex: '1 1 240px' } }, [
          SmallInput({
            value: search,
            onChange: setSearch,
            placeholder: 'Filter keys…'
          })
        ])
      ]),

      h('div', { className: 'row', style: { display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginTop: '0.75rem' } }, [
        h('div', {
          style: {
            maxHeight: '28vh',
            overflow: 'auto',
            paddingRight: '0.25rem',
            borderRadius: '12px'
          }
        }, vmqKeys.length ? (
          vmqKeys.map((k) => {
            const v = keyToValue.get(k) || '';
            const size = humanBytes(approxBytes(k) + approxBytes(v));
            return h('button', {
              key: k,
              type: 'button',
              className: 'btn btn-secondary',
              onClick: () => openKeyPreview(k),
              style: {
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '0.4rem'
              }
            }, [
              h('span', { className: 'mono', style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, k),
              h('span', { className: 'muted small', style: { whiteSpace: 'nowrap' } }, size)
            ]);
          })
        ) : h('p', { className: 'muted' }, 'No keys found.')),

        h('div', null, [
          h('p', { className: 'muted small', style: { margin: '0 0 0.5rem 0' } },
            selectedKey ? `Preview: ${selectedKey}` : 'Select a key to preview its value.'
          ),
          MonoTextArea({
            value: selectedPreview,
            onChange: () => {},
            rows: 10,
            placeholder: 'Key value preview will appear here…'
          })
        ])
      ]),

      h('details', { style: { marginTop: '0.75rem' } }, [
        h('summary', { className: 'muted' }, 'How to use this for debugging'),
        h('div', { className: 'muted small', style: { marginTop: '0.5rem', lineHeight: 1.45 } }, [
          h('p', null, '• If a key previews as pretty JSON, it’s likely healthy and structured.'),
          h('p', null, '• If it previews as a long string, it may be compressed, encoded, or just plain text — still valid.'),
          h('p', null, '• If the VMQ keys list is empty, VMQ may be storing data elsewhere (IndexedDB), or keys use different names.'),
          h('p', null, '• Use the Coach Report export to share a high-level snapshot without dumping private full data.')
        ])
      ])
    ])
  ]);
}

/* ---------------------------------------------------------
   Exports
--------------------------------------------------------- */
export default CoachPanelRoute;
export { CoachPanelRoute };