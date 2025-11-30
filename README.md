# Violin Mastery Quest

Adaptive violin and music theory practice app with spaced repetition.


---

## Overview

**Violin Mastery Quest (VMQ)** is a browser-based training app for serious young violinists (and their teachers/parents). It combines **evidence-informed pedagogy**, **spaced repetition**, and a **game-like interface** to make daily violin practice more focused, efficient, and measurable.

The app runs fully in the browser (desktop or mobile Safari/Chrome) and stores progress locally via `localStorage`.

---

## Core Goals of the App

These are the high-level goals the codebase is trying to accomplish so humans and AI models can audit, extend, and refactor with a clear target in mind:

1. **Train core violin “thinking skills”**
   - Intervals (aural + conceptual)
   - Key signatures and hand maps
   - Note reading and fingerboard awareness
   - Rhythm recognition and internal pulse
   - Technique vocabulary (Ida Bieler “trained functions”, bow strokes, dynamics, tempo)

2. **Use adaptive practice instead of random drilling**
   - Track per-item performance (seen, correct, lastSeen).
   - Prioritize weaker items via a simple priority-based spaced repetition engine.
   - Automatically adjust difficulty (easy/medium/hard) based on rolling accuracy.

3. **Align tightly with real violin pedagogy**
   - Reflect Ida Bieler’s “trained functions” and right/left-hand concepts.
   - Integrate Suzuki-style repertoire references and common patterns.
   - Use practical hand maps and position logic that match what teachers actually say.

4. **Make practice low-friction on phones & tablets**
   - One-screen modes with big tap targets.
   - Minimal text entry where possible.
   - Progress saved locally; no login, no backend required.

5. **Give teachers/parents simple, inspectable data**
   - Item-level stats: accuracy, attempts, priority.
   - Mode-level stats (intervals, rhythm, Bieler, key signatures, etc.).
   - Export/import progress as JSON for backup or review.

6. **Be easy to extend and audit**
   - All pedagogy content (intervals, vocab, key signatures, rhythms, fingerboard config) lives in **one central constants module**.
   - Learning engines (audio, spaced repetition, difficulty adapter) are separated from UI components.
   - Each mode is encapsulated in a single React component.

---

## Current Features

- 🎵 **Interval Trainer**
  - Melodic intervals with audio playback via Web Audio API.
  - Multiple-choice answers, adaptive difficulty, and spaced repetition.

- 📝 **Note Reading Flashcards**
  - Note name recognition with flexible input (e.g. `F#`, `F sharp`, `F♯`).
  - Spaced repetition tracking per note.

- 🎻 **Bieler Technique Vocabulary**
  - Definitions for bow strokes, trained functions, tempo and dynamics.
  - Fuzzy-matching so partial but conceptually correct answers can be accepted.

- 🥁 **Rhythm Trainer**
  - Notation-style patterns (quarters, eighths, dotted rhythms, sixteenths, triplets).
  - Audio click playback and BPM slider per difficulty level.

- 🎼 **Key Signatures & Hand Maps**
  - Level-1 keys (C, G, D, A, F, B♭).
  - Questions on major key, relative minor, and 2nd-finger hand shapes (high2 / low2 by string).

- 🎯 **Fingerboard Visualizer**
  - SVG ebony fingerboard mockup for positions 1–10 (simplified model).
  - Tap circles per string/finger to see note names.

- ⚙️ **Settings**
  - Difficulty per mode (easy / medium / hard).
  - Dark mode, high contrast, large fonts, compact layout.
  - Global mute, progress reset, JSON export of all stats.

---

## Pedagogical Foundations

- **Ida Bieler Method / “Trained Functions”**
  - First–fourth functions for left hand, plus bow-stroke hierarchy
  - Implemented via `BIELER_VOCAB` and related logic.

- **Suzuki & standard violin repertoire**
  - Rhythm and key-signature choices mirror Suzuki Book 1–4 patterns and common orchestra parts.

- **Spaced repetition & retrieval practice**
  - Lightweight SR engine that:
    - Stores per-item performance,
    - Calculates a priority score,
    - Selects the next question from the highest-priority items.

---

## Tech Stack

- **Frontend:** React (CDN, no build step)
- **Language:** Vanilla ES modules (`import`/`export`)
- **Audio:** Web Audio API (interval playback, rhythm clicks, feedback sounds)
- **Storage:** `localStorage` with runtime fallback when unavailable (e.g., Safari private mode)
- **UI:** Responsive, mobile-first CSS (no external framework) with support for dark mode & accessibility tweaks

---

## Getting Started (Desktop & iOS)

### Quick Run (Desktop)

1. Clone or download the repository:
   ```bash
   git clone https://github.com/<your-username>/violin-mastery-quest.git
   cd violin-mastery-quest