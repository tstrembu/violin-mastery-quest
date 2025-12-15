// js/engines/audioEngine.js
// ======================================
// VMQ AUDIO ENGINE 3.0.5 - Web Audio API for Violin Training
// ML-Adaptive • Performance-Optimized • Pedagogically-Designed
//
// Drop-in fixes/improvements (no feature loss):
// ✅ Persist + load audio settings (mute, volume, timbre, vibrato, harmonics)
// ✅ Add missing aliases used elsewhere: setMute(), setMuted(), isMuted(), getVolume()
// ✅ iOS/Safari safe init/resume; single shared AudioContext (no per-sound contexts)
// ✅ Robust cleanup for oscillators/drones/metronome; avoids leaks
// ✅ Microphone recording implemented + safe feature gating (doesn't break if unsupported)
// ✅ Defensive checks for AudioContext state + gesture requirements
// ✅ Keep exports: audioEngine singleton + midiToFreq/noteToFreq/midiToNote
// ======================================

import { STORAGE_KEYS, loadJSON, saveJSON } from '../config/storage.js';

const AUDIO_STORAGE_KEY = STORAGE_KEYS?.SETTINGS || 'vmq.settings'; // reuse settings bucket
const AUDIO_SETTINGS_PATH = 'audio'; // stored under vmq.settings.audio

