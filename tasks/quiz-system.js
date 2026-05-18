// Multi-Question Quiz System
class QuizSystem {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.answers = {};
        this.score = 0;
        this.completed = false;
        this.settings = {};
        this.feedbackModalId = 'courseFeedbackModal';
        this.notesExportModalId = 'courseNotesExportModal';
        this.feedbackDetailSectionId = 'feedbackDetailedComments';
        this.feedbackModalState = null;
        this.notesExportPromptState = null;
        this.feedbackStylesInjected = false;
        this.feedbackTags = [
            'Clear',
            'Engaging',
            'Practical',
            'Useful',
            'Well-paced',
            'Interactive',
            'Challenging',
            'Supportive'
        ];
        this.feedbackRatings = [
            { value: 1, emoji: '😕', label: 'Low' },
            { value: 2, emoji: '🙂', label: 'Fair' },
            { value: 3, emoji: '😊', label: 'Mid' },
            { value: 4, emoji: '🤩', label: 'High' },
            { value: 5, emoji: '🔥', label: 'Top' }
        ];

        this.setupFinishCourseListeners();
    }

    setupFinishCourseListeners() {
        const refreshFinishState = () => {
            setTimeout(() => this.updateFinishCourseSection(), 60);
        };

        ['conceptCompleted', 'taskCompleted', 'taskStepCompleted', 'quizCompleted', 'learningPathProgress'].forEach((eventName) => {
            document.addEventListener(eventName, refreshFinishState);
        });
    }

    getDefaultFeedbackForm() {
        return {
            conceptRating: null,
            taskRating: null,
            quizRating: null,
            experienceTags: [],
            comment: '',
            conceptComment: '',
            taskComment: '',
            quizComment: ''
        };
    }

    createFeedbackModalState() {
        return {
            form: this.getDefaultFeedbackForm(),
            error: '',
            warning: '',
            isLoading: false,
            isSubmitting: false,
            hasLoadedExisting: false,
            currentStep: 0,
            noteVisibility: {
                conceptComment: false,
                taskComment: false,
                quizComment: false
            },
            restoreFocusTo: document.activeElement instanceof HTMLElement ? document.activeElement : null
        };
    }

    getFeedbackModalState() {
        if (!this.feedbackModalState) {
            this.feedbackModalState = this.createFeedbackModalState();
        }

        return this.feedbackModalState;
    }

    getNotesExportPromptState() {
        if (!this.notesExportPromptState) {
            this.notesExportPromptState = {
                isExporting: false,
                hasDownloaded: false,
                error: ''
            };
        }

        return this.notesExportPromptState;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    getFeedbackContext() {
        if (window.feedbackService && typeof window.feedbackService.buildContext === 'function') {
            return {
                topicTitle: typeof window.feedbackService.getTopicTitle === 'function'
                    ? window.feedbackService.getTopicTitle()
                    : (window.templateData?.title || window.topicConfig?.title || 'this course')
            };
        }

        return {
            topicTitle: window.templateData?.title || window.topicConfig?.title || 'this course'
        };
    }

    mapFeedbackToForm(feedback) {
        if (!feedback) {
            return this.getDefaultFeedbackForm();
        }

        return {
            conceptRating: feedback.conceptRating || null,
            taskRating: feedback.taskRating || null,
            quizRating: feedback.quizRating || null,
            experienceTags: Array.isArray(feedback.experienceTags) ? [...feedback.experienceTags] : [],
            comment: feedback.comment || '',
            conceptComment: feedback.conceptComment || '',
            taskComment: feedback.taskComment || '',
            quizComment: feedback.quizComment || ''
        };
    }

    ensureFeedbackStyles() {
        if (this.feedbackStylesInjected || document.getElementById('courseFeedbackModalStyles')) {
            this.feedbackStylesInjected = true;
            return;
        }

        const style = document.createElement('style');
        style.id = 'courseFeedbackModalStyles';
        style.textContent = `
            .course-feedback-modal {
                position: fixed;
                inset: 0;
                z-index: 10010;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1.5rem;
            }
            .course-feedback-backdrop {
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.84), rgba(30, 41, 59, 0.94));
                backdrop-filter: blur(10px);
            }
            .course-feedback-panel {
                position: relative;
                width: min(720px, 100%);
                max-height: min(88vh, 760px);
                overflow: hidden;
                border-radius: 24px;
                border: 1px solid rgba(148, 163, 184, 0.28);
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
                box-shadow: 0 32px 80px rgba(15, 23, 42, 0.28);
            }
            .course-notes-export-panel {
                position: relative;
                width: min(560px, 100%);
                overflow: hidden;
                border-radius: 28px;
                border: 1px solid rgba(212, 220, 228, 0.95);
                background: linear-gradient(180deg, rgba(252, 249, 242, 0.99), rgba(248, 244, 236, 0.98));
                box-shadow: 0 28px 80px rgba(15, 23, 42, 0.24);
            }
            .course-notes-export-hero {
                padding: 1.25rem 1.25rem 0.9rem;
                background: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0));
            }
            .course-notes-export-card {
                margin: 0 1.25rem 1.25rem;
                border-radius: 24px;
                border: 1px solid rgba(214, 223, 230, 0.9);
                background: rgba(255, 252, 246, 0.95);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
                padding: 1.2rem;
            }
            .course-notes-export-kicker {
                display: inline-flex;
                align-items: center;
                gap: 0.45rem;
                padding: 0.35rem 0.8rem;
                border-radius: 999px;
                background: rgba(74, 155, 142, 0.12);
                color: #0f766e;
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.08em;
            }
            .course-notes-export-actions {
                display: flex;
                flex-direction: column-reverse;
                gap: 0.75rem;
                margin-top: 1.25rem;
            }
            .course-notes-export-note {
                margin-top: 0.9rem;
                font-size: 0.9rem;
                color: #64748b;
                line-height: 1.5;
            }
            @media (min-width: 640px) {
                .course-notes-export-actions {
                    flex-direction: row;
                    justify-content: flex-end;
                }
            }
            .course-feedback-scroll {
                max-height: min(88vh, 760px);
                overflow-y: auto;
            }
            .course-feedback-hero {
                position: relative;
                overflow: hidden;
                border-radius: 20px;
                padding: 1.15rem 1.15rem 1rem;
                background: radial-gradient(circle at top left, rgba(45, 212, 191, 0.18), transparent 36%), linear-gradient(135deg, #f8fafc, #ffffff 58%, #ecfeff);
                border: 1px solid rgba(203, 213, 225, 0.8);
            }
            .course-feedback-hero::after {
                content: '';
                position: absolute;
                inset: auto -10% -40% auto;
                width: 220px;
                height: 220px;
                border-radius: 999px;
                background: radial-gradient(circle, rgba(6, 182, 212, 0.16), transparent 68%);
                pointer-events: none;
            }
            .course-feedback-progress {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-top: 0.7rem;
            }
            .course-feedback-progress-bar {
                position: relative;
                flex: 1;
                height: 0.35rem;
                background: rgba(203, 213, 225, 0.65);
                border-radius: 999px;
                overflow: hidden;
            }
            .course-feedback-progress-fill {
                position: absolute;
                inset: 0 auto 0 0;
                width: 0;
                border-radius: inherit;
                background: linear-gradient(90deg, #14b8a6, #0891b2);
                transition: width 0.28s ease;
            }
            .course-feedback-step-shell {
                border: 1px solid #e2e8f0;
                background: rgba(255, 255, 255, 0.92);
                border-radius: 22px;
                padding: 1rem;
                min-height: 340px;
                display: flex;
                flex-direction: column;
            }
            .course-feedback-step-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
            }
            .course-feedback-step-kicker {
                display: inline-flex;
                align-items: center;
                gap: 0.45rem;
                padding: 0.35rem 0.75rem;
                border-radius: 999px;
                background: #f1f5f9;
                color: #0f766e;
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }
            .course-feedback-rating-stage {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                gap: 0.4rem;
                padding: 0.2rem 0 0.1rem;
            }
            .course-feedback-rating-caption {
                text-align: center;
            }
            .course-feedback-rating-caption h3 {
                font-size: 1.75rem;
                line-height: 1.15;
                font-weight: 800;
                color: #0f172a;
                margin-bottom: 0.3rem;
            }
            .course-feedback-title-accent {
                color: #0f766e;
            }
            .course-feedback-rating-caption p {
                font-size: 0.94rem;
                line-height: 1.45;
                color: #64748b;
                max-width: 32rem;
                margin: 0 auto;
            }
            .course-feedback-rating-arc-wrap {
                width: min(100%, 390px);
                margin-top: -0.1rem;
            }
            .course-feedback-rating-arc {
                display: flex;
                align-items: flex-end;
                justify-content: center;
                gap: 0.65rem;
                padding: 0;
                min-height: 5rem;
            }
            .course-feedback-rating-btn {
                --arc-offset: 0px;
                border: 1px solid rgba(203, 213, 225, 0.85);
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94));
                border-radius: 999px;
                width: 3.2rem;
                height: 3.2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                opacity: 0.94;
                transform: translateY(var(--arc-offset));
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
                overflow: visible;
            }
            .course-feedback-rating-btn:hover,
            .course-feedback-rating-btn:focus-visible {
                border-color: #0f766e;
                background: linear-gradient(180deg, #ffffff, #f0fdfa);
                transform: translateY(calc(var(--arc-offset) - 4px)) scale(1.05);
                outline: none;
                opacity: 1;
            }
            .course-feedback-rating-btn.is-active {
                border-color: #0f766e;
                background: linear-gradient(180deg, #f0fdfa, #ccfbf1);
                box-shadow: 0 16px 30px rgba(15, 118, 110, 0.16);
                opacity: 1;
            }
            .course-feedback-rating-emoji {
                display: block;
                font-size: 1.55rem;
                line-height: 1.18;
                transform: translateY(1px);
            }
            .course-feedback-rating-summary {
                min-height: 1.3rem;
                text-align: center;
                font-size: 0.92rem;
                font-weight: 700;
                color: #0f766e;
            }
            .course-feedback-note-toggle {
                display: inline-flex;
                align-items: center;
                gap: 0.45rem;
                margin-top: 0.15rem;
                color: #475569;
                font-size: 0.92rem;
                font-weight: 700;
            }
            .course-feedback-note-panel {
                margin-top: 0.75rem;
                padding: 0;
                border: 0;
                background: transparent;
            }
            .course-feedback-tag-btn {
                border: 1px solid #dbe4ef;
                background: #fff;
                color: #334155;
                padding: 0.58rem 0.95rem;
                border-radius: 999px;
                font-weight: 600;
                transition: all 0.2s ease;
                font-size: 0.9rem;
            }
            .course-feedback-tag-btn:hover,
            .course-feedback-tag-btn:focus-visible {
                border-color: #0f766e;
                color: #0f766e;
                outline: none;
            }
            .course-feedback-tag-btn.is-active {
                background: linear-gradient(135deg, #0f766e, #0f766e 55%, #155e75);
                border-color: #0f766e;
                color: #fff;
                box-shadow: 0 10px 24px rgba(15, 118, 110, 0.2);
            }
            .course-feedback-textarea {
                width: 100%;
                border: 1px solid #dbe4ef;
                border-radius: 18px;
                background: rgba(255, 255, 255, 0.96);
                padding: 0.9rem 1rem;
                color: #0f172a;
                resize: vertical;
                min-height: 112px;
            }
            .course-feedback-textarea:focus {
                outline: none;
                border-color: #0f766e;
                box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
            }
            .course-feedback-mini-textarea {
                min-height: 96px;
            }
            .course-feedback-final-grid {
                display: grid;
                gap: 1rem;
            }
            .course-feedback-final-card {
                border: 1px solid #e2e8f0;
                border-radius: 18px;
                background: #fff;
                padding: 0.9rem;
            }
            .course-feedback-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                margin-top: 0.9rem;
                padding-top: 0.9rem;
                border-top: 1px solid rgba(226, 232, 240, 0.9);
            }
            @media (max-width: 768px) {
                .course-feedback-modal {
                    padding: 0.75rem;
                    align-items: flex-end;
                }
                .course-feedback-panel {
                    width: 100%;
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                }
                .course-feedback-step-shell {
                    min-height: 0;
                    padding: 0.9rem;
                }
                .course-feedback-rating-caption h3 {
                    font-size: 1.45rem;
                }
                .course-feedback-rating-arc {
                    width: 100%;
                    gap: 0.35rem;
                }
                .course-feedback-rating-btn {
                    width: 2.85rem;
                    height: 2.85rem;
                }
                .course-feedback-footer {
                    flex-direction: column;
                    align-items: stretch;
                }
            }
            @media (max-width: 520px) {
                .course-feedback-modal {
                    padding: 0.5rem;
                }
                .course-feedback-hero {
                    padding: 1rem 1rem 0.9rem;
                }
                .course-feedback-rating-arc {
                    gap: 0.2rem;
                }
                .course-feedback-rating-btn {
                    width: 2.65rem;
                    height: 2.65rem;
                }
            }
        `;

        document.head.appendChild(style);
        this.feedbackStylesInjected = true;
    }

    initialize(quizData) {
        if (!quizData || !quizData.questions || !Array.isArray(quizData.questions)) {
            console.warn('No valid quiz data provided');
            return;
        }

        this.settings = quizData.settings || {};

        // Copy questions array to avoid mutating original
        this.questions = [...quizData.questions];

        // Randomize questions if setting is enabled (only for fresh attempts)
        if (this.settings.randomize_questions && !this.hasCompletedQuizState()) {
            this.shuffleArray(this.questions);
        }

        // Check if quiz was previously completed and restore state
        if (this.hasCompletedQuizState()) {
            this.restoreCompletedState();
            return;
        }

        this.currentQuestionIndex = 0;
        this.answers = {};
        this.score = 0;
        this.completed = false;

        // Set global variables for backward compatibility
        window.quizQuestions = this.questions;
        window.currentQuestionIndex = this.currentQuestionIndex;
        window.quizAnswers = this.answers;
        window.quizScore = this.score;
        window.quizCompleted = this.completed;

        this.loadQuestion(0);
        this.updateProgress();
        this.updateNavigation();
    }

    /**
     * Check if quiz was previously completed and state is available
     */
    hasCompletedQuizState() {
        return window.learningPathState &&
            window.learningPathState.completedQuiz &&
            window.learningPathState.quizResults;
    }

    /**
     * Restore completed quiz state and show results
     */
    restoreCompletedState() {
        const savedResults = window.learningPathState.quizResults;

        // Restore state
        this.score = savedResults.score;
        this.answers = savedResults.answers || {};
        this.completed = true;

        // Set global variables
        window.quizQuestions = this.questions;
        window.quizScore = this.score;
        window.quizAnswers = this.answers;
        window.quizCompleted = true;

        console.log('🔄 Restoring completed quiz state:', savedResults);

        // Hide quiz content and show results
        const questionContainer = document.getElementById('quizQuestionContainer');
        const resultsContainer = document.getElementById('quizResults');

        if (questionContainer) questionContainer.style.display = 'none';
        if (resultsContainer) {
            resultsContainer.classList.remove('hidden');

            // Determine if retry should show
            const allowRetry = this.settings.allow_retry !== false;
            const showRetry = allowRetry && !savedResults.perfect && !savedResults.passed;

            // Update results UI
            this.updateResultsUI(resultsContainer, {
                score: savedResults.score,
                total: savedResults.total,
                percentage: savedResults.percentage,
                isPassed: savedResults.passed,
                isPerfect: savedResults.perfect,
                passingScore: this.settings.passing_score || Math.ceil(this.questions.length * 0.7),
                showRetry
            });
        }

        // Update progress
        if (typeof updateProgress === 'function') updateProgress(4);
    }

    /**
     * Fisher-Yates shuffle algorithm for randomizing questions
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    normalizeQuestionType(type) {
        if (type === 'checkbox' || type === 'multiple') return 'checkbox';
        return 'mcq';
    }

    loadQuestion(questionIndex) {
        if (!this.questions || questionIndex >= this.questions.length) return;

        const question = this.questions[questionIndex];
        const container = document.getElementById('quizQuestionContainer');

        if (!container) return;

        const questionType = this.normalizeQuestionType(question.type);
        const totalQuestions = this.questions.length;

        // Build question HTML based on type
        let questionHTML = `
            <div class="quiz-question-container">
                <!-- Question Header with Step Indicator -->
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-nebula-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md">
                            ${questionIndex + 1}
                        </div>
                        <div>
                            <span class="text-sm text-gray-500 font-medium">Question ${questionIndex + 1} of ${totalQuestions}</span>
                            <span class="inline-block ml-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${questionType === 'mcq'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-purple-50 text-purple-700'
            }">
                                ${questionType === 'mcq' ? 'Single Choice' : 'Multiple Choice'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Question Images (if any) -->
                ${question.images && question.images.length > 0 ? `
                    <div class="mb-6">
                        ${question.images.length > 1 ? `
                            <!-- Multiple Images - Carousel -->
                            <div class="relative" data-carousel="question" data-question-index="${questionIndex}">
                                <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-soft">
                                    <div class="h-56 sm:h-72 flex items-center justify-center">
                                        <img id="question-image-${questionIndex}"
                                             src="${question.images[0].src}"
                                             alt="${question.images[0].alt || 'Question image 1'}"
                                             class="max-w-full h-full object-contain rounded-xl shadow-md cursor-zoom-in"
                                             onclick="openImageModal(this.src, this.alt)">
                                    </div>
                                    <p id="question-image-caption-${questionIndex}" class="text-sm text-gray-600 mt-3 font-medium text-center">${question.images[0].caption || ''}</p>
                                </div>
                                <!-- Carousel Controls -->
                                <div class="flex justify-center items-center gap-4 mt-3">
                                    <button class="px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                                            data-question-index="${questionIndex}" onclick="prevQuestionImage(this.dataset.questionIndex)">
                                        <i class="fas fa-chevron-left mr-1"></i>Prev
                                    </button>
                                    <span class="text-xs text-gray-500 font-medium">
                                        <span id="question-carousel-indicator-${questionIndex}">1</span> / ${question.images.length}
                                    </span>
                                    <button class="px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                                            data-question-index="${questionIndex}" onclick="nextQuestionImage(this.dataset.questionIndex)">
                                        Next<i class="fas fa-chevron-right ml-1"></i>
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <!-- Single Image -->
                            <div class="text-center">
                                <div class="inline-block bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-soft">
                                    <img src="${question.images[0].src}" alt="${question.images[0].alt || 'Question image'}"
                                         class="max-w-full h-56 sm:h-72 object-contain rounded-xl shadow-md cursor-zoom-in"
                                         onclick="openImageModal('${question.images[0].src}', '${question.images[0].alt || 'Question image'}')">
                                    ${question.images[0].caption ? `
                                        <p class="text-sm text-gray-600 mt-3 font-medium text-center">${question.images[0].caption}</p>
                                    ` : ''}
                                </div>
                            </div>
                        `}
                    </div>
                ` : ''}

                <!-- Question Text -->
                <h4 class="text-lg sm:text-xl font-semibold text-gray-900 mb-6 leading-relaxed">${question.question}</h4>
        `;

        if (questionType === 'mcq') {
            // MCQ - Single choice options
            questionHTML += `
                <div class="space-y-3 mb-6" id="quizOptionsContainer">
                    ${question.options.map((option, index) => `
                        <button class="w-full text-left p-4 sm:p-5 rounded-xl border-2 border-gray-200 transition-all duration-200 quiz-option group bg-white" 
                                data-option-index="${index}" onclick="quizSystem.selectOption(this, ${index})">
                            <div class="flex items-center gap-4">
                                <div class="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0 option-letter">
                                    ${String.fromCharCode(65 + index)}
                                </div>
                                <span class="option-text text-gray-700 font-medium">${option}</span>
                            </div>
                        </button>
                    `).join('')}
                </div>
            `;
        } else if (questionType === 'checkbox') {
            // Checkbox - Multiple choice options (two columns, vertical flow: A-C, B-D)
            const numRows = Math.ceil(question.options.length / 2);
            questionHTML += `
                <div class="mb-6" id="quizOptionsContainer">
                    <div class="grid grid-cols-1 lg:grid-cols-2 lg:grid-flow-col gap-3" style="grid-template-rows: repeat(${numRows}, minmax(0, 1fr));">
                        ${question.options.map((option, index) => `
                            <label class="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 transition-all duration-200 cursor-pointer quiz-checkbox-option bg-white" 
                                   data-option-index="${index}">
                                <input type="checkbox" class="w-5 h-5 text-nebula-600 bg-gray-100 border-gray-300 rounded focus:ring-nebula-500 focus:ring-2" 
                                       data-option-index="${index}" onchange="quizSystem.toggleCheckboxOption(this, ${index})">
                                <div class="flex items-center gap-3 flex-1">
                                    <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
                                        ${String.fromCharCode(65 + index)}
                                    </div>
                                    <span class="option-text text-gray-700 font-medium">${option}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                    <div class="mt-5 text-center">
                        <button id="submitCheckboxAnswer" onclick="quizSystem.submitCheckboxAnswer()" 
                                class="bg-gradient-to-r from-nebula-500 to-teal-600 hover:from-nebula-600 hover:to-teal-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            Submit Answer
                        </button>
                    </div>
                </div>
            `;
        }

        // Result feedback + Inline Navigation + Explanation Image
        questionHTML += `
                <!-- Result Feedback -->
                <div id="quizResult" class="hidden mb-5 p-5 rounded-xl"></div>
                
                <!-- Inline Navigation Buttons (after result, before explanation) -->
                <div id="inlineQuizNav" class="flex justify-between items-center py-4 mb-5 border-t border-gray-100">
                    <button id="prevQuestionBtn" onclick="previousQuestion()"
                            class="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium transition-all duration-200 shadow-sm hover:bg-gray-50 hover:shadow disabled:opacity-40 disabled:cursor-not-allowed"
                            ${questionIndex === 0 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left text-sm"></i>
                        <span>Previous</span>
                    </button>
                    <button id="nextQuestionBtn" onclick="nextQuestion()"
                            class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-nebula-500 to-teal-600 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled>
                        <span>${questionIndex === totalQuestions - 1 ? 'Finish Quiz' : 'Next'}</span>
                        <i class="fas ${questionIndex === totalQuestions - 1 ? 'fa-check' : 'fa-chevron-right'} text-sm"></i>
                    </button>
                </div>
                
                <!-- Explanation Image (optional, below nav) -->
                ${question.explanation_image ? `
                    <div id="quizExplanationImage" class="hidden pt-4 border-t border-gray-100">
                        <p class="text-sm text-gray-500 mb-3 font-medium">
                            <i class="fas fa-lightbulb text-amber-500 mr-2"></i>Visual Explanation
                        </p>
                        <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                            <img src="${question.explanation_image.src}" alt="${question.explanation_image.alt}" 
                                 class="max-w-full h-auto rounded-lg shadow-md mx-auto cursor-zoom-in"
                                 onclick="openImageModal('${question.explanation_image.src}', '${question.explanation_image.alt}')">
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = questionHTML;
        this.updateQuestionDots(questionIndex);

        // Check if question was already answered
        if (this.answers[questionIndex] !== undefined) {
            if (questionType === 'mcq') {
                const selectedOption = this.answers[questionIndex];
                const optionElement = container.querySelector(`[data-option-index="${selectedOption}"]`);
                if (optionElement) {
                    this.selectOption(optionElement, selectedOption, true);
                }
            } else if (questionType === 'checkbox') {
                const selectedOptions = this.answers[questionIndex];
                if (Array.isArray(selectedOptions)) {
                    selectedOptions.forEach(optionIndex => {
                        const checkbox = container.querySelector(`input[data-option-index="${optionIndex}"]`);
                        if (checkbox) {
                            checkbox.checked = true;
                            this.updateCheckboxVisualState(optionIndex, true);
                        }
                    });

                    // Disable all checkboxes and labels if already answered
                    const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');
                    allCheckboxes.forEach(cb => {
                        cb.disabled = true;
                        cb.style.pointerEvents = 'none';
                    });

                    const allLabels = container.querySelectorAll('.quiz-checkbox-option');
                    allLabels.forEach(label => {
                        label.style.pointerEvents = 'none';
                        label.style.cursor = 'default';
                    });

                    // Disable submit button
                    const submitBtn = container.querySelector('#submitCheckboxAnswer');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Answer Submitted';
                    }

                    // Show the result if already answered
                    this.showCheckboxResult(questionIndex, selectedOptions, true);
                }
            }
        }
    }

    selectOption(element, optionIndex, isReview = false) {
        const questionIndex = this.currentQuestionIndex;
        const question = this.questions[questionIndex];
        const questionType = this.normalizeQuestionType(question.type);

        // Only handle MCQ questions here
        if (questionType !== 'mcq') return;

        // Store answer
        this.answers[questionIndex] = optionIndex;
        window.quizAnswers = this.answers;

        // Update visual states
        const options = document.querySelectorAll('.quiz-option');
        options.forEach(opt => {
            opt.classList.remove('bg-green-100', 'border-green-500', 'text-green-800',
                'bg-red-100', 'border-red-500', 'text-red-800');
        });

        const result = document.getElementById('quizResult');
        const explanationImage = document.getElementById('quizExplanationImage');

        if (optionIndex === question.correct_answer) {
            element.classList.add('bg-green-100', 'border-green-500', 'text-green-800');
            if (result) {
                result.className = 'block mb-4 p-4 rounded-xl bg-green-100 text-green-800 border border-green-300';
                result.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-check-circle text-green-600"></i>
                        <span class="font-semibold">Correct!</span>
                    </div>
                    <p class="mt-2">${question.explanation || 'Great job! You understand this concept well.'}</p>
                `;
            }

            if (!isReview) {
                this.score++;
                window.quizScore = this.score;
                this.updateScore();
            }

            if (explanationImage) explanationImage.classList.remove('hidden');

        } else {
            element.classList.add('bg-red-100', 'border-red-500', 'text-red-800');
            if (result) {
                result.className = 'block mb-4 p-4 rounded-xl bg-red-100 text-red-800 border border-red-300';
                result.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-times-circle text-red-600"></i>
                        <span class="font-semibold">Incorrect</span>
                    </div>
                    <p class="mt-2">${question.explanation || 'Let me help you understand the correct answer.'}</p>
                    ${!isReview ? `
                        <div class="mt-4 pt-3 border-t border-red-200">
                            <button onclick="quizSystem.askAIForHelp('mcq', ${optionIndex})" 
                                    class="group bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 shadow-medium hover:shadow-strong transform hover:-translate-y-1 flex items-center space-x-2">
                                <i class="fas fa-robot group-hover:animate-pulse"></i>
                                <span>Ask AI: Why is this answer wrong?</span>
                            </button>
                        </div>
                    ` : ''}
                `;
            }

            if (explanationImage) explanationImage.classList.remove('hidden');
        }

        if (result) result.classList.remove('hidden');

        // Disable all options after selection to prevent changes
        try {
            options.forEach(opt => {
                opt.disabled = true;
                opt.classList.add('cursor-not-allowed', 'opacity-75');
            });
        } catch (e) {
            // no-op safeguard
        }

        this.updateNavigation();
    }

    // New methods for checkbox questions
    toggleCheckboxOption(checkbox, optionIndex) {
        // Check if this question is already answered
        const questionIndex = this.currentQuestionIndex;
        if (this.answers[questionIndex] !== undefined) {
            // Question already answered, prevent changes
            checkbox.checked = !checkbox.checked; // Revert the change
            return;
        }

        this.updateCheckboxVisualState(optionIndex, checkbox.checked);
    }

    updateCheckboxVisualState(optionIndex, isSelected) {
        const label = document.querySelector(`label[data-option-index="${optionIndex}"]`);
        if (label) {
            if (isSelected) {
                label.classList.add('bg-nebula-50', 'border-nebula-400');
                label.classList.remove('border-gray-200');
            } else {
                label.classList.remove('bg-nebula-50', 'border-nebula-400');
                label.classList.add('border-gray-200');
            }
        }
    }

    submitCheckboxAnswer() {
        const questionIndex = this.currentQuestionIndex;
        const question = this.questions[questionIndex];

        // Get selected options
        const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
        const selectedOptions = Array.from(checkboxes).map(cb => parseInt(cb.dataset.optionIndex));

        // Store answer
        this.answers[questionIndex] = selectedOptions;
        window.quizAnswers = this.answers;

        // Show result
        this.showCheckboxResult(questionIndex, selectedOptions);

        // Disable submit button and ALL checkboxes (not just checked ones)
        const submitBtn = document.getElementById('submitCheckboxAnswer');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Answer Submitted';
        }

        // Disable ALL checkboxes in the current question
        const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(cb => {
            cb.disabled = true;
            cb.style.pointerEvents = 'none';
        });

        // Also disable the labels to prevent clicking
        const allLabels = document.querySelectorAll('.quiz-checkbox-option');
        allLabels.forEach(label => {
            label.style.pointerEvents = 'none';
            label.style.cursor = 'default';
        });

        this.updateNavigation();
    }

    showCheckboxResult(questionIndex, selectedOptions, isReview = false) {
        const question = this.questions[questionIndex];
        const correctAnswers = question.correct_answers || [];
        const result = document.getElementById('quizResult');
        const explanationImage = document.getElementById('quizExplanationImage');

        // Check if answer is correct
        const isCorrect = this.arraysEqual(selectedOptions.sort(), correctAnswers.sort());

        // Update visual states for all options
        const allOptions = document.querySelectorAll('.quiz-checkbox-option');
        allOptions.forEach((option, index) => {
            const isSelected = selectedOptions.includes(index);
            const isCorrectOption = correctAnswers.includes(index);

            option.classList.remove('bg-green-100', 'border-green-500', 'text-green-800',
                'bg-red-100', 'border-red-500', 'text-red-800',
                'bg-emerald-100', 'border-emerald-400', 'text-emerald-800');

            if (isCorrectOption && isSelected) {
                // Correct option selected - bright green
                option.classList.add('bg-green-100', 'border-green-500', 'text-green-800');
            } else if (isCorrectOption && !isSelected) {
                // Correct option not selected - lighter green shade
                option.classList.add('bg-emerald-100', 'border-emerald-400', 'text-emerald-800');
            } else if (!isCorrectOption && isSelected) {
                // Incorrect option selected
                option.classList.add('bg-red-100', 'border-red-500', 'text-red-800');
            }
        });

        // Show result message
        if (result) {
            if (isCorrect) {
                result.className = 'block mb-4 p-4 rounded-xl bg-green-100 text-green-800 border border-green-300';
                result.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-check-circle text-green-600"></i>
                        <span class="font-semibold">Correct!</span>
                    </div>
                    <p class="mt-2">${question.explanation || 'Great job! You understand this concept well.'}</p>
                `;

                if (!isReview) {
                    this.score++;
                    window.quizScore = this.score;
                    this.updateScore();
                }
            } else {
                result.className = 'block mb-4 p-4 rounded-xl bg-red-100 text-red-800 border border-red-300';
                result.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-times-circle text-red-600"></i>
                        <span class="font-semibold">Incorrect</span>
                    </div>
                    <p class="mt-2">${question.explanation || 'Let me help you understand the correct answer.'}</p>
                    ${!isReview ? `
                        <div class="mt-4 pt-3 border-t border-red-200">
                            <button onclick="quizSystem.askAIForHelp('checkbox', ${JSON.stringify(selectedOptions)})" 
                                    class="group bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 shadow-medium hover:shadow-strong transform hover:-translate-y-1 flex items-center space-x-2">
                                <i class="fas fa-robot group-hover:animate-pulse"></i>
                                <span>Ask AI: Why are these answers wrong?</span>
                            </button>
                        </div>
                    ` : ''}
                `;
            }
            result.classList.remove('hidden');
        }

        if (explanationImage) explanationImage.classList.remove('hidden');
    }

    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }

    askAIForHelp(questionType, userAnswer) {
        const questionIndex = this.currentQuestionIndex;
        const question = this.questions[questionIndex];

        if (typeof openQuizFailureChat === 'function') {
            if (questionType === 'checkbox') {
                // Format selected options text for checkbox questions
                const selectedOptions = Array.isArray(userAnswer) ? userAnswer : JSON.parse(userAnswer);
                const selectedOptionsText = selectedOptions.map(index => question.options[index]).join(', ');
                const correctAnswers = question.correct_answers || [];
                const correctOptionsText = correctAnswers.map(index => question.options[index]).join(', ');

                // Create a modified question object with formatted text
                const formattedQuestion = {
                    ...question,
                    selectedOptionsText: selectedOptionsText,
                    correctOptionsText: correctOptionsText,
                    questionType: 'checkbox'
                };

                openQuizFailureChat(formattedQuestion, selectedOptionsText);
            } else {
                // Handle MCQ questions
                openQuizFailureChat(question, userAnswer);
            }
        }
    }

    scrollToQuizTop() {
        // Find the quiz question container and scroll to it smoothly
        const quizContainer = document.getElementById('quizQuestionContainer');
        if (quizContainer) {
            quizContainer.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        } else {
            // Fallback: find quiz section
            const quizSection = document.querySelector('section.bg-gradient-to-br.from-gray-50.to-white');
            if (quizSection) {
                quizSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            window.currentQuestionIndex = this.currentQuestionIndex;
            this.loadQuestion(this.currentQuestionIndex);
            this.updateProgress();
            this.updateNavigation();

            // Scroll to top of quiz section
            this.scrollToQuizTop();
        } else {
            this.completeQuiz();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            window.currentQuestionIndex = this.currentQuestionIndex;
            this.loadQuestion(this.currentQuestionIndex);
            this.updateProgress();
            this.updateNavigation();

            // Scroll to top of quiz section
            this.scrollToQuizTop();
        }
    }

    completeQuiz() {
        this.completed = true;
        window.quizCompleted = true;

        // Calculate pass/fail and perfect score
        const totalQuestions = this.questions.length;
        const passingScore = this.settings.passing_score || Math.ceil(totalQuestions * 0.7);
        const isPassed = this.score >= passingScore;
        const isPerfect = this.score === totalQuestions;
        const percentageScore = Math.round((this.score / totalQuestions) * 100);
        const allowRetry = this.settings.allow_retry !== false; // Default true

        // Show retry only if: allow_retry is true AND user did NOT get a perfect score AND user failed
        const showRetry = allowRetry && !isPerfect && !isPassed;

        // Track quiz completion in learningPathState for progress calculation
        if (window.learningPathState) {
            window.learningPathState.completedQuiz = true;

            // Save quiz results for persistence across sessions
            window.learningPathState.quizResults = {
                score: this.score,
                total: totalQuestions,
                percentage: percentageScore,
                passed: isPassed,
                perfect: isPerfect,
                answers: { ...this.answers }, // Copy of user answers
                completedAt: new Date().toISOString()
            };

            // Save state to SCORM if available
            if (window.saveLearningPathState && typeof window.saveLearningPathState === 'function') {
                window.saveLearningPathState();
            }

            // Update progress display
            if (window.updateConceptsProgress && typeof window.updateConceptsProgress === 'function') {
                window.updateConceptsProgress();
            }

            // Dispatch event for sidebar synchronization
            document.dispatchEvent(new CustomEvent('quizCompleted', {
                detail: {
                    score: this.score,
                    total: totalQuestions,
                    passed: isPassed,
                    perfect: isPerfect,
                    percentage: percentageScore
                }
            }));
        }

        // Hide quiz content and show results
        const questionContainer = document.getElementById('quizQuestionContainer');
        const resultsContainer = document.getElementById('quizResults');

        if (questionContainer) questionContainer.style.display = 'none';
        if (resultsContainer) {
            resultsContainer.classList.remove('hidden');

            // Update results UI based on pass/fail/perfect status
            this.updateResultsUI(resultsContainer, {
                score: this.score,
                total: totalQuestions,
                percentage: percentageScore,
                isPassed,
                isPerfect,
                passingScore,
                showRetry
            });
        }

        // Update progress
        if (typeof updateProgress === 'function') updateProgress(4);

        // Hide navigation buttons
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.classList.add('hidden');

        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextQuestionBtn = document.getElementById('nextQuestionBtn');
        if (prevBtn) prevBtn.classList.add('hidden');
        if (nextQuestionBtn) nextQuestionBtn.classList.add('hidden');

        // Trigger celebration effects based on result
        if (isPerfect) {
            this.triggerFireworks();
        } else if (isPassed) {
            this.triggerConfetti();
        }

        // Update navigation
        this.updateNavigation();
    }

    /**
     * Update the results UI based on quiz outcome
     */
    updateResultsUI(container, { score, total, percentage, isPassed, isPerfect, passingScore, showRetry }) {
        // Determine icon, colors, and messages based on result
        let icon, gradientClass, title, message, iconBg;

        if (isPerfect) {
            icon = 'fa-crown';
            gradientClass = 'from-yellow-400 via-amber-500 to-orange-500';
            iconBg = 'from-yellow-400 to-amber-500';
            title = '🎉 Perfect Score!';
            message = 'Outstanding! You answered every question correctly. You\'ve mastered this material!';
        } else if (isPassed) {
            icon = 'fa-trophy';
            gradientClass = 'from-green-400 via-emerald-500 to-teal-500';
            iconBg = 'from-green-500 to-emerald-500';
            title = 'Congratulations!';
            message = `Great job! You passed with ${percentage}%. You've successfully completed this quiz.`;
        } else {
            icon = 'fa-book-open';
            gradientClass = 'from-orange-400 via-amber-500 to-yellow-500';
            iconBg = 'from-orange-500 to-amber-500';
            title = 'Keep Learning!';
            message = `You scored ${percentage}%. You need ${passingScore} correct answers to pass. Review the material and try again!`;
        }

        container.innerHTML = `
            <div class="text-center relative z-10 py-8">
                <!-- Result Icon -->
                <div class="w-24 h-24 bg-gradient-to-br ${iconBg} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ${isPerfect ? 'animate-bounce' : ''}">
                    <i class="fas ${icon} text-white text-4xl ${isPerfect ? 'animate-pulse' : ''}"></i>
                </div>
                
                <!-- Title -->
                <h3 class="text-3xl font-bold text-white mb-3">${title}</h3>
                
                <!-- Score Display -->
                <div class="quiz-score-display mb-4">
                    <span class="text-5xl font-bold text-white">${score}</span>
                    <span class="text-2xl text-white/80"> / ${total}</span>
                </div>
                
                <!-- Percentage Badge -->
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full ${isPassed ? 'bg-white/20' : 'bg-white/10'} mb-6">
                    <span class="text-lg font-semibold text-white">${percentage}%</span>
                    ${isPassed ? '<i class="fas fa-check-circle text-green-300"></i>' : '<i class="fas fa-info-circle text-amber-300"></i>'}
                </div>
                
                <!-- Message -->
                <p class="text-white/90 mb-8 max-w-md mx-auto leading-relaxed">${message}</p>
                
                <!-- Retry Button (conditional) -->
                ${showRetry ? `
                    <div class="flex justify-center">
                        <button onclick="retryQuiz()" id="retryQuizBtn"
                                class="group flex items-center gap-3 px-8 py-4 bg-white text-gray-800 rounded-2xl font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105">
                            <i class="fas fa-redo-alt group-hover:rotate-180 transition-transform duration-500"></i>
                            <span>Try Again</span>
                        </button>
                    </div>
                ` : ''}
                
                ${isPassed ? `
                    <!-- Finish Course Section (only for passed users) -->
                    <div id="finishCourseSection" class="flex flex-col items-center mt-6">
                        <!-- Button or message will be rendered by JavaScript -->
                    </div>
                ` : ''}
            </div>
        `;

        // Update container gradient based on result
        container.style.background = `linear-gradient(135deg, var(--tw-gradient-stops))`;
        container.className = `quiz-results bg-gradient-to-br ${gradientClass} rounded-3xl p-8 shadow-2xl`;

        // If passed, check if 100% complete to show Finish button or remaining message
        if (isPassed) {
            setTimeout(() => this.updateFinishCourseSection(), 100);
        }
    }

    /**
     * Update the Finish Course section based on 100% progress
     */
    updateFinishCourseSection() {
        const section = document.getElementById('finishCourseSection');
        if (!section) return;

        const remainingContent = window.scormAPIInstance?.getRemainingContent?.() || { isComplete: false, message: "Unable to determine progress" };

        if (remainingContent.isComplete) {
            // Show Finish Course button
            section.innerHTML = `
                <div class="flex flex-col items-center gap-3">
                    <button onclick="quizSystem.startCourseCompletionFlow()" id="finishCourseBtn"
                            class="group flex items-center gap-3 px-8 py-4 bg-white/90 hover:bg-white text-gray-800 rounded-2xl font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105">
                        <i class="fas fa-flag-checkered text-green-600"></i>
                        <span>Finish Course</span>
                        <i class="fas fa-chevron-right group-hover:translate-x-1 transition-transform duration-200"></i>
                    </button>
                    <p class="text-white/75 text-sm">A quick feedback step appears before final completion.</p>
                </div>
            `;
        } else {
            // Show remaining content message
            section.innerHTML = `
                <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 max-w-md">
                    <div class="flex items-center gap-3 text-amber-200 mb-2">
                        <i class="fas fa-exclamation-triangle text-lg"></i>
                        <span class="font-semibold">Course Not Yet Complete</span>
                    </div>
                    <p class="text-white/80 text-sm">${remainingContent.message}</p>
                </div>
            `;
        }
    }

    startCourseCompletionFlow() {
        const remainingContent = window.scormAPIInstance?.getRemainingContent?.() || { isComplete: false };

        if (!remainingContent.isComplete) {
            this.updateFinishCourseSection();
            return;
        }

        this.showFeedbackModal();
    }

    async showFeedbackModal() {
        this.ensureFeedbackStyles();

        const modalState = this.getFeedbackModalState();
        modalState.restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : modalState.restoreFocusTo;
        modalState.error = '';

        let modal = document.getElementById(this.feedbackModalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = this.feedbackModalId;
            modal.className = 'course-feedback-modal modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'courseFeedbackTitle');
            document.body.appendChild(modal);
        }

        this.renderFeedbackModal();

        if (!modalState.hasLoadedExisting && window.feedbackService?.isConfigured()) {
            modalState.isLoading = true;
            this.renderFeedbackModal();

            try {
                const existingFeedback = await window.feedbackService.getFeedback();
                if (existingFeedback) {
                    modalState.form = this.mapFeedbackToForm(existingFeedback);
                }
            } catch (error) {
                modalState.warning = error.message || 'Unable to load your saved feedback right now.';
            } finally {
                modalState.isLoading = false;
                modalState.hasLoadedExisting = true;
                this.renderFeedbackModal();
            }
        }
    }

    closeFeedbackModal() {
        const modal = document.getElementById(this.feedbackModalId);
        if (modal) {
            modal.remove();
        }

        const restoreFocusTo = this.feedbackModalState?.restoreFocusTo;
        if (restoreFocusTo && typeof restoreFocusTo.focus === 'function') {
            restoreFocusTo.focus();
        }
    }

    hasExportableNotes() {
        return Boolean(
            window.notesService &&
            typeof window.notesService.getSectionsWithContent === 'function' &&
            window.notesService.getSectionsWithContent().length > 0 &&
            window.notesUI &&
            typeof window.notesUI.exportPDF === 'function'
        );
    }

    closeNotesExportPrompt() {
        const modal = document.getElementById(this.notesExportModalId);
        if (modal) {
            modal.remove();
        }
    }

    showNotesExportPrompt() {
        this.ensureFeedbackStyles();

        const state = this.getNotesExportPromptState();
        state.isExporting = false;
        state.hasDownloaded = false;
        state.error = '';

        let modal = document.getElementById(this.notesExportModalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = this.notesExportModalId;
            modal.className = 'course-feedback-modal modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'courseNotesExportTitle');
            document.body.appendChild(modal);
        }

        this.renderNotesExportPrompt();
    }

    renderNotesExportPrompt(shouldFocus = true) {
        const modal = document.getElementById(this.notesExportModalId);
        if (!modal) return;

        const state = this.getNotesExportPromptState();
        const hasNotes = this.hasExportableNotes();
        const topicTitle = window.topicConfig?.title || window.templateData?.title || 'this topic';

        modal.innerHTML = `
            <div class="course-feedback-backdrop" data-notes-export-finish="backdrop"></div>
            <div class="course-notes-export-panel">
                <div class="course-notes-export-hero">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <div class="course-notes-export-kicker mb-3">
                                <i class="fas fa-book-open"></i>
                                Takeaway
                            </div>
                            <h2 id="courseNotesExportTitle" class="text-[1.8rem] leading-tight font-bold text-slate-900 mb-2">Take your notes with you</h2>
                            <p class="text-slate-600 max-w-lg">You completed ${this.escapeHtml(topicTitle)}. Download your personal notes as a polished PDF before finishing this topic.</p>
                        </div>
                        <button type="button" class="modal-close w-11 h-11 rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors" aria-label="Finish topic" data-notes-export-finish="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="course-notes-export-card">
                    <div class="flex items-start gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center text-xl shrink-0">
                            <i class="fas fa-file-arrow-down"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-xl font-bold text-slate-900 mb-2">Personal notes PDF</h3>
                            <p class="text-slate-600 leading-relaxed">${hasNotes ? 'Save a learner-friendly copy of your notes and keep it as a reference after you leave this topic.' : 'You have not added any notes in this topic yet, so there is nothing to export right now.'}</p>
                            <p class="course-notes-export-note">${state.hasDownloaded ? 'Your notes PDF has been downloaded. You can finish now or download it again.' : 'You can skip this step and finish the topic anytime.'}</p>
                            ${state.error ? `<p class="text-sm font-medium text-rose-600 mt-3">${this.escapeHtml(state.error)}</p>` : ''}
                        </div>
                    </div>
                    <div class="course-notes-export-actions">
                        <button type="button" class="px-5 py-3 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors" data-notes-export-finish="action">
                            Finish Topic
                        </button>
                        ${hasNotes ? `
                            <button type="button" class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed" data-notes-export-download="true" ${state.isExporting ? 'disabled' : ''}>
                                <i class="fas ${state.isExporting ? 'fa-spinner fa-spin' : 'fa-download'}"></i>
                                <span>${state.isExporting ? 'Preparing PDF...' : (state.hasDownloaded ? 'Download Again' : 'Download Notes PDF')}</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        modal.querySelectorAll('[data-notes-export-finish]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.finishTopicAfterExportPrompt();
            });
        });

        const downloadButton = modal.querySelector('[data-notes-export-download]');
        if (downloadButton) {
            downloadButton.addEventListener('click', () => this.exportNotesFromPrompt());
        }

        modal.onkeydown = (event) => {
            if (event.key === 'Escape' && !state.isExporting) {
                this.finishTopicAfterExportPrompt();
            }
        };

        if (shouldFocus) {
            const focusTarget = downloadButton || modal.querySelector('[data-notes-export-finish="action"]');
            if (focusTarget && typeof focusTarget.focus === 'function') {
                focusTarget.focus();
            }
        }
    }

    async exportNotesFromPrompt() {
        const state = this.getNotesExportPromptState();
        if (state.isExporting || !this.hasExportableNotes()) {
            return;
        }

        state.isExporting = true;
        state.error = '';
        this.renderNotesExportPrompt(false);

        try {
            const exportWorked = await window.notesUI?.exportPDF?.();
            if (exportWorked) {
                state.hasDownloaded = true;
            } else {
                state.error = 'Unable to export notes right now. You can still finish the topic.';
            }
        } catch (error) {
            state.error = error?.message || 'Unable to export notes right now. You can still finish the topic.';
        }

        state.isExporting = false;
        this.renderNotesExportPrompt(false);
    }

    finishTopicAfterExportPrompt() {
        this.closeNotesExportPrompt();
        this.finalizeCourseCompletion();
    }

    toggleFeedbackTag(tag) {
        const modalState = this.getFeedbackModalState();
        const selectedTags = modalState.form.experienceTags || [];

        if (selectedTags.includes(tag)) {
            modalState.form.experienceTags = selectedTags.filter((item) => item !== tag);
        } else {
            modalState.form.experienceTags = [...selectedTags, tag];
        }

        modalState.error = '';
        this.renderFeedbackModal();
    }

    setFeedbackRating(field, value) {
        const modalState = this.getFeedbackModalState();
        modalState.form[field] = value;
        modalState.error = '';
        this.renderFeedbackModal();
    }

    updateFeedbackField(field, value) {
        const modalState = this.getFeedbackModalState();
        modalState.form[field] = value;
    }

    getFeedbackSteps() {
        return [
            {
                key: 'conceptRating',
                noteField: 'conceptComment',
                title: 'How clear was the <span class="course-feedback-title-accent">concept</span>?',
                description: 'Rate the explanation quality and how easy it felt to absorb.',
                notePlaceholder: 'Anything about clarity, pacing, or explanation depth?'
            },
            {
                key: 'taskRating',
                noteField: 'taskComment',
                title: 'How useful were the <span class="course-feedback-title-accent">tasks</span>?',
                description: 'Rate how practical, engaging, and relevant the task flow felt.',
                notePlaceholder: 'Anything about difficulty, usefulness, or realism?'
            },
            {
                key: 'quizRating',
                noteField: 'quizComment',
                title: 'How well did the <span class="course-feedback-title-accent">quiz</span> fit?',
                description: 'Rate how fair and aligned the final assessment felt for this topic.',
                notePlaceholder: 'Anything about quiz fairness, challenge, or coverage?'
            },
            {
                key: 'final',
                title: 'Wrap it up',
                description: 'Choose a few tags and leave an overall note if you want.'
            }
        ];
    }

    getCurrentFeedbackStep() {
        const modalState = this.getFeedbackModalState();
        const steps = this.getFeedbackSteps();
        return steps[Math.max(0, Math.min(modalState.currentStep || 0, steps.length - 1))];
    }

    getRatingSummary(value) {
        const summaries = {
            1: 'Needs attention',
            2: 'Some rough edges',
            3: 'Solid overall',
            4: 'Strong experience',
            5: 'Outstanding'
        };

        return summaries[value] || 'Pick the emoji that fits best';
    }

    toggleFeedbackNote(field) {
        const modalState = this.getFeedbackModalState();
        modalState.noteVisibility[field] = !modalState.noteVisibility[field];
        this.renderFeedbackModal();
    }

    getCurrentStepValidationError() {
        const modalState = this.getFeedbackModalState();
        const step = this.getCurrentFeedbackStep();

        if (!step || step.key === 'final') {
            const tags = modalState.form.experienceTags || [];
            return tags.length ? '' : 'Please select at least one experience tag.';
        }

        const value = Number(modalState.form[step.key]);
        if (!Number.isInteger(value) || value < 1 || value > 5) {
            return 'Please choose a rating before continuing.';
        }

        return '';
    }

    goToFeedbackStep(nextStep) {
        const modalState = this.getFeedbackModalState();
        const maxIndex = this.getFeedbackSteps().length - 1;
        modalState.currentStep = Math.max(0, Math.min(nextStep, maxIndex));
        modalState.error = '';
        this.renderFeedbackModal();
    }

    goToNextFeedbackStep() {
        const validationError = this.getCurrentStepValidationError();
        const modalState = this.getFeedbackModalState();

        if (validationError) {
            modalState.error = validationError;
            this.renderFeedbackModal();
            return;
        }

        this.goToFeedbackStep((modalState.currentStep || 0) + 1);
    }

    goToPreviousFeedbackStep() {
        const modalState = this.getFeedbackModalState();
        this.goToFeedbackStep((modalState.currentStep || 0) - 1);
    }

    getFeedbackValidationError() {
        if (!window.feedbackService?.validateFormState) {
            return '';
        }

        const errors = window.feedbackService.validateFormState(this.getFeedbackModalState().form);
        return errors[0] || '';
    }

    async submitFeedbackAndFinish() {
        const modalState = this.getFeedbackModalState();
        const validationError = this.getFeedbackValidationError();

        if (validationError) {
            modalState.error = validationError;
            this.renderFeedbackModal();
            return;
        }

        if (!window.feedbackService?.isConfigured()) {
            modalState.error = 'Feedback service is not configured for this build.';
            this.renderFeedbackModal();
            return;
        }

        modalState.isSubmitting = true;
        modalState.error = '';
        this.renderFeedbackModal();

        try {
            const savedFeedback = await window.feedbackService.saveFeedback(modalState.form);
            if (window.learningPathState) {
                window.learningPathState.feedbackSubmittedAt = savedFeedback?.updated_at || new Date().toISOString();
                if (window.saveLearningPathState && typeof window.saveLearningPathState === 'function') {
                    window.saveLearningPathState();
                }
            }

            this.closeFeedbackModal();
            this.showNotesExportPrompt();
        } catch (error) {
            modalState.error = error.message || 'Unable to submit feedback right now.';
            modalState.isSubmitting = false;
            this.renderFeedbackModal();
            return;
        }

        modalState.isSubmitting = false;
    }

    buildRatingButtons(field, currentValue) {
        const arcOffsets = [0, -10, -16, -10, 0];

        return this.feedbackRatings.map((item) => `
            <button
                type="button"
                class="course-feedback-rating-btn ${currentValue === item.value ? 'is-active' : ''}"
                data-feedback-rating="${field}"
                data-rating-value="${item.value}"
                aria-label="Rate ${field} ${item.value} out of 5"
                title="${item.value} out of 5"
                style="--arc-offset: ${arcOffsets[item.value - 1]}px"
                aria-pressed="${currentValue === item.value ? 'true' : 'false'}">
                <span class="course-feedback-rating-emoji" aria-hidden="true">${item.emoji}</span>
            </button>
        `).join('');
    }

    buildTagButtons(selectedTags) {
        return this.feedbackTags.map((tag) => `
            <button
                type="button"
                class="course-feedback-tag-btn ${selectedTags.includes(tag) ? 'is-active' : ''}"
                data-feedback-tag="${this.escapeHtml(tag)}"
                aria-pressed="${selectedTags.includes(tag) ? 'true' : 'false'}">
                ${this.escapeHtml(tag)}
            </button>
        `).join('');
    }

    buildFeedbackField(field, value, placeholder, isMini) {
        return `
            <textarea
                class="course-feedback-textarea ${isMini ? 'course-feedback-mini-textarea' : ''}"
                data-feedback-field="${field}"
                placeholder="${this.escapeHtml(placeholder)}">${this.escapeHtml(value)}</textarea>
        `;
    }

    renderFeedbackRatingStep(step, form, modalState) {
        const ratingValue = form[step.key];
        const noteVisible = Boolean(modalState.noteVisibility[step.noteField]);

        return `
            <section class="course-feedback-step-shell">
                <div class="course-feedback-step-body">
                    <div class="text-center mb-2">
                        <span class="course-feedback-step-kicker">Quick pulse</span>
                    </div>
                        <div class="course-feedback-rating-stage">
                            <div class="course-feedback-rating-caption">
                                <h3>${step.title}</h3>
                                <p>${this.escapeHtml(step.description)}</p>
                            </div>
                        <div class="course-feedback-rating-arc-wrap">
                            <div class="course-feedback-rating-arc">${this.buildRatingButtons(step.key, ratingValue)}</div>
                        </div>
                        <div class="course-feedback-rating-summary">${this.escapeHtml(this.getRatingSummary(ratingValue))}</div>
                    </div>
                    <div class="mt-3">
                        <button type="button" class="course-feedback-note-toggle" data-feedback-note-toggle="${step.noteField}">
                            <i class="fas ${noteVisible ? 'fa-chevron-up' : 'fa-plus'} text-xs"></i>
                            <span>${noteVisible ? 'Hide note' : 'Add note'}</span>
                        </button>
                        ${noteVisible ? `
                            <div class="course-feedback-note-panel">
                                ${this.buildFeedbackField(step.noteField, form[step.noteField], step.notePlaceholder, true)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </section>
        `;
    }

    renderFeedbackFinalStep(form) {
        return `
            <section class="course-feedback-step-shell">
                <div class="course-feedback-step-body gap-4">
                    <div class="text-center mb-1">
                        <span class="course-feedback-step-kicker">Final step</span>
                    </div>
                    <div class="course-feedback-rating-caption mb-2">
                        <h3>What stood out most?</h3>
                        <p>Pick a few tags and leave an overall note if you want. This is the final step before completion.</p>
                    </div>
                    <div class="course-feedback-final-grid">
                        <div class="course-feedback-final-card">
                            <div class="mb-3">
                                <h4 class="text-base font-bold text-slate-900">Experience tags</h4>
                                <p class="text-sm text-slate-500">Select at least one.</p>
                            </div>
                            <div class="flex flex-wrap gap-3">${this.buildTagButtons(form.experienceTags || [])}</div>
                        </div>
                        <div class="course-feedback-final-card">
                            <div class="mb-3">
                                <h4 class="text-base font-bold text-slate-900">Overall note</h4>
                                <p class="text-sm text-slate-500">Optional, but useful if you want to leave a final thought.</p>
                            </div>
                            ${this.buildFeedbackField('comment', form.comment, 'What worked well? What could be even better?', false)}
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderFeedbackModal(shouldFocus = true) {
        const modal = document.getElementById(this.feedbackModalId);
        if (!modal) {
            return;
        }

        const modalState = this.getFeedbackModalState();
        const form = modalState.form;
        const context = this.getFeedbackContext();
        const finalValidationError = this.getFeedbackValidationError();
        const stepValidationError = this.getCurrentStepValidationError();
        const inlineError = modalState.error || '';
        const serviceConfigured = window.feedbackService?.isConfigured();
        const steps = this.getFeedbackSteps();
        const step = this.getCurrentFeedbackStep();
        const isFinalStep = step.key === 'final';
        const progressWidth = `${((modalState.currentStep || 0) + 1) / steps.length * 100}%`;
        const stepContent = isFinalStep
            ? this.renderFeedbackFinalStep(form)
            : this.renderFeedbackRatingStep(step, form, modalState);

        modal.innerHTML = `
            <div class="course-feedback-backdrop" data-feedback-close="backdrop"></div>
            <div class="course-feedback-panel">
                <div class="course-feedback-scroll">
                    <div class="px-6 pt-6 pb-5 sm:px-8 sm:pt-8">
                        <div class="course-feedback-hero mb-5">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <div class="inline-flex items-center gap-2 rounded-full bg-teal-50 text-teal-700 px-3 py-1 text-xs font-semibold tracking-wide uppercase mb-3">
                                        <i class="fas fa-sparkles"></i>
                                        Quick Feedback
                                    </div>
                                    <h2 id="courseFeedbackTitle" class="text-[1.9rem] leading-tight font-bold text-slate-900 mb-2">Before you finish, how was it?</h2>
                                    <p class="text-slate-600 max-w-xl">You completed ${this.escapeHtml(context.topicTitle)}. Give a quick pulse check and help us sharpen the next version.</p>
                                </div>
                                <button type="button" class="modal-close w-11 h-11 rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors" aria-label="Close feedback dialog" data-feedback-close="button">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="course-feedback-progress">
                                <span class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">${(modalState.currentStep || 0) + 1} of ${steps.length}</span>
                                <div class="course-feedback-progress-bar">
                                    <div class="course-feedback-progress-fill" style="width: ${progressWidth}"></div>
                                </div>
                            </div>
                        </div>

                        ${stepContent}

                        <div class="course-feedback-footer">
                            <div>
                                ${inlineError ? `<p class="text-sm font-medium text-rose-600">${this.escapeHtml(inlineError)}</p>` : ''}
                                ${!serviceConfigured ? '<p class="text-xs text-amber-600 mt-1">Feedback API URL is missing in this build.</p>' : ''}
                                ${modalState.warning && !inlineError ? `<p class="text-xs text-amber-600 mt-1">${this.escapeHtml(modalState.warning)}</p>` : ''}
                            </div>
                            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                                ${modalState.currentStep > 0 ? `
                                    <button type="button" class="px-5 py-3 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors" data-feedback-back="true" ${modalState.isSubmitting ? 'disabled' : ''}>
                                        Back
                                    </button>
                                ` : ''}
                                ${isFinalStep ? `
                                    <button type="button" class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed" data-feedback-submit="true" ${(modalState.isSubmitting || Boolean(finalValidationError) || !serviceConfigured) ? 'disabled' : ''}>
                                        <i class="fas ${modalState.isSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}"></i>
                                        <span>${modalState.isSubmitting ? 'Submitting...' : 'Submit and finish'}</span>
                                    </button>
                                ` : `
                                    <button type="button" class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed" data-feedback-next="true" ${(Boolean(stepValidationError) || modalState.isSubmitting) ? 'disabled' : ''}>
                                        <span>Next</span>
                                        <i class="fas fa-arrow-right"></i>
                                    </button>
                                `}
                            </div>
                        </div>

                        ${modalState.isLoading ? '<div class="mt-4 text-sm text-slate-500 flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i><span>Loading your saved feedback...</span></div>' : ''}
                    </div>
                </div>
            </div>
        `;

        modal.querySelectorAll('[data-feedback-rating]').forEach((button) => {
            button.addEventListener('click', () => {
                this.setFeedbackRating(button.dataset.feedbackRating, Number(button.dataset.ratingValue));
            });
        });

        modal.querySelectorAll('[data-feedback-tag]').forEach((button) => {
            button.addEventListener('click', () => {
                this.toggleFeedbackTag(button.dataset.feedbackTag);
            });
        });

        modal.querySelectorAll('[data-feedback-field]').forEach((field) => {
            field.addEventListener('input', (event) => {
                this.updateFeedbackField(field.dataset.feedbackField, event.target.value);
            });
        });

        modal.querySelectorAll('[data-feedback-note-toggle]').forEach((button) => {
            button.addEventListener('click', () => {
                this.toggleFeedbackNote(button.dataset.feedbackNoteToggle);
            });
        });

        modal.querySelectorAll('[data-feedback-close]').forEach((button) => {
            button.addEventListener('click', (event) => {
                if (modalState.isSubmitting) {
                    return;
                }

                if (button.dataset.feedbackClose === 'backdrop' || button.dataset.feedbackClose === 'button') {
                    event.preventDefault();
                    this.closeFeedbackModal();
                }
            });
        });

        const backButton = modal.querySelector('[data-feedback-back]');
        if (backButton) {
            backButton.addEventListener('click', () => this.goToPreviousFeedbackStep());
        }

        const nextButton = modal.querySelector('[data-feedback-next]');
        if (nextButton) {
            nextButton.addEventListener('click', () => this.goToNextFeedbackStep());
        }

        const submitButton = modal.querySelector('[data-feedback-submit]');
        if (submitButton) {
            submitButton.addEventListener('click', () => this.submitFeedbackAndFinish());
        }

        modal.onkeydown = (event) => {
            if (event.key === 'Escape' && !modalState.isSubmitting) {
                this.closeFeedbackModal();
            }
        };

        if (shouldFocus) {
            const autofocusTarget = modal.querySelector('[data-feedback-rating]') || modal.querySelector('[data-feedback-tag]') || modal.querySelector('button');
            if (autofocusTarget && typeof autofocusTarget.focus === 'function') {
                autofocusTarget.focus();
            }
        }
    }

    retryQuiz() {
        // Reset quiz state
        this.currentQuestionIndex = 0;
        this.answers = {};
        this.score = 0;
        this.completed = false;

        // Clear saved quiz results so fresh attempt is tracked
        if (window.learningPathState) {
            window.learningPathState.completedQuiz = false;
            window.learningPathState.quizResults = null;

            // Save cleared state to SCORM
            if (window.saveLearningPathState && typeof window.saveLearningPathState === 'function') {
                window.saveLearningPathState();
            }
        }

        // Update global variables
        window.currentQuestionIndex = this.currentQuestionIndex;
        window.quizAnswers = this.answers;
        window.quizScore = this.score;
        window.quizCompleted = this.completed;

        // Hide results and show first question
        const resultsContainer = document.getElementById('quizResults');
        const questionContainer = document.getElementById('quizQuestionContainer');

        if (resultsContainer) resultsContainer.classList.add('hidden');
        if (questionContainer) questionContainer.style.display = 'block';

        // Reload first question
        this.loadQuestion(0);
        this.updateProgress();
        this.updateNavigation();
        this.updateScore();
    }

    updateProgress() {
        const progressText = document.getElementById('quizProgressText');
        const progressBar = document.getElementById('quizProgressBar');

        if (progressText) {
            progressText.textContent = `${this.currentQuestionIndex + 1} of ${this.questions.length}`;
        }

        if (progressBar) {
            const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
            progressBar.style.width = `${progress}%`;
        }
    }

    updateQuestionDots(activeIndex) {
        const dots = document.querySelectorAll('.question-dot');
        dots.forEach((dot, index) => {
            if (index === activeIndex) {
                dot.classList.remove('bg-gray-300');
                dot.classList.add('bg-nebula-500');
            } else if (this.answers[index] !== undefined) {
                dot.classList.remove('bg-gray-300');
                dot.classList.add('bg-green-500');
            } else {
                dot.classList.remove('bg-nebula-500', 'bg-green-500');
                dot.classList.add('bg-gray-300');
            }
        });
    }

    updateScore() {
        const scoreElement = document.getElementById('currentScore');
        if (scoreElement) {
            scoreElement.textContent = this.score;
        }
    }

    updateNavigation() {
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const retryBtn = document.getElementById('retryQuizBtn');

        // If quiz is completed, hide navigation buttons and show retry button only
        if (this.completed) {
            if (prevBtn) {
                prevBtn.classList.add('hidden');
            }
            if (nextBtn) {
                nextBtn.classList.add('hidden');
            }
            if (retryBtn) {
                retryBtn.classList.remove('hidden');
            }
            return;
        }

        // Normal navigation state during quiz
        if (prevBtn) {
            prevBtn.classList.remove('hidden');
            prevBtn.disabled = this.currentQuestionIndex === 0;
        }

        if (nextBtn) {
            nextBtn.classList.remove('hidden');
            // Check if current question is answered
            const currentQuestion = this.questions[this.currentQuestionIndex];
            const questionType = this.normalizeQuestionType(currentQuestion?.type);
            const isAnswered = this.answers[this.currentQuestionIndex] !== undefined;

            // For checkbox questions, check if answer is submitted
            const isCheckboxSubmitted = questionType === 'checkbox' ?
                document.getElementById('submitCheckboxAnswer')?.disabled : true;

            const canProceed = isAnswered && (questionType === 'mcq' || isCheckboxSubmitted);

            nextBtn.disabled = !canProceed;

            if (this.currentQuestionIndex === this.questions.length - 1) {
                nextBtn.innerHTML = '<span>Finish Quiz</span><i class="fas fa-check group-hover:translate-x-1 transition-transform duration-200"></i>';
            } else {
                nextBtn.innerHTML = '<span>Next</span><i class="fas fa-arrow-right group-hover:translate-x-1 transition-transform duration-200"></i>';
            }
        }

        if (retryBtn) {
            retryBtn.classList.add('hidden');
        }
    }

    /**
     * Trigger confetti celebration for passing scores using canvas-confetti library
     */
    triggerConfetti() {
        // Check if canvas-confetti is available
        if (typeof confetti !== 'function') {
            console.warn('canvas-confetti library not loaded');
            return;
        }

        // Calculate the center of the results card relative to viewport
        const resultsContainer = document.getElementById('quizResults');
        let originX = 0.5; // Default center
        let originY = 0.6;

        if (resultsContainer) {
            const rect = resultsContainer.getBoundingClientRect();
            // Convert to 0-1 range relative to viewport
            originX = (rect.left + rect.width / 2) / window.innerWidth;
            originY = (rect.top + rect.height / 2) / window.innerHeight;
        }

        // Confetti burst from center of results card
        const count = 200;
        const defaults = {
            origin: { x: originX, y: originY },
            colors: ['#4A9B8E', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
            zIndex: 9999
        };

        function fire(particleRatio, opts) {
            confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio)
            });
        }

        // Sequential bursts for a nice effect - all centered on card
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    }

    /**
     * Trigger fireworks celebration for perfect scores using canvas-confetti library
     */
    triggerFireworks() {
        // Check if canvas-confetti is available
        if (typeof confetti !== 'function') {
            console.warn('canvas-confetti library not loaded');
            return;
        }

        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 9999,
            colors: ['#FFD700', '#FFA500', '#ff0000', '#00ff00', '#00ffff', '#ff00ff', '#ffffff']
        };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // Random fireworks from different positions
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
        }, 250);

        // Also do a big initial burst
        confetti({
            particleCount: 150,
            spread: 180,
            origin: { y: 0.5 },
            colors: ['#FFD700', '#FFA500', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24']
        });
    }

    /**
     * Show course completion screen - displayed when user clicks Finish Course
     */
    showCourseCompletionScreen() {
        this.finalizeCourseCompletion();
    }

    finalizeCourseCompletion() {
        if (document.getElementById('courseCompletionOverlay')) {
            return;
        }

        // Mark course as complete in SCORM
        if (window.scormAPIInstance && typeof window.scormAPIInstance.saveFinalQuizCompletion === 'function') {
            const percentage = window.learningPathState?.quizResults?.percentage || 100;
            window.scormAPIInstance.saveFinalQuizCompletion(percentage, true);
        }

        // Create completion overlay
        const overlay = document.createElement('div');
        overlay.id = 'courseCompletionOverlay';
        overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center';
        overlay.style.cssText = 'background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);';

        overlay.innerHTML = `
            <div class="text-center max-w-2xl mx-auto px-8 py-12 animate-fade-in">
                <!-- Success Icon -->
                <div class="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl animate-bounce">
                    <i class="fas fa-check text-white text-6xl"></i>
                </div>
                
                <!-- Title -->
                <h1 class="text-5xl font-bold text-white mb-6 tracking-tight">
                    🎉 Congratulations!
                </h1>
                
                <!-- Message -->
                <p class="text-xl text-gray-300 mb-4 leading-relaxed">
                    You have successfully completed this topic.
                </p>
                
                <p class="text-lg text-gray-400 mb-12">
                    You may now close this window and proceed to your next topic in the learning management system.
                </p>
                
                <!-- Topic Title -->
                <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 border border-white/20">
                    <p class="text-sm text-gray-400 mb-2">Topic Completed</p>
                    <h2 class="text-2xl font-bold text-white">${window.topicConfig?.title || 'Course'}</h2>
                </div>
                
                <!-- Score Summary -->
                <div class="flex justify-center gap-8 mb-12">
                    <div class="text-center">
                        <p class="text-4xl font-bold text-green-400">${window.learningPathState?.quizResults?.percentage || 100}%</p>
                        <p class="text-sm text-gray-400">Final Score</p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl font-bold text-blue-400">${window.learningPathState?.quizResults?.score || 0}/${window.learningPathState?.quizResults?.total || 0}</p>
                        <p class="text-sm text-gray-400">Correct Answers</p>
                    </div>
                </div>
                
                <!-- Close Instruction -->
                <div class="flex items-center justify-center gap-3 text-gray-400">
                    <i class="fas fa-times-circle text-lg"></i>
                    <span>Click the X button on the top right to close this window</span>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const notesFab = document.getElementById('notes-fab-btn');
        if (notesFab) {
            notesFab.style.display = 'none';
        }

        // Trigger celebration
        this.triggerFireworks();

        // Add fade-in animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fade-in {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in {
                animation: fade-in 0.8s ease-out forwards;
            }
        `;
        document.head.appendChild(style);
    }
}

