/**
 * UI Controller for Voice Bot
 * Manages all DOM operations and user interface
 */

// --- 1. Utilities Polyfill (Ensures Code Works Standalone) ---
if (!window.VoiceBotUtils) {
    window.VoiceBotUtils = {
        EventUtils: {
            createEmitter: () => {
                const listeners = {};
                return {
                    on: (event, cb) => {
                        if (!listeners[event]) listeners[event] = [];
                        listeners[event].push(cb);
                    },
                    off: (event, cb) => {
                        if (!listeners[event]) return;
                        listeners[event] = listeners[event].filter(l => l !== cb);
                    },
                    emit: (event, data) => {
                        if (!listeners[event]) return;
                        listeners[event].forEach(cb => cb(data));
                    }
                };
            }
        },
        DOMUtils: {
            addCSS: (css) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            },
            createElement: (tag, attrs = {}, children = []) => {
                const el = document.createElement(tag);
                Object.entries(attrs).forEach(([k, v]) => {
                    if (k === 'className') el.className = v;
                    else if (k === 'textContent') el.textContent = v;
                    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
                    else el.setAttribute(k, v);
                });
                if (children) {
                    (Array.isArray(children) ? children : [children]).forEach(child => {
                        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
                        else if (child instanceof Node) el.appendChild(child);
                    });
                }
                return el;
            }
        },
        Utils: {
            formatTime: (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            }
        }
    };
}

// --- 2. Main Class ---

class UIController {
    constructor(options = {}) {
        this.container = null;
        this.elements = {};
        this.isVisible = true;
        this.sessionExpired = false;
        this.quotaExceeded = false;
        this.quotaExceeded = false;

        // Configuration
        this.options = {
            container: '#voice-bot-container',
            width: '100%',
            height: '400px',
            theme: 'light', // Default theme
            hideBackToAudio: false, // Hide 'Back to Audio' button
            ...options
        };

        // Event emitter
        this.events = window.VoiceBotUtils.EventUtils.createEmitter();

        // Initialize
        this.init();
    }

    init() {
        this.container = document.querySelector(this.options.container);
        if (!this.container) {
            // Auto-create container if missing for testing purposes
            console.warn(`Container ${this.options.container} not found. Creating one.`);
            this.container = document.createElement('div');
            this.container.id = this.options.container.replace('#', '');
            document.body.appendChild(this.container);
        }

        this.injectStyles();
        this.createDOM();
        this.bindEvents();
    }

