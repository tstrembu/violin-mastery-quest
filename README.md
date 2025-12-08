# 🎻 Violin Mastery Quest (VMQ) v3.0.5

**Adaptive violin & music theory practice app with ML-powered coaching, spaced repetition, and gamification for serious young violinists.**

**[🚀 Try Live Demo](https://tstrembu.github.io/violin-mastery-quest/)** | [Report Bug](https://github.com/tstrembu/violin-mastery-quest/issues) | [Request Feature](https://github.com/tstrembu/violin-mastery-quest/discussions) | [View Documentation](#overview)

---

## 🎯 Overview

**Violin Mastery Quest** is a browser-based training app for serious young violinists, teachers, and parents. It combines:

- **Evidence-informed pedagogy** – Ida Bieler Method, Suzuki progressions, spaced repetition science
- **8 ML-powered engines** – Audio synthesis, adaptive difficulty, SM-2 spaced repetition, AI coaching, analytics, gamification, session tracking, pedagogy reasoning
- **50+ practice modules** – Intervals, keys, rhythm, fingerboard, Bieler technique, flashcards, scales, tempos, custom drills, daily planners, and more
- **Game-like interface** – Streaks, achievements, XP rewards, live progress dashboards
- **Zero backend required** – Runs entirely in the browser with local storage; no account, no tracking, no login

The app is optimized for **iPhone/iPad Safari** and works as a PWA (add to home screen for native-like experience).

**Who it's for:**
- 🎻 Serious young violinists who understand music theory and the Ida Bieler Method
- 👩‍🏫 Teachers who want violin-specific, structured drills between lessons
- 👨‍👩‍👧‍👦 Parents supporting practice goals and clear learning data
- 🎼 Self-motivated students who love stats, streaks, and measurable progress

---

## 🎓 Why This Exists

Most violin apps are:
- ❌ Generic music theory trainers (not violin-specific)
- ❌ Random drill generators (no spaced repetition or adaptation)
- ❌ Desktop-only (not optimized for practice room tablets/phones)
- ❌ Black-box algorithms (no transparency in learning logic)

**VMQ is different:**
- ✅ **Built for violin** – Ida Bieler Method taxonomy, hand maps, bow stroke vocabulary, position-aware exercises
- ✅ **Adaptive & spaced** – SM-2 algorithm, Bayesian difficulty, confusion-matrix-aware recommendations
- ✅ **Mobile-first PWA** – Fullscreen on iPhone, works offline, no login required
- ✅ **Transparent ML** – All logic is inspectable, debuggable, and tweakable; no opaque neural nets
- ✅ **50+ modules** – Far beyond basic theory; includes Bieler labs, custom drills, repertoire integration, daily planning

---

## 🎯 Core Goals

These high-level goals guide architecture, refactoring, and feature decisions so humans and AI can reason about the codebase:

### 1. **Train Violin "Thinking Skills"**

Develop skills that matter for real violin playing:
- **Intervals** (aural + conceptual) via Web Audio API
- **Key signatures & hand maps** using Bieler's hand-frame approach
- **Note reading & fingerboard awareness** via interactive visualizer
- **Rhythm recognition & internal pulse** with adaptive metronome
- **Technique vocabulary & trained functions** from the Ida Bieler Method
- **Repertoire-aware practice** (Suzuki book connections, orchestra excerpts)

### 2. **Adaptive Practice (Not Random Drilling)**

- Track per-item performance (`seen`, `correct`, `lastSeen`, `interval`, `easeFactor`)
- Prioritize weaker items via **SM-2 spaced repetition** + **Bayesian UCB difficulty selection**
- Automatically adjust difficulty (easy/medium/hard) based on rolling accuracy and time-to-respond
- **Transparent logic** – All algorithms are explicit functions, not hidden weights

### 3. **Align with Real Violin Pedagogy**

- Reflect **Ida Bieler's trained functions** (1st–4th functions for left hand, bow-stroke hierarchy for right hand)
- Use **Suzuki-style repertoire references** (books 1–5 progressions)
- Integrate **hand maps** and **position logic** that match what violin teachers actually say
- Support teachers reviewing student data (JSON export, detailed stats per module)

### 4. **Make Practice Low-Friction on Phones & Tablets**

- One-screen modes with large tap targets (min 44×44px)
- Minimal text entry; prefer multiple-choice or gesture input
- Progress saved locally; no login, no backend, no tracking
- Works in offline mode after first load
- Optimized for **iPhone 14 Pro Max** (and similar) in portrait mode

### 5. **Give Teachers/Parents Inspectable Data**

- Item-level stats: accuracy, attempts, priority, last practiced, response time
- Module-level analytics: strengths, weaknesses, consistency, mastery zones
- Session-level granularity: what, when, how long, quality metrics
- Export/import as JSON for backup, analysis, or teacher review
- **No private student data sent anywhere**

### 6. **Be Easy to Extend and Audit**

- Pedagogy content (intervals, vocab, keys, rhythms, fingerboard, Bieler taxonomy) lives in `js/config/constants.js`
- Learning engines (audio, spaced rep, difficulty, gamification, analytics, coaching) are pure functions in `js/engines/`
- React components are UI-only and live in `js/components/`
- Readable, explicit code with clear intent comments
- AI-friendly for safe refactoring and feature additions

---

## ✨ Current Features (v3.1)

### 🎵 **Core Music Theory Modules**

| Module | What | Pedagogy |
|--------|------|----------|
| **Intervals** | Melodic + harmonic intervals with Web Audio | Develops relative pitch and intervallic thinking |
| **Interval Ear Tester** | 20-question sprint with feedback | Real-time auditory discrimination |
| **Interval Sprint** | Timed race mode, difficulty adapts | Speed + accuracy trade-off training |
| **Keys** | Major/minor signatures, hand maps by string | Bieler hand-frame approach to key understanding |
| **Key Tester** | Rapid recognition drills | Automatic difficulty progression |
| **Flashcards** | SM-2 spaced repetition for note names, positions | Proven retrieval practice science |
| **Spaced Repetition Engine** | Adaptive scheduling + confusion matrix | Optimizes review intervals per item |

### 🎻 **Violin Technique & Fingerboard**

| Module | What | Pedagogy |
|--------|------|----------|
| **Bieler Technique Vocab** | 40+ terms: trained functions, bowing, tempo, dynamics | Language of professional violin pedagogy |
| **Bieler Lab** | Deep dives into each trained function | Technique progression aligned to Bieler method |
| **Fingerboard Visualizer** | Interactive SVG positions 1–5, all strings | Visual reference for position work + note geography |
| **Note Locator** | Tap-to-play: find D on A string, etc. | Active learning of fingerboard geography |
| **Scales Lab** | Major/minor/harmonic minor, all keys | Foundation for repertoire reading and intonation |
| **Scales & Arpeggios** | Playback + visual reference | Bieler-aligned scale studies |

### 🥁 **Rhythm & Tempo Training**

| Module | What | Pedagogy |
|--------|------|----------|
| **Rhythm Trainer** | Notation patterns with audio click playback | Develops internal pulse and rhythmic literacy |
| **Rhythm Drills** | Adaptive difficulty, syncopation focus | Suzuki-aligned progression |
| **Tempo Trainer** | BPM control, metronome, tap-along mode | Build independent internal tempo |
| **Speed Drill** | Accelerating tempos, rhythm patterns | Controlled technical acceleration |

### 🧠 **AI-Powered Coaching & Analytics**

| Feature | What | Integration |
|---------|------|-----------|
| **AI Coach** | 6-engine live recommendations (SM-2, difficulty, session, analytics, pedagogy, gamification) | Prioritizes weak spots, breakthrough opportunities, daily plans |
| **Daily Goals Planner** | Coach-generated or custom practice goals | Interactive task checklist with XP rewards |
| **Practice Journal** | 5-min live session summaries + AI insights | Tracks 50 modules, trend analysis, mood/focus |
| **Analytics Dashboard** | ML-enhanced performance analysis | Learning velocity, retention forecasting, breakthrough detection |
| **Achievements (75 total)** | Milestone badges, mastery unlocks, streaks | Gamified progress + long-term motivation |
| **Difficulty Adapter** | Bayesian UCB algorithm for question difficulty | Balances challenge vs. frustration (optimal learning zone) |

### 📊 **Tools & Settings**

| Tool | Purpose |
|------|---------|
| **Data Manager** | Export/import progress as JSON; cloud sync (future) |
| **Settings** | Dark mode, accessibility (large fonts, high contrast, WCAG 2.2-AAA), volume, mute, difficulty presets |
| **Practice Journal** | Live multi-engine dashboard; filter by time period |
| **Reference Library** | Searchable encyclopedia: Bieler vocab, key signatures, intervals, rhythm patterns, fingerboard positions |
| **Session Tracker** | Behind-the-scenes: logs all 50 modules, engagement metrics, focus quality |

---

## 🚀 8 ML-Powered Engines (v3.1)

VMQ runs **8 specialized engines** in parallel:

1. **Audio Engine v3.1** – Web Audio API synthesis with sawtooth/sine, vibrato, harmonics, ADSR envelopes, ML-adaptive feedback tones
2. **SM-2 Spaced Repetition v3** – Proven SuperMemo algorithm for optimal review scheduling + confusion matrix tracking
3. **Bayesian Difficulty Adapter** – UCB (Upper Confidence Bound) for intelligent challenge selection
4. **AI Coach Engine v2.1** – 7-day adaptive plans, pattern recognition, Bieler progression tracking, breakthrough detection
5. **Analytics Engine v3.0** – Learning velocity, retention forecasting, plateau detection, transfer learning analysis
6. **Gamification System v3.0** – 75 achievements, XP rewards, streaks, daily goals, level progression
7. **Session Tracker v3.0** – Real-time activity logging, focus assessment, confusion matrix building
8. **Pedagogy Engine** – 42 domain rules for Bieler method, Suzuki progressions, violin-specific logic

All engines are **feature-gated** and can be toggled via `js/config/version.js`.

---

## 📸 Screenshots

### Main Dashboard
![VMQ Dashboard](https://via.placeholder.com/800x600/1a1a2e/ffffff?text=VMQ+v3.1+Dashboard+-+50+Modules+Live)  
*Live coach, SM-2 reviews, streak tracking, XP counter*

### AI Coach Panel
![Coach](https://via.placeholder.com/800x600/4a90e2/ffffff?text=AI+Coach+-+Smart+Recommendations+from+6+Engines)  
*Priority intelligence, daily plan, adaptive recommendations*

### Interval Training with Playback
![Intervals](https://via.placeholder.com/800x600/7b68ee/ffffff?text=Interval+Training+-+Web+Audio+API)  
*Hear intervals, identify them, get instant feedback*

### Bieler Technique Vocab
![Bieler](https://via.placeholder.com/800x600/20c997/ffffff?text=Bieler+Vocabulary+-+Trained+Functions+etc)  
*Definitions with context, spaced repetition, progressive hints*

### Fingerboard Visualizer
![Fingerboard](https://via.placeholder.com/800x600/ffc107/ffffff?text=Interactive+Fingerboard+-+Positions+1-5)  
*Click-to-play positions; learn note geography*

### Dark Mode
![Dark](https://via.placeholder.com/800x600/0d1117/ffffff?text=Dark+Mode+-+Eyes-Friendly+Evening+Practice)  
*Automatic dark theme, high contrast option, WCAG 2.2-AAA accessibility*

> 📝 **Note:** Replace placeholders by uploading actual screenshots from the running app.

---

## 🎓 Pedagogical Foundations

### Ida Bieler Method
- **Trained Functions** – Structured left-hand technique progression (1st → 4th function, shifting, vibrato)
- **Bow Hierarchy** – Right-hand stroke taxonomy (détaché, martelé, spiccato, collé, ricochet, etc.)
- **Hand Frame** – Perfect 4th between fingers 1–4; extension/contraction for sharp/flat keys
- **Source:** *Ida Bieler Method: Basic Violin Technique* by Lucia Kobza

### Suzuki & Standard Repertoire
- Rhythm and key progressions mirror Suzuki Books 1–5
- Fingerboard awareness exercises aligned to common positions
- Repertoire-specific technique ("Meditation from Thaïs" vibrato, Bach excerpt double stops, etc.)

### Spaced Repetition Science
- **SM-2 Algorithm** – Optimal review scheduling based on item difficulty (EF) and repetition interval
- **Leitner System** – Priority queue for high-priority cards
- **Retrieval Practice** – Active recall improves long-term retention vs. passive review
- **Source:** *Make It Stick: The Science of Successful Learning* by Brown, Roediger, McDaniel

### Learning Psychology
- **Metacognition** – Reflection prompts help students understand their learning
- **Deliberate Practice** – Focused, feedback-rich drills beat mindless repetition
- **Variability** – Mix difficulty, modules, and contexts to improve transfer
- **Source:** *Mindset* by Carol Dweck; *Peak* by Anders Ericsson

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 (CDN, no build step) |
| **Modules** | ES6 (native browser imports) |
| **Styling** | Modular CSS (base + components + themes + animations) |
| **Audio** | Web Audio API (synthesis, feedback, playback) |
| **Storage** | localStorage + IndexedDB (hybrid, auto-fallback) |
| **Deployment** | GitHub Pages (static) |
| **Accessibility** | WCAG 2.2-AAA, keyboard nav, screen reader support |
| **PWA** | Service Worker for offline mode, cache-first strategy |
| **Dependencies** | **ZERO** – No npm, no webpack, no external libraries |

---

## 📂 Project Structure

```
violin-mastery-quest/
├── index.html                      # Entry point, React root, manifest link
├── manifest.json                   # PWA metadata
├── sw.js                           # Service Worker for offline
├── offline.html                    # Offline fallback
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── css/
│   ├── base.css                    # Variables, typography, layout
│   ├── components.css              # Module-level styles (card, form, etc.)
│   ├── themes.css                  # Light/dark/high-contrast modes
│   └── animations.css              # Transitions, keyframes
└── js/
    ├── App.js                      # Root React component, router, context
    ├── config/
    │   ├── constants.js            # All pedagogy content (intervals, keys, rhythms, Bieler vocab, etc.)
    │   ├── storage.js              # localStorage wrapper + IndexedDB fallback
    │   ├── repertoirePlans.js      # 7-day practice plans + ML-adaptive scheduling
    │   └── version.js              # v3.1 build info, feature gating
    ├── contexts/
    │   └── AppContext.js           # Global state (profile, coaches, settings)
    ├── utils/
    │   ├── helpers.js              # Utility functions (format, clamp, etc.)
    │   ├── keyboard.js             # Keyboard shortcut registry
    │   ├── router.js               # Hash-based navigation (50+ routes)
    │   └── statsVisualizer.js      # Chart generation (Chart.js future)
    ├── engines/
    │   ├── audioEngine.js          # Web Audio synthesis + vibrato + harmonics
    │   ├── spacedRepetition.js     # SM-2 algorithm + confusion matrix
    │   ├── difficultyAdapter.js    # Bayesian UCB question selection
    │   ├── gamification.js         # XP, streaks, achievements, levels
    │   ├── sessionTracker.js       # Real-time activity logging
    │   ├── analytics.js            # ML-enhanced performance analysis
    │   ├── coachEngine.js          # 6-engine AI recommendations + 7-day planning
    │   └── pedagogyEngine.js       # 42 domain rules (Bieler, Suzuki, pedagogy)
    └── components/
        ├── MainMenu.js             # Mode selection
        ├── Intervals.js            # Interval training
        ├── IntervalEarTester.js    # Ear-only mode
        ├── Bieler.js               # Technique vocabulary
        ├── BielerLab.js            # Deep technique exploration
        ├── Keys.js                 # Key signature training
        ├── Rhythm.js               # Rhythm drill
        ├── Flashcards.js           # SM-2 note-name training
        ├── Fingerboard.js          # Interactive position learner
        ├── ScalesLab.js            # Scale reference + playback
        ├── TempoTrainer.js         # Metronome + BPM trainer
        ├── SpeedDrill.js           # Accelerating tempo trainer
        ├── Dashboard.js            # Live stats + coach feed
        ├── CoachPanel.js           # AI coaching + daily planner
        ├── PracticeJournal.js      # Session history + insights
        ├── Analytics.js            # Detailed performance graphs
        ├── DailyGoals.js           # Goal planner + checklist
        ├── Achievements.js         # 75 milestones + badge progress
        ├── Settings.js             # Accessibility, difficulty, sound, theme
        ├── DataManager.js          # Export/import JSON
        ├── ReferenceLibrary.js     # Searchable knowledge base
        ├── CustomDrill.js          # Teacher-created practice sets
        ├── Toast.js                # Notification system
        └── Welcome.js              # Onboarding flow
```

**Design Principle:** Separation of concerns.
- **Pedagogy** lives in `constants.js` (easy to review and update)
- **Learning algorithms** are pure functions in `engines/` (easy to test)
- **UI components** are React-only in `components/` (easy to redesign)

---

## 🚀 Getting Started

### For Users (Instant Access)
1. **Visit:** https://tstrembu.github.io/violin-mastery-quest/
2. **On iPhone/iPad:** Tap Share → Add to Home Screen → Launch like a native app
3. **Start practicing!** Progress is saved locally.

### For Developers (Desktop Quick Run)

**Clone & serve:**
```
git clone https://github.com/tstrembu/violin-mastery-quest.git
cd violin-mastery-quest

# Python 3
python3 -m http.server 8000

# Or Node + http-server
npx http-server
```

Open `http://localhost:8000` in your browser.

**No build step required!** All code is vanilla ES modules. Just edit and refresh.

### Development Workflow
1. Edit any `.js` or `.css` file
2. Refresh the browser
3. Use DevTools to debug
4. Test on a real phone (iPhone Safari especially)
5. Commit when ready

---

## 🌐 Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| **Safari (iOS 15+)** | ✅ Excellent | Recommended; audio requires user gesture |
| **Safari (macOS)** | ✅ Excellent | Full desktop experience |
| **Chrome (Desktop & Mobile 90+)** | ✅ Full | All features work |
| **Edge (Chromium 90+)** | ✅ Full | All features work |
| **Firefox (Desktop & Mobile 88+)** | ✅ Full | All features work |

**Known Limitations:**
- **Audio on iOS:** Requires user tap to enable (Web Audio API restriction)
- **Private Browsing (Safari):** localStorage disabled; app uses memory fallback (progress lost on reload)
- **Older browsers:** No support for ES6 modules or Web Audio API

---

## 📱 PWA Features

When added to home screen on iOS:
- ✅ Launches fullscreen (no browser chrome)
- ✅ Offline access after first load
- ✅ Custom app icon
- ✅ Fast startup (cached assets)
- ✅ Feels like a native app

---

## 🤝 Contributing

We welcome contributions! Here's how:

### Content Contributions
- 📝 Add Bieler vocabulary terms with context
- 🎵 Suggest interval exercises or listening examples
- 🥁 Add rhythm patterns from specific Suzuki books or repertoire
- 🎼 Expand key signature coverage
- 🎯 Suggest practice module ideas

### Code Contributions
1. **Open an issue** to discuss your idea
2. **Fork the repo** and create a feature branch
3. **Make changes** (keep them small & focused)
4. **Test thoroughly** on at least one mobile browser
5. **Submit a pull request**

### Pedagogical Review
- ✅ Verify technique definitions accuracy
- 📚 Suggest repertoire connections
- 🎯 Recommend difficulty progression tweaks
- 📖 Propose pedagogical sources to integrate

### AI-Assisted Contributions
You're welcome to use Claude, ChatGPT, or other LLMs to help draft code. If you do:
- ✅ Mention the tool in your PR description
- ✅ Manually test thoroughly on real devices
- ✅ Have a violin teacher or experienced programmer review pedagogy changes
- ✅ Never commit student data, secrets, or API keys

---

## 📜 License

**MIT License** – See [LICENSE](LICENSE) file.

**TL;DR:** You can use, modify, and distribute VMQ freely. Attribution appreciated but not required.

---

## 🙏 Acknowledgments

- **Ida Bieler** – For the Bieler Method: a systematic, evidence-based approach to violin technique
- **Suzuki Method** – For structured, age-appropriate repertoire progression
- **Learning Science** – Spaced repetition, retrieval practice, metacognition research
- **Open Web Community** – Web Audio API, service workers, IndexedDB, accessible design standards
- **Violin Teachers Everywhere** – For feedback, domain expertise, and real-world validation

---

## 📬 Contact & Support

- **Live App:** https://tstrembu.github.io/violin-mastery-quest/
- **Issues:** [GitHub Issues](https://github.com/tstrembu/violin-mastery-quest/issues)
- **Discussions:** [GitHub Discussions](https://github.com/tstrembu/violin-mastery-quest/discussions)
- **Author:** [@tstrembu](https://github.com/tstrembu)

---

## 🗺️ Roadmap (Community Votes Welcome)

Potential v3.2+ features:
- 🎤 Audio recording + pitch analysis (compare intonation)
- 📚 More repertoire ties (specific Suzuki book + orchestra excerpt packs)
- 🌍 Multi-language support (Spanish, German, French, Japanese)
- 👥 Teacher dashboard (student cohort management, progress reports)
- ☁️ Cloud sync (optional, opt-in only; no student data tracking)
- 📈 Advanced analytics (regression trends, outlier detection, learning curves)
- 🎼 AI-generated practice playlists (based on goals, difficulty, preferences)
- 🎯 Custom practice sets from teachers (share drill packs via QR code)
- 🏆 Community challenges (optional leaderboards, friendly competition)

**Vote in [Discussions](https://github.com/tstrembu/violin-mastery-quest/discussions)!**

---

## 🎻 Built for Serious Young Violinists

*Who wish to practice smarter, not harder.*

**VMQ is not a game you "beat."** It's a practice companion that grows with you—from early Suzuki students learning hand frame and bow hold, through intermediate violinists developing vibrato and shifting, to advanced players refining spiccato and interpretation.

Every feature is designed with one goal: **help you understand violin better, remember more, and improve faster.**

Happy practicing! 🎻

---

**Last Updated:** December 2025 | **Version:** 3.1.0 | **Status:** Production
