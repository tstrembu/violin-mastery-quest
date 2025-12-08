// ======================================
// VMQ AUDIO ENGINE v3.0.5 - Web Audio API for Violin Training
// ML-Adaptive • Performance-Optimized • Pedagogically-Designed
// ======================================

import { STORAGE_KEYS } from '../config/storage.js';
import { loadJSON, saveJSON } from '../config/storage.js';

/**
 * AudioEngine - Complete Web Audio implementation for VMQ
 * Handles all sound generation: notes, intervals, feedback, metronome
 * With ML-adaptive audio selection, spaced repetition cues, and performance tracking
 */
class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.compressor = null;
    this.muted = false;
    this.initialized = false;
    this.volume = 0.5;
    
    // Track active oscillators for cleanup
    this.activeOscillators = new Map();
    this.activeDrones = new Map();
    this.activeMetronome = null;
    
    // Audio settings
    this.settings = {
      violinTimbre: true,        // Use violin-like waveform
      reverbEnabled: false,      // Future: convolution reverb
      masterVolume: 0.5,
      vibratoDepth: 3,          // ±Hz variation
      vibratoSpeed: 5,          // Hz frequency
      useHarmonics: true        // Play with sympathetic resonance
    };

    // Performance tracking
    this.stats = {
      totalNotesPlayed: 0,
      activeVoices: 0,
      maxConcurrentVoices: 0,
      feedbackSounds: 0,
      sessionStartTime: Date.now()
    };

    // Pedagogical helpers
    this.lastPlayedNote = null;
    this.feedbackHistory = [];
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize Audio Context (requires user gesture on iOS)
   * @returns {Promise<void>}
   */
  init() {
    if (this.initialized) return Promise.resolve();
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Create master gain node for global volume
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      
      // Add compression to prevent clipping
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      
      // Connect: source → compressor → masterGain → destination
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      
      this.initialized = true;
      console.log('[AudioEngine] v3.1 initialized | Context:', this.audioContext.state);
      return Promise.resolve();
    } catch (error) {
      console.error('[AudioEngine] Initialization failed:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Resume audio context (required for iOS Safari after user interaction)
   */
  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(err => {
        console.warn('[AudioEngine] Resume failed:', err);
      });
    }
  }

  // ============================================================
  // CORE TONE GENERATION - Enhanced
  // ============================================================

  /**
   * Play a single tone with ADSR envelope + optional vibrato
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {object} options - {waveform, volume, attack, decay, sustain, release, vibrato, timbre}
   * @returns {object} { oscillator, gainNode, vibrato }
   */
  playTone(frequency, duration = 0.5, options = {}) {
    if (!this.initialized || this.muted) return null;
    this.resume();
    
    const {
      waveform = this.settings.violinTimbre ? 'sawtooth' : 'sine',
      volume = 0.3,
      attack = 0.02,
      decay = 0.1,
      sustain = 0.7,
      release = 0.1,
      vibrato = this.settings.violinTimbre,
      timbre = 'natural'
    } = options;
    
    const now = this.audioContext.currentTime;
    
    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.value = frequency;
    
    // Create gain envelope
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0;
    
    // Optional: Add subtle vibrato for violin-like sound
    let vibratoOsc = null;
    if (vibrato && waveform === 'sawtooth') {
      vibratoOsc = this.audioContext.createOscillator();
      const vibratoGain = this.audioContext.createGain();
      
      vibratoOsc.frequency.value = this.settings.vibratoSpeed;
      vibratoGain.gain.value = this.settings.vibratoDepth;
      
      vibratoOsc.connect(vibratoGain);
      vibratoGain.connect(oscillator.frequency);
      
      vibratoOsc.start(now);
      vibratoOsc.stop(now + duration);
    }
    
    // Connect oscillator → gain → compressor
    oscillator.connect(gainNode);
    gainNode.connect(this.compressor);
    
    // ADSR envelope
    const peakVolume = volume;
    const sustainVolume = volume * sustain;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakVolume, now + attack);
    gainNode.gain.linearRampToValueAtTime(sustainVolume, now + attack + decay);
    gainNode.gain.setValueAtTime(sustainVolume, now + duration - release);
    gainNode.gain.linearRampToValueAtTime(0.001, now + duration);
    
    // Start and stop
    oscillator.start(now);
    oscillator.stop(now + duration + 0.1);
    
    // Track for cleanup
    const id = Date.now() + Math.random();
    this.activeOscillators.set(id, { oscillator, gainNode, vibratoOsc });
    
    // Update stats
    this.stats.totalNotesPlayed++;
    this.stats.activeVoices = this.activeOscillators.size;
    this.stats.maxConcurrentVoices = Math.max(
      this.stats.maxConcurrentVoices, 
      this.stats.activeVoices
    );
    
    // Store last note for pedagogical reference
    this.lastPlayedNote = { frequency, duration, timestamp: now };
    
    // Auto-cleanup
    oscillator.onended = () => {
      try {
        oscillator.disconnect();
        gainNode.disconnect();
        if (vibratoOsc) vibratoOsc.disconnect();
      } catch (e) {}
      this.activeOscillators.delete(id);
      this.stats.activeVoices = this.activeOscillators.size;
    };
    
    return { oscillator, gainNode, vibratoOsc };
  }

  /**
   * Play interval (two notes)
   * @param {number} freq1 - First note frequency
   * @param {number} freq2 - Second note frequency
   * @param {boolean} harmonic - Play together (true) or melodic (false)
   * @param {number} duration - Total duration in seconds
   * @param {object} options - {volume, harmonyType}
   */
  playInterval(freq1, freq2, harmonic = false, duration = 1.0, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const { volume = 0.25, harmonyType = 'natural' } = options;
    
    if (harmonic) {
      // Harmonic interval - both notes together
      this.playTone(freq1, duration, { 
        volume, 
        waveform: 'sawtooth',
        vibrato: true 
      });
      this.playTone(freq2, duration, { 
        volume, 
        waveform: 'sawtooth',
        vibrato: true 
      });
    } else {
      // Melodic interval - sequential
      const noteDuration = duration * 0.5;
      this.playTone(freq1, noteDuration, { volume, vibrato: true });
      setTimeout(() => {
        this.playTone(freq2, noteDuration, { volume, vibrato: true });
      }, noteDuration * 1000);
    }
  }

  /**
   * Play chord (multiple notes simultaneously)
   * @param {Array<number>} frequencies - Array of frequencies
   * @param {number} duration - Duration in seconds
   * @param {object} options - {volume, type}
   */
  playChord(frequencies, duration = 1.0, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const { volume = 0.3, type = 'major' } = options;
    
    // Reduce volume per note to prevent clipping
    const volumePerNote = Math.min(0.25, volume / frequencies.length);
    
    frequencies.forEach((freq, index) => {
      // Slight stagger for more natural sound
      setTimeout(() => {
        this.playTone(freq, duration, { 
          volume: volumePerNote,
          vibrato: true 
        });
      }, index * 15);
    });
  }

  /**
   * Play arpeggio (notes in sequence)
   * @param {Array<number>} frequencies - Array of frequencies
   * @param {number} noteGap - Gap between notes in seconds
   * @param {boolean} ascending - Play ascending or descending
   */
  playArpeggio(frequencies, noteGap = 0.25, ascending = true) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const notes = ascending ? frequencies : [...frequencies].reverse();
    const noteDuration = noteGap * 1.1; // Slight overlap
    
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, noteDuration, { 
          volume: 0.3,
          vibrato: false  // Crisp arpeggio
        });
      }, index * noteGap * 1000);
    });
  }

  /**
   * Play scale (ascending or descending)
   * @param {Array<number>} frequencies - Scale frequencies
   * @param {number} tempo - Notes per second
   * @param {boolean} ascending - Direction
   * @param {object} options - {volume, withDrone}
   */
  playScale(frequencies, tempo = 2.5, ascending = true, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const { volume = 0.25, withDrone = false } = options;
    
    const notes = ascending ? frequencies : [...frequencies].reverse();
    const noteGap = 1 / tempo;
    const noteDuration = noteGap * 0.9;
    
    // Optional drone on tonic
    let drone = null;
    if (withDrone) {
      const droneFreq = notes[0];
      drone = this.playOpenStringDrone('A', 0.1);
    }
    
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, noteDuration, { 
          volume,
          waveform: 'sawtooth',
          vibrato: index > 0  // No vibrato on tonic drone
        });
      }, index * noteGap * 1000);
    });
  }

  // ============================================================
  // METRONOME & RHYTHM - Enhanced
  // ============================================================

  /**
   * Play metronome tick with visual timing feedback
   * @param {boolean} isDownbeat - First beat of measure
   * @param {number} volume - Volume level
   * @param {object} options - {tonality}
   */
  playMetronomeTick(isDownbeat = false, volume = 0.4, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const { tonality = 'neutral' } = options;
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    // Tonality-aware metronome
    const toneMap = {
      neutral: { downbeat: 1200, upbeat: 800 },
      musical: { downbeat: 523.25, upbeat: 392 },  // C5, G4
      gentle: { downbeat: 440, upbeat: 330 }       // A4, E4
    };
    
    const tones = toneMap[tonality] || toneMap.neutral;
    
    oscillator.type = isDownbeat ? 'square' : 'sine';
    oscillator.frequency.value = isDownbeat ? tones.downbeat : tones.upbeat;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.compressor);
    
    oscillator.start(now);
    oscillator.stop(now + 0.1);
    
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  }

  /**
   * Start metronome with callback on each beat
   * @param {number} bpm - Beats per minute
   * @param {number} beatsPerMeasure - Time signature numerator
   * @param {Function} onBeat - Callback (beatNumber) => void
   * @param {object} options - {tonality, volume}
   * @returns {Object} Controller with stop() and adjust(bpm) methods
   */
  startMetronome(bpm, beatsPerMeasure = 4, onBeat = null, options = {}) {
    if (!this.initialized || this.muted) return null;
    this.resume();
    
    const { tonality = 'neutral', volume = 0.4 } = options;
    
    let interval = (60 / bpm) * 1000;
    let currentBeat = 0;
    let running = true;
    let currentBPM = bpm;
    let timeoutId = null;
    
    const tick = () => {
      if (!running) return;
      
      const isDownbeat = currentBeat % beatsPerMeasure === 0;
      this.playMetronomeTick(isDownbeat, volume, { tonality });
      
      if (onBeat) onBeat(currentBeat);
      currentBeat++;
      
      if (running) {
        timeoutId = setTimeout(tick, interval);
      }
    };
    
    tick();
    
    this.activeMetronome = {
      stop: () => { 
        running = false; 
        if (timeoutId) clearTimeout(timeoutId);
      },
      adjust: (newBPM) => {
        currentBPM = newBPM;
        interval = (60 / newBPM) * 1000;
        if (timeoutId) clearTimeout(timeoutId);
        if (running) timeoutId = setTimeout(tick, interval);
      },
      getBPM: () => currentBPM
    };
    
    return this.activeMetronome;
  }

  /**
   * Stop active metronome
   */
  stopMetronome() {
    if (this.activeMetronome) {
      this.activeMetronome.stop();
      this.activeMetronome = null;
    }
  }

  // ============================================================
  // VIOLIN-SPECIFIC FEATURES
  // ============================================================

  /**
   * Play open string drone (violin tuning: G3, D4, A4, E5)
   * @param {string} string - 'G', 'D', 'A', or 'E'
   * @param {number} volume - Volume level
   * @param {object} options - {fadeIn, withHarmonics}
   * @returns {Object} Controller with stop(), setVolume() methods
   */
  playOpenStringDrone(string = 'A', volume = 0.08, options = {}) {
    if (!this.initialized || this.muted) return null;
    this.resume();
    
    const { fadeIn = 2, withHarmonics = this.settings.useHarmonics } = options;
    
    const openStrings = {
      'G': 196.00,  // G3
      'D': 293.66,  // D4
      'A': 440.00,  // A4
      'E': 659.25   // E5
    };
    
    const frequency = openStrings[string.toUpperCase()];
    if (!frequency) return null;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    
    // Low-pass filter for warmth
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;
    
    // Fade in the drone
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + fadeIn);
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.compressor);
    
    oscillator.start(now);
    
    // Optional: Add harmonic overtones for richness
    let harmonics = [];
    if (withHarmonics) {
      [2, 3, 4].forEach(harmonic => {
        const harmonicOsc = this.audioContext.createOscillator();
        const harmonicGain = this.audioContext.createGain();
        
        harmonicOsc.frequency.value = frequency * harmonic;
        harmonicGain.gain.setValueAtTime(0, now);
        harmonicGain.gain.linearRampToValueAtTime(volume / (harmonic * 2), now + fadeIn);
        
        harmonicOsc.connect(harmonicGain);
        harmonicGain.connect(gainNode);
        harmonicOsc.start(now);
        
        harmonics.push({ oscillator: harmonicOsc, gain: harmonicGain });
      });
    }
    
    const id = string + '_drone_' + Date.now();
    this.activeDrones.set(id, { oscillator, gainNode, filter, harmonics });
    
    return {
      stop: (fadeTime = 1.5) => {
        const now = this.audioContext.currentTime;
        gainNode.gain.linearRampToValueAtTime(0, now + fadeTime);
        setTimeout(() => {
          try {
            oscillator.stop();
            oscillator.disconnect();
            gainNode.disconnect();
            filter.disconnect();
            harmonics.forEach(h => {
              h.oscillator.stop();
              h.oscillator.disconnect();
              h.gain.disconnect();
            });
          } catch (e) {}
          this.activeDrones.delete(id);
        }, fadeTime * 1000);
      },
      setVolume: (newVolume) => {
        const now = this.audioContext.currentTime;
        gainNode.gain.linearRampToValueAtTime(newVolume, now + 0.1);
      }
    };
  }

  /**
   * Play double stop (two notes on violin)
   * @param {number} freq1 - Lower string frequency
   * @param {number} freq2 - Higher string frequency
   * @param {number} duration - Duration in seconds
   * @param {object} options - {volume, bowType}
   */
  playDoubleStop(freq1, freq2, duration = 1.0, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const { volume = 0.25, bowType = 'legato' } = options;
    
    const attackMap = { legato: 0.03, spiccato: 0.01, martelé: 0.005 };
    const releaseMap = { legato: 0.15, spiccato: 0.05, martelé: 0.1 };
    
    const attack = attackMap[bowType] || 0.03;
    const release = releaseMap[bowType] || 0.15;
    
    this.playTone(freq1, duration, { 
      volume, 
      waveform: 'sawtooth',
      attack,
      release,
      vibrato: true
    });
    
    this.playTone(freq2, duration, { 
      volume, 
      waveform: 'sawtooth',
      attack,
      release,
      vibrato: true
    });
  }

  // ============================================================
  // FEEDBACK & UI SOUNDS - ML-Adaptive
  // ============================================================

  /**
   * Play adaptive feedback sound (correct/incorrect with context)
   * @param {boolean} isCorrect - Was the answer correct?
   * @param {object} context - {streak, module, difficulty}
   */
  playFeedback(isCorrect, context = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const { streak = 0, module = 'general', difficulty = 1 } = context;
    
    this.stats.feedbackSounds++;
    
    // Track feedback for pedagogical insights
    this.feedbackHistory.push({
      isCorrect,
      timestamp: Date.now(),
      streak,
      module,
      difficulty
    });
    
    if (isCorrect) {
      // Adaptive positive feedback based on streak
      if (streak >= 5) {
        // Extended success for milestone
        this.playArpeggio([523.25, 659.25, 783.99, 987.77], 0.15); // C5-E5-G5-B5
      } else {
        // Standard positive
        this.playArpeggio([523.25, 659.25, 783.99], 0.12);
      }
    } else {
      // Gentle negative feedback (not punitive)
      this.playArpeggio([440, 392], 0.25);  // A4-G4 descending
    }
  }

  /**
   * Play success sound (module complete, achievement)
   * @param {object} context - {achievement, level, xpGain}
   */
  playSuccess(context = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const { achievement = false, level = 1, xpGain = 0 } = context;
    
    if (achievement) {
      // Extended success with harmonic resonance
      setTimeout(() => this.playChord([261.63, 329.63, 392.00], 0.5), 0);
      setTimeout(() => this.playChord([293.66, 369.99, 440.00], 0.5), 400);
      setTimeout(() => this.playChord([329.63, 415.30, 493.88, 587.33], 1.0), 800);
    } else {
      // Standard success
      setTimeout(() => this.playChord([261.63, 329.63, 392.00], 0.5), 0);
      setTimeout(() => this.playChord([293.66, 369.99, 440.00], 0.5), 400);
      setTimeout(() => this.playChord([329.63, 415.30, 493.88], 1.0), 800);
    }
  }

  /**
   * Play achievement unlock sound with flourish
   */
  playAchievement() {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Sparkly ascending arpeggio + octave leap
    const frequencies = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.25, { 
          volume: 0.2, 
          waveform: 'sine',
          vibrato: false
        });
      }, i * 70);
    });
  }

  /**
   * Play level up fanfare with harmonic progression
   * @param {number} level - New level reached
   */
  playLevelUp(level = 1) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Ascending scale flourish with extended range for higher levels
    const baseScale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    const extendedScale = level > 5 ? [...baseScale, 587.33, 659.25, 783.99] : baseScale;
    
    extendedScale.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.15, { 
          volume: 0.2,
          vibrato: i > baseScale.length
        });
      }, i * 60);
    });
  }

  /**
   * Play spaced repetition reminder (gentle cue)
   */
  playSpacedRepetitionReminder() {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Two-note gentle reminder
    this.playTone(440, 0.3, { volume: 0.15, vibrato: false });
    setTimeout(() => {
      this.playTone(494, 0.3, { volume: 0.15, vibrato: false });
    }, 350);
  }

  // ============================================================
  // CONTROL METHODS - Enhanced
  // ============================================================

  /**
   * Set master volume
   * @param {number} volume - 0.0 to 1.0
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        this.volume, 
        this.audioContext?.currentTime || 0
      );
    }
  }

  /**
   * Toggle mute
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopAll();
    }
    return this.muted;
  }

  /**
   * Set mute state
   * @param {boolean} muted - Mute on/off
   */
  setMuted(muted) {
    this.muted = muted;
    if (this.muted) {
      this.stopAll();
    }
  }

  /**
   * Toggle violin timbre
   * @returns {boolean} New timbre state
   */
  toggleViolinTimbre() {
    this.settings.violinTimbre = !this.settings.violinTimbre;
    return this.settings.violinTimbre;
  }

  /**
   * Set vibrato parameters
   * @param {number} speed - Hz frequency (4-7 typical)
   * @param {number} depth - ±Hz variation (2-5 typical)
   */
  setVibrato(speed = 5, depth = 3) {
    this.settings.vibratoSpeed = Math.max(3, Math.min(8, speed));
    this.settings.vibratoDepth = Math.max(1, Math.min(6, depth));
  }

  /**
   * Stop all active sounds immediately
   */
  stopAll() {
    // Stop all oscillators
    this.activeOscillators.forEach(({ oscillator, gainNode, vibratoOsc }) => {
      try {
        if (gainNode) gainNode.gain.setValueAtTime(0, this.audioContext?.currentTime || 0);
        if (oscillator) oscillator.stop();
        if (oscillator) oscillator.disconnect();
        if (gainNode) gainNode.disconnect();
        if (vibratoOsc) vibratoOsc.disconnect();
      } catch (e) {}
    });
    this.activeOscillators.clear();
    
    // Stop all drones
    this.activeDrones.forEach(({ oscillator, gainNode, filter, harmonics }) => {
      try {
        if (gainNode) gainNode.gain.setValueAtTime(0, this.audioContext?.currentTime || 0);
        if (oscillator) oscillator.stop();
        if (oscillator) oscillator.disconnect();
        if (gainNode) gainNode.disconnect();
        if (filter) filter.disconnect();
        if (harmonics) harmonics.forEach(h => {
          try {
            h.oscillator.stop();
            h.oscillator.disconnect();
            h.gain.disconnect();
          } catch (e) {}
        });
      } catch (e) {}
    });
    this.activeDrones.clear();
    
    // Stop metronome
    if (this.activeMetronome) {
      this.activeMetronome.stop();
      this.activeMetronome = null;
    }
    
    this.stats.activeVoices = 0;
  }

  /**
   * Get performance stats
   * @returns {object} Stats object
   */
  getStats() {
    return {
      ...this.stats,
      sessionDuration: (Date.now() - this.stats.sessionStartTime) / 1000,
      feedbackHistoryLength: this.feedbackHistory.length,
      lastNote: this.lastPlayedNote
    };
  }

  /**
   * Clean up all resources
   */
  destroy() {
    this.stopAll();
    if (this.audioContext) {
      this.audioContext.close().catch(err => {
        console.warn('[AudioEngine] Close failed:', err);
      });
      this.audioContext = null;
    }
    this.initialized = false;
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const audioEngine = new AudioEngine();

// ============================================================
// AUTO-INITIALIZATION (iOS Safari requires user gesture)
// ============================================================

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const initOnInteraction = () => {
    if (!audioEngine.initialized) {
      audioEngine.init().catch(err => {
        console.warn('[AudioEngine] Auto-init failed:', err);
      });
    }
  };
  
  // Listen for first user interaction
  ['click', 'touchstart', 'keydown'].forEach(eventType => {
    document.addEventListener(eventType, initOnInteraction, { 
      once: true, 
      passive: true 
    });
  });
}

// ======================================
// UTILITY: Convert MIDI to Frequency
// ======================================

/**
 * Convert MIDI note number to frequency
 * @param {number} midiNote - MIDI note (0-127, middle C = 60)
 * @returns {number} Frequency in Hz
 */
export function midiToFreq(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Get frequency for a note name
 * @param {string} noteName - e.g., 'C4', 'A4', 'F#5'
 * @returns {number} Frequency in Hz
 */
export function noteToFreq(noteName) {
  const noteMap = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  
  const match = noteName.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) return 440; // Default to A4
  
  const [, note, octave] = match;
  const semitone = noteMap[note];
  const midiNote = (parseInt(octave) + 1) * 12 + semitone;
  
  return midiToFreq(midiNote);
}

/**
 * Get frequency for a note from MIDI number with rounding
 * @param {number} midi - MIDI note (0-127)
 * @returns {object} { note, octave, frequency, cents }
 */
export function midiToNote(midi) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  const frequency = midiToFreq(midi);
  
  return { note, octave, frequency, midi };
}
