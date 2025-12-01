# 🎻 Violin Mastery Quest

**Adaptive violin and music theory practice app with spaced repetition for serious young violinists.**

**[🚀 Try Live Demo](https://tstrembu.github.io/violin-mastery-quest/)** | [Report Bug](https://github.com/tstrembu/violin-mastery-quest/issues) | [Request Feature](https://github.com/tstrembu/violin-mastery-quest/issues) | [View Documentation](#overview)

---

## Overview

Violin Mastery Quest (VMQ) is a browser-based training app for **serious young violinists** (and their teachers/parents). It combines evidence-informed pedagogy, spaced repetition, and a game-like interface to make daily violin practice more focused, efficient, and measurable.

The app runs fully in the browser (desktop or mobile Safari/Chrome) and stores progress locally via `localStorage`—**no account, no tracking, no backend required**. It is optimized for **iPhone/iPad Safari** and works especially well when added to the home screen as a pseudo-native app.

**Who it’s for:**

- 🎻 Serious young violinists who like to understand music theory and the foundations of the Ida Bieler Method
- 👩‍🏫 Teachers who want structured, violin-specific drills between lessons
- 👨‍👩‍👧‍👦 Parents supporting practice and their student's learning
- 🎼 Self-motivated students who like stats, streaks, and clear goals

---

## 🎯 Why This Exists

Most violin apps are:
- ❌ Generic music theory trainers (not violin-specific)
- ❌ Random drill generators (no spaced repetition)
- ❌ Desktop-only (not optimized for practice room use on tablets/phones)

**VMQ is different:**
- ✅ Built for violin students following or preparing to follow the Ida Bieler Method
- ✅ Uses proven spaced repetition to maximize retention
- ✅ Runs entirely in the browser (no app store, no login) 

---

## Core Goals

These are the high-level goals the codebase is designed to accomplish, so humans and AI models can audit, extend, and refactor with a clear target in mind:

### 1. **Train Core Violin "Thinking Skills"**

- Intervals (aural + conceptual)
- Key signatures and hand maps
- Note reading and fingerboard awareness
- Rhythm recognition and internal pulse
- Technique vocabulary (Ida Bieler "trained functions", bow strokes, dynamics, tempo)

### 2. **Use Adaptive Practice (Not Random Drilling)**

- Track per-item performance (`seen`, `correct`, `lastSeen`)
- Prioritize weaker items via a simple priority-based spaced repetition engine
- Automatically adjust difficulty (easy/medium/hard) based on rolling accuracy
- Keep the logic intentionally transparent and debuggable (no black-box ML)

### 3. **Align Tightly with Real Violin Pedagogy**

- Reflect Ida Bieler's "trained functions" and right/left-hand concepts
- Integrate Suzuki-style repertoire references and common patterns
- Use practical hand maps and position logic that match what teachers actually say

### 4. **Make Practice Low-Friction on Phones & Tablets**

- One-screen modes with big tap targets
- Minimal text entry where possible
- Progress saved locally; no login, no backend required
- Works well on **iPhone 14 Pro Max** and similar devices in portrait mode

### 5. **Give Teachers/Parents Simple, Inspectable Data**

- Item-level stats: accuracy, attempts, priority
- Mode-level stats (intervals, rhythm, Bieler, key signatures, etc.)
- Export/import progress as JSON for backup or review

### 6. **Be Easy to Extend and Audit**

- All pedagogy content (intervals, vocab, key signatures, rhythms, fingerboard config) lives in one central constants module
- Learning engines (audio, spaced repetition, difficulty adapter) are separated from UI components
- Each mode is encapsulated in a single React component
- Clear enough that AI tools (and humans!) can reason about and safely modify it

---

## ✨ Current Features

### 🎵 **Interval Trainer**

Melodic intervals with audio playback via Web Audio API. Multiple-choice answers, adaptive difficulty, and spaced repetition.

**Pedagogy:** Develops relative pitch and intervallic thinking crucial for intonation.

### 📝 **Note Reading Flashcards**

Note name recognition with flexible input (e.g., `F#`, `F sharp`, `F♯`). Spaced repetition tracking per note.

**Pedagogy:** Builds instant note recognition for sight-reading and position work.

### 🎻 **Bieler Technique Vocabulary**

Definitions for bow strokes, trained functions, tempo, and dynamics. Fuzzy-matching so partial but conceptually correct answers are accepted.

**Pedagogy:** Reinforces the language teachers use in lessons (`détaché`, `martelé`, `collé`, `spiccato`, trained functions).

### 🥁 **Rhythm Trainer**

Notation-style patterns (quarters, eighths, dotted rhythms, sixteenths, triplets). Audio click playback and BPM slider per difficulty level.

**Pedagogy:** Develops internal pulse and rhythmic literacy from Suzuki Book 1 through advanced repertoire.

### 🎼 **Key Signatures & Hand Maps**

Level-1 keys (C, G, D, A, F, B♭) with questions on major key, relative minor, and 2nd-finger hand shapes (`high 2` / `low 2` by string).

**Pedagogy:** Uses a violin-specific, hand-map approach to key signatures rather than abstract theory alone.

### 🎯 **Fingerboard Visualizer**

SVG ebony fingerboard mockup for positions 1–10 (simplified model). Tap circles per string/finger to see note names.

**Pedagogy:** Visual reference for position work and note geography across the fingerboard.

### ⚙️ **Settings**

- Difficulty per mode (easy / medium / hard)
- Dark mode, high contrast, large fonts, compact layout
- Global mute, progress reset, JSON export of all stats

---

## 📸 Screenshots

### Main Menu
![VMQ Main Menu](https://via.placeholder.com/800x400/4a90e2/ffffff?text=Main+Menu+-+Six+Practice+Modes)  
*Six practice modes with real-time stats tracking*

### Interval Training
![Interval Mode](https://via.placeholder.com/800x400/4a90e2/ffffff?text=Interval+Training+-+Ear+Training)  
*Ear training with Web Audio API playback and adaptive difficulty*

### Dark Mode
![Dark Mode](https://via.placeholder.com/800x400/1a1a2e/ffffff?text=Dark+Mode+-+Easy+on+Eyes)  
*Easy on the eyes for evening practice sessions*

> 📝 **Note:** Replace placeholder images by uploading screenshots to a `screenshots/` folder in your repo.

---

## 🎓 Pedagogical Foundations

### Ida Bieler Method / "Trained Functions"

First–fourth functions for left hand, plus bow-stroke hierarchy. Implemented via `BIELER_VOCAB` and related logic.

**Source:** *Ida Bieler Method: Basic Violin Technique* by Lucia Kobza

### Suzuki & Standard Violin Repertoire

Rhythm and key-signature choices mirror Suzuki Books 1–4 patterns and common orchestra parts.

**Source:** *Suzuki Violin School*, Vols. 1–5

### Spaced Repetition & Retrieval Practice

Lightweight SR engine that:

- Stores per-item performance
- Calculates a priority score (higher = needs more practice)
- Selects the next question from the highest-priority items

**Research basis:** Evidence-based learning science (Ebbinghaus forgetting curve, Leitner system, retrieval practice literature).

---

## 🛠️ Tech Stack

- **Framework:** React 18 (CDN, no build tools)
- **Architecture:** ES6 Modules (native browser imports)
- **Styling:** Modular CSS (base + components + themes)
- **Audio:** Web Audio API (interval playback, rhythm clicks, feedback sounds)
- **Storage:** `localStorage` with runtime fallback for Safari Private Browsing
- **Deployment:** GitHub Pages
- **Dependencies:** Zero! No npm, no webpack, runs anywhere with a modern browser

---

## 📂 Project Structure

High-level layout:

## **📚 FILE DEPENDENCY MAP**

/violin-mastery-quest/
│
├── index.html                    ⭐ ENTRY POINT (loads everything)
├── README.md
│
├── css/
│   ├── base.css                  (loaded by index.html)
│   └── components.css            (loaded by index.html)
│
└── js/
    ├── config/
    │   ├── constants.js          (exports: INTERVALS, XP_VALUES, etc.)
    │   └── storage.js            (exports: loadJSON, saveJSON, etc.)
    │
    ├── engines/
    │   ├── audioEngine.js        (exports: playNote, playInterval)
    │   ├── spacedRepetition.js   (exports: SM-2 functions)
    │   ├── difficultyAdapter.js  (exports: Elo functions)
    │   ├── gamification.js       (exports: awardXP, updateStreak)
    │   └── analytics.js          (exports: getAccuracy, getRecommendations)
    │
    ├── utils/
    │   └── helpers.js            (exports: utility functions)
    │
    ├── components/
    │   ├── Toast.js              (exports: default Toast component)
    │   ├── MainMenu.js           (exports: default MainMenu)
    │   ├── Dashboard.js          (exports: default Dashboard)
    │   ├── Welcome.js            (exports: default Welcome)
    │   ├── Analytics.js          (exports: default Analytics)
    │   ├── PracticePlanner.js    (exports: default PracticePlanner)
    │   ├── Intervals.js          (exports: default Intervals)
    │   ├── KeySignatures.js      (exports: default KeySignatures)
    │   ├── Bieler.js             (exports: default Bieler)
    │   ├── Rhythm.js             (exports: default Rhythm)
    │   ├── Flashcards.js         (exports: default Flashcards)
    │   ├── Fingerboard.js        (exports: default Fingerboard)
    │   └── Settings.js           (exports: default Settings)
    │
    └── App.js                    ⭐ MAIN APP (imports all components, renders UI)



.
├─ index.html
├─ css/
│  ├─ base.css
│  └─ components.css
└─ js/
   ├─ config/
   │  ├─ constants.js        # Pedagogical content (intervals, keys, vocab, etc.)
   │  └─ storage.js          # Storage helpers (localStorage + runtime fallback)
   ├─ engines/
   │  ├─ audioEngine.js      # Web Audio wrapper
   │  ├─ spacedRepetition.js # Priority-based SR engine
   │  └─ difficultyAdapter.js
   ├─ utils/
   │  └─ helpers.js
   ├─ components/
   │  ├─ MainMenu.js
   │  ├─ Intervals.js
   │  ├─ Flashcards.js
   │  ├─ Bieler.js
   │  ├─ Rhythm.js
   │  ├─ KeySignatures.js
   │  ├─ Fingerboard.js
   │  ├─ Settings.js
   │  └─ Toast.js
   └─ App.js                 # Main app router

Design principle: Separation of concerns. Pedagogy lives in constants.js, learning engines are pure functions, and React components are just UI.

⸻

🚀 Getting Started

For Users (Instant Access)
	1.	Visit:
https://tstrembu.github.io/violin-mastery-quest/￼
	2.	On iPhone/iPad:
	•	Open in Safari
	•	Tap Share → Add to Home Screen
	•	Launch from the new icon like a native app
	3.	Start practicing!

For Developers (Desktop Quick Run)

Clone the repository:
git clone https://github.com/tstrembu/violin-mastery-quest.git
cd violin-mastery-quest

Serve locally (Python 3):
python3 -m http.server 8000

Open in browser:
open http://localhost:8000

No build step required! Just serve and go.

For Development

All code is vanilla ES modules. Edit any .js file and refresh your browser. No webpack, no babel, no build process.

Recommended workflow:
	1.	Edit files in your favorite editor
	2.	Refresh browser to see changes
	3.	Use browser DevTools for debugging
	4.	Test at least once on a real phone (Safari / Chrome)
	5.	Commit when ready

⸻

🌐 Browser Support
	•	✅ Safari (iOS/iPadOS 15+, macOS) – Recommended
	•	✅ Chrome (Desktop & Mobile 90+)
	•	✅ Edge (Chromium-based 90+)
	•	✅ Firefox (Desktop & Mobile 88+)

Best experience: Safari on iPhone with app added to home screen.

Known limitations:
	•	Audio requires user interaction on iOS (tap screen once after loading).
	•	localStorage may be disabled in Safari Private Browsing (app uses runtime fallback, but persistence is lost on reload).

⸻

📱 PWA Features

When added to home screen on iOS:
	•	✅ Launches in fullscreen (no browser UI)
	•	✅ Saves progress locally
	•	✅ Works offline after first load (for current assets)
	•	✅ Feels like a native app
	•	✅ Custom app icon (configurable in index.html)

Full offline-first service worker support is on the roadmap (see Roadmap￼).

⸻

🤝 Contributing

Contributions welcome! Here’s how you can help:

Content Contributions
	•	📝 Add more Bieler vocabulary terms
	•	🎵 Suggest interval exercises or listening examples
	•	🥁 Add rhythm patterns from specific repertoire
	•	🎼 Expand key signature coverage (3+ sharps/flats)
	•	🎯 Suggest new practice modes

Code Contributions
	•	🐛 Fix bugs via pull requests
	•	💡 Suggest new features via issues
	•	🎨 Improve UI/UX
	•	♿ Enhance accessibility (ARIA, screen readers)
	•	🔊 Improve audio quality or add new sounds

Pedagogical Review
	•	✅ Verify accuracy of technique definitions
	•	📚 Suggest repertoire alignments
	•	🎯 Recommend difficulty progression tweaks
	•	📖 Propose new pedagogical sources to integrate

🤖 AI-Assisted Contributions
You’re welcome to use tools like ChatGPT, Claude, or other LLMs to help draft code, tests, or explanations.

If you submit an AI-assisted pull request, please:
	•	Mention the tool/model you used in the PR description.
	•	Keep changes small and focused (one feature or fix at a time).
	•	Manually test on at least one mobile and one desktop browser.
	•	Double-check all violin pedagogy and terminology with a human teacher before proposing significant changes to content.
	•	Never include any private student data, secrets, or API keys in prompts or commits.

Before contributing code:
	1.	Open an issue to discuss your idea
	2.	Fork the repository
	3.	Create a feature branch
	4.	Test thoroughly (especially on mobile Safari)
	5.	Submit a pull request

⸻

📜 License

MIT License – see LICENSE￼file for details. 

TL;DR: You can use, modify, and distribute this app freely. Attribution appreciated but not required.

⸻

🙏 Acknowledgments
	•	Ida Bieler – For the Ida Bieler Method of learning violin: a systematic “trained functions” approach to violin technique.
	•	Open Source Community – For React, Web Audio API standards, and the modern web platform

⸻

📬 Contact & Support
	•	Live App:
https://tstrembu.github.io/violin-mastery-quest￼
	•	Issues:
GitHub Issues￼
	•	Discussions:
GitHub Discussions￼
	•	Author:
@tstrembu￼

⸻

🗺️ Roadmap

Potential future enhancements (community input welcome):
	•	Streak tracking – Visualize daily practice consistency
	•	Achievement system – Badges for mastery milestones
	•	Custom practice sets – Teachers create playlists for students
	•	Audio recording – Record and compare intonation
	•	More repertoire ties – Specific Suzuki book integration
	•	Multi-language support – Spanish, German, Japanese translations
	•	Offline-first PWA – Full service worker implementation
	•	Export to PDF – Print practice reports

Vote on features in Discussions!
https://github.com/tstrembu/violin-mastery-quest/discussions

🎻 Built for serious young violinists who wish to practice smarter, not harder.