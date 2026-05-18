class PaginationSystem {
    constructor() {
        this.pages = [];
        this.currentPageIndex = 0;
        this.pageMap = new Map(); // pageId -> page object
        this.totalPages = 0;
        this.initialized = false;

        // Don't auto-initialize - will be called manually after SCORM state is loaded
    }

    initializeWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            // DOM is already loaded, check if we have topic data
            if (window.topicConfig && window.topicConfig.concepts) {
                this.initialize();
            } else {
                // Wait for topic data to be loaded
                setTimeout(() => this.initializeWhenReady(), 100);
            }
        }
    }

    initialize() {
        if (this.initialized) return;

        try {
            // Enhance learning state with pagination properties
            this.enhanceLearningState();

            // Build page hierarchy from concepts, tasks, final quiz
            this.buildPageHierarchy();

            // Setup navigation listeners
            this.setupNavigationListeners();

            // Navigate to initial page
            this.navigateToInitialPage();

            this.initialized = true;
            console.log('Pagination system initialized successfully');

            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('paginationSystemReady', {
                detail: { totalPages: this.totalPages }
            }));

        } catch (error) {
            console.error('Error initializing pagination system:', error);
            // Fallback to non-paginated mode if initialization fails
            this.enableFallbackMode();
        }
    }

    enhanceLearningState() {
        // Add pagination-specific properties to existing learningPathState
        if (!window.learningPathState) {
            window.learningPathState = {
                completedConcepts: new Set(),
                completedTasks: new Set(),  // Track completed tasks
                completedQuiz: false,  // Track final quiz completion
                quizResults: null,  // Store quiz results for persistence
                feedbackSubmittedAt: null,
                unlockedTasks: new Set(),
                completedTaskSteps: new Set(),
                currentConceptIndex: 0,
                currentSubConcepts: {}
            };
        }

        // Ensure completedTasks exists even if learningPathState was created elsewhere
        if (!window.learningPathState.completedTasks) {
            window.learningPathState.completedTasks = new Set();
        }

        // Ensure quizResults exists
        if (window.learningPathState.quizResults === undefined) {
            window.learningPathState.quizResults = null;
        }

        if (window.learningPathState.feedbackSubmittedAt === undefined) {
            window.learningPathState.feedbackSubmittedAt = null;
        }

        // Add pagination properties
        window.learningPathState.currentPage = null;
        window.learningPathState.pageHistory = [];
        window.learningPathState.totalPages = 0;
        window.learningPathState.completedPages = new Set();
        window.learningPathState.paginationMode = true;

        // Save enhanced state
        this.savePaginationState();
    }

    buildPageHierarchy() {
        this.pages = [];
        this.pageMap.clear();

        var tasks = window.topicConfig.tasks || [];
        tasks.forEach(task => {
            var taskPage = {
                id: task.id,
                title: task.title,
                type: 'task',
                index: this.pages.length,
                data: { task: task },
                locked: false
            };
            this.pages.push(taskPage);
            this.pageMap.set(task.id, taskPage);
        });

        this.totalPages = this.pages.length;
        window.learningPathState.totalPages = this.totalPages;

        console.log('Page hierarchy built:', {
            totalPages: this.totalPages,
            pages: this.pages.map(p => ({ id: p.id, title: p.title, type: p.type }))
        });
    }

    updatePageLocks() {
        this.pageMap.clear();
        this.pages.forEach(page => {
            this.pageMap.set(page.id, page);
        });
    }

    navigateToPage(pageId, options = {}) {
        const page = this.pageMap.get(pageId);
        if (!page) {
            console.error(`Page not found: ${pageId}`);
            return false;
        }

        // Check if page is locked (unless forcing navigation)
        if (page.locked && !options.force) {
            this.showLockedMessage(page);
            return false;
        }

        const previousPage = this.getCurrentPage();
        const previousPageIndex = this.currentPageIndex;

        // Update current state
        this.currentPageIndex = page.index;
        window.learningPathState.currentPage = pageId;

        // Add to history (unless same page)
        if (previousPage && previousPage.id !== pageId) {
            window.learningPathState.pageHistory.push(previousPage.id);

            // Keep history manageable (max 50 items)
            if (window.learningPathState.pageHistory.length > 50) {
                window.learningPathState.pageHistory = window.learningPathState.pageHistory.slice(-25);
            }
        }

        // Save state
        this.savePaginationState();

        // Trigger page rendering
        this.renderPage(page);

        // Update navigation controls
        this.updatePaginationControls();

        // Update sidebar current page
        this.updateSidebarCurrentPage(pageId);

        // Dispatch navigation event
        document.dispatchEvent(new CustomEvent('pageChanged', {
            detail: {
                fromPage: previousPage,
                toPage: page,
                fromIndex: previousPageIndex,
                toIndex: this.currentPageIndex,
                trigger: options.trigger || 'system'
            }
        }));

        // Announce for screen readers
        this.announcePageChange(page.title, this.currentPageIndex + 1, this.totalPages);

        return true;
    }

    getCurrentPage() {
        return this.pages[this.currentPageIndex] || null;
    }

    getNextPage() {
        const nextIndex = this.currentPageIndex + 1;
        if (nextIndex < this.pages.length) {
            return this.pages[nextIndex];
        }
        return null;
    }

    getPreviousPage() {
        const prevIndex = this.currentPageIndex - 1;
        if (prevIndex >= 0) {
            return this.pages[prevIndex];
        }
        return null;
    }

    canNavigateNext() {
        const nextPage = this.getNextPage();
        return nextPage && !nextPage.locked;
    }

    canNavigatePrevious() {
        const prevPage = this.getPreviousPage();
        return prevPage && !prevPage.locked;
    }

    navigateNext() {
        if (this.canNavigateNext()) {
            const nextPage = this.getNextPage();
            return this.navigateToPage(nextPage.id, { trigger: 'next-button' });
        }
        return false;
    }

    navigatePrevious() {
        if (this.canNavigatePrevious()) {
            const prevPage = this.getPreviousPage();
            return this.navigateToPage(prevPage.id, { trigger: 'previous-button' });
        }
        return false;
    }

    renderPage(page) {
        // This will be implemented in page-renderer.js
        if (window.pageRenderer) {
            window.pageRenderer.renderCurrentPage(page);
        } else {
            console.warn('Page renderer not available, falling back to basic rendering');
            this.fallbackRenderPage(page);
        }
    }

    fallbackRenderPage(page) {
        const contentContainer = document.getElementById('current-page-content');
        if (!contentContainer) return;

        let content = `<div class="page-content" data-page-type="${page.type}">`;
        content += `<h2>${page.title}</h2>`;
        content += `<p>Page content rendering not fully implemented yet.</p>`;
        content += `</div>`;

        contentContainer.innerHTML = content;
    }

    updatePaginationControls() {
        const prevButton = document.getElementById('pagination-prev');
        const nextButton = document.getElementById('pagination-next');
        const pageCounter = document.getElementById('page-counter');
        const progressBar = document.getElementById('page-progress');

        if (prevButton) {
            prevButton.disabled = !this.canNavigatePrevious();
            prevButton.setAttribute('aria-label',
                this.canNavigatePrevious() ? 'Go to previous page' : 'Previous page not available');
        }

        if (nextButton) {
            nextButton.disabled = !this.canNavigateNext();
            nextButton.setAttribute('aria-label',
                this.canNavigateNext() ? 'Go to next page' : 'Next page locked or not available');
        }

        if (pageCounter) {
            pageCounter.textContent = `Page ${this.currentPageIndex + 1} of ${this.totalPages}`;
        }

        if (progressBar) {
            const progress = ((this.currentPageIndex + 1) / this.totalPages) * 100;
            progressBar.style.width = `${progress}%`;
        }
    }

    updateSidebarCurrentPage(pageId) {
        // Update sidebar to highlight current page
        if (window.sidebarNavigation) {
            window.sidebarNavigation.updateCurrentPage(pageId);
        }
    }


    announcePageChange(pageTitle, pageNumber, totalPages) {
        const announcement = `Now viewing ${pageTitle}, page ${pageNumber} of ${totalPages}`;
        if (window.announceToScreenReader) {
            window.announceToScreenReader(announcement);
        }
    }

    showLockedMessage(page) {
        if (window.showNotification) {
            window.showNotification(`"${page.title}" is locked. Complete previous content to unlock it.`, 'warning');
        } else {
            alert(`"${page.title}" is locked. Complete previous content to unlock it.`);
        }
    }

    navigateToInitialPage() {
        var savedPageId = null;

        if (window.scormAPIInstance && window.scormAPIInstance.isConnected()) {
            var state = window.scormAPIInstance.loadStateFromSCORM();
            if (state && state.currentPage && typeof state.currentPage === 'string') {
                savedPageId = state.currentPage;
            }
        }

        if (!savedPageId && window.learningPathState.currentPage) {
            savedPageId = window.learningPathState.currentPage;
        }

        if (savedPageId && this.pageMap.has(savedPageId)) {
            this.navigateToPage(savedPageId, { trigger: 'restore-state' });
        } else if (this.pages.length > 0) {
            this.navigateToPage(this.pages[0].id, { trigger: 'initial-load' });
        }
    }

    savePaginationState() {
        // Save to localStorage and SCORM if available
        const paginationState = {
            currentPage: window.learningPathState.currentPage,
            pageHistory: window.learningPathState.pageHistory,
            totalPages: this.totalPages,
            completedPages: Array.from(window.learningPathState.completedPages)
        };

        // Save to localStorage
        localStorage.setItem('scormPaginationState', JSON.stringify(paginationState));

        // Save to SCORM if available
        if (window.scormAPIInstance && window.scormAPIInstance.isConnected()) {
            // The pagination state is already included in the main SCORM state save
            // This is handled by the learning path state saving system
            // No separate pagination state needed - it's part of the complete learning state
        }

        // Trigger save event for other systems
        document.dispatchEvent(new CustomEvent('paginationStateSaved', {
            detail: paginationState
        }));
    }

    setupNavigationListeners() {
        // Previous button
        const prevButton = document.getElementById('pagination-prev');
        if (prevButton) {
            prevButton.addEventListener('click', () => this.navigatePrevious());
        }

        // Next button
        const nextButton = document.getElementById('pagination-next');
        if (nextButton) {
            nextButton.addEventListener('click', () => this.navigateNext());
        }


        // Keyboard navigation (handled in accessibility.js)
        // Sidebar navigation (handled in sidebar-navigation.js)

        // Listen to learning progress events to update page availability
        document.addEventListener('conceptCompleted', () => {
            this.updatePageLocks();
            this.updatePaginationControls();
        });

        document.addEventListener('taskCompleted', () => {
            this.updatePageLocks();
            this.updatePaginationControls();
        });

        document.addEventListener('conceptQuizCompleted', () => {
            this.updatePageLocks();
            this.updatePaginationControls();
        });
    }

    enableFallbackMode() {
        console.warn('Pagination system falling back to non-paginated mode');
        window.learningPathState.paginationMode = false;

        // Hide pagination controls
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) {
            paginationControls.style.display = 'none';
        }

        // Show fallback message
        const contentContainer = document.getElementById('current-page-content');
        if (contentContainer) {
            contentContainer.innerHTML = '<p>Loading content in legacy mode...</p>';
        }

        // Trigger fallback event
        document.dispatchEvent(new CustomEvent('paginationFallbackMode'));
    }

    // Public API methods
    getPageInfo(pageId) {
        return this.pageMap.get(pageId);
    }

    getAllPages() {
        return [...this.pages];
    }

    getCurrentPageIndex() {
        return this.currentPageIndex;
    }

    getTotalPages() {
        return this.totalPages;
    }
}

// Initialize pagination system when this script loads
window.paginationSystem = new PaginationSystem();

// Global navigation functions for external use
window.navigateToPage = (pageId, options) => {
    if (window.fullscreenManager && options?.manageFullscreen !== false) {
        return window.fullscreenManager.navigateToPage(pageId, options);
    }

    return window.paginationSystem.navigateToPage(pageId, options);
};

window.navigateNextPage = (options) => {
    if (window.fullscreenManager && options?.manageFullscreen !== false) {
        return window.fullscreenManager.navigateRelative('next', options);
    }

    return window.paginationSystem.navigateNext();
};

window.navigatePreviousPage = (options) => {
    if (window.fullscreenManager && options?.manageFullscreen !== false) {
        return window.fullscreenManager.navigateRelative('previous', options);
    }

    return window.paginationSystem.navigatePrevious();
};

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaginationSystem;
}
