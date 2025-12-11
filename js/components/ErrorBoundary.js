import React from 'react';

/**
 * Simple loading indicator used as a Suspense fallback when lazily loaded
 * modules are still being downloaded.  Accepts an optional message prop
 * allowing callers to customise the displayed text.
 */
function Loading({ message = 'Loading…' }) {
  return (
    <div className="loading-screen active">
      <div className="loading-content" style={{ textAlign: 'center' }}>
        <div
          className="loading-spinner"
          style={{
            width: 'clamp(48px, 12vw, 64px)',
            height: 'clamp(48px, 12vw, 64px)',
            margin: '0 auto var(--space-xl)'
          }}
        />
        <h2 style={{ marginBottom: 'var(--space-md)' }}>{message}</h2>
      </div>
    </div>
  );
}

export default Loading;