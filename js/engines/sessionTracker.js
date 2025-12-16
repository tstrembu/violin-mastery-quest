// js/engines/sessionTracker.js
// ======================================
// SESSION TRACKER v3.0.4 - Advanced Auto-Detection & Learning Analytics
// Powers Analytics + Coach + Gamification + Spaced Repetition
//
// Drop-in replacement goals:
// - Keep existing + intended features
// - Be robust in browser + SPA (React UMD, modular files)
// - Avoid circular-import fragility (lazy import for spacedRepetition sync)
// - Provide small event emitter that AppContext expects
// - Preserve backwards-compatible exports + default export instance
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { addXP, updateStreak, checkAchievements } from './gamification.js';

// ======================================
// CONFIGURATION
// ======================================
const CONFIG = {
  IDLE_TIMEOUT: 45000,        // 45s idle → pause
  IDLE_WARNING: 20000,        // 20s → show warning
  TICK_INTERVAL: 1000,        // 1s updates
  MIN_SESSION_MINUTES: 1,     // Minimum trackable session
  AUTO_SAVE_INTERVAL: 30000,  // 30s autosave
  MAX_SESSION_HOURS: 5,       // 5hr max (prevent runaway)
  FOCUS_THRESHOLD: 0.8,       // 80% focus = high quality
  MAX_JOURNAL_ENTRIES: 1000,  // Keep last N sessions
  MAX_SRS_EVENTS: 500         // Prevent runaway SRS event storage
};

// ======================================
// MODULE MAP (auto-detection)
// NOTE: Values may be null (navigation/non-training) to suppress sessions.
// ======================================
const MODULE_MAP = {
  // Core Training
  intervals: 'Interval Training',
  'interval training': 'Interval Training',
  keys: 'Key Signatures',
  'key signatures': 'Key Signatures',
  'key signature': 'Key Signatures',
  rhythm: 'Rhythm Recognition',
  'rhythm recognition': 'Rhythm Recognition',
  bieler: 'Bieler Technique',
  'bieler technique': 'Bieler Technique',

  // Navigation/Info (non-training)
  dashboard: null,
  analytics: null,
  settings: null,
  welcome: null,
  menu: null,
  'main menu': null,

  // Ear Training / Testers
  'interval ear tester': 'Interval Ear Tester',
  'interval-ear': 'Interval Ear Tester',
  'interval sprint': 'Interval Sprint',
  'interval-sprint': 'Interval Sprint',
  'key tester': 'Key Signature Tester',
  'key-tester': 'Key Signature Tester',
  tempo: 'Tempo Recognition',
  'tempo trainer': 'Tempo Trainer',
  'tempo recognition': 'Tempo Recognition',
  timesig: 'Time Signature Recognition',
  'time signature recognition': 'Time Signature Recognition',
  arpeggio: 'Chord Recognition',
  'chord recognition': 'Chord Recognition',
  scales: 'Scale Recognition',
  'scale recognition': 'Scale Recognition',

  // Bieler Method
  'bieler lab': 'Bieler Lab',
  bielerlab: 'Bieler Lab',
  fingerboard: 'Fingerboard Mastery',
  'note locator': 'Note Locator',
  notelocator: 'Note Locator',
  'scales lab': 'Scales Lab',
  scaleslab: 'Scales Lab',

  // Tools & Planning
  'practice planner': 'Practice Planner',
  practiceplanner: 'Practice Planner',
  'practice journal': 'Practice Journal',
  practicejournal: 'Practice Journal',
  flashcards: 'Flashcards (SM-2)',
  achievements: null,
  'daily goals': null,
  dailygoals: null,
  datamanager: null,
  testers: null
};

const DETECT_SELECTORS = [
  '[data-module]',
  '[data-route]',
  '.module-header h1',
  '.module-header h2',
  '.card-header h2',
  '.mode-header h2',
  '.module-container h1',
  '.module-container h2',
  'header h1',
  'header h2',
  '.active-module',
  '[role="main"] h1, [role="main"] h2'
];

