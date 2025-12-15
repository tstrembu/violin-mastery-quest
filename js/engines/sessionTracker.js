// js/engines/sessionTracker.js
// ======================================
// SESSION TRACKER v2.1.6 - Advanced Auto-Detection & Learning Analytics
// Powers Analytics + Coach + Gamification + Spaced Repetition
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { addXP, updateStreak, checkAchievements } from './gamification.js';

// ======================================
// CONFIGURATION
// ======================================
const CONFIG = {
  IDLE_TIMEOUT: 30000,        // 30s idle → pause
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
// ======================================
const MODULE_MAP = {
  // Core Training
  'intervals': 'Interval Training',
  'interval training': 'Interval Training',
  'key signatures': 'Key Signatures',
  'key signature': 'Key Signatures',
  'rhythm': 'Rhythm Recognition',
  'rhythm recognition': 'Rhythm Recognition',
  'bieler': 'Bieler Technique',
  'bieler technique': 'Bieler Technique',

  // Navigation/Info (non-training)
  'dashboard': null,
  'analytics': null,
  'settings': null,
  'welcome': null,
  'main menu': null,

  // Ear Training
  'interval ear tester': 'Interval Ear Tester',
  'interval sprint': 'Interval Sprint',
  'key tester': 'Key Signature Tester',
  'perfect pitch': 'Perfect Pitch Trainer',
  'chord recognition': 'Chord Recognition',
  'melodic dictation': 'Melodic Dictation',

  // Rhythm
  'rhythm drills': 'Rhythm Drills',
  'rhythm sight reading': 'Rhythm Sight Reading',
  'tempo trainer': 'Tempo Trainer',
  'polyrhythm': 'Polyrhythm Trainer',

  // Bieler Method
  'bieler lab': 'Bieler Lab',
  'bieler position': 'Position Practice',
  'bieler shifting': 'Shifting Exercises',
  'bieler vibrato': 'Vibrato Development',
  'bieler bowing': 'Advanced Bowing',

  // Theory & Visualization
  'fingerboard': 'Fingerboard Mastery',
  'position charts': 'Position Charts',
  'scales lab': 'Scales Lab',
  'note locator': 'Note Locator',
  'chord builder': 'Chord Builder',
  'circle of fifths': 'Circle of Fifths',
  'mode explorer': 'Mode Explorer',
  'scale degrees': 'Scale Degrees',

  // Drills & Challenges
  'speed drill': 'Speed Drill',
  'accuracy challenge': 'Accuracy Challenge',
  'snapshot': 'Snapshot Quiz',
  'custom drill': 'Custom Drill',
  'random challenge': 'Random Challenge',
  'timed test': 'Timed Test',
  'mastery check': 'Mastery Check',
  'progressive drill': 'Progressive Drill',

  // Tools & Planning
  'practice planner': 'Practice Planner',
  'practice journal': 'Practice Journal',
  'flashcards': 'Flashcards (SM-2)',
  'metronome': 'Metronome',
  'tuner': 'Tuner',
  'drone': 'Drone Notes',

  // Reference & Learning
  'reference library': 'Reference Library',
  'technique guide': 'Technique Guide',
  'repertoire tracker': 'Repertoire Tracker',
  'lesson notes': 'Lesson Notes',

  // Gamification
  'achievements': 'Achievements',
  'daily goals': 'Daily Goals',
  'leaderboard': 'Leaderboard'
};

const DETECT_SELECTORS = [
  '[data-module]',
  '.module-header h2',
  '.card-header h2',
  '.mode-header h2',
  '.module-container h2',
  'header h2',
  '.active-module',
  '[role="main"] h1, [role="main"] h2'
];

// ======================================
// Small event emitter (AppContext expects this)  [oai_citation:4‡sessionTracker.js](sediment://file_00000000ac4c71f8a30041ab27c5ff8a)
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
    // isolate handler failures
    [...set].forEach(fn => { try { fn(payload); } catch (_) {} });
  }
}

