class PageRenderer {
    constructor() {
        this.initialized = false;
        this.renderingInProgress = false;
        this.currentPage = null;

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        if (this.initialized) return;

        // Setup event listeners for page changes
        this.setupEventListeners();

        this.initialized = true;
        console.log('Page renderer initialized');

        // Make this available globally
        window.pageRenderer = this;
    }

    setupEventListeners() {
        // Listen to pagination system events
        document.addEventListener('pageChanged', (event) => {
            const { toPage } = event.detail;
            this.handlePageChange(toPage);
        });

        // Listen to content loading events
        document.addEventListener('paginationSystemReady', () => {
            console.log('Page renderer ready for pagination system');
        });
    }

    handlePageChange(pageId) {
        // This is handled by the pagination system calling renderCurrentPage
        // Keeping this method for potential future use
    }

    renderCurrentPage(page) {
        if (this.renderingInProgress) {
            console.warn('Rendering already in progress, skipping');
            return;
        }

        this.renderingInProgress = true;
        this.currentPage = page;

        const contentContainer = document.getElementById('current-page-content');
        if (!contentContainer) {
            console.error('Current page content container not found');
            this.renderingInProgress = false;
            return;
        }

        // Show loading state
        this.showLoadingState(contentContainer);

        // Add page transition classes
        contentContainer.classList.add('page-transitioning');

        try {
            let content = '';

            switch (page.type) {
                case 'task':
                    content = this.renderTaskPage(page);
                    break;
                default:
                    content = this.renderErrorPage('Unknown page type: ' + page.type);
            }

            // Render content after a small delay for smooth transition
            setTimeout(() => {
                contentContainer.innerHTML = content;
                contentContainer.classList.remove('page-transitioning');
                contentContainer.classList.add('page-transition-complete');

                // Scroll to top of page container when new page renders
                const pageContainer = document.getElementById('page-container');
                if (pageContainer) {
                    pageContainer.scrollTop = 0;
                }

                // Initialize page-specific functionality
                this.initializePageFunctionality(page);

                // Dispatch page rendered event
                document.dispatchEvent(new CustomEvent('pageRendered', {
                    detail: { pageId: page.id, pageType: page.type }
                }));

                this.renderingInProgress = false;
            }, 150);

        } catch (error) {
            console.error('Error rendering page:', error);
            contentContainer.innerHTML = this.renderErrorPage(error.message);
            contentContainer.classList.remove('page-transitioning');
            this.renderingInProgress = false;
        }
    }

    showLoadingState(container) {
        container.innerHTML = `
            <div class="page-loading">
                <div class="page-loading-spinner"></div>
                <p class="mt-4 text-gray-600">Loading content...</p>
            </div>
        `;
    }

    renderTaskPage(page) {
        var task = page.data && page.data.task;
        if (!task) {
            return this.renderErrorPage('Task data not found');
        }

        var taskNumber = 1;
        if (window.templateData && window.templateData.tasks) {
            var idx = window.templateData.tasks.findIndex(function(t) { return t.id === task.id; });
            if (idx >= 0) taskNumber = idx + 1;
        }

        var isCompleted = window.learningPathState &&
            window.learningPathState.completedTasks &&
            window.learningPathState.completedTasks.has(task.id);

        var content = '';

        content += '<div class="task-page-header mb-8">';
        content += '<div class="flex items-center justify-between">';
        content += '<div>';
        content += '<div class="flex items-center space-x-3 mb-2">';
        content += '<span class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-purple-400 text-white font-bold text-lg shadow-md">' + taskNumber + '</span>';
        content += '<h2 class="text-2xl font-bold text-gray-900">' + (task.title || 'Task') + '</h2>';
        content += '</div>';
        content += '</div>';
        content += '<div class="flex items-center space-x-3">';
        if (isCompleted) {
            content += '<span class="inline-flex items-center px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold"><i class="fas fa-check-circle mr-1"></i>Completed</span>';
        }
        content += '</div></div></div>';

        if (window.taskRenderer) {
            content += window.taskRenderer.renderTask(task, [], null);
        } else {
            content += '<div class="p-8 text-center text-gray-500">Task renderer not available</div>';
        }

        return content;
    }

