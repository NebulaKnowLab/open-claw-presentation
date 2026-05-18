class FeedbackService {
    constructor() {
        this.topicIdPattern = /^([A-Za-z]+)-M(\d+)-T(\d+(?:\.\d+)?)$/;
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

    getLearnerName() {
        const learnerName = String(window.scormLearnerData?.name || window.learnerData?.name || '').trim();
        return learnerName || null;
    }

    getApiBaseUrl() {
        const raw = window.templateConfig?.servicesApiBaseUrl || '';
        return raw.trim().replace(/\/$/, '');
    }

    isConfigured() {
        return Boolean(this.getApiBaseUrl());
    }

    parseTopicIdentity() {
        const topicId = window.templateData?.id || '';
        const match = this.topicIdPattern.exec(topicId);

        if (!match) {
            return {
                topicId,
                courseName: '',
                moduleNumber: '',
                topicNumber: ''
            };
        }

        return {
            topicId,
            courseName: match[1],
            moduleNumber: match[2],
            topicNumber: match[3]
        };
    }

    buildContext() {
        const identity = this.parseTopicIdentity();
        const learnerId = String(window.scormLearnerData?.id || window.learnerData?.id || 'anonymous').trim();
        const courseId = String(
            this.getCourseIdFromLocation() ||
            window.templateData?.courseId ||
            identity.courseName ||
            window.templateData?.id ||
            'unknown-course'
        ).trim();
        const moduleId = String(identity.moduleNumber ? `M${identity.moduleNumber}` : 'unknown-module').trim();
        const subtopicId = String(window.templateData?.id || identity.topicNumber || window.templateData?.title || 'unknown-subtopic').trim();

        return {
            learner_id: learnerId,
            course_id: courseId,
            module_id: moduleId,
            subtopic_id: subtopicId
        };
    }

    getTopicTitle() {
        return window.templateData?.title || window.topicConfig?.title || 'this course';
    }

    normalizeTags(tags) {
        const normalized = [];

        (tags || []).forEach((tag) => {
            const trimmed = String(tag || '').trim();
            if (trimmed && !normalized.includes(trimmed)) {
                normalized.push(trimmed);
            }
        });

        return normalized;
    }

    normalizeComment(value, maxLength) {
        const trimmed = String(value || '').trim();
        if (!trimmed) {
            return null;
        }

        return trimmed.slice(0, maxLength);
    }

    validateFormState(formState) {
        const errors = [];
        const ratings = ['conceptRating', 'taskRating', 'quizRating'];

        ratings.forEach((field) => {
            const value = Number(formState?.[field]);
            if (!Number.isInteger(value) || value < 1 || value > 5) {
                errors.push('Please add all ratings before submitting.');
            }
        });

        const tags = this.normalizeTags(formState?.experienceTags);
        if (!tags.length) {
            errors.push('Please select at least one experience tag.');
        }

        if (this.normalizeComment(formState?.comment, 501)?.length > 500) {
            errors.push('Overall comment must be 500 characters or less.');
        }

        ['conceptComment', 'taskComment', 'quizComment'].forEach((field) => {
            if (this.normalizeComment(formState?.[field], 2001)?.length > 2000) {
                errors.push('Detailed comments must be 2000 characters or less.');
            }
        });

        return Array.from(new Set(errors));
    }

    buildPayload(formState) {
        return {
            ...this.buildContext(),
            learner_name: this.getLearnerName(),
            conceptRating: Number(formState.conceptRating),
            taskRating: Number(formState.taskRating),
            quizRating: Number(formState.quizRating),
            experienceTags: this.normalizeTags(formState.experienceTags),
            comment: this.normalizeComment(formState.comment, 500),
            conceptComment: this.normalizeComment(formState.conceptComment, 2000),
            taskComment: this.normalizeComment(formState.taskComment, 2000),
            quizComment: this.normalizeComment(formState.quizComment, 2000)
        };
    }

    async getFeedback() {
        if (!this.isConfigured()) {
            return null;
        }

        const params = new URLSearchParams(this.buildContext());
        const response = await fetch(`${this.getApiBaseUrl()}/api/subtopic-feedback?${params.toString()}`);

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            let message = 'Failed to fetch feedback';

            try {
                const error = await response.json();
                message = error.detail || message;
            } catch (error) {
            }

            throw new Error(message);
        }

        const result = await response.json();
        return result.data || null;
    }

    async saveFeedback(formState) {
        if (!this.isConfigured()) {
            throw new Error('Feedback API base URL is not configured.');
        }

        const response = await fetch(`${this.getApiBaseUrl()}/api/subtopic-feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.buildPayload(formState))
        });

        if (!response.ok) {
            let message = 'Failed to save feedback';

            try {
                const error = await response.json();
                message = error.detail || message;
            } catch (error) {
            }

            throw new Error(message);
        }

        const result = await response.json();
        return result.data || null;
    }
}

window.feedbackService = new FeedbackService();
