import React, { useState } from 'react';

// Import all components and labs
import Dashboard from './components/Dashboard.js';
import Intervals from './components/Intervals.js';
import KeySignatures from './components/KeySignatures.js';
import Rhythm from './components/Rhythm.js';
import BielerVocab from './components/BielerVocab.js';
import Fingerboard from './components/Fingerboard.js';
import Flashcards from './components/Flashcards.js';
import PracticePlanner from './components/PracticePlanner.js';
import Analytics from './components/Analytics.js';
import Settings from './components/Settings.js';
import TechniqueLab from './labs/TechniqueLab.js';
import ScaleHarmonyLab from './labs/ScaleHarmonyLab.js';
import { incrementStreak } from './engines/gamification.js';

/**
 * Main application router
 *
 * Manages which module is currently active. The dashboard lists all available
 * modes. Each mode component receives an onReturn callback that switches the
 * view back to the dashboard. On returning, the daily practice streak is
 * incremented.
 */
export default function App() {
  const [mode, setMode] = useState('dashboard');

  /**
   * Called when a module finishes and the user returns to the dashboard. This
   * updates the streak counter (once per session) and resets the mode.
   */
  function handleReturn() {
    incrementStreak();
    setMode('dashboard');
  }

  // Render the appropriate component based on current mode
  switch (mode) {
    case 'intervals':
      return <Intervals onReturn={handleReturn} />;
    case 'keys':
      return <KeySignatures onReturn={handleReturn} />;
    case 'rhythm':
      return <Rhythm onReturn={handleReturn} />;
    case 'bieler':
      return <BielerVocab onReturn={handleReturn} />;
    case 'fingerboard':
      return <Fingerboard onReturn={handleReturn} />;
    case 'flashcards':
      return <Flashcards onReturn={handleReturn} />;
    case 'technique':
      return <TechniqueLab onReturn={handleReturn} />;
    case 'scaleHarmony':
      return <ScaleHarmonyLab onReturn={handleReturn} />;
    case 'practice':
      return <PracticePlanner onReturn={handleReturn} />;
    case 'analytics':
      return <Analytics onReturn={handleReturn} />;
    case 'settings':
      return <Settings onReturn={handleReturn} />;
    default:
      return <Dashboard setMode={setMode} />;
  }
}
