// js/components/PracticeJournal.js
// ===================================
// VMQ Practice Journal — v1.0 (drop-in)
// No JSX. React.createElement style.
// Stores entries in STORAGE_KEYS.PRACTICE_LOG via config/storage helpers.
// ===================================

import { STORAGE_KEYS } from '../config/constants.js';
import * as storage from '../config/storage.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function loadEntries() {
  const raw = storage.loadJSON?.(STORAGE_KEYS.PRACTICE_LOG, []);
  return Array.isArray(raw) ? raw : [];
}

function saveEntries(entries) {
  storage.saveJSON?.(STORAGE_KEYS.PRACTICE_LOG, entries);
}

function emitToast(message, type = 'info') {
  try {
    window.dispatchEvent(new CustomEvent('vmq-show-toast', { detail: { message, type } }));
  } catch {}
}

export default function PracticeJournal(props = {}) {
  const { onBack, onNavigate } = props;

  const [entries, setEntries] = useState(() => loadEntries());
  const [filterText, setFilterText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [minutes, setMinutes] = useState('30');
  const [focus, setFocus] = useState('');      // e.g., "Accolay, Kreutzer 2, shifting"
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState('3');   // 1–5
  const [tags, setTags] = useState('');        // comma separated

  useEffect(() => {
    // Persist any external edits elsewhere
    saveEntries(entries);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = (filterText || '').trim().toLowerCase();
    if (!q) return entries.slice().sort((a, b) => (b.when || 0) - (a.when || 0));
    return entries
      .filter(e => {
        const hay = [
          e.date, e.focus, e.notes, (e.tags || []).join(', ')
        ].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.when || 0) - (a.when || 0));
  }, [entries, filterText]);

  function addEntry() {
    const entry = {
      id: uid(),
      when: Date.now(),
      date: (date || todayISO()),
      minutes: Math.max(0, safeNumber(minutes, 0)),
      focus: (focus || '').trim(),
      notes: (notes || '').trim(),
      rating: Math.min(5, Math.max(1, safeNumber(rating, 3))),
      tags: (tags || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    };

    setEntries(prev => [entry, ...prev]);
    setFocus('');
    setNotes('');
    setTags('');
    emitToast('Saved practice entry ✅', 'success');
  }

  function deleteEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id));
    emitToast('Entry deleted', 'info');
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vmq_practice_journal_${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearAll() {
    if (!confirm('Delete ALL journal entries?')) return;
    setEntries([]);
    emitToast('All entries cleared', 'warning');
  }

  const header = h('div', { className: 'module-header' },
    h('div', { className: 'module-header-left' },
      h('button', {
        className: 'btn btn-secondary',
        type: 'button',
        onClick: () => (typeof onBack === 'function' ? onBack() : onNavigate?.('menu'))
      }, '← Back'),
      h('h2', { className: 'module-title', style: { marginLeft: '12px' } }, 'Practice Journal')
    ),
    h('div', { className: 'module-header-right' },
      h('button', { className: 'btn btn-secondary', type: 'button', onClick: exportJSON }, 'Export'),
      h('button', { className: 'btn btn-danger', type: 'button', onClick: clearAll, style: { marginLeft: '8px' } }, 'Clear')
    )
  );

  const form = h('div', { className: 'card', style: { marginTop: '12px' } },
    h('div', { className: 'card-body' },
      h('div', { className: 'grid', style: { display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' } },
        h('label', null,
          h('div', { className: 'label' }, 'Date'),
          h('input', { type: 'date', value: date, onChange: e => setDate(e.target.value), className: 'input' })
        ),
        h('label', null,
          h('div', { className: 'label' }, 'Minutes'),
          h('input', { type: 'number', min: 0, inputMode: 'numeric', value: minutes, onChange: e => setMinutes(e.target.value), className: 'input' })
        ),
        h('label', { style: { gridColumn: '1 / -1' } },
          h('div', { className: 'label' }, 'Focus (pieces / drills)'),
          h('input', { type: 'text', value: focus, onChange: e => setFocus(e.target.value), className: 'input', placeholder: 'Accolay • Kreutzer #2 • 3rd position mapping…' })
        ),
        h('label', { style: { gridColumn: '1 / -1' } },
          h('div', { className: 'label' }, 'Notes'),
          h('textarea', { value: notes, onChange: e => setNotes(e.target.value), className: 'input', rows: 4, placeholder: 'What improved? What to target tomorrow?' })
        ),
        h('label', null,
          h('div', { className: 'label' }, 'Quality (1–5)'),
          h('select', { value: rating, onChange: e => setRating(e.target.value), className: 'input' },
            [1,2,3,4,5].map(n => h('option', { key: n, value: String(n) }, String(n)))
          )
        ),
        h('label', null,
          h('div', { className: 'label' }, 'Tags (comma separated)'),
          h('input', { type: 'text', value: tags, onChange: e => setTags(e.target.value), className: 'input', placeholder: 'tone, shifting, rhythm…' })
        )
      ),
      h('div', { style: { marginTop: '10px', display: 'flex', gap: '10px' } },
        h('button', { className: 'btn btn-primary', type: 'button', onClick: addEntry }, 'Save Entry'),
        h('input', {
          className: 'input',
          type: 'search',
          value: filterText,
          onChange: e => setFilterText(e.target.value),
          placeholder: 'Search entries…',
          style: { flex: 1 }
        })
      )
    )
  );

  const list = h('div', { className: 'card', style: { marginTop: '12px' } },
    h('div', { className: 'card-body' },
      filtered.length === 0
        ? h('div', { className: 'muted' }, 'No journal entries yet.')
        : h('div', { style: { display: 'grid', gap: '10px' } },
            filtered.map(e =>
              h('div', { key: e.id, className: 'card', style: { border: '1px solid rgba(255,255,255,.08)' } },
                h('div', { className: 'card-body' },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' } },
                    h('div', null,
                      h('div', { style: { fontWeight: 700 } }, `${e.date || ''} • ${e.minutes || 0} min • ${'★'.repeat(e.rating || 3)}`),
                      e.focus ? h('div', { className: 'muted', style: { marginTop: '4px' } }, e.focus) : null
                    ),
                    h('button', { className: 'btn btn-secondary', type: 'button', onClick: () => deleteEntry(e.id) }, 'Delete')
                  ),
                  e.notes ? h('div', { style: { marginTop: '8px', whiteSpace: 'pre-wrap' } }, e.notes) : null,
                  (e.tags && e.tags.length)
                    ? h('div', { style: { marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' } },
                        e.tags.map(t => h('span', { key: t, className: 'chip' }, t))
                      )
                    : null
                )
              )
            )
          )
    )
  );

  return h('div', { className: 'module-container' }, header, form, list);
}