// Global quiz system instance
window.quizSystem = new QuizSystem();

// Global functions for backward compatibility
function initializeQuiz(quizData = null) {
    // Use provided quiz data or fall back to template data
    const data = quizData || window.templateData.quiz;

    if (data) {
        console.log('🎯 Initializing quiz with data:', data);
        window.quizSystem.initialize(data);
    } else {
        console.error('No quiz data available for initialization');
    }
}

function nextQuestion() {
    window.quizSystem.nextQuestion();
}

function previousQuestion() {
    window.quizSystem.previousQuestion();
}

function retryQuiz() {
    window.quizSystem.retryQuiz();
}

// Question image carousel functions (individual display like task/hint sections)
function nextQuestionImage(questionIndex) {
    const indicator = document.getElementById(`question-carousel-indicator-${questionIndex}`);
    const imgElement = document.getElementById(`question-image-${questionIndex}`);
    const captionElement = document.getElementById(`question-image-caption-${questionIndex}`);

    if (!indicator || !imgElement) return;

    // Get the quiz data to access the images
    const question = window.quizSystem.questions[questionIndex];
    if (!question || !question.images || question.images.length <= 1) return;

    const totalImages = question.images.length;
    const current = parseInt(indicator.textContent);

    if (current < totalImages) {
        const nextIndex = current; // 0-based index for the images array
        const nextImage = question.images[nextIndex];

        // Update image source and alt text
        imgElement.src = nextImage.src;
        imgElement.alt = nextImage.alt || `Question image ${nextIndex + 1}`;

        // Update caption if available
        if (captionElement) {
            captionElement.textContent = nextImage.caption || '';
        }

        // Update indicator
        indicator.textContent = current + 1;
    } else {
        console.log('Already at last image');
    }
}

