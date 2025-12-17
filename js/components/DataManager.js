// js/components/DataManager.js

/* =========================================================
   VMQ — DataManager.js (Drop-in)
   Purpose:
   - UI + utilities to export/import/clear VMQ app data
   - Works in plain ESM + React UMD (no JSX)
   - Safe defaults for GitHub Pages + iOS Safari
   - Provides BOTH:
       1) a route component (default export)
       2) export class DataManager (for programmatic use)

   Notes:
   - VMQ appears to store much in localStorage (e.g., "vmq-profile").
   - This manager:
       • exports selected keys (default: VMQ-ish keys)
       • imports JSON backup (merge or replace)
       • clears selected keys
       • shows approximate storage footprint
   ========================================================= */

const ReactGlobal = (typeof React !== 'undefined') ? React : null;
if (!ReactGlobal) {
  // Fail loudly but safely if someone opens this route without React loaded
  throw new Error('VMQ DataManager requires React (UMD) to be loaded before this module.');
}

const {
  createElement: h,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback
} = ReactGlobal;

/* ---------------------------------------------------------
   Small helpers
--------------------------------------------------------- */
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
  // Rough byte estimate for UTF-16 in JS strings (2 bytes per char)
  if (!str) return 0;
  return str.length * 2;
}

function humanBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function downloadTextFile(filename, text, mime = 'application/json') {
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
  // iOS Safari can be finicky; try modern API then fallback
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // Fallback: hidden textarea
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

function getLocalStorageKeys() {
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

function writeLocalStorageKey(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function removeLocalStorageKey(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}

/* ---------------------------------------------------------
   Heuristics: “VMQ-ish keys”
   (You can expand these safely later.)
--------------------------------------------------------- */
const DEFAULT_KEY_PREFIXES = [
  'vmq',        // vmq-profile, vmq-*, etc.
  'VMQ',        // sometimes apps use caps
  'sm2',        // spaced repetition
  'sr',         // spaced repetition
  'spaced',     // spaced repetition
  'difficulty', // difficulty adapter
  'analytics',  // analytics engine
  'session',    // session tracker
  'practice',   // practice plans/journal
  'journal'     // journal
];

function isLikelyVMQKey(key) {
  const k = String(key || '');
  const lower = k.toLowerCase();
  // Strong signal: starts with vmq
  if (lower.startsWith('vmq')) return true;
  // Common “engine” buckets
  return DEFAULT_KEY_PREFIXES.some((p) => lower.startsWith(String(p).toLowerCase()));
}

/* =========================================================
   DataManager (programmatic API)
   ========================================================= */
export class DataManager {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.namespace] - used in metadata only
   */
  constructor(opts = {}) {
    this.namespace = opts.namespace || 'vmq';
  }

  listKeys() {
    return getLocalStorageKeys();
  }

  listLikelyVMQKeys() {
    return this.listKeys().filter(isLikelyVMQKey);
  }

  /**
   * Export selected keys to a VMQ backup object.
   * @param {string[]} keys
   * @param {Object} [metaExtras]
   */
  export(keys, metaExtras = {}) {
    const selected = Array.isArray(keys) ? keys : [];
    const data = {};
    let bytes = 0;

    selected.forEach((k) => {
      const v = readLocalStorageKey(k);
      if (v !== null && v !== undefined) {
        data[k] = v;
        bytes += approxBytes(v) + approxBytes(k);
      }
    });

    return {
      meta: {
        app: 'VMQ',
        namespace: this.namespace,
        exportedAt: nowISO(),
        keyCount: Object.keys(data).length,
        approxBytes: bytes,
        ...metaExtras
      },
      data
    };
  }

  /**
   * Import a VMQ backup object.
   * @param {Object} backupObj - expects {meta, data}
   * @param {"merge"|"replace"} mode
   * @returns {{ok:boolean, written:number, removed:number, errors:string[]}}
   */
  import(backupObj, mode = 'merge') {
    const errors = [];
    const data = backupObj?.data;

    if (!data || typeof data !== 'object') {
      return { ok: false, written: 0, removed: 0, errors: ['Invalid backup: missing "data" object.'] };
    }

    const incomingKeys = Object.keys(data);
    let removed = 0;
    let written = 0;

    if (mode === 'replace') {
      // Only remove keys that look like VMQ keys by default,
      // *unless* the backup explicitly includes broader keys.
      const toRemove = new Set(this.listLikelyVMQKeys());
      incomingKeys.forEach((k) => toRemove.add(k));

      toRemove.forEach((k) => {
        const ok = removeLocalStorageKey(k);
        if (ok) removed++;
      });
    }

    incomingKeys.forEach((k) => {
      const v = data[k];
      // Backup stores values as strings (localStorage values), but accept objects too.
      let toStore = v;
      if (typeof v !== 'string') {
        const s = safeJSONStringify(v);
        if (!s.ok) {
          errors.push(`Could not stringify value for key "${k}".`);
          return;
        }
        toStore = s.value;
      }
      const ok = writeLocalStorageKey(k, toStore);
      if (ok) written++;
      else errors.push(`Failed to write key "${k}" (storage quota or blocked).`);
    });

    return { ok: errors.length === 0, written, removed, errors };
  }

  /**
   * Clear selected keys.
   * @param {string[]} keys
   */
  clear(keys) {
    const selected = Array.isArray(keys) ? keys : [];
    let removed = 0;
    const errors = [];
    selected.forEach((k) => {
      const ok = removeLocalStorageKey(k);
      if (ok) removed++;
      else errors.push(`Failed to remove "${k}".`);
    });
    return { ok: errors.length === 0, removed, errors };
  }

  /**
   * Quick storage report.
   */
  report(keys = null) {
    const list = (Array.isArray(keys) && keys.length) ? keys : this.listKeys();
    const rows = list.map((k) => {
      const v = readLocalStorageKey(k) || '';
      return { key: k, bytes: approxBytes(v) + approxBytes(k) };
    });
    const total = rows.reduce((sum, r) => sum + r.bytes, 0);
    return {
      totalBytes: total,
      totalHuman: humanBytes(total),
      items: rows.sort((a, b) => b.bytes - a.bytes)
    };
  }
}

/* =========================================================
   UI Component (Route Page)
   ========================================================= */

function StatusBar({ kind, text }) {
  const cls = `status ${kind || 'muted'} small`;
  return h('div', { className: cls, role: 'status', 'aria-live': 'polite' }, text || '');
}

function SectionTitle({ children }) {
  return h('h2', { style: { margin: '0 0 0.5rem 0' } }, children);
}

function MonoBlock({ value, rows = 10, onChange, placeholder }) {
  return h('textarea', {
    className: 'mono',
    value: value || '',
    placeholder: placeholder || '',
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

function KeyRow({ k, sizeHuman, checked, onToggle }) {
  return h('label', {
    className: 'row',
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      padding: '0.5rem 0'
    }
  }, [
    h('span', { style: { display: 'flex', alignItems: 'center', gap: '0.6rem' } }, [
      h('input', {
        type: 'checkbox',
        checked: !!checked,
        onChange: () => onToggle?.(k),
        style: { transform: 'scale(1.15)' }
      }),
      h('span', { className: 'mono', style: { fontSize: '0.95rem' } }, k)
    ]),
    h('span', { className: 'muted small', style: { whiteSpace: 'nowrap' } }, sizeHuman)
  ]);
}

function getVMQVersionGuess() {
  // Best-effort. Some apps set window.VMQ.version or similar.
  const v = (window.VMQ?.version || window.VMQ?.VERSION || window.__VMQ_VERSION__);
  return v ? String(v) : 'unknown';
}

function buildDefaultFilename() {
  const date = nowISO().replace(/[:.]/g, '-');
  return `vmq-backup-${date}.json`;
}

function DataManagerRoute() {
  const dmRef = useRef(null);
  if (!dmRef.current) dmRef.current = new DataManager({ namespace: 'vmq' });

  const [allKeys, setAllKeys] = useState([]);
  const [onlyVMQ, setOnlyVMQ] = useState(true);

  const [selected, setSelected] = useState(() => new Set());
  const [status, setStatus] = useState({ kind: 'muted', text: 'Ready.' });

  const [mode, setMode] = useState('merge'); // merge | replace
  const [backupText, setBackupText] = useState('');
  const [lastExport, setLastExport] = useState(null);

  const [search, setSearch] = useState('');

  const refreshKeys = useCallback(() => {
    const keys = getLocalStorageKeys();
    setAllKeys(keys);
  }, []);

  useEffect(() => {
    refreshKeys();
  }, [refreshKeys]);

  const visibleKeys = useMemo(() => {
    const base = onlyVMQ ? allKeys.filter(isLikelyVMQKey) : allKeys.slice();
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((k) => String(k).toLowerCase().includes(q));
  }, [allKeys, onlyVMQ, search]);

  const keySizes = useMemo(() => {
    const map = new Map();
    visibleKeys.forEach((k) => {
      const v = readLocalStorageKey(k) || '';
      const b = approxBytes(v) + approxBytes(k);
      map.set(k, { bytes: b, human: humanBytes(b) });
    });
    return map;
  }, [visibleKeys]);

  const report = useMemo(() => {
    const keys = Array.from(selected);
    const r = dmRef.current.report(keys.length ? keys : (onlyVMQ ? dmRef.current.listLikelyVMQKeys() : dmRef.current.listKeys()));
    return r;
  }, [selected, onlyVMQ]);

  const selectedCount = selected.size;

  const toggleKey = useCallback((k) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      visibleKeys.forEach((k) => next.add(k));
      return next;
    });
    setStatus({ kind: 'ok', text: `Selected ${visibleKeys.length} keys.` });
  }, [visibleKeys]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setStatus({ kind: 'muted', text: 'Selection cleared.' });
  }, []);

  const exportSelected = useCallback(() => {
    const keys = Array.from(selected);
    if (!keys.length) {
      setStatus({ kind: 'warn', text: 'Select at least one key to export.' });
      return;
    }
    const backup = dmRef.current.export(keys, {
      version: getVMQVersionGuess(),
      exportedFrom: window.location.href
    });

    const s = safeJSONStringify(backup, 2);
    if (!s.ok) {
      setStatus({ kind: 'danger', text: 'Export failed: could not serialize backup.' });
      return;
    }

    setLastExport(backup);
    setBackupText(s.value);
    setStatus({ kind: 'ok', text: `Exported ${backup.meta.keyCount} keys (${humanBytes(backup.meta.approxBytes)}).` });

    // Let the app know something happened (harmless if nobody listens)
    window.dispatchEvent(new CustomEvent('vmq-data-exported', { detail: backup.meta }));
  }, [selected]);

  const downloadBackup = useCallback(() => {
    if (!backupText.trim()) {
      setStatus({ kind: 'warn', text: 'Nothing to download yet. Export first.' });
      return;
    }
    downloadTextFile(buildDefaultFilename(), backupText, 'application/json');
    setStatus({ kind: 'ok', text: 'Backup downloaded.' });
  }, [backupText]);

  const copyBackup = useCallback(async () => {
    if (!backupText.trim()) {
      setStatus({ kind: 'warn', text: 'Nothing to copy yet. Export first.' });
      return;
    }
    try {
      const ok = await copyToClipboard(backupText);
      setStatus({ kind: ok ? 'ok' : 'warn', text: ok ? 'Backup copied to clipboard.' : 'Copy failed (browser restriction).' });
    } catch (e) {
      setStatus({ kind: 'warn', text: `Copy failed: ${String(e?.message || e)}` });
    }
  }, [backupText]);

  const importFromText = useCallback(() => {
    const raw = backupText.trim();
    if (!raw) {
      setStatus({ kind: 'warn', text: 'Paste a backup JSON first.' });
      return;
    }

    const parsed = safeJSONParse(raw);
    if (!parsed.ok) {
      setStatus({ kind: 'danger', text: 'Invalid JSON. Paste a valid VMQ backup.' });
      return;
    }

    const result = dmRef.current.import(parsed.value, mode);
    if (!result.ok) {
      setStatus({ kind: 'warn', text: `Import completed with issues. Written: ${result.written}. Errors: ${result.errors.length}` });
    } else {
      setStatus({ kind: 'ok', text: `Import successful. Written: ${result.written}${mode === 'replace' ? `, removed: ${result.removed}` : ''}.` });
    }

    refreshKeys();
    window.dispatchEvent(new CustomEvent('vmq-data-imported', { detail: { mode, ...result } }));
  }, [backupText, mode, refreshKeys]);

  const clearSelected = useCallback(() => {
    const keys = Array.from(selected);
    if (!keys.length) {
      setStatus({ kind: 'warn', text: 'Select at least one key to clear.' });
      return;
    }
    const confirmMsg = `Delete ${keys.length} selected key(s) from this device? This cannot be undone.`;
    // iOS-friendly confirm
    if (!window.confirm(confirmMsg)) return;

    const res = dmRef.current.clear(keys);
    if (res.ok) setStatus({ kind: 'ok', text: `Removed ${res.removed} key(s).` });
    else setStatus({ kind: 'warn', text: `Removed ${res.removed} key(s) with issues: ${res.errors.length} error(s).` });

    setSelected(new Set());
    refreshKeys();
    window.dispatchEvent(new CustomEvent('vmq-data-cleared', { detail: res }));
  }, [selected, refreshKeys]);

  const handleFilePick = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setBackupText(text);
      setStatus({ kind: 'ok', text: `Loaded file "${file.name}" (${humanBytes(approxBytes(text))}). Ready to import.` });
    };
    reader.onerror = () => {
      setStatus({ kind: 'danger', text: 'Could not read file.' });
    };
    reader.readAsText(file);
  }, []);

  return h('main', { className: 'module-container' }, [

    h('div', { className: 'module-header elevated' }, [
      h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' } }, [
        h('div', null, [
          h('h1', { style: { margin: 0 } }, 'Data Manager'),
          h('p', { className: 'muted', style: { margin: '0.25rem 0 0 0' } },
            'Export, backup, import, and clear VMQ data stored on this device.'
          )
        ]),
        h('div', { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } }, [
          h('button', { className: 'btn btn-secondary', type: 'button', onClick: refreshKeys }, 'Refresh'),
          h('button', { className: 'btn btn-secondary', type: 'button', onClick: () => window.history.back() }, 'Back')
        ])
      ])
    ]),

    h('div', { className: 'card elevated', style: { marginTop: '1rem' } }, [
      SectionTitle({ children: 'Key Discovery' }),

      h('div', { className: 'row', style: { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' } }, [
        h('label', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } }, [
          h('input', {
            type: 'checkbox',
            checked: onlyVMQ,
            onChange: (e) => setOnlyVMQ(!!e.target.checked)
          }),
          h('span', null, 'Show VMQ keys only (recommended)')
        ]),
        h('div', { style: { flex: '1 1 240px' } }, [
          h('input', {
            type: 'text',
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: 'Filter keys (type to search)…',
            className: 'note-input',
            style: { width: '100%' }
          })
        ])
      ]),

      h('p', { className: 'muted small', style: { marginTop: '0.75rem' } },
        `Visible keys: ${visibleKeys.length} • Selected: ${selectedCount} • Approx size (selected or VMQ default): ${report.totalHuman}`
      ),

      h('div', { className: 'row', style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' } }, [
        h('button', { className: 'btn btn-primary', type: 'button', onClick: selectAllVisible }, 'Select All Visible'),
        h('button', { className: 'btn btn-secondary', type: 'button', onClick: clearSelection }, 'Clear Selection'),
        h('button', { className: 'btn btn-secondary', type: 'button', onClick: clearSelected }, 'Delete Selected')
      ]),

      h('hr', { style: { margin: '1rem 0', opacity: 0.25 } }),

      h('div', {
        style: {
          maxHeight: '38vh',
          overflow: 'auto',
          paddingRight: '0.25rem'
        }
      }, visibleKeys.length ? (
        visibleKeys.map((k) =>
          KeyRow({
            k,
            sizeHuman: keySizes.get(k)?.human || '',
            checked: selected.has(k),
            onToggle: toggleKey
          })
        )
      ) : h('p', { className: 'muted' }, 'No keys found (try turning off “VMQ keys only”).')),

      StatusBar({ kind: status.kind, text: status.text })
    ]),

    h('div', { className: 'card elevated', style: { marginTop: '1rem' } }, [
      SectionTitle({ children: 'Export / Backup' }),

      h('p', { className: 'muted small' },
        'Export the selected keys into a JSON backup. You can download it, copy it, or paste it into a safe note.'
      ),

      h('div', { className: 'row', style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } }, [
        h('button', { className: 'btn btn-primary', type: 'button', onClick: exportSelected }, 'Export Selected'),
        h('button', { className: 'btn btn-secondary', type: 'button', onClick: downloadBackup }, 'Download JSON'),
        h('button', { className: 'btn btn-secondary', type: 'button', onClick: copyBackup }, 'Copy JSON')
      ]),

      lastExport ? h('p', { className: 'muted small', style: { marginTop: '0.75rem' } },
        `Last export: ${lastExport.meta.keyCount} key(s), ${humanBytes(lastExport.meta.approxBytes)} • version: ${String(lastExport.meta.version || 'unknown')}`
      ) : null,

      h('div', { style: { marginTop: '0.75rem' } }, [
        MonoBlock({
          value: backupText,
          onChange: setBackupText,
          rows: 10,
          placeholder: 'Exported backup JSON will appear here…'
        })
      ])
    ]),

    h('div', { className: 'card elevated', style: { marginTop: '1rem' } }, [
      SectionTitle({ children: 'Import / Restore' }),

      h('p', { className: 'muted small' },
        'Paste a VMQ backup JSON above, or load a JSON file, then choose merge or replace and import.'
      ),

      h('div', { className: 'row', style: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' } }, [
        h('label', { className: 'muted small' }, 'Import mode:'),
        h('select', {
          value: mode,
          onChange: (e) => setMode(e.target.value),
          className: 'note-input',
          style: { maxWidth: '220px' }
        }, [
          h('option', { value: 'merge' }, 'Merge (recommended)'),
          h('option', { value: 'replace' }, 'Replace VMQ keys (destructive)')
        ]),

        h('label', { className: 'btn btn-secondary', style: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem' } }, [
          h('input', {
            type: 'file',
            accept: 'application/json,.json',
            style: { display: 'none' },
            onChange: (e) => handleFilePick(e.target.files?.[0] || null)
          }),
          'Load JSON File…'
        ]),

        h('button', { className: 'btn btn-primary', type: 'button', onClick: importFromText }, 'Import Now')
      ]),

      h('details', { style: { marginTop: '0.75rem' } }, [
        h('summary', { className: 'muted' }, 'Import tips (iPhone-friendly)'),
        h('div', { className: 'muted small', style: { marginTop: '0.5rem', lineHeight: 1.4 } }, [
          h('p', null, '• If clipboard paste is flaky, use “Load JSON File…” from Files app.'),
          h('p', null, '• Use Merge unless you truly want to wipe VMQ keys and replace them.'),
          h('p', null, '• After importing, go back to Home and refresh/reload the app if you don’t see changes immediately.')
        ])
      ])
    ]),

    h('div', { className: 'card elevated', style: { marginTop: '1rem', marginBottom: '2rem' } }, [
      SectionTitle({ children: 'Storage Summary' }),

      h('p', { className: 'muted small' },
        'This is an approximate footprint based on localStorage string sizes.'
      ),

      h('div', { className: 'row', style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' } }, [
        h('div', { className: 'chip warn', style: { padding: '0.5rem 0.75rem' } },
          `Approx size: ${report.totalHuman}`
        ),
        h('div', { className: 'chip', style: { padding: '0.5rem 0.75rem' } },
          `Visible keys: ${visibleKeys.length}`
        ),
        h('div', { className: 'chip', style: { padding: '0.5rem 0.75rem' } },
          `Selected keys: ${selectedCount}`
        )
      ]),

      h('details', { style: { marginTop: '0.75rem' } }, [
        h('summary', { className: 'muted' }, 'Largest items'),
        h('div', { style: { marginTop: '0.5rem' } }, (
          dmRef.current.report(onlyVMQ ? dmRef.current.listLikelyVMQKeys() : dmRef.current.listKeys())
            .items.slice(0, 10)
            .map((it) =>
              h('div', { className: 'row', style: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem' } }, [
                h('span', { className: 'mono', style: { fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.key),
                h('span', { className: 'muted small', style: { whiteSpace: 'nowrap' } }, humanBytes(it.bytes))
              ])
            )
        ))
      ])
    ])
  ]);
}

/* ---------------------------------------------------------
   Exports for router compatibility
   - Default export: component
   - Named exports: DataManagerRoute + DataManager (class already exported)
--------------------------------------------------------- */
export default DataManagerRoute;
export { DataManagerRoute };