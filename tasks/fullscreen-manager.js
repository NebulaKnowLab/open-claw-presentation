/**
 * FullscreenManager - Manages fullscreen mode for SCORM package
 * 
 * Behavior:
 * - Fullscreen is triggered when user clicks "Get Started" button
 * - Exits fullscreen when navigating to task pages
 * - Re-enters fullscreen when navigating away from task pages (to concepts/final assessment)
 * - Respects user's manual exit (ESC key) - won't force re-entry
 */
class FullscreenManager {
    constructor() {
        this.isFullscreenEnabled = false;  // User opted into fullscreen
        this.userManuallyExited = false;   // User pressed ESC to exit
        this.currentPageType = null;

        this.init();
    }

    init() {
        // Listen for fullscreen change events (including ESC key exit)
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());

        // Listen for page navigation events
        document.addEventListener('pageRendered', (event) => {
            this.handlePageNavigation(event.detail);
        });

        console.log('FullscreenManager: Initialized');
    }

    /**
     * Request fullscreen mode
     * Must be called from a user gesture (click event)
     */
    async requestFullscreen() {
        if (this.isFullscreen()) {
            this.isFullscreenEnabled = true;
            this.userManuallyExited = false;
            return true;
        }

        try {
            const elem = document.documentElement;

            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                await elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }

            this.isFullscreenEnabled = true;
            this.userManuallyExited = false;
            console.log('FullscreenManager: Entered fullscreen mode');
            return true;
        } catch (error) {
            console.warn('FullscreenManager: Could not enter fullscreen:', error.message);
            return false;
        }
    }

    /**
     * Exit fullscreen mode
     */
    async exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
            console.log('FullscreenManager: Exited fullscreen mode');
        } catch (error) {
            console.warn('FullscreenManager: Could not exit fullscreen:', error.message);
        }
    }

    /**
     * Check if currently in fullscreen
     */
    isFullscreen() {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    /**
     * Handle fullscreen change events (including user pressing ESC)
     */
    handleFullscreenChange() {
        const wasFullscreen = this.isFullscreen();

        if (!wasFullscreen && this.isFullscreenEnabled && this.currentPageType !== 'task') {
            // User manually exited fullscreen (ESC key) while not on task page
            this.userManuallyExited = true;
            console.log('FullscreenManager: User manually exited fullscreen');
        }
    }

    /**
     * Handle page navigation events
     */
    handlePageNavigation(pageDetail) {
        const { pageType } = pageDetail;
        const previousPageType = this.currentPageType;
        this.currentPageType = pageType;

        // Only manage fullscreen if user opted in and didn't manually exit
        if (!this.isFullscreenEnabled || this.userManuallyExited) {
            return;
        }

        if (pageType === 'task') {
            // Entering task page - exit fullscreen
            if (this.isFullscreen()) {
                console.log('FullscreenManager: Navigating to task page, exiting fullscreen');
                this.exitFullscreen();
            }
        } else if (previousPageType === 'task' && pageType !== 'task' && !this.isFullscreen()) {
            // Leaving task page - re-enter fullscreen
            // Note: This may not work in all browsers since it's not directly from a user gesture
            // But some browsers allow it if the user previously granted fullscreen permission
            console.log('FullscreenManager: Leaving task page, attempting to re-enter fullscreen');
            this.requestFullscreen();
        }
    }

    getPageById(pageId) {
        return window.paginationSystem?.pageMap?.get(pageId) || null;
    }

    isUserNavigationTrigger(trigger) {
        return [
            'get-started',
            'sidebar-click',
            'next-button',
            'previous-button',
            'keyboard-shortcut'
        ].includes(trigger);
    }

    async performManagedNavigation(targetPage, navigateCallback, options = {}) {
        if (!targetPage || typeof navigateCallback !== 'function') {
            return false;
        }

        const trigger = options.trigger || 'system';
        const isUserInitiated = options.userInitiated ?? this.isUserNavigationTrigger(trigger);

        if (!isUserInitiated) {
            return navigateCallback();
        }

        if (targetPage.type === 'task') {
            if (this.isFullscreen()) {
                await this.exitFullscreen();
            }
            return navigateCallback();
        }

        await this.requestFullscreen();
        return navigateCallback();
    }

    async navigateToPage(pageId, options = {}) {
        const targetPage = this.getPageById(pageId);

        if (!targetPage || !window.paginationSystem) {
            return false;
        }

        return this.performManagedNavigation(
            targetPage,
            () => window.paginationSystem.navigateToPage(pageId, options),
            options
        );
    }

    async navigateRelative(direction, options = {}) {
        if (!window.paginationSystem) {
            return false;
        }

        const targetPage = direction === 'previous'
            ? window.paginationSystem.getPreviousPage()
            : window.paginationSystem.getNextPage();

        if (!targetPage) {
            return false;
        }

        const mergedOptions = {
            ...options,
            trigger: options.trigger || (direction === 'previous' ? 'previous-button' : 'next-button')
        };

        return this.performManagedNavigation(
            targetPage,
            () => direction === 'previous'
                ? window.paginationSystem.navigatePrevious()
                : window.paginationSystem.navigateNext(),
            mergedOptions
        );
    }

    /**
     * Called when Get Started button is clicked
     * This triggers both fullscreen AND navigation
     */
    async onGetStartedClick() {
        if (window.navigateNextPage) {
            return window.navigateNextPage({
                trigger: 'get-started',
                userInitiated: true
            });
        }

        return false;
    }
}

// Initialize and expose globally
window.fullscreenManager = new FullscreenManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FullscreenManager;
}
