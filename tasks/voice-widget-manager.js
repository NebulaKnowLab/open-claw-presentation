/**
 * Voice Widget Manager for SCORM Builder Pagination System
 * Manages lifecycle of VoiceBot widgets during page navigation
 */

class VoiceWidgetManager {
    constructor() {
        this.activeWidgets = new Map(); // subConceptId -> VoiceBot instance
        this.widgetContainers = new Map(); // subConceptId -> container element
        this.initialized = false;
        this.retryAttempts = new Map(); // subConceptId -> retry count
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2 seconds
        this.backendUrl = 'https://voice-bot-v2-759854934093.us-central1.run.app';
        this.courseId = this.getCourseId();
        this.learnerId = this.getLearnerId();
        this.learnerName = this.getLearnerName();
        this.sessionTimeoutSeconds = null;

        // Bind methods to maintain context
        this.handlePageChange = this.handlePageChange.bind(this);
        this.handleWidgetError = this.handleWidgetError.bind(this);

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Initialize voice widget for a sub-concept
     * @param {string} subConceptId - ID of the sub-concept
     * @param {string} botContext - Bot context from config.json (fallback for chat widget)
     * @param {string} containerSelector - CSS selector for container element
     * @param {string} [voicebotContext] - Voice-specific context from config.json (takes priority)
     * @param {string} [subConceptTitle] - Title of the sub-concept for personalized greeting
     * @param {boolean} [hideBackToAudio] - Hide 'Back to Audio' button (useful for video mode)
     */
    async initializeWidget(subConceptId, botContext, containerSelector, voicebotContext = null, subConceptTitle = null, hideBackToAudio = false) {
        // Use voicebot_context if provided, otherwise fallback to bot_context for backwards compatibility
        const effectiveContext = voicebotContext || botContext;
        try {
            // Clean up any existing widget for this sub-concept
            if (this.activeWidgets.has(subConceptId)) {
                this.destroyWidget(subConceptId);
            }

            const container = document.querySelector(containerSelector);
            if (!container) {
                console.error(`VoiceWidgetManager: Container not found for selector ${containerSelector}`);
                return false;
            }

            // Store container reference
            this.widgetContainers.set(subConceptId, container);
            this.learnerId = this.getLearnerId();
            this.learnerName = this.getLearnerName();
            this.courseId = this.getCourseId();

            if (!this.learnerId || !this.courseId) {
                this.retryAttempts.set(subConceptId, this.maxRetries);
                this.showMissingIdentityMessage(subConceptId);
                console.warn(`VoiceWidgetManager: Missing learner or course id for ${subConceptId}`);
                return true;
            }

            const [usageSnapshot, backendConfig] = await Promise.all([
                this.checkUsageRemaining(),
                this.fetchBackendConfig()
            ]);

            const sessionTimeout = Number.isFinite(backendConfig?.sessionTimeout)
                ? backendConfig.sessionTimeout
                : this.sessionTimeoutSeconds;

            if (!Number.isFinite(sessionTimeout) || sessionTimeout <= 0) {
                this.retryAttempts.set(subConceptId, this.maxRetries);
                this.showUnavailableMessage(
                    subConceptId,
                    'Voice bot session settings could not be loaded from the backend.'
                );
                console.warn(`VoiceWidgetManager: Missing backend session timeout for ${subConceptId}`);
                return true;
            }

            if (usageSnapshot && usageSnapshot.hasTimeRemaining === false) {
                this.retryAttempts.set(subConceptId, this.maxRetries);
                // Check if course is configured or not - show different messages
                if (usageSnapshot.isConfigured === false) {
                    this.showNotConfiguredMessage(subConceptId);
                    console.log(`VoiceWidgetManager: Skipping widget boot for ${subConceptId} - course not configured`);
                } else {
                    this.showQuotaExceededMessage(subConceptId, usageSnapshot.remainingFormatted || '0m', true);
                    console.log(`VoiceWidgetManager: Skipping widget boot for ${subConceptId} because quota is exhausted`);
                }
                return true;
            }

            // Create VoiceBot configuration
            // IMPORTANT: Backend uses 'topics' array for greeting message generation (greeting.js)
            // Pass the topic TITLE in topics (for greeting), and full CONTEXT in systemPrompt (for knowledge)
            const voiceBotConfig = {
                container: containerSelector,
                width: '100%',
                height: '100%', // Let VoiceBot use full container height
                theme: this.detectTheme(),
                topics: subConceptTitle ? [subConceptTitle] : [],  // Topic TITLE for greeting (backend uses this)
                backendUrl: this.backendUrl,
                courseId: this.courseId,
                learnerId: this.learnerId,
                learnerName: this.learnerName,
                language: 'en-US',
                sessionTimeout: sessionTimeout,
                logoPath: 'https://storage.cloud.google.com/task-html-page/logo.png?authuser=1', // Use Google Cloud Storage logo
                systemPrompt: this.createSystemPrompt(effectiveContext, subConceptTitle),  // Full CONTEXT for knowledge
                hideBackToAudio: hideBackToAudio  // Hide 'Back to Audio' button if true
            };

            // Initialize VoiceBot widget
            const voiceBot = new VoiceBot(voiceBotConfig);

            // Set up event listeners for the widget
            this.setupWidgetEventListeners(voiceBot, subConceptId);

            // Store widget instance
            this.activeWidgets.set(subConceptId, voiceBot);
            this.retryAttempts.set(subConceptId, 0);

            console.log(`VoiceWidgetManager: Initialized widget for sub-concept ${subConceptId}`);
            return true;

        } catch (error) {
            console.error(`VoiceWidgetManager: Failed to initialize widget for ${subConceptId}:`, error);
            this.handleWidgetError(subConceptId, error);
            return false;
        }
    }

    async checkUsageRemaining() {
        try {
            const response = await fetch(
                `${this.backendUrl}/api/usage/${this.learnerId}/${this.courseId}`
            );

            if (!response.ok) {
                console.warn('VoiceWidgetManager: Usage precheck failed with status', response.status);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.warn('VoiceWidgetManager: Usage precheck failed, continuing with widget init', error);
            return null;
        }
    }

    getLearnerId() {
        const scormApi = this.getScormApi();
        if (!scormApi || typeof scormApi.GetValue !== 'function') {
            // No SCORM API - check if we're in preview mode
            if (this.isPreviewMode()) {
                console.log('VoiceWidgetManager: No SCORM API, using test-learner for preview');
                return 'test-learner';
            }
            return null;
        }

        try {
            const learnerId = scormApi.GetValue('cmi.learner_id');
            const normalizedLearnerId = typeof learnerId === 'string' ? learnerId.trim() : '';
            return normalizedLearnerId || null;
        } catch (error) {
            console.warn('VoiceWidgetManager: Failed to read cmi.learner_id from SCORM API', error);
            return null;
        }
    }

    getCourseId() {
        for (const locationText of this.getCandidateLocationTexts()) {
            const match = locationText.match(/\/course\/(\d+)/);
            if (match) {
                return match[1];
            }
        }

        // No course ID from URL - check if we're in preview mode
        if (this.isPreviewMode()) {
            console.log('VoiceWidgetManager: No course ID in URL, using test-course for preview');
            return 'test-course';
        }

        return null;
    }

    getLearnerName() {
        const scormApi = this.getScormApi();
        if (!scormApi || typeof scormApi.GetValue !== 'function') {
            // No SCORM API - check if we're in preview mode
            if (this.isPreviewMode()) {
                return 'Preview User';
            }
            return null;
        }

        try {
            const learnerName = scormApi.GetValue('cmi.learner_name');
            const normalizedLearnerName = typeof learnerName === 'string' ? learnerName.trim() : '';
            return normalizedLearnerName || null;
        } catch (error) {
            console.warn('VoiceWidgetManager: Failed to read cmi.learner_name from SCORM API', error);
            return null;
        }
    }

    isPreviewMode() {
        // Check if we're running in a preview environment (Google Cloud Storage, localhost, etc.)
        const hostname = window.location.hostname;
        const href = window.location.href;

        // Preview environments
        const previewPatterns = [
            'storage.googleapis.com',
            'localhost',
            '127.0.0.1',
            'file://'
        ];

        const isPreview = previewPatterns.some(pattern =>
            hostname.includes(pattern) || href.startsWith(pattern)
        );

        if (isPreview) {
            console.log('VoiceWidgetManager: Detected preview mode');
        }

        return isPreview;
    }

    getScormApi() {
        const directApi = window.scormAPIInstance?.api;
        if (directApi) {
            return directApi;
        }

        if (typeof window.scormAPIInstance?.findAPI === 'function') {
            try {
                return window.scormAPIInstance.findAPI(window);
            } catch (error) {
                console.warn('VoiceWidgetManager: Failed to resolve SCORM API via findAPI', error);
            }
        }

        return null;
    }

    getCandidateLocationTexts() {
        const locations = [];
        const candidates = [window, window.parent, window.top];

        for (const candidate of candidates) {
            try {
                if (!candidate || !candidate.location) {
                    continue;
                }

                const href = candidate.location.href || '';
                const hash = candidate.location.hash || '';
                const combined = `${href} ${hash}`.trim();

                if (combined && !locations.includes(combined)) {
                    locations.push(combined);
                }
            } catch (error) {
                // Ignore cross-origin access issues.
            }
        }

        return locations;
    }

    async fetchBackendConfig() {
        try {
            const response = await fetch(`${this.backendUrl}/api/health`);

            if (!response.ok) {
                console.warn('VoiceWidgetManager: Backend config fetch failed with status', response.status);
                return null;
            }

            const data = await response.json();
            if (typeof data.sessionTimeout === 'number') {
                this.sessionTimeoutSeconds = data.sessionTimeout;
            }
            return data;
        } catch (error) {
            console.warn('VoiceWidgetManager: Backend config fetch failed, using fallback timeout', error);
            return null;
        }
    }

    showQuotaExceededMessage(subConceptId, remainingFormatted = '0m', isConfigured = true) {
        const container = this.widgetContainers.get(subConceptId);
        if (!container) {
            return;
        }

        // Match backend error messages exactly
        const title = isConfigured ? 'No Time Remaining' : 'Voice Bot Not Available';
        const message = isConfigured
            ? 'You have used all your allotted time for this course.'
            : 'The voice bot feature is not available for your course yet.';

        container.innerHTML = `
            <div class="voice-widget-quota-state" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:180px;padding:12px;background:linear-gradient(180deg,#02040a 0%,#0b1120 100%);border-radius:12px;overflow:hidden;">
                <div style="max-width:320px;width:100%;padding:16px 18px;border-radius:14px;background:rgba(15,23,42,0.92);border:1px solid rgba(96,165,250,0.28);box-shadow:0 10px 28px rgba(0,0,0,0.28);text-align:center;color:#e5eefb;">
                    ${isConfigured ? `<div style="font-size:12px;color:#93c5fd;margin-bottom:8px;">Voice bot time left: ${remainingFormatted}</div>` : ''}
                    <h3 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#ffffff;">${title}</h3>
                    <p style="margin:0;font-size:13px;line-height:1.45;color:#cbd5e1;">${message}</p>
                </div>
            </div>
        `;
    }

    showMissingIdentityMessage(subConceptId) {
        this.showUnavailableMessage(
            subConceptId,
            'Learner or course identification is missing, so voice bot usage cannot be checked.',
            'Voice Bot Unavailable'
        );
    }

    showNotConfiguredMessage(subConceptId) {
        this.showQuotaExceededMessage(subConceptId, '0m', false);
    }

    showUnavailableMessage(subConceptId, message, title = 'Voice Bot Unavailable') {
        const container = this.widgetContainers.get(subConceptId);
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="voice-widget-quota-state" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:180px;padding:12px;background:linear-gradient(180deg,#02040a 0%,#0b1120 100%);border-radius:12px;overflow:hidden;">
                <div style="max-width:320px;width:100%;padding:16px 18px;border-radius:14px;background:rgba(15,23,42,0.92);border:1px solid rgba(96,165,250,0.28);box-shadow:0 10px 28px rgba(0,0,0,0.28);text-align:center;color:#e5eefb;">
                    <h3 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#ffffff;">${title}</h3>
                    <p style="margin:0;font-size:13px;line-height:1.45;color:#cbd5e1;">${message}</p>
                </div>
            </div>
        `;
    }

    /**
     * Destroy widget when navigating away
     * @param {string} subConceptId - ID of the sub-concept
     */
    destroyWidget(subConceptId) {
        try {
            const widget = this.activeWidgets.get(subConceptId);
            if (widget && typeof widget.destroy === 'function') {
                // Destroy the VoiceBot instance
                widget.destroy();
                console.log(`VoiceWidgetManager: Destroyed widget for sub-concept ${subConceptId}`);
            }

            // Clean up container
            const container = this.widgetContainers.get(subConceptId);
            if (container) {
                container.innerHTML = '';
            }

            // Remove from tracking maps
            this.activeWidgets.delete(subConceptId);
            this.widgetContainers.delete(subConceptId);
            this.retryAttempts.delete(subConceptId);

        } catch (error) {
            console.error(`VoiceWidgetManager: Error destroying widget for ${subConceptId}:`, error);
        }
    }

    /**
     * Cleanup all widgets (called during page navigation)
     */
    cleanupAllWidgets() {
        console.log('VoiceWidgetManager: Cleaning up all widgets');

        // Destroy all active widgets
        for (const [subConceptId] of this.activeWidgets) {
            this.destroyWidget(subConceptId);
        }

        // Clear all tracking maps
        this.activeWidgets.clear();
        this.widgetContainers.clear();
        this.retryAttempts.clear();
    }

    /**
     * Handle page change events
     * @param {Object} event - Page change event
     */
    handlePageChange(event) {
        const { fromPage, toPage } = event.detail;

        // Cleanup voice widgets from previous page
        if (fromPage && fromPage.type === 'sub-concept' && fromPage.subConcept) {
            this.destroyWidget(fromPage.subConcept.id);
        }

        // Note: Widget initialization for new page is handled in page renderer
        console.log('VoiceWidgetManager: Handled page change event');
    }

    /**
     * Set up event listeners for pagination and global events
     */
    setupEventListeners() {
        // Listen for page changes
        document.addEventListener('pageChanged', this.handlePageChange);

        // Listen for window unload for cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanupAllWidgets();
        });

        console.log('VoiceWidgetManager: Event listeners set up');
    }

    /**
     * Set up event listeners for a specific widget
     * @param {VoiceBot} voiceBot - VoiceBot instance
     * @param {string} subConceptId - Sub-concept ID
     */
    setupWidgetEventListeners(voiceBot, subConceptId) {
        if (typeof voiceBot.on === 'function') {
            voiceBot.on('initialized', () => {
                console.log(`VoiceWidgetManager: Widget ${subConceptId} initialized successfully`);
                this.retryAttempts.set(subConceptId, 0); // Reset retry counter on success
            });

            voiceBot.on('quotaExceeded', () => {
                console.log(`VoiceWidgetManager: Widget ${subConceptId} quota exhausted`);
                this.retryAttempts.set(subConceptId, this.maxRetries);
            });

            voiceBot.on('connected', () => {
                console.log(`VoiceWidgetManager: Widget ${subConceptId} connected to backend`);
            });

            voiceBot.on('error', (error) => {
                console.error(`VoiceWidgetManager: Widget ${subConceptId} error:`, error);
                this.handleWidgetError(subConceptId, error);
            });

            voiceBot.on('disconnected', () => {
                console.log(`VoiceWidgetManager: Widget ${subConceptId} disconnected`);
            });
        }
    }

    /**
     * Handle widget errors with retry logic
     * @param {string} subConceptId - Sub-concept ID
     * @param {Error} error - Error that occurred
     */
    handleWidgetError(subConceptId, error) {
        const currentRetries = this.retryAttempts.get(subConceptId) || 0;

        if (error?.message === 'No time remaining') {
            console.log(`VoiceWidgetManager: Widget ${subConceptId} quota exhausted - not retrying`);
            this.retryAttempts.set(subConceptId, this.maxRetries);
            return;
        }

        // Check if this is a WebSocket connection error (service unavailable)
        const isWebSocketError = error.type === 'error' &&
            (error.target && error.target instanceof WebSocket) ||
            error.message && error.message.includes('WebSocket') ||
            error.message && error.message.includes('Failed to initialize');

        // For WebSocket errors, don't retry multiple times - fail fast
        if (isWebSocketError) {
            console.warn(`VoiceWidgetManager: WebSocket connection failed for widget ${subConceptId} - service unavailable`);
            this.retryAttempts.set(subConceptId, this.maxRetries); // Set to max to prevent further retries
            this.showErrorMessage(subConceptId, error);
            return;
        }

        if (currentRetries < this.maxRetries) {
            this.retryAttempts.set(subConceptId, currentRetries + 1);

            console.log(`VoiceWidgetManager: Retrying widget ${subConceptId} (attempt ${currentRetries + 1}/${this.maxRetries})`);

            setTimeout(() => {
                // Show retry message to user
                this.showRetryMessage(subConceptId, currentRetries + 1);

                // Retry initialization would need original parameters - for now just log
                console.log(`VoiceWidgetManager: Retry scheduled for widget ${subConceptId}`);
            }, this.retryDelay);
        } else {
            console.error(`VoiceWidgetManager: Max retries exceeded for widget ${subConceptId}`);
            this.showErrorMessage(subConceptId, error);
        }
    }

    /**
     * Show retry message to user
     * @param {string} subConceptId - Sub-concept ID
     * @param {number} attempt - Current retry attempt
     */
    showRetryMessage(subConceptId, attempt) {
        const container = this.widgetContainers.get(subConceptId);
        if (container) {
            const retryDiv = document.createElement('div');
            retryDiv.className = 'voice-widget-retry';
            retryDiv.innerHTML = `
                <div class="p-4 text-center bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p class="text-sm text-yellow-800">
                        Voice assistant connection failed. Retrying... (${attempt}/${this.maxRetries})
                    </p>
                </div>
            `;
            container.appendChild(retryDiv);

            // Remove message after delay
            setTimeout(() => {
                if (retryDiv.parentNode) {
                    retryDiv.parentNode.removeChild(retryDiv);
                }
            }, 3000);
        }
    }

    /**
     * Show error message to user
     * @param {string} subConceptId - Sub-concept ID
     * @param {Error} error - Error that occurred
     */
    showErrorMessage(subConceptId, error) {
        const container = this.widgetContainers.get(subConceptId);
        if (container) {
            // Check if this is a WebSocket/connection error
            const isConnectionError = error.message && (
                error.message.includes('WebSocket') ||
                error.message.includes('connection') ||
                error.message.includes('Failed to initialize')
            );

            const errorTitle = isConnectionError ?
                'Voice Assistant Service Unavailable' :
                'Voice Assistant Error';

            const errorMessage = isConnectionError ?
                'The voice assistant service is temporarily unavailable. You can still use the chat tutor for help.' :
                'An error occurred while loading the voice assistant. Please try again later.';

            const showRetry = !isConnectionError; // Don't show retry for service unavailable

            container.innerHTML = `
                <div class="voice-widget-error p-6 text-center bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="mb-4">
                        <i class="fas fa-microphone-slash text-4xl text-blue-400"></i>
                    </div>
                    <h4 class="text-lg font-semibold text-blue-900 mb-2">${errorTitle}</h4>
                    <p class="text-sm text-blue-700 mb-4">${errorMessage}</p>
                    ${showRetry ? `
                        <button onclick="window.voiceWidgetManager.retryWidget('${subConceptId}')"
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            <i class="fas fa-redo mr-2"></i>Retry
                        </button>
                    ` : `
                        <div class="text-sm text-blue-600">
                            <i class="fas fa-info-circle mr-2"></i>
                            Try using the Chat Tutor button below for immediate assistance
                        </div>
                    `}
                </div>
            `;
        }
    }

    /**
     * Retry widget initialization
     * @param {string} subConceptId - Sub-concept ID
     */
    retryWidget(subConceptId) {
        // Reset retry counter and clear error
        this.retryAttempts.set(subConceptId, 0);

        // Dispatch event to trigger re-initialization from page renderer
        document.dispatchEvent(new CustomEvent('retryVoiceWidget', {
            detail: { subConceptId }
        }));
    }

    /**
     * Get current theme for VoiceBot - SCORM builder uses light mode
     */
    detectTheme() {
        // Force light mode for consistency with the SCORM builder interface
        // The SCORM builder doesn't have theme switching, so VoiceBot should always match
        return 'light';
    }

    /**
     * Create system prompt for doubt clarification behavior
     * NOTE: Backend (greeting.js) handles the greeting message using 'topics' array
     * This system prompt defines the AI's behavior and knowledge context
     * @param {string} topicContext - Topic context from config.json (voicebot_context or bot_context)
     * @param {string} [topicTitle] - Title of the topic (for reference in restrictions)
     */
    createSystemPrompt(topicContext, topicTitle = null) {
        const displayTitle = topicTitle || 'the lesson';

        if (!topicContext) {
            return `You are Nebula, a friendly AI learning assistant.

YOUR ROLE: 
- The student has just finished listening to a pre-recorded audio lesson
- You are here to CLARIFY DOUBTS and answer specific questions about the lesson
- You are NOT teaching the full lesson - just helping with questions

BEHAVIOR:
- After your greeting, wait for the student to ask a question
- Answer questions thoroughly with clear explanations
- Use examples when they help illustrate concepts
- Keep the conversation encouraging and engaging
- If asked about unrelated topics, politely redirect: "I'm here to help with ${displayTitle}. Do you have any questions about it?"`;
        }

        return `You are Nebula, a friendly and engaging AI learning assistant.

=== YOUR ROLE ===
You are a DOUBT CLARIFICATION assistant for: "${displayTitle}"
The student has ALREADY listened to a pre-recorded audio lesson on this topic.
You are here to help answer their specific questions, NOT to teach the entire lesson again.

=== TOPIC KNOWLEDGE (use this to answer questions - DO NOT read aloud) ===
${topicContext}

=== BEHAVIOR RULES ===
1. After your initial greeting, WAIT for the student to ask a question
2. When answering, provide thorough and clear explanations
3. Use examples, analogies, or step-by-step breakdowns when helpful
4. Make the conversation interactive - ask if they understood or need more clarity
5. If asked "what can you help with?", briefly mention 2-3 key concepts from the topic
6. Be encouraging and supportive

=== STRICT TOPIC RESTRICTIONS ===
- You MUST ONLY discuss topics related to: "${displayTitle}"
- You can use the topic knowledge above to answer questions
- If asked about completely unrelated topics (e.g., cooking, sports, other subjects), politely redirect:
  "I'm your assistant for ${displayTitle}. Is there anything about this topic you'd like me to clarify?"
- Do NOT go off-topic even if the student tries to change the subject`;
    }

    /**
     * Check if a widget is active for a sub-concept
     * @param {string} subConceptId - Sub-concept ID
     * @returns {boolean} - Whether widget is active
     */
    isWidgetActive(subConceptId) {
        return this.activeWidgets.has(subConceptId);
    }

    /**
     * Get active widget instance
     * @param {string} subConceptId - Sub-concept ID
     * @returns {VoiceBot|null} - VoiceBot instance or null
     */
    getWidget(subConceptId) {
        return this.activeWidgets.get(subConceptId) || null;
    }

    /**
     * Destroy manager and clean up all resources
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('pageChanged', this.handlePageChange);
        window.removeEventListener('beforeunload', this.cleanupAllWidgets);

        // Clean up all widgets
        this.cleanupAllWidgets();

        console.log('VoiceWidgetManager: Manager destroyed');
    }
}

// Initialize the global voice widget manager when the script loads
window.voiceWidgetManager = new VoiceWidgetManager();

console.log('VoiceWidgetManager: Loaded and initialized');
