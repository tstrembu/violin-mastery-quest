/* js/components/PracticeJournal.js
========================================================
VMQ Practice Journal v3.0.5 (Drop-in)
- React UMD (no JSX) + ES module imports
- Uses existing VMQ storage keys (STORAGE_KEYS.JOURNAL + PRACTICE_LOG)
- Shows recent practice sessions (from sessionTracker log) + lets you add notes
- Safe on iOS Safari (feature-detected) + never hard-crashes if data is missing
========================================================
*/

import { STORAGE_KEYS, loadJSON, saveJSON } from '../config/storage.js';
import * as gamification from '../engines/gamification.js';
import sessionTrackerDefault, { sessionTracker as sessionTrackerNamed } from '../engines/sessionTracker.js';

const { createElement: h, useEffect, useMemo, useRef, useState, useCallback } = React;

const sessionTracker = sessionTrackerNamed || sessionTrackerDefault;

const JOURNAL_KEY = STORAGE_KEYS?.JOURNAL || 'vmq.journal';
const PRACTICE_LOG_KEY = STORAGE_KEYS?.PRACTICE_LOG || 'vmq.practiceLog';

function safeArray(v) { return Array.isArray(v) ? v : []; }
function safeStr(v) { return (v == null) ? '' : String(v); }

function isoDay(d = new Date()) {
  // Local “day” identifier (stable for user)
  const dt = (d instanceof Date) ? d : new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nowISO() { return new Date().toISOString(); }

function makeId(prefix = 'jrnl') {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toast(message, type = 'info', meta = {}) {
  try {
    window.VMQToast?.addToast?.(message, type, 3500, { source: 'journal', ...meta });
  } catch {}
}

function awardXP(amount, reason = 'Journal entry') {
  try {
    if (typeof gamification.awardXP === 'function') gamification.awardXP(amount, reason);
    else if (typeof gamification.addXP === 'function') gamification.addXP(amount, reason);
  } catch {}
}

function loadJournal() {
  // Supports: { entries: [...] } OR legacy [] OR legacy object maps
  const raw = loadJSON(JOURNAL_KEY, { entries: [] });

  if (Array.isArray(raw)) return { entries: raw };
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.entries)) return { ...raw, entries: raw.entries };
    // If someone stored as {id:entry,...}
    const maybeEntries = Object.values(raw).filter(v => v && typeof v === 'object' && (v.notes || v.activity));
    if (maybeEntries.length) return { entries: maybeEntries };
  }
  return { entries: [] };
}

function saveJournal(model) {
  const entries = safeArray(model?.entries).slice(0, 500); // hard cap (offline-safe)
  saveJSON(JOURNAL_KEY, { entries, updatedAt: Date.now(), version: 1 });
}

function loadPracticeLog() {
  const log = loadJSON(PRACTICE_LOG_KEY, []);
  return safeArray(log).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function fmtMinutes(min) {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 60) return `${Math.round(n)}m`;
  const h0 = Math.floor(n / 60);
  const m0 = Math.round(n % 60);
  return `${h0}h ${m0}m`;
}

