/**
 * WebSocket Client for Voice Bot
 * Handles all WebSocket communication with the backend
 */

class WebSocketClient {
    constructor(config = {}) {
        this.config = {
            backendUrl: this.getBackendUrl(),
            reconnectAttempts: 5,
            reconnectDelay: 1000,
            connectionTimeout: 30000, // 30 seconds for Gemini API connection
            ...config
        };

        this.ws = null;
        this.isConnected = false;
        this.sessionId = null;
        this.sessionTimeout = null;      // Seconds remaining for current session (from backend)
        this.sessionExpiresAt = null;     // Unix timestamp when session expires (from backend)
        this.clientId = window.VoiceBotUtils.Utils.getClientId();
        this.courseId = this.config.courseId;
        this.learnerId = this.config.learnerId;
        this.learnerName = this.config.learnerName || null;
        this.isQuotaExceeded = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = this.config.reconnectDelay;

        // Event emitter
        this.events = window.VoiceBotUtils.EventUtils.createEmitter();
    }

    getBackendUrl() {
        // Check for environment variable
        if (typeof window !== 'undefined' && window.VOICE_BOT_CONFIG) {
            return window.VOICE_BOT_CONFIG.backendUrl;
        }

        // Auto-detect based on current location
        const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isProduction) {
            return window.location.origin;
        }

