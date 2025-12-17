// js/components/DataManager.js
// =============================================================
// Data Manager v3.0.5 – Export / Import / Reset user data
// Provides JSON export, import, and clearing of local storage keys.
// Works with React UMD, uses existing helpers, and shows notifications.
// =============================================================

const ReactGlobal = (typeof React !== 'undefined') ? React : null;
if (!ReactGlobal) {
  throw new Error('DataManager requires React (UMD) before this module.');
}

const {
  createElement: h,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback
} = ReactGlobal;

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import {
  exportDeck as exportSM2Deck,
  importDeck as importSM2Deck
} from '../engines/spacedRepetition.js';
import { downloadJSON } from '../utils/helpers.js';
import { useNotifications } from '../contexts/AppContext.js';

/* Helper functions */
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
  return str ? str.length * 2 : 0;
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
function getLocalStorageKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  return keys.sort((a, b) => a.localeCompare(b));
}
function readLocalStorageKey(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function writeLocalStorageKey(k, v) {
  try { localStorage.setItem(k, v); return true; } catch { return false; }
}
function removeLocalStorageKey(k) {
  try { localStorage.removeItem(k); return true; } catch { return false; }
}
function isLikelyVMQKey(key) {
  const lower = String(key).toLowerCase();
  return (
    lower.startsWith('vmq') ||
    lower.startsWith('practice') ||
    lower.startsWith('session') ||
    lower.includes('spaced') ||
    lower.includes('sr') ||
    lower.includes('sm2') ||
    lower.includes('difficulty') ||
    lower.includes('achievement') ||
    lower.includes('analytics')
  );
}

/* Programmatic API class */
export class DataManager {
  constructor(opts = {}) {
    this.namespace = opts.namespace || 'vmq';
  }

  listKeys() {
    return getLocalStorageKeys();
  }

  listLikelyVMQKeys() {
    return this.listKeys().filter(isLikelyVMQKey);
  }

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

  import(backupObj, mode = 'merge') {
    const result = { ok: true, written: 0, removed: 0, errors: [] };
    const incoming = backupObj?.data;
    if (!incoming || typeof incoming !== 'object') {
      return { ok: false, written: 0, removed: 0, errors: ['Invalid backup'] };
    }
    const incomingKeys = Object.keys(incoming);
    if (mode === 'replace') {
      const existing = this.listLikelyVMQKeys();
      existing.forEach((k) => {
        removeLocalStorageKey(k);
        result.removed++;
      });
    }
    incomingKeys.forEach((k) => {
      let v = incoming[k];
      if (typeof v !== 'string') {
        const s = safeJSONStringify(v);
        if (!s.ok) {
          result.errors.push(`Could not stringify ${k}`);
          result.ok = false;
          return;
        }
        v = s.value;
      }
      const ok = writeLocalStorageKey(k, v);
      result.written += ok ? 1 : 0;
      if (!ok) {
        result.errors.push(`Failed to write ${k}`);
        result.ok = false;
      }
    });
    return result;
  }

  clear(keys) {
    const arr = Array.isArray(keys) ? keys : [];
    let removed = 0;
    arr.forEach((k) => {
      if (removeLocalStorageKey(k)) removed++;
    });
    return { ok: true, removed };
  }

  report(keys = null) {
    const list = (Array.isArray(keys) && keys.length) ? keys : this.listLikelyVMQKeys();
    const items = [];
    let total = 0;
    list.forEach((k) => {
      const v = readLocalStorageKey(k) || '';
      const bytes = approxBytes(v) + approxBytes(k);
      items.push({ key: k, bytes });
      total += bytes;
    });
    items.sort((a, b) => b.bytes - a.bytes);
    return {
      totalBytes: total,
      totalHuman: humanBytes(total),
      items
    };
  }
}

/* UI Component (DataManager route) */
export default function DataManagerRoute({ navigate }) {
  const dmRef = useRef(null);
  if (!dmRef.current) dmRef.current = new DataManager({ namespace: 'vmq' });

  const { addNotification } = useNotifications() || {};
  const [allKeys, setAllKeys] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [onlyVMQ, setOnlyVMQ] = useState(true);
  const [backupJSON, setBackupJSON] = useState('');
  const [status, setStatus] = useState({ kind: 'muted', text: 'Ready.' });
  const [importMode, setImportMode] = useState('merge');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setAllKeys(dmRef.current.listKeys());
  }, []);

  const visibleKeys = useMemo(() => {
    const base = onlyVMQ ? allKeys.filter(isLikelyVMQKey) : allKeys.slice();
    const q = search.trim().toLowerCase();
    return q ? base.filter(k => k.toLowerCase().includes(q)) : base;
  }, [allKeys, onlyVMQ, search]);

  const toggleKey = (k) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const refreshKeys = () => {
    setAllKeys(dmRef.current.listKeys());
    setStatus({ kind: 'ok', text: 'Keys refreshed.' });
  };

  const handleExport = () => {
    const keys = Array.from(selected);
    if (!keys.length) {
      setStatus({ kind: 'warn', text: 'Select at least one key.' });
      return;
    }
    const backup = dmRef.current.export(keys, {
      version: window.VMQ?.version || 'unknown',
      url: window.location.href
    });
    const s = safeJSONStringify(backup);
    if (!s.ok) {
      setStatus({ kind: 'danger', text: 'Could not stringify JSON.' });
      return;
    }
    setBackupJSON(s.value);
    const ts = nowISO().replace(/[:.]/g, '-');
    downloadJSON(`vmq-backup-${ts}.json`, backup);
    addNotification?.('Export completed.', 'success');
    setStatus({ kind: 'ok', text: `Exported ${backup.meta.keyCount} keys.` });
  };

  const handleImport = () => {
    const txt = backupJSON.trim();
    if (!txt) {
      setStatus({ kind: 'warn', text: 'Paste or load backup JSON.' });
      return;
    }
    const parsed = safeJSONParse(txt);
    if (!parsed.ok) {
      setStatus({ kind: 'danger', text: 'Invalid JSON.' });
      return;
    }
    const result = dmRef.current.import(parsed.value, importMode);
    if (result.ok) {
      addNotification?.('Import succeeded.', 'success');
      setStatus({ kind: 'ok', text: `Import succeeded (written ${result.written}, removed ${result.removed}).` });
      setSelected(new Set());
      refreshKeys();
    } else {
      addNotification?.('Import completed with issues.', 'warn');
      setStatus({ kind: 'warn', text: `Import completed with issues: ${result.errors.join('; ')}` });
    }
  };

  const handleClear = () => {
    const keys = Array.from(selected);
    if (!keys.length) {
      setStatus({ kind: 'warn', text: 'Select keys to clear.' });
      return;
    }
    if (!window.confirm(`Delete ${keys.length} key(s)?`)) return;
    const result = dmRef.current.clear(keys);
    addNotification?.(`Removed ${result.removed} keys.`, 'info');
    setStatus({ kind: 'ok', text: `Removed ${result.removed} keys.` });
    setSelected(new Set());
    refreshKeys();
  };

  return h('div', { className: 'module-container' },
    h('h2', null, '🗂 Data Manager'),
    h('p', null, 'Export or import your VMQ data. Select which categories to include.'),
    h('div', { className: 'card' },
      h('h3', null, 'Select Data'),
      h('div', { style: { marginBottom: '1rem' } },
        h('label', null,
          h('input', {
            type: 'checkbox',
            checked: onlyVMQ,
            onChange: () => setOnlyVMQ(!onlyVMQ)
          }),
          ' Show VMQ keys only'
        ),
        h('input', {
          type: 'text',
          value: search,
          placeholder: 'Filter keys…',
          onChange: e => setSearch(e.target.value),
          style: { width: '100%', marginTop: '0.5rem' }
        })
      ),
      h('ul', null,
        visibleKeys.map((k) =>
          h('li', { key: k },
            h('label', null,
              h('input', {
                type: 'checkbox',
                checked: selected.has(k),
                onChange: () => toggleKey(k)
              }),
              ` ${k} (${humanBytes(approxBytes(k) + approxBytes(readLocalStorageKey(k) || ''))})`
            )
          )
        )
      ),
      h('div', { style: { marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } },
        h('button', {
          className: 'btn btn-primary',
          disabled: !selected.size,
          onClick: handleExport
        }, 'Export JSON'),
        h('button', {
          className: 'btn btn-secondary',
          disabled: !backupJSON,
          onClick: handleImport
        }, 'Import JSON'),
        h('button', {
          className: 'btn btn-danger',
          disabled: !selected.size,
          onClick: handleClear
        }, 'Clear Selected')
      ),
      h('p', { style: { marginTop: '0.5rem', fontStyle: 'italic' } },
        `Selected ${selected.size} key(s).`
      )
    ),
    h('div', { className: 'card' },
      h('h3', null, 'Backup Editor'),
      h('textarea', {
        value: backupJSON,
        onChange: e => setBackupJSON(e.target.value),
        placeholder: 'Paste exported JSON here or modify before importing…',
        rows: 12,
        style: { width: '100%', padding: '0.75rem', borderRadius: '12px', marginTop: '0.5rem' }
      })
    ),
    h('p', { className: 'muted small', style: { marginTop: '0.5rem' } },
      status.text
    ),
    h('button', {
      className: 'btn btn-secondary',
      style: { marginTop: '1.5rem' },
      onClick: () => navigate('dashboard')
    }, '← Back')
  );
}