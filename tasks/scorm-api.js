// SCORM API Integration
var scormAPI = null;
var scormLearnerData = {
    id: null,
    name: null,
    progress: null
};

// Time tracking data
var scormTimeTracking = {
    sessionStartTime: Date.now(),
    totalSeconds: 0,
    lastSessionTime: 0,
    currentSessionSeconds: 0,
    timeTrackingInterval: null
};

// SCORM API wrapper class
class SCORMAPI {
    constructor() {
        this.api = null;
        this.isInitialized = false;
        this.connectionError = null;
    }

    /**
     * Find SCORM API in window hierarchy
     */
    findAPI(win) {
        while (win) {
            try {
                if (win.API_1484_11) return win.API_1484_11;
            } catch (err) { }
            if (win.parent && win.parent !== win) {
                win = win.parent;
            } else {
                win = win.opener;
            }
        }
        return null;
    }

    /**
     * Initialize SCORM connection
     */
    initialize() {
        this.api = this.findAPI(window);
        if (this.api == null) {
            this.connectionError = "SCORM 2004 API not found. Running in standalone mode.";
            return false;
        }

        try {
            const result = this.api.Initialize("");
            this.isInitialized = result === "true";

            if (this.isInitialized) {
                // Load learner data
                this.loadLearnerData();
                // Initialize time tracking
                this.initializeTimeTracking();

                // CRITICAL: Articulate pattern - set completion and exit status on init
                // This prevents LMS from auto-completing based on session count
                const currentStatus = this.getValue("cmi.completion_status");
                if (!currentStatus || currentStatus === "not attempted" || currentStatus === "unknown") {
                    this.setValue("cmi.completion_status", "incomplete");
                }

                // CRITICAL: Set default exit to "suspend" immediately on init
                // This tells LMS from the start that this is a suspendable session
                // Only when course is 100% complete do we change this to "normal"
                this.setValue("cmi.exit", "suspend");

                // Commit immediately to ensure LMS receives these values
                this.commit();
                console.log('🔒 SCORM Init: completion_status=incomplete, exit=suspend');
            }

            return this.isInitialized;
        } catch (error) {
            this.connectionError = error;
            return false;
        }
    }

    /**
     * Load learner data from SCORM
     */
    loadLearnerData() {
        scormLearnerData.id = this.getValue("cmi.learner_id") ||
            this.getValue("cmi.core.student_id") ||
            this.getValue("cmi.student_id") ||
            "anonymous";

        scormLearnerData.name = this.getValue("cmi.learner_name") ||
            this.getValue("cmi.core.student_name") ||
            this.getValue("cmi.student_name") ||
            this.getValue("cmi.core.learner_name") ||
            "Anonymous Learner";

        scormLearnerData.progress = this.getValue("cmi.completion_status") ||
            this.getValue("cmi.core.lesson_status") ||
            this.getValue("cmi.lesson_status") ||
            "not attempted";
    }

    /**
     * Check if SCORM is connected
     */
    isConnected() {
        return this.api && this.isInitialized;
    }

    /**
     * Get a value from the SCORM data model
     */
    getValue(element) {
        if (!this.isConnected()) return "";

        try {
            return this.api.GetValue(element) || "";
        } catch (error) {
            this.log("Error getting SCORM value:", error);
            return "";
        }
    }

    /**
     * Set a value in the SCORM data model
     */
    setValue(element, value) {
        if (!this.isConnected()) return false;

        try {
            const result = this.api.SetValue(element, value);
            return result === "true";
        } catch (error) {
            this.log("Error setting SCORM value:", error);
            return false;
        }
    }

    /**
     * Commit pending changes to LMS
     */
    commit() {
        if (!this.isConnected()) return false;

        try {
            const result = this.api.Commit("");
            return result === "true";
        } catch (error) {
            this.log("Error committing SCORM data:", error);
            return false;
        }
    }

