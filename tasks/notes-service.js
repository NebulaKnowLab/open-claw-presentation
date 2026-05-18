class NotesService {
    constructor() {
        this.topicIdPattern = /^([A-Za-z]+)-M(\d+)-T(\d+(?:\.\d+)?)$/;
        this.MAX_CONTENT_LENGTH = 15000;
        this.LOCAL_STORAGE_KEY = null;
        this.contentObj = null;
        this.lastSavedRaw = null;
        this.savePromise = null;
        this.retryTimer = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryBaseDelay = 3000;
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    }

    getApiBaseUrl() {
        const raw = window.templateConfig?.servicesApiBaseUrl || '';
        return raw.trim().replace(/\/$/, '');
    }

    isConfigured() {
        return Boolean(this.getApiBaseUrl());
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

    getLearnerId() {
        const id = String(
            window.scormLearnerData?.id ||
            window.learnerData?.id ||
            'anonymous'
        ).trim();
        return id || 'anonymous';
    }

    getLearnerName() {
        const name = String(
            window.scormLearnerData?.name ||
            window.learnerData?.name ||
            ''
        ).trim();
        return name || null;
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
            console.error('NotesService: Error extracting courseId:', error);
            return 'unknown-course';
        }
    }

    getModuleId() {
        try {
            const identity = this.parseTopicIdentity();
            return String(
                identity.moduleNumber ? `M${identity.moduleNumber}` : 'unknown-module'
            ).trim();
        } catch (error) {
            console.error('NotesService: Error extracting moduleId:', error);
            return 'unknown-module';
        }
    }

    getSubtopicId() {
        try {
            return String(
                window.templateData?.id ||
                window.templateData?.title ||
                'unknown-subtopic'
            ).trim();
        } catch (error) {
            console.error('NotesService: Error extracting subtopicId:', error);
            return 'unknown-subtopic';
        }
    }

    buildContext() {
        return {
            learner_id: this.getLearnerId(),
            learner_name: this.getLearnerName(),
            course_id: this.getCourseId(),
            module_id: this.getModuleId(),
            subtopic_id: this.getSubtopicId()
        };
    }

    getLocalStorageKey() {
        if (this.LOCAL_STORAGE_KEY) {
            return this.LOCAL_STORAGE_KEY;
        }

        const ctx = this.buildContext();
        this.LOCAL_STORAGE_KEY = `scorm_notes_${ctx.learner_id}_${ctx.subtopic_id}`;
        return this.LOCAL_STORAGE_KEY;
    }

    createEmptyContent() {
        const content = {
            introduction: '',
            concepts: {},
            tasks: {},
            'final-quiz': ''
        };

        try {
            const topicConfig = window.topicConfig || window.templateData?.content || {};

            if (topicConfig.concepts) {
                for (const concept of topicConfig.concepts) {
                    if (concept.sub_concepts) {
                        for (const sc of concept.sub_concepts) {
                            if (sc.id) {
                                content.concepts[sc.id] = '';
                            }
                        }
                    } else if (concept.id) {
                        content.concepts[concept.id] = '';
                    }
                }
            }

            if (topicConfig.tasks) {
                for (const task of topicConfig.tasks) {
                    if (task.id) {
                        content.tasks[task.id] = '';
                    }
                }
            }
        } catch (error) {
            console.warn('NotesService: Could not pre-populate sections from topic config:', error);
        }

        return content;
    }

    serializeContent(contentObj) {
        try {
            return JSON.stringify(contentObj);
        } catch (error) {
            console.error('NotesService: Failed to serialize content:', error);
            return '{}';
        }
    }

    parseContent(rawString) {
        if (!rawString || typeof rawString !== 'string' || !rawString.trim()) {
            return this.createEmptyContent();
        }

        try {
            const parsed = JSON.parse(rawString);
            const empty = this.createEmptyContent();

            if (typeof parsed.introduction === 'string') {
                empty.introduction = parsed.introduction;
            }
            if (typeof parsed['final-quiz'] === 'string') {
                empty['final-quiz'] = parsed['final-quiz'];
            }
            if (parsed.concepts && typeof parsed.concepts === 'object') {
                for (const key of Object.keys(empty.concepts)) {
                    if (typeof parsed.concepts[key] === 'string') {
                        empty.concepts[key] = parsed.concepts[key];
                    }
                }
                for (const key of Object.keys(parsed.concepts)) {
                    if (!(key in empty.concepts)) {
                        empty.concepts[key] = parsed.concepts[key];
                    }
                }
            }
            if (parsed.tasks && typeof parsed.tasks === 'object') {
                for (const key of Object.keys(empty.tasks)) {
                    if (typeof parsed.tasks[key] === 'string') {
                        empty.tasks[key] = parsed.tasks[key];
                    }
                }
                for (const key of Object.keys(parsed.tasks)) {
                    if (!(key in empty.tasks)) {
                        empty.tasks[key] = parsed.tasks[key];
                    }
                }
            }

            return empty;
        } catch (error) {
            console.warn('NotesService: Failed to parse content JSON, returning empty:', error);
            return this.createEmptyContent();
        }
    }

    getTotalCharCount(contentObj) {
        if (!contentObj) return 0;

        let total = 0;

        if (typeof contentObj.introduction === 'string') {
            total += contentObj.introduction.length;
        }
        if (typeof contentObj['final-quiz'] === 'string') {
            total += contentObj['final-quiz'].length;
        }
        if (contentObj.concepts && typeof contentObj.concepts === 'object') {
            for (const val of Object.values(contentObj.concepts)) {
                if (typeof val === 'string') {
                    total += val.length;
                }
            }
        }
        if (contentObj.tasks && typeof contentObj.tasks === 'object') {
            for (const val of Object.values(contentObj.tasks)) {
                if (typeof val === 'string') {
                    total += val.length;
                }
            }
        }

        return total;
    }

    getSerializedLength(contentObj) {
        return this.serializeContent(contentObj).length;
    }

    formatCharCount(count) {
        if (count >= 1000) {
            const val = (count / 1000).toFixed(1);
            return `${val}k/15k`;
        }
        return `${count}/15k`;
    }

    getSectionKey(pageType, pageId) {
        if (!pageType) return null;

        switch (pageType) {
            case 'introduction':
                return { group: 'introduction', key: 'introduction' };
            case 'sub-concept':
                return { group: 'concepts', key: pageId || null };
            case 'task':
                return { group: 'tasks', key: pageId || null };
            case 'final-quiz':
                return { group: 'final-quiz', key: 'final-quiz' };
            default:
                return null;
        }
    }

    getSectionContent(contentObj, sectionInfo) {
        if (!contentObj || !sectionInfo) return '';

        const { group, key } = sectionInfo;

        if (group === 'introduction') {
            return contentObj.introduction || '';
        }
        if (group === 'final-quiz') {
            return contentObj['final-quiz'] || '';
        }
        if ((group === 'concepts' || group === 'tasks') && key) {
            return contentObj[group]?.[key] || '';
        }

        return '';
    }

    setSectionContent(contentObj, sectionInfo, text) {
        if (!contentObj || !sectionInfo) return contentObj;

        const { group, key } = sectionInfo;
        const trimmed = (text || '').slice(0, this.MAX_CONTENT_LENGTH);

        if (group === 'introduction') {
            contentObj.introduction = trimmed;
        } else if (group === 'final-quiz') {
            contentObj['final-quiz'] = trimmed;
        } else if ((group === 'concepts' || group === 'tasks') && key) {
            if (!contentObj[group]) {
                contentObj[group] = {};
            }
            contentObj[group][key] = trimmed;
        }

        return contentObj;
    }

    ensureSectionExists(contentObj, sectionInfo) {
        if (!contentObj || !sectionInfo) return;

        const { group, key } = sectionInfo;

        if ((group === 'concepts' || group === 'tasks') && key) {
            if (!contentObj[group]) {
                contentObj[group] = {};
            }
            if (!(key in contentObj[group])) {
                contentObj[group][key] = '';
            }
        }
    }

    deleteSection(contentObj, sectionInfo) {
        if (!contentObj || !sectionInfo) return contentObj;

        const { group, key } = sectionInfo;

        if (group === 'introduction') {
            contentObj.introduction = '';
        } else if (group === 'final-quiz') {
            contentObj['final-quiz'] = '';
        } else if ((group === 'concepts' || group === 'tasks') && key) {
            if (contentObj[group] && key in contentObj[group]) {
                contentObj[group][key] = '';
            }
        }

        return contentObj;
    }

    isWithinLimit(contentObj) {
        return this.getSerializedLength(contentObj) <= this.MAX_CONTENT_LENGTH;
    }

    getContent() {
        return this.contentObj;
    }

    hasUnsavedBackendData() {
        if (!this.contentObj) return false;
        const current = this.serializeContent(this.contentObj);
        return current !== this.lastSavedRaw;
    }

    saveLocalCache(contentObj) {
        try {
            const key = this.getLocalStorageKey();
            const raw = this.serializeContent(contentObj);
            localStorage.setItem(key, raw);
        } catch (error) {
            console.warn('NotesService: Failed to save local cache:', error);
        }
    }

    loadLocalCache() {
        try {
            const key = this.getLocalStorageKey();
            const raw = localStorage.getItem(key);
            if (raw) {
                return this.parseContent(raw);
            }
        } catch (error) {
            console.warn('NotesService: Failed to load local cache:', error);
        }
        return null;
    }

    clearLocalCache() {
        try {
            const key = this.getLocalStorageKey();
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('NotesService: Failed to clear local cache:', error);
        }
    }

    setupConnectivityListeners() {
        if (typeof window === 'undefined') return;

        window.addEventListener('online', () => {
            this.isOnline = true;
            this.retryCount = 0;
            this.scheduleRetry();
            document.dispatchEvent(new CustomEvent('notesConnectivityChanged', {
                detail: { online: true }
            }));
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.clearRetryTimer();
            document.dispatchEvent(new CustomEvent('notesConnectivityChanged', {
                detail: { online: false }
            }));
        });
    }

    scheduleRetry() {
        this.clearRetryTimer();

        if (!this.hasUnsavedBackendData() || !this.isOnline || !this.isConfigured()) {
            return;
        }

        if (this.retryCount >= this.maxRetries) {
            this.retryCount = 0;
        }

        const delay = this.retryBaseDelay * Math.pow(1.5, this.retryCount);
        this.retryCount++;

        this.retryTimer = setTimeout(async () => {
            if (this.hasUnsavedBackendData() && this.isOnline) {
                try {
                    await this.saveNote(this.contentObj);
                    this.retryCount = 0;
                    document.dispatchEvent(new CustomEvent('notesSaveRetried', {
                        detail: { success: true }
                    }));
                } catch (error) {
                    this.scheduleRetry();
                    document.dispatchEvent(new CustomEvent('notesSaveRetried', {
                        detail: { success: false }
                    }));
                }
            }
        }, delay);
    }

    clearRetryTimer() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }

    async loadNote() {
        const cached = this.loadLocalCache();
        if (cached) {
            this.contentObj = cached;
        }

        if (!this.isConfigured()) {
            if (!this.contentObj) {
                this.contentObj = this.createEmptyContent();
            }
            return this.contentObj;
        }

        try {
            const ctx = this.buildContext();
            const params = new URLSearchParams({
                learner_id: ctx.learner_id,
                course_id: ctx.course_id,
                module_id: ctx.module_id,
                subtopic_id: ctx.subtopic_id
            });

            const response = await fetch(
                `${this.getApiBaseUrl()}/api/session-note?${params.toString()}`
            );

            if (response.status === 404) {
                this.contentObj = this.createEmptyContent();
                this.lastSavedRaw = this.serializeContent(this.contentObj);
                this.saveLocalCache(this.contentObj);
                return this.contentObj;
            }

            if (!response.ok) {
                let message = 'Failed to load note';
                try {
                    const error = await response.json();
                    message = error.detail || message;
                } catch (e) {
                }
                console.warn('NotesService:', message);
                if (!this.contentObj) {
                    this.contentObj = this.createEmptyContent();
                }
                return this.contentObj;
            }

            const envelope = await response.json();
            const rawData = envelope.data || envelope;
            const rawContent = rawData.content || '';

            this.contentObj = this.parseContent(rawContent);
            this.lastSavedRaw = this.serializeContent(this.contentObj);
            this.saveLocalCache(this.contentObj);

            return this.contentObj;
        } catch (error) {
            console.warn('NotesService: Load failed, using cache:', error);
            if (!this.contentObj) {
                this.contentObj = this.createEmptyContent();
            }
            return this.contentObj;
        }
    }

    async saveNote(contentObj) {
        if (!contentObj) {
            contentObj = this.contentObj;
        }

        this.contentObj = contentObj;
        this.saveLocalCache(contentObj);

        if (!this.isConfigured()) {
            return contentObj;
        }

        const serialized = this.serializeContent(contentObj);

        if (serialized.length > this.MAX_CONTENT_LENGTH) {
            console.warn('NotesService: Content exceeds max length, trimming may be needed');
        }

        try {
            const ctx = this.buildContext();
            const payload = {
                learner_id: ctx.learner_id,
                learner_name: ctx.learner_name,
                course_id: ctx.course_id,
                module_id: ctx.module_id,
                subtopic_id: ctx.subtopic_id,
                content: serialized
            };

            const response = await fetch(`${this.getApiBaseUrl()}/api/session-note`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let message = 'Failed to save note';
                try {
                    const error = await response.json();
                    message = error.detail || message;
                } catch (e) {
                }
                throw new Error(message);
            }

            const envelope = await response.json();
            const rawData = envelope.data || envelope;
            this.lastSavedRaw = this.serializeContent(this.contentObj);
            this.clearRetryTimer();
            this.retryCount = 0;

            return rawData;
        } catch (error) {
            console.warn('NotesService: Save failed (kept in local cache):', error);
            this.scheduleRetry();
            throw error;
        }
    }

    async deleteAllNotes() {
        this.contentObj = this.createEmptyContent();
        this.saveLocalCache(this.contentObj);

        if (!this.isConfigured()) {
            return true;
        }

        try {
            const ctx = this.buildContext();
            const params = new URLSearchParams({
                learner_id: ctx.learner_id,
                course_id: ctx.course_id,
                module_id: ctx.module_id,
                subtopic_id: ctx.subtopic_id
            });

            const response = await fetch(
                `${this.getApiBaseUrl()}/api/session-note?${params.toString()}`,
                { method: 'DELETE' }
            );

            if (response.status === 404) {
                return true;
            }

            if (!response.ok) {
                let message = 'Failed to delete note';
                try {
                    const error = await response.json();
                    message = error.detail || message;
                } catch (e) {
                }
                throw new Error(message);
            }

            this.lastSavedRaw = this.serializeContent(this.contentObj);
            return true;
        } catch (error) {
            console.warn('NotesService: Delete failed:', error);
            throw error;
        }
    }

    getAllSectionLabels() {
        const sections = [];

        try {
            const topicConfig = window.topicConfig || window.templateData?.content || {};

            sections.push({
                group: 'introduction',
                key: 'introduction',
                label: 'Introduction',
                compactLabel: 'Intro',
                order: 0
            });

            let conceptIdx = 0;
            if (topicConfig.concepts) {
                for (const concept of topicConfig.concepts) {
                    conceptIdx++;
                    if (concept.sub_concepts && concept.sub_concepts.length > 0) {
                        let scIdx = 0;
                        for (const sc of concept.sub_concepts) {
                            if (sc.id) {
                                scIdx++;
                                sections.push({
                                    group: 'concepts',
                                    key: sc.id,
                                    label: sc.title || concept.title || `Concept ${conceptIdx}.${scIdx}`,
                                    compactLabel: `C-${conceptIdx}.${scIdx}`,
                                    order: sections.length
                                });
                            }
                        }
                    } else if (concept.id) {
                        sections.push({
                            group: 'concepts',
                            key: concept.id,
                            label: concept.title || `Concept ${conceptIdx}`,
                            compactLabel: `C-${conceptIdx}`,
                            order: sections.length
                        });
                    }
                }
            }

            let taskIdx = 0;
            if (topicConfig.tasks) {
                for (const task of topicConfig.tasks) {
                    if (task.id) {
                        taskIdx++;
                        sections.push({
                            group: 'tasks',
                            key: task.id,
                            label: task.title || `Task ${taskIdx}`,
                            compactLabel: `Task-${taskIdx}`,
                            order: sections.length
                        });
                    }
                }
            }

            sections.push({
                group: 'final-quiz',
                key: 'final-quiz',
                label: 'Assessment',
                compactLabel: 'Assessment',
                order: sections.length
            });
        } catch (error) {
            console.warn('NotesService: Could not build section labels:', error);
        }

        return sections;
    }

    getSectionsWithContent() {
        if (!this.contentObj) return [];

        return this.getAllSectionLabels().filter(section => {
            const content = this.getSectionContent(this.contentObj, section);
            return content && content.trim().length > 0;
        });
    }
}

window.notesService = new NotesService();