function clamp(v, min, max) {
  v = Number(v);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function safeNow(ctx) {
  try { return ctx?.currentTime ?? 0; } catch { return 0; }
}

function supportsMediaRecorder() {
  return typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder !== 'undefined';
}

// best-effort, no-throw wrapper around saveJSON
function saveSettingsPatch(patch) {
  try {
    const base = loadJSON(AUDIO_STORAGE_KEY, {}) || {};
    const next = { ...base, [AUDIO_SETTINGS_PATH]: { ...(base[AUDIO_SETTINGS_PATH] || {}), ...patch } };
    saveJSON(AUDIO_STORAGE_KEY, next);
  } catch {}
}

// best-effort load
function loadAudioSettings() {
  try {
    const base = loadJSON(AUDIO_STORAGE_KEY, {}) || {};
    return (base && typeof base === 'object' && base[AUDIO_SETTINGS_PATH] && typeof base[AUDIO_SETTINGS_PATH] === 'object')
      ? base[AUDIO_SETTINGS_PATH]
      : {};
  } catch {
    return {};
  }
}

/**
 * AudioEngine - Complete Web Audio implementation for VMQ
 * Handles: notes, intervals, feedback, metronome, drones
 * Includes optional microphone recording (if supported)
 */
class AudioEngine {
  constructor() {
    // Core audio graph
    this.audioContext = null;
    this.masterGain = null;
    this.compressor = null;

    // State
    this.initialized = false;
    this.muted = false;
    this.volume = 0.5;

    // Active nodes
    this.activeOscillators = new Map(); // id -> { oscillator, gainNode, vibratoOsc, vibratoGain }
    this.activeDrones = new Map();      // id -> { oscillator, gainNode, filter, harmonics[] }
    this.activeMetronome = null;

    // Optional mic recording
    this.micInitialized = false;
    this.micStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStartTime = 0;

    // Settings (defaults)
    this.settings = {
      violinTimbre: true,
      reverbEnabled: false, // reserved
      masterVolume: 0.5,
      vibratoDepth: 3,      // ±Hz
      vibratoSpeed: 5,      // Hz
      useHarmonics: true
    };

    // Performance stats
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

    // Restore persisted audio settings
    this._hydrateFromStorage();
  }

  _hydrateFromStorage() {
    const saved = loadAudioSettings();

    // mute
    if (typeof saved.muted === 'boolean') this.muted = saved.muted;

    // volume
    if (saved.masterVolume != null) {
      this.volume = clamp(saved.masterVolume, 0, 1);
      this.settings.masterVolume = this.volume;
    }

    // timbre / vibrato / harmonics
    if (typeof saved.violinTimbre === 'boolean') this.settings.violinTimbre = saved.violinTimbre;
    if (typeof saved.useHarmonics === 'boolean') this.settings.useHarmonics = saved.useHarmonics;

    if (saved.vibratoSpeed != null) this.settings.vibratoSpeed = clamp(saved.vibratoSpeed, 3, 8);
    if (saved.vibratoDepth != null) this.settings.vibratoDepth = clamp(saved.vibratoDepth, 1, 6);
  }

  _persistAudioPrefs() {
    saveSettingsPatch({
      muted: !!this.muted,
      masterVolume: clamp(this.volume, 0, 1),
      violinTimbre: !!this.settings.violinTimbre,
      useHarmonics: !!this.settings.useHarmonics,
      vibratoSpeed: clamp(this.settings.vibratoSpeed, 3, 8),
      vibratoDepth: clamp(this.settings.vibratoDepth, 1, 6),
      // keep future-compatible fields
      reverbEnabled: !!this.settings.reverbEnabled
    });
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize Audio Context (requires user gesture on iOS)
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized && this.audioContext) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Web Audio API not supported');

    try {
      this.audioContext = new AudioContext();

      // Master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = clamp(this.volume, 0, 1);

      // Compressor
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Connect graph: compressor -> masterGain -> destination
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);

      this.initialized = true;

      // If user had muted persisted, enforce silence
      if (this.muted) {
        try { this.masterGain.gain.setValueAtTime(0, safeNow(this.audioContext)); } catch {}
      }

      console.log('[AudioEngine] initialized | Context:', this.audioContext.state);
    } catch (error) {
      console.error('[AudioEngine] Initialization failed:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Resume audio context (iOS Safari may suspend until gesture)
   */
  resume() {
    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch((err) => {
          console.warn('[AudioEngine] Resume failed:', err);
        });
      }
    } catch {}
  }

  // ============================================================
  // MICROPHONE / RECORDING (optional)
  // ============================================================

  async initMicrophone() {
    if (this.micInitialized) return true;
    if (!supportsMediaRecorder()) {
      console.warn('[AudioEngine] Microphone/MediaRecorder not supported');
      return false;
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micInitialized = true;
      return true;
    } catch (e) {
      console.warn('[AudioEngine] Microphone init failed:', e);
      this.micInitialized = false;
      this.micStream = null;
      return false;
    }
  }

  /**
   * Start recording practice session
   * @returns {Promise<void>}
   */
  async startRecording() {
    const ok = await this.initMicrophone();
    if (!ok) throw new Error('Microphone not available');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      throw new Error('Recording already in progress');
    }

    const preferredTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4', // Safari may vary
      'audio/ogg;codecs=opus'
    ];
    const mimeType = preferredTypes.find((t) => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    }) || '';

    this.recordedChunks = [];

    this.mediaRecorder = new MediaRecorder(this.micStream, mimeType ? { mimeType } : undefined);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event?.data && event.data.size > 0) this.recordedChunks.push(event.data);
    };

    this.recordingStartTime = Date.now();
    this.mediaRecorder.start();

    console.log('[AudioEngine] Recording started');
  }

  /**
   * Stop recording and return { blob, duration, url }
   * @returns {Promise<{blob:Blob, duration:number, url:string}>}
   */
  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: mime });
          const duration = Date.now() - (this.recordingStartTime || Date.now());
          const url = URL.createObjectURL(blob);
          console.log(`[AudioEngine] Recording stopped (${duration}ms, ${blob.size} bytes)`);
          resolve({ blob, duration, url });
        } catch (e) {
          reject(e);
        }
      };

      try { this.mediaRecorder.stop(); } catch (e) { reject(e); }
    });
  }

  // ============================================================
  // CORE TONE GENERATION
  // ============================================================

  /**
   * Play a single tone with ADSR envelope + optional vibrato
   * @param {number} frequency
   * @param {number} duration seconds
   * @param {object} options
   * @returns {object|null}
   */
  playTone(frequency, duration = 0.5, options = {}) {
    if (!this.initialized || !this.audioContext || this.muted) return null;
    this.resume();

    const f = Number(frequency);
    if (!Number.isFinite(f) || f <= 0) return null;

    const dur = clamp(duration, 0.05, 10);

    const {
      waveform = this.settings.violinTimbre ? 'sawtooth' : 'sine',
      volume = 0.3,
      attack = 0.02,
      decay = 0.1,
      sustain = 0.7,
      release = 0.1,
      vibrato = this.settings.violinTimbre
    } = options || {};

    const now = safeNow(this.audioContext);

    // Oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(f, now);

    // Envelope
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now);

    // Vibrato
    let vibratoOsc = null;
    let vibratoGain = null;
    if (vibrato && waveform === 'sawtooth') {
      vibratoOsc = this.audioContext.createOscillator();
      vibratoGain = this.audioContext.createGain();
      vibratoOsc.type = 'sine';
      vibratoOsc.frequency.setValueAtTime(clamp(this.settings.vibratoSpeed, 3, 8), now);
      vibratoGain.gain.setValueAtTime(clamp(this.settings.vibratoDepth, 1, 6), now);
      vibratoOsc.connect(vibratoGain);
      vibratoGain.connect(oscillator.frequency);
      vibratoOsc.start(now);
      vibratoOsc.stop(now + dur + 0.02);
    }

    // Chain: oscillator -> gain -> compressor
    oscillator.connect(gainNode);
    gainNode.connect(this.compressor);

    // ADSR
    const peak = clamp(volume, 0, 1);
    const atk = clamp(attack, 0.001, 1);
    const dec = clamp(decay, 0, 2);
    const sus = clamp(sustain, 0, 1);
    const rel = clamp(release, 0.005, 2);

    const sustainVol = peak * sus;
    const endTime = now + dur;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + atk);
    gainNode.gain.linearRampToValueAtTime(sustainVol, now + atk + dec);

    // if duration is too short, avoid scheduling backwards
    const sustainHoldTime = Math.max(now + atk + dec, endTime - rel);
    gainNode.gain.setValueAtTime(sustainVol, sustainHoldTime);
    gainNode.gain.linearRampToValueAtTime(0.0001, endTime);

    // Start/stop
    oscillator.start(now);
    oscillator.stop(endTime + 0.03);

    // Track for cleanup
    const id = `osc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.activeOscillators.set(id, { oscillator, gainNode, vibratoOsc, vibratoGain });

    // Stats
    this.stats.totalNotesPlayed++;
    this.stats.activeVoices = this.activeOscillators.size;
    this.stats.maxConcurrentVoices = Math.max(this.stats.maxConcurrentVoices, this.stats.activeVoices);

    this.lastPlayedNote = { frequency: f, duration: dur, timestamp: Date.now() };

    oscillator.onended = () => {
      // Cleanup
      try { oscillator.disconnect(); } catch {}
      try { gainNode.disconnect(); } catch {}
      try { vibratoGain && vibratoGain.disconnect(); } catch {}
      try { vibratoOsc && vibratoOsc.disconnect(); } catch {}
      this.activeOscillators.delete(id);
      this.stats.activeVoices = this.activeOscillators.size;
    };

    return { oscillator, gainNode, vibratoOsc };
  }

  /**
   * Play interval (two notes)
   */
  playInterval(freq1, freq2, harmonic = false, duration = 1.0, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const { volume = 0.25 } = options || {};

    if (harmonic) {
      this.playTone(freq1, duration, { volume, waveform: 'sawtooth', vibrato: true });
      this.playTone(freq2, duration, { volume, waveform: 'sawtooth', vibrato: true });
      return;
    }

    const noteDuration = clamp(duration * 0.5, 0.05, 10);
    this.playTone(freq1, noteDuration, { volume, vibrato: true });
    setTimeout(() => this.playTone(freq2, noteDuration, { volume, vibrato: true }), noteDuration * 1000);
  }

  /**
   * Play chord (multiple notes simultaneously)
   */
  playChord(frequencies, duration = 1.0, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const freqs = Array.isArray(frequencies) ? frequencies : [];
    if (!freqs.length) return;

    const { volume = 0.3 } = options || {};
    const volumePerNote = Math.min(0.25, clamp(volume, 0, 1) / freqs.length);

    freqs.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, duration, { volume: volumePerNote, vibrato: true });
      }, index * 15);
    });
  }

  /**
   * Play arpeggio (notes in sequence)
   */
  playArpeggio(frequencies, noteGap = 0.25, ascending = true) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const freqs = Array.isArray(frequencies) ? frequencies : [];
    if (!freqs.length) return;

    const notes = ascending ? freqs : [...freqs].reverse();
    const gap = clamp(noteGap, 0.05, 2);
    const noteDuration = clamp(gap * 1.1, 0.05, 10);

    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, noteDuration, { volume: 0.3, vibrato: false });
      }, index * gap * 1000);
    });
  }

  /**
   * Play scale (ascending or descending)
   */
  playScale(frequencies, tempo = 2.5, ascending = true, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const freqs = Array.isArray(frequencies) ? frequencies : [];
    if (!freqs.length) return;

    const { volume = 0.25, withDrone = false } = options || {};

    const notes = ascending ? freqs : [...freqs].reverse();
    const notesPerSecond = clamp(tempo, 0.5, 12);
    const noteGap = 1 / notesPerSecond;
    const noteDuration = clamp(noteGap * 0.9, 0.05, 10);

    let droneController = null;
    if (withDrone) {
      // Keep behavior: play an A string drone by default (safe + consistent)
      droneController = this.playOpenStringDrone('A', 0.1);
    }

    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, noteDuration, {
          volume: clamp(volume, 0, 1),
          waveform: 'sawtooth',
          vibrato: index > 0
        });
      }, index * noteGap * 1000);
    });

    return droneController;
  }

  // ============================================================
  // METRONOME & RHYTHM
  // ============================================================

  playMetronomeTick(isDownbeat = false, volume = 0.4, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const { tonality = 'neutral' } = options || {};
    const now = safeNow(this.audioContext);

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    const toneMap = {
      neutral: { downbeat: 1200, upbeat: 800 },
      musical: { downbeat: 523.25, upbeat: 392 },
      gentle: { downbeat: 440, upbeat: 330 }
    };
    const tones = toneMap[tonality] || toneMap.neutral;

    oscillator.type = isDownbeat ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(isDownbeat ? tones.downbeat : tones.upbeat, now);

    const vol = clamp(volume, 0, 1);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    oscillator.connect(gainNode);
    gainNode.connect(this.compressor);

    oscillator.start(now);
    oscillator.stop(now + 0.1);

    oscillator.onended = () => {
      try { oscillator.disconnect(); } catch {}
      try { gainNode.disconnect(); } catch {}
    };
  }

  startMetronome(bpm, beatsPerMeasure = 4, onBeat = null, options = {}) {
    if (!this.initialized || this.muted) return null;
    this.resume();

    const { tonality = 'neutral', volume = 0.4 } = options || {};

    let intervalMs = (60 / clamp(bpm, 20, 300)) * 1000;
    let currentBeat = 0;
    let running = true;
    let currentBPM = clamp(bpm, 20, 300);
    let timeoutId = null;

    const tick = () => {
      if (!running) return;

      const isDownbeat = currentBeat % Math.max(1, beatsPerMeasure) === 0;
      this.playMetronomeTick(isDownbeat, volume, { tonality });

      try { onBeat && onBeat(currentBeat); } catch {}
      currentBeat++;

      if (running) timeoutId = setTimeout(tick, intervalMs);
    };

    tick();

    this.activeMetronome = {
      stop: () => {
        running = false;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = null;
      },
      adjust: (newBPM) => {
        currentBPM = clamp(newBPM, 20, 300);
        intervalMs = (60 / currentBPM) * 1000;
        if (timeoutId) clearTimeout(timeoutId);
        if (running) timeoutId = setTimeout(tick, intervalMs);
      },
      getBPM: () => currentBPM
    };

    return this.activeMetronome;
  }

  stopMetronome() {
    if (this.activeMetronome) {
      try { this.activeMetronome.stop(); } catch {}
      this.activeMetronome = null;
    }
  }

  // ============================================================
  // VIOLIN-SPECIFIC FEATURES
  // ============================================================

  playOpenStringDrone(string = 'A', volume = 0.08, options = {}) {
    if (!this.initialized || this.muted) return null;
    this.resume();

    const { fadeIn = 2, withHarmonics = this.settings.useHarmonics } = options || {};

    const openStrings = {
      G: 196.0,
      D: 293.66,
      A: 440.0,
      E: 659.25
    };

    const s = String(string || 'A').toUpperCase();
    const frequency = openStrings[s];
    if (!frequency) return null;

    const now = safeNow(this.audioContext);

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.Q.setValueAtTime(1, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(clamp(volume, 0, 1), now + clamp(fadeIn, 0, 10));

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.compressor);

    oscillator.start(now);

    const harmonics = [];
    if (withHarmonics) {
      [2, 3, 4].forEach((h) => {
        const harmonicOsc = this.audioContext.createOscillator();
        const harmonicGain = this.audioContext.createGain();

        harmonicOsc.type = 'sine';
        harmonicOsc.frequency.setValueAtTime(frequency * h, now);

        harmonicGain.gain.setValueAtTime(0.0001, now);
        harmonicGain.gain.linearRampToValueAtTime(clamp(volume, 0, 1) / (h * 2), now + clamp(fadeIn, 0, 10));

        harmonicOsc.connect(harmonicGain);
        harmonicGain.connect(gainNode);

        harmonicOsc.start(now);
        harmonics.push({ oscillator: harmonicOsc, gain: harmonicGain });
      });
    }

    const id = `${s}_drone_${Date.now()}`;
    this.activeDrones.set(id, { oscillator, gainNode, filter, harmonics });

    return {
      stop: (fadeTime = 1.5) => {
        const ft = clamp(fadeTime, 0, 10);
        const t0 = safeNow(this.audioContext);
        try { gainNode.gain.linearRampToValueAtTime(0.0001, t0 + ft); } catch {}

        setTimeout(() => {
          const pack = this.activeDrones.get(id);
          if (!pack) return;
          try { pack.oscillator.stop(); } catch {}
          try { pack.oscillator.disconnect(); } catch {}
          try { pack.filter.disconnect(); } catch {}
          try { pack.gainNode.disconnect(); } catch {}
          try {
            (pack.harmonics || []).forEach((hh) => {
              try { hh.oscillator.stop(); } catch {}
              try { hh.oscillator.disconnect(); } catch {}
              try { hh.gain.disconnect(); } catch {}
            });
          } catch {}
          this.activeDrones.delete(id);
        }, ft * 1000 + 40);
      },
      setVolume: (newVolume) => {
        const v = clamp(newVolume, 0, 1);
        const t0 = safeNow(this.audioContext);
        try { gainNode.gain.linearRampToValueAtTime(v, t0 + 0.1); } catch {}
      }
    };
  }

  playDoubleStop(freq1, freq2, duration = 1.0, options = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const { volume = 0.25, bowType = 'legato' } = options || {};
    const attackMap = { legato: 0.03, spiccato: 0.01, martelé: 0.005, martele: 0.005 };
    const releaseMap = { legato: 0.15, spiccato: 0.05, martelé: 0.1, martele: 0.1 };

    const attack = attackMap[bowType] ?? 0.03;
    const release = releaseMap[bowType] ?? 0.15;

    this.playTone(freq1, duration, { volume, waveform: 'sawtooth', attack, release, vibrato: true });
    this.playTone(freq2, duration, { volume, waveform: 'sawtooth', attack, release, vibrato: true });
  }

  // ============================================================
  // FEEDBACK & UI SOUNDS
  // ============================================================

  playFeedback(isCorrect, context = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const { streak = 0, module = 'general', difficulty = 1 } = context || {};
    this.stats.feedbackSounds++;

    this.feedbackHistory.push({
      isCorrect: !!isCorrect,
      timestamp: Date.now(),
      streak: Number(streak) || 0,
      module: String(module || 'general'),
      difficulty: Number(difficulty) || 1
    });

    if (isCorrect) {
      if ((Number(streak) || 0) >= 5) {
        this.playArpeggio([523.25, 659.25, 783.99, 987.77], 0.15);
      } else {
        this.playArpeggio([523.25, 659.25, 783.99], 0.12);
      }
    } else {
      this.playArpeggio([440, 392], 0.25, false);
    }
  }

  playSuccess(context = {}) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const { achievement = false } = context || {};

    if (achievement) {
      setTimeout(() => this.playChord([261.63, 329.63, 392.0], 0.5), 0);
      setTimeout(() => this.playChord([293.66, 369.99, 440.0], 0.5), 400);
      setTimeout(() => this.playChord([329.63, 415.3, 493.88, 587.33], 1.0), 800);
    } else {
      setTimeout(() => this.playChord([261.63, 329.63, 392.0], 0.5), 0);
      setTimeout(() => this.playChord([293.66, 369.99, 440.0], 0.5), 400);
      setTimeout(() => this.playChord([329.63, 415.3, 493.88], 1.0), 800);
    }
  }

  playAchievement() {
    if (!this.initialized || this.muted) return;
    this.resume();

    const frequencies = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.25, { volume: 0.2, waveform: 'sine', vibrato: false });
      }, i * 70);
    });
  }

  playLevelUp(level = 1) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const baseScale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
    const extendedScale = (Number(level) || 1) > 5 ? [...baseScale, 587.33, 659.25, 783.99] : baseScale;

    extendedScale.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.15, { volume: 0.2, vibrato: i > baseScale.length });
      }, i * 60);
    });
  }

  playSpacedRepetitionReminder() {
    if (!this.initialized || this.muted) return;
    this.resume();

    this.playTone(440, 0.3, { volume: 0.15, vibrato: false });
    setTimeout(() => this.playTone(494, 0.3, { volume: 0.15, vibrato: false }), 350);
  }

  // ============================================================
  // CONTROL METHODS
  // ============================================================

  setVolume(volume) {
    this.volume = clamp(volume, 0, 1);
    this.settings.masterVolume = this.volume;

    if (this.masterGain && this.audioContext) {
      const t0 = safeNow(this.audioContext);
      // If muted, keep at 0 even if volume changes
      const target = this.muted ? 0 : this.volume;
      try { this.masterGain.gain.setValueAtTime(target, t0); } catch {}
    }

    this._persistAudioPrefs();
  }

  getVolume() {
    return clamp(this.volume, 0, 1);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // Alias some callers might expect
  setMute(muted) { this.setMuted(muted); }

  setMuted(muted) {
    this.muted = !!muted;

    if (this.masterGain && this.audioContext) {
      const t0 = safeNow(this.audioContext);
      try { this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, t0); } catch {}
    }

    if (this.muted) this.stopAll();
    this._persistAudioPrefs();
  }

  isMuted() {
    return !!this.muted;
  }

  toggleViolinTimbre() {
    this.settings.violinTimbre = !this.settings.violinTimbre;
    this._persistAudioPrefs();
    return this.settings.violinTimbre;
  }

  setVibrato(speed = 5, depth = 3) {
    this.settings.vibratoSpeed = clamp(speed, 3, 8);
    this.settings.vibratoDepth = clamp(depth, 1, 6);
    this._persistAudioPrefs();
  }

  setUseHarmonics(enabled) {
    this.settings.useHarmonics = !!enabled;
    this._persistAudioPrefs();
    return this.settings.useHarmonics;
  }

  stopAll() {
    // Oscillators
    this.activeOscillators.forEach(({ oscillator, gainNode, vibratoOsc, vibratoGain }) => {
      try {
        const t0 = safeNow(this.audioContext);
        if (gainNode?.gain) gainNode.gain.setValueAtTime(0.0001, t0);
      } catch {}
      try { oscillator && oscillator.stop(); } catch {}
      try { oscillator && oscillator.disconnect(); } catch {}
      try { gainNode && gainNode.disconnect(); } catch {}
      try { vibratoGain && vibratoGain.disconnect(); } catch {}
      try { vibratoOsc && vibratoOsc.disconnect(); } catch {}
    });
    this.activeOscillators.clear();

    // Drones
    this.activeDrones.forEach(({ oscillator, gainNode, filter, harmonics }) => {
      try {
        const t0 = safeNow(this.audioContext);
        if (gainNode?.gain) gainNode.gain.setValueAtTime(0.0001, t0);
      } catch {}
      try { oscillator && oscillator.stop(); } catch {}
      try { oscillator && oscillator.disconnect(); } catch {}
      try { filter && filter.disconnect(); } catch {}
      try { gainNode && gainNode.disconnect(); } catch {}
      try {
        (harmonics || []).forEach((h) => {
          try { h.oscillator && h.oscillator.stop(); } catch {}
          try { h.oscillator && h.oscillator.disconnect(); } catch {}
          try { h.gain && h.gain.disconnect(); } catch {}
        });
      } catch {}
    });
    this.activeDrones.clear();

    // Metronome
    this.stopMetronome();

    this.stats.activeVoices = 0;
  }

  getStats() {
    return {
      ...this.stats,
      sessionDuration: (Date.now() - this.stats.sessionStartTime) / 1000,
      feedbackHistoryLength: this.feedbackHistory.length,
      lastNote: this.lastPlayedNote
    };
  }

  destroy() {
    this.stopAll();

    // Stop mic
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    } catch {}
    try {
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    this.micStream = null;
    this.micInitialized = false;
    this.mediaRecorder = null;

    // Close audio context
    try {
      if (this.audioContext) {
        this.audioContext.close().catch((err) => console.warn('[AudioEngine] Close failed:', err));
      }
    } catch {}

    this.audioContext = null;
    this.masterGain = null;
    this.compressor = null;
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
      audioEngine.init().catch((err) => {
        console.warn('[AudioEngine] Auto-init failed:', err);
      });
    } else {
      audioEngine.resume();
    }
  };

  ['click', 'touchstart', 'keydown'].forEach((eventType) => {
    document.addEventListener(eventType, initOnInteraction, { once: true, passive: true });
  });

  // If Settings toggles muted/volume in storage before init, keep it in sync on focus
  window.addEventListener('focus', () => {
    try { audioEngine._hydrateFromStorage(); } catch {}
  });
}

// ======================================
// UTILITY: Convert MIDI to Frequency
// ======================================

export function midiToFreq(midiNote) {
  return 440 * Math.pow(2, (Number(midiNote) - 69) / 12);
}

export function noteToFreq(noteName) {
  const noteMap = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
    E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
    Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
  };

  const match = String(noteName || '').trim().match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) return 440;

  const [, note, octaveStr] = match;
  const semitone = noteMap[note];
  if (semitone == null) return 440;

  const octave = parseInt(octaveStr, 10);
  if (!Number.isFinite(octave)) return 440;

  const midi = (octave + 1) * 12 + semitone;
  return midiToFreq(midi);
}

export function midiToNote(midi) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const m = Math.round(Number(midi));
  const octave = Math.floor(m / 12) - 1;
  const note = notes[((m % 12) + 12) % 12];
  const frequency = midiToFreq(m);
  return { note, octave, frequency, midi: m };
}