    /**
     * Terminate SCORM connection
     */
    terminate() {
        if (!this.isConnected()) return false;

        try {
            // Stop time tracking interval
            if (scormTimeTracking.timeTrackingInterval) {
                clearInterval(scormTimeTracking.timeTrackingInterval);
                scormTimeTracking.timeTrackingInterval = null;
            }

            // Save final state
            this.saveCurrentSessionTime();
            const result = this.api.Terminate("");
            this.api = null;
            this.isInitialized = false;
            return result === "true";
        } catch (error) {
            this.log("Error terminating SCORM:", error);
            return false;
        }
    }

    /**
     * Get last error from SCORM API
     */
    getLastError() {
        if (!this.api) return this.connectionError || "SCORM API not available";

        try {
            return this.api.GetLastError();
        } catch (error) {
            return error.message || "Unknown error";
        }
    }

    /**
     * Save complete learning state to SCORM
     */
    saveStateToSCORM(state) {
        if (!this.isConnected()) return false;

        try {
            // First, update time tracking with current session
            const sessionElapsed = Math.floor((Date.now() - scormTimeTracking.sessionStartTime) / 1000);
            const currentTotal = scormTimeTracking.lastSessionTime + sessionElapsed;

            // Include time tracking in state with current values
            state.timeTracking = {
                totalSeconds: currentTotal,
                lastSessionTime: scormTimeTracking.lastSessionTime
            };

            // Save suspend data
            const suspendData = JSON.stringify(state);
            this.setValue("cmi.suspend_data", suspendData);

            // Save location if current page is set
            if (state.currentPage) {
                // If currentPage is a string, use it directly
                // If it's an object, format it
                const location = typeof state.currentPage === 'string'
                    ? state.currentPage
                    : this.formatLocation(state.currentPage);
                this.setValue("cmi.location", location);
            }

            // Save progress measure
            if (state.completedConcepts && window.templateData?.concepts) {
                const progress = state.completedConcepts.length / window.templateData.concepts.length;
                this.setValue("cmi.progress_measure", progress.toFixed(2));
            }

            // Save current session time to LMS
            this.saveCurrentSessionTime();

            return this.commit();
        } catch (error) {
            this.log("Error saving state to SCORM:", error);
            return false;
        }
    }

    /**
     * Load learning state from SCORM
     */
    loadStateFromSCORM() {
        if (!this.isConnected()) return null;

        try {
            // Load suspend data
            const suspendData = this.getValue("cmi.suspend_data") || "{}";
            let state;

            try {
                state = JSON.parse(suspendData);
            } catch (parseError) {
                state = {};
            }

            // Load location
            const location = this.getValue("cmi.location");
            if (location && !state.currentPage) {
                // First try to parse as a formatted location object
                const parsedLocation = this.parseLocation(location);
                if (parsedLocation) {
                    state.currentPage = parsedLocation;
                } else {
                    // If parsing fails, assume it's a direct page ID
                    state.currentPage = location;
                }
            }

            // Initialize session info if needed
            if (!state.sessionInfo) {
                state.sessionInfo = {
                    totalSessions: 1,
                    firstAccess: new Date().toISOString(),
                    lastAccess: new Date().toISOString()
                };
            } else {
                state.sessionInfo.totalSessions = (state.sessionInfo.totalSessions || 0) + 1;
                state.sessionInfo.lastAccess = new Date().toISOString();
            }

            return state;
        } catch (error) {
            this.log("Error loading state from SCORM:", error);
            return null;
        }
    }

    /**
     * Format location from current page object
     */
    formatLocation(currentPage) {
        if (!currentPage) return "";

        switch (currentPage.pageType) {
            case "introduction":
                return "introduction";
            case "final-quiz":
                return "final-quiz";
            case "concept":
                return `concept-${currentPage.conceptId}-sub-${currentPage.subConceptIndex}`;
            case "task":
                return currentPage.id || currentPage.conceptId || ""; // Use actual page ID
            default:
                return currentPage.id || "";
        }
    }