// ======================================
// SESSION TRACKER
// ======================================
class SessionTracker extends Emitter {
  constructor() {
    super();

    // Core state
    this.currentSession = null;
    this.lastActive = Date.now();
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

    // Internal flags
    this._directAnswerTracking = false; // true if trackAnswer() is being used
    this._spacedRepModulePromise = null; // lazy import cache for spacedRepetition.js
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

    console.log('[Tracker] 🎯 Session tracking v2.2.0 active');
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

    console.log('[Tracker] 🛑 Session tracking stopped');
  }

  // ======================================
  // MODULE DETECTION
  // ======================================
  detectActivity() {
    const root = document.getElementById('root');
    if (!root) return null;

    for (const selector of DETECT_SELECTORS) {
      const elements = root.querySelectorAll(selector);
      for (const el of elements) {
        const dataModule = el.getAttribute?.('data-module');
        if (dataModule) {
          const mapped = MODULE_MAP[String(dataModule).toLowerCase()];
          if (mapped !== undefined) return mapped; // may be null
          return this.toTitleCase(String(dataModule));
        }

        const text = (el.textContent || '').trim().toLowerCase();
        if (!text) continue;

        for (const [key, label] of Object.entries(MODULE_MAP)) {
          if (text.includes(key)) return label; // label may be null
        }

        // fallback for non-nav screens
        if (!this.isNavigationScreen(text)) {
          return this.toTitleCase(text.replace(/[📊🎼🎵🎹🎻🎸🥁]/g, '').trim());
        }
      }
    }
    return null;
  }

  isNavigationScreen(text) {
    const navScreens = ['dashboard', 'settings', 'welcome', 'home', 'menu', 'analytics', 'achievements', 'goals', 'stats'];
    return navScreens.some(s => text.includes(s));
  }

  toTitleCase(str) {
    return String(str)
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 50);
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

    // If same activity, keep going
    if (this.currentSession?.activity === clean) return;

    // End prior session
    if (this.currentSession) this.endSession('module-switch');

    const now = Date.now();
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

      // SRS event buffer for end-of-session sync
      srsReviews: [],

      // optional metadata (route/module info, etc.)
      meta: { ...meta },

