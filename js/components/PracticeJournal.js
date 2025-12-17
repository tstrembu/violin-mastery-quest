// js/components/PracticeJournal.js
// ============================================================
// VMQ Practice Journal v1.0.0 (Drop-in)
// - React UMD (no JSX)
// - GH Pages subpath safe (relative imports)
// - iOS Safari safe (no unsupported APIs required)
// - Uses VMQ storage wrapper (loadJSON/saveJSON) with fallbacks
// - Provides: add entry, edit, delete, search, export/import
// ============================================================

import { STORAGE_KEYS, loadJSON, saveJSON, isStorageAvailable } from '../config/storage.js';
import { trackEvent } from '../engines/analytics.js';

const { createElement: h, useEffect, useMemo, useRef, useState, useCallback } = React;

const KEY =
  (STORAGE_KEYS && (STORAGE_KEYS.JOURNAL || STORAGE_KEYS.PRACTICE_LOG)) ||
  'vmq.journal';

function uid(prefix = 'jrnl') {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function toast(message, type = 'info') {
  try {
    const api = window.VMQToast;
    if (api?.toastHelpers?.[type]) return api.toastHelpers[type](message, { source: 'journal' });
    if (typeof api?.addToast === 'function') return api.addToast(message, type, 3500, { source: 'journal' });
  } catch {}
  return null;
}

function safeTrack(action, label, data = {}) {
  try {
    if (typeof trackEvent === 'function') trackEvent('journal', action, { label, ...data });
  } catch {}
}

function loadEntries() {
  try {
    const v = loadJSON(KEY, []);
    return safeArray(v);
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  try {
    saveJSON(KEY, safeArray(entries));
    return true;
  } catch {
    return false;
  }
}

function normalizeTags(str) {
  const raw = String(str || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function entryToEditable(e) {
  return {
    id: e?.id || uid(),
    date: e?.date || todayISODate(),
    title: e?.title || '',
    notes: e?.notes || '',
    durationMin: Number.isFinite(Number(e?.durationMin)) ? Number(e.durationMin) : '',
    mood: Number.isFinite(Number(e?.mood)) ? Number(e.mood) : '',
    tagsText: safeArray(e?.tags).join(', ')
  };
}

export default function PracticeJournal(props = {}) {
  const onBack = typeof props.onBack === 'function' ? props.onBack : null;

  const [entries, setEntries] = useState(() => loadEntries());
  const [mode, setMode] = useState('list'); // 'list' | 'new' | 'edit'
  const [draft, setDraft] = useState(() => entryToEditable(null));
  const [search, setSearch] = useState('');
  const [onlyToday, setOnlyToday] = useState(false);

  const autosaveTimer = useRef(null);

  // Persist on change (debounced)
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveEntries(entries);
    }, 200);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [entries]);

  // If storage becomes available later (rare iOS edge), refresh once
  useEffect(() => {
    try {
      if (!isStorageAvailable?.()) return;
      // If state is empty but storage has data, restore
      const stored = loadEntries();
      if (!entries.length && stored.length) setEntries(stored);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    const t = todayISODate();

    return safeArray(entries)
      .filter(e => {
        if (onlyToday && e?.date !== t) return false;
        if (!q) return true;
        const hay = [
          e?.date,
          e?.title,
          e?.notes,
          safeArray(e?.tags).join(' ')
        ].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = Number.isFinite(Number(a?.timestamp)) ? Number(a.timestamp) : new Date(a?.date || 0).getTime();
        const tb = Number.isFinite(Number(b?.timestamp)) ? Number(b.timestamp) : new Date(b?.date || 0).getTime();
        return tb - ta;
      });
  }, [entries, search, onlyToday]);

  const startNew = useCallback(() => {
    setDraft(entryToEditable(null));
    setMode('new');
    safeTrack('open', 'new');
  }, []);

  const startEdit = useCallback((entry) => {
    setDraft(entryToEditable(entry));
    setMode('edit');
    safeTrack('open', 'edit', { id: entry?.id });
  }, []);

  const cancelEdit = useCallback(() => {
    setMode('list');
    setDraft(entryToEditable(null));
  }, []);

  const updateDraft = useCallback((key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const validateDraft = useCallback(() => {
    const title = String(draft.title || '').trim();
    const notes = String(draft.notes || '').trim();
    if (!title && !notes) {
      toast('Add a title or notes before saving.', 'warning');
      return false;
    }
    return true;
  }, [draft]);

  const saveDraft = useCallback(() => {
    if (!validateDraft()) return;

    const normalized = {
      id: draft.id || uid(),
      date: String(draft.date || todayISODate()),
      title: String(draft.title || '').trim(),
      notes: String(draft.notes || '').trim(),
      durationMin: draft.durationMin === '' ? null : Number(draft.durationMin),
      mood: draft.mood === '' ? null : Number(draft.mood),
      tags: normalizeTags(draft.tagsText),
      timestamp: Date.now()
    };

    setEntries(prev => {
      const list = safeArray(prev);
      const idx = list.findIndex(e => e?.id === normalized.id);
      if (idx >= 0) {
        const next = list.slice();
        next[idx] = { ...list[idx], ...normalized };
        return next;
      }
      return [normalized, ...list];
    });

    setMode('list');
    setDraft(entryToEditable(null));
    toast('Saved journal entry.', 'success');
    safeTrack('save', mode === 'edit' ? 'edit' : 'new', { id: normalized.id });
  }, [draft, mode, validateDraft]);

  const deleteEntry = useCallback((id) => {
    if (!id) return;
    const ok = window.confirm('Delete this journal entry?');
    if (!ok) return;

    setEntries(prev => safeArray(prev).filter(e => e?.id !== id));
    toast('Deleted entry.', 'info');
    safeTrack('delete', 'entry', { id });
  }, []);

  const exportJSON = useCallback(() => {
    try {
      const payload = {
        version: 'vmq-journal-1',
        exportedAt: new Date().toISOString(),
        entries: safeArray(entries)
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vmq-practice-journal-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Exported journal JSON.', 'success');
      safeTrack('export', 'json', { count: entries.length });
    } catch (e) {
      toast('Export failed.', 'error');
    }
  }, [entries]);

  const importJSON = useCallback(async (file) => {
    try {
      if (!file) return;
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = safeArray(parsed?.entries || parsed || []);
      if (!incoming.length) {
        toast('Import file has no entries.', 'warning');
        return;
      }

      // Merge by id (incoming wins)
      setEntries(prev => {
        const map = new Map();
        safeArray(prev).forEach(e => { if (e?.id) map.set(e.id, e); });
        incoming.forEach(e => {
          const id = e?.id || uid();
          map.set(id, { ...e, id });
        });
        return Array.from(map.values()).sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
      });

      toast('Imported journal entries.', 'success');
      safeTrack('import', 'json', { count: incoming.length });
    } catch (e) {
      toast('Import failed (invalid JSON).', 'error');
    }
  }, []);

  const renderHeader = () => {
    return h(
      'div',
      { className: 'module-header' },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' } },
        h(
          'div',
          null,
          h('h1', { style: { margin: 0 } }, 'Practice Journal'),
          h('p', { className: 'text-muted', style: { margin: 'var(--space-xs) 0 0' } },
            'Quick reflections, practice notes, and progress snapshots.'
          )
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'flex-end' } },
          onBack && h('button', { className: 'btn btn-secondary', onClick: onBack }, '← Back'),
          h('button', { className: 'btn btn-primary', onClick: startNew }, '＋ New Entry')
        )
      )
    );
  };

  const renderList = () => {
    return h(
      'div',
      { className: 'card' },
      h(
        'div',
        { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-md)' } },
        h('input', {
          className: 'input',
          style: { flex: '1 1 220px' },
          placeholder: 'Search title, notes, tags…',
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }),
        h(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' } },
          h('input', {
            type: 'checkbox',
            checked: !!onlyToday,
            onChange: (e) => setOnlyToday(!!e.target.checked)
          }),
          h('span', null, 'Today')
        ),
        h('button', { className: 'btn btn-secondary', onClick: exportJSON }, 'Export'),
        h('label', { className: 'btn btn-secondary', style: { cursor: 'pointer' } },
          'Import',
          h('input', {
            type: 'file',
            accept: 'application/json',
            style: { display: 'none' },
            onChange: (e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = '';
              importJSON(f);
            }
          })
        )
      ),
      filtered.length === 0
        ? h(
            'div',
            { className: 'text-muted', style: { padding: 'var(--space-lg)', textAlign: 'center' } },
            h('div', { style: { fontSize: '2rem', marginBottom: 'var(--space-sm)' } }, '📝'),
            h('div', null, 'No entries yet.'),
            h('div', { style: { marginTop: 'var(--space-sm)' } }, 'Tap “New Entry” to start.')
          )
        : h(
            'div',
            { style: { display: 'grid', gap: 'var(--space-sm)' } },
            filtered.map(e => {
              const tags = safeArray(e?.tags);
              const dur = Number.isFinite(Number(e?.durationMin)) ? `${Number(e.durationMin)} min` : null;
              const mood = Number.isFinite(Number(e?.mood)) ? `Mood: ${Number(e.mood)}/5` : null;

              return h(
                'div',
                { key: e?.id, className: 'card', style: { padding: 'var(--space-md)' } },
                h(
                  'div',
                  { style: { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)', alignItems: 'flex-start' } },
                  h(
                    'div',
                    { style: { minWidth: 0 } },
                    h('div', { className: 'text-muted', style: { fontSize: 'var(--font-size-sm)' } }, e?.date || ''),
                    h('div', { style: { fontWeight: 700, fontSize: 'var(--font-size-lg)', overflow: 'hidden', textOverflow: 'ellipsis' } },
                      e?.title || '(Untitled)'
                    ),
                    (dur || mood) && h(
                      'div',
                      { className: 'text-muted', style: { marginTop: '4px', fontSize: 'var(--font-size-sm)' } },
                      [dur, mood].filter(Boolean).join(' • ')
                    )
                  ),
                  h(
                    'div',
                    { style: { display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', justifyContent: 'flex-end' } },
                    h('button', { className: 'btn btn-secondary', onClick: () => startEdit(e) }, 'Edit'),
                    h('button', { className: 'btn btn-danger', onClick: () => deleteEntry(e?.id) }, 'Delete')
                  )
                ),
                e?.notes && h(
                  'div',
                  { style: { marginTop: 'var(--space-sm)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } },
                  e.notes
                ),
                tags.length > 0 && h(
                  'div',
                  { style: { marginTop: 'var(--space-sm)', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                  tags.map(t => h('span', { key: t, className: 'chip' }, t))
                )
              );
            })
          )
    );
  };

  const renderEditor = () => {
    const isEdit = mode === 'edit';
    return h(
      'div',
      { className: 'card' },
      h('h2', { style: { marginTop: 0 } }, isEdit ? 'Edit Entry' : 'New Entry'),
      h(
        'div',
        { style: { display: 'grid', gap: 'var(--space-md)' } },
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' } },
          h(
            'div',
            null,
            h('label', { className: 'label' }, 'Date'),
            h('input', {
              className: 'input',
              type: 'date',
              value: draft.date,
              onChange: (e) => updateDraft('date', e.target.value || todayISODate())
            })
          ),
          h(
            'div',
            null,
            h('label', { className: 'label' }, 'Duration (minutes)'),
            h('input', {
              className: 'input',
              type: 'number',
              inputMode: 'numeric',
              min: 0,
              placeholder: 'e.g., 30',
              value: draft.durationMin,
              onChange: (e) => updateDraft('durationMin', e.target.value === '' ? '' : Number(e.target.value))
            })
          )
        ),
        h(
          'div',
          null,
          h('label', { className: 'label' }, 'Title'),
          h('input', {
            className: 'input',
            placeholder: 'e.g., Accolay: intonation + bow distribution',
            value: draft.title,
            onChange: (e) => updateDraft('title', e.target.value)
          })
        ),
        h(
          'div',
          null,
          h('label', { className: 'label' }, 'Notes'),
          h('textarea', {
            className: 'input',
            rows: 7,
            placeholder: 'What improved? What felt tricky? What’s the next tiny goal?',
            value: draft.notes,
            onChange: (e) => updateDraft('notes', e.target.value)
          })
        ),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' } },
          h(
            'div',
            null,
            h('label', { className: 'label' }, 'Mood (1–5)'),
            h('input', {
              className: 'input',
              type: 'number',
              inputMode: 'numeric',
              min: 1,
              max: 5,
              placeholder: 'optional',
              value: draft.mood,
              onChange: (e) => updateDraft('mood', e.target.value === '' ? '' : Number(e.target.value))
            })
          ),
          h(
            'div',
            null,
            h('label', { className: 'label' }, 'Tags (comma separated)'),
            h('input', {
              className: 'input',
              placeholder: 'intonation, rhythm, Kreutzer',
              value: draft.tagsText,
              onChange: (e) => updateDraft('tagsText', e.target.value)
            })
          )
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' } },
          h('button', { className: 'btn btn-primary', onClick: saveDraft }, 'Save'),
          h('button', { className: 'btn btn-secondary', onClick: cancelEdit }, 'Cancel')
        )
      )
    );
  };

  return h(
    'div',
    { className: 'module-container' },
    renderHeader(),
    mode === 'list' ? renderList() : renderEditor()
  );
}