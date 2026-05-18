class TaskUploadService {
    constructor() {
        this.topicIdPattern = /^([A-Za-z]+)-M(\d+)-T(\d+(?:\.\d+)?)$/;
        this.MAX_FILES_PER_ATTEMPT = 5;
        this.MAX_VIDEOS_PER_ATTEMPT = 1;
        this.MAX_TOTAL_SIZE_MB = 60;
        this.MAX_TOTAL_SIZE_BYTES = 60 * 1024 * 1024;
        this.MAX_NON_VIDEO_FILE_SIZE_MB = 15;
        this.MAX_NON_VIDEO_FILE_SIZE_BYTES = 15 * 1024 * 1024;
        this.MAX_VIDEO_FILE_SIZE_MB = 40;
        this.MAX_VIDEO_FILE_SIZE_BYTES = 40 * 1024 * 1024;
        this.MAX_ZIP_FILE_SIZE_MB = 25;
        this.MAX_ZIP_FILE_SIZE_BYTES = 25 * 1024 * 1024;
        this.MAX_FILENAME_LENGTH = 150;
        this.MAX_ATTEMPTS_PER_TASK = 3;
        this.ALLOWED_EXTENSIONS = {
            document: ['.pdf', '.docx', '.txt', '.md'],
            image: ['.png', '.jpg', '.jpeg', '.webp'],
            video: ['.mp4', '.mov', '.webm'],
            archive: ['.zip']
        };
        this.BLOCKED_EXTENSIONS = [
            '.exe', '.msi', '.dll', '.apk',
            '.sh', '.bat', '.cmd', '.ps1',
            '.py', '.js', '.jar',
            '.docm', '.xlsm'
        ];
        this.VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
        this.taskCache = {};
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
                if (!candidate || !candidate.location) continue;
                const href = candidate.location.href || '';
                const hash = candidate.location.hash || '';
                const combined = `${href} ${hash}`.trim();
                if (combined && !locations.includes(combined)) {
                    locations.push(combined);
                }
            } catch (error) {}
        }
        return locations;
    }

    getCourseIdFromLocation() {
        for (const locationText of this.getCandidateLocationTexts()) {
            const match = locationText.match(/\/course\/(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    parseTopicIdentity() {
        const topicId = window.templateData?.id || '';
        const match = this.topicIdPattern.exec(topicId);
        if (!match) {
            return { topicId, courseName: '', moduleNumber: '', topicNumber: '' };
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
            console.error('TaskUploadService: Error extracting courseId:', error);
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
            console.error('TaskUploadService: Error extracting moduleId:', error);
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
            console.error('TaskUploadService: Error extracting subtopicId:', error);
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

    getFileExtension(filename) {
        if (!filename) return '';
        const lastDot = filename.lastIndexOf('.');
        if (lastDot === -1) return '';
        return filename.substring(lastDot).toLowerCase();
    }

    isVideoFile(filename) {
        const ext = this.getFileExtension(filename);
        return this.VIDEO_EXTENSIONS.includes(ext);
    }

    isBlockedFile(filename) {
        const ext = this.getFileExtension(filename);
        return this.BLOCKED_EXTENSIONS.includes(ext);
    }

    isAllowedFile(filename) {
        const ext = this.getFileExtension(filename);
        if (!ext) return false;
        const allAllowed = [
            ...this.ALLOWED_EXTENSIONS.document,
            ...this.ALLOWED_EXTENSIONS.image,
            ...this.ALLOWED_EXTENSIONS.video,
            ...this.ALLOWED_EXTENSIONS.archive
        ];
        return allAllowed.includes(ext);
    }

    getFileCategory(filename) {
        const ext = this.getFileExtension(filename);
        for (const [category, extensions] of Object.entries(this.ALLOWED_EXTENSIONS)) {
            if (extensions.includes(ext)) return category;
        }
        return null;
    }

    validateFiles(files) {
        const errors = [];

        if (!files || files.length === 0) {
            errors.push('Please select at least one file to upload.');
            return errors;
        }

        if (files.length > this.MAX_FILES_PER_ATTEMPT) {
            errors.push(`Only ${this.MAX_FILES_PER_ATTEMPT} files are allowed per attempt.`);
        }

        let totalSize = 0;
        let videoCount = 0;

        for (const file of files) {
            if (file.size === 0) {
                errors.push(`File "${file.name}" is empty (0 bytes).`);
                continue;
            }

            if (file.name.length > this.MAX_FILENAME_LENGTH) {
                errors.push(`Filename "${file.name}" exceeds ${this.MAX_FILENAME_LENGTH} characters.`);
            }

            if (this.isBlockedFile(file.name)) {
                const ext = this.getFileExtension(file.name);
                errors.push(`File type ${ext} is not allowed.`);
                continue;
            }

            if (!this.isAllowedFile(file.name)) {
                const ext = this.getFileExtension(file.name);
                errors.push(`Unsupported file type: ${ext || 'unknown'}`);
                continue;
            }

            const isVideo = this.isVideoFile(file.name);
            const isZip = this.getFileExtension(file.name) === '.zip';

            if (isVideo) {
                videoCount++;
                if (file.size > this.MAX_VIDEO_FILE_SIZE_BYTES) {
                    errors.push(`Video file "${file.name}" exceeds ${this.MAX_VIDEO_FILE_SIZE_MB} MB.`);
                }
            } else if (isZip) {
                if (file.size > this.MAX_ZIP_FILE_SIZE_BYTES) {
                    errors.push(`Zip file "${file.name}" exceeds ${this.MAX_ZIP_FILE_SIZE_MB} MB.`);
                }
            } else {
                if (file.size > this.MAX_NON_VIDEO_FILE_SIZE_BYTES) {
                    errors.push(`File "${file.name}" exceeds ${this.MAX_NON_VIDEO_FILE_SIZE_MB} MB.`);
                }
            }

            totalSize += file.size;
        }

        if (videoCount > this.MAX_VIDEOS_PER_ATTEMPT) {
            errors.push(`At most ${this.MAX_VIDEOS_PER_ATTEMPT} video file is allowed per attempt.`);
        }

        if (totalSize > this.MAX_TOTAL_SIZE_BYTES) {
            errors.push(`Total upload size must not exceed ${this.MAX_TOTAL_SIZE_MB} MB.`);
        }

        return errors;
    }

    async getTask(taskId) {
        if (!this.isConfigured()) return null;

        const cacheKey = taskId;
        if (this.taskCache[cacheKey]) {
            return this.taskCache[cacheKey];
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
                `${this.getApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}?${params.toString()}`
            );

            if (response.status === 404) {
                this.taskCache[cacheKey] = null;
                return null;
            }

            if (!response.ok) {
                let message = 'Failed to fetch task details';
                try {
                    const error = await response.json();
                    message = error.detail || message;
                } catch (e) {}
                console.warn('TaskUploadService:', message);
                return null;
            }

            const envelope = await response.json();
            const taskData = envelope.data || null;
            this.taskCache[cacheKey] = taskData;
            return taskData;
        } catch (error) {
            console.warn('TaskUploadService: Failed to fetch task:', error);
            return null;
        }
    }

    async getTaskAttempts(taskId) {
        if (!this.isConfigured()) return null;

        try {
            const ctx = this.buildContext();
            const params = new URLSearchParams({
                learner_id: ctx.learner_id,
                course_id: ctx.course_id,
                module_id: ctx.module_id,
                subtopic_id: ctx.subtopic_id
            });

            const response = await fetch(
                `${this.getApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/attempts?${params.toString()}`
            );

            if (response.status === 404) return null;

            if (!response.ok) {
                let message = 'Failed to fetch task attempts';
                try {
                    const error = await response.json();
                    message = error.detail || message;
                } catch (e) {}
                console.warn('TaskUploadService:', message);
                return null;
            }

            const envelope = await response.json();
            return envelope.data || null;
        } catch (error) {
            console.warn('TaskUploadService: Failed to fetch attempts:', error);
            return null;
        }
    }

    async uploadTaskFiles(taskId, files, onProgress) {
        if (!this.isConfigured()) {
            throw new Error('Task upload API is not configured.');
        }

        const validationErrors = this.validateFiles(files);
        if (validationErrors.length > 0) {
            throw new Error(validationErrors.join(' '));
        }

        const ctx = this.buildContext();
        const formData = new FormData();

        formData.append('learner_id', ctx.learner_id);
        if (ctx.learner_name) {
            formData.append('learner_name', ctx.learner_name);
        }
        formData.append('course_id', ctx.course_id);
        formData.append('module_id', ctx.module_id);
        formData.append('subtopic_id', ctx.subtopic_id);
        formData.append('task_id', taskId);

        for (const file of files) {
            formData.append('files', file);
        }

        try {
            const xhr = new XMLHttpRequest();

            const uploadPromise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && onProgress) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(percent);
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const response = JSON.parse(xhr.responseText);

                        if (xhr.status >= 200 && xhr.status < 300) {
                            const taskData = response.data || response;
                            this.taskCache[taskId] = taskData;
                            resolve(taskData);
                        } else {
                            const message = response.detail || 'Failed to upload task files';
                            reject(new Error(message));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse upload response'));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });

                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload was cancelled'));
                });

                xhr.open('POST', `${this.getApiBaseUrl()}/api/tasks/upload`);
                xhr.send(formData);
            });

            uploadPromise._xhr = xhr;
            return await uploadPromise;
        } catch (error) {
            console.warn('TaskUploadService: Upload failed:', error);
            throw error;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
    }

    getFileIcon(category) {
        const icons = {
            document: 'fas fa-file-alt',
            image: 'fas fa-file-image',
            video: 'fas fa-file-video',
            archive: 'fas fa-file-archive'
        };
        return icons[category] || 'fas fa-file';
    }

    getFileIconColor(category) {
        const colors = {
            document: 'text-blue-500',
            image: 'text-purple-500',
            video: 'text-red-500',
            archive: 'text-yellow-500'
        };
        return colors[category] || 'text-gray-500';
    }

    clearCache(taskId) {
        if (taskId) {
            delete this.taskCache[taskId];
        } else {
            this.taskCache = {};
        }
    }

    getRemainingAttempts(taskData) {
        if (!taskData) return this.MAX_ATTEMPTS_PER_TASK;
        return Math.max(0, this.MAX_ATTEMPTS_PER_TASK - (taskData.attempt_count || 0));
    }
}

window.taskUploadService = new TaskUploadService();