    injectStyles() {
        // Always use dark space theme since we use 3D space visualizer with black background
        console.log('🎨 UI Controller: Using dark space theme (always)');

        // Single unified dark space theme - matches audio player
        const theme = {
            containerBg: '#000000',
            canvasBg: '#000000',
            textColor: '#ffffff',
            buttonColor: '#e0d0e8', // Light purple for space theme
            buttonBg: 'rgba(139, 69, 116, 0.15)', // Nebula purple tint
            buttonHoverBg: 'rgba(155, 89, 182, 0.25)', // Brighter purple on hover
            controlGroupBg: 'rgba(20, 20, 25, 0.7)', // Dark with slight purple tint + glassmorphism
            inputBg: 'rgba(25, 20, 30, 0.8)', // Dark purple-tinted
            inputBorder: 'rgba(139, 69, 116, 0.3)', // Nebula purple border
            inputColor: '#ffffff',
            connectionBg: 'rgba(20, 20, 25, 0.85)',
            overlayBg: 'rgba(10, 10, 15, 0.95)',
            restartButtonBg: '#c27ba0', // Nebula pink
            boxColor: 'rgba(139, 69, 116, 0.15)', // Purple shadow
            controlGroupBorder: 'rgba(139, 69, 116, 0.3)', // Nebula purple border
            micButtonBg: 'rgba(72, 145, 167, 0.2)', // Teal (input color)
            micButtonColor: '#7bc8dc', // Light teal
            micButtonBorder: 'rgba(72, 145, 167, 0.5)',
            sendButtonBg: 'rgba(139, 69, 116, 0.2)', // Nebula purple
            sendButtonColor: '#c27ba0',
            yesButtonBg: 'rgba(155, 89, 182, 0.2)', // Purple
            yesButtonColor: '#c27ba0',
            noButtonBg: 'rgba(239, 68, 68, 0.2)',
            noButtonColor: '#e57373'
        };

        // Dark theme is always true for space visualizer
        const isDarkTheme = true;

        const css = `
            .voice-bot-container {
                width: ${this.options.width};
                height: ${this.options.height};
                position: relative;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: ${theme.containerBg};
                border-radius: 12px;
                box-shadow: 0 4px 20px ${theme.boxColor};
                box-sizing: border-box;
            }

            .voice-bot-container * {
                box-sizing: border-box;
            }

            .voice-bot-canvas {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${theme.canvasBg};
            }

            /* --- Header --- */
            .connection-indicator {
                position: absolute;
                top: 12px;
                right: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                background: ${theme.connectionBg};
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                color: ${theme.textColor};
                z-index: 9999;
                backdrop-filter: blur(10px);
                border: 1px solid ${isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
            }

            .connection-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #ff4444;
                animation: blink 1s infinite;
            }

            .connection-dot.connected {
                background: #4CAF50;
                animation: none;
            }

            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0.3; }
            }

            .session-timer {
                font-weight: 600;
                font-variant-numeric: tabular-nums;
            }

            .session-timer.warning { color: #ff9800 !important; }
            .session-timer.critical { color: #f44336 !important; }

            .usage-remaining {
                font-weight: 600;
                font-variant-numeric: tabular-nums;
                color: #7bc8dc;
            }

            .usage-remaining.warning { color: #ff9800 !important; }
            .usage-remaining.critical { color: #f44336 !important; }

            /* Course Usage Indicator */
            .course-usage-indicator {
                position: absolute;
                top: 12px;
                left: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                background: ${theme.connectionBg};
                padding: 8px 12px;
                border-radius: 16px;
                font-size: 12px;
                color: ${theme.textColor};
                z-index: 9999;
                backdrop-filter: blur(10px);
                border: 1px solid ${isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
                max-width: min(280px, calc(100% - 24px));
            }

            .course-usage-label {
                color: rgba(255, 255, 255, 0.72);
            }

            /* Quota Exceeded Overlay */
            .quota-exceeded-overlay {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: ${theme.overlayBg};
                backdrop-filter: blur(10px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                text-align: center;
                padding: 24px;
                color: ${theme.textColor};
            }

            .quota-exceeded-card {
                max-width: 360px;
                width: 100%;
                background: rgba(20, 20, 25, 0.92);
                border: 1px solid rgba(194, 123, 160, 0.45);
                border-radius: 18px;
                padding: 24px 22px;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
            }

            .quota-exceeded-overlay h2 {
                color: #ffffff;
                margin-bottom: 10px;
                font-size: 24px;
            }

            .quota-exceeded-overlay p {
                max-width: 320px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.85);
                margin: 0;
            }

            /* --- Controls Bar --- */
            .controls-container {
                position: absolute;
                bottom: 20px;
                left: 0;
                right: 0;
                z-index: 200;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 30px;
                pointer-events: none; /* Let clicks pass through empty spaces */
            }

            .left-controls, .right-controls {
                display: flex;
                align-items: center;
                gap: 8px;
                pointer-events: auto; /* Re-enable clicks */
            }

            .control-group {
                background: ${theme.controlGroupBg};
                padding: 6px;
                border-radius: 30px;
                backdrop-filter: blur(15px);
                box-shadow: 0 4px 16px ${theme.boxColor};
                border: 1px solid ${theme.controlGroupBorder};
                display: flex;
                align-items: center;
                gap: 4px;
            }

            /* --- Buttons --- */
            .voice-bot-btn {
                outline: none;
                border: none;
                color: ${theme.buttonColor};
                border-radius: 50%;
                background: ${theme.buttonBg};
                width: 40px;
                height: 40px;
                cursor: pointer;
                padding: 0;
                margin: 0;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            .voice-bot-btn:hover:not(:disabled) {
                background: ${theme.buttonHoverBg};
                transform: scale(1.05);
            }

            .voice-bot-btn:active:not(:disabled) { transform: scale(0.95); }
            .voice-bot-btn:disabled { opacity: 0.4; cursor: not-allowed; }

            /* Ensure SVGs are visible */
            .voice-bot-btn svg {
                display: block;
                width: 20px;
                height: 20px;
                fill: currentColor;
                pointer-events: none;
            }

            /* Specific Button Styles - Mic Button with Space Theme */
            .mic-button {
                background: rgba(72, 145, 167, 0.15) !important;
                color: #7bc8dc !important;
                border: 2px solid rgba(72, 145, 167, 0.4) !important;
                transition: all 0.3s ease !important;
            }
            .mic-button:hover:not(:disabled) {
                background: rgba(72, 145, 167, 0.3) !important;
                border-color: rgba(72, 145, 167, 0.7) !important;
                transform: scale(1.05);
                box-shadow: 0 0 15px rgba(72, 145, 167, 0.4) !important;
            }
            .mic-button.active {
                background: linear-gradient(135deg, rgba(194, 123, 160, 0.8), rgba(139, 69, 116, 0.9)) !important;
                color: #ffffff !important;
                border-color: #c27ba0 !important;
                animation: micPulse 1.5s infinite;
                box-shadow: 0 0 20px rgba(194, 123, 160, 0.5), 0 0 40px rgba(139, 69, 116, 0.3) !important;
            }
            .mic-button.active:hover {
                background: linear-gradient(135deg, rgba(194, 123, 160, 0.9), rgba(155, 89, 182, 0.9)) !important;
                box-shadow: 0 0 25px rgba(194, 123, 160, 0.6), 0 0 50px rgba(139, 69, 116, 0.4) !important;
            }
            @keyframes micPulse {
                0%, 100% { 
                    box-shadow: 0 0 20px rgba(194, 123, 160, 0.5), 0 0 40px rgba(139, 69, 116, 0.3);
                    transform: scale(1);
                }
                50% { 
                    box-shadow: 0 0 30px rgba(194, 123, 160, 0.7), 0 0 60px rgba(139, 69, 116, 0.4);
                    transform: scale(1.05);
                }
            }

            .send-button {
                background: ${theme.sendButtonBg} !important;
                width: 32px !important;
                height: 32px !important;
                color: ${theme.sendButtonColor};
            }
            .send-button svg { width: 16px; height: 16px; }

            .yes-button { background: ${theme.yesButtonBg} !important; color: ${theme.yesButtonColor}; font-weight: bold; width: 32px; height: 32px; }
            .no-button { background: ${theme.noButtonBg} !important; color: ${theme.noButtonColor}; font-weight: bold; width: 32px; height: 32px; }

            /* Back to Audio Button - Nebula Glassmorphism Theme */
            .back-to-audio-btn {
                background: rgba(139, 69, 116, 0.15) !important;
                color: #c27ba0 !important;
                border: 1px solid rgba(139, 69, 116, 0.4) !important;
                border-radius: 24px !important;
                padding: 10px 20px !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                white-space: nowrap !important;
                min-width: auto !important;
                width: auto !important;
                height: auto !important;
                position: relative;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                transition: all 0.3s ease;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                box-shadow: 0 4px 12px rgba(139, 69, 116, 0.2);
            }

            .back-to-audio-btn:hover:not(:disabled) {
                background: rgba(139, 69, 116, 0.3) !important;
                border-color: rgba(155, 89, 182, 0.6) !important;
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(139, 69, 116, 0.35);
            }

            .back-to-audio-btn:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: 0 2px 8px rgba(139, 69, 116, 0.2);
            }

            .back-to-audio-btn::after {
                content: '';
                position: absolute;
                inset: -1px;
                border-radius: 25px;
                border: 1px solid transparent;
                background: linear-gradient(135deg, rgba(155, 89, 182, 0.4), rgba(72, 145, 167, 0.3), rgba(139, 69, 116, 0.4));
                background-size: 200% 200%;
                animation: shimmerBorder 3s ease-in-out infinite;
                z-index: -1;
                opacity: 0.6;
            }

            /* Dark theme support for back to audio button */
            .voice-bot-container.dark-theme .back-to-audio-btn {
                color: #d4a5c9 !important;
                background: rgba(155, 89, 182, 0.15) !important;
                border-color: rgba(155, 89, 182, 0.4) !important;
            }

            .voice-bot-container.dark-theme .back-to-audio-btn:hover:not(:disabled) {
                background: rgba(155, 89, 182, 0.3) !important;
                border-color: rgba(155, 89, 182, 0.6) !important;
            }

            /* Back to audio button pulse animation */
            .back-to-audio-btn {
                animation: gentlePulse 3s ease-in-out infinite;
            }

            @keyframes shimmerBorder {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            @keyframes gentlePulse {
                0%, 100% {
                    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
                }
                50% {
                    box-shadow: 0 0 0 8px rgba(76, 175, 80, 0);
                }
            }

            /* Enhanced focus state */
            .back-to-audio-btn:focus-visible {
                outline: 2px solid #4CAF50;
                outline-offset: 2px;
                box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
            }

            /* Desktop spacing improvements - match skip button spacing */
            @media (min-width: 601px) {
                /* Ensure consistent 8px gap between buttons on desktop */
                .voice-bot-container .control-group {
                    gap: 8px;
                }

                /* 4px specific margin between repeat and back to audio buttons on desktop */
                .voice-bot-container .repeat-button + .back-to-audio-btn {
                    margin-left: 4px;
                }

                /* 4px specific margin between back to audio and prev language buttons on desktop */
                .voice-bot-container .back-to-audio-btn + .arrow-button {
                    margin-left: 4px;
                }
            }

            .arrow-button { width: 32px !important; height: 32px !important; }

            /* --- Text Input --- */
            .text-input-container {
                display: flex;
                align-items: center;
                pointer-events: auto;
                min-width: 200px;
                flex: 1;
                margin-right: 12px;
            }

            .text-input-wrapper {
                background: ${theme.inputBg};
                border-radius: 20px;
                border: 1px solid ${theme.inputBorder};
                padding: 4px 4px 4px 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 2px 10px ${theme.boxColor};
                width: 100%;
            }

            .voice-bot-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: ${theme.inputColor};
                font-size: 14px;
                padding: 8px 0;
                resize: none;
                height: 36px;
                line-height: 20px;
            }

            .yes-no-buttons { display: flex; gap: 4px; margin-left: 4px; }

            /* === LANGUAGE DROPDOWN - HARDCODED DARK SPACE THEME === */
            .language-dropdown-container {
                position: relative;
                display: inline-block;
                z-index: 100000;
            }

            .language-dropdown-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                background: rgba(139, 69, 116, 0.2);
                color: #ffffff;
                border: 1px solid rgba(139, 69, 116, 0.5);
                border-radius: 20px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                min-width: 90px;
                justify-content: space-between;
                transition: all 0.2s ease;
            }

            .language-dropdown-btn:hover {
                background: rgba(155, 89, 182, 0.35);
                border-color: rgba(155, 89, 182, 0.7);
            }

            .language-dropdown-btn svg {
                width: 12px;
                height: 12px;
                fill: #ffffff;
                transition: transform 0.2s ease;
            }

            .language-dropdown-btn.open svg {
                transform: rotate(180deg);
            }

            .language-dropdown-menu {
                position: absolute;
                top: auto;
                bottom: -10px;  /* Shift dropdown lower */
                right: 100%;
                margin-right: 6px;
                background-color: #1a1520;
                border: 1px solid #8b4574;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
                min-width: 100px;
                max-height: 160px;  /* Reduced to fit in frame */
                overflow-y: auto;
                overflow-x: hidden;
                z-index: 100001;
                opacity: 0;
                visibility: hidden;
                transform: translateX(10px);
                transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
                /* Hide scrollbar but keep scrolling */
                scrollbar-width: thin;
                scrollbar-color: rgba(139, 69, 116, 0.5) transparent;
            }

            .language-dropdown-menu::-webkit-scrollbar {
                width: 3px;
            }

            .language-dropdown-menu::-webkit-scrollbar-track {
                background: transparent;
            }

            .language-dropdown-menu::-webkit-scrollbar-thumb {
                background: rgba(139, 69, 116, 0.4);
                border-radius: 3px;
            }

            .language-dropdown-menu.open {
                opacity: 1;
                visibility: visible;
                transform: translateX(0);
            }

            .lang-item {
                display: block;
                width: 100%;
                padding: 8px 12px;
                margin: 0;
                background-color: transparent;
                color: #ffffff;
                font-size: 12px;
                font-weight: 500;
                text-align: left;
                cursor: pointer;
                border: none;
                border-bottom: 1px solid rgba(139, 69, 116, 0.25);
                transition: background-color 0.15s;
                white-space: nowrap;
            }

            .lang-item:last-child {
                border-bottom: none;
            }

            .lang-item:hover {
                background-color: rgba(139, 69, 116, 0.4);
            }

            .lang-item.active {
                background-color: rgba(139, 69, 116, 0.5);
                font-weight: 700;
            }

            /* --- Overlays --- */
            .session-expired-overlay {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: ${theme.overlayBg};
                backdrop-filter: blur(10px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                text-align: center;
                padding: 20px;
                color: ${theme.textColor};
            }

            .restart-button {
                background: ${theme.restartButtonBg};
                color: ${isDarkTheme ? '#000000' : '#ffffff'};
                border: none;
                padding: 12px 30px; border-radius: 25px;
                font-size: 16px; font-weight: bold; cursor: pointer;
                margin-top: 20px;
            }

            .session-expired-overlay h2 {
                color: #ffffff;
                margin-bottom: 10px;
                font-size: 24px;
            }

            .session-expired-overlay p {
                max-width: 320px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.85);
                margin: 0;
            }

            .keyboard-recording-indicator {
                position: absolute; top: 50px; left: 50%;
                transform: translateX(-50%);
                background: rgba(33, 150, 243, 0.9);
                padding: 8px 16px; border-radius: 20px;
                color: white; font-size: 12px;
                z-index: 9999;
                display: none; align-items: center; gap: 8px;
            }

            @media (max-width: 600px) {
                .controls-container { padding: 0 10px; flex-direction: column-reverse; bottom: 10px; gap: 10px; }
                .left-controls, .right-controls { width: 100%; justify-content: center; }
                .text-input-container { margin: 0; }
                .language-display { display: none; } /* Hide language on very small screens if needed */

                /* Adjust back to audio button for mobile */
                .back-to-audio-btn {
                    font-size: 11px !important;
                    padding: 6px 12px !important;
                }

                .back-to-audio-btn::after {
                    animation-duration: 3s; /* Slower animation on mobile */
                }

                /* Adjust button spacing on mobile */
                .voice-bot-container .control-group {
                    gap: 6px;
                }

                .voice-bot-container .play-pause-btn + .back-to-audio-btn {
                    margin-left: 2px;
                }
            }

            @media (max-width: 480px) {
                .back-to-audio-btn {
                    font-size: 10px !important;
                    padding: 5px 10px !important;
                }

                /* Further reduce spacing on very small screens */
                .voice-bot-container .control-group {
                    gap: 4px;
                }

                .voice-bot-container .play-pause-btn + .back-to-audio-btn {
                    margin-left: 1px;
                }
            }

            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(239, 83, 80, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(239, 83, 80, 0); }
                100% { box-shadow: 0 0 0 0 rgba(239, 83, 80, 0); }
            }
        `;

        window.VoiceBotUtils.DOMUtils.addCSS(css);
    }