function fmtDateTime(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return '';
  try {
    const d = new Date(t);
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function uniq(list) {
  const out = [];
  const seen = new Set();
  for (const x of list) {
    const k = safeStr(x).trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

export default function PracticeJournal({
  onBack,
  onNavigate,
  emitAnalyticsEvent
}) {
  const [tab, setTab] = useState('journal'); // 'journal' | 'sessions'
  const [journalModel, setJournalModel] = useState(() => loadJournal());
  const [practiceLog, setPracticeLog] = useState(() => loadPracticeLog());

  // Form state
  const [date, setDate] = useState(() => isoDay());
  const [activity, setActivity] = useState('General Practice');
  const [minutes, setMinutes] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);

  const saveTimer = useRef(null);

  // Refresh from disk (best effort) on mount + whenever tab changes
  useEffect(() => {
    setJournalModel(loadJournal());
    setPracticeLog(loadPracticeLog());
  }, [tab]);

  // Debounced autosave journal model (prevents storage thrash)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { saveJournal(journalModel); } catch {}
    }, 200);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [journalModel]);

  const journalEntries = useMemo(() => {
    const entries = safeArray(journalModel?.entries)
      .map(e => ({
        id: e.id || makeId('jrnl'),
        date: e.date || isoDay(e.timestamp || Date.now()),
        timestamp: e.timestamp || Date.now(),
        activity: safeStr(e.activity || 'Practice'),
        minutes: Number(e.minutes || 0) || 0,
        tags: safeStr(e.tags || ''),
        notes: safeStr(e.notes || ''),
        sessionId: e.sessionId || null,
        createdAt: e.createdAt || e.timestamp || Date.now(),
        updatedAt: e.updatedAt || e.timestamp || Date.now()
      }))
      .sort((a, b) => {
        // Sort by day then timestamp
        if (a.date !== b.date) return (a.date < b.date) ? 1 : -1;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

    // De-dupe by id
    const seen = new Set();
    return entries.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  }, [journalModel]);

  const recentActivities = useMemo(() => {
    const fromLog = practiceLog.map(s => s.activity);
    const fromEntries = journalEntries.map(e => e.activity);
    return uniq([
      'General Practice',
      'Repertoire',
      'Scales',
      'Intonation',
      'Rhythm',
      'Intervals / Ear',
      'Bieler Lab',
      ...fromLog,
      ...fromEntries
    ]).slice(0, 18);
  }, [practiceLog, journalEntries]);

  const todaysLog = useMemo(() => {
    const today = isoDay();
    return practiceLog.filter(s => isoDay(s.timestamp || Date.now()) === today);
  }, [practiceLog]);

  const sessionsThisWeek = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    return practiceLog.filter(s => (s.timestamp || 0) >= cutoff);
  }, [practiceLog]);

  const weekTotals = useMemo(() => {
    const mins = sessionsThisWeek.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
    const xp = sessionsThisWeek.reduce((sum, s) => sum + (Number(s.xpEarned) || 0), 0);
    const total = sessionsThisWeek.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    return { mins, xp, total };
  }, [sessionsThisWeek]);

  const startEdit = useCallback((entry) => {
    setEditingId(entry.id);
    setDate(entry.date || isoDay(entry.timestamp || Date.now()));
    setActivity(entry.activity || 'General Practice');
    setMinutes(entry.minutes ? String(entry.minutes) : '');
    setTags(entry.tags || '');
    setNotes(entry.notes || '');
    setTab('journal');
    toast('Editing entry', 'info');
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setDate(isoDay());
    setActivity('General Practice');
    setMinutes('');
    setTags('');
    setNotes('');
  }, []);

  const upsertEntry = useCallback(() => {
    const day = safeStr(date).trim() || isoDay();
    const act = safeStr(activity).trim() || 'General Practice';
    const noteText = safeStr(notes).trim();

    if (!noteText) {
      toast('Add a quick note before saving.', 'warning');
      return;
    }

    const mins = Math.max(0, Math.min(600, Number(minutes) || 0));
    const tagText = safeStr(tags).trim();

    const entry = {
      id: editingId || makeId('jrnl'),
      date: day,
      timestamp: Date.now(),
      activity: act,
      minutes: mins,
      tags: tagText,
      notes: noteText,
      // Optionally link the most recent session from that day
      sessionId: null,
      updatedAt: Date.now(),
      createdAt: editingId ? undefined : Date.now()
    };

    setJournalModel(prev => {
      const existing = safeArray(prev?.entries);
      const next = existing.filter(e => (e?.id || '') !== entry.id);
      next.push(entry);
      return { ...(prev || {}), entries: next };
    });

    try {
      emitAnalyticsEvent?.('journal', editingId ? 'update' : 'create', { activity: act, minutes: mins, hasTags: !!tagText });
    } catch {}

    // Small, non-spammy reward (optional)
    if (!editingId) {
      awardXP(2, 'Journal entry');
      try { window.VMQToast?.toastHelpers?.xpGain?.(2, 'journal', { activity: act }); } catch {}
    }

    toast(editingId ? 'Journal entry updated' : 'Journal entry saved', 'success');
    resetForm();
  }, [date, activity, minutes, tags, notes, editingId, emitAnalyticsEvent, resetForm]);

  const deleteEntry = useCallback((id) => {
    const ok = window.confirm('Delete this journal entry?');
    if (!ok) return;

    setJournalModel(prev => {
      const next = safeArray(prev?.entries).filter(e => (e?.id || '') !== id);
      return { ...(prev || {}), entries: next };
    });

    try { emitAnalyticsEvent?.('journal', 'delete', { id }); } catch {}
    toast('Entry deleted', 'info');
    if (editingId === id) resetForm();
  }, [emitAnalyticsEvent, editingId, resetForm]);

  const exportJournal = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      journal: { entries: journalEntries },
      practiceLog: practiceLog.slice(0, 100) // keep it small
    };

    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vmq-journal-export-${Date.now()}.json`;
      a.click();
      toast('Export downloaded', 'success');
    } catch {
      toast('Export failed (browser blocked download)', 'error');
    }
  }, [journalEntries, practiceLog]);

  const endCurrentSession = useCallback(() => {
    try {
      sessionTracker?.forceEnd?.('journal');
      toast('Session ended', 'success');
      setPracticeLog(loadPracticeLog());
    } catch {
      toast('Could not end session', 'error');
    }
  }, []);

  const currentSessionStats = useMemo(() => {
    try { return sessionTracker?.getSessionStats?.() || null; } catch { return null; }
  }, [practiceLog.length]); // re-evaluate when log updates

  // ----- UI -----
  const Header = h(
    'div',
    { className: 'module-header', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' } },
    h('div', null,
      h('h1', { style: { margin: 0 } }, 'Practice Journal'),
      h('p', { className: 'text-muted', style: { margin: '6px 0 0' } }, 'Notes + recent sessions (offline)')
    ),
    h('div', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'flex-end' } },
      h('button', { className: `btn ${tab === 'journal' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => setTab('journal') }, '📝 Journal'),
      h('button', { className: `btn ${tab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => setTab('sessions') }, '📊 Sessions'),
      h('button', { className: 'btn btn-secondary', onClick: exportJournal }, '⬇️ Export'),
      h('button', { className: 'btn btn-secondary', onClick: () => (onBack ? onBack() : onNavigate?.('menu')) }, '🏠 Menu')
    )
  );

  const SessionCard = h(
    'div',
    { className: 'card elevated', style: { marginBottom: 'var(--space-lg)' } },
    h('h2', { style: { marginTop: 0 } }, 'Current session'),
    currentSessionStats
      ? h('div', { className: 'grid', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' } },
          h('div', null, h('div', { className: 'text-muted' }, 'Activity'), h('div', null, safeStr(currentSessionStats.activity || '—'))),
          h('div', null, h('div', { className: 'text-muted' }, 'Minutes'), h('div', null, `${Number(currentSessionStats.elapsedMinutes || 0)}m`)),
          h('div', null, h('div', { className: 'text-muted' }, 'Accuracy'), h('div', null, `${Math.round((Number(currentSessionStats.accuracy || 0)) * 100)}%`)),
          h('div', null, h('div', { className: 'text-muted' }, 'Focus'), h('div', null, `${Number(currentSessionStats.focusScore || 0)}%`)),
          h('div', { style: { gridColumn: '1 / -1', display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' } },
            h('button', { className: 'btn btn-secondary', onClick: () => setPracticeLog(loadPracticeLog()) }, '🔄 Refresh'),
            h('button', { className: 'btn btn-danger', onClick: endCurrentSession }, '⏹ End session')
          )
        )
      : h('p', { className: 'text-muted' }, 'No active session right now.')
  );

  const JournalForm = h(
    'div',
    { className: 'card elevated', style: { marginBottom: 'var(--space-lg)' } },
    h('h2', { style: { marginTop: 0 } }, editingId ? 'Edit entry' : 'New entry'),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' } },
      h('label', { className: 'field' },
        h('div', { className: 'text-muted', style: { marginBottom: 6 } }, 'Date'),
        h('input', {
          className: 'input',
          type: 'date',
          value: date,
          onChange: (e) => setDate(e.target.value)
        })
      ),
      h('label', { className: 'field' },
        h('div', { className: 'text-muted', style: { marginBottom: 6 } }, 'Activity'),
        h('select', {
          className: 'input',
          value: activity,
          onChange: (e) => setActivity(e.target.value)
        },
          recentActivities.map(a => h('option', { key: a, value: a }, a))
        )
      ),
      h('label', { className: 'field' },
        h('div', { className: 'text-muted', style: { marginBottom: 6 } }, 'Minutes (optional)'),
        h('input', {
          className: 'input',
          inputMode: 'numeric',
          placeholder: 'e.g., 25',
          value: minutes,
          onChange: (e) => setMinutes(e.target.value)
        })
      ),
      h('label', { className: 'field' },
        h('div', { className: 'text-muted', style: { marginBottom: 6 } }, 'Tags (optional)'),
        h('input', {
          className: 'input',
          placeholder: 'e.g., Bach, shifting, intonation',
          value: tags,
          onChange: (e) => setTags(e.target.value)
        })
      )
    ),
    h('label', { className: 'field', style: { display: 'block', marginTop: 'var(--space-md)' } },
      h('div', { className: 'text-muted', style: { marginBottom: 6 } }, 'Notes'),
      h('textarea', {
        className: 'input',
        rows: 5,
        placeholder: 'What went well? What is confusing? What is the next tiny step?',
        value: notes,
        onChange: (e) => setNotes(e.target.value)
      })
    ),
    h('div', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-md)' } },
      h('button', { className: 'btn btn-primary', onClick: upsertEntry }, editingId ? '✅ Save changes' : '✅ Save entry'),
      h('button', { className: 'btn btn-secondary', onClick: resetForm }, '↩︎ Reset'),
      h('button', { className: 'btn btn-secondary', onClick: () => toast('Tip: add ?vmq-diagnostics in the URL for console hints.', 'info') }, 'ℹ️ Tip')
    ),
    todaysLog.length
      ? h('p', { className: 'text-muted', style: { marginTop: 'var(--space-md)' } },
          `Today: ${todaysLog.length} session(s) logged • ${fmtMinutes(todaysLog.reduce((s, x) => s + (Number(x.minutes) || 0), 0))}`
        )
      : null
  );

  const EntriesList = h(
    'div',
    { className: 'card elevated' },
    h('h2', { style: { marginTop: 0 } }, 'Recent entries'),
    journalEntries.length
      ? h('div', { style: { display: 'grid', gap: 'var(--space-md)' } },
          journalEntries.slice(0, 30).map((e) =>
            h('div', { key: e.id, className: 'card', style: { padding: 'var(--space-md)' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)', alignItems: 'baseline' } },
                h('div', null,
                  h('strong', null, `${e.date} • ${e.activity}`),
                  h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)', marginTop: 4 } },
                    `${e.minutes ? `${fmtMinutes(e.minutes)} • ` : ''}${e.tags ? `Tags: ${e.tags}` : 'No tags'}`
                  )
                ),
                h('div', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'flex-end' } },
                  h('button', { className: 'btn btn-secondary', onClick: () => startEdit(e) }, '✏️ Edit'),
                  h('button', { className: 'btn btn-danger', onClick: () => deleteEntry(e.id) }, '🗑 Delete')
                )
              ),
              h('div', { style: { marginTop: 'var(--space-sm)', whiteSpace: 'pre-wrap' } }, e.notes)
            )
          )
        )
      : h('p', { className: 'text-muted' }, 'No journal entries yet. Add a quick note above.')
  );

  const SessionsView = h(
    'div',
    null,
    h('div', { className: 'card elevated', style: { marginBottom: 'var(--space-lg)' } },
      h('h2', { style: { marginTop: 0 } }, 'This week'),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' } },
        h('div', null, h('div', { className: 'text-muted' }, 'Minutes'), h('div', null, fmtMinutes(weekTotals.mins))),
        h('div', null, h('div', { className: 'text-muted' }, 'XP earned'), h('div', null, String(Math.round(weekTotals.xp || 0)))),
        h('div', null, h('div', { className: 'text-muted' }, 'Questions'), h('div', null, String(Math.round(weekTotals.total || 0))))
      ),
      h('div', { style: { marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' } },
        h('button', { className: 'btn btn-secondary', onClick: () => setPracticeLog(loadPracticeLog()) }, '🔄 Refresh log'),
        h('button', { className: 'btn btn-secondary', onClick: () => setTab('journal') }, '📝 Add note')
      )
    ),
    h('div', { className: 'card elevated' },
      h('h2', { style: { marginTop: 0 } }, 'Recent sessions'),
      practiceLog.length
        ? h('div', { style: { display: 'grid', gap: 'var(--space-sm)' } },
            practiceLog.slice(0, 25).map((s, idx) =>
              h('div', { key: s.id || `${s.timestamp || idx}-${idx}`, className: 'card', style: { padding: 'var(--space-md)' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)' } },
                  h('div', null,
                    h('strong', null, safeStr(s.activity || 'Practice')),
                    h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)', marginTop: 4 } },
                      `${fmtDateTime(s.timestamp)} • ${fmtMinutes(s.minutes)}`
                    )
                  ),
                  h('div', { style: { textAlign: 'right' } },
                    h('div', null, `⭐ ${Number(s.xpEarned || 0) || 0}`),
                    h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)' } }, `Q: ${Number(s.total || 0) || 0}`)
                  )
                )
              )
            )
          )
        : h('p', { className: 'text-muted' }, 'No sessions logged yet.')
    )
  );

  return h(
    'div',
    { className: 'module-container' },
    Header,
    tab === 'journal'
      ? h('div', null, SessionCard, JournalForm, EntriesList)
      : h('div', null, SessionCard, SessionsView)
  );
}