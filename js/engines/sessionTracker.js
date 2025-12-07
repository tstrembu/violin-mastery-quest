// ======================================
// SESSION TRACKER v2.0 - Auto Practice Logging
// Powers Analytics + Coach + Gamification
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { addXP, updateStreak } from './gamification.js';

const IDLE_TIMEOUT = 30000;  // 30s idle → pause
const TICK_INTERVAL = 1000;  // 1s updates
const MIN_SESSION_MINUTES = 1;

class SessionTracker {
  constructor() {
    this.currentSession = null;
    this.lastActive = Date.now();
    this.isVisible = true;
    this.ticker = null;
    this.observer = null;
    this.baselineStats = null;
    this.lastDOMScore = { score: 0, total: 0 };
  }

  // ======================================
  // INITIALIZATION - App.js calls once
  // ======================================
  init() {
    this.setupListeners();
    this.startTicker();
    this.detectAndStartSession();
    console.log('[Tracker] 🎯 Session tracking active');
  }

  // ======================================
  // CORE DETECTION - 50+ VMQ modules
  // ======================================
  detectActivity() {
    const root = document.getElementById('root');
    if (!root) return null;

    // VMQ Module → Human label mapping (production complete)
    const MODULE_MAP = {
      // Core 8 modules (built)
      'intervals': 'Interval Training',
      'key signatures': 'Key Signatures', 
      'rhythm': 'Rhythm Recognition',
      'bieler': 'Bieler Technique',
      'dashboard': 'Dashboard',
      'analytics': 'Analytics',
      'settings': 'Settings',
      'welcome': 'Welcome',

      // Complete component library
      'interval ear tester': 'Interval Ear Tester',
      'interval sprint': 'Interval Sprint',
      'key tester': 'Key Tester',
      'rhythm drills': 'Rhythm Drills',
      'bieler lab': 'Bieler Lab',
      'main menu': 'Main Menu',

      // Future modules (auto-detect)
      'fingerboard': 'Fingerboard',
      'position charts': 'Position Charts',
      'scales lab': 'Scales Lab',
      'speed drill': 'Speed Drill',
      'snapshot': 'Snapshot',
      'note locator': 'Note Locator',
      'custom drill': 'Custom Drill',
      'tempo trainer': 'Tempo Trainer',
      'practice planner': 'Practice Planner',
      'practice journal': 'Practice Journal',
      'coach panel': 'Coach Panel'
    };

    // Find active module heading
    const headings = root.querySelectorAll('.card h2, .mode-header h2, [data-module]');
    for (const heading of headings) {
      const text = heading.textContent?.trim().toLowerCase() || '';
      
      // Skip non-training screens
      if (['settings', 'dashboard', 'welcome', 'home'].some(skip => text.includes(skip))) 
        continue;

      // Find exact module match
      for (const [key, label] of Object.entries(MODULE_MAP)) {
        if (text.includes(key)) return label;
      }

      // Fallback: clean title case
      if (text && !text.includes('complete')) {
        return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    return null;
  }

  // ======================================
  // SESSION LIFECYCLE
  // ======================================
  startSession(activity) {
    if (!activity || this.currentSession?.activity === activity) return;

    // End previous
    if (this.currentSession) this.endSession('switch');

    this.currentSession = {
      activity,
      date: new Date().toISOString().split('T')[0],
      start: Date.now(),
      engagedMs: 0,
      statsDelta: { correct: 0, total: 0 },
      domScore: { score: 0, total: 0 },
      audioPlays: 0
    };

    this.baselineStats = loadJSON(STORAGE_KEYS.STATS, {});
    this.lastActive = Date.now();
    
    console.log(`[Tracker] 🎵 Started: ${activity}`);
  }

  endSession(reason = 'manual') {
    const session = this.currentSession;
    if (!session || session.engagedMs < MIN_SESSION_MINUTES * 60000) return;

    const end = Date.now();
    const minutes = Math.floor(session.engagedMs / 60000);
    const accuracy = session.domScore.total > 0 
      ? Math.round((session.domScore.score / session.domScore.total) * 100)
      : session.statsDelta.total > 0 
        ? Math.round((session.statsDelta.correct / session.statsDelta.total) * 100) 
        : 0;

    // Journal entry
    const entry = {
      id: `vmq-${Date.now()}`,
      date: session.date,
      activity: session.activity,
      minutes,
      accuracy,
      engagedMs: session.engagedMs,
      score: session.domScore.score,
      total: session.domScore.total,
      xpEarned: Math.round(minutes * accuracy / 10), // 1-10 XP/min
      endReason: reason,
      timestamp: end
    };

    // Save + trigger engines
    const journal = loadJSON(STORAGE_KEYS.JOURNAL, []);
    journal.unshift(entry);
    saveJSON(STORAGE_KEYS.JOURNAL, journal.slice(0, 1000));

    // Gamification sync
    addXP(entry.xpEarned);
    updateStreak();

    console.log(`[Tracker] ✅ Saved: ${session.activity} (${minutes}min, ${accuracy}%)`);
    this.currentSession = null;
  }

  // ======================================
  // REAL-TIME TICKER (1s updates)
  // ======================================
  tick() {
    if (!this.currentSession) {
      this.detectAndStartSession();
      return;
    }

    // Active → count time
    if (this.isVisible && (Date.now() - this.lastActive < IDLE_TIMEOUT)) {
      this.currentSession.engagedMs += TICK_INTERVAL;
    }

    // Update metrics
    this.updateStats();
    this.updateDOMScore();
  }

  updateStats() {
    if (!this.baselineStats || !this.currentSession) return;

    const current = loadJSON(STORAGE_KEYS.STATS, {});
    let correct = 0, total = 0;

    Object.entries(current.byModule || {}).forEach(([module, data = {}]) => {
      const base = this.baselineStats.byModule?.[module] || {};
      correct += Math.max(0, (data.correct || 0) - (base.correct || 0));
      total += Math.max(0, (data.total || 0) - (base.total || 0));
    });

    this.currentSession.statsDelta = { correct, total };
  }

  updateDOMScore() {
    const cards = document.querySelectorAll('.card, .completion-screen');
    for (const card of cards) {
      const text = card.textContent || '';
      const match = text.match(/score[:\s]*(\d+)\s*[\/\-]\s*(\d+)/i);
      
      if (match) {
        const score = Number(match[1]);
        const total = Number(match[2]);
        if (total > this.lastDOMScore.total) {
          this.lastDOMScore = { score, total };
          this.currentSession.domScore = { score, total };
        }
        break;
      }
    }
  }

  // ======================================
  // EVENT LISTENERS (optimized)
  // ======================================
  setupListeners() {
    // Activity detection
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(event => {
      window.addEventListener(event, () => this.lastActive = Date.now(), { passive: true });
    });

    // Visibility
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible) this.lastActive = Date.now();
    });

