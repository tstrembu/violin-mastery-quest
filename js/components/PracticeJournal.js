// js/components/PracticeJournal.js
// ============================================================
// VMQ PracticeJournal v1.0.0 (Drop-in component)
// - No JSX (React UMD compatible)
// - Writes/reads both STORAGE_KEYS.JOURNAL and STORAGE_KEYS.PRACTICE_LOG
//   so existing analytics/coach engines can consume data reliably.
// - Safe, resilient localStorage behavior (never hard-crashes the app).
// ============================================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { sessionTracker } from '../engines/sessionTracker.js';
import { a11y } from '../accessibility.js';

const ReactGlobal = (typeof React !== 'undefined') ? React : null;
if (!ReactGlobal) throw new Error('PracticeJournal: React global not found. Ensure React UMD is loaded before modules.');

const { createElement: h, useEffect, useMemo, useState, useCallback } = ReactGlobal;

// ------------------------------
// Helpers
// ------------------------------
function toast(type, message) {
  try {
    // Toast system exposes window.VMQToast + helper methods if Toast.js is mounted
    if (window.VMQToast && typeof window.VMQToast[type] === 'function') {
      window.VMQToast[type](message);
      return;
    }
  } catch {}
  // Fallback: silent
}

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function isoDate(d = new Date()) {
  const dt = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

function safeText(s, max = 2000) {
  const t = String(s ?? '').replace(/\u0000/g, '').trim();
  return t.length > max ? t.slice(0, max) : t;
}

function makeId() {
  return `j_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeEntry(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const ts = Number(obj.timestamp ?? obj.ts ?? Date.now());
  const timestamp = Number.isFinite(ts) ? ts : Date.now();

  const module = safeText(obj.module ?? obj.route ?? obj.area ?? 'general', 64).toLowerCase();
  const dateISO = safeText(obj.dateISO ?? obj.date ?? isoDate(timestamp), 32) || isoDate(timestamp);

  const durationMin = clamp(obj.durationMin ?? (obj.durationMs ? (Number(obj.durationMs) / 60000) : 0) ?? 0, 0, 600);
  const durationMs = Math.round(durationMin * 60000);

  const mood = clamp(obj.mood ?? obj.energy ?? 3, 1, 5); // 1–5
  const rating = clamp(obj.rating ?? obj.quality ?? 3, 1, 5); // 1–5

  const focus = safeText(obj.focus ?? '', 200);
  const wins = safeText(obj.wins ?? '', 600);
  const challenges = safeText(obj.challenges ?? obj.blockers ?? '', 600);
  const next = safeText(obj.next ?? obj.nextSteps ?? '', 600);
  const notes = safeText(obj.notes ?? obj.text ?? '', 2000);

  return {
    id: safeText(obj.id ?? makeId(), 128),
    timestamp,
    dateISO,
    module,
    durationMin,
    durationMs,
    mood,
    rating,
    focus,
    wins,
    challenges,
    next,
    notes,
    source: safeText(obj.source ?? 'journal', 32)
  };
}

function sortDesc(a, b) {
  return (b.timestamp || 0) - (a.timestamp || 0);
}

function loadAllEntries() {
  const journal = loadJSON(STORAGE_KEYS.JOURNAL, []);
  const log = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);

  const jArr = Array.isArray(journal) ? journal : [];
  const lArr = Array.isArray(log) ? log : [];

  const merged = [];
  for (const x of jArr) merged.push({ ...normalizeEntry(x), source: normalizeEntry(x).source || 'journal' });
  for (const x of lArr) merged.push({ ...normalizeEntry(x), source: normalizeEntry(x).source || 'practiceLog' });

  // De-dupe by id if present; else by timestamp+module+notes hash-ish
  const seen = new Set();
  const out = [];
  for (const e of merged.sort(sortDesc)) {
    const key = e.id || `${e.timestamp}|${e.module}|${e.notes}|${e.focus}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function persistEntries(allEntries) {
  const arr = Array.isArray(allEntries) ? allEntries : [];
  // Store “journal” entries (manual + imported) in JOURNAL (analytics engine reads this)
  // Store everything in PRACTICE_LOG too (coach engine reads this)
  const journal = arr.filter(e => e && (e.source === 'journal' || e.source === 'practiceLog' || e.source === 'session'));
  const practiceLog = arr;

  saveJSON(STORAGE_KEYS.JOURNAL, journal);
  saveJSON(STORAGE_KEYS.PRACTICE_LOG, practiceLog);
}

// ------------------------------
// Component
// ------------------------------
export default function PracticeJournal(props = {}) {
  const navigate = props.navigate || (() => {});
  const [tab, setTab] = useState('log'); // 'log' | 'new'
  const [entries, setEntries] = useState(() => loadAllEntries());

  const [query, setQuery] = useState('');
  const [range, setRange] = useState('30'); // '7' | '30' | 'all'
  const [moduleFilter, setModuleFilter] = useState('all');

  const [draft, setDraft] = useState(() => ({
    id: makeId(),
    dateISO: isoDate(),
    module: 'general',
    durationMin: 20,
    mood: 3,
    rating: 3,
    focus: '',
    wins: '',
    challenges: '',
    next: '',
    notes: ''
  }));

  // Refresh when coming back to the page
  useEffect(() => {
    try { a11y?.announce?.('Practice Journal loaded'); } catch {}
    setEntries(loadAllEntries());
  }, []);

  const modules = useMemo(() => {
    const s = new Set(entries.map(e => e.module).filter(Boolean));
    return ['all', ...Array.from(s).sort()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = safeText(query, 200).toLowerCase();
    const now = Date.now();
    const days = range === 'all' ? null : Number(range);
    const cutoff = (days && Number.isFinite(days)) ? (now - days * 86400000) : null;

    return entries
      .filter(e => {
        if (!e) return false;
        if (cutoff && (e.timestamp || 0) < cutoff) return false;
        if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;
        if (!q) return true;
        const hay = `${e.module} ${e.focus} ${e.wins} ${e.challenges} ${e.next} ${e.notes}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(sortDesc);
  }, [entries, query, range, moduleFilter]);

  const totals = useMemo(() => {
    const minutes = filtered.reduce((acc, e) => acc + (Number(e.durationMin) || 0), 0);
    return {
      count: filtered.length,
      minutes: Math.round(minutes),
      hours: Math.round((minutes / 60) * 10) / 10
    };
  }, [filtered]);

  const updateDraft = useCallback((key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const saveDraft = useCallback(() => {
    const entry = normalizeEntry({
      ...draft,
      id: draft.id || makeId(),
      module: safeText(draft.module || 'general', 64),
      source: 'journal',
      timestamp: Date.now()
    });

    setEntries(prev => {
      const next = [entry, ...(Array.isArray(prev) ? prev : [])].sort(sortDesc);
      persistEntries(next);
      return next;
    });

    toast('success', 'Journal entry saved.');
    try { a11y?.announce?.('Journal entry saved'); } catch {}

    setDraft({
      id: makeId(),
      dateISO: isoDate(),
      module: entry.module || 'general',
      durationMin: 20,
      mood: 3,
      rating: 3,
      focus: '',
      wins: '',
      challenges: '',
      next: '',
      notes: ''
    });

    setTab('log');
  }, [draft]);

  const deleteEntry = useCallback((id) => {
    if (!id) return;
    const ok = window.confirm('Delete this entry? This cannot be undone.');
    if (!ok) return;

    setEntries(prev => {
      const next = (Array.isArray(prev) ? prev : []).filter(e => e.id !== id);
      persistEntries(next);
      return next;
    });

    toast('info', 'Entry deleted.');
  }, []);

  const importCurrentSession = useCallback(() => {
    try {
      const current = sessionTracker?.getCurrentSession?.();
      if (!current) {
        toast('warning', 'No active session found to import.');
        return;
      }

      const entry = normalizeEntry({
        id: makeId(),
        timestamp: Date.now(),
        dateISO: isoDate(),
        module: current.module || current.route || 'session',
        durationMs: current.duration || 0,
        durationMin: current.duration ? (current.duration / 60000) : 0,
        focus: 'Imported from current session',
        notes: current.notes || '',
        source: 'session'
      });

      setEntries(prev => {
        const next = [entry, ...(Array.isArray(prev) ? prev : [])].sort(sortDesc);
        persistEntries(next);
        return next;
      });

      toast('success', 'Current session imported into journal.');
    } catch {
      toast('error', 'Could not import current session.');
    }
  }, []);

  // ------------------------------
  // UI bits
  // ------------------------------
  const header = h('div', { className: 'module-header' },
    h('div', null,
      h('h2', { className: 'module-title' }, 'Practice Journal'),
      h('p', { className: 'module-subtitle' }, 'Track what you practiced, what improved, and what’s next.')
    ),
    h('div', { className: 'module-actions' },
      h('button', { className: 'btn btn-secondary', type: 'button', onClick: () => navigate('#menu') }, 'Back'),
      h('button', { className: 'btn btn-secondary', type: 'button', onClick: importCurrentSession }, 'Import Current Session'),
      h('button', {
        className: tab === 'new' ? 'btn btn-primary' : 'btn btn-secondary',
        type: 'button',
        onClick: () => setTab(tab === 'new' ? 'log' : 'new')
      }, tab === 'new' ? 'View Log' : 'New Entry')
    )
  );

  const filters = h('div', { className: 'card', style: { marginBottom: '12px' } },
    h('div', { className: 'card-body' },
      h('div', { className: 'form-grid' },
        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Search'),
          h('input', {
            className: 'form-input',
            value: query,
            placeholder: 'e.g., Kreutzer, shifting, intonation…',
            onInput: (e) => setQuery(e.target.value)
          })
        ),
        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Range'),
          h('select', {
            className: 'form-select',
            value: range,
            onChange: (e) => setRange(e.target.value)
          },
            h('option', { value: '7' }, 'Last 7 days'),
            h('option', { value: '30' }, 'Last 30 days'),
            h('option', { value: 'all' }, 'All time')
          )
        ),
        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Module'),
          h('select', {
            className: 'form-select',
            value: moduleFilter,
            onChange: (e) => setModuleFilter(e.target.value)
          },
            modules.map(m => h('option', { key: m, value: m }, m))
          )
        )
      ),
      h('div', { style: { marginTop: '10px', opacity: 0.9 } },
        h('span', { className: 'badge' }, `${totals.count} entries`),
        h('span', { className: 'badge', style: { marginLeft: '8px' } }, `${totals.minutes} min`),
        h('span', { className: 'badge', style: { marginLeft: '8px' } }, `${totals.hours} hr`)
      )
    )
  );

  const entryRow = (e) => {
    const title = `${e.dateISO} • ${e.module || 'general'} • ${Math.round(e.durationMin || 0)} min`;
    const meta = `Mood ${e.mood}/5 • Quality ${e.rating}/5 • Source: ${e.source || 'journal'}`;

    return h('div', { key: e.id, className: 'card', style: { marginBottom: '10px' } },
      h('div', { className: 'card-body' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } },
          h('div', null,
            h('div', { style: { fontWeight: 800 } }, title),
            h('div', { style: { fontSize: '12px', opacity: 0.75, marginTop: '2px' } }, meta)
          ),
          h('div', null,
            h('button', {
              className: 'btn btn-danger btn-small',
              type: 'button',
              onClick: () => deleteEntry(e.id)
            }, 'Delete')
          )
        ),

        e.focus ? h('div', { style: { marginTop: '8px' } }, h('b', null, 'Focus: '), e.focus) : null,
        e.wins ? h('div', { style: { marginTop: '6px' } }, h('b', null, 'Wins: '), e.wins) : null,
        e.challenges ? h('div', { style: { marginTop: '6px' } }, h('b', null, 'Challenges: '), e.challenges) : null,
        e.next ? h('div', { style: { marginTop: '6px' } }, h('b', null, 'Next: '), e.next) : null,
        e.notes ? h('div', { style: { marginTop: '8px', whiteSpace: 'pre-wrap' } }, e.notes) : null
      )
    );
  };

  const logView = h('div', null,
    filters,
    filtered.length
      ? h('div', null, filtered.map(entryRow))
      : h('div', { className: 'card' },
          h('div', { className: 'card-body', style: { opacity: 0.8 } },
            'No entries match your filters yet. Try adding a new entry.'
          )
        )
  );

  const newEntryView = h('div', { className: 'card' },
    h('div', { className: 'card-body' },
      h('div', { className: 'form-grid' },

        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Date'),
          h('input', {
            className: 'form-input',
            type: 'date',
            value: draft.dateISO,
            onInput: (e) => updateDraft('dateISO', e.target.value)
          })
        ),

        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Module'),
          h('input', {
            className: 'form-input',
            value: draft.module,
            placeholder: 'e.g., intervals, bieler, scales…',
            onInput: (e) => updateDraft('module', e.target.value)
          })
        ),

        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Duration (minutes)'),
          h('input', {
            className: 'form-input',
            type: 'number',
            min: 0,
            max: 600,
            value: draft.durationMin,
            onInput: (e) => updateDraft('durationMin', clamp(e.target.value, 0, 600))
          })
        ),

        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Mood (1–5)'),
          h('input', {
            className: 'form-input',
            type: 'number',
            min: 1,
            max: 5,
            value: draft.mood,
            onInput: (e) => updateDraft('mood', clamp(e.target.value, 1, 5))
          })
        ),

        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Quality (1–5)'),
          h('input', {
            className: 'form-input',
            type: 'number',
            min: 1,
            max: 5,
            value: draft.rating,
            onInput: (e) => updateDraft('rating', clamp(e.target.value, 1, 5))
          })
        )
      ),

      h('div', { className: 'form-group', style: { marginTop: '10px' } },
        h('label', { className: 'form-label' }, 'Focus'),
        h('input', {
          className: 'form-input',
          value: draft.focus,
          placeholder: 'What was the main goal today?',
          onInput: (e) => updateDraft('focus', e.target.value)
        })
      ),

      h('div', { className: 'form-group', style: { marginTop: '10px' } },
        h('label', { className: 'form-label' }, 'Wins'),
        h('textarea', {
          className: 'form-textarea',
          value: draft.wins,
          rows: 2,
          placeholder: 'What improved?',
          onInput: (e) => updateDraft('wins', e.target.value)
        })
      ),

      h('div', { className: 'form-group', style: { marginTop: '10px' } },
        h('label', { className: 'form-label' }, 'Challenges'),
        h('textarea', {
          className: 'form-textarea',
          value: draft.challenges,
          rows: 2,
          placeholder: 'What felt hard / confusing?',
          onInput: (e) => updateDraft('challenges', e.target.value)
        })
      ),

      h('div', { className: 'form-group', style: { marginTop: '10px' } },
        h('label', { className: 'form-label' }, 'Next Steps'),
        h('textarea', {
          className: 'form-textarea',
          value: draft.next,
          rows: 2,
          placeholder: 'What’s the next best action?',
          onInput: (e) => updateDraft('next', e.target.value)
        })
      ),

      h('div', { className: 'form-group', style: { marginTop: '10px' } },
        h('label', { className: 'form-label' }, 'Notes'),
        h('textarea', {
          className: 'form-textarea',
          value: draft.notes,
          rows: 5,
          placeholder: 'Freeform notes…',
          onInput: (e) => updateDraft('notes', e.target.value)
        })
      ),

      h('div', { style: { marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        h('button', { className: 'btn btn-primary', type: 'button', onClick: saveDraft }, 'Save Entry'),
        h('button', {
          className: 'btn btn-secondary',
          type: 'button',
          onClick: () => {
            setDraft({
              id: makeId(),
              dateISO: isoDate(),
              module: 'general',
              durationMin: 20,
              mood: 3,
              rating: 3,
              focus: '',
              wins: '',
              challenges: '',
              next: '',
              notes: ''
            });
            toast('info', 'Draft cleared.');
          }
        }, 'Clear')
      )
    )
  );

  return h('div', { className: 'module-container' },
    header,
    tab === 'new' ? newEntryView : logView
  );
}