// ======================================
// Small event emitter (AppContext expects this)
// ======================================
class Emitter {
  constructor() { this._handlers = new Map(); }
  on(evt, fn) {
    if (!evt || typeof fn !== 'function') return () => {};
    if (!this._handlers.has(evt)) this._handlers.set(evt, new Set());
    this._handlers.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    const set = this._handlers.get(evt);
    if (!set) return;
    set.delete(fn);
    if (!set.size) this._handlers.delete(evt);
  }
  emit(evt, payload) {
    const set = this._handlers.get(evt);
    if (!set) return;
    [...set].forEach(fn => { try { fn(payload); } catch (_) {} });
  }
}

// ======================================
// Utilities
// ======================================
function safeLower(s) {
  return (s == null ? '' : String(s)).trim().toLowerCase();
}

function safeNow() { return Date.now(); }

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function stripEmoji(s) {
  return String(s || '').replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
    ''
  );
}

// ======================================
// SESSION TRACKER
// ======================================
class SessionTracker extends Emitter {
  constructor() {
    super();

    // Core state
    this.currentSession = null;
    this.lastActive = safeNow();
    this.isVisible = true;
    this.isPaused = false;

    // Timers
    this.ticker = null;
    this.autoSaveTimer = null;
    this.idleWarningTimer = null;

    // Observers
    this.observer = null;
    this.intersectionObserver = null;

    // Baseline metrics
    this.baselineStats = null;
    this.lastDOMScore = { score: 0, total: 0, accuracy: 0 };

    // Listener bookkeeping (so destroy() can truly detach)
    this._unsubs = [];

    // Internal flags
    this._directAnswerTracking = false;
    this._spacedRepModulePromise = null;

    // Throttle mutation handling (prevent rapid end/start loops)
    this._lastDetectAt = 0;
    this._detectCooldownMs = 600;
  }

  // ======================================
  // INITIALIZATION
  // ======================================
  init() {
    if (this.ticker) return; // already initialized

    this.setupListeners();
    this.setupIntersectionObserver();

    // Restore backup if present
    this.restoreSessionBackup();

    this.detectAndStartSession();
    this.startTicker();
    this.setupAutoSave();

    console.log('[Tracker] 🎯 Session tracking v3.0.4 active');
  }

  destroy() {
    this.endSession('app-destroy');

    if (this.ticker) clearInterval(this.ticker);
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    if (this.idleWarningTimer) clearTimeout(this.idleWarningTimer);
    if (this.observer) this.observer.disconnect();
    if (this.intersectionObserver) this.intersectionObserver.disconnect();

    this.ticker = null;
    this.autoSaveTimer = null;
    this.idleWarningTimer = null;
    this.observer = null;
    this.intersectionObserver = null;

    // remove listeners
    this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
    this._unsubs = [];

    console.log('[Tracker] 🛑 Session tracking stopped');
  }

  // ======================================
  // MODULE DETECTION
  // ======================================
  detectActivity() {
    const root = document.getElementById('root') || document.body;
    if (!root) return null;

    for (const selector of DETECT_SELECTORS) {
      const elements = root.querySelectorAll(selector);
      for (const el of elements) {
        // 1) Prefer explicit data-module
        const dataModule = el.getAttribute?.('data-module');
        if (dataModule) {
          const key = safeLower(dataModule);
          if (Object.prototype.hasOwnProperty.call(MODULE_MAP, key)) return MODULE_MAP[key];
          return this.toTitleCase(key);
        }

        // 2) Sometimes route is present; map it if known
        const dataRoute = el.getAttribute?.('data-route');
        if (dataRoute) {
          const key = safeLower(dataRoute);
          if (Object.prototype.hasOwnProperty.call(MODULE_MAP, key)) return MODULE_MAP[key];
          // keep going; text may be better
        }

        // 3) Fallback: find by text (headers, labels)
        const text = safeLower(stripEmoji(el.textContent || ''));
        if (!text) continue;

        // quick reject nav screens
        if (this.isNavigationScreen(text)) {
          // If it's a pure nav label, treat as no session.
          // But continue scanning: some pages may include nav header + module header.
          continue;
        }

        for (const [key, label] of Object.entries(MODULE_MAP)) {
          if (!key) continue;
          if (text.includes(key)) return label; // may be null
        }

        // fallback for non-nav screens
        return this.toTitleCase(text);
      }
    }
    return null;
  }

  isNavigationScreen(text) {
    const t = safeLower(text);
    const navScreens = [
      'dashboard', 'settings', 'welcome', 'home', 'menu', 'analytics',
      'achievements', 'goals', 'stats', 'data manager', 'testers'
    ];
    return navScreens.some(s => t.includes(s));
  }

