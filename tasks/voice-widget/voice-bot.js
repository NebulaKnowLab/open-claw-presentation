/**
 * Voice Bot - Main class that orchestrates all components
 * Vanilla JavaScript implementation for easy integration into any HTML page
 */

class VoiceBot {
    constructor(options = {}) {
        // Configuration
        this.config = {
            container: '#voice-bot-container',
            width: '100%',
            height: '400px',
            backendUrl: 'https://voice-bot-v2-759854934093.us-central1.run.app', // Default backend URL
            language: 'en-US',
            topics: [],
            systemPrompt: '',
            sessionTimeout: 10 * 60, // 10 minutes in seconds
            logoPath: 'https://storage.cloud.google.com/task-html-page/logo.png?authuser=1', // Google Cloud Storage logo
            theme: 'light', // Default theme: 'light' or 'dark'
            hideBackToAudio: false, // Hide 'Back to Audio' button (useful for video mode)
            allowedOrigins: [
                'http://127.0.0.1:5500',
                'http://localhost:5500',
                'http://localhost:3000',
                'http://localhost:8080',
                'http://127.0.0.1:3002',
                'https://us-central1-gen-lang-client-0364779787.cloudfunctions.net',
                'https://us-central1-gen-lang-client-0364779787.cloudfunctions.net/voice-bot'
            ],
            ...options
        };

        // Languages support
        // Languages support
        this.languages = [
            { code: 'en-US', name: 'English' },
            { code: 'ta-IN', name: 'Tamil' },
            { code: 'te-IN', name: 'Telugu' },
            { code: 'hi-IN', name: 'Hindi' },
            { code: 'ml-IN', name: 'Malayalam' },
            { code: 'kn-IN', name: 'Kannada' },
        ];

        // State
        this.isInitialized = false;
        this.isRecording = false;
        this.isKeyboardRecording = false;
        this.isConnected = false;
        this.sessionId = null;
        this.selectedLanguage = this.config.language;
        this.topics = this.config.topics;
        this.systemPrompt = this.config.systemPrompt;
        this.originalSystemPrompt = this.config.systemPrompt || '';
        this.isSwitchingLanguage = false;

        // Session management
        this.sessionStartTime = null;
        this.sessionTimerInterval = null;
        this.sessionTimeRemaining = Number.isFinite(this.config.sessionTimeout)
            ? this.config.sessionTimeout
            : 0;
        this.sessionExpiresAt = null;  // Unix timestamp from backend for accurate countdown
        this.usageTimeRemaining = null;
        this.quotaExceeded = false;
        this.sessionExpired = false;

        // Transcriptions
        this.userTranscription = '';
        this.aiTranscription = '';

        // Components
        this.uiController = null;
        this.audioManager = null;
        this.websocketClient = null;
        this.visualizer = null;

        // Event emitter
        this.events = window.VoiceBotUtils.EventUtils.createEmitter();

        // Initialize
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Voice Bot...');

            // Initialize UI first
            this.uiController = new UIController({
                container: this.config.container,
                width: this.config.width,
                height: this.config.height,
                theme: this.config.theme,
                hideBackToAudio: this.config.hideBackToAudio
            });

            // Initialize audio manager
            this.audioManager = new AudioManager();

            // Initialize WebSocket client
            this.websocketClient = new WebSocketClient({
                backendUrl: this.config.backendUrl,
                courseId: this.config.courseId,
                learnerId: this.config.learnerId,
                learnerName: this.config.learnerName
            });

            // Initialize visualizer
            const canvas = this.uiController.getCanvas();
            this.visualizer = new Visualizer(canvas, {
                logoPath: this.config.logoPath,
                theme: this.config.theme
            });

            // Connect audio nodes to visualizer after audio manager is initialized
            this.connectAudioNodesToVisualizer();

            // Set up event listeners
            this.setupEventListeners();

            // Initialize language display
            this.uiController.updateLanguage(this.languages.find(l => l.code === this.selectedLanguage)?.name);
            this.uiController.setLanguageDropdownState(false); // Disable initially

            // Connect to WebSocket
            await this.websocketClient.connect();

            // Create session
            await this.createSession();

            // Set up keyboard shortcuts
            this.setupKeyboardListeners();

            this.isInitialized = true;
            console.log('Voice Bot initialized successfully');
            this.events.emit('initialized');

        } catch (error) {
            if (this.isQuotaExceededError(error)) {
                this.handleQuotaExceeded();
                return;
            }

            console.error('Failed to initialize Voice Bot:', error);
            this.events.emit('error', error);
        }
    }

    setupEventListeners() {
        // UI Controller events
        this.uiController.on('micButtonClicked', () => {
            this.toggleRecording();
        });

        this.uiController.on('sendMessage', ({ text }) => {
            this.sendMessage(text);
        });

        this.uiController.on('resetClicked', () => {
            this.reset();
        });

        this.uiController.on('repeatClicked', () => {
            this.repeatLastResponse();
        });

        // Language dropdown selection
        this.uiController.on('languageSelected', ({ code, name }) => {
            this.setLanguage(code);
        });

        this.uiController.on('restartClicked', () => {
            this.restartSession();
        });

        this.uiController.on('backToAudioClicked', () => {
            this.handleBackToAudio();
        });

        // Audio Manager events
        this.audioManager.on('recordingStarted', () => {
            console.log('Recording started');
            this.uiController.updateRecordingStatus(this.isRecording, this.isKeyboardRecording);
        });

        this.audioManager.on('recordingStopped', () => {
            console.log('Recording stopped');
            this.uiController.updateRecordingStatus(this.isRecording, this.isKeyboardRecording);
        });

        this.audioManager.on('audioData', (audioBlob) => {
            if (this.isConnected && this.sessionId) {
                this.websocketClient.sendAudio(audioBlob);
            }
        });

        this.audioManager.on('audioPlaybackStarted', ({ duration }) => {
            console.log('Audio playback started, duration:', duration);
            this.uiController.setLanguageDropdownState(true); // Enable on first audio
            this.events.emit('audioPlayback'); // Ensure this event bubbles up if needed
        });

        this.audioManager.on('error', (error) => {
            console.error('Audio manager error:', error);
            this.events.emit('error', error);
        });

        // WebSocket Client events
        this.websocketClient.on('connected', () => {
            this.isConnected = true;
            this.uiController.updateConnectionStatus(true);
            this.events.emit('connected');
        });

        this.websocketClient.on('disconnected', () => {
            this.isConnected = false;
            this.uiController.updateConnectionStatus(false);
            this.stopRecording();
            this.events.emit('disconnected');
        });

        this.websocketClient.on('sessionCreated', ({ sessionId, sessionTimeout, sessionExpiresAt }) => {
            this.quotaExceeded = false;
            this.sessionExpired = false;
            this.uiController.hideQuotaExceeded();
            this.sessionId = sessionId;
            this.startSessionTimer(sessionTimeout, sessionExpiresAt);
            this.events.emit('sessionCreated', { sessionId, sessionTimeout, sessionExpiresAt });
        });

        this.websocketClient.on('sessionClosed', ({ reason }) => {
            this.sessionId = null;

            if (reason === 'quota_exceeded') {
                this.clearSessionTimer();
                this.handleQuotaExceeded();
            } else {
                // Backend closed session - show session expired immediately
                // Set timer to 0 and show the overlay so user knows session is over
                this.clearSessionTimer();
                this.sessionTimeRemaining = 0;
                this.uiController.updateSessionTimer(0);
                this.showSessionTimeoutMessage();
            }

            this.events.emit('sessionClosed', { reason });
        });

        this.websocketClient.on('usageUpdate', ({ remainingSeconds, remainingFormatted }) => {
            this.usageTimeRemaining = remainingSeconds;
            this.uiController.updateUsageRemaining(remainingFormatted, remainingSeconds);
            this.events.emit('usageUpdate', { remainingSeconds, remainingFormatted });
        });

        this.websocketClient.on('quotaExceeded', ({ remainingSeconds }) => {
            if (typeof remainingSeconds === 'number') {
                this.usageTimeRemaining = remainingSeconds;
                this.uiController.updateUsageRemaining(this.formatUsageTime(remainingSeconds), remainingSeconds);
            }

            this.handleQuotaExceeded();
        });

        this.websocketClient.on('geminiMessage', ({ message, transcription, inputTranscription }) => {
            this.processGeminiMessage(message, transcription, inputTranscription);
        });

        this.websocketClient.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.events.emit('error', error);
        });

        this.websocketClient.on('serverError', ({ error, details, remainingSeconds }) => {
            if (typeof remainingSeconds === 'number') {
                this.usageTimeRemaining = remainingSeconds;
                this.uiController.updateUsageRemaining(this.formatUsageTime(remainingSeconds), remainingSeconds);
            }

            if (error === 'No time remaining' || remainingSeconds === 0) {
                this.handleQuotaExceeded();
            }

            this.events.emit('serverError', { error, details, remainingSeconds });
        });

        // Listen for parent window messages (for widget mode)
        window.addEventListener('message', this.handleParentMessage.bind(this));
    }

    setupKeyboardListeners() {
        // Bind methods to maintain 'this' context
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleWindowBlur = this.handleWindowBlur.bind(this);

        // Add event listeners
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('blur', this.handleWindowBlur);
    }

    handleKeyDown(event) {
        // Check if Right Ctrl key is pressed and not already recording via keyboard
        if (event.key === 'Control' &&
            event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT &&
            !this.isKeyboardRecording) {

            event.preventDefault();
            this.isKeyboardRecording = true;
            this.startRecording('keyboard');
        }
    }

    handleKeyUp(event) {
        // Check if Right Ctrl key is released
        if (event.key === 'Control' &&
            event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT &&
            this.isKeyboardRecording) {

            event.preventDefault();
            this.isKeyboardRecording = false;
            this.stopRecording('keyboard');
        }
    }

    handleWindowBlur() {
        // Stop recording if window loses focus while keyboard is active
        if (this.isKeyboardRecording) {
            this.isKeyboardRecording = false;
            this.stopRecording('keyboard');
        }
    }

    handleParentMessage(event) {
        if (!this.config.allowedOrigins.includes(event.origin)) return;

        if (event.data.type === 'ask_question' && typeof event.data.question === 'string') {
            this.sendMessage(event.data.question);
        }
    }

    connectAudioNodesToVisualizer() {
        // Wait for audio manager to be initialized before connecting
        if (this.audioManager && this.audioManager.isInitialized && this.visualizer) {
            // Get audio nodes from audio manager
            const inputNode = this.audioManager.getInputNode();
            const outputNode = this.audioManager.getOutputNode();

            // Connect to visualizer for audio analysis
            if (inputNode) {
                this.visualizer.setInputAudioNode(inputNode);
                console.log('Connected input audio node to visualizer');
            } else {
                console.warn('Input audio node not available');
            }

            if (outputNode) {
                this.visualizer.setOutputAudioNode(outputNode);
                console.log('Connected output audio node to visualizer');
            } else {
                console.warn('Output audio node not available');
            }
        } else {
            // Try again after a short delay if not initialized yet
            setTimeout(() => {
                this.connectAudioNodesToVisualizer();
            }, 500);
        }
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording('button');
        } else {
            this.startRecording('button');
        }
    }

    async startRecording(controlMethod = 'button') {
        if (this.isRecording || !this.isConnected || !this.sessionId) {
            return false;
        }

        console.log(`Starting recording with session: ${this.sessionId} via ${controlMethod}`);
        this.isRecording = true;

        const success = await this.audioManager.startRecording();
        if (!success) {
            this.isRecording = false;
        }

        this.uiController.updateRecordingStatus(this.isRecording, this.isKeyboardRecording);
        this.updateButtonStates();

        return success;
    }

    stopRecording(controlMethod = 'button') {
        if (!this.isRecording) return;

        console.log(`Stopping recording via ${controlMethod}`);
        this.isRecording = false;

        if (controlMethod === 'keyboard') {
            this.isKeyboardRecording = false;
        }

        this.audioManager.stopRecording();
        this.uiController.updateRecordingStatus(this.isRecording, this.isKeyboardRecording);
        this.updateButtonStates();
    }

    sendMessage(text) {
        if (!text.trim() || !this.isConnected || !this.sessionId || this.isRecording) {
            return false;
        }

        const success = this.websocketClient.sendText(text.trim());
        if (success) {
            this.events.emit('messageSent', { text: text.trim() });
        }

        return success;
    }

    async createSession() {
        try {
            // Generate system prompt if not provided
            if (!this.systemPrompt) {
                this.systemPrompt = this.getLanguageAwareSystemPrompt();
            }

            const result = await this.websocketClient.createSession({
                topics: this.topics,
                systemPrompt: this.systemPrompt,
                language: this.selectedLanguage
            });

            if (result?.quotaExceeded) {
                this.handleQuotaExceeded();
                return result;
            }

            return result;
        } catch (error) {
            if (this.isQuotaExceededError(error)) {
                this.handleQuotaExceeded();
                return null;
            }

            console.error('Failed to create session:', error);
            this.events.emit('error', error);
            throw error;
        }
    }

    async processGeminiMessage(message, transcription, inputTranscription) {
        console.log('Processing Gemini message:', message);

        // Handle transcriptions
        if (inputTranscription) {
            this.userTranscription = inputTranscription;
            this.events.emit('userTranscription', { text: inputTranscription });
        }

        if (transcription) {
            this.aiTranscription = transcription;
            this.uiController.setLanguageDropdownState(true); // Enable on transcription
            this.events.emit('aiTranscription', { text: transcription });
        }

        // Handle audio playback
        const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData;
        if (audio) {
            try {
                await this.audioManager.playAudio(audio.data);
                this.events.emit('audioPlayback');
            } catch (error) {
                console.error('Audio playback error:', error);
            }
        }

        // Handle interruption
        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
            this.audioManager.stopAllPlayback();
        }
    }

    createEducationalSystemPrompt() {
        const langName = this.languages.find(l => l.code === this.selectedLanguage)?.name || 'English';

        if (this.topics.length === 0) {
            return `You are Nebula, an AI learning assistant. Respond in ${langName}.
The student has just finished listening to a pre-recorded audio lesson.
Your role is to answer any doubts or questions they have about the lesson.
After your greeting, wait for the student to ask a question.
Provide clear, thorough explanations that fully address their doubts.`;
        }

        // Note: This is a fallback - normally voice-widget-manager.js provides the systemPrompt
        // Topics array contains the topic title (used by backend for greeting)
        const topicTitle = this.topics.join(' and ');

        return `You are Nebula, a friendly AI learning assistant. Respond in ${langName}.

=== YOUR ROLE ===
You are a DOUBT CLARIFICATION assistant for: "${topicTitle}"
The student has ALREADY listened to a pre-recorded audio lesson on this topic.
You are here to help answer their specific questions, NOT to teach the entire lesson again.

=== BEHAVIOR RULES ===
1. After your greeting, WAIT for the student to ask a question
2. When answering, provide thorough and clear explanations
3. Use examples, analogies, or step-by-step breakdowns when helpful
4. Make the conversation interactive - ask if they understood or need more clarity
5. If asked "what can you help with?", briefly mention 2-3 key concepts from the topic
6. Be encouraging and supportive
7. IMPORTANT: If you are asked to say a greeting in English, you must TRANSLATE it into ${langName} first.

=== STRICT TOPIC RESTRICTIONS ===
- You MUST ONLY discuss topics related to: "${topicTitle}"
- If asked about completely unrelated topics, politely redirect:
  "I'm your assistant for ${topicTitle}. Is there anything about this topic you'd like me to clarify?"
- Do NOT go off-topic even if the student tries to change the subject`;
    }

    getLanguageAwareSystemPrompt() {
        const langName = this.languages.find(l => l.code === this.selectedLanguage)?.name || 'English';
        const langInstruction = `\n\n=== LANGUAGE ===\nYou MUST respond and speak in ${langName}. Keep key technical terms in English.`;
        const basePrompt = this.originalSystemPrompt || this.createEducationalSystemPrompt();
        return basePrompt + langInstruction;
    }

    // Session management
    startSessionTimer(sessionTimeout, sessionExpiresAt) {
        this.sessionStartTime = Date.now();
        this.sessionExpiresAt = sessionExpiresAt || null;

        // Use backend's sessionTimeout if provided, otherwise fall back to config
        this.sessionTimeRemaining = Number.isFinite(sessionTimeout)
            ? sessionTimeout
            : (Number.isFinite(this.config.sessionTimeout) ? this.config.sessionTimeout : 0);

        // Clear any existing timer
        if (this.sessionTimerInterval) {
            clearInterval(this.sessionTimerInterval);
        }

        // Update timer every second
        this.sessionTimerInterval = setInterval(() => {
            this.updateSessionTimer();
        }, 1000);
    }

    updateSessionTimer() {
        if (!this.sessionStartTime) return;

        // Use sessionExpiresAt from backend for accurate countdown (resilient to timer drift)
        if (this.sessionExpiresAt) {
            this.sessionTimeRemaining = Math.max(0, this.sessionExpiresAt - Math.floor(Date.now() / 1000));
        } else {
            // Fallback: calculate from session start time
            const sessionTimeout = Number.isFinite(this.config.sessionTimeout)
                ? this.config.sessionTimeout
                : 0;
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            this.sessionTimeRemaining = Math.max(0, sessionTimeout - elapsed);
        }

        if (typeof this.usageTimeRemaining === 'number') {
            this.usageTimeRemaining = Math.max(0, this.usageTimeRemaining - 1);
            this.uiController.updateUsageRemaining(
                this.formatUsageTime(this.usageTimeRemaining),
                this.usageTimeRemaining
            );
        }

        // Update UI - always update even if at 0
        this.uiController.updateSessionTimer(this.sessionTimeRemaining);

        // Check for timeout
        if (this.sessionTimeRemaining <= 0 && !this.sessionExpired) {
            this.sessionExpired = true;
            this.clearSessionTimer();
            this.showSessionTimeoutMessage();
        }

        this.events.emit('sessionTimerUpdate', { remaining: this.sessionTimeRemaining });
    }

    clearSessionTimer() {
        if (this.sessionTimerInterval) {
            clearInterval(this.sessionTimerInterval);
            this.sessionTimerInterval = null;
        }
        this.sessionStartTime = null;
        this.sessionTimeRemaining = 0;
    }

    formatUsageTime(seconds) {
        if (seconds <= 0) {
            return '0m';
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.ceil((seconds % 3600) / 60);

        if (hours > 0 && minutes > 0) {
            return `${hours}h ${minutes}m`;
        }

        if (hours > 0) {
            return `${hours}h`;
        }

        return `${minutes}m`;
    }

    isQuotaExceededError(error) {
        return !!error && typeof error.message === 'string' && error.message === 'No time remaining';
    }

    showSessionTimeoutMessage() {
        this.stopRecording();
        this.uiController.showSessionExpired();
        this.events.emit('sessionExpired');
    }

    handleQuotaExceeded() {
        if (this.quotaExceeded) {
            return;
        }

        this.quotaExceeded = true;
        this.isConnected = false;
        this.stopRecording();
        this.clearSessionTimer();
        this.uiController.updateConnectionStatus(false);
        this.uiController.showQuotaExceeded();
        this.events.emit('quotaExceeded');
    }

    async restartSession() {
        this.uiController.hideSessionExpired();
        this.uiController.hideQuotaExceeded();
        this.quotaExceeded = false;
        this.sessionExpired = false;
        await this.reset();
    }

    // Language management
    cycleLanguage(direction = 'next') {
        const currentIndex = this.languages.findIndex(l => l.code === this.selectedLanguage);
        let newIndex;

        if (direction === 'next') {
            newIndex = (currentIndex + 1) % this.languages.length;
        } else {
            newIndex = (currentIndex - 1 + this.languages.length) % this.languages.length;
        }

        this.setLanguage(this.languages[newIndex].code);
    }

    async setLanguage(langCode) {
        if (this.selectedLanguage === langCode || this.isSwitchingLanguage) return;

        const previousLang = this.selectedLanguage;
        const previousSystemPrompt = this.systemPrompt;

        this.isSwitchingLanguage = true;
        this.selectedLanguage = langCode;
        const langName = this.languages.find(l => l.code === langCode)?.name;

        if (this.isRecording) this.stopRecording();
        this.audioManager.stopAllPlayback();

        this.uiController.updateLanguage(langName);
        this.uiController.setLanguageDropdownState(false);

        this.systemPrompt = this.getLanguageAwareSystemPrompt();

        if (this.isConnected && this.websocketClient && this.sessionId) {
            try {
                const result = await this.websocketClient.switchLanguage(langCode, this.systemPrompt);

                if (result?.quotaExceeded) {
                    this.isSwitchingLanguage = false;
                    this.handleQuotaExceeded();
                    return;
                }

                this.uiController.setLanguageDropdownState(true);
            } catch (error) {
                console.error('Failed to switch language:', error);
                this.selectedLanguage = previousLang;
                this.systemPrompt = previousSystemPrompt || this.getLanguageAwareSystemPrompt();
                this.uiController.updateLanguage(
                    this.languages.find(l => l.code === previousLang)?.name
                );

                try {
                    await this.createSession();
                    this.uiController.setLanguageDropdownState(true);
                } catch (restoreError) {
                    console.error('Failed to restore previous language session:', restoreError);
                    this.uiController.setLanguageDropdownState(false);
                    this.events.emit('error', restoreError);
                }
            }
        }

        this.isSwitchingLanguage = false;
        this.events.emit('languageChanged', { language: langCode, name: langName });
    }

    // Control methods
    repeatLastResponse() {
        this.sendMessage('Please repeat what you just said.');
    }

    handleBackToAudio() {
        console.log('Back to Audio button clicked');

        // Dispatch custom event to trigger transition back to audio player
        const event = new CustomEvent('backToAudio', {
            detail: {
                sessionId: this.sessionId,
                timestamp: Date.now(),
                language: this.selectedLanguage
            }
        });
        document.dispatchEvent(event);

        console.log('VoiceBot: Back to Audio event dispatched');
        this.events.emit('backToAudio', { sessionId: this.sessionId });
    }

    async reset() {
        console.log('Resetting Voice Bot...');

        this.stopRecording();
        this.clearSessionTimer();

        // Clear transcriptions
        this.userTranscription = '';
        this.aiTranscription = '';

        // Close session and WebSocket
        if (this.sessionId && this.websocketClient) {
            this.websocketClient.closeSession();
        }
        if (this.websocketClient) {
            this.websocketClient.disconnect();
        }

        // Reset state
        this.isConnected = false;
        this.sessionId = null;
        this.sessionExpiresAt = null;
        this.isSwitchingLanguage = false;
        this.selectedLanguage = this.config.language;
        this.topics = this.config.topics;
        this.systemPrompt = this.config.systemPrompt;
        this.usageTimeRemaining = null;
        this.quotaExceeded = false;
        this.sessionExpired = false;

        // Update UI
        this.uiController.updateConnectionStatus(false);
        this.uiController.updateUsageRemaining('--', null);
        this.uiController.updateLanguage(this.languages.find(l => l.code === this.selectedLanguage)?.name);
        this.uiController.setLanguageDropdownState(false); // Disable on reset
        this.uiController.hideQuotaExceeded();

        try {
            // Reconnect and create new session
            await this.websocketClient.connect();
            await this.createSession();
        } catch (error) {
            console.error('Failed to reset Voice Bot:', error);
            this.events.emit('error', error);
        }
    }

    updateButtonStates() {
        this.uiController.updateButtons(this.isRecording, this.isConnected, !!this.sessionId);
    }

    // Public API methods
    async sendMessageToAI(text) {
        return this.sendMessage(text);
    }

    async changeLanguage(languageCode) {
        return this.setLanguage(languageCode);
    }

    setTopics(topics) {
        this.topics = Array.isArray(topics) ? topics : [topics];
        this.systemPrompt = ''; // Will be regenerated on next session

        if (this.sessionId && this.websocketClient) {
            this.websocketClient.updateSystemPrompt(this.createEducationalSystemPrompt());
        }
    }

    getConnectionStatus() {
        return {
            initialized: this.isInitialized,
            connected: this.isConnected,
            recording: this.isRecording,
            hasSession: !!this.sessionId,
            sessionId: this.sessionId,
            language: this.selectedLanguage,
            sessionTimeRemaining: this.sessionTimeRemaining
        };
    }

    // Event methods
    on(event, callback) {
        this.events.on(event, callback);
    }

    off(event, callback) {
        this.events.off(event, callback);
    }

    // Cleanup
    destroy() {
        console.log('Destroying Voice Bot...');

        this.stopRecording();
        this.clearSessionTimer();

        // Remove keyboard listeners
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('blur', this.handleWindowBlur);
        window.removeEventListener('message', this.handleParentMessage);

        // Destroy components
        if (this.audioManager) this.audioManager.destroy();
        if (this.websocketClient) this.websocketClient.destroy();
        if (this.visualizer) this.visualizer.destroy();
        if (this.uiController) this.uiController.destroy();

        // Clear state
        this.isInitialized = false;

        this.events.emit('destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceBot;
} else {
    window.VoiceBot = VoiceBot;
}
