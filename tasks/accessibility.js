/**
 * SCORM Builder Accessibility Module
 * Implements WCAG 2.1 AA compliance for pagination system
 * Provides keyboard navigation, screen reader support, and focus management
 */

class AccessibilityManager {
    constructor() {
        this.initialized = false;
        this.announcer = null;
        this.keyboardHandlers = new Map();
        this.focusTrap = null;
        this.skipLinks = [];

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

        try {
            // Create screen reader announcer
            this.createAnnouncer();

            // Setup keyboard navigation
            this.setupKeyboardNavigation();

            // Setup focus management
            this.setupFocusManagement();

            // Create skip links
            this.createSkipLinks();

            // Setup aria live regions
            this.setupAriaLiveRegions();

            // Listen to pagination events
            this.setupEventListeners();

            // Setup reduced motion support
            this.setupReducedMotion();

            // Setup high contrast support
            this.setupHighContrast();

            this.initialized = true;
            console.log('Accessibility manager initialized');

            // Make available globally
            window.accessibilityManager = this;

        } catch (error) {
            console.error('Error initializing accessibility manager:', error);
        }
    }

    createAnnouncer() {
        // Create a hidden div for screen reader announcements
        this.announcer = document.createElement('div');
        this.announcer.setAttribute('aria-live', 'polite');
        this.announcer.setAttribute('aria-atomic', 'true');
        this.announcer.className = 'sr-only';
        this.announcer.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(this.announcer);
    }

