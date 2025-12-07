// ======================================
// VMQ AUDIO ENGINE - Web Audio API for Violin Training
// Optimized for educational use with violin-specific features
// ======================================

/**
 * AudioEngine - Complete Web Audio implementation for VMQ
 * Handles all sound generation: notes, intervals, feedback, metronome
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
    
    // Audio settings
    this.settings = {
      violinTimbre: true,      // Use violin-like waveform
      reverbEnabled: false,    // Future: convolution reverb
      masterVolume: 0.5
    };
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
      console.log('[AudioEngine] Initialized successfully');
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
      this.audioContext.resume();
    }
  }

  // ============================================================
  // CORE TONE GENERATION
  // ============================================================

  /**
   * Play a single tone with ADSR envelope
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {object} options - {waveform, volume, attack, decay, sustain, release}
   * @returns {OscillatorNode} The created oscillator
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
      release = 0.1
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
    if (this.settings.violinTimbre && waveform === 'sawtooth') {
      const vibrato = this.audioContext.createOscillator();
      const vibratoGain = this.audioContext.createGain();
      
      vibrato.frequency.value = 5; // 5Hz vibrato
      vibratoGain.gain.value = 3;  // ±3Hz variation
      
      vibrato.connect(vibratoGain);
      vibratoGain.connect(oscillator.frequency);
      
      vibrato.start(now);
      vibrato.stop(now + duration);
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
    this.activeOscillators.set(id, { oscillator, gainNode });
    
    // Auto-cleanup
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
      this.activeOscillators.delete(id);
    };
    
    return oscillator;
  }

  /**
   * Play interval (two notes)
   * @param {number} freq1 - First note frequency
   * @param {number} freq2 - Second note frequency
   * @param {boolean} harmonic - Play together (true) or melodic (false)
   * @param {number} duration - Total duration in seconds
   */
  playInterval(freq1, freq2, harmonic = false, duration = 1.0) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    if (harmonic) {
      // Harmonic interval - both notes together
      this.playTone(freq1, duration, { volume: 0.25 });
      this.playTone(freq2, duration, { volume: 0.25 });
    } else {
      // Melodic interval - sequential
      const noteDuration = duration * 0.5;
      this.playTone(freq1, noteDuration, { volume: 0.3 });
      setTimeout(() => {
        this.playTone(freq2, noteDuration, { volume: 0.3 });
      }, noteDuration * 1000);
    }
  }

  /**
   * Play chord (multiple notes simultaneously)
   * @param {Array<number>} frequencies - Array of frequencies
   * @param {number} duration - Duration in seconds
   */
  playChord(frequencies, duration = 1.0) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Reduce volume per note to prevent clipping
    const volumePerNote = Math.min(0.3, 0.6 / frequencies.length);
    
    frequencies.forEach((freq, index) => {
      // Slight stagger for more natural sound
      setTimeout(() => {
        this.playTone(freq, duration, { volume: volumePerNote });
      }, index * 10);
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
        this.playTone(freq, noteDuration, { volume: 0.3 });
      }, index * noteGap * 1000);
    });
  }

  /**
   * Play scale (ascending or descending)
   * @param {Array<number>} frequencies - Scale frequencies
   * @param {number} tempo - Notes per second
   * @param {boolean} ascending - Direction
   */
  playScale(frequencies, tempo = 2.5, ascending = true) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const notes = ascending ? frequencies : [...frequencies].reverse();
    const noteGap = 1 / tempo; // Convert tempo to gap
    const noteDuration = noteGap * 0.9;
    
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, noteDuration, { 
          volume: 0.25,
          waveform: 'sawtooth' 
        });
      }, index * noteGap * 1000);
    });
  }

  // ============================================================
  // METRONOME & RHYTHM
  // ============================================================

  /**
   * Play metronome tick
   * @param {boolean} isDownbeat - First beat of measure
   * @param {number} volume - Volume level
   */
  playMetronomeTick(isDownbeat = false, volume = 0.4) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = isDownbeat ? 'square' : 'sine';
    oscillator.frequency.value = isDownbeat ? 1200 : 800;
    
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
   * @returns {Object} Controller with stop() method
   */
  startMetronome(bpm, beatsPerMeasure = 4, onBeat = null) {
    if (!this.initialized || this.muted) return null;
    this.resume();
    
    const interval = (60 / bpm) * 1000; // ms per beat
    let currentBeat = 0;
    let running = true;
    
    const tick = () => {
      if (!running) return;
      
      const isDownbeat = currentBeat % beatsPerMeasure === 0;
      this.playMetronomeTick(isDownbeat);
      
      if (onBeat) onBeat(currentBeat);
      currentBeat++;
      
      if (running) {
        setTimeout(tick, interval);
      }
    };
    
    tick();
    
    return {
      stop: () => { running = false; }
    };
  }

  // ============================================================
  // VIOLIN-SPECIFIC FEATURES
  // ============================================================

  /**
   * Play open string drone (violin tuning: G3, D4, A4, E5)
   * @param {string} string - 'G', 'D', 'A', or 'E'
   * @param {number} volume - Volume level
   * @returns {Object} Controller with stop() method
   */
  playOpenStringDrone(string = 'A', volume = 0.08) {
    if (!this.initialized || this.muted) return null;
    this.resume();
    
    // Violin open string frequencies
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
    gainNode.gain.linearRampToValueAtTime(volume, now + 2);
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.compressor);
    
    oscillator.start(now);
    
    const id = string + '_drone';
    this.activeDrones.set(id, { oscillator, gainNode, filter });
    
    return {
      stop: () => {
        const fadeTime = this.audioContext.currentTime;
        gainNode.gain.linearRampToValueAtTime(0, fadeTime + 1.5);
        setTimeout(() => {
          oscillator.stop();
          oscillator.disconnect();
          gainNode.disconnect();
          filter.disconnect();
          this.activeDrones.delete(id);
        }, 1500);
      }
    };
  }

  /**
   * Play double stop (two notes on violin)
   * @param {number} freq1 - Lower string frequency
   * @param {number} freq2 - Higher string frequency
   * @param {number} duration - Duration in seconds
   */
  playDoubleStop(freq1, freq2, duration = 1.0) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Play both with violin timbre
    this.playTone(freq1, duration, { 
      volume: 0.25, 
      waveform: 'sawtooth',
      attack: 0.03,
      release: 0.15
    });
    
    this.playTone(freq2, duration, { 
      volume: 0.25, 
      waveform: 'sawtooth',
      attack: 0.03,
      release: 0.15
    });
  }

  // ============================================================
  // FEEDBACK & UI SOUNDS
  // ============================================================

  /**
   * Play feedback sound (correct/incorrect answer)
   * @param {boolean} isCorrect - Was the answer correct?
   */
  playFeedback(isCorrect) {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    if (isCorrect) {
      // Pleasant ascending major triad
      this.playArpeggio([523.25, 659.25, 783.99], 0.12); // C5-E5-G5
    } else {
      // Gentle descending minor third
      this.playArpeggio([440, 392], 0.2); // A4-G4
    }
  }

  /**
   * Play success sound (module complete, achievement)
   */
  playSuccess() {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Triumphant chord progression
    setTimeout(() => this.playChord([261.63, 329.63, 392.00], 0.5), 0);    // C Major
    setTimeout(() => this.playChord([293.66, 369.99, 440.00], 0.5), 400);  // D Major
    setTimeout(() => this.playChord([329.63, 415.30, 493.88], 1.0), 800);  // E Major
  }

  /**
   * Play achievement unlock sound
   */
  playAchievement() {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Sparkly ascending arpeggio
    const frequencies = [523.25, 587.33, 659.25, 783.99, 880.00];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.25, { volume: 0.2, waveform: 'sine' });
      }, i * 70);
    });
  }

  /**
   * Play level up fanfare
   */
  playLevelUp() {
    if (!this.initialized || this.muted) return;
    this.resume();
    
    // Ascending scale flourish
    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    scale.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.15, { volume: 0.2 });
      }, i * 60);
    });
  }

  // ============================================================
  // CONTROL METHODS
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
        this.audioContext.currentTime
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
   * Stop all active sounds immediately
   */
  stopAll() {
    // Stop all oscillators
    this.activeOscillators.forEach(({ oscillator, gainNode }) => {
      try {
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeOscillators.clear();
    
    // Stop all drones
    this.activeDrones.forEach(({ oscillator, gainNode, filter }) => {
      try {
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
        if (filter) filter.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeDrones.clear();
  }

  /**
   * Clean up all resources
   */
  destroy() {
    this.stopAll();
    if (this.audioContext) {
      this.audioContext.close();
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