    // Audio tracking (VMQ audioEngine)
    window.addEventListener('vmq-audio-play', () => {
      if (this.currentSession) this.currentSession.audioPlays++;
    });

    // Cleanup on unload
    window.addEventListener('pagehide', () => this.endSession('pagehide'));
    window.addEventListener('beforeunload', () => this.endSession('unload'));
  }

  startTicker() {
    this.ticker = setInterval(() => this.tick(), TICK_INTERVAL);
  }

  // ======================================
  // MUTATION OBSERVER - Route changes
  // ======================================
  detectAndStartSession() {
    const activity = this.detectActivity();
    if (activity && (!this.currentSession || this.currentSession.activity !== activity)) {
      this.startSession(activity);
    }

    // Watch for module switches
    if (!this.observer) {
      this.observer = new MutationObserver(() => {
        const newActivity = this.detectActivity();
        if (newActivity && newActivity !== this.currentSession?.activity) {
          this.endSession('route-change');
          this.startSession(newActivity);
        }
      });
      this.observer.observe(document.getElementById('root'), {
        childList: true, subtree: true, characterData: true
      });
    }
  }

  // ======================================
  // PUBLIC API - Components call these
  // ======================================
  forceEnd(reason = 'manual') {
    this.endSession(reason);
  }

  getCurrentSession() {
    return this.currentSession;
  }

  destroy() {
    this.endSession('app-unmount');
    if (this.ticker) clearInterval(this.ticker);
    if (this.observer) this.observer.disconnect();
  }
}

// ======================================
// GLOBAL INSTANCE + EXPORTS
// ======================================
export const sessionTracker = new SessionTracker();

// App.js initialization
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => sessionTracker.init());
}

// Public API for components
export function trackActivity(activity) {
  sessionTracker.startSession(activity);
}

export function endCurrentSession(reason) {
  sessionTracker.forceEnd(reason);
}