    renderErrorPage(message) {
        return `
            <div class="page-error page-content">
                <div class="page-error-icon">⚠️</div>
                <h2 class="text-2xl font-semibold text-red-600 mb-4">Content Loading Error</h2>
                <p class="text-gray-600 mb-6">${message}</p>
                <p class="text-sm text-gray-500">Use the navigation controls at the bottom of the screen to continue.</p>
            </div>
        `;
    }

    initializePageFunctionality(page) {
        this.updatePipContextForPage(page);

        if (page.type === 'task') {
            this.initializeTaskPage(page);
        }

        this.managePageFocus();
    }

    updatePipContextForPage(page) {
        if (!window.pipManager) return;

        // PiP auto-trigger should only be armed on task pages.
        if (!page || page.type !== 'task') {
            window.pipManager.clearTaskContext(true);
            return;
        }

        const task = page.data && page.data.task;
        if (!task || !task.id) {
            window.pipManager.clearTaskContext(true);
            return;
        }

        const pipSteps = (window.pipStepsRegistry && window.pipStepsRegistry[task.id]) || [];
        if (!Array.isArray(pipSteps) || pipSteps.length === 0) {
            // Do not retain stale task context when current task has no PiP content.
            window.pipManager.clearTaskContext(true);
            return;
        }

        const preferredStepIndex = window.pipManager.currentTaskId === task.id
            ? Math.min(window.pipManager.currentStepIndex || 0, pipSteps.length - 1)
            : 0;

        window.pipManager.setTaskContext(task.id, pipSteps, preferredStepIndex, task.title || 'Task Instructions');
    }

    initializeTaskPage(page) {
        var task = page.data.task;

        if (window.taskRenderer) {
            setTimeout(function() {
                try {
                    window.taskRenderer.initializeImageCarousels();
                    window.taskRenderer.initializeVideoPlayers();
                    window.taskRenderer.initializeCodeHighlighting();
                    window.taskRenderer.setupTaskEventListeners(task);
                    window.taskRenderer.initializeTaskUploadState(task.id);
                } catch (error) {
                    console.error('Error initializing task components:', error);
                }
            }, 100);
        }
    }

    managePageFocus() {
        // Set focus to the main content for screen readers
        const mainContent = document.getElementById('current-page-content');
        if (mainContent) {
            // Remove focus from any interactive elements
            const activeElement = document.activeElement;
            if (activeElement && activeElement !== document.body) {
                activeElement.blur();
            }

            // Set focus to the main content area (but not show visible focus)
            mainContent.setAttribute('tabindex', '-1');

            // Prevent scrolling when focusing
            mainContent.scrollIntoView({ block: 'start', behavior: 'instant' });
            mainContent.focus({ preventScroll: true });

            // Remove tabindex after focus is set
            setTimeout(() => {
                mainContent.removeAttribute('tabindex');
            }, 100);
        }

        // Don't auto-focus on buttons to prevent unwanted scrolling
        // Only focus if user explicitly interacts or if it's an interactive task page

        // Find the first focusable element within the page content
        const firstFocusable = mainContent?.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        // Only set focus to primary button if it's visible in viewport without scrolling
        const primaryButton = mainContent?.querySelector('.pagination-button:not(.secondary)');
        if (primaryButton && !primaryButton.disabled) {
            // Check if button is already in viewport
            const rect = primaryButton.getBoundingClientRect();
            const isInViewport = rect.top >= 0 && rect.top <= window.innerHeight;

            if (isInViewport) {
                setTimeout(() => {
                    primaryButton.focus({ preventScroll: true });
                }, 200);
            }
        }
    }

    // Public API methods
    getCurrentPage() {
        return this.currentPage;
    }

    isRendering() {
        return this.renderingInProgress;
    }

    forceReRender() {
        if (this.currentPage) {
            this.renderCurrentPage(this.currentPage);
        }
    }
}

// Voice Assistant Functions - Replaced with Voice Widget Manager
// Old iframe-based voice assistant functions have been removed
// Voice widgets are now managed by VoiceWidgetManager class

// Global functions for sub-concept functionality have been extracted to sub-concept-renderer.js
// This includes: toggleLearningMode, announceToScreenReader, initializeVoiceWidgetForListenMode

// Initialize page renderer when this script loads
window.pageRenderer = new PageRenderer();

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageRenderer;
}
