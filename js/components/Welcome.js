/**
 * Welcome Component
 * Onboarding flow and profile selection
 */

import { useState, useEffect } from 'react';
import { saveProfile, loadProfile } from '../config/storage.js';
import { PROFILE_TYPES } from '../config/constants.js';

export default function Welcome({ navigate, showToast }) {
  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Check if user has already completed onboarding
    const existingProfile = loadProfile();
    if (existingProfile && existingProfile !== 'intermediate') {
      // User has been here before, skip to dashboard
      navigate('dashboard');
    }
  }, []);

  const handleProfileSelect = (profileId) => {
    setSelectedProfile(profileId);
  };

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && selectedProfile) {
      // Save profile and proceed
      saveProfile(selectedProfile);
      
      // Set body theme
      document.body.setAttribute('data-profile', selectedProfile);
      
      showToast('Welcome to Violin Mastery Quest! 🎻', 'success');
      navigate('dashboard');
    }
  };

  const canContinue = step === 1 || (step === 2 && selectedProfile);

  return React.createElement('div', { className: 'welcome-container' },
    // Step 1: Introduction
    step === 1 && React.createElement('div', null,
      React.createElement('div', { style: { fontSize: '4rem', marginBottom: '20px' } }, '🎻'),
      React.createElement('h1', null, 'Welcome to Violin Mastery Quest'),
      React.createElement('p', { style: { fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '32px' } },
        'A comprehensive training companion for serious young violinists, aligned with ',
        React.createElement('strong', null, 'Professor Ida Bieler\'s method'),
        '.'
      ),
      
      React.createElement('div', {
        style: {
          textAlign: 'left',
          maxWidth: '500px',
          margin: '0 auto 32px',
          padding: '24px',
          background: '#f8f9fa',
          borderRadius: '12px'
        }
      },
        React.createElement('h3', null, 'What You\'ll Master:'),
        React.createElement('ul', { style: { lineHeight: 2 } },
          React.createElement('li', null, '🎵 Interval recognition & ear training'),
          React.createElement('li', null, '🎹 Key signature mastery'),
          React.createElement('li', null, '🥁 Rhythm pattern recognition'),
          React.createElement('li', null, '📖 Note reading fluency'),
          React.createElement('li', null, '🎻 Fingerboard navigation'),
          React.createElement('li', null, '📚 Bieler technique vocabulary'),
          React.createElement('li', null, '🎯 Evidence-based adaptive practice')
        )
      ),
      
      React.createElement('button', {
        className: 'btn-primary',
        style: { padding: '12px 32px', fontSize: '1.1rem' },
        onClick: handleContinue
      }, 'Get Started →')
    ),
    
    // Step 2: Profile Selection
    step === 2 && React.createElement('div', null,
      React.createElement('h2', null, 'Choose Your Profile'),
      React.createElement('p', { style: { marginBottom: '32px', color: '#6c757d' } },
        'This helps us customize your practice sessions and goals.'
      ),
      
      React.createElement('div', { className: 'profile-selection' },
        Object.values(PROFILE_TYPES).map(profile =>
          React.createElement('div', {
            key: profile.id,
            className: `profile-option ${selectedProfile === profile.id ? 'selected' : ''}`,
            style: {
              borderColor: selectedProfile === profile.id ? profile.color : '#ddd'
            },
            onClick: () => handleProfileSelect(profile.id)
          },
            React.createElement('h3', { style: { color: profile.color } }, profile.label),
            React.createElement('p', null, profile.description)
          )
        )
      ),
      
      React.createElement('div', {
        style: {
          display: 'flex',
          gap: '12px',
          marginTop: '32px',
          justifyContent: 'center'
        }
      },
        React.createElement('button', {
          className: 'btn-outline',
          onClick: () => setStep(1)
        }, '← Back'),
        
        React.createElement('button', {
          className: 'btn-primary',
          style: { padding: '12px 32px' },
          onClick: handleContinue,
          disabled: !canContinue
        }, 'Start Practicing →')
      )
    ),
    
    // Progress Indicator
    React.createElement('div', {
      style: {
        marginTop: '40px',
        display: 'flex',
        gap: '8px',
        justifyContent: 'center'
      }
    },
      [1, 2].map(s =>
        React.createElement('div', {
          key: s,
          style: {
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: s === step ? '#007bff' : '#dee2e6'
          }
        })
      )
    )
  );
}