      deviceType: this.getDeviceType(),
      browserInfo: this.getBrowserInfo(),
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      isPWA: window.matchMedia?.('(display-mode: standalone)')?.matches || false
    };

    // Baseline stats snapshot
    this.baselineStats = loadJSON(STORAGE_KEYS.STATS, {});
    this.lastActive = now;
    this.isPaused = false;
    this._directAnswerTracking = false;
    this.lastDOMScore = { score: 0, total: 0, accuracy: 0 };

    window.dispatchEvent(new CustomEvent('vmq-session-start', {
      detail: { activity: clean, sessionId: this.currentSession.id }
    }));

    console.log(`[Tracker] 🎵 Started: ${clean}`);
  }

  endSession(reason = 'manual') {
    const session = this.currentSession;
    if (!session) return;

    const now = Date.now();
    session.endTime = now;
    session.totalMs = now - session.startTime;

    // Minimum length
    const minutes = Math.floor(session.engagedMs / 60000);
    if (minutes < CONFIG.MIN_SESSION_MINUTES) {
      console.log(`[Tracker] ⏭️ Session too short (${minutes}min), not saving`);
      this.currentSession = null;
      return;
    }

    // Cap runaway
    const maxMs = CONFIG.MAX_SESSION_HOURS * 3600000;
    if (session.totalMs > maxMs) {
      console.warn(`[Tracker] ⚠️ Session exceeded ${CONFIG.MAX_SESSION_HOURS}hr, capping`);
      session.totalMs = maxMs;
      session.engagedMs = Math.min(session.engagedMs, Math.floor(maxMs * 0.8));
    }

    this.updateStatsDeltaFromStorage(session);
    this.updateDOMScore(session);
    this.updateFinalStats(session);
    this.calculateQualityMetrics(session);

    const baseXP = Math.round(minutes * (session.statsDelta.accuracy / 10)); // 0–10 XP/min
    const focusBonus = Math.round(baseXP * session.focusScore * 0.2);
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

      accuracy: session.statsDelta.accuracy,
      score: session.domScore.score,
      total: session.domScore.total,

      xpEarned,
      focusScore: Math.round(session.focusScore * 100),
      qualityScore: session.qualityScore,
      consistencyScore: session.consistencyScore,

      interactions: session.interactions,
      endReason: reason,

      deviceType: session.deviceType,
      isPWA: session.isPWA
    };

    // Journal write
    const journal = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
    journal.unshift(entry);
    saveJSON(STORAGE_KEYS.PRACTICE_LOG, journal.slice(0, CONFIG.MAX_JOURNAL_ENTRIES));

    // Gamification
    try { addXP?.(xpEarned); } catch (_) {}
    try { updateStreak?.(); } catch (_) {}
    try { checkAchievements?.(); } catch (_) {}

    // Daily stats aggregation
    this.updateDailyStats(entry);

    // Spaced repetition sync (SAFE: lazy import to avoid circular-import crashes)
    this.syncSRSIfNeeded(session, entry);

    window.dispatchEvent(new CustomEvent('vmq-session-end', { detail: entry }));
    this.emit('session:end', entry);

    console.log(
      `[Tracker] ✅ Saved: ${session.activity}\n` +
      `  ⏱️  ${minutes}min (${Math.round(session.focusScore * 100)}% focused)\n` +
      `  🎯 ${session.statsDelta.accuracy}% accuracy\n` +
      `  ⭐ ${xpEarned} XP (Q${session.qualityScore})`
    );

    this.currentSession = null;
    sessionStorage.removeItem('vmq-session-backup');
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
    const now = Date.now();
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
  // ANSWERS / EVENTS API (used by Analytics engine)  [oai_citation:5‡sessionTracker.js](sediment://file_00000000ac4c71f8a30041ab27c5ff8a)
  // ======================================
  trackAnswer(module, isCorrect, responseTime = 0, sessionData = {}) {
    // Mark that we are being fed direct answer events (don’t try to infer from STATS deltas)
    this._directAnswerTracking = true;

    const m = String(module || '').trim();
    if (!this.currentSession) {
      // best-effort: start session using module label
      this.startSession(m || this.detectActivity() || 'Practice', { source: 'trackAnswer' });
    }

    const s = this.currentSession;
    if (!s) return;

    if (isCorrect) s.interactions.correctAnswers++;
    else s.interactions.wrongAnswers++;

    // Emit the exact event shape AppContext expects
    this.emit('activity', {
      module: m || s.activity,
      correct: !!isCorrect,
      responseTime: Number(responseTime) || 0,
      ...sessionData
    });

    // Also mirror via window event (optional)
    window.dispatchEvent(new CustomEvent('vmq-answer', {
      detail: { module: m || s.activity, correct: !!isCorrect, responseTime: Number(responseTime) || 0 }
    }));
  }

  trackNavigation(route, meta = {}) {
    // Router calls this via default import optional chaining  [oai_citation:6‡storageengine.js](sediment://file_00000000763c71fda26f3fe62c85b980)
    this.trackActivity('nav', 'route', { route, ...meta });
  }

  /**
   * Overloaded:
   * - trackActivity("Interval Training") => startSession(...)
   * - trackActivity("toast","show",{...}) => log event (Toast does this)  [oai_citation:7‡Toast.js](sediment://file_000000006bb471fdb8a5e9bec2ac7198)
   */
  trackActivity(a, b, c) {
    // 1-arg form: treat as session start
    if (typeof b === 'undefined') {
      this.startSession(String(a || '').trim(), { source: 'trackActivity:session' });
      return;
    }

    // 2-3 arg form: event logging
    const category = String(a || 'event');
    const action = String(b || 'log');
    const payload = (c && typeof c === 'object') ? c : { value: c };

    // keep session alive while user interacts
    this.lastActive = Date.now();

    // If SRS events come through, buffer them for end-of-session sync
    if (category.toLowerCase() === 'sm2' || category.toLowerCase() === 'srs') {
      if (this.currentSession) {
        const item = {
          ts: payload?.ts || Date.now(),
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

    // Generic emit for anyone listening
    this.emit('event', { category, action, payload, ts: Date.now() });
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

    // If we are NOT getting direct answer events, try to infer counts from deltas
    if (!this._directAnswerTracking) {
      const inferredCorrect = correct;
      const inferredWrong = Math.max(0, total - correct);
      session.interactions.correctAnswers = inferredCorrect;
      session.interactions.wrongAnswers = inferredWrong;
    }
  }

  updateDOMScore(session) {
    const root = document.getElementById('root');
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
        if (Number.isFinite(score) && Number.isFinite(total) && total >= this.lastDOMScore.total) {
          this.lastDOMScore = { score, total, accuracy: total ? Math.round((score / total) * 100) : 0 };
          session.domScore = { ...this.lastDOMScore };
        }
      } else if (m.length === 2) {
        const acc = Number(m[1]);
        if (Number.isFinite(acc)) {
          session.domScore.accuracy = acc;
        }
      }
      break;
    }
  }

  updateFocusScore(session) {
    const totalTime = session.engagedMs + session.pausedMs + session.idleMs;
    if (!totalTime) return;
    session.focusScore = session.engagedMs / totalTime;
  }

  updateFinalStats(session) {
    // Prefer DOM score if it’s clearly better / more complete
    if (session.domScore.total > session.statsDelta.total) {
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

    const i = session.interactions;
    const totalInteractions = (i.keystrokes || 0) + (i.clicks || 0) + ((i.audioPlays || 0) * 2);
    const perMin = totalInteractions / mins;
    const ideal = 25;

    return Math.max(0, Math.min(100, Math.round((perMin / ideal) * 100)));
  }

  calculateConsistencyScore(session) {
    const total = (session.interactions.correctAnswers || 0) + (session.interactions.wrongAnswers || 0);
    if (total < 10) return 50;

    // simple stability heuristic: penalize very low accuracy
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
    day.modules[entry.activity].sessions++;
    day.modules[entry.activity].minutes += entry.minutes || 0;
    day.modules[entry.activity].accuracy = entry.accuracy || 0;

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
    const backup = { ...this.currentSession, isBackup: true, backupTime: Date.now() };
    try { sessionStorage.setItem('vmq-session-backup', JSON.stringify(backup)); } catch (_) {}
  }

  restoreSessionBackup() {
    let raw = null;
    try { raw = sessionStorage.getItem('vmq-session-backup'); } catch (_) {}
    if (!raw) return false;

    try {
      const session = JSON.parse(raw);
      const age = Date.now() - (session.backupTime || 0);

      if (age < 600000) { // 10 min
        console.log('[Tracker] 🔄 Restoring session backup');
        this.currentSession = session;
        sessionStorage.removeItem('vmq-session-backup');
        return true;
      }

      console.log('[Tracker] 🗑️ Discarding stale session backup');
      sessionStorage.removeItem('vmq-session-backup');
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
      if (Date.now() - this.lastActive >= CONFIG.IDLE_TIMEOUT) {
        this.showIdleWarning();
      }
    }, CONFIG.IDLE_TIMEOUT - CONFIG.IDLE_WARNING);
  }

  showIdleWarning() {
    window.dispatchEvent(new CustomEvent('vmq-idle-warning', {
      detail: { secondsIdle: Math.floor((Date.now() - this.lastActive) / 1000) }
    }));
  }

  hideIdleWarning() {
    if (this.idleWarningTimer) {
      clearTimeout(this.idleWarningTimer);
      this.idleWarningTimer = null;
    }
    window.dispatchEvent(new CustomEvent('vmq-idle-resume'));
  }

  // ======================================
  // ROUTE / MODULE CHANGE WATCHER
  // ======================================
  detectAndStartSession() {
    const activity = this.detectActivity();
    if (activity && (!this.currentSession || this.currentSession.activity !== activity)) {
      this.startSession(activity, { source: 'auto-detect' });
    }

    // SPA mutation observer
    if (!this.observer) {
      const root = document.getElementById('root');
      if (!root) return;

      this.observer = new MutationObserver(() => {
        const next = this.detectActivity();
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
  setupListeners() {
    const activityEvents = [
      'pointerdown', 'pointermove', 'keydown', 'wheel',
      'touchstart', 'touchmove', 'click'
    ];

    activityEvents.forEach(evt => {
      window.addEventListener(evt, () => {
        this.lastActive = Date.now();
        if (this.isPaused) {
          this.isPaused = false;
          this.hideIdleWarning();
        }
      }, { passive: true });
    });

    window.addEventListener('keydown', () => {
      if (this.currentSession) this.currentSession.interactions.keystrokes++;
    }, { passive: true });

    window.addEventListener('click', () => {
      if (this.currentSession) this.currentSession.interactions.clicks++;
    }, { passive: true });

    window.addEventListener('wheel', () => {
      if (this.currentSession) this.currentSession.interactions.scrolls++;
    }, { passive: true });

    // Audio plays (your app emits this)
    window.addEventListener('vmq-audio-play', () => {
      if (this.currentSession) this.currentSession.interactions.audioPlays++;
    });

    // SRS per-card events (optional: if you emit them)
    window.addEventListener('vmq-srs-review', (e) => {
      const detail = e?.detail || {};
      // store as sm2/srs event
      this.trackActivity('sm2', 'review', detail);
    });

    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible) {
        this.lastActive = Date.now();
        this.isPaused = false;
      }
    });

    window.addEventListener('pagehide', () => this.endSession('pagehide'));
    window.addEventListener('beforeunload', () => this.endSession('beforeunload'));

    window.addEventListener('blur', () => {
      if (this.currentSession) this.currentSession.pausedMs += CONFIG.TICK_INTERVAL;
    });

    window.addEventListener('focus', () => {
      this.lastActive = Date.now();
    });
  }

  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) this.lastActive = Date.now();
      });
    }, { threshold: 0.5 });

    const main = document.querySelector('#root, [role="main"]');
    if (main) this.intersectionObserver.observe(main);
  }

  // ======================================
  // SRS SYNC (fixes updateSRSReviews import fragility)
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

    // fire-and-forget (don’t block UI)
    this._loadSpacedRepetitionModule()
      .then((mod) => {
        const fn = mod?.updateSRSReviews;
        if (typeof fn !== 'function') {
          console.warn('[Tracker] updateSRSReviews missing: spaced repetition session sync skipped');
          return;
        }

        // prefer rich payload; your updater can accept summary or full list
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
      accuracy: this.currentSession.statsDelta.accuracy,
      focusScore: Math.round(this.currentSession.focusScore * 100),
      interactions: this.currentSession.interactions,
      isIdle: this.isPaused
    };
  }

  // Used by analytics pages (optional convenience)
  getRecentSessions(timeframe = 'week') {
    const log = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
    const now = Date.now();
    const cutoffs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      all: Infinity
    };
    const cutoff = cutoffs[timeframe] || cutoffs.week;
    return log.filter(s => now - s.timestamp < cutoff);
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
    const maxDaily = Math.max(...days.map(d => d.questions));

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
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'desktop';
  }

  getBrowserInfo() {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Unknown';
  }
}

// ======================================
// SINGLETON + AUTO INIT
// ======================================
export const sessionTracker = new SessionTracker();

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    sessionTracker.init();
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

// Default export MUST be the tracker instance (Router/Toast expect this)  [oai_citation:8‡storageengine.js](sediment://file_00000000763c71fda26f3fe62c85b980)  [oai_citation:9‡Toast.js](sediment://file_000000006bb471fdb8a5e9bec2ac7198)
export default sessionTracker;