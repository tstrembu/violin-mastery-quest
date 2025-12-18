# 🎻 Violin Mastery Quest (VMQ) v3.0.6

**Adaptive violin & music theory practice app with coaching, spaced repetition, gamification, analytics, and session tracking — built for violinists wanting to take their knowledge to the next level.**

**[🚀 Try Live Demo](https://tstrembu.github.io/violin-mastery-quest/)** ·
[Report Bug](https://github.com/tstrembu/violin-mastery-quest/issues) ·
[Request Feature](https://github.com/tstrembu/violin-mastery-quest/discussions)

---

## Table of Contents

- [🎯 Overview](#-overview)
- [🎓 Why This Exists](#-why-this-exists)
- [🎯 Core Goals](#-core-goals)
- [✨ Current Features](#-current-features)
- [🚀 Engines](#-engines)
- [📸 Screenshots](#-screenshots)
- [🎓 Pedagogical Foundations](#-pedagogical-foundations)
- [🛠️ Tech Stack](#️-tech-stack)
- [📂 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [🌐 Browser Support](#-browser-support)
- [📱 PWA Features](#-pwa-features)
- [🔒 Privacy & Data](#-privacy--data)
- [🧰 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)
- [📬 Contact & Support](#-contact--support)
- [🗺️ Roadmap](#️-roadmap-community-votes-welcome)

---

## 🎯 Overview

**Violin Mastery Quest** is a browser-based training app for violinists, teachers, and parents. It combines:

- **Evidence-informed pedagogy** – Ida Bieler Method concepts, Suzuki-friendly progressions, learning-science principles
- **Learning engines** – Web Audio synthesis, adaptive difficulty, SM-2 spaced repetition, coaching logic, analytics, gamification, session tracking
- **Many practice modules** – Intervals, keys, rhythm, fingerboard, Bieler technique vocab/labs, flashcards, scales, tempo work, custom drills, planning tools
- **Game-like interface** – Streaks, achievements, XP rewards, live progress dashboards
- **Zero backend required** – Runs entirely in the browser with local storage; no account, no login

Optimized for **iPhone/iPad Safari** and works as a **PWA** (Add to Home Screen).

**Who it’s for**
- 🎻 Violinists who want to understand theory + technique literacy without all of the pain associated with it
- 👩‍🏫 Teachers who want structured between-lesson drills and inspectable learning data
- 👨‍👩‍👧‍👦 Parents supporting practice goals with clear feedback and trends
- 🎼 Anyone who like stats, streaks, and measurable progress so they can see their knowledge grow!

---

## 🎓 Why This Exists

Most violin/music apps are:
- ❌ Generic theory trainers (not violin-specific)
- ❌ Random drill generators (no spacing/adaptation)
- ❌ Desktop-first (not practice-room-friendly)
- ❌ Black-box (hard to audit, tweak, or trust)

**VMQ is different**
- ✅ Built for violin: hand-frame thinking, position-aware drills, technique vocabulary
- ✅ Adaptive + spaced: SM-2 scheduling + difficulty selection logic
- ✅ Mobile-first PWA: fast, offline after first load, large tap targets
- ✅ Transparent logic: algorithms are explicit code you can inspect
- ✅ Designed to grow: architecture supports adding modules without breaking the core

---

## 🎯 Core Goals

These goals guide architecture, refactoring, and feature decisions.

### 1) Train violin “thinking skills”
- Intervals (aural + conceptual)
- Key signatures & hand maps
- Note reading & fingerboard geography
- Rhythm recognition & internal pulse
- Technique vocabulary aligned to real pedagogy
- Repertoire-aware practice (where applicable)

### 2) Adaptive practice (not random drilling)
- Track performance per item (seen/correct/lastSeen/interval/EF/responseTime)
- Prioritize weaker items via **SM-2** + difficulty selection logic
- Auto-adjust difficulty based on accuracy and speed
- Keep logic inspectable and debuggable

### 3) Align with real violin pedagogy
- Bieler-style vocabulary and progression concepts
- Suzuki-friendly progression assumptions for rhythm/keys (where used)
- Hand-map and position logic that matches teacher language
- Exportable learning data for review/backup

### 4) Make practice low-friction on phones/tablets
- Big tap targets (44×44px minimum)
- Minimal typing
- Local save, no login
- Offline mode after first load
- iPhone portrait-first UX (including iPhone 14 Pro Max)

### 5) Give teachers/parents inspectable data
- Item-level stats (accuracy, attempts, priority, response time)
- Module-level analytics (strengths/weaknesses/trends)
- Session-level logs (what, when, how long, quality metrics)
- Export/import JSON for backup or analysis
- No student data sent to a server by default

### 6) Be easy to extend and audit
- Content in `js/config/`
- Learning logic in `js/engines/`
- UI in `js/components/`
- Clear naming + comments + stable interfaces between layers

---

## ✨ Current Features

### 🎵 Core music theory modules
- **Intervals** (melodic + harmonic) with Web Audio playback
- **Interval Ear Tester / Sprint** modes (timed + feedback)
- **Key signature training** (major/minor) with fast drills
- **Flashcards** with **SM-2 spaced repetition**
- **Review scheduling** and stats

### 🎻 Violin technique & fingerboard
- **Bieler technique vocabulary** (terms, definitions, context)
- **Bieler Lab**-style guided exploration (where present)
- **Fingerboard visualizer / note locator** modules (interactive)
- **Scales Lab** (reference + playback where supported)

### 🥁 Rhythm & tempo training
- Rhythm drills (pattern recognition + progression)
- Tempo trainer/metronome utilities (where present)
- Speed/accuracy style drill modes (where present)

### 🧠 Coaching, analytics, and tracking
- **Session tracker** (engagement + focus + session logs)
- **Analytics dashboard** (module trends, summaries)
- **Coaching feed / recommendations** (engine-driven suggestions)
- **Gamification** (XP/streaks/achievements)

> VMQ is a fast-evolving codebase. Module availability depends on what’s currently wired into `js/App.js` routes and the active feature toggles (if configured).

---

## 🚀 Engines

VMQ runs multiple engines in parallel (implementation lives in `js/engines/`), typically including:

1. **Audio Engine** – Web Audio API synthesis/playback
2. **SM-2 Spaced Repetition** – item scheduling + review stats
3. **Difficulty Adapter** – challenge selection logic
4. **Coach Engine** – recommendations & practice planning logic
5. **Analytics Engine** – learning summaries, trends, retention hints
6. **Gamification** – XP, streaks, achievements
7. **Session Tracker** – activity/session logging + quality metrics
8. **Pedagogy Rules** – domain rules and mappings (where implemented)

If your build supports feature gating, it is typically configured via `js/config/version.js`.

---

## 📸 Screenshots

> 📝 Replace these placeholders by uploading real screenshots from the app.

### Main Dashboard
![VMQ Dashboard](https://via.placeholder.com/800x600/1a1a2e/ffffff?text=VMQ+Dashboard)

### Coach Panel
![Coach](https://via.placeholder.com/800x600/4a90e2/ffffff?text=Coach+Panel)

### Interval Training
![Intervals](https://via.placeholder.com/800x600/7b68ee/ffffff?text=Interval+Training)

### Bieler Technique Vocab
![Bieler](https://via.placeholder.com/800x600/20c997/ffffff?text=Bieler+Vocabulary)

### Fingerboard Visualizer
![Fingerboard](https://via.placeholder.com/800x600/ffc107/ffffff?text=Fingerboard+Visualizer)

### Dark Mode
![Dark Mode](https://via.placeholder.com/800x600/0d1117/ffffff?text=Dark+Mode)

---

## 🎓 Pedagogical Foundations

### Ida Bieler Method (influence)
- Technique vocabulary and structured concepts (trained functions, hand frame, bow-stroke taxonomy)
- **Reference:** *Ida Bieler Method: Basic Violin Technique* (commonly referenced in Bieler-related instruction)

### Suzuki & standard repertoire (friendly alignment)
- Rhythm/key progression ideas are designed to be compatible with common early-to-intermediate repertoire progressions
- Repertoire tie-ins can be expanded via `js/config/`

### Spaced repetition & learning science
- **SM-2** scheduling (Anki/SuperMemo-style)
- Retrieval practice and feedback loops
- **References (general):** *Make It Stick* (Brown, Roediger, McDaniel), deliberate practice literature, metacognition research

---

## 🛠️ Tech Stack

| Layer | Technology |
|------|-----------|
| UI | React 18 (CDN, no build step) |
| Modules | Native ES Modules (browser imports) |
| Styling | Modular CSS (`css/`) |
| Audio | Web Audio API |
| Storage | localStorage wrapper; optional IndexedDB fallback (if enabled in `storage.js`) |
| Deployment | GitHub Pages |
| Accessibility | Keyboard navigation + screen reader friendly patterns (aiming for WCAG-aligned UX) |
| PWA | Service Worker + manifest |

**No build tooling required.** VMQ is intentionally “edit-and-refresh” friendly.

---

## 📂 Project Structure

```text
violin-mastery-quest/
├── index.html
├── manifest.json
├── sw.js
├── offline.html
├── icons/
├── css/
│   ├── base.css
│   ├── components.css
│   ├── themes.css
│   └── animations.css
└── js/
    ├── App.js
    ├── config/
    │   ├── constants.js
    │   ├── storage.js
    │   ├── repertoirePlans.js
    │   └── version.js
    ├── contexts/
    │   └── AppContext.js
    ├── utils/
    │   ├── helpers.js
    │   ├── keyboard.js
    │   ├── router.js
    │   └── statsVisualizer.js
    ├── engines/
    │   ├── audioEngine.js
    │   ├── spacedRepetition.js
    │   ├── difficultyAdapter.js
    │   ├── gamification.js
    │   ├── sessionTracker.js
    │   ├── analytics.js
    │   ├── coachEngine.js
    │   └── pedagogyEngine.js
    └── components/
        ├── MainMenu.js
        ├── Dashboard.js
        ├── CoachPanel.js
        ├── PracticeJournal.js
        ├── Analytics.js
        ├── Settings.js
        ├── DataManager.js
        ├── Toast.js
        └── (many module components…)

Design principle
	•	Pedagogy/content → js/config/
	•	Learning logic → js/engines/
	•	UI components → js/components/

⸻

🚀 Getting Started

For Users
	1.	Visit: https://tstrembu.github.io/violin-mastery-quest/
	2.	iPhone/iPad: Share → Add to Home Screen
	3.	Practice — progress saves locally

For Developers (quick run)

git clone https://github.com/tstrembu/violin-mastery-quest.git
cd violin-mastery-quest

# Python 3
python3 -m http.server 8000

Open: http://localhost:8000

Important: ES modules require a real web server. Opening index.html via file:// will break imports.

GitHub Pages deployment
	1.	Repo → Settings → Pages
	2.	Source: Deploy from a branch
	3.	Branch: main (or master) / root
	4.	Save, then load the Pages URL

⸻

🌐 Browser Support

Browser	Support	Notes
Safari (iOS 15+)	✅  Recommended	Audio requires a user gesture
Safari (macOS)	    ✅	Great for debugging
Chrome / Edge (90+)	✅	Full ES module support
Firefox (88+)	    ✅	Full ES module support

Known limitations
	•	iOS Web Audio requires a tap/gesture to start audio
	•	Private browsing can reduce or disable persistent storage (device/browser dependent)

⸻

📱 PWA Features

When added to Home Screen:
	•	✅ Fullscreen experience (minimal browser chrome)
	•	✅ Offline after first successful load (service worker + cache)
	•	✅ App icon + quick launch
	•	✅ Fast startup (cached assets)

⸻

🔒 Privacy & Data

VMQ is designed as a local-first app.
	•	✅ Progress is stored locally in the browser (e.g., localStorage / IndexedDB fallback if enabled)
	•	✅ No account required
	•	✅ No default server-side tracking
	•	✅ Export/import available for backup (JSON)

Note: If you add analytics integrations yourself, document them here.

⸻

🧰 Troubleshooting

“Audio doesn’t play on iPhone”
	•	Tap once on the page (or press a Play button) to unlock Web Audio. iOS blocks audio until a user gesture.

“Changes aren’t showing up after deploy”
	•	Service worker caching can keep older files.
	•	Try:
	1.	Hard refresh (desktop)
	2.	On iOS: remove and re-add the Home Screen app
	3.	Bump cache/version logic if your sw.js uses a cache name/version

“ES module import errors”
	•	Make sure you’re serving via http://localhost:... (not file://)
	•	Check path casing (GitHub Pages is case-sensitive)

⸻

🤝 Contributing

Contributions are welcome.

Content contributions
	•	Bieler vocabulary + pedagogy notes
	•	Interval/rhythm/key drill expansions
	•	Repertoire tie-ins and teacher-friendly drill packs

Code contributions
	1.	Open an issue / discussion
	2.	Fork the repo and create a feature branch
	3.	Keep changes focused
	4.	Test on at least one mobile browser
	5.	Submit a PR

AI-assisted contributions

You may use ChatGPT/Claude/etc., but:
	•	Mention it in the PR description
	•	Test thoroughly on real devices
	•	Don’t commit any private student data, secrets, or keys

⸻

📜 License

MIT License — see LICENSE￼.

⸻

🙏 Acknowledgments
	•	Ida Bieler (method influence and conceptual vocabulary)
	•	Suzuki Method (repertoire-friendly progression inspiration)
	•	Learning science research community (retrieval practice, spacing, metacognition)
	•	The open web platform (Web Audio API, Service Workers, IndexedDB)

⸻

📬 Contact & Support
	•	Live App: https://tstrembu.github.io/violin-mastery-quest/
	•	Issues: https://github.com/tstrembu/violin-mastery-quest/issues
	•	Discussions: https://github.com/tstrembu/violin-mastery-quest/discussions
	•	Author: https://github.com/tstrembu

⸻

🗺️ Roadmap (Community Votes Welcome)

Potential future features:
	•	🎤 Recording + pitch analysis (intonation feedback)
	•	📚 More repertoire packs (Suzuki + orchestra excerpt tie-ins)
	•	🌍 Multi-language UI
	•	👥 Teacher dashboard / cohorts
	•	☁️ Optional cloud sync (explicit opt-in)
	•	📈 Advanced analytics (learning curves, outlier detection)
	•	🎼 Coach-generated practice playlists
	•	🎯 Shareable drill packs (export/import)
	•	🏆 Optional community challenges

Vote and discuss in GitHub Discussions.

⸻

🎻 Built for Serious Young Violinists

VMQ isn’t a game you “beat.”
It’s a practice companion that grows with you.

Last Updated: December 2025 · Version: 3.0.6 · Status: Production