    setupKeyboardNavigation() {
        // Global keyboard shortcuts for pagination
        document.addEventListener('keydown', (event) => {
            // Ignore keyboard events when typing in input fields, textareas, etc.
            if (this.isInputElement(event.target)) {
                return;
            }

            switch (event.key) {
                case 'PageDown':
                    // Skip if image modal is open (modal handles its own arrow keys)
                    if (this.isImageModalOpen()) return;
                    event.preventDefault();
                    this.navigateNext();
                    break;
                case 'PageUp':
                    // Skip if image modal is open (modal handles its own arrow keys)
                    if (this.isImageModalOpen()) return;
                    event.preventDefault();
                    this.navigatePrevious();
                    break;
                case 'Home':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        this.navigateFirst();
                    }
                    break;
                case 'End':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        this.navigateLast();
                    }
                    break;
                case 's':
                    // Ctrl+S sidebar toggle removed - sidebar is now auto-controlled by chat widget
                    break;
                case 'Escape':
                    this.handleEscapeKey(event);
                    break;
            }
        });

        // Enhanced keyboard support for pagination controls
        const prevButton = document.getElementById('pagination-prev');
        const nextButton = document.getElementById('pagination-next');

        if (prevButton) {
            prevButton.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowRight' && !event.shiftKey) {
                    event.preventDefault();
                    nextButton?.focus();
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowLeft' && !event.shiftKey) {
                    event.preventDefault();
                    prevButton?.focus();
                }
            });
        }
    }

    setupFocusManagement() {
        // Manage focus when page changes
        document.addEventListener('pageChanged', (event) => {
            setTimeout(() => {
                this.managePageFocus();
            }, 100);
        });

        // Manage focus for modal dialogs and overlays
        document.addEventListener('focus', (event) => {
            this.trapFocusIfNeeded(event.target);
        }, true);

        // Announce focus changes for better context
        document.addEventListener('focusin', (event) => {
            this.announceFocusChange(event.target);
        });
    }

    createSkipLinks() {
        // Create skip-to-content and skip-to-navigation links
        const skipLinksHTML = `
            <a href="#main-content" class="skip-link" data-skip="content">
                Skip to main content
            </a>
            <a href="#sidebarNavigation" class="skip-link" data-skip="sidebar">
                Skip to navigation
            </a>
        `;

        // Insert skip links at the top of the body
        const skipLinksContainer = document.createElement('div');
        skipLinksContainer.innerHTML = skipLinksHTML;
        document.body.insertBefore(skipLinksContainer, document.body.firstChild);

        // Style skip links
        const style = document.createElement('style');
        style.textContent = `
            .skip-link {
                position: absolute;
                top: -40px;
                left: 6px;
                background: var(--primary-color, #6366f1);
                color: white;
                padding: 8px;
                text-decoration: none;
                border-radius: 4px;
                z-index: 100;
                font-size: 14px;
                font-weight: 500;
                transition: top 0.3s ease;
            }
            .skip-link:focus {
                top: 6px;
            }
        `;
        document.head.appendChild(style);

        this.skipLinks = Array.from(document.querySelectorAll('.skip-link'));
    }

    setupAriaLiveRegions() {
        // Create aria live regions for dynamic content updates
        const regions = [
            { id: 'pagination-announcements', politeness: 'polite' },
            { id: 'progress-announcements', politeness: 'polite' },
            { id: 'status-announcements', politeness: 'assertive' }
        ];

        regions.forEach(region => {
            const element = document.createElement('div');
            element.id = region.id;
            element.setAttribute('aria-live', region.politeness);
            element.setAttribute('aria-atomic', 'true');
            element.className = 'sr-only';
            element.style.cssText = `
                position: absolute;
                left: -10000px;
                width: 1px;
                height: 1px;
                overflow: hidden;
            `;
            document.body.appendChild(element);
        });
    }

    setupEventListeners() {
        // Listen to pagination events for announcements
        document.addEventListener('pageChanged', (event) => {
            const { fromPage, toPage, toIndex } = event.detail;
            const currentPage = window.paginationSystem?.getCurrentPage();

            if (currentPage) {
                this.announcePageChange(
                    currentPage.title,
                    toIndex + 1,
                    window.paginationSystem?.getTotalPages() || 1
                );
            }
        });

        document.addEventListener('paginationProgress', (event) => {
            const { currentPage, totalPages, percentage } = event.detail;
            this.announceProgress(`${Math.round(percentage)}% complete, page ${currentPage} of ${totalPages}`);
        });

        document.addEventListener('conceptCompleted', (event) => {
            this.announceStatus('Concept completed successfully');
        });

        document.addEventListener('taskCompleted', (event) => {
            this.announceStatus('Task completed successfully');
        });

        // 🚨 NEW: Listen for chat widget open/close events to auto-toggle sidebar
        window.addEventListener('chatOpened', () => {
            console.log('AccessibilityManager: Chat opened, closing sidebar');
            this.closeSidebar();
        });

        window.addEventListener('chatClosed', () => {
            console.log('AccessibilityManager: Chat closed, opening sidebar');
            this.openSidebar();
        });

        // 🚨 NEW: Also open sidebar when page changes (chat closes on navigation)
        document.addEventListener('pageChanged', () => {
            // Small delay to ensure chat has closed first
            setTimeout(() => {
                if (!this.isChatOpen()) {
                    this.openSidebar();
                }
            }, 100);
        });
    }

    setupReducedMotion() {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        if (prefersReducedMotion.matches) {
            document.body.setAttribute('data-reduced-motion', 'true');
        }

        prefersReducedMotion.addEventListener('change', (event) => {
            if (event.matches) {
                document.body.setAttribute('data-reduced-motion', 'true');
            } else {
                document.body.removeAttribute('data-reduced-motion');
            }
        });
    }

    setupHighContrast() {
        // Check for high contrast preference
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');

        if (prefersHighContrast.matches) {
            document.body.setAttribute('data-high-contrast', 'true');
        }

        prefersHighContrast.addEventListener('change', (event) => {
            if (event.matches) {
                document.body.setAttribute('data-high-contrast', 'true');
            } else {
                document.body.removeAttribute('data-high-contrast');
            }
        });
    }

    // Public API methods
    announceToScreenReader(message, priority = 'polite') {
        if (!this.announcer) return;

        // Clear previous announcement
        this.announcer.textContent = '';

        // Set new announcement after a brief delay
        setTimeout(() => {
            this.announcer.textContent = message;
        }, 100);
    }

    announcePageChange(pageTitle, pageNumber, totalPages) {
        const message = `Now viewing ${pageTitle}, page ${pageNumber} of ${totalPages}`;
        this.announceToScreenReader(message);

        // Update page title for screen readers
        document.title = `${pageTitle} - Page ${pageNumber} of ${totalPages} - Nebula KnowLab`;
    }

    announceProgress(message) {
        const progressRegion = document.getElementById('progress-announcements');
        if (progressRegion) {
            progressRegion.textContent = message;
        }
    }

    announceStatus(message) {
        const statusRegion = document.getElementById('status-announcements');
        if (statusRegion) {
            statusRegion.textContent = message;
        }
    }

    announceFocusChange(element) {
        // Announce important focus changes for context
        if (element.id === 'pagination-prev') {
            this.announceToScreenReader('Previous page button');
        } else if (element.id === 'pagination-next') {
            this.announceToScreenReader('Next page button');
        } else if (element.closest('.sidebar-item')) {
            const sidebarItem = element.closest('.sidebar-item');
            const title = sidebarItem.querySelector('.sidebar-item-title')?.textContent;
            if (title) {
                this.announceToScreenReader(`Navigation item: ${title}`);
            }
        }
    }

    managePageFocus() {
        // Set focus to the main content area for screen readers
        const mainContent = document.getElementById('current-page-content');
        if (!mainContent) return;

        // Find the best element to focus
        let focusTarget = null;

        // Try to find primary action button first
        const primaryButton = mainContent.querySelector('.pagination-button:not(.secondary):not(:disabled)');
        if (primaryButton) {
            focusTarget = primaryButton;
        } else {
            // Try to find first focusable element
            focusTarget = mainContent.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
        }

        // Set focus if we found a target
        if (focusTarget) {
            setTimeout(() => {
                focusTarget.focus();
            }, 200);
        } else {
            // Set focus to main content area
            mainContent.setAttribute('tabindex', '-1');
            mainContent.focus();
            setTimeout(() => {
                mainContent.removeAttribute('tabindex');
            }, 100);
        }
    }

    trapFocusIfNeeded(element) {
        // Check if element is within a modal or dialog that needs focus trapping
        const modal = element.closest('[role="dialog"], .modal');
        if (modal && this.focusTrap !== modal) {
            this.setupFocusTrap(modal);
        }
    }

    setupFocusTrap(container) {
        this.focusTrap = container;

        // Get all focusable elements within the container
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        // Trap focus within the container
        const trapFocus = (event) => {
            if (event.key !== 'Tab') return;

            if (event.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    event.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastFocusable) {
                    event.preventDefault();
                    firstFocusable.focus();
                }
            }
        };

        container.addEventListener('keydown', trapFocus);

        // Clean up when focus trap is removed
        const observer = new MutationObserver((mutations) => {
            if (!document.body.contains(container)) {
                container.removeEventListener('keydown', trapFocus);
                if (this.focusTrap === container) {
                    this.focusTrap = null;
                }
                observer.disconnect();
            }
        });

        observer.observe(container, { childList: true, subtree: true });
    }

    // Navigation helpers
    async navigateNext() {
        if (window.navigateNextPage) {
            const success = await window.navigateNextPage({
                trigger: 'keyboard-shortcut'
            });
            if (!success) {
                this.announceStatus('Next page not available or locked');
            }
        }
    }

    async navigatePrevious() {
        if (window.navigatePreviousPage) {
            const success = await window.navigatePreviousPage({
                trigger: 'keyboard-shortcut'
            });
            if (!success) {
                this.announceStatus('Previous page not available or locked');
            }
        }
    }

    navigateFirst() {
        if (window.paginationSystem) {
            const pages = window.paginationSystem.getAllPages();
            if (pages.length > 0) {
                const firstPage = pages.find(page => !page.locked);
                if (firstPage) {
                    window.navigateToPage(firstPage.id, {
                        trigger: 'keyboard-shortcut'
                    });
                }
            }
        }
    }

    navigateLast() {
        if (window.paginationSystem) {
            const pages = window.paginationSystem.getAllPages();
            if (pages.length > 0) {
                // Find the last available (unlocked) page
                const lastPage = [...pages].reverse().find(page => !page.locked);
                if (lastPage) {
                    window.navigateToPage(lastPage.id, {
                        trigger: 'keyboard-shortcut'
                    });
                }
            }
        }
    }

    toggleSidebar() {
        if (document.body.classList.contains('sidebar-open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    /**
     * Open sidebar (make visible)
     * Uses 'sidebar-open' class on body as per sidebar-navigation.css
     */
    openSidebar() {
        if (!document.body.classList.contains('sidebar-open')) {
            document.body.classList.add('sidebar-open');
            console.log('AccessibilityManager: Sidebar opened (added sidebar-open to body)');
            this.announceStatus('Sidebar expanded');
        }
    }

    /**
     * Close sidebar (hide)
     * Uses 'sidebar-open' class on body as per sidebar-navigation.css
     */
    closeSidebar() {
        if (document.body.classList.contains('sidebar-open')) {
            document.body.classList.remove('sidebar-open');
            console.log('AccessibilityManager: Sidebar closed (removed sidebar-open from body)');
            this.announceStatus('Sidebar collapsed');
        }
    }

    /**
     * Check if chat widget is currently open
     */
    isChatOpen() {
        const chatWidget = document.getElementById('chat-widget');
        return chatWidget && chatWidget.classList.contains('open');
    }

    /**
     * Check if image modal is currently open
     */
    isImageModalOpen() {
        const modal = document.getElementById('imageModal');
        return modal && !modal.classList.contains('hidden');
    }

    handleEscapeKey(event) {
        // Handle escape key for closing modals, collapsing sidebar, etc.
        const modal = event.target.closest('[role="dialog"], .modal');
        if (modal) {
            // Close modal
            const closeButton = modal.querySelector('.modal-close, button[aria-label*="close"]');
            if (closeButton) {
                closeButton.click();
            }
            return;
        }

        // Sidebar is now static and only controlled by chat widget
        // ESC no longer closes the sidebar
    }

    // Utility methods
    isInputElement(element) {
        const inputTypes = ['input', 'textarea', 'select'];
        return inputTypes.includes(element.tagName.toLowerCase()) ||
            element.contentEditable === 'true' ||
            element.getAttribute('role') === 'textbox';
    }

    // Enhanced ARIA support for dynamic content
    updateAriaLabel(element, label) {
        if (element) {
            element.setAttribute('aria-label', label);
        }
    }

    updateAriaDescribedBy(element, descriptionId) {
        if (element && descriptionId) {
            element.setAttribute('aria-describedby', descriptionId);
        }
    }

    setAriaExpanded(element, expanded) {
        if (element) {
            element.setAttribute('aria-expanded', expanded.toString());
        }
    }

    markAsBusy(element, busy = true) {
        if (element) {
            element.setAttribute('aria-busy', busy.toString());
        }
    }

    // Screen reader optimization for loading states
    announceLoadingState(isLoading, context = 'content') {
        const message = isLoading ? `Loading ${context}...` : `${context} loaded`;
        this.announceToScreenReader(message, isLoading ? 'assertive' : 'polite');
    }

    // Color contrast checking (basic implementation)
    hasGoodContrast(color1, color2) {
        // This is a simplified implementation
        // In production, use a proper contrast calculation library
        return true; // Placeholder
    }

    // Keyboard shortcut help
    showKeyboardHelp() {
        const helpText = `
            Keyboard Shortcuts:
            • Page Down: Next page
            • Page Up: Previous page
            • Ctrl + Home: First page
            • Ctrl + End: Last page
            • Escape: Close dialogs and overlays
            • Tab: Navigate between elements
            • Shift + Tab: Navigate backwards
        `;

        this.announceToScreenReader(helpText);

        // Also show visual help if needed
        if (window.showNotification) {
            window.showNotification(helpText.replace(/\n/g, '<br>'), 'info');
        }
    }
}

// Global accessibility functions for external use
window.announceToScreenReader = (message, priority = 'polite') => {
    if (window.accessibilityManager) {
        window.accessibilityManager.announceToScreenReader(message, priority);
    }
};

window.showKeyboardHelp = () => {
    if (window.accessibilityManager) {
        window.accessibilityManager.showKeyboardHelp();
    }
};

// Initialize accessibility manager when this script loads
window.accessibilityManager = new AccessibilityManager();

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
}
