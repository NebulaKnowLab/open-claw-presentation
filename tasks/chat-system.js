// Enhanced Chat System for Learning Platform
class ChatSystem {
    constructor() {
        this.templateData = null;
        this.topicConfig = null;
        this.learnerData = null;
    }

    initialize(templateData, topicConfig, learnerData) {
        this.templateData = templateData;
        this.topicConfig = topicConfig;
        this.learnerData = learnerData;
        this.currentSubConceptId = null; // Track current sub-concept

        // Setup page change listener to handle navigation
        this.setupPageChangeListener();
    }

    buildChatContext(contextType, additionalData = {}) {
        const template = this.templateData;

        if (!template) {
            console.warn('No template data available for chat context');
            return this.getDefaultContext();
        }

        switch(contextType) {
            case 'tutor_greeting':
                return {
                    context: 'tutor_greeting',
                    message: null, // No automatic message sent
                    contextData: {
                        conceptTitle: additionalData.conceptTitle,
                        subConceptTitle: additionalData.subConceptTitle,
                        subConceptId: additionalData.subConceptId
                    }
                };

            case 'learn_more':
                const conceptTitle = additionalData.conceptTitle || 'this concept';
                const learnMoreContext = additionalData.learnMoreContext || 'general';
                const conceptSummary = additionalData.conceptSummary || '';
                let additionalContextText = '';
                if (this.topicConfig && this.topicConfig.contexts) {
                    additionalContextText = this.topicConfig.contexts[learnMoreContext] || '';
                }
                // If mapping not found, fall back to the literal learn_more_context value (which may itself be a prompt)
                if (!additionalContextText && typeof learnMoreContext === 'string') {
                    additionalContextText = learnMoreContext;
                }

                return {
                    context: 'learn_more',
                    message: `I want to understand "${conceptTitle}" in detail. Please explain it with examples and how it relates to ${template.title || 'this topic'}.`,
                    contextData: {
                        conceptTitle: conceptTitle,
                        conceptSummary: conceptSummary,
                        learnMoreContext: learnMoreContext,
                        additionalContextText: additionalContextText,
                        topicTitle: template.title || 'This topic',
                        taskStatement: template.taskStatement || 'The assigned task'
                    }
                };

            case 'quiz_failed':
                const question = additionalData.question || {};
                const userAnswer = additionalData.userAnswer;

                let userAnswerText, correctAnswerText, finalMessage;

                // Check if this is a checkbox question
                if (question.questionType === 'checkbox' || Array.isArray(userAnswer)) {
                    // Handle checkbox questions
                    const selectedOptionsText = question.selectedOptionsText || 'no options selected';
                    const correctOptionsText = question.correctOptionsText || 'unknown correct answers';

                    userAnswerText = selectedOptionsText;
                    correctAnswerText = correctOptionsText;

                    finalMessage = `I got a quiz question wrong. The question was: "${question.question || 'the quiz question'}". I selected "${userAnswerText}" but the correct answers are "${correctAnswerText}". Please explain why my answer was wrong and help me understand the correct concept.`;
                } else {
                    // Handle MCQ questions (original logic)
                    const correctAnswer = question.correct_answer;

                    userAnswerText = (question.options && Array.isArray(question.options) && typeof userAnswer === 'number' && userAnswer >= 0)
                        ? question.options[userAnswer] || 'unknown selection'
                        : 'unknown selection';

                    correctAnswerText = (question.options && Array.isArray(question.options) && typeof correctAnswer === 'number' && correctAnswer >= 0)
                        ? question.options[correctAnswer] || 'unknown answer'
                        : 'unknown answer';

                    finalMessage = `I got a quiz question wrong. The question was: "${question.question || 'the quiz question'}". I selected "${userAnswerText}" but the correct answer is "${correctAnswerText}". Please explain why my answer was wrong and help me understand the correct concept.`;
                }

                return {
                    context: 'quiz_failed',
                    message: finalMessage,
                    contextData: {
                        quizQuestion: question.question || 'Unknown question',
                        userAnswer: userAnswer,
                        userAnswerText: userAnswerText,
                        correctAnswer: question.correct_answer || question.correct_answers,
                        correctAnswerText: correctAnswerText,
                        allOptions: question.options || [],
                        topicTitle: template.title || 'This topic',
                        taskStatement: template.taskStatement || 'The assigned task',
                        questionType: question.questionType || 'mcq'
                    }
                };

            default: // 'general'
                return {
                    context: 'general',
                    message: `Hello! I have questions about "${template.title || 'this topic'}". I'm working on: "${template.taskStatement || 'the assigned task'}".`,
                    contextData: {
                        topicTitle: template.title || 'This topic',
                        taskStatement: template.taskStatement || 'The assigned task'
                    }
                };
        }
    }

