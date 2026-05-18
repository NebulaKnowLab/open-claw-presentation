// Enhanced Core Learning Functions for Task-Based Learning
let templateData = {};
let currentHint = 0;
let maxHints = 0;
let progressStep = 0;
let topicConfig = {};
let learnerData = {};

// Initialize global topic configuration for pagination system
function initializeGlobalTopicConfig() {
    try {
        const templateDataElement = document.getElementById('templateData');
        if (templateDataElement) {
            const data = JSON.parse(templateDataElement.textContent);

            // Set up global topic configuration for pagination system
            window.topicConfig = {
                title: data.title || data.id || 'Course',
                courseId: data.courseId || '',
                description: data.description || '',
                concepts: data.concepts || [],
                tasks: data.tasks || [],
                quiz: data.quiz || null,
                learning_objectives: data.learning_objectives || [],
                content: data.content || {}
            };

            // Also update the local topicConfig
            topicConfig = {
                topic: window.topicConfig.title,
                backendUrl: data.backendUrl,
                contexts: data.chatContexts || {}
            };

            console.log('Global topic configuration initialized:', window.topicConfig);
        }
    } catch (error) {
        console.error('Error initializing global topic configuration:', error);
        // Set up minimal fallback
        window.topicConfig = {
            title: 'Course',
            courseId: '',
            description: '',
            concepts: [],
            tasks: [],
            quiz: null,
            learning_objectives: [],
            content: {}
        };
    }
}

function initializeTemplate() {
    // Initialize global topic configuration for pagination system
    initializeGlobalTopicConfig();

    // Parse template data
    try {
        templateData = JSON.parse(document.getElementById('templateData').textContent);
    } catch (e) {
        console.error('Failed to parse template data:', e);
        templateData = { hints: [], quiz: null, id: '', backendUrl: '', chatContexts: {} };
    }

    // Initialize variables
    maxHints = templateData.hints ? templateData.hints.length : 0;

    topicConfig = {
        topic: templateData.title || templateData.id,
        backendUrl: templateData.backendUrl,
        contexts: templateData.chatContexts || {}
    };

    // Initialize with default learner data
    learnerData = {
        id: 'anonymous',
        name: 'Learner',
        progress: 'not_attempted'
    };

    // Initialize UI
    updateProgress(1);
    setupHintSystem();

    // Initialize pagination system integration
    initializePaginationIntegration();
}

function updateProgress(step) {
    progressStep = step;
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    const percentage = (step / 4) * 100;
    if (progressFill) progressFill.style.width = percentage + '%';

    const steps = [
        'Task Understanding',
        'Working on Solution',
        'Practice & Application',
        'Knowledge Assessment'
    ];

    if (progressText) progressText.textContent = steps[step - 1] || steps[0];

    // Show next button when completed
    if (step >= 4 && (window.quizCompleted || false)) {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.classList.remove('hidden');
    }
}

