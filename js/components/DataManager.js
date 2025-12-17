// js/components/DataManager.js

/* =========================================================
   VMQ DataManager.js
   Purpose:
   - Central storage + import/export for VMQ (dependency-free)
   - Works in GitHub Pages, offline mode, and standard browsers
   - Provides stable API so modules can depend on it safely

   Design goals:
   - Do NOT throw on missing/invalid data
   - Validate/guard storage operations
   - Support migrations via schemaVersion
   - Support import/export with merge/overwrite

   Usage:
   import dataManager, { DataManager } from './DataManager.js'
   const profile = dataManager.getProfile()
   dataManager.setProfile({ level:'intermediate' })
   ========================================================= */

const DEFAULT_NAMESPACE = 'vmq';
const CURRENT_SCHEMA_VERSION = 1;

/** Safely detect if localStorage is available (Safari private mode can be weird). */
function canUseLocalStorage() {
  try {
    const k = '__vmq_ls_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Safe JSON parse */
function safeParseJSON(text, fallback) {
  try {
    if (typeof text !== 'string') return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** Safe JSON stringify */
function safeStringifyJSON(value, fallback = '{}') {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/** Shallow object check */
function isPlainObject(x) {
  return !!x && typeof x === 'object' && (x.constructor === Object || Object.getPrototypeOf(x) === Object.prototype);
}

/** Deep-ish merge (objects only). Arrays are replaced, not merged. */
function deepMerge(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return source;
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (isPlainObject(v) && isPlainObject(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

/** Date stamp for backups */
function isoNow() {
  return new Date().toISOString();
}

/** YYYY-MM-DD for filenames */
function dateStamp() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Download helper (export backups) */
function downloadTextFile(filename, text, mime = 'application/json') {
  try {
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
    return true;
  } catch {
    return false;
  }
}

export class DataManager {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.namespace] - prefix for keys (default: 'vmq')
   * @param {Storage|null} [opts.storage] - override storage (must match Storage API)
   * @param {number} [opts.schemaVersion] - current schema version
   */
  constructor(opts = {}) {
    this.namespace = String(opts.namespace || DEFAULT_NAMESPACE);
    this.schemaVersion = Number.isFinite(opts.schemaVersion) ? opts.schemaVersion : CURRENT_SCHEMA_VERSION;

    // Storage selection: localStorage if possible, otherwise in-memory fallback
    const wantsStorage = opts.storage ?? (canUseLocalStorage() ? window.localStorage : null);
    this._storage = wantsStorage || null;

    // In-memory fallback store (only used if localStorage unavailable)
    this._mem = new Map();

    // Subscribers
    this._listeners = new Set();

    // Define “known keys” used across VMQ. This prevents imports from injecting random keys.
    this.KEYS = Object.freeze({
      PROFILE:        `${this.namespace}-profile`,
      SETTINGS:       `${this.namespace}-settings`,
      PROGRESS:       `${this.namespace}-progress`,
      SR:             `${this.namespace}-sr`,          // spaced repetition
      ANALYTICS:      `${this.namespace}-analytics`,
      SESSIONS:       `${this.namespace}-sessions`,
      FEATURE_FLAGS:  `${this.namespace}-features`,
      LAST_BACKUP:    `${this.namespace}-last-backup`,
      SCHEMA_META:    `${this.namespace}-schema-meta`
    });
  }

  /* ---------------------------------------------------------
     Low-level storage primitives
     --------------------------------------------------------- */

  _fullKey(key) {
    // If caller passes a full key already, keep it.
    // Otherwise, namespace it safely.
    if (typeof key !== 'string') return '';
    if (key.startsWith(`${this.namespace}-`)) return key;
    return `${this.namespace}-${key}`;
  }

  _getRaw(key) {
    const k = this._fullKey(key);
    if (!k) return null;

    if (this._storage) {
      try { return this._storage.getItem(k); } catch { return null; }
    }
    return this._mem.has(k) ? this._mem.get(k) : null;
  }

  _setRaw(key, value) {
    const k = this._fullKey(key);
    if (!k) return false;

    if (this._storage) {
      try { this._storage.setItem(k, String(value)); return true; } catch { return false; }
    }
    this._mem.set(k, String(value));
    return true;
  }

  _removeRaw(key) {
    const k = this._fullKey(key);
    if (!k) return false;

    if (this._storage) {
      try { this._storage.removeItem(k); return true; } catch { return false; }
    }
    return this._mem.delete(k);
  }

  /** Read JSON from storage */
  getJSON(key, fallback = null) {
    const raw = this._getRaw(key);
    if (raw == null) return fallback;
    return safeParseJSON(raw, fallback);
  }

  /** Write JSON to storage */
  setJSON(key, value) {
    const ok = this._setRaw(key, safeStringifyJSON(value, 'null'));
    if (ok) this._emitChange(key, value);
    return ok;
  }

  /** Update JSON atomically: updater(prev) => next */
  updateJSON(key, updater, fallback = null) {
    const prev = this.getJSON(key, fallback);
    let next = prev;
    try {
      next = updater(prev);
    } catch (e) {
      // fail closed: do nothing
      return { ok: false, prev, next: prev, error: e };
    }
    const ok = this.setJSON(key, next);
    return { ok, prev, next };
  }

  /** Merge partial object into existing object (objects only) */
  mergeJSON(key, partial, fallback = {}) {
    if (!isPlainObject(partial)) {
      // If it isn't a plain object, treat it as overwrite for safety.
      const ok = this.setJSON(key, partial);
      return { ok, next: partial };
    }
    return this.updateJSON(
      key,
      (prev) => deepMerge(isPlainObject(prev) ? prev : fallback, partial),
      fallback
    );
  }

  remove(key) {
    const ok = this._removeRaw(key);
    if (ok) this._emitChange(key, null);
    return ok;
  }

  /* ---------------------------------------------------------
     VMQ convenience APIs (common keys)
     --------------------------------------------------------- */

  getProfile(fallback = { level: 'beginner' }) {
    return this.getJSON(this.KEYS.PROFILE, fallback);
  }
  setProfile(profile) {
    return this.setJSON(this.KEYS.PROFILE, isPlainObject(profile) ? profile : { level: 'beginner' });
  }
  patchProfile(partial) {
    return this.mergeJSON(this.KEYS.PROFILE, partial, { level: 'beginner' });
  }

  getSettings(fallback = {}) {
    return this.getJSON(this.KEYS.SETTINGS, fallback);
  }
  setSettings(settings) {
    return this.setJSON(this.KEYS.SETTINGS, isPlainObject(settings) ? settings : {});
  }
  patchSettings(partial) {
    return this.mergeJSON(this.KEYS.SETTINGS, partial, {});
  }

  getProgress(fallback = {}) {
    return this.getJSON(this.KEYS.PROGRESS, fallback);
  }
  setProgress(progress) {
    return this.setJSON(this.KEYS.PROGRESS, isPlainObject(progress) ? progress : {});
  }
  patchProgress(partial) {
    return this.mergeJSON(this.KEYS.PROGRESS, partial, {});
  }

  getSpacedRepetition(fallback = { items: {} }) {
    return this.getJSON(this.KEYS.SR, fallback);
  }
  setSpacedRepetition(sr) {
    return this.setJSON(this.KEYS.SR, isPlainObject(sr) ? sr : { items: {} });
  }
  patchSpacedRepetition(partial) {
    return this.mergeJSON(this.KEYS.SR, partial, { items: {} });
  }

  getAnalytics(fallback = {}) {
    return this.getJSON(this.KEYS.ANALYTICS, fallback);
  }
  setAnalytics(analytics) {
    return this.setJSON(this.KEYS.ANALYTICS, isPlainObject(analytics) ? analytics : {});
  }
  patchAnalytics(partial) {
    return this.mergeJSON(this.KEYS.ANALYTICS, partial, {});
  }

  getSessions(fallback = []) {
    const v = this.getJSON(this.KEYS.SESSIONS, fallback);
    return Array.isArray(v) ? v : fallback;
  }
  setSessions(sessions) {
    return this.setJSON(this.KEYS.SESSIONS, Array.isArray(sessions) ? sessions : []);
  }
  appendSession(sessionObj) {
    return this.updateJSON(
      this.KEYS.SESSIONS,
      (prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        arr.push({ ...sessionObj, ts: sessionObj?.ts || Date.now() });
        // keep last N (avoid unbounded growth)
        const MAX = 500;
        if (arr.length > MAX) arr.splice(0, arr.length - MAX);
        return arr;
      },
      []
    );
  }

  getFeatureFlags(fallback = {}) {
    return this.getJSON(this.KEYS.FEATURE_FLAGS, fallback);
  }
  setFeatureFlags(flags) {
    return this.setJSON(this.KEYS.FEATURE_FLAGS, isPlainObject(flags) ? flags : {});
  }
  patchFeatureFlags(partial) {
    return this.mergeJSON(this.KEYS.FEATURE_FLAGS, partial, {});
  }

  /* ---------------------------------------------------------
     Import / Export
     --------------------------------------------------------- */

  /**
   * Export all VMQ data as one object.
   * You can store this in a file or share it via share.html.
   */
  exportAll() {
    const data = {};
    for (const k of Object.values(this.KEYS)) {
      data[k] = this.getJSON(k, null);
    }

    const payload = {
      app: 'Violin Mastery Quest',
      namespace: this.namespace,
      schemaVersion: this.schemaVersion,
      exportedAt: isoNow(),
      data
    };

    // Store metadata
    this.setJSON(this.KEYS.LAST_BACKUP, { exportedAt: payload.exportedAt });

    return payload;
  }

  /**
   * Download export as a file from the browser.
   */
  downloadBackup(filename = `vmq-backup-${dateStamp()}.json`) {
    const payload = this.exportAll();
    const text = safeStringifyJSON(payload, '{}');
    return downloadTextFile(filename, text);
  }

  /**
   * Validate import payload shape.
   */
  _validateImportPayload(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, reason: 'Payload is not an object' };
    if (payload.app && payload.app !== 'Violin Mastery Quest') {
      // fail-open: allow if missing, but warn if different
    }
    if (!payload.data || typeof payload.data !== 'object') return { ok: false, reason: 'Missing data object' };
    return { ok: true };
  }

  /**
   * Optional migration hook (expand later if you introduce schema v2+).
   * For now, returns payload as-is.
   */
  _migratePayload(payload) {
    const v = Number(payload.schemaVersion || 0);

    // Example future pattern:
    // if (v === 0) { ...convert...; payload.schemaVersion = 1; }

    if (!Number.isFinite(v) || v <= 0) {
      // Fail-open: treat unknown as current but do not crash
      payload.schemaVersion = this.schemaVersion;
    }
    return payload;
  }

  /**
   * Import VMQ backup.
   * @param {object|string} input - parsed object OR JSON string
   * @param {object} [opts]
   * @param {boolean} [opts.merge=true] - merge into existing objects where possible
   * @param {boolean} [opts.overwrite=false] - overwrite keys entirely (wins over merge)
   * @param {boolean} [opts.emitEvents=true] - emit change events per key
   */
  importAll(input, opts = {}) {
    const options = {
      merge: opts.merge !== false,
      overwrite: opts.overwrite === true,
      emitEvents: opts.emitEvents !== false
    };

    const payload = typeof input === 'string' ? safeParseJSON(input, null) : input;
    const valid = this._validateImportPayload(payload);
    if (!valid.ok) {
      return { ok: false, error: valid.reason };
    }

    const migrated = this._migratePayload(payload);
    const incoming = migrated.data || {};

    // Only accept keys we know about (prevents random storage injection)
    const allowedKeys = new Set(Object.values(this.KEYS));

    const result = { ok: true, applied: [], skipped: [], warnings: [] };

    for (const [key, value] of Object.entries(incoming)) {
      if (!allowedKeys.has(key)) {
        result.skipped.push(key);
        continue;
      }

      if (options.overwrite) {
        const ok = this._setRaw(key, safeStringifyJSON(value, 'null'));
        if (ok) result.applied.push(key);
        else result.skipped.push(key);
        if (ok && options.emitEvents) this._emitChange(key, value);
        continue;
      }

      if (options.merge && isPlainObject(value)) {
        const prev = this.getJSON(key, {});
        const next = deepMerge(isPlainObject(prev) ? prev : {}, value);
        const ok = this._setRaw(key, safeStringifyJSON(next, 'null'));
        if (ok) result.applied.push(key);
        else result.skipped.push(key);
        if (ok && options.emitEvents) this._emitChange(key, next);
      } else {
        const ok = this._setRaw(key, safeStringifyJSON(value, 'null'));
        if (ok) result.applied.push(key);
        else result.skipped.push(key);
        if (ok && options.emitEvents) this._emitChange(key, value);
      }
    }

    // Save schema meta
    this.setJSON(this.KEYS.SCHEMA_META, {
      importedAt: isoNow(),
      schemaVersion: migrated.schemaVersion,
      namespace: migrated.namespace || this.namespace
    });

    return result;
  }

  /* ---------------------------------------------------------
     Events / subscriptions
     --------------------------------------------------------- */

  _emitChange(key, value) {
    // 1) internal subscribers
    for (const fn of this._listeners) {
      try { fn({ key, value }); } catch {}
    }

    // 2) window event (lets UI listen without tight coupling)
    try {
      window.dispatchEvent(new CustomEvent('vmq-data-changed', {
        detail: { key, value, ts: Date.now() }
      }));
    } catch {}
  }

  /**
   * Subscribe to changes.
   * @param {(evt:{key:string,value:any})=>void} handler
   * @returns {()=>void} unsubscribe
   */
  onChange(handler) {
    if (typeof handler !== 'function') return () => {};
    this._listeners.add(handler);
    return () => this._listeners.delete(handler);
  }

  /* ---------------------------------------------------------
     Diagnostics / maintenance
     --------------------------------------------------------- */

  /**
   * Returns a snapshot of what keys exist + sizes.
   */
  inspect() {
    const report = { namespace: this.namespace, schemaVersion: this.schemaVersion, keys: [] };

    for (const k of Object.values(this.KEYS)) {
      const raw = this._getRaw(k);
      report.keys.push({
        key: k,
        exists: raw != null,
        bytes: raw ? raw.length : 0
      });
    }
    return report;
  }

  /**
   * Clear all VMQ keys (only those in KEYS). Safe reset.
   */
  clearAll() {
    const cleared = [];
    for (const k of Object.values(this.KEYS)) {
      const ok = this._removeRaw(k);
      if (ok) cleared.push(k);
    }
    // Emit one broad event
    try {
      window.dispatchEvent(new CustomEvent('vmq-data-cleared', {
        detail: { keys: cleared, ts: Date.now() }
      }));
    } catch {}
    return { ok: true, cleared };
  }
}

/** Singleton instance (most modules prefer this) */
const dataManager = new DataManager();

/** Default export for convenience */
export default dataManager;