    getDefaultContext() {
        return {
            context: 'general',
            message: 'Hello! I need help with this learning topic.',
            contextData: {
                topicTitle: 'This topic',
                taskStatement: 'The assigned task'
            }
        };
    }

    openDynamicChat(contextType, additionalData = {}) {
        window.ensureChatWidget(() => {
            if (!window.chatWidget || !this.topicConfig) {
                console.warn('Chat widget or topic config not ready');
                return;
            }

            // Build context-specific prompt and data
            const chatConfig = this.buildChatContext(contextType, additionalData);

            chatWidget.initChatWidget({
                topic: this.topicConfig.topic,
                context: chatConfig.context,
                backendUrl: this.topicConfig.backendUrl,
                learnerData: this.learnerData,
                initialMessage: chatConfig.message,
                contextData: chatConfig.contextData
            });
        });
    }

    // Setup page change listener to handle navigation between sub-concepts
    setupPageChangeListener() {
        document.addEventListener('pageChanged', (event) => {
            const { toPage } = event.detail;

            // Check if we're navigating to a different sub-concept
            if (toPage && toPage.type === 'sub-concept') {
                const newSubConceptId = toPage.data.subConcept?.id;

                // If we have a current sub-concept and it's different from the new one
                if (this.currentSubConceptId && this.currentSubConceptId !== newSubConceptId) {
                    // Close the chat widget if it's open
                    if (window.chatWidget) {
                        console.log(`ChatSystem: Navigating from ${this.currentSubConceptId} to ${newSubConceptId}, closing chat widget`);
                        if (this.isChatWidgetOpen()) {
                            window.chatWidget.hideChat();
                        }
                        // Clear the context data to ensure fresh initialization
                        window.chatWidget.contextData = null;
                        // Clear the messages container to ensure fresh state
                        this.clearChatMessages();
                        // Remove the FAB trigger to prevent opening without context
                        this.removeChatTrigger();
                    }
                }

                // Update the current sub-concept ID
                this.currentSubConceptId = newSubConceptId;
            } else if (toPage && toPage.type !== 'sub-concept') {
                // If navigating away from sub-concepts, clear the current sub-concept ID
                this.currentSubConceptId = null;
                // Also close the chat widget when navigating to non-sub-concept pages
                if (window.chatWidget) {
                    console.log('ChatSystem: Navigating away from sub-concept, closing chat widget');
                    if (this.isChatWidgetOpen()) {
                        window.chatWidget.hideChat();
                    }
                    // Clear the context data to ensure fresh initialization
                    window.chatWidget.contextData = null;
                    // Clear the messages container to ensure fresh state
                    this.clearChatMessages();
                    // Remove the FAB trigger to prevent opening without context
                    this.removeChatTrigger();
                }
            }
        });
    }