function prevQuestionImage(questionIndex) {
    const indicator = document.getElementById(`question-carousel-indicator-${questionIndex}`);
    const imgElement = document.getElementById(`question-image-${questionIndex}`);
    const captionElement = document.getElementById(`question-image-caption-${questionIndex}`);

    if (!indicator || !imgElement) return;

    // Get the quiz data to access the images
    const question = window.quizSystem.questions[questionIndex];
    if (!question || !question.images || question.images.length <= 1) return;

    const current = parseInt(indicator.textContent);

    if (current > 1) {
        const prevIndex = current - 2; // 0-based index for the images array
        const prevImage = question.images[prevIndex];

        // Update image source and alt text
        imgElement.src = prevImage.src;
        imgElement.alt = prevImage.alt || `Question image ${prevIndex + 1}`;

        // Update caption if available
        if (captionElement) {
            captionElement.textContent = prevImage.caption || '';
        }

        // Update indicator
        indicator.textContent = current - 1;
    } else {
        console.log('Already at first image');
    }
}

// Export for global access
window.initializeQuiz = initializeQuiz;
window.nextQuestion = nextQuestion;
window.previousQuestion = previousQuestion;
window.retryQuiz = retryQuiz;
window.nextQuestionImage = nextQuestionImage;
window.prevQuestionImage = prevQuestionImage;
