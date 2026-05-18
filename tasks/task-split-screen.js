class SplitScreenManager {
    constructor() {
        this.isActive = false;
        this.isExpanded = false;
        this.currentTaskPage = null;
        this.container = null;
        this.leftPanel = null;
        this.iframe = null;
        this.loadingIndicator = null;

        this.init();
    }

    init() {
        // Cache DOM elements
        this.container = document.getElementById('splitScreenContainer');
        this.leftPanel = document.getElementById('splitLeftPanel');
        this.iframe = document.getElementById('taskIframe');
        this.loadingIndicator = document.getElementById('iframeLoading');

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Hide iframe initially
        this.iframe.style.display = 'none';
    }

    openSplitScreen(taskPage, stepContent) {
        if (!taskPage || !taskPage.url) {
            console.warn('Invalid task page configuration');
            return;
        }

        if (window.pipManager && typeof window.pipManager.setWorkspaceSuppressed === 'function') {
            window.pipManager.setWorkspaceSuppressed(true);
        }

        this.currentTaskPage = taskPage;

        // Copy current step content to left panel (simplified layout)
        this.copyStepContent(stepContent);

        // Show loading indicator
        this.showLoading();

        // Set iframe source
        this.iframe.src = taskPage.url;

        // Show split screen container
        this.container.classList.add('active');
        document.body.classList.add('split-screen-active');

        this.isActive = true;

        // Transform sidebar toggle to close button
        this.transformSidebarToClose();

        // Handle iframe load
        this.iframe.onload = () => {
            this.hideLoading();
            this.iframe.style.display = 'block';
        };

        // Handle iframe error
        this.iframe.onerror = () => {
            this.hideLoading();
            this.showErrorWithFallback(taskPage.url);
        };

        // Set a timeout to detect if the iframe is blocked
        setTimeout(() => {
            if (this.isActive && this.loadingIndicator.style.display !== 'none') {
                this.hideLoading();
                this.showErrorWithFallback(taskPage.url);
            }
        }, 5000); // 5 second timeout
    }

    closeSplitScreen() {
        this.container.classList.remove('active');
        document.body.classList.remove('split-screen-active');

        // Clear iframe
        this.iframe.src = 'about:blank';
        this.iframe.style.display = 'none';

        // Clear left panel
        this.leftPanel.innerHTML = '';

        this.isActive = false;
        this.currentTaskPage = null;

        if (window.pipManager && typeof window.pipManager.setWorkspaceSuppressed === 'function') {
            window.pipManager.setWorkspaceSuppressed(false);
        }

        // Restore sidebar toggle button
        this.restoreSidebarToggle();
    }

    /**
     * Show close button in header (sidebar toggle removed, so we insert into header directly)
     * Also closes sidebar when split screen opens
     */
    transformSidebarToClose() {
        // Close the sidebar when split screen opens
        if (window.accessibilityManager && window.accessibilityManager.closeSidebar) {
            window.accessibilityManager.closeSidebar();
        }

        // Check if close button already exists
        if (document.getElementById('splitScreenCloseBtn')) return;

        // Find the header's relative container to insert the close button
        const header = document.querySelector('header .relative');
        if (!header) {
            console.warn('Header container not found for split screen close button');
            return;
        }

        // Create new close button
        const closeBtn = document.createElement('button');
        closeBtn.id = 'splitScreenCloseBtn';
        closeBtn.className = 'split-screen-header-close absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 z-50';
        closeBtn.innerHTML = '<i class="fas fa-times text-gray-600"></i>';
        closeBtn.title = 'Close Workspace';
        closeBtn.setAttribute('aria-label', 'Close task workspace');

        // Add click handler
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeSplitScreen(); // Use global function
        });

        // Insert close button at the beginning of header
        header.insertBefore(closeBtn, header.firstChild);
    }

    /**
     * Restore sidebar (remove close button, reopen sidebar)
     */
    restoreSidebarToggle() {
        const closeBtn = document.getElementById('splitScreenCloseBtn');

        // Remove close button
        if (closeBtn) {
            closeBtn.remove();
        }

        // Open sidebar again when split screen closes
        if (window.accessibilityManager && window.accessibilityManager.openSidebar) {
            window.accessibilityManager.openSidebar();
        }
    }

    toggleSplitSize() {
        if (!this.isActive) return;

        this.setExpanded(!this.isExpanded);
    }

    setExpanded(expanded) {
        this.isExpanded = expanded;

        if (expanded) {
            this.container.classList.add('expanded');
        } else {
            this.container.classList.remove('expanded');
        }

        this.updateResizeButton();
    }

    updateResizeButton() {
        const resizeBtnText = document.getElementById('resizeBtnText');
        if (resizeBtnText) {
            resizeBtnText.textContent = this.isExpanded ? 'Collapse' : 'Expand';
        } else {
            console.warn('Resize button text element not found');
        }
    }

    copyStepContent(stepContent) {
        if (!stepContent) {
            this.leftPanel.innerHTML = '<div class="p-8 text-center text-gray-500">No step content available</div>';
            return;
        }

        // Check if stepContent is already cloned or needs cloning
        const clonedContent = stepContent.cloneNode ? stepContent.cloneNode(true) : stepContent;

        // Remove all "Open Task Workspace" buttons from cloned content
        const workspaceButtons = clonedContent.querySelectorAll('button[onclick*="openTaskWorkspace"]');
        workspaceButtons.forEach(button => button.remove());

        // Fix image and video click handlers in split-screen mode
        const fixMediaClickHandlers = (element) => {
            // Re-attach click handlers for images
            const images = element.querySelectorAll('img[onclick*="openImageModal"]');
            images.forEach(img => {
                const src = img.getAttribute('onclick').match(/'([^']+)'/)[1];
                const alt = img.getAttribute('onclick').match(/'([^']+)'/)[2] || '';
                img.onclick = (e) => {
                    e.stopPropagation();
                    if (window.openImageModal) {
                        window.openImageModal(src, alt);
                    }
                };
            });

            // Re-attach click handlers for videos
            const videoContainers = element.querySelectorAll('[onclick*="openVideoModal"]');
            videoContainers.forEach(container => {
                const onclick = container.getAttribute('onclick');
                // Use a more robust regex to extract the three parameters
                const paramRegex = /openVideoModal\('([^']+)',\s*'([^']+)',\s*'([^']*)'\)/;
                const match = onclick.match(paramRegex);

                if (match) {
                    const type = match[1];
                    const src = match[2];
                    const caption = match[3];

                    container.onclick = (e) => {
                        e.stopPropagation();
                        if (window.openVideoModal) {
                            window.openVideoModal(type, src, caption);
                        }
                    };
                }
            });
        };

        fixMediaClickHandlers(clonedContent);

        // Create a wrapper for the content
        const wrapper = document.createElement('div');
        wrapper.className = 'task-steps-wrapper';
        wrapper.style.cssText = 'padding: 1rem; max-width: 100%; overflow-y: auto; height: 100%;';
        wrapper.appendChild(clonedContent);

        // Clear and populate left panel
        this.leftPanel.innerHTML = '';
        this.leftPanel.appendChild(wrapper);
    }

    openInNewTab() {
        if (this.currentTaskPage && this.currentTaskPage.url) {
            const newTab = window.open(this.currentTaskPage.url, '_blank');

            if (!newTab) {
                console.warn('New tab was blocked by the browser');
                return;
            }

            if (window.pipManager && typeof window.pipManager.openCurrentTaskPip === 'function') {
                Promise.resolve(window.pipManager.openCurrentTaskPip()).catch((error) => {
                    console.warn('PiP could not be opened from workspace new-tab action:', error);
                });
            }
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;

            // ESC to close
            if (e.key === 'Escape') {
                this.closeSplitScreen();
            }

            // Ctrl/Cmd + Enter to toggle size
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.toggleSplitSize();
            }
        });
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        this.loadingIndicator.style.display = 'block';
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'absolute inset-4 bg-red-50 border border-red-200 rounded-lg p-6 text-center';
        errorDiv.innerHTML = `
            <div class="text-red-600 mb-2">
                <i class="fas fa-exclamation-triangle text-2xl"></i>
            </div>
            <div class="text-red-800 font-medium">${message}</div>
            <button onclick="splitScreenManager.closeSplitScreen()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Close Workspace
            </button>
        `;

        this.iframe.style.display = 'none';
        this.iframe.parentNode.appendChild(errorDiv);
    }

    showErrorWithFallback(url) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'absolute inset-4 bg-amber-50 border border-amber-200 rounded-lg p-6 text-center';
        errorDiv.innerHTML = `
            <div class="text-amber-600 mb-4">
                <i class="fas fa-exclamation-triangle text-3xl"></i>
            </div>
            <div class="text-amber-800 font-medium mb-4">
                This page cannot be displayed in the workspace due to security restrictions.
            </div>
            <div class="text-sm text-amber-700 mb-6">
                Some external websites (like Streamlit apps) don't allow embedding in iframes.
            </div>
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
                <button onclick="splitScreenManager.openInNewTab()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                    <i class="fas fa-external-link-alt"></i>
                    Open in New Tab
                </button>
                <button onclick="splitScreenManager.closeSplitScreen()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    Close Workspace
                </button>
            </div>
        `;

        this.iframe.style.display = 'none';
        this.iframe.parentNode.appendChild(errorDiv);
    }

    isSplitScreenActive() {
        return this.isActive;
    }

    getCurrentTaskPage() {
        return this.currentTaskPage;
    }
}

