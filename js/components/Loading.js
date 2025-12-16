// Loading – Browser-safe version (no React import, no JSX)
/**
 * js/components/Loading.js
 * Simple loading indicator using native DOM methods.
 */

import { createElement } from '../utils/helpers.js'; // Assuming you implement the helper

/**
 * Simple loading indicator used as a Suspense fallback when lazily loaded
 * modules are still being downloaded.
 * * @param {object} props - Component properties
 * @param {string} props.message - The text message to display
 * @returns {HTMLElement} The loading screen DOM element
 */
export default function Loading({ message = 'Loading…' }) {
    // 1. Create the main container div
    const loadingScreen = createElement('div', 'loading-screen active');
    
    // 2. Create the content container
    const loadingContent = createElement('div', 'loading-content');
    loadingContent.style.textAlign = 'center';

    // 3. Create the spinner div
    const spinner = createElement('div', 'loading-spinner');
    spinner.style.cssText = `
        width: clamp(48px, 12vw, 64px);
        height: clamp(48px, 12vw, 64px);
        margin: 0 auto var(--space-xl);
    `;

    // 4. Create the message heading
    const messageHeading = createElement('h2');
    messageHeading.textContent = message;
    messageHeading.style.marginBottom = 'var(--space-md)';

    // 5. Assemble the elements
    loadingContent.appendChild(spinner);
    loadingContent.appendChild(messageHeading);
    loadingScreen.appendChild(loadingContent);

    return loadingScreen;
}

// NOTE: Ensure your /js/utils/helpers.js includes the createElement function:
// export function createElement(tag, className, text) { ... }