  toTitleCase(str) {
    return String(str || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 60);
  }

  // ======================================
  // SESSION LIFECYCLE
  // ======================================
  startSession(activityLike, meta = {}) {
    const activity = typeof activityLike === 'string'
      ? activityLike
      : (activityLike?.title || activityLike?.activity || activityLike?.module || activityLike?.name || '');

    const clean = String(activity || '').trim();
    if (!clean) return;

    // If mapped explicitly to null (nav/non-training), do nothing
    if (clean === 'null') return;

    // If same activity, keep going
    if (this.currentSession?.activity === clean) return;

    // End prior session
    if (this.currentSession) this.endSession('module-switch');

    const now = safeNow();
    this.currentSession = {
      id: `vmq-${now}-${Math.random().toString(36).slice(2, 11)}`,
      activity: clean,
      date: new Date().toISOString().split('T')[0],
      startTime: now,
      endTime: null,

      engagedMs: 0,
      pausedMs: 0,
      idleMs: 0,
      totalMs: 0,

      statsDelta: { correct: 0, total: 0, accuracy: 0 },
      domScore: { score: 0, total: 0, accuracy: 0 },

      interactions: {
        keystrokes: 0,
        clicks: 0,
        scrolls: 0,
        audioPlays: 0,
        correctAnswers: 0,
        wrongAnswers: 0
      },

      focusScore: 1.0,
      qualityScore: 0,
      consistencyScore: 0,

      srsReviews: [],
      meta: { ...meta },

      deviceType: this.getDeviceType(),
      browserInfo: this.getBrowserInfo(),
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      isPWA: !!window.matchMedia?.('(display-mode: standalone)')?.matches
    };

    // Baseline stats snapshot
    this.baselineStats = loadJSON(STORAGE_KEYS.STATS, {});
    this.lastActive = now;
    this.isPaused = false;
    this._directAnswerTracking = false;
    this.lastDOMScore = { score: 0, total: 0, accuracy: 0 };

    try {
      window.dispatchEvent(new CustomEvent('vmq-session-start', {
        detail: { activity: clean, sessionId: this.currentSession.id }
      }));
    } catch (_) {}

    this.emit('session:start', { activity: clean, sessionId: this.currentSession.id });
    console.log(`[Tracker] 🎵 Started: ${clean}`);
  }

  endSession(reason = 'manual') {
    const session = this.currentSession;
    if (!session) return;

    const now = safeNow();
    session.endTime = now;
    session.totalMs = now - session.startTime;

    // Minimum length (use engaged time)
    const minutes = Math.floor(session.engagedMs / 60000);
    if (minutes < CONFIG.MIN_SESSION_MINUTES) {
      console.log(`[Tracker] ⏭️ Session too short (${minutes}min), not saving`);
      this.currentSession = null;
      try { sessionStorage.removeItem('vmq-session-backup'); } catch (_) {}
      return;
    }

    // Cap runaway
    const maxMs = CONFIG.MAX_SESSION_HOURS * 3600000;
    if (session.totalMs > maxMs) {
      console.warn(`[Tracker] ⚠️ Session exceeded ${CONFIG.MAX_SESSION_HOURS}hr, capping`);
      session.totalMs = maxMs;
      session.engagedMs = Math.min(session.engagedMs, Math.floor(maxMs * 0.8));
      session.idleMs = Math.min(session.idleMs, Math.floor(maxMs * 0.2));
    }

    // Compute metrics
    this.updateStatsDeltaFromStorage(session);
    this.updateDOMScore(session);
    this.updateFinalStats(session);
    this.calculateQualityMetrics(session);

    const baseXP = Math.round(minutes * ((session.statsDelta.accuracy || 0) / 10)); // 0–10 XP/min
    const focusBonus = Math.round(baseXP * clamp(session.focusScore || 0, 0, 1) * 0.2);
    const qualityBonus = session.qualityScore >= 80 ? Math.round(baseXP * 0.3) : 0;
    const xpEarned = Math.max(0, baseXP + focusBonus + qualityBonus);

    const entry = {
      id: session.id,
      date: session.date,
      timestamp: session.startTime,
      endTimestamp: session.endTime,

      activity: session.activity,
      minutes,
      engagedMinutes: Math.floor(session.engagedMs / 60000),

      accuracy: session.statsDelta.accuracy || 0,
      score: session.domScore.score || 0,
      total: session.domScore.total || 0,

      xpEarned,
      focusScore: Math.round((session.focusScore || 0) * 100),
      qualityScore: session.qualityScore || 0,
      consistencyScore: session.consistencyScore || 0,

      interactions: session.interactions,
      endReason: reason,

      deviceType: session.deviceType,
      isPWA: session.isPWA
    };

    // Journal write
    const journal = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
    journal.unshift(entry);
    saveJSON(STORAGE_KEYS.PRACTICE_LOG, journal.slice(0, CONFIG.MAX_JOURNAL_ENTRIES));

    // Gamification (safe)
    try { addXP?.(xpEarned); } catch (_) {}
    try { updateStreak?.(); } catch (_) {}
    try { checkAchievements?.(); } catch (_) {}

    // Daily stats aggregation
    this.updateDailyStats(entry);

    // Spaced repetition sync (lazy import)
    this.syncSRSIfNeeded(session, entry);

    try { window.dispatchEvent(new CustomEvent('vmq-session-end', { detail: entry })); } catch (_) {}
    this.emit('session:end', entry);

    console.log(
      `[Tracker] ✅ Saved: ${session.activity}\n` +
      `  ⏱️  ${minutes}min (${Math.round((session.focusScore || 0) * 100)}% focused)\n` +
      `  🎯 ${(session.statsDelta.accuracy || 0)}% accuracy\n` +
      `  ⭐ ${xpEarned} XP (Q${session.qualityScore || 0})`
    );

    this.currentSession = null;
    try { sessionStorage.removeItem('vmq-session-backup'); } catch (_) {}
  }

