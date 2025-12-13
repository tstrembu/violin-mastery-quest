// ======================================
// SESSION TRACKER v2.1.1 - Advanced Auto-Detection & Learning Analytics
// Powers Analytics + Coach + Gamification + Spaced Repetition
// ======================================

import { loadJSON, saveJSON, STORAGE_KEYS } from '../config/storage.js';
import { addXP, updateStreak, checkAchievements } from './gamification.js';
import { updateSRSReviews } from './spacedRepetition.js';

// ======================================
// CONFIGURATION
// ======================================
const CONFIG = {
  IDLE_TIMEOUT: 30000,        // 30s idle → pause
  IDLE_WARNING: 20000,        // 20s → show warning
  TICK_INTERVAL: 1000,        // 1s updates
  MIN_SESSION_MINUTES: 1,     // Minimum trackable session
  AUTO_SAVE_INTERVAL: 30000,  // 30s autosave
  MAX_SESSION_HOURS: 4,       // 4hr max (prevent runaway)
  FOCUS_THRESHOLD: 0.8,       // 80% focus = high quality
  INTERACTION_WINDOW: 5000,   // 5s interaction grouping
  MAX_JOURNAL_ENTRIES: 1000   // Keep last 1000 sessions
};

// ======================================
// SESSION TRACKER CLASS (Enhanced)
// ======================================
class SessionTracker {
  constructor() {
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
    this.lastDOMScore = { score: 0, total: 0 };
    
    // Engagement tracking (enhanced)
    this.engagementMetrics = {
      interactions: [],
      keystrokes: 0,
      clicks: 0,
      scrolls: 0,
      audioPlays: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      focusScore: 1.0,
      qualityScore: 0
    };

    // Performance tracking
    this.performanceLog = [];
    this.lastPerformanceCheck = Date.now();
  }

  // ======================================
  // INITIALIZATION
  // ======================================
  init() {
    if (this.ticker) return; // Already initialized
    
    this.setupListeners();
    this.startTicker();
    this.setupAutoSave();
    this.detectAndStartSession();
    this.setupIntersectionObserver();
    
    console.log('[Tracker] 🎯 Session tracking v2.1.1 active');
  }