    /**
     * Parse location string into current page object
     */
    parseLocation(location) {
        if (!location) return null;

        if (location === "introduction") {
            return { pageType: "introduction" };
        }

        if (location === "final-quiz") {
            return { pageType: "final-quiz", isInQuiz: true };
        }

        // Parse concept location
        const conceptMatch = location.match(/^concept-(.+)-sub-(\d+)$/);
        if (conceptMatch) {
            return {
                pageType: "concept",
                conceptId: conceptMatch[1],
                subConceptIndex: parseInt(conceptMatch[2]),
                isInQuiz: false
            };
        }

        // For tasks, the location is the actual page ID
        // Return null so that the navigation system handles it by finding the page
        // This allows direct lookup by page ID
        return null;
    }

    /**
     * Save session time in SCORM format
     */
    saveSessionTime(seconds) {
        if (!this.isConnected()) return false;

        const timeString = this.formatTimeToSCORM(seconds);
        return this.setValue("cmi.session_time", timeString);
    }

    /**
     * Save current session time
     */
    saveCurrentSessionTime() {
        if (window.sessionStartTime) {
            const sessionTime = Math.floor((Date.now() - window.sessionStartTime) / 1000);
            this.saveSessionTime(sessionTime);
        }
    }

    /**
     * Convert seconds to SCORM time format (PT#H#M#S)
     */
    formatTimeToSCORM(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `PT${hours}H${minutes}M${seconds}S`;
    }

    /**
     * Save final quiz completion - only sets course as completed if 100% progress
     */
    saveFinalQuizCompletion(score, passed) {
        if (!this.isConnected()) return false;

        // Save score
        this.setValue("cmi.score.raw", score);
        this.setValue("cmi.score.max", 100);
        this.setValue("cmi.score.min", 0);
        this.setValue("cmi.score.scaled", (score / 100).toFixed(2));

        // Only set completion if:
        // 1. Quiz was passed
        // 2. ALL concepts are completed (100% progress)
        if (passed && this.isFullCourseCompleted()) {
            this.setValue("cmi.completion_status", "completed");
            this.setValue("cmi.success_status", "passed");
            this.setValue("cmi.exit", "normal");
            console.log('✅ Course marked as COMPLETED in SCORM (100% progress verified)');
        } else {
            // Keep as incomplete if not 100% done
            this.setValue("cmi.exit", "suspend");
            if (passed) {
                console.log('⚠️ Quiz passed but course not 100% complete - keeping SCORM as incomplete');
            }
        }

        return this.commit();
    }

    /**
     * Check if course is 100% complete (all concepts + all tasks + passed quiz)
     */
    isFullCourseCompleted() {
        if (!window.learningPathState || !window.topicConfig) {
            return false;
        }

        const concepts = window.topicConfig.concepts || [];
        const tasks = window.topicConfig.tasks || [];
        const completedConcepts = window.learningPathState.completedConcepts || new Set();
        const completedTasks = window.learningPathState.completedTasks || new Set();
        const quizResults = window.learningPathState.quizResults;

        // Check all concepts are completed
        const allConceptsCompleted = concepts.every(concept =>
            completedConcepts.has(concept.id)
        );

        // Check all tasks are completed
        const allTasksCompleted = tasks.length === 0 || tasks.every(task =>
            completedTasks.has(task.id)
        );

        // Check quiz is passed
        const quizPassed = quizResults && quizResults.passed;

        console.log('📊 Completion check:', {
            allConceptsCompleted,
            allTasksCompleted,
            quizPassed,
            conceptsCount: concepts.length,
            completedConceptsCount: completedConcepts.size,
            tasksCount: tasks.length,
            completedTasksCount: completedTasks.size
        });

        return allConceptsCompleted && allTasksCompleted && quizPassed;
    }

