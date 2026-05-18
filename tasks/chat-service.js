// Chat Service Abstraction Layer - Custom backend only

class ChatService {
    constructor() {
        this.topicIdPattern = /^([A-Za-z]+)-M(\d+)-T(\d+(?:\.\d+)?)$/;
    }

    getApiBaseUrl() {
        const raw = window.templateConfig?.servicesApiBaseUrl || '';
        return raw.trim().replace(/\/$/, '');
    }

    getCandidateLocationTexts() {
        const locations = [];
        const candidates = [window, window.parent, window.top];

        for (const candidate of candidates) {
            try {
                if (!candidate || !candidate.location) {
                    continue;
                }

                const href = candidate.location.href || '';
                const hash = candidate.location.hash || '';
                const combined = `${href} ${hash}`.trim();

                if (combined && !locations.includes(combined)) {
                    locations.push(combined);
                }
            } catch (error) {
            }
        }

        return locations;
    }

    getCourseIdFromLocation() {
        for (const locationText of this.getCandidateLocationTexts()) {
            const match = locationText.match(/\/course\/(\d+)/);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    parseTopicIdentity() {
        const topicId = window.templateData?.id || '';
        const match = this.topicIdPattern.exec(topicId);

        if (!match) {
            return {
                topicId,
                courseName: '',
                moduleNumber: ''
            };
        }

        return {
            topicId,
            courseName: match[1],
            moduleNumber: match[2]
        };
    }

    getLearnerId(learnerData) {
        const learnerId = String(learnerData?.id || window.scormLearnerData?.id || window.learnerData?.id || 'anonymous').trim();
        return learnerId || 'anonymous';
    }

    getLearnerName(learnerData) {
        const learnerName = String(learnerData?.name || window.scormLearnerData?.name || window.learnerData?.name || '').trim();
        return learnerName || null;
    }

    getCourseId() {
        try {
            const identity = this.parseTopicIdentity();
            return String(
                this.getCourseIdFromLocation() ||
                window.templateData?.courseId ||
                identity.courseName ||
                window.templateData?.id ||
                'unknown-course'
            ).trim();
        } catch (error) {
            console.error('Error extracting courseId:', error);
            return 'unknown-course';
        }
    }

    getModuleId() {
        try {
            const identity = this.parseTopicIdentity();
            return String(identity.moduleNumber ? `M${identity.moduleNumber}` : 'unknown-module').trim();
        } catch (error) {
            console.error('Error extracting moduleId:', error);
            return 'unknown-module';
        }
    }

    getSubtopicId() {
        try {
            return window.templateData?.title || 'unknown-subtopic';
        } catch (error) {
            console.error('Error extracting subtopicId:', error);
            return 'unknown-subtopic';
        }
    }

    async sendMessage(message, context, learnerData) {
        const apiBaseUrl = this.getApiBaseUrl();
        if (!apiBaseUrl) {
            throw new Error('Services API base URL is not configured.');
        }

        const payload = {
            user_message: message,
            system_prompt: this.getSystemPrompt(context),
            learner_id: this.getLearnerId(learnerData),
            learner_name: this.getLearnerName(learnerData),
            course_id: this.getCourseId(),
            module_id: this.getModuleId(),
            subtopic_id: this.getSubtopicId(),
            use_rag: false
        };

        const response = await fetch(`${apiBaseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Chat backend request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return {
            reply: data.message,
            sessionId: data.session_id,
            status: data.status,
            sources: data.sources || []
        };
    }

    async loadHistory(learnerData) {
        const apiBaseUrl = this.getApiBaseUrl();
        if (!apiBaseUrl) {
            return null;
        }

        try {
            const params = new URLSearchParams({
                learner_id: this.getLearnerId(learnerData),
                course_id: this.getCourseId(),
                module_id: this.getModuleId(),
                subtopic_id: this.getSubtopicId()
            });

            const response = await fetch(`${apiBaseUrl}/api/chat/history?${params}`, {
                method: 'GET',
                headers: {
                    accept: 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`History request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            return {
                sessionId: data.session_id,
                messages: data.messages || [],
                totalMessages: data.total_messages || 0
            };

        } catch (error) {
            console.error('Failed to load history:', error);
            return null;
        }
    }

    getSystemPrompt(context) {
        const SYSTEM_PROMPTS = {
            learn_more: this.getLearnMorePrompt(),
            quiz_failed: 'You are an educational assistant specializing in error analysis. Explain quiz mistakes clearly and concisely. Focus on the key concept, explain why the incorrect answer is wrong, and provide actionable guidance to help the learner understand the correct approach.',
            general: 'You are a helpful educational assistant focused on supporting the learner\'s understanding of the current topic. Provide clear, accurate, and supportive responses that help learners succeed.',
            tutor_greeting: this.getTutorGreetingPrompt()
        };

        return SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;
    }

    getLearnMorePrompt() {
        try {
            if (window.chatWidget && window.chatWidget.contextData) {
                const widgetContext = window.chatWidget.contextData;

                if (widgetContext.learnMoreContext && widgetContext.learnMoreContext.trim() !== '') {
                    const contextPrompt = widgetContext.learnMoreContext.trim();
                    return `You are an educational tutor specializing in this topic. ${contextPrompt} Provide clear, detailed explanations with practical examples to help students deepen their understanding of this concept and its real-world applications.`;
                }

                if (widgetContext.additionalContextText && widgetContext.additionalContextText.trim() !== '') {
                    const contextPrompt = widgetContext.additionalContextText.trim();
                    return `You are an educational tutor specializing in this topic. ${contextPrompt} Provide clear, detailed explanations with practical examples to help students deepen their understanding of this concept and its real-world applications.`;
                }

                if (widgetContext.conceptTitle) {
                    return this.generatePromptFromTitle(widgetContext.conceptTitle);
                }
            }

            const currentConcept = this.getCurrentConcept();

            if (currentConcept && currentConcept.learn_more_context && currentConcept.learn_more_context.trim() !== '') {
                const contextPrompt = currentConcept.learn_more_context.trim();
                return `You are an educational tutor specializing in this topic. ${contextPrompt} Provide clear, detailed explanations with practical examples to help students deepen their understanding of this concept and its real-world applications.`;
            }

            return this.getFallbackPrompt();

        } catch (error) {
            console.error('Error generating learn_more prompt:', error);
            return this.getFallbackPrompt();
        }
    }

    getCurrentConcept() {
        try {
            if (window.chatWidget && window.chatWidget.contextData && window.chatWidget.contextData.conceptTitle) {
                const concepts = window.templateData?.content?.concepts || [];
                return concepts.find((concept) => concept.title === window.chatWidget.contextData.conceptTitle) || concepts[0] || null;
            }

            const concepts = window.templateData?.content?.concepts || [];
            return concepts.length > 0 ? concepts[0] : null;
        } catch (error) {
            console.error('Error getting current concept:', error);
            return null;
        }
    }

    generatePromptFromTitle(title) {
        return `You are an educational tutor specializing in ${title}. Provide comprehensive explanations of this topic with practical examples, real-world applications, and clear explanations that help students understand the core concepts thoroughly.`;
    }

    getFallbackPrompt() {
        return 'You are an educational tutor explaining concepts in detail. Provide comprehensive explanations with practical examples that help students understand the topic thoroughly and see how it applies to real-world scenarios.';
    }

    getTutorGreetingPrompt() {
        try {
            if (window.chatWidget && window.chatWidget.contextData && window.chatWidget.contextData.botContext) {
                const botContext = window.chatWidget.contextData.botContext.trim();

                if (botContext && botContext !== '') {
                    return botContext;
                }
            }

            return 'You are a helpful educational assistant focused on supporting the learner\'s understanding of the current topic. Provide clear, accurate, and supportive responses that help learners succeed.';

        } catch (error) {
            console.error('Error generating tutor greeting prompt:', error);
            return this.getFallbackPrompt();
        }
    }

    getCurrentSessionId() {
        return localStorage.getItem('chat_session_id') || null;
    }

    setSessionId(sessionId) {
        if (sessionId) {
            localStorage.setItem('chat_session_id', sessionId);
        }
    }

    getConfigInfo() {
        return {
            servicesApiBaseUrl: this.getApiBaseUrl(),
            courseId: this.getCourseId(),
            moduleId: this.getModuleId(),
            subtopicId: this.getSubtopicId()
        };
    }
}

window.chatService = new ChatService();

console.log('ChatService loaded successfully');