// Initialize pagination system integration
function initializePaginationIntegration() {
    // Set up global functions and integrations for pagination system

    // Make template data available globally for pagination system
    window.templateData = templateData;

    // Set up compatibility functions for existing systems
    window.openConceptQuiz = function (conceptId) {
        console.log('🎯 openConceptQuiz called for:', conceptId);

        // Check what functions are available
        console.log('🔍 Available functions:', {
            toggleConceptQuiz: typeof toggleConceptQuiz,
            showConceptQuiz: typeof showConceptQuiz,
            windowToggleConceptQuiz: typeof window.toggleConceptQuiz
        });

        // Use the existing inline quiz system first
        if (typeof toggleConceptQuiz === 'function') {
            console.log('🎯 Using toggleConceptQuiz function');
            toggleConceptQuiz(conceptId);
        } else if (typeof window.toggleConceptQuiz === 'function') {
            console.log('🎯 Using window.toggleConceptQuiz function');
            window.toggleConceptQuiz(conceptId);
        } else if (typeof showConceptQuiz === 'function') {
            console.log('🎯 Using showConceptQuiz function');
            showConceptQuiz(conceptId);
        } else {
            console.error('❌ Quiz system not available');
        }
    };

    window.initializeTask = function (task) {
        console.log('Initializing task:', task.id);

        // Initialize existing task system
        if (typeof setupTaskForStep === 'function') {
            // For multi-step tasks, initialize the first step
            if (task.steps && task.steps.length > 0) {
                setupTaskForStep(task.id, 0);
            }
        }

        // Initialize task-specific UI components
        initializeTaskUI(task);

        // Announce for accessibility
        if (window.accessibilityManager) {
            window.accessibilityManager.announceToScreenReader(`Task "${task.title}" loaded`);
        }
    };

    window.initializeFinalQuiz = function (quiz) {
        console.log('Initializing final quiz');

        // Initialize existing quiz system
        if (typeof initializeQuiz === 'function') {
            initializeQuiz(quiz);
        }

        // Announce for accessibility
        if (window.accessibilityManager) {
            window.accessibilityManager.announceToScreenReader('Final quiz loaded');
        }
    };

    // Enhanced notification system
    window.showNotification = function (message, type = 'info') {
        console.log(`Notification (${type}): ${message}`);

        // Create visual notification if not exists
        createNotification(message, type);

        // Announce for accessibility
        if (window.accessibilityManager) {
            window.accessibilityManager.announceToScreenReader(message, type === 'error' ? 'assertive' : 'polite');
        }
    };

    // Create notification element
    function createNotification(message, type) {
        // Remove existing notifications
        const existingNotification = document.querySelector('.notification-toast');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;

        const bgColors = {
            info: 'bg-blue-500',
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500'
        };

        notification.classList.add(bgColors[type] || bgColors.info, 'text-white');
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="flex-1">${message}</div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }

    // Initialize task UI components
    function initializeTaskUI(task) {
        const container = document.getElementById(`task-${task.id}-container`);
        if (!container) return;

        let taskHTML = `
            <div class="task-content">
                <h3 class="text-xl font-semibold mb-4">${task.title}</h3>
                <p class="text-gray-600 mb-6">${task.description || ''}</p>
        `;

        if (task.steps && task.steps.length > 0) {
            taskHTML += '<div class="task-steps">';
            task.steps.forEach((step, index) => {
                taskHTML += `
                    <div class="task-step mb-6 p-4 border rounded-lg ${index === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}" data-step-index="${index}">
                        <h4 class="font-medium mb-2">Step ${index + 1}: ${step.title}</h4>
                        ${step.description ? `<p class="text-gray-600 mb-3">${step.description}</p>` : ''}
                        ${step.content ? `<div class="step-content">${step.content}</div>` : ''}
                        ${step.code ? `
                            <div class="code-block mt-3">
                                <pre><code>${step.code}</code></pre>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            taskHTML += '</div>';
        }

        taskHTML += '</div>';
        container.innerHTML = taskHTML;

        // Initialize step navigation if needed
        if (task.steps && task.steps.length > 1 && typeof setupTaskStepNavigation === 'function') {
            setupTaskStepNavigation(task.id);
        }
    }
}

function setupHintSystem() {
    const hints = document.querySelectorAll('.hint-card');
    hints.forEach((hint, index) => {
        hint.setAttribute('data-hint-index', index);
        if (index > 0) {
            hint.classList.add('opacity-50');
        }
    });
}

function toggleHintsSection() {
    const container = document.getElementById('hintsContainer');
    const toggleText = document.getElementById('hintsToggleText');

    if (container && toggleText) {
        const isHidden = container.classList.contains('hidden');

        if (isHidden) {
            container.classList.remove('hidden');
            toggleText.textContent = 'Hide Hints';
            updateProgress(2);
        } else {
            container.classList.add('hidden');
            toggleText.textContent = 'Show Hints';
        }
    }
}

function revealNextHint() {
    if (currentHint < maxHints) {
        const hint = document.querySelector(`[data-hint-index="${currentHint}"]`);
        if (hint) {
            hint.classList.remove('opacity-50');
            hint.classList.add('opacity-100');
            hint.style.transform = 'scale(1.02)';

            // Add subtle animation
            setTimeout(() => {
                hint.style.transform = 'scale(1)';
            }, 200);

            currentHint++;
        }

        // Show "need more help" button when all hints are exhausted
        if (currentHint >= maxHints) {
            const exhaustedBtn = document.getElementById('hintsExhaustedBtn');
            if (exhaustedBtn) {
                exhaustedBtn.classList.remove('hidden');
            }
        }

        // Update progress when hints are being used
        if (currentHint === 1) {
            updateProgress(2);
        }
    }
}

// Learning state management
function recordLearningAction(action, context = {}) {
    const learningEvent = {
        timestamp: new Date().toISOString(),
        action: action,
        topic: topicConfig.topic,
        progress: progressStep,
        context: context
    };

    // Store in session for potential SCORM reporting
    if (typeof sessionStorage !== 'undefined') {
        const events = JSON.parse(sessionStorage.getItem('learningEvents') || '[]');
        events.push(learningEvent);
        sessionStorage.setItem('learningEvents', JSON.stringify(events));
    }

    console.log('Learning Action:', learningEvent);
}

// Task interaction tracking
function startTask() {
    recordLearningAction('task_started');
    updateProgress(2);

    // Open help automatically for task guidance
    if (typeof openTaskHelp === 'function') {
        openTaskHelp();
    }
}

function taskCompleted() {
    recordLearningAction('task_completed');
    updateProgress(3);
}

function getCompletionStatus() {
    // Get quiz status from the multi-question system if available
    const multiQuizStatus = {
        quizCompleted: window.quizCompleted || false,
        quizScore: window.quizScore || 0,
        currentQuestionIndex: window.currentQuestionIndex || 0,
        totalQuestions: window.quizQuestions ? window.quizQuestions.length : 0,
        answers: window.quizAnswers || {},
        questionTypes: window.quizQuestions ? window.quizQuestions.map(q => q.type || 'mcq') : []
    };

    return {
        progressStep: progressStep,
        hintsRevealed: currentHint,
        quizCompleted: multiQuizStatus.quizCompleted,
        multiQuiz: multiQuizStatus
    };
}

// Code Modal Functions
function openCodeModal(code, language) {
    const modal = document.getElementById('codeModal');
    const codeContent = document.getElementById('modalCodeContent');

    if (!modal || !codeContent) return;

    // Clear previous content and classes
    codeContent.textContent = code;
    codeContent.className = '';

    // Remove previous highlight state if any
    if (codeContent.dataset && codeContent.dataset.highlighted) {
        codeContent.removeAttribute('data-highlighted');
    }

    // Apply new language class
    codeContent.classList.add(`language-${language}`);

    modal.classList.remove('hidden');
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.opacity = '1'; }, 10);
}