    /**
     * Get remaining content that needs to be completed
     * Returns object with details about what's left
     */
    getRemainingContent() {
        if (!window.learningPathState || !window.topicConfig) {
            return { isComplete: false, message: "Unable to determine progress" };
        }

        const concepts = window.topicConfig.concepts || [];
        const tasks = window.topicConfig.tasks || [];
        const completedConcepts = window.learningPathState.completedConcepts || new Set();
        const completedTasks = window.learningPathState.completedTasks || new Set();
        const quizResults = window.learningPathState.quizResults;

        const remainingConcepts = concepts.filter(c => !completedConcepts.has(c.id));
        const remainingTasks = tasks.filter(t => !completedTasks.has(t.id));
        const quizPassed = quizResults && quizResults.passed;

        const remaining = [];

        if (remainingConcepts.length > 0) {
            remaining.push(`${remainingConcepts.length} concept${remainingConcepts.length > 1 ? 's' : ''}`);
        }
        if (remainingTasks.length > 0) {
            remaining.push(`${remainingTasks.length} task${remainingTasks.length > 1 ? 's' : ''}`);
        }
        if (!quizPassed) {
            remaining.push('Final Assessment');
        }

        const isComplete = remaining.length === 0;
        const message = isComplete
            ? "All content completed!"
            : `Complete ${remaining.join(', ')} to finish this course.`;

        return {
            isComplete,
            message,
            remainingConcepts: remainingConcepts.length,
            remainingTasks: remainingTasks.length,
            quizPassed
        };
    }