    createDOM() {
        const DOM = window.VoiceBotUtils.DOMUtils;
        this.container.innerHTML = '';

        // Main Wrapper
        this.elements.main = DOM.createElement('div', { className: 'voice-bot-container' });

        // Canvas
        this.elements.canvas = DOM.createElement('canvas', { className: 'voice-bot-canvas', id: 'voice-bot-canvas' });
        this.elements.main.appendChild(this.elements.canvas);

        // Connection Indicator
        this.elements.connectionIndicator = DOM.createElement('div', { className: 'connection-indicator' }, [
            DOM.createElement('div', { className: 'connection-dot', id: 'connection-dot' }),
            DOM.createElement('span', { id: 'connection-status', textContent: 'Disconnected' }),
            DOM.createElement('span', { className: 'separator', textContent: ' | ', style: { margin: '0 4px' } }),
            this.elements.sessionTimer = DOM.createElement('span', { className: 'session-timer', id: 'session-timer', textContent: '10 min' })
        ]);
        this.elements.main.appendChild(this.elements.connectionIndicator);

        // Course Usage Indicator (top-left)
        this.elements.courseUsageIndicator = DOM.createElement('div', { className: 'course-usage-indicator' });
        this.elements.courseUsageIndicator.innerHTML = `
            <span class="course-usage-label" style="color:rgba(255,255,255,0.72);">Voice bot time left:</span>
            <span class="usage-remaining" id="usage-remaining" style="color:#7bc8dc;font-weight:600;">--</span>
        `;
        this.elements.usageRemaining = this.elements.courseUsageIndicator.querySelector('#usage-remaining');
        this.elements.main.appendChild(this.elements.courseUsageIndicator);

        // Controls Container
        this.elements.controlsContainer = DOM.createElement('div', { className: 'controls-container' });

        // --- Left Controls (Input) ---
        this.elements.leftControls = DOM.createElement('div', { className: 'left-controls' });
        this.elements.textInputContainer = DOM.createElement('div', { className: 'text-input-container' });

        const inputWrapper = DOM.createElement('div', { className: 'text-input-wrapper' });

        this.elements.textInput = DOM.createElement('input', {
            className: 'voice-bot-input',
            id: 'text-input',
            placeholder: 'Type message...',
            type: 'text'
        });

        this.elements.sendButton = DOM.createElement('button', {
            className: 'voice-bot-btn send-button',
            title: 'Send'
        });
        this.elements.sendButton.appendChild(this.createSendIcon()); // Append Icon Directly

        const yesNoGroup = DOM.createElement('div', { className: 'yes-no-buttons' });
        this.elements.yesButton = DOM.createElement('button', { className: 'voice-bot-btn yes-button', title: 'Yes' });
        this.elements.noButton = DOM.createElement('button', { className: 'voice-bot-btn no-button', title: 'No' });

        yesNoGroup.appendChild(this.elements.yesButton);
        yesNoGroup.appendChild(this.elements.noButton);

        inputWrapper.appendChild(this.elements.textInput);
        inputWrapper.appendChild(this.elements.sendButton);

        // Append icons to yes/no buttons
        this.elements.yesButton.appendChild(this.createCheckIcon());
        this.elements.noButton.appendChild(this.createCrossIcon());

        inputWrapper.appendChild(yesNoGroup);

        this.elements.textInputContainer.appendChild(inputWrapper);
        this.elements.leftControls.appendChild(this.elements.textInputContainer);

        // --- Right Controls (Buttons) ---
        this.elements.rightControls = DOM.createElement('div', { className: 'right-controls' });
        const controlGroup = DOM.createElement('div', { className: 'control-group' });

        // Reset
        this.elements.resetButton = DOM.createElement('button', { className: 'voice-bot-btn', title: 'Reset' });
        this.elements.resetButton.appendChild(this.createResetIcon());

        // Repeat
        this.elements.repeatButton = DOM.createElement('button', { className: 'voice-bot-btn', title: 'Repeat' });
        this.elements.repeatButton.appendChild(this.createRepeatIcon());

        // Back to Audio
        this.elements.backToAudioButton = DOM.createElement('button', {
            className: 'voice-bot-btn back-to-audio-btn',
            title: 'Back to Audio'
        });
        this.elements.backToAudioButton.appendChild(this.createBackToAudioIcon());
        this.elements.backToAudioButton.appendChild(document.createTextNode(' Back to Audio'));

        // Language Dropdown (replaces arrow buttons)
        this.elements.languageDropdownContainer = DOM.createElement('div', { className: 'language-dropdown-container' });

        this.elements.languageDropdownBtn = DOM.createElement('button', {
            className: 'language-dropdown-btn',
            title: 'Select Language'
        });
        this.elements.languageDropdownBtn.innerHTML = `
            <span class="language-text">English</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5H7z"/>
            </svg>
        `;

        this.elements.languageDropdownMenu = document.createElement('div');
        this.elements.languageDropdownMenu.className = 'language-dropdown-menu';

        // Available languages - create each as simple div with explicit styling
        const languages = [
            { code: 'en-US', name: 'English' },
            { code: 'ta-IN', name: 'Tamil' },
            { code: 'te-IN', name: 'Telugu' },
            { code: 'hi-IN', name: 'Hindi' },
            { code: 'ml-IN', name: 'Malayalam' },
            { code: 'kn-IN', name: 'Kannada' },
        ];

        languages.forEach(lang => {
            // Create element manually - not using DOMUtils
            const item = document.createElement('div');
            item.className = 'lang-item' + (lang.code === 'en-US' ? ' active' : '');
            item.innerText = lang.name;  // Using innerText - guaranteed to show text
            item.setAttribute('data-lang-code', lang.code);
            item.setAttribute('data-lang-name', lang.name);
            this.elements.languageDropdownMenu.appendChild(item);
        });

        this.elements.languageDropdownContainer.appendChild(this.elements.languageDropdownBtn);
        this.elements.languageDropdownContainer.appendChild(this.elements.languageDropdownMenu);

        // Mic
        this.elements.micButton = DOM.createElement('button', { className: 'voice-bot-btn mic-button', title: 'Click to start recording' });
        this.elements.micButton.appendChild(this.createMicIcon(false));

        // Append Right Controls - Language dropdown moved to left for better visibility
        controlGroup.appendChild(this.elements.resetButton);
        controlGroup.appendChild(this.elements.repeatButton);
        controlGroup.appendChild(this.elements.languageDropdownContainer);  // Moved left
        // Only show 'Back to Audio' button if not hidden (e.g., in video mode)
        if (!this.options.hideBackToAudio) {
            controlGroup.appendChild(this.elements.backToAudioButton);
        }
        controlGroup.appendChild(this.elements.micButton);
        this.elements.rightControls.appendChild(controlGroup);

        // Add to main controls
        this.elements.controlsContainer.appendChild(this.elements.leftControls);
        this.elements.controlsContainer.appendChild(this.elements.rightControls);

        // Overlays
        this.elements.sessionExpiredOverlay = DOM.createElement('div', {
            className: 'session-expired-overlay',
            style: { display: 'none' }
        });

        const sessionExpiredCard = DOM.createElement('div', { className: 'quota-exceeded-card' });
        sessionExpiredCard.innerHTML = `
            <h2 style="margin:0 0 10px 0;color:#ffffff;font-size:24px;font-weight:700;">Session Expired</h2>
            <p style="margin:0 0 20px 0;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.6;">
                Your voice bot session has ended. Start a new session to continue.
            </p>
        `;
        const restartBtn = DOM.createElement('button', { className: 'restart-button', textContent: 'Start New Session' });
        sessionExpiredCard.appendChild(restartBtn);
        this.elements.sessionExpiredOverlay.appendChild(sessionExpiredCard);

        // Quota Exceeded Overlay
        this.elements.quotaExceededOverlay = DOM.createElement('div', {
            className: 'quota-exceeded-overlay',
            style: { display: 'none' }
        });

        const quotaCard = DOM.createElement('div', { className: 'quota-exceeded-card' });
        quotaCard.innerHTML = `
            <h2 style="margin:0 0 10px 0;color:#ffffff;font-size:24px;font-weight:700;">Course Usage Over</h2>
            <p style="margin:0;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.6;">
                Your usage for this course is over. Please contact your instructor or admin if you need more time.
            </p>
        `;
        this.elements.quotaExceededOverlay.appendChild(quotaCard);

        this.elements.keyboardRecordingIndicator = DOM.createElement('div', {
            className: 'keyboard-recording-indicator',
            style: { display: 'none' },
            textContent: 'Recording (Release Key to Stop)'
        });

        // Final Assembly
        this.elements.main.appendChild(this.elements.controlsContainer);
        this.elements.main.appendChild(this.elements.sessionExpiredOverlay);
        this.elements.main.appendChild(this.elements.quotaExceededOverlay);
        this.elements.main.appendChild(this.elements.keyboardRecordingIndicator);
        this.container.appendChild(this.elements.main);

        // Cache restart button from overlay
        this.elements.restartButton = this.elements.sessionExpiredOverlay.querySelector('.restart-button');
    }