// Global instance
let splitScreenManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    splitScreenManager = new SplitScreenManager();
});

// Global functions for inline handlers
function openSplitScreen(taskPage, stepIndex) {
    if (!splitScreenManager) {
        console.warn('Split screen manager not available');
        return;
    }

    // Find the container that holds all task steps - use flexible selector
    // Try multiple selectors to find the task steps container
    let taskStepsContainer = document.querySelector('.flex.flex-col[class*="space-y"]');

    // Fallback: look for parent of task-step elements
    if (!taskStepsContainer) {
        const firstTaskStep = document.querySelector('.task-step');
        if (firstTaskStep && firstTaskStep.parentElement) {
            taskStepsContainer = firstTaskStep.parentElement;
        }
    }

    if (!taskStepsContainer) {
        console.warn('Task steps container not found');
        return;
    }

    // Clone the entire container with all steps
    const allStepsClone = taskStepsContainer.cloneNode(true);

    // Note: We no longer highlight the current step to keep the UI clean

    splitScreenManager.openSplitScreen(taskPage, allStepsClone);
}

function closeSplitScreen() {
    if (splitScreenManager) {
        splitScreenManager.closeSplitScreen();
    }
}

function toggleSplitSize() {
    if (splitScreenManager && splitScreenManager.isSplitScreenActive()) {
        splitScreenManager.toggleSplitSize();
    } else {
        console.warn('Split screen is not active');
    }
}

function openInNewTab() {
    if (splitScreenManager && splitScreenManager.isSplitScreenActive()) {
        splitScreenManager.openInNewTab();
    } else {
        console.warn('Split screen is not active');
    }
}

function toggleControlPanel() {
    const panel = document.getElementById('splitControlPanel');
    const toggle = document.getElementById('splitControlToggle');

    if (panel && toggle) {
        const isActive = panel.classList.contains('active');

        if (isActive) {
            panel.classList.remove('active');
            toggle.classList.remove('active');
            toggle.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        } else {
            panel.classList.add('active');
            toggle.classList.add('active');
            toggle.innerHTML = '<i class="fas fa-times"></i>';
        }
    }
}

// Auto-close control panel when clicking outside
document.addEventListener('click', (e) => {
    const controls = document.querySelector('.split-controls');
    if (controls && !controls.contains(e.target)) {
        const panel = document.getElementById('splitControlPanel');
        const toggle = document.getElementById('splitControlToggle');

        if (panel && panel.classList.contains('active')) {
            panel.classList.remove('active');
            toggle.classList.remove('active');
            toggle.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        }
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SplitScreenManager;
}