  // ======================================
  // MODULE DETECTION (Enhanced for 50+ components)
  // ======================================
  detectActivity() {
    const root = document.getElementById('root');
    if (!root) return null;

    // Complete VMQ module mapping (all 50+ components)
    const MODULE_MAP = {
      // Core Training (8 primary)
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

      // Ear Training (6 modules)
      'interval ear tester': 'Interval Ear Tester',
      'interval sprint': 'Interval Sprint',
      'key tester': 'Key Signature Tester',
      'perfect pitch': 'Perfect Pitch Trainer',
      'chord recognition': 'Chord Recognition',
      'melodic dictation': 'Melodic Dictation',

      // Rhythm Modules (4)
      'rhythm drills': 'Rhythm Drills',
      'rhythm sight reading': 'Rhythm Sight Reading',
      'tempo trainer': 'Tempo Trainer',
      'polyrhythm': 'Polyrhythm Trainer',

      // Bieler Method (5)
      'bieler lab': 'Bieler Lab',
      'bieler position': 'Position Practice',
      'bieler shifting': 'Shifting Exercises',
      'bieler vibrato': 'Vibrato Development',
      'bieler bowing': 'Advanced Bowing',

      // Theory & Visualization (8)
      'fingerboard': 'Fingerboard Mastery',
      'position charts': 'Position Charts',
      'scales lab': 'Scales Lab',
      'note locator': 'Note Locator',
      'chord builder': 'Chord Builder',
      'circle of fifths': 'Circle of Fifths',
      'mode explorer': 'Mode Explorer',
      'scale degrees': 'Scale Degrees',

      // Drills & Challenges (8)
      'speed drill': 'Speed Drill',
      'accuracy challenge': 'Accuracy Challenge',
      'snapshot': 'Snapshot Quiz',
      'custom drill': 'Custom Drill',
      'random challenge': 'Random Challenge',
      'timed test': 'Timed Test',
      'mastery check': 'Mastery Check',
      'progressive drill': 'Progressive Drill',

      // Tools & Planning (6)
      'practice planner': 'Practice Planner',
      'practice journal': 'Practice Journal',
      'flashcards': 'Flashcards (SM-2)',
      'metronome': 'Metronome',
      'tuner': 'Tuner',
      'drone': 'Drone Notes',

      // Reference & Learning (4)
      'reference library': 'Reference Library',
      'technique guide': 'Technique Guide',
      'repertoire tracker': 'Repertoire Tracker',
      'lesson notes': 'Lesson Notes',

      // Gamification (3)
      'achievements': 'Achievements',
      'daily goals': 'Daily Goals',
      'leaderboard': 'Leaderboard'
    };

    // Priority search order
    const selectors = [
      '[data-module]',               // Explicit module attribute
      '.module-header h2',           // Module headers
      '.card-header h2',             // Card headers
      '.mode-header h2',             // Mode headers
      '.module-container h2',        // Container headers
      'header h2',                   // Generic headers
      '.active-module',              // Active module indicator
      '[role="main"] h1, [role="main"] h2' // Main content headers
    ];

    for (const selector of selectors) {
      const elements = root.querySelectorAll(selector);
      
      for (const element of elements) {
        // Check data attribute first
        const dataModule = element.getAttribute('data-module');
        if (dataModule) {
          const mapped = MODULE_MAP[dataModule.toLowerCase()];
          if (mapped !== null) return mapped || dataModule;
        }

        // Check text content
        const text = element.textContent?.trim().toLowerCase() || '';
        if (!text) continue;

        // Find exact module match
        for (const [key, label] of Object.entries(MODULE_MAP)) {
          if (text.includes(key)) {
            return label; // Returns null for non-training screens
          }
        }

        // Fallback: clean title case (training screens only)
        if (text && !this.isNavigationScreen(text)) {
          return this.toTitleCase(text.replace(/[📊🎼🎵🎹🎻🎸🥁]/g, '').trim());
        }
      }
    }

    return null;
  }

  isNavigationScreen(text) {
    const navScreens = [
      'dashboard', 'settings', 'welcome', 'home', 'menu',
      'analytics', 'achievements', 'goals', 'stats'
    ];
    return navScreens.some(screen => text.includes(screen));
  }

  toTitleCase(str) {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .slice(0, 50); // Max 50 chars
  }

