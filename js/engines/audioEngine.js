// ========================================================
// VMQ AUDIO ENGINE - Web Audio API Wrapper
// ========================================================

import { midiToFreq } from '../config/constants.js';

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
  }

  /**
   * Ensure AudioContext is created (requires user gesture on iOS)
   */
  ensureContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioCtx;
  }

  /**
   * Resume context if suspended (iOS requirement)
   */
  async resume() {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  /**
   * Set mute state
   * @param {boolean} value - True to mute
   */
  setMute(value) {
    this.muted = value;
  }

  /**
   * Play a simple beep tone
   * @param {number} freq - Frequency in Hz
   * @param {number} duration - Duration in seconds
   */
  beep(freq, duration = 0.4) {
    if (this.muted) return;

    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Play a melodic interval (two notes in sequence)
   * @param {number} rootMidi - Root note MIDI number
   * @param {number} semitones - Interval size in semitones
   * @param {Object} options - Options object
   * @param {number} options.speedMultiplier - Speed multiplier (default 1)
   * @param {number} options.duration - Note duration in seconds
   */
  playInterval(rootMidi, semitones, options = {}) {
    if (this.muted) return;

    const { speedMultiplier = 1, duration = 0.5 } = options;
    const freq1 = midiToFreq(rootMidi);
    const freq2 = midiToFreq(rootMidi + semitones);
    const noteDuration = duration / speedMultiplier;
    const gap = noteDuration * 1.2; // 20% gap between notes

    // Play first note
    this.beep(freq1, noteDuration);

    // Play second note after gap
    setTimeout(() => {
      this.beep(freq2, noteDuration);
    }, gap * 1000);
  }

  /**
   * Play a harmonic interval (two notes simultaneously)
   * @param {number} rootMidi - Root note MIDI number
   * @param {number} semitones - Interval size in semitones
   * @param {number} duration - Duration in seconds
   */
  playHarmonic(rootMidi, semitones, duration = 1.0) {
    if (this.muted) return;

    const ctx = this.ensureContext();
    const freq1 = midiToFreq(rootMidi);
    const freq2 = midiToFreq(rootMidi + semitones);

    // Create two oscillators
    [freq1, freq2].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
    });
  }

  /**
   * Play success/failure feedback sound
   * @param {boolean} success - True for success, false for failure
   */
  playFeedback(success) {
    if (this.muted) return;

    if (success) {
      // Success: ascending major third
      this.beep(523.25, 0.15); // C5
      setTimeout(() => this.beep(659.25, 0.2), 120); // E5
    } else {
      // Failure: descending minor second
      this.beep(493.88, 0.25); // B4
      setTimeout(() => this.beep(466.16, 0.3), 180); // Bb4
    }
  }

  /**
   * Play a rhythm pattern (simplified)
   * @param {Array} pattern - Array of note durations in beats
   * @param {number} bpm - Beats per minute
   */
  playRhythm(pattern, bpm) {
    if (this.muted) return;

    const beatDuration = 60 / bpm; // seconds per beat
    let currentTime = 0;

    pattern.forEach(duration => {
      setTimeout(() => {
        this.beep(440, duration * beatDuration * 0.8); // A4, slightly shorter than beat
      }, currentTime * 1000);

      currentTime += duration * beatDuration;
    });
  }

  /**
   * Play a scale (for testing/demos)
   * @param {number} rootMidi - Starting MIDI note
   * @param {Array} intervals - Array of semitone intervals
   * @param {number} noteDuration - Duration per note in seconds
   */
  playScale(rootMidi, intervals, noteDuration = 0.3) {
    if (this.muted) return;

    let currentMidi = rootMidi;
    let currentTime = 0;

    intervals.forEach(interval => {
      setTimeout(() => {
        this.beep(midiToFreq(currentMidi), noteDuration);
      }, currentTime * 1000);

      currentMidi += interval;
      currentTime += noteDuration * 1.1;
    });
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();