    // --- Robust SVG Helpers (Fixed) ---

    createSvgElement(pathData, viewBox = '0 -960 960 960') {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("viewBox", viewBox);
        svg.setAttribute("fill", "currentColor");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);

        svg.appendChild(path);
        return svg;
    }

    createSendIcon() {
        return this.createSvgElement('M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v140l280 60-280 60v140Z');
    }

    createResetIcon() {
        return this.createSvgElement('M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z');
    }

    createRepeatIcon() {
        return this.createSvgElement('M480-80q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-440h80q0 117 81.5 198.5T480-160q117 0 198.5-81.5T760-440q0-117-81.5-198.5T480-720h-6l62 62-56 58-160-160 160-160 56 58-62 62h6q150 0 255 105t105 255q0 150-105 255T480-80Zm-40-280v-160h80v80h80v80H440Z');
    }

    createBackToAudioIcon() {
        // Create a simpler back arrow icon that works well with text
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.style.marginRight = "4px";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z");

        svg.appendChild(path);
        return svg;
    }

    createPrevIcon() {
        return this.createSvgElement('M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z');
    }

    createNextIcon() {
        return this.createSvgElement('M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z');
    }

    createMicIcon(isActive = false) {
        const path = isActive
            ? 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z' // Active recording mic (simplified)
            : 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z'; // Inactive mic (same icon, different styling)

        // Create a standard microphone SVG with proper viewBox
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");

        // Microphone body
        const micBody = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        micBody.setAttribute("x", "9");
        micBody.setAttribute("y", "2");
        micBody.setAttribute("width", "6");
        micBody.setAttribute("height", "12");
        micBody.setAttribute("rx", "3");
        micBody.setAttribute("fill", "currentColor");

        // Microphone stand
        const micStand = document.createElementNS("http://www.w3.org/2000/svg", "path");
        micStand.setAttribute("d", "M12 17c-3.31 0-6-2.69-6-6H4c0 4.08 3.05 7.44 7 7.93V21h2v-2.07c3.95-.49 7-3.85 7-7.93h-2c0 3.31-2.69 6-6 6z");
        micStand.setAttribute("fill", "currentColor");

        svg.appendChild(micBody);

        if (isActive) {
            // Add recording indicator (small red dot or line)
            const recordingIndicator = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            recordingIndicator.setAttribute("cx", "19");
            recordingIndicator.setAttribute("cy", "5");
            recordingIndicator.setAttribute("r", "3");
            recordingIndicator.setAttribute("fill", "currentColor");
            recordingIndicator.setAttribute("opacity", "0.8");
            svg.appendChild(recordingIndicator);

            // Add subtle glow for active state
            svg.style.filter = 'drop-shadow(0 0 3px currentColor)';
        }

        svg.appendChild(micStand);

        return svg;
    }

    createCheckIcon() {
        return this.createSvgElement('M382-160 160-382l56-56 166 166 366-366 56 56L382-160Z');
    }

    createCrossIcon() {
        return this.createSvgElement('m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z');
    }

    bindEvents() {
        // Microphone
        if (this.elements.micButton) {
            this.elements.micButton.onclick = () => this.events.emit('micButtonClicked');
        }

        // Send Text
        const handleSend = () => {
            const text = this.elements.textInput.value.trim();
            if (text) {
                this.elements.textInput.value = '';
                this.events.emit('sendMessage', { text });
            }
        };

        if (this.elements.sendButton) this.elements.sendButton.onclick = handleSend;
        if (this.elements.textInput) {
            this.elements.textInput.onkeydown = (e) => {
                if (e.key === 'Enter') handleSend();
            };
        }

        // Quick replies
        if (this.elements.yesButton) this.elements.yesButton.onclick = () => this.events.emit('sendMessage', { text: 'Yes' });
        if (this.elements.noButton) this.elements.noButton.onclick = () => this.events.emit('sendMessage', { text: 'No' });

        // Controls
        if (this.elements.resetButton) this.elements.resetButton.onclick = () => this.events.emit('resetClicked');
        if (this.elements.repeatButton) this.elements.repeatButton.onclick = () => this.events.emit('repeatClicked');
        if (this.elements.backToAudioButton) this.elements.backToAudioButton.onclick = () => this.events.emit('backToAudioClicked');

        // Language Dropdown
        if (this.elements.languageDropdownBtn) {
            this.elements.languageDropdownBtn.onclick = (e) => {
                e.stopPropagation();
                const isOpen = this.elements.languageDropdownMenu.classList.toggle('open');
                this.elements.languageDropdownBtn.classList.toggle('open', isOpen);
            };
        }

        if (this.elements.languageDropdownMenu) {
            this.elements.languageDropdownMenu.onclick = (e) => {
                const item = e.target.closest('.lang-item');
                if (item) {
                    const langCode = item.getAttribute('data-lang-code');
                    const langName = item.getAttribute('data-lang-name');

                    // Update active state
                    this.elements.languageDropdownMenu.querySelectorAll('.lang-item').forEach(opt => {
                        opt.classList.remove('active');
                    });
                    item.classList.add('active');

                    // Update button text
                    const textSpan = this.elements.languageDropdownBtn.querySelector('.language-text');
                    if (textSpan) textSpan.textContent = langName;

                    // Close dropdown
                    this.elements.languageDropdownMenu.classList.remove('open');
                    this.elements.languageDropdownBtn.classList.remove('open');

                    // Emit event
                    this.events.emit('languageSelected', { code: langCode, name: langName });
                }
            };
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.elements.languageDropdownContainer &&
                !this.elements.languageDropdownContainer.contains(e.target)) {
                this.elements.languageDropdownMenu?.classList.remove('open');
                this.elements.languageDropdownBtn?.classList.remove('open');
            }
        });

        // Session
        if (this.elements.restartButton) this.elements.restartButton.onclick = () => {
            this.hideSessionExpired();
            this.events.emit('restartClicked');
        };
    }

    // --- Public API ---

    updateConnectionStatus(connected) {
        if (!this.elements.connectionIndicator) return;
        const dot = this.elements.connectionIndicator.querySelector('#connection-dot');
        const status = this.elements.connectionIndicator.querySelector('#connection-status');
        if (connected) {
            dot.classList.add('connected');
            status.textContent = 'Connected';
        } else {
            dot.classList.remove('connected');
            status.textContent = 'Disconnected';
        }
    }

    updateSessionTimer(seconds) {
        const minutes = Math.ceil(seconds / 60);
        this.elements.sessionTimer.textContent = `${minutes} min`;
        this.elements.sessionTimer.className = 'session-timer';
        if (seconds <= 60) this.elements.sessionTimer.classList.add('critical');
        else if (seconds <= 300) this.elements.sessionTimer.classList.add('warning');
    }

    updateRecordingStatus(isRecording, isKeyboardRecording = false) {
        this.elements.micButton.classList.toggle('active', isRecording);
        this.elements.micButton.innerHTML = '';
        this.elements.micButton.appendChild(this.createMicIcon(isRecording));

        // Update title to reflect current state
        this.elements.micButton.title = isRecording ? 'Click to stop recording' : 'Click to start recording';

        this.elements.keyboardRecordingIndicator.style.display = 'none';
    }

    updateLanguage(languageName) {
        // Update dropdown button text
        if (languageName && this.elements.languageDropdownBtn) {
            const textSpan = this.elements.languageDropdownBtn.querySelector('.language-text');
            if (textSpan) textSpan.textContent = languageName;

            // Update active state in dropdown menu
            if (this.elements.languageDropdownMenu) {
                this.elements.languageDropdownMenu.querySelectorAll('.lang-item').forEach(opt => {
                    opt.classList.toggle('active', opt.getAttribute('data-lang-name') === languageName);
                });
            }
        }
    }

    setLanguageDropdownState(enabled) {
        if (this.elements.languageDropdownBtn) {
            this.elements.languageDropdownBtn.disabled = !enabled;
            this.elements.languageDropdownBtn.style.opacity = enabled ? '1' : '0.5';
            this.elements.languageDropdownBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
            this.elements.languageDropdownBtn.title = enabled ? 'Select Language' : 'Start the session/speak to enable language selection';
        }
    }

    showSessionExpired() {
        this.elements.sessionExpiredOverlay.style.display = 'flex';
        this.sessionExpired = true;
    }

    hideSessionExpired() {
        this.elements.sessionExpiredOverlay.style.display = 'none';
        this.sessionExpired = false;
    }

    updateUsageRemaining(formattedTime, seconds = null) {
        if (!this.elements.usageRemaining) {
            return;
        }

        this.elements.usageRemaining.textContent = formattedTime;
        this.elements.usageRemaining.className = 'usage-remaining';

        if (typeof seconds === 'number') {
            if (seconds <= 300) {
                this.elements.usageRemaining.classList.add('critical');
            } else if (seconds <= 900) {
                this.elements.usageRemaining.classList.add('warning');
            }
        }
    }

    showQuotaExceeded() {
        if (this.elements.courseUsageIndicator) {
            this.elements.courseUsageIndicator.style.display = 'none';
        }
        if (this.elements.connectionIndicator) {
            this.elements.connectionIndicator.style.display = 'none';
        }
        if (this.elements.controlsContainer) {
            this.elements.controlsContainer.style.display = 'none';
        }
        this.elements.quotaExceededOverlay.style.display = 'flex';
        this.quotaExceeded = true;
    }

    hideQuotaExceeded() {
        if (this.elements.courseUsageIndicator) {
            this.elements.courseUsageIndicator.style.display = '';
        }
        if (this.elements.connectionIndicator) {
            this.elements.connectionIndicator.style.display = '';
        }
        if (this.elements.controlsContainer) {
            this.elements.controlsContainer.style.display = '';
        }
        if (this.elements.quotaExceededOverlay) {
            this.elements.quotaExceededOverlay.style.display = 'none';
        }
        this.quotaExceeded = false;
    }

    updateButtons(recording, connected, hasSession) {
        // Disabled state logic
        const isDisabled = recording || !connected;

        if (this.elements.repeatButton) this.elements.repeatButton.disabled = isDisabled;
        // if (this.elements.languageDropdownBtn) this.elements.languageDropdownBtn.disabled = recording; // Managed manually now

        // Input state
        if (this.elements.textInput) this.elements.textInput.disabled = isDisabled;
        if (this.elements.sendButton) this.elements.sendButton.disabled = isDisabled;
    }

    getCanvas() {
        return this.elements.canvas;
    }

    on(event, callback) {
        this.events.on(event, callback);
    }

    /**
     * Cleanup and destroy the UI controller
     */
    destroy() {
        console.log('🎨 UIController: Destroying...');

        // Remove event listeners from buttons
        if (this.elements.micButton) this.elements.micButton.onclick = null;
        if (this.elements.sendButton) this.elements.sendButton.onclick = null;
        if (this.elements.textInput) this.elements.textInput.onkeydown = null;
        if (this.elements.yesButton) this.elements.yesButton.onclick = null;
        if (this.elements.noButton) this.elements.noButton.onclick = null;
        if (this.elements.resetButton) this.elements.resetButton.onclick = null;
        if (this.elements.repeatButton) this.elements.repeatButton.onclick = null;
        if (this.elements.backToAudioButton) this.elements.backToAudioButton.onclick = null;
        if (this.elements.prevLangButton) this.elements.prevLangButton.onclick = null;
        if (this.elements.nextLangButton) this.elements.nextLangButton.onclick = null;
        if (this.elements.restartButton) this.elements.restartButton.onclick = null;

        // Clear container HTML
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Clear element references
        this.elements = {};

        console.log('🎨 UIController: Destroyed');
    }
}

// Export for module systems or attach to window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
} else {
    window.UIController = UIController;
}
