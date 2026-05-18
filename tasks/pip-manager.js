/**
 * PipManager - Picture-in-Picture Manager for Task Steps
 * 
 * Provides a floating, always-on-top window showing task step instructions
 * using the Document Picture-in-Picture API (Chrome 116+, Edge 116+)
 * launched explicitly from the FAB/helper flow.
 * 
 */

class PipManager {
    constructor(options = {}) {
        this.options = options;
        this.mode = options.mode || 'main';
        this.disableFloatingTrigger = !!options.disableFloatingTrigger;
        this.disableBlurListener = !!options.disableBlurListener;
        this.pipWindow = null;
        this.currentTaskId = null;
        this.currentTaskTitle = '';
        this.steps = [];
        this.currentStepIndex = 0;
        this.isActive = false;
        this.isSuppressedByWorkspace = false;
        this.blurListenerAttached = false;
        this.carouselIndex = 0;
        this.resizeObserver = null;
        this.floatingTriggerContainer = null;
        this.floatingTriggerButton = null;
        this.helperWindow = null;
        this.helperWindowName = 'nebulaPipHelper';
        this.helperReady = false;
        this.helperPipActive = false;
        this.helperTaskId = null;
        this.helperMessageListenerBound = null;
        this.pendingHelperPayload = null;

        this.init();
    }

    init() {
        if (this.mode === 'main') {
            this.helperMessageListenerBound = this.handleHelperMessage.bind(this);
            window.addEventListener('message', this.helperMessageListenerBound);
        }

        if (this.isDocumentPipSupported()) {
            if (!this.disableFloatingTrigger) {
                this.setupFloatingTriggerWhenReady();
            }
        }
    }

    setupFloatingTriggerWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.ensureFloatingTrigger(), { once: true });
            return;
        }

        this.ensureFloatingTrigger();
    }

    /**
     * Check if Document Picture-in-Picture API is supported
     */
    isDocumentPipSupported() {
        return 'documentPictureInPicture' in window;
    }

    setWorkspaceSuppressed(suppressed) {
        this.isSuppressedByWorkspace = !!suppressed;

        if (this.isSuppressedByWorkspace && this.isPipActive()) {
            this.closePip();
        }

        this.updateFloatingTriggerVisibility();
        this.updateFloatingTriggerState();
    }

    /**
     * Set the current task context (called when viewing a task)
     */
    setTaskContext(taskId, steps, currentStepIndex = 0, taskTitle = '') {
        if (this.isActive && this.currentTaskId && this.currentTaskId !== taskId) {
            this.closePip();
        }

        this.currentTaskId = taskId;
        this.currentTaskTitle = taskTitle || this.currentTaskTitle || '';
        this.steps = steps || [];
        this.currentStepIndex = currentStepIndex;

        this.updateFloatingTriggerVisibility();
        this.updateFloatingTriggerState();

        if (this.mode === 'main') {
            this.syncHelperTaskContext();
        }
    }

    /**
     * Clear active task context (used when leaving task pages)
     */
    clearTaskContext(closeActivePip = true) {
        if (closeActivePip && this.pipWindow) {
            this.closePip();
        }

        if (closeActivePip && this.mode === 'main' && this.helperPipActive) {
            this.postHelperMessage({ type: 'nebula-pip-helper:close-pip' });
        }

        this.currentTaskId = null;
        this.currentTaskTitle = '';
        this.steps = [];
        this.currentStepIndex = 0;
        this.carouselIndex = 0;

        this.updateFloatingTriggerVisibility();
        this.updateFloatingTriggerState();

        if (this.mode === 'main') {
            this.postHelperMessage({ type: 'nebula-pip-helper:clear-task' });
        }
    }

    ensureFloatingTrigger() {
        if (this.floatingTriggerContainer || !document.body) return;

        const container = document.createElement('div');
        container.id = 'pip-floating-trigger';
        container.className = 'pip-floating-trigger hidden';
        container.innerHTML = `
            <div class="pip-floating-actions" aria-hidden="true">
                <button type="button" class="pip-floating-action" data-action="focus" title="Focus Picture-in-Picture">
                    <i class="fas fa-up-right-and-down-left-from-center"></i>
                    <span>Focus</span>
                </button>
                <button type="button" class="pip-floating-action danger" data-action="close" title="Close Picture-in-Picture">
                    <i class="fas fa-xmark"></i>
                    <span>Close</span>
                </button>
            </div>
            <button type="button" class="pip-floating-main" title="Open Picture-in-Picture mode" aria-label="Open Picture-in-Picture mode">
                <i class="fas fa-clone"></i>
            </button>
        `;

        document.body.appendChild(container);

        this.floatingTriggerContainer = container;
        this.floatingTriggerButton = container.querySelector('.pip-floating-main');

        if (this.floatingTriggerButton) {
            this.floatingTriggerButton.addEventListener('click', () => {
                this.handleFloatingMainClick();
            });
        }

        container.querySelectorAll('.pip-floating-action').forEach((button) => {
            button.addEventListener('click', (event) => {
                const action = event.currentTarget.getAttribute('data-action');
                this.handleFloatingAction(action);
            });
        });

        this.updateFloatingTriggerVisibility();
        this.updateFloatingTriggerState();
    }

    handleFloatingMainClick() {
        if (this.isPipActive()) {
            if (this.pipWindow) {
                this.pipWindow.focus();
            } else if (this.mode === 'main' && this.helperWindow && !this.helperWindow.closed) {
                this.postHelperMessage({ type: 'nebula-pip-helper:focus-pip' });
                this.helperWindow.focus();
            }
            return;
        }

        const blockReason = this.getManualLaunchBlockReason();
        if (blockReason) {
            console.warn('[PipManager] FAB click blocked:', blockReason, this.getDebugState());
            this.showErrorMessage(blockReason);
            return;
        }

        this.createPip(this.currentTaskId, this.steps, this.currentStepIndex, {
            userInitiated: true,
            source: 'floating-trigger'
        });
    }

    openCurrentTaskPip() {
        if (!this.currentTaskId || !Array.isArray(this.steps) || this.steps.length === 0) {
            return false;
        }

        return this.createPip(this.currentTaskId, this.steps, this.currentStepIndex, {
            userInitiated: true,
            source: 'workspace-action'
        });
    }

    getManualLaunchBlockReason() {
        if (!this.isDocumentPipSupported()) {
            return 'Picture-in-Picture is not supported in this browser.';
        }

        if (this.isSuppressedByWorkspace) {
            return 'Picture-in-Picture is unavailable while the task workspace is open.';
        }

        if (!this.currentTaskId) {
            return 'Picture-in-Picture is not ready for this task yet.';
        }

        if (!Array.isArray(this.steps) || this.steps.length === 0) {
            return 'No instruction steps are available for Picture-in-Picture.';
        }

        return null;
    }

    getDebugState() {
        return {
            mode: this.mode,
            supported: this.isDocumentPipSupported(),
            topLevel: !this.isEmbeddedContext(),
            currentTaskId: this.currentTaskId,
            stepsLength: Array.isArray(this.steps) ? this.steps.length : 0,
            isSuppressedByWorkspace: this.isSuppressedByWorkspace,
            isActive: this.isActive,
            helperReady: this.helperReady,
            helperOpen: !!(this.helperWindow && !this.helperWindow.closed),
            helperPipActive: this.helperPipActive,
            helperTaskId: this.helperTaskId
        };
    }

    handleFloatingAction(action) {
        if (action === 'focus') {
            if (this.pipWindow) {
                this.pipWindow.focus();
            } else if (this.mode === 'main' && this.helperWindow && !this.helperWindow.closed) {
                this.postHelperMessage({ type: 'nebula-pip-helper:focus-pip' });
                this.helperWindow.focus();
            }
            return;
        }

        if (action === 'close') {
            this.closePip();
        }
    }

    updateFloatingTriggerVisibility() {
        if (!this.floatingTriggerContainer) return;

        const hasTaskContext = !!this.currentTaskId && Array.isArray(this.steps) && this.steps.length > 0;
        this.floatingTriggerContainer.classList.toggle('hidden', !hasTaskContext || this.isSuppressedByWorkspace);
    }

    updateFloatingTriggerState() {
        if (!this.floatingTriggerContainer || !this.floatingTriggerButton) return;

        const isActive = this.isPipActive();
        this.floatingTriggerContainer.classList.toggle('active', isActive);
        const label = isActive ? 'Picture-in-Picture active. Focus window.' : 'Open Picture-in-Picture mode';
        this.floatingTriggerButton.setAttribute('title', isActive ? 'Picture-in-Picture is active' : 'Open Picture-in-Picture mode');
        this.floatingTriggerButton.setAttribute('aria-label', label);
    }

    isEmbeddedContext() {
        try {
            return window.top !== window || !!window.frameElement;
        } catch (error) {
            return true;
        }
    }

    getTaskTitle(taskId) {
        if (this.currentTaskId === taskId && this.currentTaskTitle) {
            return this.currentTaskTitle;
        }

        if (window.templateData && Array.isArray(window.templateData.tasks)) {
            const task = window.templateData.tasks.find((candidate) => candidate && candidate.id === taskId);
            if (task && task.title) {
                return task.title;
            }
        }

        return 'Task Instructions';
    }

    getHelperPayload(taskId = this.currentTaskId, steps = this.steps, currentStepIndex = this.currentStepIndex) {
        return {
            type: 'nebula-pip-helper:update-task',
            payload: {
                taskId,
                taskTitle: this.getTaskTitle(taskId),
                steps: Array.isArray(steps) ? steps : [],
                currentStepIndex: typeof currentStepIndex === 'number' ? currentStepIndex : 0
            }
        };
    }

    syncHelperTaskContext() {
        if (!this.currentTaskId || !Array.isArray(this.steps) || this.steps.length === 0) {
            return;
        }

        this.postHelperMessage(this.getHelperPayload());
    }

    getHelperWindowUrl() {
        const baseUrl = window.location.href.split('#')[0];
        return new URL('pip-helper.html', baseUrl).toString();
    }

    openHelperWindow(taskId, steps, currentStepIndex = 0) {
        this.pendingHelperPayload = this.getHelperPayload(taskId, steps, currentStepIndex);

        if (this.helperWindow && !this.helperWindow.closed) {
            this.helperWindow.focus();
            this.postHelperMessage(this.pendingHelperPayload);
            return true;
        }

        const popupFeatures = [
            'popup=yes',
            'width=440',
            'height=600',
            'left=120',
            'top=120',
            'resizable=yes',
            'scrollbars=yes'
        ].join(',');

        const helperWindow = window.open(this.getHelperWindowUrl(), this.helperWindowName, popupFeatures);
        if (!helperWindow) {
            this.showErrorMessage('Popup window was blocked. Allow popups to use floating instructions in LMS.');
            return false;
        }

        this.helperWindow = helperWindow;
        this.helperReady = false;

        helperWindow.focus();
        return true;
    }

    postHelperMessage(message) {
        if (this.mode !== 'main') {
            return false;
        }

        if (!this.helperWindow || this.helperWindow.closed) {
            return false;
        }

        if (!this.helperReady) {
            if (message && message.type === 'nebula-pip-helper:update-task') {
                this.pendingHelperPayload = message;
            }
            return false;
        }

        this.helperWindow.postMessage(message, window.location.origin);
        return true;
    }

    setHelperPipState(isActive, taskId = null) {
        this.helperPipActive = !!isActive;
        this.helperTaskId = taskId || null;
        this.updateFloatingTriggerState();
    }

    handleHelperMessage(event) {
        if (this.mode !== 'main' || event.origin !== window.location.origin || !event.data || typeof event.data.type !== 'string') {
            return;
        }

        if (event.source !== this.helperWindow) {
            return;
        }

        if (event.data.type === 'nebula-pip-helper:ready') {
            this.helperReady = true;
            console.log('[PipManager] Helper window ready');
            if (this.pendingHelperPayload) {
                this.helperWindow.postMessage(this.pendingHelperPayload, window.location.origin);
                this.pendingHelperPayload = null;
            } else {
                this.syncHelperTaskContext();
            }
            return;
        }

        if (event.data.type === 'nebula-pip-helper:step-change') {
            const nextIndex = event.data.payload && typeof event.data.payload.currentStepIndex === 'number'
                ? event.data.payload.currentStepIndex
                : null;

            if (nextIndex !== null && nextIndex !== this.currentStepIndex) {
                this.currentStepIndex = nextIndex;
            }
            return;
        }

        if (event.data.type === 'nebula-pip-helper:status') {
            const payload = event.data.payload || {};
            this.setHelperPipState(!!payload.pipActive, payload.taskId || null);
            return;
        }

        if (event.data.type === 'nebula-pip-helper:closed') {
            this.helperReady = false;
            this.helperWindow = null;
            this.setHelperPipState(false, null);
            return;
        }
    }


    /**
     * Create the Picture-in-Picture window
     */
    async createPip(taskId, steps, initialStepIndex = 0, options = {}) {
        if (!this.isDocumentPipSupported()) {
            this.showUnsupportedMessage();
            return false;
        }

        if (this.isActive) {
            if (this.pipWindow) {
                this.pipWindow.focus();
            }
            this.updateFloatingTriggerState();
            return true;
        }

        if (this.mode === 'main' && options.userInitiated && this.isEmbeddedContext()) {
            const helperOpened = this.openHelperWindow(taskId, steps, initialStepIndex);
            if (helperOpened) {
                console.warn('[PipManager] Direct PiP blocked in embedded context, using helper window fallback.', this.getDebugState());
            }
            return helperOpened;
        }

        try {
            this.currentTaskId = taskId;
            this.currentTaskTitle = this.getTaskTitle(taskId);
            this.steps = steps || [];
            this.currentStepIndex = initialStepIndex;

            // Reset manual close flag since user is explicitly opening PiP
            this.userManuallyClosed = false;

            if (options.userInitiated) {
                console.log('[PipManager] Requesting PiP window', {
                    mode: this.mode,
                    source: options.source || 'unknown',
                    topLevel: !this.isEmbeddedContext(),
                    secureContext: window.isSecureContext,
                    location: window.location.href,
                    taskId: this.currentTaskId,
                    stepsLength: this.steps.length
                });
            }

            this.pipWindow = await window.documentPictureInPicture.requestWindow({
                width: 420,
                height: 520
            });

            if (options.userInitiated) {
                console.log('[PipManager] PiP window opened', {
                    mode: this.mode,
                    source: options.source || 'unknown',
                    taskId: this.currentTaskId
                });
            }

            this.isActive = true;
            this.updateFloatingTriggerState();

            this.injectPipStyles();
            this.renderPipContent();

            this.pipWindow.addEventListener('pagehide', () => {
                this.handlePipClose();
            });

            return true;

        } catch (error) {
            // Expected in auto-trigger mode when no recent user activation is available.
            // Fail silently: no toast and no console noise.
            if (error && error.name === 'NotAllowedError') {
                if (options.userInitiated) {
                    const embeddedMessage = this.isEmbeddedContext()
                        ? 'Picture-in-Picture was blocked because this course is running inside an embedded LMS window.'
                        : 'Picture-in-Picture was blocked by the browser. Try opening it directly from a fresh click.';

                    console.warn('[PipManager] requestWindow blocked:', {
                        source: options.source || 'unknown',
                        errorName: error.name,
                        errorMessage: error.message,
                        state: this.getDebugState()
                    });

                    if (this.mode === 'main' && this.isEmbeddedContext()) {
                        const helperOpened = this.openHelperWindow(taskId, steps, initialStepIndex);
                        if (helperOpened) {
                            return true;
                        }
                    }

                    this.showErrorMessage(embeddedMessage);
                }
                return false;
            }

            console.error('[PipManager] Failed to create PiP window:', error);

            if (error && error.name === 'NotSupportedError') {
                this.showUnsupportedMessage();
            } else {
                this.showErrorMessage('Failed to open Picture-in-Picture window.');
            }
            return false;
        }
    }

    /**
     * Inject styles into PiP window
     */
    injectPipStyles() {
        if (!this.pipWindow) return;

        const style = this.pipWindow.document.createElement('style');
        style.textContent = this.getPipStyles();
        this.pipWindow.document.head.appendChild(style);

        const fontLink = this.pipWindow.document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        this.pipWindow.document.head.appendChild(fontLink);
    }

    /**
     * Get CSS styles for PiP window - Compact & Modern Design
     */
    getPipStyles() {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: #f8fafc;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                color: #1e293b;
                overflow: hidden;
            }
            
            .pip-container {
                display: flex;
                flex-direction: column;
                height: 100vh;
                padding: 0;
            }
            
            /* Compact Header - Merged with Step Indicator */
            .pip-header {
                background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%);
                color: white;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-height: 36px;
            }
            
            .pip-close-btn {
                background: rgba(255,255,255,0.15);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
                font-size: 12px;
            }
            
            .pip-close-btn:hover {
                background: rgba(255,255,255,0.25);
            }
            
            .pip-step-badge {
                background: rgba(255,255,255,0.2);
                font-size: 11px;
                font-weight: 600;
                padding: 3px 10px;
                border-radius: 12px;
                letter-spacing: 0.3px;
            }
            
            /* Content Area */
            .pip-content {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 0;
            }
            
            /* Title Section */
            .pip-title-section {
                padding: 10px 12px;
                background: white;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .pip-step-title {
                font-size: 15px;
                font-weight: 600;
                color: #0f172a;
                margin-bottom: 4px;
                line-height: 1.4;
            }
            
            .pip-step-number {
                display: inline-block;
                background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%);
                color: white;
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 4px;
                margin-right: 6px;
            }
            
            .pip-instructions-section {
                padding: 10px 12px;
                background: white;
            }
            
            .pip-instructions {
                font-size: 13px;
                line-height: 1.65;
                color: #334155;
            }
            
            .pip-instructions p {
                margin-bottom: 10px;
            }
            
            .pip-instructions ul, .pip-instructions ol {
                margin: 8px 0;
                padding-left: 20px;
            }
            
            .pip-instructions li {
                margin-bottom: 6px;
            }
            
            .pip-instructions code {
                background: #f1f5f9;
                padding: 1px 5px;
                border-radius: 4px;
                font-size: 12px;
                font-family: 'Monaco', 'Menlo', monospace;
                color: #8b5cf6;
            }
            
            .pip-instructions pre {
                background: #1e293b;
                color: #e2e8f0;
                padding: 12px;
                border-radius: 10px;
                overflow-x: auto;
                margin: 12px 0;
                font-size: 12px;
                line-height: 1.5;
            }
            
            .pip-instructions pre code {
                background: transparent;
                padding: 0;
                color: inherit;
            }
            
            .pip-instructions strong {
                color: #0f172a;
            }
            
            .pip-instructions em {
                color: #64748b;
            }
            
            .pip-instructions h3 {
                font-size: 14px;
                font-weight: 600;
                color: #0f172a;
                margin-bottom: 8px;
            }
            
            .pip-instructions h4 {
                font-size: 13px;
                font-weight: 600;
                color: #334155;
                margin-bottom: 6px;
            }
            
            .pip-step-title {
                font-size: 15px;
                font-weight: 600;
                color: #0f172a;
                margin-bottom: 4px;
                line-height: 1.4;
            }
            
            .pip-step-number {
                display: inline-block;
                background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%);
                color: white;
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 4px;
                margin-right: 6px;
            }
            
            /* Asset Section */
            .pip-asset-section {
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .pip-asset-section.collapsed .pip-asset-wrapper {
                display: none;
            }
            
            .pip-asset-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                border-bottom: 1px solid #e2e8f0;
            }
            
            .pip-asset-label {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                font-weight: 500;
                color: #475569;
            }
            
            .pip-asset-label i {
                font-size: 12px;
                color: #64748b;
            }
            
            .pip-asset-toggle {
                background: white;
                border: 1px solid #cbd5e1;
                padding: 4px 10px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 10px;
                font-weight: 500;
                color: #64748b;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: all 0.2s;
            }
            
            .pip-asset-toggle:hover {
                background: #f8fafc;
                border-color: #94a3b8;
                color: #475569;
            }
            
            .pip-asset-toggle i {
                font-size: 10px;
                transition: transform 0.2s;
            }
            
            .pip-asset-section.collapsed .pip-asset-toggle i {
                transform: rotate(180deg);
            }
            
            .pip-asset-wrapper {
                background: #f1f5f9;
            }
            
            .pip-asset-container {
                width: 100%;
                max-height: 60vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
                background: #f8fafc;
            }
            
            .pip-asset-container img {
                width: 100%;
                height: auto;
                max-height: 60vh;
                object-fit: contain;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .pip-asset-container img:hover {
                transform: scale(1.02);
            }
            
            /* Video Player - Inline */
            .pip-video-container {
                width: 100%;
                position: relative;
                background: #000;
            }
            
            .pip-video-container video {
                width: 100%;
                height: auto;
                max-height: 60vh;
                object-fit: contain;
                display: block;
            }
            
            .pip-video-container iframe {
                width: 100%;
                height: auto;
                min-height: 200px;
                max-height: 60vh;
                aspect-ratio: 16/9;
                border: none;
            }
            
            .pip-asset-fallback {
                padding: 12px;
                text-align: center;
                color: #64748b;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                background: #f1f5f9;
            }
            
            .pip-asset-fallback i {
                color: #94a3b8;
            }
            
            /* Image Carousel */
            .pip-carousel {
                position: relative;
                width: 100%;
            }
            
            .pip-carousel-track {
                display: flex;
                transition: transform 0.3s ease;
            }
            
            .pip-carousel-slide {
                min-width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .pip-carousel-nav {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 12px;
                background: #e2e8f0;
                font-size: 11px;
                color: #475569;
            }
            
            .pip-carousel-btn {
                background: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                color: #475569;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .pip-carousel-btn:hover {
                background: #f8fafc;
            }
            
            /* Instructions Section */
            .pip-instructions-section {
                padding: 12px;
                background: white;
            }
            
            .pip-instructions {
                font-size: 12px;
                line-height: 1.6;
                color: #334155;
            }
            
            .pip-instructions p {
                margin-bottom: 8px;
            }
            
            .pip-instructions h1 {
                font-size: 16px;
                font-weight: 700;
                color: #0f172a;
                margin-top: 12px;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 2px solid #e2e8f0;
            }
            
            .pip-instructions h2 {
                font-size: 14px;
                font-weight: 600;
                color: #1e293b;
                margin-top: 10px;
                margin-bottom: 6px;
                padding-bottom: 6px;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .pip-instructions h3 {
                font-size: 13px;
                font-weight: 600;
                color: #334155;
                margin-top: 8px;
                margin-bottom: 4px;
            }
            
            .pip-instructions ul, .pip-instructions ol {
                margin: 8px 0;
                padding-left: 20px;
            }
            
            .pip-instructions li {
                margin-bottom: 4px;
                line-height: 1.5;
            }
            
            .pip-instructions li::marker {
                color: #14b8a6;
                margin-right: 8px;
            }
            
            .pip-instructions code {
                background: #f1f5f9;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-family: 'Monaco', 'Menlo', monospace;
                color: #8b5cf6;
            }
            
            .pip-instructions pre {
                background: #1e293b;
                color: #e2e8f0;
                padding: 12px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 10px 0;
                font-size: 11px;
                line-height: 1.4;
            }
            
            .pip-instructions pre code {
                background: transparent;
                padding: 0;
                color: inherit;
            }
            
            .pip-instructions strong {
                color: #0f172a;
            }
            
            .pip-instructions em {
                color: #64748b;
            }
            
            .pip-instructions a {
                color: #14b8a6;
                text-decoration: underline;
            }
            
            .pip-instructions a:hover {
                color: #0d9488;
            }
            
            .pip-instructions blockquote {
                margin: 10px 0;
                padding: 10px 12px;
                border-left: 3px solid #14b8a6;
                background: #f8fafc;
                color: #475569;
                font-style: italic;
            }
            
            /* Collapsible Sections */
            .pip-collapsible-section {
                border-top: 1px solid #e2e8f0;
                background: white;
            }
            
            .pip-reveal-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                color: #475569;
                margin: 8px 12px;
            }
            
            .pip-reveal-btn:hover {
                background: #f1f5f9;
                border-color: #cbd5e1;
            }
            
            .pip-reveal-btn.code-btn {
                color: #7c3aed;
            }
            
            .pip-reveal-btn.code-btn:hover {
                background: #f5f3ff;
                border-color: #c4b5fd;
            }
            
            .pip-reveal-btn.hint-btn {
                color: #d97706;
            }
            
            .pip-reveal-btn.hint-btn:hover {
                background: #fffbeb;
                border-color: #fcd34d;
            }
            
            .pip-reveal-btn.active {
                background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%);
                color: white;
                border-color: transparent;
            }

            .pip-reveal-btn.active:hover {
                background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%);
                color: white;
                border-color: transparent;
            }
            
            .pip-reveal-btn i {
                font-size: 11px;
            }
            
            .pip-collapsible-content {
                display: none;
                padding: 0 12px 12px;
                animation: slideDown 0.2s ease;
            }
            
            .pip-collapsible-content.visible {
                display: block;
            }
            
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            /* Code Block in Collapsible */
            .pip-code-block {
                background: #1e293b;
                border-radius: 8px;
                padding: 10px;
                overflow-x: auto;
                position: relative;
            }
            
            .pip-code-block pre {
                margin: 0;
                color: #e2e8f0;
                font-size: 10px;
                line-height: 1.5;
                font-family: 'Monaco', 'Menlo', monospace;
                max-height: 220px;
                overflow-y: auto;
            }
            
            .pip-code-lang {
                position: absolute;
                top: 6px;
                right: 6px;
                font-size: 9px;
                color: #64748b;
                background: #334155;
                padding: 2px 6px;
                border-radius: 3px;
                text-transform: uppercase;
            }
            
            .pip-copy-btn {
                position: absolute;
                bottom: 6px;
                right: 6px;
                background: #475569;
                border: none;
                color: #e2e8f0;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 9px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: background 0.2s;
            }
            
            .pip-copy-btn:hover {
                background: #64748b;
            }
            
            .pip-copy-btn.copied {
                background: #22c55e;
            }
            
            /* Hint Content */
            .pip-hint-content {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-radius: 8px;
                padding: 10px;
                font-size: 12px;
                line-height: 1.5;
                color: #78350f;
                box-sizing: border-box;
                max-width: 100%;
                overflow-x: auto;
                overflow-wrap: anywhere;
                word-break: break-word;
            }

            .pip-hint-content * {
                box-sizing: border-box;
                max-width: 100%;
            }
            
            .pip-hint-content code {
                background: rgba(255,255,255,0.5);
                padding: 1px 4px;
                border-radius: 3px;
                font-size: 11px;
            }

            .pip-hint-content ul,
            .pip-hint-content ol {
                margin: 6px 0 6px 4px;
                padding-left: 14px;
            }

            .pip-hint-content pre {
                max-width: 100%;
                overflow-x: auto;
                white-space: pre-wrap;
                word-break: break-word;
            }
            
            /* Navigation - Ultra Compact */
            .pip-navigation {
                background: white;
                padding: 4px 8px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-height: 36px;
            }
            
            .pip-nav-btn {
                background: transparent;
                border: none;
                color: #64748b;
                min-width: 28px;
                height: 28px;
                padding: 0 8px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.2s;
                font-size: 11px;
                font-weight: 600;
            }
            
            .pip-nav-btn:hover:not(:disabled) {
                background: #f1f5f9;
                color: #14b8a6;
            }
            
            .pip-nav-btn:disabled {
                opacity: 0.3;
                cursor: not-allowed;
            }
            
            .pip-progress-container {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 6px;
            }
            
            .pip-progress-bar {
                width: 100%;
                max-width: 100px;
                height: 3px;
                background: #e2e8f0;
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            }
            
            .pip-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #14b8a6, #8b5cf6);
                border-radius: 2px;
                transition: width 0.3s ease;
            }
            
            .pip-progress-text {
                font-size: 10px;
                color: #94a3b8;
                margin-left: 6px;
                white-space: nowrap;
            }
            
            /* Empty State */
            .pip-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                flex: 1;
                color: #94a3b8;
                text-align: center;
                padding: 40px;
            }
            
            .pip-empty i {
                font-size: 40px;
                margin-bottom: 12px;
                opacity: 0.5;
            }
            
            .pip-empty-title {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .pip-empty-text {
                font-size: 12px;
            }
        `;
    }

    /**
     * Render content in the PiP window - Enhanced Compact Design
     */
    renderPipContent() {
        if (!this.pipWindow) return;

        const step = this.steps[this.currentStepIndex];
        const totalSteps = this.steps.length;

        if (!step) {
            this.pipWindow.document.body.innerHTML = `
                <div class="pip-container">
                    <div class="pip-empty">
                        <i class="fas fa-inbox"></i>
                        <div class="pip-empty-title">No Steps Available</div>
                        <div class="pip-empty-text">This task has no instruction steps.</div>
                    </div>
                </div>
            `;
            return;
        }

        const stepNumber = this.currentStepIndex + 1;
        const progressPercent = ((stepNumber / totalSteps) * 100).toFixed(0);
        const stepTitle = this.escapeHtml(step.title || `Step ${stepNumber}`);

        // Render each section
        const assetHtml = this.renderAssetSection(step);
        const instructionsHtml = this.renderMarkdown(step.instructions || 'No instructions provided.');
        const codeHtml = this.renderCodeSection(step);
        const hintHtml = this.renderHintSection(step);

        this.pipWindow.document.body.innerHTML = `
            <div class="pip-container">
                <!-- Scrollable Content -->
                <div class="pip-content">
                    <!-- Title Section with Step Number -->
                    <div class="pip-title-section">
                        <div class="pip-step-title">
                            <span class="pip-step-number">${stepNumber}.</span>
                            ${stepTitle}
                        </div>
                    </div>
                    
                    <!-- Asset Section (Image/Video) -->
                    ${assetHtml}
                    
                    <!-- Instructions Section -->
                    <div class="pip-instructions-section">
                        <div class="pip-instructions">${instructionsHtml}</div>
                    </div>
                    
                    <!-- Code Section (Collapsible) -->
                    ${codeHtml}
                    
                    <!-- Hint Section (Collapsible) -->
                    ${hintHtml}
                </div>
                
                <!-- Ultra-Compact Navigation -->
                <div class="pip-navigation">
                    <button class="pip-nav-btn" onclick="window.opener.pipManager.prevStep()" ${this.currentStepIndex === 0 ? 'disabled' : ''} title="Previous">
                        <i class="fas fa-chevron-left"></i>
                        <span>Prev</span>
                    </button>
                    
                    <div class="pip-progress-container">
                        <div class="pip-progress-bar">
                            <div class="pip-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span class="pip-progress-text">${stepNumber}/${totalSteps}</span>
                    </div>
                    
                    <button class="pip-nav-btn" onclick="window.opener.pipManager.nextStep()" ${this.currentStepIndex >= totalSteps - 1 ? 'disabled' : ''} title="Next">
                        <span>Next</span>
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        // Setup resize observer for responsive asset
        this.setupResizeObserver();
    }

    /**
     * Get global task number based on task ID
     */
    getGlobalTaskNumber() {
        // Try to get from window.templateData
        if (window.templateData && window.templateData.tasks) {
            const taskIndex = window.templateData.tasks.findIndex(t => t.id === this.currentTaskId);
            return taskIndex !== -1 ? taskIndex + 1 : 1;
        }
        return 1;
    }

    /**
     * Render asset section (image/video) with collapsible header
     */
    renderAssetSection(step) {
        if (!step.hasMedia) return '';

        let assetContent = '';
        let assetType = 'media';
        let assetIcon = 'fa-photo-video';

        // Video takes priority
        if (step.hasVideo && step.video) {
            assetContent = this.renderVideoAsset(step.video);
            assetType = 'video';
            assetIcon = 'fa-video';
        }
        // Images
        else if (step.images && step.images.length > 0) {
            if (step.hasMultipleImages) {
                assetContent = this.renderImageCarousel(step.images);
                assetType = `${step.images.length} images`;
            } else {
                assetContent = this.renderSingleImage(step.images[0]);
                assetType = 'image';
            }
            assetIcon = 'fa-image';
        }

        if (!assetContent) return '';

        return `
            <div class="pip-asset-section" id="pip-asset">
                <div class="pip-asset-header">
                    <span class="pip-asset-label">
                        <i class="fas ${assetIcon}"></i>
                        <span>${assetType.charAt(0).toUpperCase() + assetType.slice(1)}</span>
                    </span>
                    <button class="pip-asset-toggle" onclick="window.opener.pipManager.toggleAsset(this)">
                        <i class="fas fa-chevron-up"></i>
                        <span>Hide</span>
                    </button>
                </div>
                <div class="pip-asset-wrapper">
                    ${assetContent}
                </div>
            </div>
        `;
    }

    /**
     * Render single image asset
     */
    renderSingleImage(image) {
        if (!image || !image.src) return '';

        return `
            <div class="pip-asset-container">
                <img src="${this.escapeHtml(image.src)}" 
                     alt="${this.escapeHtml(image.alt || '')}" 
                     onclick="window.open('${this.escapeHtml(image.src)}', '_blank')" 
                     title="Click to open full size">
            </div>
        `;
    }

    /**
     * Render image carousel for multiple images
     */
    renderImageCarousel(images) {
        if (!images || images.length === 0) return '';

        const slidesHtml = images.map((img, idx) => `
            <div class="pip-carousel-slide">
                <img src="${this.escapeHtml(img.src)}" 
                     alt="${this.escapeHtml(img.alt || '')}"
                     onclick="window.open('${this.escapeHtml(img.src)}', '_blank')" 
                     title="Click to open full size">
            </div>
        `).join('');

        return `
            <div class="pip-carousel">
                <div class="pip-asset-container">
                    <div class="pip-carousel-track" id="pipCarouselTrack">
                        ${slidesHtml}
                    </div>
                </div>
            </div>
            <div class="pip-carousel-nav">
                <button class="pip-carousel-btn" onclick="window.opener.pipManager.carouselPrev()">
                    <i class="fas fa-chevron-left"></i> Prev
                </button>
                <span id="pipCarouselIndicator">1 / ${images.length}</span>
                <button class="pip-carousel-btn" onclick="window.opener.pipManager.carouselNext()">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    /**
     * Render video asset with inline playback
     */
    renderVideoAsset(video) {
        if (!video || !video.src) return '';

        // Handle embedded videos (YouTube, Vimeo, Loom)
        if (video.type === 'embed' || video.embedType) {
            return this.renderEmbeddedVideo(video);
        }

        // Handle uploaded videos (MP4, WebM) - inline playback
        return `
            <div class="pip-video-container">
                <video id="pipVideoPlayer" 
                       controls 
                       width="100%" 
                        preload="metadata"
                        style="max-height: 60vh; background: #000;">
                     <source src="${this.escapeHtml(video.src)}" type="video/mp4">
                     Your browser does not support the video tag.
                 </video>
            </div>
        `;
    }

    /**
     * Render embedded video (YouTube, Vimeo, Loom) via iframe
     */
    renderEmbeddedVideo(video) {
        const embedUrl = this.getEmbedUrl(video.src, video.embedType);

        if (!embedUrl) {
            // Fallback: show link to open externally
            return `
                <div class="pip-asset-container" style="padding: 20px; background: #1e293b;">
                    <div style="text-align: center; color: white;">
                        <i class="fas fa-video" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;"></i>
                        <p style="font-size: 12px; margin-bottom: 12px;">External video</p>
                        <a href="${this.escapeHtml(video.src)}" target="_blank" 
                           style="color: #14b8a6; font-size: 12px; text-decoration: underline;">
                            Open video
                        </a>
                    </div>
                </div>
            `;
        }

        return `
            <div class="pip-video-container">
                <iframe src="${embedUrl}" 
                        width="100%" 
                        height="auto"
                        style="min-height: 200px; max-height: 60vh; aspect-ratio: 16/9;"
                        frameborder="0" 
                        allowfullscreen
                        allow="autoplay; encrypted-media; picture-in-picture">
                </iframe>
            </div>
        `;
    }

    /**
     * Convert video URL to embed URL for iframe
     */
    getEmbedUrl(url, embedType) {
        if (!url) return null;

        try {
            const urlObj = new URL(url);

            // YouTube
            if (embedType === 'youtube' || urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                let videoId = '';
                if (urlObj.hostname === 'youtu.be') {
                    videoId = urlObj.pathname.slice(1);
                } else {
                    videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
                }
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
                }
            }

            // Vimeo
            if (embedType === 'vimeo' || urlObj.hostname.includes('vimeo.com')) {
                const videoId = urlObj.pathname.split('/').filter(p => p).pop();
                if (videoId) {
                    return `https://player.vimeo.com/video/${videoId}`;
                }
            }

            // Loom
            if (embedType === 'loom' || urlObj.hostname.includes('loom.com')) {
                const match = url.match(/loom\.com\/share\/([a-f0-9]+)/i);
                if (match && match[1]) {
                    return `https://www.loom.com/embed/${match[1]}`;
                }
            }
        } catch (e) {
            // Invalid URL
        }

        return null;
    }

    /**
     * Open video in new tab
     */
    openVideoInNewTab(src) {
        if (src) {
            window.open(src, '_blank');
        }
    }

    /**
     * Toggle asset visibility
     */
    toggleAsset(button) {
        if (!this.pipWindow) return;

        const assetSection = this.pipWindow.document.getElementById('pip-asset');
        if (assetSection) {
            const isCollapsed = assetSection.classList.toggle('collapsed');

            if (button) {
                const span = button.querySelector('span');
                if (span) {
                    span.textContent = isCollapsed ? 'Show' : 'Hide';
                }

                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-up', !isCollapsed);
                    icon.classList.toggle('fa-chevron-down', isCollapsed);
                }
            }
        }
    }

    /**
     * Pause current video when navigating
     */
    pauseCurrentVideo() {
        if (!this.pipWindow) return;

        // Pause HTML5 video element
        const video = this.pipWindow.document.getElementById('pipVideoPlayer');
        if (video && !video.paused) {
            video.pause();
        }
    }

    /**
     * Render code section (collapsible)
     */
    renderCodeSection(step) {
        if (!step.code || !step.code.content) return '';

        const language = step.code.language || 'code';
        const escapedCode = this.escapeHtml(step.code.content);
        const codeId = `pipCode${this.currentStepIndex}`;

        return `
            <div class="pip-collapsible-section">
                <button class="pip-reveal-btn code-btn" onclick="window.opener.pipManager.toggleCode('${codeId}', this)">
                    <i class="fas fa-code"></i>
                    <span>View Code</span>
                </button>
                <div class="pip-collapsible-content" id="${codeId}">
                    <div class="pip-code-block">
                        <span class="pip-code-lang">${language}</span>
                        <pre><code>${escapedCode}</code></pre>
                        <button class="pip-copy-btn" onclick="window.opener.pipManager.copyCode('${codeId}', this)">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render hint section (collapsible)
     */
    renderHintSection(step) {
        if (!step.hint || !step.hint.text) return '';

        const hintId = `pipHint${this.currentStepIndex}`;
        const hintText = this.renderMarkdown(step.hint.text);

        let hintCodeHtml = '';
        if (step.hint.code && step.hint.code.content) {
            hintCodeHtml = `
                <div style="margin-top: 8px;">
                    <div class="pip-code-block">
                        <pre><code>${this.escapeHtml(step.hint.code.content)}</code></pre>
                    </div>
                </div>
            `;
        }

        return `
            <div class="pip-collapsible-section">
                <button class="pip-reveal-btn hint-btn" onclick="window.opener.pipManager.toggleHint('${hintId}', this)">
                    <i class="fas fa-lightbulb"></i>
                    <span>Reveal Hint</span>
                </button>
                <div class="pip-collapsible-content" id="${hintId}">
                    <div class="pip-hint-content">
                        ${hintText}
                        ${hintCodeHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup resize observer for responsive asset display
     */
    setupResizeObserver() {
        if (!this.pipWindow) return;

        const assetSection = this.pipWindow.document.getElementById('pip-asset');
        const assetFallback = this.pipWindow.document.querySelector('.pip-asset-hidden');

        if (!assetSection) return;

        const minWidth = 300;

        const checkWidth = () => {
            const width = this.pipWindow.document.body.offsetWidth;
            if (width < minWidth) {
                assetSection.style.display = 'none';
                if (assetFallback) assetFallback.style.display = 'flex';
            } else {
                assetSection.style.display = 'block';
                if (assetFallback) assetFallback.style.display = 'none';
            }
        };

        // Initial check
        checkWidth();

        // Create resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.resizeObserver = new this.pipWindow.ResizeObserver(() => {
            checkWidth();
        });

        this.resizeObserver.observe(this.pipWindow.document.body);
    }

    /**
     * Toggle code visibility
     */
    toggleCode(codeId, button) {
        if (!this.pipWindow) return;

        const content = this.pipWindow.document.getElementById(codeId);
        if (content) {
            const isVisible = content.classList.contains('visible');
            content.classList.toggle('visible');

            if (button) {
                button.classList.toggle('active');
                const span = button.querySelector('span');
                if (span) {
                    span.textContent = isVisible ? 'View Code' : 'Hide Code';
                }
            }
        }
    }

    /**
     * Toggle hint visibility
     */
    toggleHint(hintId, button) {
        if (!this.pipWindow) return;

        const content = this.pipWindow.document.getElementById(hintId);
        if (content) {
            const isVisible = content.classList.contains('visible');
            content.classList.toggle('visible');

            if (button) {
                button.classList.toggle('active');
                const span = button.querySelector('span');
                if (span) {
                    span.textContent = isVisible ? 'Reveal Hint' : 'Hide Hint';
                }
            }
        }
    }

    /**
     * Copy code to clipboard
     */
    async copyCode(codeId, button) {
        if (!this.pipWindow) return;
        
        const codeElement = this.pipWindow.document.querySelector(`#${codeId} code`);
        if (codeElement) {
            const textToCopy = codeElement.textContent || '';

            try {
                if (this.pipWindow.navigator && this.pipWindow.navigator.clipboard && this.pipWindow.navigator.clipboard.writeText) {
                    await this.pipWindow.navigator.clipboard.writeText(textToCopy);
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(textToCopy);
                } else {
                    throw new Error('Clipboard API unavailable');
                }

                if (button) {
                    button.classList.add('copied');
                    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    }, 2000);
                }
                return;
            } catch (err) {
                const textarea = this.pipWindow.document.createElement('textarea');
                textarea.value = textToCopy;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                this.pipWindow.document.body.appendChild(textarea);
                textarea.select();

                const copied = this.pipWindow.document.execCommand('copy');
                this.pipWindow.document.body.removeChild(textarea);

                if (copied && button) {
                    button.classList.add('copied');
                    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    }, 2000);
                }
            }
        }
    }

    /**
     * Carousel navigation - previous image
     */
    carouselPrev() {
        if (!this.pipWindow) return;

        const track = this.pipWindow.document.getElementById('pipCarouselTrack');
        const indicator = this.pipWindow.document.getElementById('pipCarouselIndicator');
        if (!track) return;

        const totalSlides = track.children.length;
        this.carouselIndex = ((this.carouselIndex || 0) - 1 + totalSlides) % totalSlides;

        track.style.transform = `translateX(-${this.carouselIndex * 100}%)`;
        if (indicator) {
            indicator.textContent = `${this.carouselIndex + 1} / ${totalSlides}`;
        }
    }

    /**
     * Carousel navigation - next image
     */
    carouselNext() {
        if (!this.pipWindow) return;

        const track = this.pipWindow.document.getElementById('pipCarouselTrack');
        const indicator = this.pipWindow.document.getElementById('pipCarouselIndicator');
        if (!track) return;

        const totalSlides = track.children.length;
        this.carouselIndex = ((this.carouselIndex || 0) + 1) % totalSlides;

        track.style.transform = `translateX(-${this.carouselIndex * 100}%)`;
        if (indicator) {
            indicator.textContent = `${this.carouselIndex + 1} / ${totalSlides}`;
        }
    }

    /**
     * Simple markdown renderer for instructions
     */
    renderMarkdown(text) {
        if (!text) return '';

        let html = this.escapeHtml(text);

        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<li>$2</li>');
        html = html.replace(/^- (.*)$/gm, '<li>$1</li>');

        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        html = html.replace(/<\/ul>\s*<ul>/g, '');

        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p><br><\/p>/g, '');

        return html;
    }

    /**
     * Escape HTML entities
     */
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Navigate to next step
     */
    nextStep() {
        this.pauseCurrentVideo();
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            this.carouselIndex = 0;
            this.renderPipContent();
            this.syncStepChange();
        }
    }

    /**
     * Navigate to previous step
     */
    prevStep() {
        this.pauseCurrentVideo();
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            this.carouselIndex = 0;
            this.renderPipContent();
            this.syncStepChange();
        }
    }

    /**
     * Go to specific step
     */
    goToStep(index) {
        if (index >= 0 && index < this.steps.length) {
            this.currentStepIndex = index;
            this.renderPipContent();
            this.syncStepChange();
        }
    }

    /**
     * Sync step change with main window (for future enhancements)
     */
    syncStepChange() {
        const event = new CustomEvent('pipStepChange', {
            detail: {
                taskId: this.currentTaskId,
                stepIndex: this.currentStepIndex
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Handle PiP window close
     */
    handlePipClose() {
        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        this.isActive = false;
        this.pipWindow = null;
        this.carouselIndex = 0;
        this.updateFloatingTriggerState();

        const event = new CustomEvent('pipClosed', {
            detail: { taskId: this.currentTaskId }
        });
        window.dispatchEvent(event);

        if (this.mode === 'main' && this.helperWindow && !this.helperWindow.closed) {
            this.postHelperMessage(this.getHelperPayload());
        }
    }

    /**
     * Close PiP window programmatically
     */
    closePip() {
        if (this.pipWindow) {
            this.pipWindow.close();
        } else if (this.mode === 'main' && this.helperWindow && !this.helperWindow.closed) {
            this.postHelperMessage({ type: 'nebula-pip-helper:close-pip' });
        } else {
            this.isActive = false;
            this.updateFloatingTriggerState();
        }
    }

    /**
     * Show unsupported browser message
     */
    showUnsupportedMessage() {
        const modal = document.createElement('div');
        modal.id = 'pip-unsupported-modal';
        modal.innerHTML = `
            <div class="pip-modal-overlay" onclick="pipManager.closeModal('pip-unsupported-modal')"></div>
            <div class="pip-modal-content">
                <div class="pip-modal-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <h3 class="pip-modal-title">Picture-in-Picture Not Available</h3>
                <p class="pip-modal-text">
                    Your browser doesn't support the Picture-in-Picture feature. 
                    For the best experience, use <strong>Google Chrome</strong> or 
                    <strong>Microsoft Edge</strong> (version 116 or later).
                </p>
                <div class="pip-modal-actions">
                    <a href="https://www.google.com/chrome/" target="_blank" class="pip-modal-btn primary">
                        <i class="fab fa-chrome"></i> Download Chrome
                    </a>
                    <button class="pip-modal-btn secondary" onclick="pipManager.closeModal('pip-unsupported-modal')">
                        Got it
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Show error message
     */
    showErrorMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'pip-error-toast';
        toast.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Close modal by ID
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 200);
        }
    }

    /**
     * Check if PiP is currently active
     */
    isPipActive() {
        if (this.isActive && this.pipWindow !== null) {
            return true;
        }

        if (this.mode === 'main' && this.helperPipActive) {
            return true;
        }

        return false;
    }

    /**
     * Simple markdown renderer for instructions - Uses marked.js library
     */
    renderMarkdown(text) {
        if (!text) return '';

        const isExternalUrl = (url) => /^https?:\/\//i.test((url || '').trim());
        const addExternalLinkAttributes = (html) => {
            if (!html || !html.includes('<a ')) {
                return html;
            }

            let updatedHtml = html;

            if (!/\btarget=/i.test(updatedHtml)) {
                updatedHtml = updatedHtml.replace('<a ', '<a target="_blank" ');
            }

            if (/\brel=/i.test(updatedHtml)) {
                updatedHtml = updatedHtml.replace(/rel="([^"]*)"/i, (match, relValue) => {
                    const parts = relValue.split(/\s+/).filter(Boolean);

                    if (!parts.includes('noopener')) {
                        parts.push('noopener');
                    }

                    if (!parts.includes('noreferrer')) {
                        parts.push('noreferrer');
                    }

                    return `rel="${parts.join(' ')}"`;
                });
            } else {
                updatedHtml = updatedHtml.replace('<a ', '<a rel="noopener noreferrer" ');
            }

            return updatedHtml;
        };

        // Use marked.js library if available (loaded in main page)
        if (typeof marked !== 'undefined') {
            try {
                const renderer = new marked.Renderer();
                const defaultLinkRenderer = renderer.link.bind(renderer);

                renderer.link = (href, title, text) => {
                    const renderedLink = defaultLinkRenderer(href, title, text);
                    return isExternalUrl(href) ? addExternalLinkAttributes(renderedLink) : renderedLink;
                };

                // Configure marked options for consistent rendering
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    renderer
                });
                return marked.parse(text);
            } catch (e) {
                console.warn('Marked.js error:', e);
                return `<p>${this.escapeHtml(text)}</p>`;
            }
        }

        // Fallback: basic HTML conversion
        let html = this.escapeHtml(text);

        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="pip-code"><code>${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Links
        html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        html = html.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Numbered lists
        html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<li>$2</li>');

        // Bullet lists
        html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
        html = html.replace(/^\* (.*)$/gm, '<li>$1</li>');

        // Wrap consecutive list items in ul
        html = html.replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$1</ul>');
        html = html.replace(/<\/ul>\s*<ul>/g, '');

        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = `<p>${html}</p>`;

        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p><br><\/p>/g, '');

        return html;
    }

    /**
     * Update steps (for dynamic content updates)
     */
    updateSteps(steps) {
        this.steps = steps || [];
        if (this.isActive) {
            this.renderPipContent();
        }

        if (this.mode === 'main') {
            this.syncHelperTaskContext();
        }
    }
}

window.PipManager = PipManager;

if (!window.__NEBULA_PIP_HELPER_PAGE__) {
    const pipManager = new PipManager();
    window.pipManager = pipManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PipManager;
}