    // Clear chat messages from DOM
    clearChatMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            console.log('ChatSystem: Clearing chat messages from DOM');
            messagesContainer.innerHTML = '';
        }
    }

    // Remove chat trigger (FAB) when navigating
    removeChatTrigger() {
        const chatTrigger = document.querySelector('.chat-trigger');
        if (chatTrigger) {
            console.log('ChatSystem: Removing chat trigger (FAB)');
            chatTrigger.remove();
        }
    }

    // Helper method to check if chat widget is open
    isChatWidgetOpen() {
        const chatWidget = document.getElementById('chat-widget');
        return chatWidget && chatWidget.classList.contains('open');
    }

    // New method for opening tutor with greeting
    openTutorWithGreeting() {
        window.ensureChatWidget(() => {
            if (!window.chatWidget || !this.topicConfig) {
                console.warn('Chat widget or topic config not ready');
                return;
            }

            const currentPage = window.paginationSystem?.getCurrentPage();
            if (!currentPage || currentPage.type !== 'sub-concept') {
                console.warn('Not on a sub-concept page');
                return;
            }

            const { concept, subConcept } = currentPage.data;
            const subConceptId = subConcept.id;

            // Check if we already have content for this sub-concept (even if widget is closed)
            if (this.hasWidgetContentForSubConcept(subConceptId)) {
                // Widget has content for this sub-concept, just show it
                console.log(`ChatSystem: Widget already has content for ${subConceptId}, showing without reinitializing`);
                this.currentSubConceptId = subConceptId;

                // If widget is not open, show it
                if (!this.isChatWidgetOpen()) {
                    window.chatWidget.showChat();
                }
                return;
            }

            // Check if chat widget is already open with the same sub-concept context
            if (this.isChatWidgetOpen() &&
                this.currentSubConceptId === subConceptId &&
                window.chatWidget.contextData &&
                window.chatWidget.contextData.subConceptId === subConceptId) {

                // Widget is already open with the same context, just ensure it's visible
                console.log(`ChatSystem: Widget already open with ${subConceptId}, keeping existing state`);
                window.chatWidget.showChat();
                return;
            }

            // Update the current sub-concept ID when opening tutor
            this.currentSubConceptId = subConceptId;

            // If widget is open but with different context, close it first
            if (this.isChatWidgetOpen()) {
                console.log(`ChatSystem: Widget open with different context, closing before reinitializing`);
                window.chatWidget.hideChat();

                // Add a small delay before reopening to ensure smooth transition
                setTimeout(() => {
                    this.initializeWidgetWithGreeting(concept, subConcept);
                }, 100);
            } else {
                // Widget is closed and has no content, initialize it with greeting
                this.initializeWidgetWithGreeting(concept, subConcept);
            }
        });
    }

    // Check if widget already has content for the specified sub-concept
    hasWidgetContentForSubConcept(subConceptId) {
        // Check if contextData matches
        if (window.chatWidget.contextData &&
            window.chatWidget.contextData.subConceptId === subConceptId) {

            // Check if there are messages in the DOM
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer && messagesContainer.children.length > 0) {
                // Found existing messages for this sub-concept
                return true;
            }
        }
        return false;
    }

    // Helper method to initialize widget with greeting
    initializeWidgetWithGreeting(concept, subConcept) {
        // Initialize widget with greeting mode
        chatWidget.initChatWidgetWithGreeting({
            topic: this.topicConfig.topic,
            context: 'tutor_greeting',
            backendUrl: this.topicConfig.backendUrl,
            learnerData: this.learnerData,
            contextData: {
                conceptTitle: concept.title,
                subConceptTitle: subConcept.title,
                subConceptId: subConcept.id,
                botContext: subConcept.bot_context || null // Pass bot_context for system prompt
            }
        });
    }
}

// Global chat system instance
window.chatSystem = new ChatSystem();

// Global chat functions for backward compatibility
function openDynamicChat(contextType, additionalData = {}) {
    window.chatSystem.openDynamicChat(contextType, additionalData);
}

function openGeneralChat() {
    openDynamicChat('general');
}

function openLearnMore(learnMoreContext, conceptTitle) {
    // Extract concept summary from template data if available
    let conceptSummary = '';
    if (window.templateData && window.templateData.concepts) {
        const concept = window.templateData.concepts.find(c => c.title === conceptTitle);
        conceptSummary = concept ? concept.summary : '';
    }

    openDynamicChat('learn_more', {
        conceptTitle: conceptTitle,
        learnMoreContext: learnMoreContext,
        conceptSummary: conceptSummary
    });
}

function openQuizFailureChat(question, userAnswer) {
    openDynamicChat('quiz_failed', {
        question: question,
        userAnswer: userAnswer
    });
}

// Export for global access - only essential functions
window.openDynamicChat = openDynamicChat;
window.openGeneralChat = openGeneralChat;
window.openLearnMore = openLearnMore;
window.openQuizFailureChat = openQuizFailureChat;