    /**
     * Initialize time tracking
     */
    initializeTimeTracking() {
        // First, try to load time tracking data from suspend_data (most reliable)
        const suspendData = this.getValue("cmi.suspend_data");

        let timeFromSuspendData = 0;
        if (suspendData && suspendData !== "") {
            try {
                const parsed = JSON.parse(suspendData);

                if (parsed.timeTracking && parsed.timeTracking.totalSeconds) {
                    timeFromSuspendData = parsed.timeTracking.totalSeconds;
                    scormTimeTracking.lastSessionTime = timeFromSuspendData;
                    scormTimeTracking.totalSeconds = timeFromSuspendData;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Second, try to load from cmi.total_time (LMS native time tracking)
        const lmsTotalTime = this.getValue("cmi.total_time");

        let timeFromLMS = 0;
        if (lmsTotalTime && lmsTotalTime !== "") {
            timeFromLMS = this.parseTimeToSeconds(lmsTotalTime);
        }

        // Use the maximum of the two time sources (most accurate total)
        const maxTime = Math.max(timeFromSuspendData, timeFromLMS);

        // Initialize time tracking with the best available data
        scormTimeTracking.lastSessionTime = maxTime;
        scormTimeTracking.totalSeconds = maxTime;
        scormTimeTracking.sessionStartTime = Date.now();
        scormTimeTracking.currentSessionSeconds = 0;

        // Start time tracking interval
        scormTimeTracking.timeTrackingInterval = setInterval(() => {
            this.updateCurrentSessionTime();
            // Save time to LMS every 30 seconds
            if (scormTimeTracking.currentSessionSeconds % 30 === 0) {
                this.saveCurrentSessionTime();
                this.commit();
            }
        }, 1000);

        // Update display immediately
        this.updateTimeDisplay();
    }

    /**
     * Update current session time
     */
    updateCurrentSessionTime() {
        const now = Date.now();
        const sessionElapsed = Math.floor((now - scormTimeTracking.sessionStartTime) / 1000);

        // Calculate cumulative total time
        const newTotal = scormTimeTracking.lastSessionTime + sessionElapsed;

        // Update tracking data
        scormTimeTracking.currentSessionSeconds = sessionElapsed;
        scormTimeTracking.totalSeconds = newTotal;

        // Update UI display
        this.updateTimeDisplay();
    }

    /**
     * Update time display in header
     */
    updateTimeDisplay() {
        const timeDisplay = document.getElementById('scormTimeDisplay');
        if (timeDisplay) {
            const currentSession = this.formatSeconds(scormTimeTracking.currentSessionSeconds);
            const totalTime = this.formatSeconds(scormTimeTracking.totalSeconds);

            timeDisplay.innerHTML = `
                <span class="time-icon">⏱️</span>
                <span class="time-label">Session:</span>
                <span class="time-value">${currentSession}</span>
                <span class="time-separator">|</span>
                <span class="time-label">Total:</span>
                <span class="time-value total-time">${totalTime}</span>
            `;
        }
    }

    /**
     * Save current session time to LMS
     */
    saveCurrentSessionTime() {
        if (!this.isConnected()) return;

        // Calculate total time (last session time + current session time)
        const sessionElapsed = Math.floor((Date.now() - scormTimeTracking.sessionStartTime) / 1000);
        const newTotal = scormTimeTracking.lastSessionTime + sessionElapsed;

        // Update tracking data
        scormTimeTracking.totalSeconds = newTotal;
        scormTimeTracking.currentSessionSeconds = sessionElapsed;

        // Format for SCORM
        const sessionTime = this.formatTimeToSCORM(sessionElapsed);
        const totalTime = this.formatTimeToSCORM(newTotal);

        // Save to LMS
        this.setValue("cmi.session_time", sessionTime);
        this.setValue("cmi.total_time", totalTime);
    }

    /**
     * Parse SCORM time format to seconds
     */
    parseTimeToSeconds(timeString) {
        if (!timeString || timeString === "") return 0;

        try {
            const timePattern = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
            const matches = timeString.match(timePattern);

            if (!matches) return 0;

            const hours = parseInt(matches[1] || 0);
            const minutes = parseInt(matches[2] || 0);
            const seconds = parseInt(matches[3] || 0);

            return hours * 3600 + minutes * 60 + seconds;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Format seconds to readable string
     */
    formatSeconds(totalSeconds) {
        if (totalSeconds === 0) return "0s";

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let result = [];
        if (hours > 0) result.push(`${hours}h`);
        if (minutes > 0) result.push(`${minutes}m`);
        if (seconds > 0 || result.length === 0) result.push(`${seconds}s`);

        return result.join(' ');
    }

    /**
     * Log SCORM operations
     */
    log(message, error) {
        // SCORM logging disabled for cleaner console output
    }
}

// Create global SCORM API instance
window.scormAPIInstance = new SCORMAPI();

function initSCORM() {
    // Initialize using the new SCORMAPI class
    const success = window.scormAPIInstance.initialize();

    if (success) {
        // Store reference to the underlying API for backward compatibility
        scormAPI = window.scormAPIInstance.api;

        // Update the global learnerData for other scripts
        if (typeof window.learnerData !== 'undefined') {
            window.learnerData.id = scormLearnerData.id;
            window.learnerData.name = scormLearnerData.name;
            window.learnerData.progress = scormLearnerData.progress;
        }

        updateLearnerInfo();

        // Re-initialize chat system with updated learner data
        if (window.chatSystem && window.templateData && window.topicConfig && window.learnerData) {
            window.chatSystem.initialize(window.templateData, window.topicConfig, window.learnerData);
        }
    } else {
        // Show warning message for standalone mode
        showSCORMWarning();
    }

    return success;
}

function showSCORMWarning() {
    // Create a small, non-intrusive warning
    const warning = document.createElement('div');
    warning.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #fff3cd;
        color: #856404;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 10000;
    `;
    warning.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Running in standalone mode - progress will not be saved';

    document.body.appendChild(warning);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (warning.parentNode) {
            warning.parentNode.removeChild(warning);
        }
    }, 5000);
}

function updateLearnerInfo() {
    const learnerInfoElement = document.getElementById("learnerInfo");
    if (learnerInfoElement) {
        learnerInfoElement.innerHTML = `
            <div class="w-10 h-10 bg-gradient-to-br from-nebula-500 to-nebula-purple-500 rounded-full flex items-center justify-center">
                <i class="fas fa-user text-white text-sm"></i>
            </div>
            <span class="text-gray-700 font-medium">Welcome, <strong>${scormLearnerData.name}</strong></span>
        `;
    }
}

var sessionStartTime = Date.now();
var sessionTime = 0;

setInterval(() => {
    sessionTime = Math.floor((Date.now() - sessionStartTime) / 1000);
}, 1000);

// Fallback function to update header with global learner data
function updateHeaderWithLearnerData() {
    if (window.learnerData && window.learnerData.name && window.learnerData.name !== 'Learner') {
        const learnerInfoElement = document.getElementById("learnerInfo");
        if (learnerInfoElement) {
            learnerInfoElement.innerHTML = `
                <div class="w-10 h-10 bg-gradient-to-br from-nebula-500 to-nebula-purple-500 rounded-full flex items-center justify-center">
                    <i class="fas fa-user text-white text-sm"></i>
                </div>
                <span class="text-gray-700 font-medium">Welcome, <strong>${window.learnerData.name}</strong></span>
            `;
        }
    }
}

// SCORM termination on page unload
window.addEventListener('beforeunload', () => {
    if (window.scormAPIInstance && window.scormAPIInstance.isConnected()) {
        // Save current state if available
        if (window.learningPathState) {
            const state = {
                completedConcepts: Array.from(window.learningPathState.completedConcepts || []),
                completedTasks: Array.from(window.learningPathState.completedTasks || []),  // Save task completions
                completedQuiz: window.learningPathState.completedQuiz || false,  // Save quiz completion
                quizResults: window.learningPathState.quizResults || null,  // Save quiz results
                feedbackSubmittedAt: window.learningPathState.feedbackSubmittedAt || null,
                completedTaskSteps: Array.from(window.learningPathState.completedTaskSteps || []),
                unlockedTasks: Array.from(window.learningPathState.unlockedTasks || []),
                quizAttempts: window.learningPathState.quizAttempts || {},
                currentPage: window.learningPathState.currentPage || null,
                currentConceptIndex: window.learningPathState.currentConceptIndex || 0,
                currentSubConcepts: window.learningPathState.currentSubConcepts || {}
            };
            window.scormAPIInstance.saveStateToSCORM(state);
        }

        // CRITICAL: Always set exit to 'suspend' unless course is 100% completed
        // This prevents LMS from auto-completing the course on page close
        const isFullyCompleted = window.scormAPIInstance.isFullCourseCompleted &&
            window.scormAPIInstance.isFullCourseCompleted();

        if (!isFullyCompleted) {
            // Keep as suspend (incomplete) - user hasn't finished
            window.scormAPIInstance.setValue("cmi.exit", "suspend");
            console.log('📤 Exiting with suspend - course not 100% complete');
        } else {
            // Course is 100% complete - mark as completed and allow normal exit
            window.scormAPIInstance.setValue("cmi.completion_status", "completed");
            window.scormAPIInstance.setValue("cmi.success_status", "passed");
            window.scormAPIInstance.setValue("cmi.exit", "normal");
            console.log('✅ Exiting with completion - course 100% complete (auto-completed on close)');
        }

        window.scormAPIInstance.commit();

        // Terminate SCORM connection
        window.scormAPIInstance.terminate();
    }
});

// Export functions for global access
window.updateLearnerInfo = updateLearnerInfo;
window.updateHeaderWithLearnerData = updateHeaderWithLearnerData;
window.saveStateToSCORM = (state) => {
    if (window.scormAPIInstance) {
        return window.scormAPIInstance.saveStateToSCORM(state);
    }
    return false;
};
window.loadStateFromSCORM = () => {
    if (window.scormAPIInstance) {
        return window.scormAPIInstance.loadStateFromSCORM();
    }
    return null;
};