        return 'https://voice-bot-v2-759854934093.us-central1.run.app';
    }

    getWebSocketUrl() {
        const baseUrl = this.config.backendUrl;
        const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
        const url = baseUrl.replace(/^https?/, wsProtocol);
        return `${url}/ws`;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = this.getWebSocketUrl();
                console.log('Connecting to WebSocket:', wsUrl);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('🔌 WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.reconnectDelay = this.config.reconnectDelay;
                    this.events.emit('connected');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event);
                };

                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    this.sessionId = null;
                    this.events.emit('disconnected', { code: event.code, reason: event.reason });

                    // Attempt reconnection if it wasn't a clean close
                    if (event.code !== 1000 && this.reconnectAttempts < this.config.reconnectAttempts) {
                        this.attemptReconnection();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.isConnected = false;
                    this.events.emit('error', error);
                    reject(error);
                };

                // Set connection timeout
                const timeout = setTimeout(() => {
                    if (!this.isConnected) {
                        this.ws.close();
                        reject(new Error('Connection timeout'));
                    }
                }, this.config.connectionTimeout);

                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    console.log('🔌 WebSocket connected');
                    this.isConnected = true;
                    this.isQuotaExceeded = false;
                    this.reconnectAttempts = 0;
                    this.reconnectDelay = this.config.reconnectDelay;
                    this.events.emit('connected');
                    resolve();
                };

            } catch (error) {
                console.error('Failed to create WebSocket:', error);
                this.isConnected = false;
                this.events.emit('error', error);
                reject(error);
            }
        });
    }

    async attemptReconnection() {
        if (this.reconnectAttempts >= this.config.reconnectAttempts) {
            console.log('Max reconnection attempts reached');
            this.events.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempts++;
        this.reconnectDelay *= 2; // Exponential backoff

        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.config.reconnectAttempts} in ${this.reconnectDelay}ms`);

        setTimeout(async () => {
            try {
                await this.connect();
                console.log('Reconnection successful');
                this.events.emit('reconnected');
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.attemptReconnection(); // Try again
            }
        }, this.reconnectDelay);
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', data.type);

            switch (data.type) {
                case 'session_created':
                    this.sessionId = data.sessionId;
                    this.sessionTimeout = data.sessionTimeout;
                    this.sessionExpiresAt = data.sessionExpiresAt;
                    this.isQuotaExceeded = false;
                    console.log('✅ Session created with ID:', this.sessionId, 'Timeout:', this.sessionTimeout, 's');
                    this.events.emit('sessionCreated', {
                        sessionId: data.sessionId,
                        sessionTimeout: data.sessionTimeout,
                        sessionExpiresAt: data.sessionExpiresAt
                    });
                    break;

                case 'gemini_message':
                    this.events.emit('geminiMessage', {
                        message: data.message,
                        transcription: data.transcription,
                        inputTranscription: data.inputTranscription
                    });
                    break;

                case 'audio_sent':
                    this.events.emit('audioSent');
                    break;

                case 'text_sent':
                    console.log('✅ Text sent to AI successfully');
                    this.events.emit('textSent');
                    break;

                case 'session_closed':
                    this.sessionId = null;
                    console.log('Session closed');
                    this.events.emit('sessionClosed', { reason: data.reason || null });
                    break;

                case 'usage_update':
                    this.events.emit('usageUpdate', {
                        learnerId: data.learnerId,
                        courseId: data.courseId,
                        usedSeconds: data.usedSeconds,
                        maxSeconds: data.maxSeconds,
                        remainingSeconds: data.remainingSeconds,
                        remainingFormatted: data.remainingFormatted,
                        hasTimeRemaining: data.hasTimeRemaining
                    });
                    break;

                case 'error':
                    if (data.error === 'No time remaining') {
                        this.isQuotaExceeded = true;
                        console.log('Voice bot usage exhausted for this learner/course');
                        this.events.emit('quotaExceeded', {
                            error: data.error,
                            details: data.details,
                            remainingSeconds: data.remainingSeconds
                        });
                    } else if (this.isQuotaExceeded && data.error === 'Session error') {
                        console.log('Ignoring session shutdown message after quota exhaustion');
                    } else {
                        console.error('WebSocket error:', data.error);
                        this.events.emit('serverError', {
                            error: data.error,
                            details: data.details,
                            remainingSeconds: data.remainingSeconds
                        });
                    }
                    break;

                default:
                    console.warn('Unknown WebSocket message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.events.emit('parseError', error);
        }
    }

    async createSession(options = {}) {
        if (!this.isConnected || !this.ws) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve, reject) => {
            // Close existing session if any
            if (this.sessionId) {
                this.closeSession();
            }

            const sessionOptions = {
                topics: options.topics || [],
                systemPrompt: options.systemPrompt || '',
                clientId: this.clientId,
                courseId: this.courseId,
                learnerId: this.learnerId,
                learnerName: this.learnerName,
                language: options.language || 'en-US',
                ...options
            };

            // Set up temporary message handler for session creation
            const originalOnMessage = this.ws.onmessage;

            const sessionCreationTimeout = setTimeout(() => {
                this.ws.onmessage = originalOnMessage;
                reject(new Error('Session creation timeout'));
            }, this.config.connectionTimeout);

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'session_created') {
                        clearTimeout(sessionCreationTimeout);
                        this.ws.onmessage = originalOnMessage;
                        this.sessionId = data.sessionId;
                        console.log('✅ Session created successfully with ID:', this.sessionId);
                        this.events.emit('sessionCreated', { sessionId: data.sessionId, options: sessionOptions });
                        resolve({ sessionId: data.sessionId, options: sessionOptions });
                    } else if (data.type === 'error' && data.error === 'No time remaining') {
                        clearTimeout(sessionCreationTimeout);
                        this.ws.onmessage = originalOnMessage;
                        this.isQuotaExceeded = true;
                        this.events.emit('quotaExceeded', {
                            error: data.error,
                            details: data.details,
                            remainingSeconds: data.remainingSeconds
                        });
                        resolve({
                            sessionId: null,
                            quotaExceeded: true,
                            remainingSeconds: data.remainingSeconds ?? 0,
                            options: sessionOptions
                        });
                    } else if (data.type === 'error') {
                        clearTimeout(sessionCreationTimeout);
                        this.ws.onmessage = originalOnMessage;
                        reject(new Error(data.error));
                    }
                    // Also forward other messages to the original handler
                    originalOnMessage?.call(this.ws, event);
                } catch (error) {
                    console.error('Error parsing session creation message:', error);
                }
            };

            try {
                this.ws.send(JSON.stringify({
                    type: 'create_session',
                    ...sessionOptions
                }));
                console.log('Session creation request sent');
            } catch (error) {
                clearTimeout(sessionCreationTimeout);
                this.ws.onmessage = originalOnMessage;
                console.error('Session creation error:', error);
                reject(error);
            }
        });
    }

    async switchLanguage(language, systemPrompt) {
        if (!this.isConnected || !this.ws || !this.sessionId) {
            throw new Error('WebSocket not connected or no active session');
        }

        return new Promise((resolve, reject) => {
            const originalOnMessage = this.ws.onmessage;

            const switchTimeout = setTimeout(() => {
                this.ws.onmessage = originalOnMessage;
                reject(new Error('Language switch timeout'));
            }, this.config.connectionTimeout);

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'session_created') {
                        clearTimeout(switchTimeout);
                        this.ws.onmessage = originalOnMessage;
                        this.sessionId = data.sessionId;
                        this.sessionTimeout = data.sessionTimeout;
                        this.sessionExpiresAt = data.sessionExpiresAt;
                        console.log('✅ Language switch session created:', this.sessionId);
                        this.events.emit('sessionCreated', {
                            sessionId: data.sessionId,
                            sessionTimeout: data.sessionTimeout,
                            sessionExpiresAt: data.sessionExpiresAt
                        });
                        resolve({ sessionId: data.sessionId, language });
                    } else if (data.type === 'error' && data.error === 'No time remaining') {
                        clearTimeout(switchTimeout);
                        this.ws.onmessage = originalOnMessage;
                        this.isQuotaExceeded = true;
                        this.events.emit('quotaExceeded', {
                            error: data.error,
                            details: data.details,
                            remainingSeconds: data.remainingSeconds
                        });
                        resolve({
                            sessionId: null,
                            quotaExceeded: true,
                            remainingSeconds: data.remainingSeconds ?? 0,
                            language
                        });
                    } else if (data.type === 'error') {
                        clearTimeout(switchTimeout);
                        this.ws.onmessage = originalOnMessage;
                        reject(new Error(data.error));
                    } else {
                        originalOnMessage?.call(this.ws, event);
                    }
                } catch (error) {
                    clearTimeout(switchTimeout);
                    this.ws.onmessage = originalOnMessage;
                    reject(error);
                }
            };

            try {
                this.ws.send(JSON.stringify({
                    type: 'switch_language',
                    language,
                    systemPrompt
                }));
                console.log('Language switch request sent:', language);
            } catch (error) {
                clearTimeout(switchTimeout);
                this.ws.onmessage = originalOnMessage;
                console.error('Language switch error:', error);
                reject(error);
            }
        });
    }

    closeSession() {
        if (!this.sessionId || !this.isConnected || !this.ws) {
            return;
        }

        try {
            this.ws.send(JSON.stringify({
                type: 'close_session'
            }));
            this.sessionId = null;
            console.log('Session closed');
        } catch (error) {
            console.warn('Error closing session:', error);
        }
    }

    sendAudio(audioBlob) {
        if (!this.isConnected || !this.ws || !this.sessionId) {
            console.warn('Cannot send audio: not connected or no session');
            return false;
        }

        try {
            this.ws.send(JSON.stringify({
                type: 'send_audio',
                audioData: audioBlob
            }));
            return true;
        } catch (error) {
            console.error('Error sending audio data:', error);
            return false;
        }
    }

    sendText(text) {
        if (!this.isConnected || !this.ws || !this.sessionId) {
            console.warn('Cannot send text: not connected or no session');
            return false;
        }

        try {
            this.ws.send(JSON.stringify({
                type: 'send_text',
                text: text.trim()
            }));
            console.log('Text message sent:', text);
            return true;
        } catch (error) {
            console.error('Error sending text:', error);
            return false;
        }
    }

    updateSystemPrompt(systemPrompt) {
        if (!this.isConnected || !this.ws || !this.sessionId) {
            console.warn('Cannot update system prompt: not connected or no session');
            return false;
        }

        try {
            this.ws.send(JSON.stringify({
                type: 'update_system_prompt',
                systemPrompt
            }));
            console.log('System prompt updated');
            return true;
        } catch (error) {
            console.error('Error updating system prompt:', error);
            return false;
        }
    }

    // Get connection status
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            sessionId: this.sessionId,
            clientId: this.clientId,
            courseId: this.courseId,
            learnerId: this.learnerId,
            learnerName: this.learnerName,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    // Manual reconnection
    async reconnect() {
        this.disconnect();
        await this.connect();
    }

    // Disconnect and cleanup
    disconnect() {
        if (this.sessionId) {
            this.closeSession();
        }

        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }

        this.isConnected = false;
        this.sessionId = null;
        this.reconnectAttempts = 0;
        this.reconnectDelay = this.config.reconnectDelay;

        this.events.emit('disconnected');
    }

    // Event methods
    on(event, callback) {
        this.events.on(event, callback);
    }

    off(event, callback) {
        this.events.off(event, callback);
    }

    // Destroy client
    destroy() {
        this.disconnect();
        this.events.emit('destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketClient;
} else {
    window.WebSocketClient = WebSocketClient;
}
