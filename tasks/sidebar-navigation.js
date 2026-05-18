class SidebarNavigation {
    constructor() {
        this.isOpen = false;
        this.currentSection = null;
        this.templateData = null;
        this.concepts = [];
        this.tasks = [];
        this.quiz = null;
        this.intersectionObserver = null;
        this.expandedConcepts = new Set(); // Store expanded concept IDs

        // Professional SVG Icon System for New Sidebar Structure
        this.getItemIcon = (type, status, isExpanded = false) => {
            const icons = {
                introduction: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>`,

                concept: status === 'completed' ? `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>` : `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>`,

                subconcept: status === 'completed' ? `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>` : `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>`,

                task: status === 'completed' ? `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>` : `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>`,

                task_locked: `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>`,

                final_quiz: status === 'completed' ? `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>` : status === 'locked' ? `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>` : `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>`,

                expand_chevron: `
                    <svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>`,

                collapse_chevron: `
                    <svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                    </svg>`,

                locked: `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>`
            };

            // Handle locked items first (but not final-quiz which has its own locked icon handling)
            if (status === 'locked' && type !== 'final-quiz') {
                return icons.locked;
            }

            // First try exact match with status
            if (type === 'concept' && status === 'completed') {
                return icons.concept; // The concept method already handles completed status
            }
            if (type === 'task' && status === 'completed') {
                return icons.task; // The task method already handles completed status
            }
            if (type === 'subconcept' && status === 'completed') {
                return icons.subconcept; // The subconcept method already handles completed status
            }
            if (type === 'final-quiz' && status === 'completed') {
                return icons.final_quiz; // The final_quiz method handles completed status
            }
            if (type === 'final-quiz' && status === 'locked') {
                return icons.final_quiz; // The final_quiz method handles locked status
            }
            if (type === 'final-quiz' && status === 'available') {
                return icons.final_quiz; // The final_quiz method already handles available status
            }

            // Fall back to base type
            // Handle hyphenated types
            if (type === 'final-quiz') {
                return icons.final_quiz;
            }
            if (type === 'sub-concept') {
                return icons.subconcept;
            }

            return icons[type] || icons.introduction; // Introduction as safe fallback
        };

        // Legacy icon compatibility
        this.icons = {
            completed: this.getItemIcon('completed'),
            current: this.getItemIcon('current'),
            locked: this.getItemIcon('locked'),
            available: this.getItemIcon('available'),
            quiz: this.getItemIcon('final_quiz'),
            task: this.getItemIcon('task')
        };

        this.init();
    }

    /**
     * Initialize the sidebar navigation system
     */
    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        } catch (error) {
            console.error('Error initializing sidebar navigation:', error);
        }
    }

    /**
     * Setup the sidebar components and event listeners
     */
    async setup() {
        try {
            // Load template data
            this.templateData = window.templateData;
            if (!this.templateData) {
                console.warn('Template data not available');
                return;
            }

            // Extract learning content
            this.concepts = this.templateData.concepts || [];
            this.tasks = this.templateData.tasks || [];
            this.quiz = this.templateData.quiz || null;

            // Setup event listeners
            this.setupEventListeners();

            // Initialize navigation items
            this.renderNavigationItems();

            // Setup intersection observer for current section tracking
            this.setupIntersectionObserver();

            // Update initial progress
            this.updateProgress();

            // Check for saved sidebar state
            this.loadSidebarState();

            // Listen for learning path changes
            this.setupLearningPathListener();

        } catch (error) {
            console.error('Error setting up sidebar navigation:', error);
        }
    }

    /**
     * Setup event listeners for sidebar functionality
     */
    setupEventListeners() {
        // Toggle button
        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }


        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());

        // Add keyboard shortcut for manual refresh (Ctrl + Shift + R)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                console.log('Manual sidebar refresh triggered');
                this.renderNavigationItems();
                this.updateProgress();
            }
        });
    }

    /**
     * Setup intersection observer for tracking current section
     */
    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '-20% 0px -60% 0px',
            threshold: 0.1
        };

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.setCurrentSection(entry.target.id);
                }
            });
        }, options);

        // Observe all sections
        this.observeSections();
    }

    /**
     * Observe all learning content sections
     */
    observeSections() {
        const sections = document.querySelectorAll('[id^="concept-"], [id^="task-"], [id^="quiz-"]');
        sections.forEach(section => {
            if (this.intersectionObserver) {
                this.intersectionObserver.observe(section);
            }
        });
    }

    /**
     * Setup listener for learning path state changes
     */
    setupLearningPathListener() {
        // Listen for concept completion events (PRIMARY EVENT)
        document.addEventListener('conceptCompleted', (event) => {
            console.log('Concept completed event received:', event.detail);
            setTimeout(() => {
                this.updateProgress();
                this.renderNavigationItems();
            }, 50); // Reduced delay for faster response
        });

        // Note: pageChanged event listener removed to prevent race conditions
        // The pagination system directly calls updateSidebarCurrentPage() instead

        document.addEventListener('paginationSystemReady', () => {
            console.log('Pagination system ready, updating sidebar navigation');
            this.renderNavigationItems();
        });

        // Listen for concept quiz completion events
        document.addEventListener('conceptQuizCompleted', (event) => {
            console.log('Concept quiz completed event received:', event.detail);
            setTimeout(() => {
                this.updateProgress();
                this.renderNavigationItems();
            }, 50);
        });

        // Listen for task step completion events
        document.addEventListener('taskStepCompleted', (event) => {
            console.log('Task step completed event received:', event.detail);
            setTimeout(() => {
                this.updateProgress();
                this.renderNavigationItems();
            }, 50);
        });

        // Listen for task completion events
        document.addEventListener('taskCompleted', (event) => {
            console.log('Task completed event received:', event.detail);
            setTimeout(() => {
                this.updateProgress();
                this.renderNavigationItems();
            }, 50);
        });

        // Listen for quiz completion events
        document.addEventListener('quizCompleted', (event) => {
            console.log('Quiz completed event received:', event.detail);
            setTimeout(() => {
                this.updateProgress();
                this.renderNavigationItems();
            }, 50);
        });

        // Listen for learning path progress changes
        document.addEventListener('learningPathProgress', (event) => {
            console.log('Learning path progress event received:', event.detail);
            setTimeout(() => {
                this.updateProgress();
                this.renderNavigationItems();
            }, 50);
        });

        // Enhanced SCORM state monitoring
        if (window.scorm) {
            // Listen for SCORM data changes more frequently
            setInterval(() => {
                this.checkSCORMStateChanges();
            }, 500); // Reduced interval for faster detection
        }

        // Fallback: Periodic state checking (reduced frequency)
        setInterval(() => {
            this.updateProgress();
        }, 2000); // Reduced from 3000ms to 2000ms

        // Additional: Direct learningPathState polling for immediate updates
        setInterval(() => {
            this.checkLearningPathStateDirect();
        }, 250); // Very frequent polling for immediate responsiveness

    }

    /**
     * Check learningPathState directly for immediate changes
     */
    checkLearningPathStateDirect() {
        try {
            if (window.learningPathState) {
                const currentConcepts = Array.from(window.learningPathState.completedConcepts).sort();
                const currentConceptsString = JSON.stringify(currentConcepts);

                if (this.lastDirectConceptsState !== currentConceptsString) {
                    console.log('Direct learningPathState change detected:', currentConcepts);
                    this.lastDirectConceptsState = currentConceptsString;
                    this.updateProgress();
                    this.renderNavigationItems();
                }
            }
        } catch (error) {
            // Ignore errors
        }
    }

    /**
     * Render navigation items in the sidebar
     */
    renderNavigationItems() {
        const navigationContainer = document.getElementById('unifiedNavigationList');

        if (!navigationContainer) {
            console.warn('Unified navigation container not found');
            return;
        }

        // Clear existing items
        navigationContainer.innerHTML = '';

        // Always use pagination mode for the new structure
        this.renderPaginatedNavigationItems(navigationContainer);

        // Update progress
        this.updateProgress();
    }

    /**
     * Render navigation items for pagination mode
     */
    renderPaginatedNavigationItems(container) {
        var navigationItems = [];
        var learningState = this.getLearningState();

        this.tasks.forEach(function(task, index) {
            var taskStatus = learningState.completedTasks.has(task.id) ? 'completed' : 'available';
            navigationItems.push({
                id: task.id,
                title: 'Task ' + (index + 1) + ': ' + task.title,
                type: 'task',
                status: taskStatus,
                locked: false
            });
        });

        navigationItems.forEach(item => {
            var navElement = this.createSimpleNavItem(item, learningState, false);
            container.appendChild(navElement);
        });
    }

    /**
     * Render navigation items for legacy mode
     */
    renderLegacyNavigationItems(container) {
        const tasksList = document.getElementById('tasksList');
        const quizList = document.getElementById('quizList');

        // Create legacy structure if needed
        if (!tasksList) {
            const tasksDiv = document.createElement('div');
            tasksDiv.id = 'tasksList';
            tasksDiv.className = 'nav-section';
            container.appendChild(tasksDiv);
        }

        if (!quizList) {
            const quizDiv = document.createElement('div');
            quizDiv.id = 'quizList';
            quizDiv.className = 'nav-section';
            container.appendChild(quizDiv);
        }

        const learningState = this.getLearningState();

        // Render concepts (legacy mode)
        this.concepts.forEach((concept, index) => {
            const conceptItem = this.createConceptNavItem(concept, index, learningState);
            container.appendChild(conceptItem);
        });

        // Render tasks (legacy mode)
        this.tasks.forEach((task, index) => {
            const taskItem = this.createTaskNavItem(task, index, learningState);
            const tasksContainer = document.getElementById('tasksList');
            if (tasksContainer) {
                tasksContainer.appendChild(taskItem);
            }
        });

        // Render quiz (legacy mode)
        if (this.quiz) {
            const quizItem = this.createQuizNavItem(learningState);
            const quizContainer = document.getElementById('quizList');
            if (quizContainer) {
                quizContainer.appendChild(quizItem);
            }
        }
    }

    /**
     * Create a paginated navigation item (with support for expandable concepts)
     */
    createPaginatedNavItem(item, learningState) {
        let isCurrentPage = window.paginationSystem?.getCurrentPage()?.id === item.id;
        const currentPage = window.paginationSystem?.getCurrentPage();

        // Special case: For concepts with single sub-concept, check if current page is that sub-concept
        if (item.type === 'concept' && item.isSingleSubConceptWithSameTitle && item.children && item.children.length > 0) {
            const subConceptId = item.children[0].id;
            isCurrentPage = window.paginationSystem?.getCurrentPage()?.id === subConceptId;
        }

        if (item.type === 'concept' && item.children && item.children.length > 0) {
            // Create expandable concept item
            return this.createExpandableConceptItem(item, learningState, isCurrentPage);
        } else {
            // Create simple navigation item
            return this.createSimpleNavItem(item, learningState, isCurrentPage);
        }
    }

    /**
     * Create an expandable concept navigation item
     */
    createExpandableConceptItem(conceptItem, learningState, isCurrentPage) {
        const container = document.createElement('div');
        container.className = `sidebar-item ${conceptItem.locked ? 'locked' : ''} ${isCurrentPage ? 'current-page' : ''} ${conceptItem.expanded ? 'expanded' : 'collapsed'}`;
        container.setAttribute('data-concept-id', conceptItem.id);

        // Main concept item (clickable to expand/collapse or navigate)
        const conceptHeader = document.createElement('button');
        conceptHeader.className = 'sidebar-item-header w-full text-left p-3 rounded-lg transition-all duration-200';
        conceptHeader.setAttribute('aria-label', `${conceptItem.title}, ${conceptItem.expanded ? 'expanded' : 'collapsed'}`);
        conceptHeader.setAttribute('aria-expanded', conceptItem.expanded.toString());
        conceptHeader.setAttribute('aria-controls', `${conceptItem.id}-children`);

        // Get appropriate icon using the new getItemIcon method
        const icon = this.getItemIcon('concept', conceptItem.status, conceptItem.expanded);

        // Create status indicator
        let statusIndicator = '';
        if (conceptItem.status === 'completed') {
            statusIndicator = '<div class="status-icon text-green-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>';
        }

        // Handle special case for single sub-concept with same title
        if (conceptItem.isSingleSubConceptWithSameTitle) {
            // Hide chevron for single sub-concept case
            conceptHeader.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <div class="flex items-center space-x-3 flex-1">
                        <div class="status-icon ${conceptItem.status}">
                            ${icon}
                        </div>
                        <div class="nav-content">
                            <div class="sidebar-item-title">${conceptItem.title}</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${statusIndicator}
                    </div>
                </div>
            `;
        } else {
            // Normal expandable concept with chevron
            conceptHeader.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <div class="flex items-center space-x-3 flex-1">
                        <div class="status-icon ${conceptItem.status}">
                            ${icon}
                        </div>
                        <div class="nav-content">
                            <div class="sidebar-item-title">${conceptItem.title}</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${statusIndicator}
                        <div class="chevron-icon">
                            ${this.getItemIcon(conceptItem.expanded ? 'collapse_chevron' : 'expand_chevron')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Smart click handler for entire concept header (consolidated behavior)
        conceptHeader.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (conceptItem.locked) {
                this.showLockedMessage(conceptItem.title, 'concept', { id: conceptItem.id });
                return;
            }

            // Special handling for single sub-concept with same title
            if (conceptItem.isSingleSubConceptWithSameTitle) {
                // Navigate directly to the single sub-concept
                const subConcept = conceptItem.children && conceptItem.children.length > 0
                    ? conceptItem.children[0]
                    : null;

                if (subConcept) {
                    window.navigateToPage?.(subConcept.id, {
                        trigger: 'sidebar-click'
                    });
                }
                return;
            }

            // Normal handling for concepts with multiple sub-concepts
            // Check if any sub-concept in this concept is currently active
            const currentPageId = window.paginationSystem?.getCurrentPage()?.id;
            const isAnySubConceptActive = conceptItem.children &&
                conceptItem.children.some(child => child.id === currentPageId);

            const container = conceptHeader.closest('.sidebar-item');
            const isExpanded = container?.classList.contains('expanded');

            if (isAnySubConceptActive) {
                // User is currently on a sub-concept within this concept
                // Click should only toggle expand/collapse
                this.toggleConceptExpansion(conceptItem.id);
            } else {
                // User is NOT on a sub-concept within this concept
                // Click should expand AND navigate to first sub-concept
                if (!isExpanded) {
                    this.toggleConceptExpansion(conceptItem.id);
                }

                // Navigate to the first sub-concept if available
                const firstSubConcept = conceptItem.children && conceptItem.children.length > 0
                    ? conceptItem.children[0]
                    : null;

                if (firstSubConcept) {
                    window.navigateToPage?.(firstSubConcept.id, {
                        trigger: 'sidebar-click'
                    });
                }
            }
        });

        // No tooltip handlers - using toast notifications instead for consistent UX

        container.appendChild(conceptHeader);

        // Children container (sub-concepts) - only for concepts that are NOT single sub-concept with same title
        if (!conceptItem.isSingleSubConceptWithSameTitle) {
            const childrenContainer = document.createElement('div');
            childrenContainer.id = `${conceptItem.id}-children`;
            childrenContainer.className = 'sidebar-children';
            childrenContainer.setAttribute('role', 'group');
            childrenContainer.setAttribute('aria-label', `${conceptItem.title} sub-concepts`);

            conceptItem.children.forEach(child => {
                const childIsCurrent = window.paginationSystem?.getCurrentPage()?.id === child.id;
                const childElement = this.createChildNavItem(child, conceptItem, learningState, childIsCurrent);
                childrenContainer.appendChild(childElement);
            });

            container.appendChild(childrenContainer);
        }

        return container;
    }

    /**
     * Create a simple navigation item (introduction, task, quiz)
     */
    createSimpleNavItem(item, learningState, isCurrentPage) {
        const navItem = document.createElement('button');
        navItem.className = `sidebar-item ${item.type} ${item.locked ? 'locked' : ''} ${isCurrentPage ? 'current-page' : ''} w-full text-left p-3 rounded-lg transition-all duration-200`;
        navItem.setAttribute('data-page-id', item.id);
        navItem.setAttribute('aria-label', `${item.title}, ${item.locked ? 'locked' : isCurrentPage ? 'current page' : 'available'}`);

        // Get appropriate icon using the new getItemIcon method
        const icon = this.getItemIcon(item.type, item.status);

        // Create status indicator
        let statusIndicator = '';
        if (item.status === 'completed') {
            statusIndicator = '<div class="status-icon text-green-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>';
        } else if (isCurrentPage) {
            statusIndicator = '<div class="current-indicator w-2 h-2 bg-blue-500 rounded-full"></div>';
        }

        navItem.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center space-x-3">
                    <div class="status-icon ${item.status}">
                        ${icon}
                    </div>
                    <div class="nav-content">
                        <div class="sidebar-item-title">${item.title}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    ${statusIndicator}
                </div>
            </div>
        `;

        // Click handler for navigation with toast notification for locked items
        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (item.locked) {
                // Show toast with specific unlock message based on item type
                if (item.type === 'final-quiz') {
                    this.showLockedMessage(item.title, 'final-quiz', item);
                } else if (item.type === 'task') {
                    // Find the task data to get unlock_after
                    const taskData = this.tasks.find(t => t.id === item.id);
                    this.showLockedMessage(item.title, 'task', taskData || item);
                } else {
                    this.showLockedMessage(item.title, item.type, item);
                }
            } else {
                window.navigateToPage?.(item.id, {
                    trigger: 'sidebar-click'
                });
            }
        });

        return navItem;
    }

    /**
     * Create a child navigation item (sub-concept)
     */
    createChildNavItem(child, parent, learningState, isCurrentPage) {
        const childItem = document.createElement('button');
        childItem.className = `sidebar-item sub-concept ${child.locked ? 'locked' : ''} ${isCurrentPage ? 'current-page' : ''} w-full text-left p-2 pl-6 rounded transition-all duration-200`;
        childItem.setAttribute('data-page-id', child.id);
        childItem.setAttribute('aria-label', `${child.title}, ${child.locked ? 'locked' : isCurrentPage ? 'current page' : 'available'}`);

        // Create status indicator - no icon for sub-concepts, only show completion indicator if needed
        let statusIndicator = '';
        let iconHtml = '';

        // Only show checkmark icon if completed, not the default book icon
        if (child.status === 'completed') {
            iconHtml = '<div class="status-icon text-green-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>';
        }

        if (isCurrentPage) {
            statusIndicator = '<div class="current-indicator w-2 h-2 bg-blue-500 rounded-full"></div>';
        }

        childItem.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center space-x-3">
                    ${iconHtml}
                    <div class="nav-content">
                        <div class="sidebar-item-title">${child.title}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    ${statusIndicator}
                </div>
            </div>
        `;

        // Click handler for navigation
        childItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (child.locked) {
                this.showLockedMessage(child.title, 'sub-concept', { parent: parent.id });
            } else {
                window.navigateToPage?.(child.id, {
                    trigger: 'sidebar-click'
                });
            }
        });

        return childItem;
    }

    /**
     * Toggle concept expansion
     */
    toggleConceptExpansion(conceptId) {
        const conceptItem = document.querySelector(`[aria-controls="${conceptId}-children"]`);
        const childrenContainer = document.getElementById(`${conceptId}-children`);

        if (conceptItem && childrenContainer) {
            const isExpanded = conceptItem.getAttribute('aria-expanded') === 'true';
            const newExpanded = !isExpanded;

            // Store the expansion state
            if (newExpanded) {
                this.expandedConcepts.add(conceptId);
            } else {
                this.expandedConcepts.delete(conceptId);
            }

            conceptItem.setAttribute('aria-expanded', newExpanded.toString());

            // Update visual state
            const container = conceptItem.closest('.sidebar-item');
            if (newExpanded) {
                container.classList.add('expanded');
                container.classList.remove('collapsed');
            } else {
                container.classList.add('collapsed');
                container.classList.remove('expanded');
            }

            // Find and rotate chevron icon specifically (not status icons)
            const chevronContainer = conceptItem.querySelector('.chevron-icon');
            if (chevronContainer) {
                const chevron = chevronContainer.querySelector('svg');
                if (chevron) {
                    if (newExpanded) {
                        chevron.style.transform = 'rotate(180deg)';
                    } else {
                        chevron.style.transform = 'rotate(0deg)';
                    }
                }
            }
        }
    }

    /**
     * Show locked message with specific unlock requirements
     */
    showLockedMessage(itemTitle, itemType = 'item', itemDetails = null) {
        let message = '';

        if (itemType === 'final-quiz') {
            // Final assessment - needs all concepts completed
            const learningState = this.getLearningState();
            const incompleteConcepts = this.concepts.filter(c => !learningState.completedConcepts.has(c.id));
            if (incompleteConcepts.length > 0) {
                if (incompleteConcepts.length === 1) {
                    message = `Complete "${incompleteConcepts[0].title}" to unlock the Final Assessment.`;
                } else {
                    message = `Complete all ${incompleteConcepts.length} remaining concepts to unlock the Final Assessment.`;
                }
            } else {
                message = `"${itemTitle}" is locked. Complete all concepts to unlock it.`;
            }
        } else if (itemType === 'concept' && itemDetails) {
            // Concept - needs previous concept completed
            const conceptIndex = this.concepts.findIndex(c => c.id === itemDetails.id);
            if (conceptIndex > 0) {
                const previousConcept = this.concepts[conceptIndex - 1];
                message = `Complete "${previousConcept.title}" to unlock "${itemTitle}".`;
            } else {
                message = `"${itemTitle}" is locked. Complete previous content to unlock it.`;
            }
        } else if (itemType === 'task' && itemDetails) {
            // Task - needs specific concept completed
            const requiredConceptId = itemDetails.unlock_after;
            if (requiredConceptId) {
                const requiredConcept = this.concepts.find(c => c.id === requiredConceptId);
                if (requiredConcept) {
                    message = `Complete "${requiredConcept.title}" to unlock this task.`;
                } else {
                    message = `"${itemTitle}" is locked. Complete the required concept to unlock it.`;
                }
            } else {
                message = `"${itemTitle}" is locked. Complete previous content to unlock it.`;
            }
        } else if (itemType === 'sub-concept' && itemDetails) {
            // Sub-concept - needs parent concept unlocked
            const parentConcept = this.concepts.find(c => c.id === itemDetails.parent);
            if (parentConcept) {
                const conceptIndex = this.concepts.findIndex(c => c.id === parentConcept.id);
                if (conceptIndex > 0) {
                    const previousConcept = this.concepts[conceptIndex - 1];
                    message = `Complete "${previousConcept.title}" to unlock "${itemTitle}".`;
                } else {
                    message = `"${itemTitle}" is locked. Complete previous content to unlock it.`;
                }
            } else {
                message = `"${itemTitle}" is locked. Complete previous content to unlock it.`;
            }
        } else {
            message = `"${itemTitle}" is locked. Complete previous content to unlock it.`;
        }

        if (window.accessibilityManager) {
            window.accessibilityManager.announceToScreenReader(message, 'assertive');
        }
        if (window.showNotification) {
            window.showNotification(message, 'warning');
        } else {
            console.log(message);
        }
    }

    /**
     * Update current page highlighting with intelligent concept expansion
     */
    updateCurrentPage(pageId) {
        // Remove current-page class from all items using correct selector
        document.querySelectorAll('.sidebar-item.current-page').forEach(item => {
            item.classList.remove('current-page');
        });

        // First try to find the direct page element
        let currentPageElement = document.querySelector(`[data-page-id="${pageId}"]`);

        // Special case: If pageId is a sub-concept of a single-sub-concept concept, highlight the concept instead
        if (!currentPageElement) {
            // Check if this pageId is a sub-concept that belongs to a single-sub-concept concept
            this.concepts.forEach(concept => {
                if (this.hasSingleSubConceptWithSameTitle(concept) && concept.sub_concepts && concept.sub_concepts.length > 0) {
                    const subConcept = concept.sub_concepts[0];
                    if (subConcept.id === pageId) {
                        // Find the concept element (concepts don't have data-page-id, so we need a different approach)
                        currentPageElement = document.querySelector(`.sidebar-item[data-concept-id="${concept.id}"]`);
                    }
                }
            });
        }

        if (currentPageElement) {
            currentPageElement.classList.add('current-page');

            // Handle concept expansion/collapse logic
            this.expandConceptForPage(pageId);

            // Scroll current page into view in sidebar
            this.scrollToCurrentPage(currentPageElement);
        }
    }

    /**
     * Expand concept containing the current page and collapse others
     */
    expandConceptForPage(pageId) {
        const pageElement = document.querySelector(`[data-page-id="${pageId}"]`);
        if (!pageElement) {
            return;
        }

        // Check if this page is a sub-concept within a concept
        const isSubConcept = pageElement.classList.contains('sub-concept');

        if (isSubConcept) {
            // Find the parent concept container - look for a sidebar-item that contains a header with aria-controls
            let parentConceptContainer = pageElement.closest('.sidebar-item');

            // Make sure this container actually contains concept header with children
            while (parentConceptContainer) {
                const conceptHeader = parentConceptContainer.querySelector('.sidebar-item-header[aria-controls]');
                const childrenContainer = parentConceptContainer.querySelector('.sidebar-children');

                if (conceptHeader && childrenContainer && childrenContainer.contains(pageElement)) {
                    // Found the correct parent concept container
                    break;
                }

                // Try the next parent up
                parentConceptContainer = parentConceptContainer.parentElement.closest('.sidebar-item');
            }

            if (parentConceptContainer) {
                // Get the concept ID from the parent container
                const conceptHeader = parentConceptContainer.querySelector('[aria-controls]');
                const conceptId = conceptHeader?.getAttribute('aria-controls')?.replace('-children', '');

                if (conceptId) {
                    // Ensure this concept is expanded
                    if (!parentConceptContainer.classList.contains('expanded')) {
                        this.toggleConceptExpansion(conceptId);
                    }

                    // Collapse all other concepts
                    this.collapseAllConceptsExcept(conceptId);
                }
            }
        } else {
            // This is a top-level item (introduction, task, quiz), collapse all concepts
            this.collapseAllConceptsExcept(null);
        }
    }

    /**
     * Collapse all concepts except the specified one
     */
    collapseAllConceptsExcept(exceptConceptId) {
        const allConceptItems = document.querySelectorAll('.sidebar-item');

        allConceptItems.forEach(conceptItem => {
            const conceptHeader = conceptItem.querySelector('[aria-controls]');
            const conceptId = conceptHeader?.getAttribute('aria-controls')?.replace('-children', '');

            if (conceptId && conceptId !== exceptConceptId && conceptItem.classList.contains('expanded')) {
                // Collapse this concept
                this.toggleConceptExpansion(conceptId);
            }
        });
    }

    /**
     * Scroll current page into view in sidebar
     */
    scrollToCurrentPage(pageElement) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
            const sidebar = document.querySelector('.sidebar-navigation');
            if (sidebar && pageElement) {
                // Check if element is outside the visible area of sidebar
                const sidebarRect = sidebar.getBoundingClientRect();
                const elementRect = pageElement.getBoundingClientRect();

                // If element is not fully visible, scroll it into view
                if (elementRect.top < sidebarRect.top || elementRect.bottom > sidebarRect.bottom) {
                    pageElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }
            }
        });
    }

    /**
     * Get sub-concept status
     */
    getSubConceptStatus(subConceptId, learningState) {
        // For now, use parent concept status
        // This could be enhanced to track individual sub-concept completion
        return 'available';
    }

    /**
     * Check if task is unlocked
     */
    isTaskUnlocked(task, learningState) {
        if (!task.unlock_after) return true;
        return learningState.completedConcepts.has(task.unlock_after);
    }

    /**
     * Check if final quiz is unlocked
     */
    isFinalQuizUnlocked(learningState) {
        return this.concepts.every(concept => learningState.completedConcepts.has(concept.id));
    }

    /**
     * Create a concept navigation item (legacy)
     */
    createConceptNavItem(concept, index, learningState) {
        const conceptId = concept.id || `concept-${index}`;
        const status = this.getConceptStatus(conceptId, learningState);
        const isCompleted = learningState.completedConcepts.has(conceptId);
        const isCurrent = learningState.currentConceptId === conceptId;

        const navItem = document.createElement('a');
        navItem.href = `#${conceptId}`;
        navItem.className = `nav-item ${status}`;
        navItem.setAttribute('data-section', conceptId);
        navItem.setAttribute('aria-label', `Concept: ${concept.title}`);

        const iconClass = isCompleted ? 'completed' : isCurrent ? 'current' : status;

        navItem.innerHTML = `
            <div class="nav-icon ${iconClass}">
                ${this.getIconForStatus(status, isCompleted, isCurrent)}
            </div>
            <div class="nav-content">
                <div class="nav-title">${concept.title}</div>
                ${isCompleted ? '<div class="nav-subtitle">Completed</div>' : ''}
            </div>
            ${isCompleted ? '<div class="check-mark">✓</div>' : ''}
        `;

        // Add click handler for direct navigation
        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (status !== 'locked') {
                this.scrollToSection(conceptId);
            }
        });

        return navItem;
    }

    /**
     * Create a task navigation item
     */
    createTaskNavItem(task, index, learningState) {
        const taskId = task.id || `task-${index}`;
        const status = this.getTaskStatus(task, learningState);
        const isCompleted = learningState.completedTasks.has(taskId);

        const navItem = document.createElement('a');
        navItem.href = `#${taskId}`;
        navItem.className = `nav-item ${status}`;
        navItem.setAttribute('data-section', taskId);
        navItem.setAttribute('aria-label', `Task: ${task.title}`);

        const iconClass = isCompleted ? 'completed' : status;

        navItem.innerHTML = `
            <div class="nav-icon ${iconClass}">
                ${this.icons.task}
            </div>
            <div class="nav-content">
                <div class="nav-title">${task.title}</div>
                ${task.unlock_after ? `<div class="nav-subtitle">Requires: ${task.unlock_after}</div>` : ''}
            </div>
            ${isCompleted ? '<div class="check-mark">✓</div>' : ''}
        `;

        // Add click handler for direct navigation
        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (status !== 'locked') {
                this.scrollToSection(taskId);
            }
        });

        return navItem;
    }

    /**
     * Create a quiz navigation item
     */
    createQuizNavItem(learningState) {
        const status = this.getQuizStatus(learningState);
        const isCompleted = learningState.completedQuiz;

        const navItem = document.createElement('a');
        navItem.href = '#quiz';
        navItem.className = `nav-item quiz ${status}`;
        navItem.setAttribute('data-section', 'quiz');
        navItem.setAttribute('aria-label', 'Final Assessment Quiz');

        navItem.innerHTML = `
            <div class="nav-icon ${isCompleted ? 'completed' : 'current'}">
                ${this.icons.quiz}
            </div>
            <div class="nav-content">
                <div class="nav-title">${this.quiz.title || 'Final Assessment'}</div>
                ${this.quiz.description ? `<div class="nav-subtitle">${this.quiz.description}</div>` : ''}
            </div>
            ${isCompleted ? '<div class="check-mark">✓</div>' : ''}
        `;

        // Add click handler for direct navigation
        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            this.scrollToSection('quiz');
        });

        return navItem;
    }

    /**
     * Get appropriate icon for status
     */
    getIconForStatus(status, isCompleted, isCurrent) {
        if (isCompleted) return this.icons.completed;
        if (isCurrent) return this.icons.current;
        if (status === 'locked') return this.icons.locked;
        return this.icons.available;
    }

    /**
     * Get concept completion status
     */
    getConceptStatus(conceptId, learningState) {
        if (learningState.completedConcepts.has(conceptId)) return 'completed';
        if (learningState.currentConceptId === conceptId) return 'current';
        if (this.isConceptUnlocked(conceptId, learningState)) return 'available';
        return 'locked';
    }

    /**
     * Get task completion status
     */
    getTaskStatus(task, learningState) {
        const taskId = task.id || `task-${this.tasks.indexOf(task)}`;
        if (learningState.completedTasks.has(taskId)) return 'completed';
        if (this.isTaskUnlocked(task, learningState)) return 'available';
        return 'locked';
    }

    /**
     * Get quiz completion status
     */
    getQuizStatus(learningState) {
        // Check if quiz is locked first
        const isUnlocked = this.isFinalQuizUnlocked(learningState);
        if (!isUnlocked) {
            return 'locked';
        }

        // Check if quiz was completed AND passed (not just attempted)
        if (learningState.completedQuiz) {
            // Check quizResults for pass status - only mark completed if passed
            const quizResults = window.learningPathState?.quizResults;
            if (quizResults && quizResults.passed) {
                return 'completed';
            }
        }

        return 'available';
    }

    /**
     * Check if a concept is unlocked
     */
    isConceptUnlocked(conceptId, learningState) {
        // First concept is always unlocked
        const conceptIndex = this.concepts.findIndex(c => c.id === conceptId);
        if (conceptIndex === 0) return true;

        // Check if previous concept is completed
        const previousConcept = this.concepts[conceptIndex - 1];
        return previousConcept && learningState.completedConcepts.has(previousConcept.id);
    }

    /**
     * Check if a task is unlocked
     */
    isTaskUnlocked(task, learningState) {
        if (!task.unlock_after) return true;
        return learningState.completedConcepts.has(task.unlock_after);
    }

    /**
     * Get current learning state from learningPathState
     */
    getLearningState() {
        // Try to get state from learningPathState
        if (window.learningPathState) {
            return {
                completedConcepts: window.learningPathState.completedConcepts || new Set(),
                completedTasks: window.learningPathState.completedTasks || new Set(),
                currentConceptId: window.learningPathState.currentConceptId || null,
                completedQuiz: window.learningPathState.completedQuiz || false,
                unlockedTasks: window.learningPathState.unlockedTasks || new Set()
            };
        }

        // Fallback: try to get from SCORM or localStorage
        const scormData = this.getSCORMData();
        return {
            completedConcepts: new Set(scormData.completedConcepts || []),
            completedTasks: new Set(scormData.completedTasks || []),
            currentConceptId: scormData.currentConceptId || null,
            completedQuiz: scormData.completedQuiz || false,
            unlockedTasks: new Set(scormData.unlockedTasks || [])
        };
    }

    /**
     * Check for SCORM state changes
     */
    checkSCORMStateChanges() {
        try {
            // First check learningPathState directly (more reliable)
            const currentLearningState = this.getLearningState();
            const currentLearningStateString = JSON.stringify({
                completedConcepts: Array.from(currentLearningState.completedConcepts).sort(),
                completedTasks: Array.from(currentLearningState.completedTasks || []).sort(),
                currentConceptId: currentLearningState.currentConceptId,
                completedQuiz: currentLearningState.completedQuiz
            });

            if (this.lastLearningState !== currentLearningStateString) {
                console.log('Learning path state change detected, updating sidebar');
                this.lastLearningState = currentLearningStateString;
                this.updateProgress();
                this.renderNavigationItems();
                return;
            }

            // Also check SCORM state
            if (window.scorm) {
                const suspendData = window.scorm.get_suspend_data();
                if (suspendData) {
                    const currentData = JSON.parse(suspendData);
                    const currentDataString = JSON.stringify({
                        completedConcepts: (currentData.completedConcepts || []).sort(),
                        completedTasks: (currentData.completedTasks || []).sort(),
                        currentConceptId: currentData.currentConceptId,
                        completedQuiz: currentData.completedQuiz
                    });

                    // Compare with previous SCORM state
                    if (this.lastSCORMState !== currentDataString) {
                        console.log('SCORM state change detected, updating sidebar');
                        this.lastSCORMState = currentDataString;
                        this.updateProgress();
                        this.renderNavigationItems();
                    }
                }
            }
        } catch (error) {
            // Ignore SCORM errors
        }
    }

    /**
     * Get data from SCORM storage
     */
    getSCORMData() {
        try {
            if (window.scorm) {
                const suspendData = window.scorm.get_suspend_data();
                if (suspendData) {
                    return JSON.parse(suspendData);
                }
            }
        } catch (error) {
            console.warn('Error reading SCORM data:', error);
        }

        // Fallback to localStorage
        try {
            const localData = localStorage.getItem('scorm_v2_state');
            return localData ? JSON.parse(localData) : {};
        } catch (error) {
            console.warn('Error reading local state:', error);
            return {};
        }
    }

    /**
     * Update progress indicators
     */
    updateProgress() {
        var learningState = this.getLearningState();

        var totalItems = this.tasks.length;
        var completedItems = learningState.completedTasks.size;

        var percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        this.updateProgressRing(percentage);
        this.updateProgressText(percentage, learningState);
        this.updateSectionCounts();
    }

    /**
     * Update progress ring visualization
     */
    updateProgressRing(percentage) {
        const progressRing = document.getElementById('progressRing');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressStatus = document.getElementById('progressStatus');

        if (progressRing) {
            const circumference = 2 * Math.PI * 20; // radius = 20
            const offset = circumference - (percentage / 100 * circumference);
            progressRing.style.strokeDashoffset = offset;
        }

        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }

        if (progressStatus) {
            if (percentage === 0) {
                progressStatus.textContent = 'Starting';
            } else if (percentage < 25) {
                progressStatus.textContent = 'Beginning';
            } else if (percentage < 50) {
                progressStatus.textContent = 'In Progress';
            } else if (percentage < 75) {
                progressStatus.textContent = 'Making Progress';
            } else if (percentage < 100) {
                progressStatus.textContent = 'Almost Done';
            } else {
                progressStatus.textContent = 'Completed';
            }
        }
    }

    /**
     * Update progress text displays
     */
    updateProgressText(percentage, learningState) {
        var tasksProgress = document.getElementById('tasksProgress');
        if (tasksProgress) {
            tasksProgress.textContent = learningState.completedTasks.size + '/' + this.tasks.length;
        }
    }

    /**
     * Update section counts
     */
    updateSectionCounts() {
        var tasksProgress = document.getElementById('tasksProgress');
        var learningState = this.getLearningState();

        if (tasksProgress) {
            tasksProgress.textContent = learningState.completedTasks.size + '/' + this.tasks.length;
        }
    }

    /**
     * Toggle sidebar open/closed
     */
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /**
     * Open sidebar
     */
    open() {
        document.body.classList.add('sidebar-open');
        this.isOpen = true;
        this.saveSidebarState();
    }

    /**
     * Close sidebar
     */
    close() {
        document.body.classList.remove('sidebar-open');
        this.isOpen = false;
        this.saveSidebarState();
    }


    /**
     * Scroll to specific section
     */
    scrollToSection(sectionId) {
        console.log(`Attempting to scroll to section: ${sectionId}`);

        // Try multiple possible selectors to find the element
        let element = document.getElementById(sectionId);
        console.log(`ID selector found:`, !!element);

        // If not found, try with different prefixes
        if (!element) {
            element = document.querySelector(`[id="${sectionId}"]`);
            console.log(`Attribute selector found:`, !!element);
        }

        // For concepts, also try class-based selectors
        if (!element && sectionId.startsWith('concept-')) {
            const conceptIndex = sectionId.replace('concept-', '');
            element = document.querySelector(`[data-concept-index="${conceptIndex}"]`) ||
                document.querySelector(`.concept-card[data-id="${sectionId}"]`) ||
                document.querySelector(`[data-concept-id="${sectionId}"]`) ||
                document.querySelector(`#concept-${parseInt(conceptIndex) + 1}`); // Fallback for 1-based indexing
            console.log(`Concept fallback selectors found:`, !!element);
        }

        // For tasks, try different selectors
        if (!element && sectionId.startsWith('task-')) {
            const taskIndex = sectionId.replace('task-', '');
            element = document.querySelector(`[data-task-id="${sectionId}"]`) ||
                document.querySelector(`[data-task-index="${taskIndex}"]`) ||
                document.querySelector(`#task-${parseInt(taskIndex) + 1}`); // Fallback for 1-based indexing
            console.log(`Task fallback selectors found:`, !!element);
        }

        // For quiz, try specific selectors
        if (!element && sectionId === 'quiz') {
            element = document.querySelector('#quiz') ||
                document.querySelector('[id="quiz"]') ||
                document.querySelector('section:has(.bg-gradient-to-r.from-purple-6)'); // More specific selector
            console.log(`Quiz selectors found:`, !!element);
        }

        if (element) {
            // Get header height for offset
            const header = document.querySelector('header');
            const headerHeight = header ? header.offsetHeight : 80;
            const offset = headerHeight + 20; // Add extra spacing

            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            console.log(`Scrolling to section: ${sectionId}, element found:`, element, `position: ${offsetPosition}`);

            // Smooth scroll to element
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Update current section after a short delay to ensure scroll completes
            setTimeout(() => {
                this.setCurrentSection(sectionId);
            }, 500);
        } else {
            console.warn(`Section not found: ${sectionId}`);
            // Try to scroll to the first matching section as fallback
            this.scrollToFirstAvailableSection();
        }
    }

    /**
     * Scroll to first available section as fallback
     */
    scrollToFirstAvailableSection() {
        // Try to find first concept
        const firstConcept = document.querySelector('[id^="concept-"], .concept-card');
        if (firstConcept) {
            firstConcept.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        // Try to find first task
        const firstTask = document.querySelector('[id^="task-"], .task-section');
        if (firstTask) {
            firstTask.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        // Try to find quiz
        const quiz = document.querySelector('[id^="quiz"]');
        if (quiz) {
            quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Set current active section
     */
    setCurrentSection(sectionId) {
        // Remove current class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('current');
        });

        // Add current class to active nav item
        const activeItem = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeItem) {
            activeItem.classList.add('current');
        }

        this.currentSection = sectionId;
    }

    /**
     * Save sidebar state to localStorage
     */
    saveSidebarState() {
        try {
            localStorage.setItem('sidebarState', JSON.stringify({
                isOpen: this.isOpen
            }));
        } catch (error) {
            console.warn('Error saving sidebar state:', error);
        }
    }

    /**
 * Load sidebar state from localStorage
 * Default: sidebar is OPEN (always visible unless explicitly closed by chat/split-screen)
 */
    loadSidebarState() {
        try {
            // Sidebar defaults to OPEN for better navigation
            // Only close if explicitly saved as closed
            const savedState = localStorage.getItem('sidebarState');
            if (savedState) {
                const state = JSON.parse(savedState);
                if (state.isOpen === false) {
                    this.close();
                    return;
                }
            }
            // Default: open the sidebar
            this.open();
        } catch (error) {
            console.warn('Error loading sidebar state:', error);
            // On error, default to open
            this.open();
        }
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Recalculate layout if needed
        if (window.innerWidth < 768 && this.isOpen) {
            this.close();
        }
    }

    /**
     * Show tooltip for locked items
     */
    showTooltip(element, item) {
        // Remove any existing tooltips
        this.hideTooltip(element);

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'lock-tooltip';

        // Get tooltip message based on item type and requirements
        let message = 'Locked content';
        if (item.type === 'task') {
            message = `Complete prerequisite concept to unlock this task`;
        } else if (item.type === 'final-quiz') {
            message = `Complete all concepts to unlock final assessment`;
        } else if (item.type === 'concept') {
            message = `Complete previous content to unlock this concept`;
        }

        tooltip.textContent = message;

        // Position tooltip relative to the element
        element.style.position = 'relative';
        element.appendChild(tooltip);

        // Store reference for cleanup
        element.tooltip = tooltip;
    }

    /**
     * Hide tooltip for locked items
     */
    hideTooltip(element) {
        if (element.tooltip) {
            element.tooltip.classList.add('hiding');

            // Remove tooltip after animation
            setTimeout(() => {
                if (element.tooltip && element.tooltip.parentNode) {
                    element.tooltip.parentNode.removeChild(element.tooltip);
                }
                element.tooltip = null;
            }, 150);
        }
    }

    /**
     * Check if concept has only one sub-concept with the same title
     */
    hasSingleSubConceptWithSameTitle(concept) {
        return concept.sub_concepts &&
            concept.sub_concepts.length === 1 &&
            concept.sub_concepts[0].title.trim() === concept.title.trim();
    }
}

// Initialize sidebar navigation when script loads
window.sidebarNavigation = new SidebarNavigation();

// Expose for external use
window.SidebarNavigation = SidebarNavigation;