  // ======================================
  // SESSION LIFECYCLE (Enhanced)
  // ======================================
  startSession(activity) {
    if (!activity || this.currentSession?.activity === activity) return;

    // End previous session
    if (this.currentSession) {
      this.endSession('module-switch');
    }

    // Initialize new session
    this.currentSession = {
      id: `vmq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      activity,
      date: new Date().toISOString().split('T')[0],
      startTime: Date.now(),
      endTime: null,
      
      // Time tracking
      engagedMs: 0,
      pausedMs: 0,
      idleMs: 0,
      totalMs: 0,
      
      // Performance metrics
      statsDelta: { correct: 0, total: 0, accuracy: 0 },
      domScore: { score: 0, total: 0, accuracy: 0 },
      
      // Engagement metrics
      interactions: {
        keystrokes: 0,
        clicks: 0,
        scrolls: 0,
        audioPlays: 0,
        correctAnswers: 0,
        wrongAnswers: 0
      },
      
      // Quality metrics
      focusScore: 1.0,        // 0-1 (time focused)
      qualityScore: 0,        // 0-100 (overall quality)
      consistencyScore: 0,    // 0-100 (performance consistency)
      
      // Learning outcomes
      conceptsMastered: [],
      difficultiesEncountered: [],
      breakthroughs: [],
      
      // Session metadata
      deviceType: this.getDeviceType(),
      browserInfo: this.getBrowserInfo(),
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      isPWA: window.matchMedia('(display-mode: standalone)').matches
    };

    // Capture baseline
    this.baselineStats = loadJSON(STORAGE_KEYS.STATS, {});
    this.lastActive = Date.now();
    this.isPaused = false;
    this.resetEngagementMetrics();
    
    console.log(`[Tracker] 🎵 Started: ${activity}`);
    
    // Emit session start event
    window.dispatchEvent(new CustomEvent('vmq-session-start', { 
      detail: { activity, sessionId: this.currentSession.id } 
    }));
  }

  endSession(reason = 'manual') {
    const session = this.currentSession;
    if (!session) return;

    const now = Date.now();
    session.endTime = now;
    session.totalMs = now - session.startTime;
    
    // Minimum session length check
    const minutes = Math.floor(session.engagedMs / 60000);
    if (minutes < CONFIG.MIN_SESSION_MINUTES) {
      console.log(`[Tracker] ⏭️ Session too short (${minutes}min), not saving`);
      this.currentSession = null;
      return;
    }

    // Maximum session length check (prevent runaways)
    if (session.totalMs > CONFIG.MAX_SESSION_HOURS * 3600000) {
      console.warn(`[Tracker] ⚠️ Session exceeded ${CONFIG.MAX_SESSION_HOURS}hr, capping`);
      session.totalMs = CONFIG.MAX_SESSION_HOURS * 3600000;
      session.engagedMs = Math.min(session.engagedMs, session.totalMs * 0.8);
    }

    // Finalize metrics
    this.updateFinalStats(session);
    this.calculateQualityMetrics(session);
    
    // Calculate XP (accuracy + engagement + quality bonuses)
    const baseXP = Math.round(minutes * session.statsDelta.accuracy / 10); // 0-10 XP/min
    const focusBonus = Math.round(baseXP * session.focusScore * 0.2);
    const qualityBonus = session.qualityScore >= 80 ? Math.round(baseXP * 0.3) : 0;
    const xpEarned = baseXP + focusBonus + qualityBonus;

    // Create journal entry
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
      
      conceptsMastered: session.conceptsMastered,
      breakthroughs: session.breakthroughs,
      
      endReason: reason,
      
      // Metadata for analytics
      deviceType: session.deviceType,
      isPWA: session.isPWA
    };

    // Save to journal
    const journal = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
    journal.unshift(entry);
    saveJSON(STORAGE_KEYS.PRACTICE_LOG, journal.slice(0, CONFIG.MAX_JOURNAL_ENTRIES));

    // Update engines
    addXP(xpEarned);
    updateStreak();
    checkAchievements?.();
    
    // Update daily stats
    this.updateDailyStats(entry);

    console.log(
      `[Tracker] ✅ Saved: ${session.activity}\n` +
      `  ⏱️  ${minutes}min (${Math.round(session.focusScore * 100)}% focused)\n` +
      `  🎯 ${session.statsDelta.accuracy}% accuracy\n` +
      `  ⭐ ${xpEarned} XP (Q${session.qualityScore})`
    );

    // Emit session end event
    window.dispatchEvent(new CustomEvent('vmq-session-end', { 
      detail: entry 
    }));

    this.currentSession = null;
  }

  // ======================================
  // REAL-TIME TRACKING (1s ticker)
  // ======================================
  tick() {
    if (!this.currentSession) {
      this.detectAndStartSession();
      return;
    }

    const now = Date.now();
    const timeSinceActive = now - this.lastActive;
    
    // State management
    if (!this.isVisible) {
      this.currentSession.pausedMs += CONFIG.TICK_INTERVAL;
      return;
    }

    if (timeSinceActive >= CONFIG.IDLE_TIMEOUT) {
      if (!this.isPaused) {
        this.isPaused = true;
        this.showIdleWarning();
      }
      this.currentSession.idleMs += CONFIG.TICK_INTERVAL;
      return;
    } else if (this.isPaused) {
      this.isPaused = false;
      this.hideIdleWarning();
    }

    // Active engagement
    this.currentSession.engagedMs += CONFIG.TICK_INTERVAL;

    // Update metrics
    this.updateStats();
    this.updateDOMScore();
    this.updateFocusScore();
    
    // Performance check every 10 ticks
    if (this.currentSession.engagedMs % 10000 === 0) {
      this.checkPerformanceTrend();
    }

    // Show idle warning at 20s
    if (timeSinceActive >= CONFIG.IDLE_WARNING && !this.idleWarningTimer) {
      this.showSoftIdleWarning();
    }
  }

  updateStats() {
    if (!this.baselineStats || !this.currentSession) return;

    const current = loadJSON(STORAGE_KEYS.STATS, {});
    let correct = 0, total = 0;

    // Calculate delta from baseline
    Object.entries(current.byModule || {}).forEach(([module, data = {}]) => {
      const base = this.baselineStats.byModule?.[module] || {};
      correct += Math.max(0, (data.correct || 0) - (base.correct || 0));
      total += Math.max(0, (data.total || 0) - (base.total || 0));
    });

    this.currentSession.statsDelta = {
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
    };

    // Track answers in real-time
    const newCorrect = correct - this.currentSession.interactions.correctAnswers;
    const newWrong = (total - correct) - this.currentSession.interactions.wrongAnswers;
    
    if (newCorrect > 0) {
      this.currentSession.interactions.correctAnswers += newCorrect;
      this.logPerformancePoint(true);
    }
    if (newWrong > 0) {
      this.currentSession.interactions.wrongAnswers += newWrong;
      this.logPerformancePoint(false);
    }
  }

  updateDOMScore() {
    // Find score displays in DOM (supports multiple formats)
    const scorePatterns = [
      /score[:\s]*(\d+)\s*[\/\-of]\s*(\d+)/i,
      /(\d+)\s*[\/\-]\s*(\d+)\s*correct/i,
      /accuracy[:\s]*(\d+)%/i,
      /progress[:\s]*(\d+)\s*[\/]\s*(\d+)/i
    ];

    const root = document.getElementById('root');
    if (!root) return;

    const text = root.textContent || '';
    
    for (const pattern of scorePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match.length === 3) {
          // score/total format
          const score = Number(match[1]);
          const total = Number(match[2]);
          if (total > this.lastDOMScore.total) {
            this.lastDOMScore = { score, total };
            this.currentSession.domScore = {
              score,
              total,
              accuracy: Math.round((score / total) * 100)
            };
          }
        } else if (match.length === 2) {
          // percentage format
          const accuracy = Number(match[1]);
          if (accuracy !== this.lastDOMScore.accuracy) {
            this.currentSession.domScore.accuracy = accuracy;
          }
        }
        break;
      }
    }
  }

  updateFocusScore() {
    const session = this.currentSession;
    if (!session) return;

    const totalTime = session.engagedMs + session.pausedMs + session.idleMs;
    if (totalTime === 0) return;

    session.focusScore = session.engagedMs / totalTime;
  }

  // ======================================
  // PERFORMANCE ANALYSIS
  // ======================================
  logPerformancePoint(isCorrect) {
    this.performanceLog.push({
      timestamp: Date.now(),
      correct: isCorrect
    });

    // Keep last 20 points
    if (this.performanceLog.length > 20) {
      this.performanceLog.shift();
    }
  }

  checkPerformanceTrend() {
    if (this.performanceLog.length < 5) return;

    const recent = this.performanceLog.slice(-10);
    const accuracy = recent.filter(p => p.correct).length / recent.length;
    
    // Detect patterns
    if (accuracy >= 0.9 && !this.currentSession.breakthroughs.includes('high-accuracy')) {
      this.currentSession.breakthroughs.push('high-accuracy');
      console.log('[Tracker] 🌟 Breakthrough: 90%+ accuracy streak!');
    }

    if (accuracy <= 0.5 && this.currentSession.statsDelta.total >= 10) {
      if (!this.currentSession.difficultiesEncountered.includes('low-accuracy')) {
        this.currentSession.difficultiesEncountered.push('low-accuracy');
        console.log('[Tracker] ⚠️ Difficulty detected: Consider reviewing concepts');
      }
    }
  }

  calculateQualityMetrics(session) {
    // Quality score: weighted combination of metrics
    const accuracyWeight = 0.4;
    const focusWeight = 0.3;
    const consistencyWeight = 0.2;
    const engagementWeight = 0.1;

    const accuracyScore = session.statsDelta.accuracy;
    const focusScore = session.focusScore * 100;
    const engagementScore = this.calculateEngagementScore(session);
    const consistencyScore = this.calculateConsistencyScore();

    session.qualityScore = Math.round(
      accuracyScore * accuracyWeight +
      focusScore * focusWeight +
      consistencyScore * consistencyWeight +
      engagementScore * engagementWeight
    );

    session.consistencyScore = consistencyScore;
  }

  calculateEngagementScore(session) {
    const interactions = session.interactions;
    const minutes = session.engagedMs / 60000;
    if (minutes === 0) return 0;

    // Expect ~20-30 interactions per minute (clicks, keys, audio)
    const totalInteractions = 
      interactions.keystrokes + 
      interactions.clicks + 
      interactions.audioPlays * 2; // Audio counts double

    const interactionsPerMin = totalInteractions / minutes;
    const idealRate = 25;
    
    // Score peaks at ideal rate, drops if too low or too high
    return Math.round(Math.min(100, (interactionsPerMin / idealRate) * 100));
  }

  calculateConsistencyScore() {
    if (this.performanceLog.length < 10) return 50; // Not enough data

    // Calculate variance in performance
    const recentPerformance = this.performanceLog.slice(-20);
    const accuracies = [];
    
    // Group into windows of 5
    for (let i = 0; i < recentPerformance.length - 4; i += 5) {
      const window = recentPerformance.slice(i, i + 5);
      const acc = window.filter(p => p.correct).length / window.length;
      accuracies.push(acc);
    }

    if (accuracies.length < 2) return 50;

    // Calculate standard deviation
    const mean = accuracies.reduce((a, b) => a + b) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = higher consistency (invert and scale to 0-100)
    const consistencyScore = Math.round((1 - stdDev) * 100);
    return Math.max(0, Math.min(100, consistencyScore));
  }

  updateFinalStats(session) {
    // Use the better of statsDelta or domScore
    if (session.domScore.total > session.statsDelta.total) {
      session.statsDelta = session.domScore;
    }
  }

  // ======================================
  // DAILY STATS AGGREGATION
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
    day.totalMinutes += entry.minutes;
    day.totalQuestions += entry.total;
    day.totalXP += entry.xpEarned;
    
    // Recalculate averages
    day.avgAccuracy = Math.round(
      ((day.avgAccuracy * (day.sessions - 1)) + entry.accuracy) / day.sessions
    );
    day.avgFocusScore = Math.round(
      ((day.avgFocusScore * (day.sessions - 1)) + entry.focusScore) / day.sessions
    );

    // Track per-module stats
    if (!day.modules[entry.activity]) {
      day.modules[entry.activity] = { sessions: 0, minutes: 0, accuracy: 0 };
    }
    day.modules[entry.activity].sessions++;
    day.modules[entry.activity].minutes += entry.minutes;
    day.modules[entry.activity].accuracy = entry.accuracy;

    // Keep last 90 days
    const dates = Object.keys(dailyStats).sort();
    if (dates.length > 90) {
      dates.slice(0, dates.length - 90).forEach(date => delete dailyStats[date]);
    }

    saveJSON(STORAGE_KEYS.DAILY_STATS, dailyStats);
  }

  // ======================================
  // EVENT LISTENERS (Enhanced)
  // ======================================
  setupListeners() {
    // User activity tracking
    const activityEvents = [
      'pointerdown', 'pointermove', 'keydown', 'wheel', 
      'touchstart', 'touchmove', 'click'
    ];

    activityEvents.forEach(event => {
      window.addEventListener(event, () => {
        this.lastActive = Date.now();
        if (this.isPaused) {
          this.isPaused = false;
          this.hideIdleWarning();
        }
      }, { passive: true });
    });

    // Specific interaction tracking
    window.addEventListener('keydown', () => {
      if (this.currentSession) this.currentSession.interactions.keystrokes++;
    }, { passive: true });

    window.addEventListener('click', () => {
      if (this.currentSession) this.currentSession.interactions.clicks++;
    }, { passive: true });

    window.addEventListener('wheel', () => {
      if (this.currentSession) this.currentSession.interactions.scrolls++;
    }, { passive: true, once: false });

    // Audio tracking (VMQ audioEngine integration)
    window.addEventListener('vmq-audio-play', () => {
      if (this.currentSession) this.currentSession.interactions.audioPlays++;
    });

    // Visibility API
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible) {
        this.lastActive = Date.now();
        this.isPaused = false;
      }
    });

    // Page lifecycle
    window.addEventListener('pagehide', () => this.endSession('pagehide'));
    window.addEventListener('beforeunload', () => this.endSession('beforeunload'));
    
    // Handle page focus loss (user switched tabs)
    window.addEventListener('blur', () => {
      if (this.currentSession) {
        this.currentSession.pausedMs += CONFIG.TICK_INTERVAL;
      }
    });

    window.addEventListener('focus', () => {
      this.lastActive = Date.now();
    });
  }

  setupIntersectionObserver() {
    // Track if main content is visible (advanced focus detection)
    if (!('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.lastActive = Date.now();
        }
      });
    }, { threshold: 0.5 });

    const main = document.querySelector('#root, [role="main"]');
    if (main) {
      this.intersectionObserver.observe(main);
    }
  }

  // ======================================
  // TICKER & AUTO-SAVE
  // ======================================
  startTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = setInterval(() => this.tick(), CONFIG.TICK_INTERVAL);
  }

  setupAutoSave() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    
    // Auto-save session every 30s (backup)
    this.autoSaveTimer = setInterval(() => {
      if (this.currentSession && this.currentSession.engagedMs >= 60000) {
        this.saveSessionBackup();
      }
    }, CONFIG.AUTO_SAVE_INTERVAL);
  }

  saveSessionBackup() {
    if (!this.currentSession) return;
    
    const backup = {
      ...this.currentSession,
      isBackup: true,
      backupTime: Date.now()
    };
    
    sessionStorage.setItem('vmq-session-backup', JSON.stringify(backup));
  }

  restoreSessionBackup() {
    const backup = sessionStorage.getItem('vmq-session-backup');
    if (!backup) return false;

    // ...
    try {
      const session = JSON.parse(backup);
      const age = Date.now() - session.backupTime;
      
      // Only restore if less than 10 minutes old
      if (age < 600000) {
        console.log('[Tracker] 🔄 Restoring session backup');
        this.currentSession = session;
        sessionStorage.removeItem('vmq-session-backup'); // Remove successful backup
        return true;
      } else {
        // If too old, remove the stale backup
        console.log('[Tracker] 🗑️ Discarding stale session backup');
        sessionStorage.removeItem('vmq-session-backup');
      }
    } catch (e) {
      console.warn('[Tracker] Failed to restore backup:', e);
      sessionStorage.removeItem('vmq-session-backup'); // Remove failed backup
    }
    
    return false;
  }

  // ======================================
  // IDLE WARNING UI
  // ======================================
  showSoftIdleWarning() {
    this.idleWarningTimer = setTimeout(() => {
      if (Date.now() - this.lastActive >= CONFIG.IDLE_TIMEOUT) {
        this.showIdleWarning();
      }
    }, CONFIG.IDLE_TIMEOUT - CONFIG.IDLE_WARNING);
  }

  showIdleWarning() {
    // Emit event for UI to show warning
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
  // MUTATION OBSERVER (Module change detection)
  // ======================================
  detectAndStartSession() {
    const activity = this.detectActivity();
    
    if (activity && (!this.currentSession || this.currentSession.activity !== activity)) {
      this.startSession(activity);
    }

    // Setup mutation observer for SPA route changes
    if (!this.observer) {
      const root = document.getElementById('root');
      if (!root) return;

      this.observer = new MutationObserver(() => {
        const newActivity = this.detectActivity();
        if (newActivity && newActivity !== this.currentSession?.activity) {
          this.endSession('route-change');
          this.startSession(newActivity);
        }
      });

      this.observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: false
      });
    }
  }

  // ======================================
  // HELPER FUNCTIONS
  // ======================================
  resetEngagementMetrics() {
    this.engagementMetrics = {
      interactions: [],
      keystrokes: 0,
      clicks: 0,
      scrolls: 0,
      audioPlays: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      focusScore: 1.0,
      qualityScore: 0
    };
    this.performanceLog = [];
  }

  getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'desktop';
  }

  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    
    return browser;
  }

  // ======================================
  // PUBLIC API
  // ======================================
  forceEnd(reason = 'manual') {
    this.endSession(reason);
  }

  getCurrentSession() {
    return this.currentSession;
  }

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

  destroy() {
    this.endSession('app-destroy');
    
    if (this.ticker) clearInterval(this.ticker);
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    if (this.idleWarningTimer) clearTimeout(this.idleWarningTimer);
    if (this.observer) this.observer.disconnect();
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
    
    console.log('[Tracker] 🛑 Session tracking stopped');
  }
}

// ======================================
// GLOBAL INSTANCE & AUTO-INIT
// ======================================
export const sessionTracker = new SessionTracker();

// Auto-initialize on page load
if (typeof window !== 'undefined') {
  // Try to restore backup session first
  window.addEventListener('DOMContentLoaded', () => {
    sessionTracker.restoreSessionBackup();
    sessionTracker.init();
  });
}

// ======================================
// PUBLIC API FOR COMPONENTS
// ======================================
export function trackActivity(activity) {
  sessionTracker.startSession(activity);
}

export function endCurrentSession(reason) {
  sessionTracker.forceEnd(reason);
}

export function getSessionStats() {
  return sessionTracker.getSessionStats();
}

export function isSessionActive() {
  return sessionTracker.currentSession !== null;
}

// Export for analytics
export function getRecentSessions(timeframe = 'week') {
  const log = loadJSON(STORAGE_KEYS.PRACTICE_LOG, []);
  const now = Date.now();
  
  const cutoffs = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: Infinity
  };

  const cutoff = cutoffs[timeframe] || cutoffs.week;
  
  return log.filter(session => now - session.timestamp < cutoff);
}

export function getWeeklyStats() {
  const sessions = getRecentSessions('week');
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => ({
    name,
    questions: 0,
    minutes: 0,
    xp: 0
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
    streak: calculateStreak(sessions),
    xpPerDay: sessions.reduce((sum, s) => sum + (s.xpEarned || 0), 0) / 7
  };
}

function calculateStreak(sessions) {
  if (sessions.length === 0) return 0;

  let streak = 1;
  const sorted = sessions.sort((a, b) => b.timestamp - a.timestamp);
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = new Date(sorted[i].timestamp).setHours(0, 0, 0, 0);
    const next = new Date(sorted[i + 1].timestamp).setHours(0, 0, 0, 0);
    const dayDiff = (current - next) / (24 * 60 * 60 * 1000);
    
    if (dayDiff === 1) {
      streak++;
    } else if (dayDiff > 1) {
      break;
    }
  }

  return streak;
}

export default {
  sessionTracker,
  trackActivity,
  endCurrentSession,
  getSessionStats,
  isSessionActive,
  getRecentSessions,
  getWeeklyStats
};