function closeCodeModal() {
    const modal = document.getElementById('codeModal');
    if (!modal) return;

    modal.style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function copyModalCode() {
    const codeContent = document.getElementById('modalCodeContent');
    if (!codeContent) return;

    navigator.clipboard.writeText(codeContent.textContent).then(() => {
        const btn = document.getElementById('modalCopyBtn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Copied!</span>';
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}


// Code modal event listeners
document.addEventListener('click', (e) => {
    if (e.target.closest('.open-code-modal-btn')) {
        const button = e.target.closest('.open-code-modal-btn');
        const code = button.dataset.code;
        const language = button.dataset.language;

        if (code && language) {
            // Decode HTML entities back to original text
            const decodedCode = code
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#10;/g, '\n')
                .replace(/&#13;/g, '\r')
                .replace(/&#9;/g, '\t')
                .replace(/&#x2028;/g, '\u2028')
                .replace(/&#x2029;/g, '\u2029')
                .replace(/&amp;/g, '&');

            openCodeModal(decodedCode, language);
        }
    }
});

// Close modal on overlay click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('codeModal');
    if (e.target === modal && modal) {
        closeCodeModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('codeModal');
        if (modal && !modal.classList.contains('hidden')) {
            closeCodeModal();
        }
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTemplate);
} else {
    initializeTemplate();
}

// Export functions for global access
window.updateProgress = updateProgress;
window.revealNextHint = revealNextHint;
window.toggleHintsSection = toggleHintsSection;
window.startTask = startTask;
window.taskCompleted = taskCompleted;
window.getCompletionStatus = getCompletionStatus;
window.openCodeModal = openCodeModal;
window.closeCodeModal = closeCodeModal;
window.copyModalCode = copyModalCode;

// Pagination system integration
window.initializeGlobalTopicConfig = initializeGlobalTopicConfig;

// Task event handler delegation - these must be globally accessible for onclick handlers
window.markTaskStepCompleted = function (stepId, taskId) {
    // Delegate to TaskRenderer
    if (window.taskRenderer) {
        window.taskRenderer.markTaskStepCompleted(stepId, taskId);
    } else {
        console.warn('TaskRenderer not available for step completion');
    }
};

window.openTaskWorkspace = function (url, stepId) {
    // Delegate to TaskRenderer
    if (window.taskRenderer) {
        window.taskRenderer.openTaskWorkspace(url, stepId);
    } else {
        console.warn('TaskRenderer not available for workspace opening');
        // Fallback: open in new window
        window.open(url, '_blank', 'width=1200,height=800');
    }
};

// Additional task-related global functions
window.copyCodeFromStep = function (stepIndex) {
    if (window.taskRenderer) {
        window.taskRenderer.copyCodeFromStep(stepIndex);
    } else {
        console.warn('TaskRenderer not available for code copying');
    }
};

window.revealStepHintFromTask = function (stepIndex) {
    if (window.taskRenderer) {
        window.taskRenderer.revealStepHintFromTask(stepIndex);
    } else {
        console.warn('TaskRenderer not available for hint revealing');
    }
};

window.copyHintCodeFromStep = function (stepIndex) {
    if (window.taskRenderer) {
        window.taskRenderer.copyHintCodeFromStep(stepIndex);
    } else {
        console.warn('TaskRenderer not available for hint code copying');
    }
};

window.openCodeModal = function (stepIndex) {
    if (window.taskRenderer) {
        window.taskRenderer.openCodeModal(stepIndex);
    } else if (typeof openCodeModal === 'function') {
        // Fallback to existing function if available
        openCodeModal(stepIndex);
    } else {
        console.warn('Code modal function not available');
    }
};

window.closeCodeModal = function () {
    if (window.taskRenderer) {
        window.taskRenderer.closeCodeModal();
    } else if (typeof closeCodeModal === 'function') {
        // Fallback to existing function if available
        closeCodeModal();
    } else {
        console.warn('Close code modal function not available');
    }
};

window.copyModalCode = function () {
    if (window.taskRenderer) {
        window.taskRenderer.copyModalCode();
    } else if (typeof copyModalCode === 'function') {
        // Fallback to existing function if available
        copyModalCode();
    } else {
        console.warn('Copy modal code function not available');
    }
};
window.initializePaginationIntegration = initializePaginationIntegration;

// ===== SCORM STATE MANAGEMENT FUNCTIONS =====

/**
 * Initialize learning path state from SCORM
 */
function initializeLearningPathState() {
    if (window.scormAPIInstance && window.scormAPIInstance.isConnected()) {
        const state = window.scormAPIInstance.loadStateFromSCORM();
        if (state) {
            // Create learning path state from SCORM data
            window.learningPathState = {
                completedConcepts: new Set(state.completedConcepts || []),
                completedTasks: new Set(state.completedTasks || []),  // Restore completed tasks
                completedQuiz: state.completedQuiz || false,  // Restore quiz completion
                quizResults: state.quizResults || null,  // Restore quiz results
                completedTaskSteps: new Set(state.completedTaskSteps || []),
                unlockedTasks: new Set(state.unlockedTasks || []),
                quizAttempts: state.quizAttempts || {},
                currentPage: state.currentPage || null, // Can be string (page ID) or object
                pageHistory: state.pageHistory || [],
                currentConceptIndex: state.currentConceptIndex || 0,
                currentSubConcepts: state.currentSubConcepts || {},
                readSlideState: state.readSlideState || {},
                sessionInfo: state.sessionInfo || {
                    totalSessions: 1,
                    firstAccess: new Date().toISOString(),
                    lastAccess: new Date().toISOString()
                }
            };

            // Update UI based on loaded state
            updateUIFromLoadedState();
            return;
        }
    }

    // Default state if SCORM is not available
    window.learningPathState = {
        completedConcepts: new Set(),
        completedTasks: new Set(),  // Track completed tasks
        completedQuiz: false,  // Track quiz completion
        quizResults: null,  // Store quiz results
        completedTaskSteps: new Set(),
        unlockedTasks: new Set(),
        quizAttempts: {},
        currentPage: null,
        pageHistory: [],
        currentConceptIndex: 0,
        currentSubConcepts: {},
        readSlideState: {},
        sessionInfo: {
            totalSessions: 1,
            firstAccess: new Date().toISOString(),
            lastAccess: new Date().toISOString()
        }
    };
}

/**
 * Update UI components based on loaded SCORM state
 */
function updateUIFromLoadedState() {
    // Update sidebar navigation
    if (window.sidebarNavigation) {
        window.sidebarNavigation.updateProgress();
        // Only call render if it exists
        if (typeof window.sidebarNavigation.render === 'function') {
            window.sidebarNavigation.render();
        }
    }

    // Update pagination system
    if (window.paginationSystem) {
        window.paginationSystem.updatePageLocks();
    }
}

/**
 * Save complete learning path state to SCORM
 */
function saveLearningPathState() {
    if (window.scormAPIInstance && window.scormAPIInstance.isConnected() && window.learningPathState) {
        const state = {
            completedConcepts: Array.from(window.learningPathState.completedConcepts || []),
            completedTasks: Array.from(window.learningPathState.completedTasks || []),  // Save completed tasks
            completedQuiz: window.learningPathState.completedQuiz || false,  // Save quiz completion
            quizResults: window.learningPathState.quizResults || null,  // Save quiz results
            completedTaskSteps: Array.from(window.learningPathState.completedTaskSteps || []),
            unlockedTasks: Array.from(window.learningPathState.unlockedTasks || []),
            quizAttempts: window.learningPathState.quizAttempts || {},
            currentPage: window.learningPathState.currentPage || null,
            currentConceptIndex: window.learningPathState.currentConceptIndex || 0,
            currentSubConcepts: window.learningPathState.currentSubConcepts || {},
            readSlideState: window.learningPathState.readSlideState || {},
            sessionInfo: window.learningPathState.sessionInfo || {}
        };

        window.scormAPIInstance.saveStateToSCORM(state);
    }
}

/**
 * Mark a concept as completed and save to SCORM
 */
function completeConcept(conceptId) {
    if (!window.learningPathState.completedConcepts.has(conceptId)) {
        window.learningPathState.completedConcepts.add(conceptId);

        // If concept has single sub-concept with same title,
        // also complete the sub-concept for SCORM consistency
        if (window.topicConfig && window.topicConfig.concepts) {
            const concept = window.topicConfig.concepts.find(c => c.id === conceptId);
            if (concept && concept.sub_concepts && concept.sub_concepts.length === 1 &&
                concept.title === concept.sub_concepts[0].title) {
                const subConceptId = concept.sub_concepts[0].id;
                window.learningPathState.completedConcepts.add(subConceptId);
            }
        }

        // Save to SCORM immediately
        saveLearningPathState();

        // Update UI and check unlocks
        updateConceptProgress(conceptId);
        checkAndUnlockConcepts();

        // Dispatch completion event
        window.dispatchEvent(new CustomEvent('conceptCompleted', {
            detail: { conceptId }
        }));
    }
}

/**
 * Mark a task step as completed and save to SCORM
 */
function completeTaskStep(stepId) {
    if (!window.learningPathState.completedTaskSteps.has(stepId)) {
        window.learningPathState.completedTaskSteps.add(stepId);

        // Save to SCORM immediately
        saveLearningPathState();

        // Check if entire task is completed
        checkTaskCompletion(stepId);

        // Dispatch completion event
        window.dispatchEvent(new CustomEvent('taskStepCompleted', {
            detail: { stepId }
        }));
    }
}

/**
 * Check and unlock next concepts
 */
function checkAndUnlockConcepts() {
    if (window.sidebarNavigation) {
        window.sidebarNavigation.updateProgress();
        window.sidebarNavigation.render();
    }
}

/**
 * Update concept progress indicator
 */
function updateConceptProgress(conceptId) {
    // This function can be expanded to show more detailed progress
}

/**
 * Check if task is completed
 */
function checkTaskCompletion(stepId) {
    // This can be expanded to check if all steps in a task are complete
}

// Export the new functions for global access
window.initializeLearningPathState = initializeLearningPathState;
window.saveLearningPathState = saveLearningPathState;
window.completeConcept = completeConcept;
window.completeTaskStep = completeTaskStep;
window.updateUIFromLoadedState = updateUIFromLoadedState;