  // ======================================
  // TICKER
  // ======================================
  startTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = setInterval(() => this.tick(), CONFIG.TICK_INTERVAL);
  }

  tick() {
    if (!this.currentSession) {
      this.detectAndStartSession();
      return;
    }

    const session = this.currentSession;
    const now = safeNow();
    const idleFor = now - this.lastActive;

    // hidden tab/app
    if (!this.isVisible) {
      session.pausedMs += CONFIG.TICK_INTERVAL;
      return;
    }

    // idle
    if (idleFor >= CONFIG.IDLE_TIMEOUT) {
      if (!this.isPaused) {
        this.isPaused = true;
        this.showIdleWarning();
      }
      session.idleMs += CONFIG.TICK_INTERVAL;
      return;
    }

    // resumed from idle
    if (this.isPaused) {
      this.isPaused = false;
      this.hideIdleWarning();
    }

    // soft warning
    if (idleFor >= CONFIG.IDLE_WARNING && !this.idleWarningTimer) {
      this.showSoftIdleWarning();
    }

    // active engagement
    session.engagedMs += CONFIG.TICK_INTERVAL;

    // keep derived metrics fresh
    this.updateStatsDeltaFromStorage(session);
    this.updateDOMScore(session);
    this.updateFocusScore(session);
  }

  // ======================================
  // ANSWERS / EVENTS API (AppContext / Analytics)
  // ======================================
  trackAnswer(module, isCorrect, responseTime = 0, sessionData = {}) {
    this._directAnswerTracking = true;

    const m = String(module || '').trim();
    if (!this.currentSession) {
      this.startSession(m || this.detectActivity() || 'Practice', { source: 'trackAnswer' });
    }

    const s = this.currentSession;
    if (!s) return;

    if (isCorrect) s.interactions.correctAnswers++;
    else s.interactions.wrongAnswers++;

    this.emit('activity', {
      module: m || s.activity,
      correct: !!isCorrect,
      responseTime: Number(responseTime) || 0,
      ...sessionData
    });

    try {
      window.dispatchEvent(new CustomEvent('vmq-answer', {
        detail: { module: m || s.activity, correct: !!isCorrect, responseTime: Number(responseTime) || 0 }
      }));
    } catch (_) {}
  }

  trackNavigation(route, meta = {}) {
    // Router calls this via default import optional chaining
    this.trackActivity('nav', 'route', { route, ...meta });
  }

  /**
   * Overloaded:
   * - trackActivity("Interval Training") => startSession(...)
   * - trackActivity("toast","show",{...}) => log event
   */
  trackActivity(a, b, c) {
    // 1-arg form: treat as session start
    if (typeof b === 'undefined') {
      const act = String(a || '').trim();
      if (!act) return;
      // If it's clearly navigation, ignore
      const mapped = MODULE_MAP[safeLower(act)];
      if (mapped === null) return;
      this.startSession(act, { source: 'trackActivity:session' });
      return;
    }

    const category = String(a || 'event');
    const action = String(b || 'log');
    const payload = (c && typeof c === 'object') ? c : { value: c };

    // keep session alive while user interacts
    this.lastActive = safeNow();

    // Buffer SRS events for end-of-session sync
    const catLower = safeLower(category);
    if (catLower === 'sm2' || catLower === 'srs') {
      if (this.currentSession) {
        const item = {
          ts: payload?.ts || safeNow(),
          itemId: payload?.itemId || payload?.cardId || payload?.id || null,
          correct: payload?.correct ?? payload?.ok ?? null,
          quality: payload?.quality ?? null,
          responseTime: payload?.responseTime ?? payload?.rt ?? null,
          action
        };
        this.currentSession.srsReviews.push(item);
        if (this.currentSession.srsReviews.length > CONFIG.MAX_SRS_EVENTS) {
          this.currentSession.srsReviews.shift();
        }
      }
    }

    this.emit('event', { category, action, payload, ts: safeNow() });
  }

  // ======================================
  // STORAGE-BASED METRICS
  // ======================================
  updateStatsDeltaFromStorage(session) {
    if (!this.baselineStats || !session) return;

    const current = loadJSON(STORAGE_KEYS.STATS, {});
    let correct = 0, total = 0;

    Object.entries(current.byModule || {}).forEach(([module, data = {}]) => {
      const base = this.baselineStats.byModule?.[module] || {};
      correct += Math.max(0, (data.correct || 0) - (base.correct || 0));
      total += Math.max(0, (data.total || 0) - (base.total || 0));
    });

    session.statsDelta = {
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
    };

    // If we are NOT getting direct answer events, infer counts from deltas
    if (!this._directAnswerTracking) {
      session.interactions.correctAnswers = correct;
      session.interactions.wrongAnswers = Math.max(0, total - correct);
    }
  }

  updateDOMScore(session) {
    const root = document.getElementById('root') || document.body;
    if (!root || !session) return;

    const text = root.textContent || '';

    const patterns = [
      /score[:\s]*(\d+)\s*[\/\-of]\s*(\d+)/i,
      /(\d+)\s*[\/\-]\s*(\d+)\s*correct/i,
      /accuracy[:\s]*(\d+)%/i,
      /progress[:\s]*(\d+)\s*[\/]\s*(\d+)/i
    ];

    for (const re of patterns) {
      const m = text.match(re);
      if (!m) continue;

      if (m.length === 3) {
        const score = Number(m[1]);
        const total = Number(m[2]);
        if (
          Number.isFinite(score) &&
          Number.isFinite(total) &&
          total >= (this.lastDOMScore.total || 0)
        ) {
          this.lastDOMScore = {
            score,
            total,
            accuracy: total ? Math.round((score / total) * 100) : 0
          };
          session.domScore = { ...this.lastDOMScore };
        }
      } else if (m.length === 2) {
        const acc = Number(m[1]);
        if (Number.isFinite(acc)) session.domScore.accuracy = acc;
      }
      break;
    }
  }

  updateFocusScore(session) {
    const totalTime = session.engagedMs + session.pausedMs + session.idleMs;
    if (!totalTime) return;
    session.focusScore = clamp(session.engagedMs / totalTime, 0, 1);
  }

  updateFinalStats(session) {
    // Prefer DOM score if it’s clearly more complete
    if ((session.domScore.total || 0) > (session.statsDelta.total || 0)) {
      session.statsDelta = { ...session.domScore };
    }
  }

  // ======================================
  // QUALITY SCORING
  // ======================================
  calculateQualityMetrics(session) {
    this.updateFocusScore(session);

    const accuracyWeight = 0.4;
    const focusWeight = 0.3;
    const consistencyWeight = 0.2;
    const engagementWeight = 0.1;

    const accuracyScore = session.statsDelta.accuracy || 0;
    const focusScore = (session.focusScore || 0) * 100;
    const engagementScore = this.calculateEngagementScore(session);
    const consistencyScore = this.calculateConsistencyScore(session);

    session.consistencyScore = consistencyScore;
    session.qualityScore = Math.round(
      accuracyScore * accuracyWeight +
      focusScore * focusWeight +
      consistencyScore * consistencyWeight +
      engagementScore * engagementWeight
    );
  }

  calculateEngagementScore(session) {
    const mins = session.engagedMs / 60000;
    if (!mins) return 0;

    const i = session.interactions || {};
    const totalInteractions =
      (i.keystrokes || 0) +
      (i.clicks || 0) +
      ((i.audioPlays || 0) * 2);

    const perMin = totalInteractions / mins;
    const ideal = 25;

    return clamp(Math.round((perMin / ideal) * 100), 0, 100);
  }

  calculateConsistencyScore(session) {
    const total = (session.interactions.correctAnswers || 0) + (session.interactions.wrongAnswers || 0);
    if (total < 10) return 50;

    const acc = session.statsDelta.accuracy || 0;
    if (acc >= 90) return 90;
    if (acc >= 75) return 75;
    if (acc >= 60) return 60;
    return 45;
  }

  // ======================================
  // DAILY STATS
  // ======================================
  updateDailyStats(entry) {
    const dailyStats = loadJSON(STORAGE_KEYS.DAILY_STATS, {});
    const today = entry.date;

    if (!dailyStats[today]) {
      dailyStats[today] = {
        date: today,
        sessions: 0,
        totalMinutes: 0,
        totalQuestions: 0,
        totalXP: 0,
        avgAccuracy: 0,
        avgFocusScore: 0,
        modules: {}
      };
    }

    const day = dailyStats[today];
    day.sessions++;
    day.totalMinutes += entry.minutes || 0;
    day.totalQuestions += entry.total || 0;
    day.totalXP += entry.xpEarned || 0;

    day.avgAccuracy = Math.round(((day.avgAccuracy * (day.sessions - 1)) + (entry.accuracy || 0)) / day.sessions);
    day.avgFocusScore = Math.round(((day.avgFocusScore * (day.sessions - 1)) + (entry.focusScore || 0)) / day.sessions);

    if (!day.modules[entry.activity]) {
      day.modules[entry.activity] = { sessions: 0, minutes: 0, accuracy: 0 };
    }
    const mod = day.modules[entry.activity];
    mod.sessions++;
    mod.minutes += entry.minutes || 0;
    mod.accuracy = entry.accuracy || 0;

    // Keep last 90 days
    const dates = Object.keys(dailyStats).sort();
    if (dates.length > 90) {
      dates.slice(0, dates.length - 90).forEach(d => delete dailyStats[d]);
    }

    saveJSON(STORAGE_KEYS.DAILY_STATS, dailyStats);
  }

  // ======================================
  // AUTO-SAVE BACKUP
  // ======================================
  setupAutoSave() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);

    this.autoSaveTimer = setInterval(() => {
      if (this.currentSession && this.currentSession.engagedMs >= 60000) {
        this.saveSessionBackup();
      }
    }, CONFIG.AUTO_SAVE_INTERVAL);
  }

  saveSessionBackup() {
    if (!this.currentSession) return;
    const backup = { ...this.currentSession, isBackup: true, backupTime: safeNow() };
    try { sessionStorage.setItem('vmq-session-backup', JSON.stringify(backup)); } catch (_) {}
  }

  restoreSessionBackup() {
    let raw = null;
    try { raw = sessionStorage.getItem('vmq-session-backup'); } catch (_) {}
    if (!raw) return false;

    try {
      const session = JSON.parse(raw);
      const age = safeNow() - (session.backupTime || 0);

      if (age < 10 * 60 * 1000) { // 10 min
        console.log('[Tracker] 🔄 Restoring session backup');
        this.currentSession = session;
        try { sessionStorage.removeItem('vmq-session-backup'); } catch (_) {}
        return true;
      }

      console.log('[Tracker] 🗑️ Discarding stale session backup');
      try { sessionStorage.removeItem('vmq-session-backup'); } catch (_) {}
    } catch (e) {
      console.warn('[Tracker] Failed to restore backup:', e);
      try { sessionStorage.removeItem('vmq-session-backup'); } catch (_) {}
    }
    return false;
  }

  // ======================================
  // IDLE WARNING UI EVENTS
  // ======================================
  showSoftIdleWarning() {
    this.idleWarningTimer = setTimeout(() => {
      if (safeNow() - this.lastActive >= CONFIG.IDLE_TIMEOUT) {
        this.showIdleWarning();
      }
    }, CONFIG.IDLE_TIMEOUT - CONFIG.IDLE_WARNING);
  }

  showIdleWarning() {
    try {
      window.dispatchEvent(new CustomEvent('vmq-idle-warning', {
        detail: { secondsIdle: Math.floor((safeNow() - this.lastActive) / 1000) }
      }));
    } catch (_) {}
  }

  hideIdleWarning() {
    if (this.idleWarningTimer) {
      clearTimeout(this.idleWarningTimer);
      this.idleWarningTimer = null;
    }
    try { window.dispatchEvent(new CustomEvent('vmq-idle-resume')); } catch (_) {}
  }

  // ======================================
  // ROUTE / MODULE CHANGE WATCHER
  // ======================================
  detectAndStartSession() {
    const now = safeNow();
    if (now - this._lastDetectAt < this._detectCooldownMs) return;
    this._lastDetectAt = now;

    const activity = this.detectActivity();

    // If mapped to null, end active session (if any) and do not start
    if (activity === null) {
      if (this.currentSession) this.endSession('nav-screen');
      return;
    }

    if (activity && (!this.currentSession || this.currentSession.activity !== activity)) {
      this.startSession(activity, { source: 'auto-detect' });
    }

    // SPA mutation observer
    if (!this.observer) {
      const root = document.getElementById('root');
      if (!root) return;

      this.observer = new MutationObserver(() => {
        const next = this.detectActivity();

        if (next === null) {
          if (this.currentSession) this.endSession('nav-screen');
          return;
        }

        if (next && next !== this.currentSession?.activity) {
          this.endSession('route-change');
          this.startSession(next, { source: 'mutation' });
        }
      });

      this.observer.observe(root, { childList: true, subtree: true });
    }
  }

  // ======================================
  // LISTENERS
  // ======================================
  _listen(target, evt, handler, opts) {
    target.addEventListener(evt, handler, opts);
    this._unsubs.push(() => target.removeEventListener(evt, handler, opts));
  }

  setupListeners() {
    const activityEvents = [
      'pointerdown', 'pointermove', 'keydown', 'wheel',
      'touchstart', 'touchmove', 'click'
    ];

    const poke = () => {
      this.lastActive = safeNow();
      if (this.isPaused) {
        this.isPaused = false;
        this.hideIdleWarning();
      }
    };

    activityEvents.forEach(evt => {
      this._listen(window, evt, poke, { passive: true });
    });

    this._listen(window, 'keydown', () => {
      if (this.currentSession) this.currentSession.interactions.keystrokes++;
    }, { passive: true });

    this._listen(window, 'click', () => {
      if (this.currentSession) this.currentSession.interactions.clicks++;
    }, { passive: true });

    this._listen(window, 'wheel', () => {
      if (this.currentSession) this.currentSession.interactions.scrolls++;
    }, { passive: true });

    // Audio plays (your app emits this)
    this._listen(window, 'vmq-audio-play', () => {
      if (this.currentSession) this.currentSession.interactions.audioPlays++;
    });

    // SRS per-card events (optional)
    this._listen(window, 'vmq-srs-review', (e) => {
      const detail = e?.detail || {};
      this.trackActivity('sm2', 'review', detail);
    });

    this._listen(document, 'visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible) {
        this.lastActive = safeNow();
        this.isPaused = false;
      }
    });

    this._listen(window, 'pagehide', () => this.endSession('pagehide'));
    this._listen(window, 'beforeunload', () => this.endSession('beforeunload'));

    this._listen(window, 'blur', () => {
      if (this.currentSession) this.currentSession.pausedMs += CONFIG.TICK_INTERVAL;
    });

    this._listen(window, 'focus', () => {
      this.lastActive = safeNow();
    });

    // In case router broadcasts route changes (optional)
    this._listen(window, 'hashchange', () => this.detectAndStartSession());
    this._listen(window, 'popstate', () => this.detectAndStartSession());
  }

  setupIntersectionObserver() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) this.lastActive = safeNow();
      });
    }, { threshold: 0.5 });

    const main = document.querySelector('#root, [role="main"]');
    if (main) this.intersectionObserver.observe(main);
  }

  // ======================================
  // SRS SYNC (lazy import to avoid circular deps)
  // ======================================
  async _loadSpacedRepetitionModule() {
    if (!this._spacedRepModulePromise) {
      this._spacedRepModulePromise = import('./spacedRepetition.js');
    }
    return this._spacedRepModulePromise;
  }

  syncSRSIfNeeded(session, entry) {
    const hasEvents = Array.isArray(session.srsReviews) && session.srsReviews.length > 0;
    const looksLikeSRS = /flashcard|spaced|sm-2|sm2/i.test(session.activity);

    if (!hasEvents && !looksLikeSRS) return;

    this._loadSpacedRepetitionModule()
      .then((mod) => {
        const fn = mod?.updateSRSReviews;
        if (typeof fn !== 'function') {
          console.warn('[Tracker] updateSRSReviews missing: spaced repetition session sync skipped');
          return;
        }

        fn({
          sessionId: entry.id,
          activity: entry.activity,
          date: entry.date,
          startTime: entry.timestamp,
          endTime: entry.endTimestamp,
          engagedMs: session.engagedMs,
          correct: session.interactions.correctAnswers || 0,
          wrong: session.interactions.wrongAnswers || 0,
          reviews: session.srsReviews || []
        });
      })
      .catch((err) => {
        console.warn('[Tracker] Failed to import spacedRepetition.js for sync:', err);
      });
  }

  // ======================================
  // PUBLIC HELPERS
  // ======================================
  forceEnd(reason = 'manual') { this.endSession(reason); }
  getCurrentSession() { return this.currentSession; }

  getSessionStats() {
    if (!this.currentSession) return null;
    return {
      activity: this.currentSession.activity,
      elapsedMinutes: Math.floor(this.currentSession.engagedMs / 60000),
      accuracy: this.currentSession.statsDelta.accuracy || 0,
      focusScore: Math.round((this.currentSession.focusScore || 0) * 100),
      interactions: this.currentSession.interactions,
      isIdle: this.isPaused
    };
  }

  getRecentSessions(timeframe = 'week') {
    const log = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
    const now = safeNow();
    const cutoffs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      all: Infinity
    };
    const cutoff = cutoffs[timeframe] ?? cutoffs.week;
    return log.filter(s => now - (s.timestamp || 0) < cutoff);
  }

  getWeeklyStats() {
    const sessions = this.getRecentSessions('week');

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => ({
      name, questions: 0, minutes: 0, xp: 0
    }));

    sessions.forEach(session => {
      const dayIndex = new Date(session.timestamp).getDay();
      days[dayIndex].questions += session.total || 0;
      days[dayIndex].minutes += session.minutes || 0;
      days[dayIndex].xp += session.xpEarned || 0;
    });

    const totalQuestions = days.reduce((sum, d) => sum + d.questions, 0);
    const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
    const maxDaily = Math.max(0, ...days.map(d => d.questions));

    return {
      days,
      totalQuestions,
      totalMinutes,
      maxDaily,
      avgDaily: Math.round(totalQuestions / 7),
      avgMinutesDaily: Math.round(totalMinutes / 7),
      xpPerDay: sessions.reduce((sum, s) => sum + (s.xpEarned || 0), 0) / 7
    };
  }

  getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'desktop';
  }

  getBrowserInfo() {
    const ua = navigator.userAgent || '';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Unknown';
  }
}

// ======================================
// SINGLETON + OPTIONAL AUTO INIT
// (Safe for module bundling + GitHub Pages)
// ======================================
export const sessionTracker = new SessionTracker();

// If your app already calls sessionTracker.init(), this won't double-init
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try { sessionTracker.init(); } catch (_) {}
  });
}

// ======================================
// FUNCTION EXPORTS (backwards compatibility)
// ======================================
export function trackActivity(activity) { sessionTracker.startSession(activity); }
export function endCurrentSession(reason) { sessionTracker.forceEnd(reason); }
export function getSessionStats() { return sessionTracker.getSessionStats(); }
export function isSessionActive() { return sessionTracker.currentSession !== null; }
export function getRecentSessions(timeframe = 'week') { return sessionTracker.getRecentSessions(timeframe); }
export function getWeeklyStats() { return sessionTracker.getWeeklyStats(); }

// Default export MUST be the tracker instance
export default sessionTracker;