/**
 * SubConceptRenderer - Handles rendering of sub-concept pages with learning modes, voice widgets, and quizzes
 * Extracted from page-renderer.js to improve separation of concerns and maintainability
 */

class SubConceptRenderer {
    constructor() {
        this.initialized = false;
        this.activeVoiceWidgets = new Map();
        this.activeAudioPlayers = new Map();
        this.learningContentSlides = new Map();
        this.resizeRepaginateTimeout = null;

        // Store audio states to preserve playback position across mode switches
        // Key: subConceptId, Value: { currentTime, volume, playbackRate, muted, wasPlaying }
        this.savedAudioStates = new Map();

        // Dependencies to be injected
        this.voiceWidgetManager = null;
        this.markdownRenderer = null;
        this.paginationSystem = null;

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        if (this.initialized) return;

        // Setup dependencies
        this.setupDependencies();

        // Setup global event listeners
        this.setupGlobalEventListeners();

        this.initialized = true;
        console.log('Sub-concept renderer initialized');

        // Make this available globally
        window.subConceptRenderer = this;
    }

    setupDependencies() {
        // Voice Widget Manager dependency
        if (window.voiceWidgetManager) {
            this.voiceWidgetManager = window.voiceWidgetManager;
        } else {
            console.warn('VoiceWidgetManager not available');
        }

        // Markdown Renderer dependency
        if (window.markdownRenderer) {
            this.markdownRenderer = window.markdownRenderer;
        } else {
            console.warn('MarkdownRenderer not available');
        }

        // Pagination System dependency
        if (window.paginationSystem) {
            this.paginationSystem = window.paginationSystem;
        } else {
            console.warn('PaginationSystem not available');
        }
    }

    setupGlobalEventListeners() {
        // Listen for retry voice widget events
        document.addEventListener('retryVoiceWidget', (event) => {
            const { subConceptId } = event.detail;
            this.retryVoiceWidget(subConceptId);
        });

        // Listen for page changes to cleanup voice widgets
        document.addEventListener('pageChanged', (event) => {
            console.log('SubConceptRenderer: Page changed, cleaning up voice widgets');
            this.cleanupVoiceWidgets();
        });

        // Also listen for navigation events to ensure cleanup
        document.addEventListener('paginationProgress', () => {
            console.log('SubConceptRenderer: Pagination progress, cleaning up voice widgets');
            this.cleanupVoiceWidgets();
        });

        // Listen for audio playback completion to trigger voice assistant
        document.addEventListener('audioPlaybackCompleted', (event) => {
            this.handleAudioPlaybackCompleted(event);
        });

        // Listen for skip and solve doubt events
        document.addEventListener('skipAndSolveDoubt', (event) => {
            this.handleSkipAndSolveDoubt(event);
        });

        // Listen for back to audio events from voice bot
        document.addEventListener('backToAudio', (event) => {
            this.handleBackToAudio(event);
        });

        window.addEventListener('resize', () => {
            clearTimeout(this.resizeRepaginateTimeout);
            this.resizeRepaginateTimeout = setTimeout(() => {
                this.repaginateCurrentSubConcept();
            }, 180);
        });
    }

    /**
     * Escape HTML characters to prevent XSS and content leakage
     * For data attributes, we need proper escaping
     */
    _escapeHtml(text) {
        if (!text) return '';
        // Escape HTML entities for data attributes
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, ' ')  // Replace newlines with spaces
            .replace(/\r/g, '')   // Remove carriage returns
            .trim();
    }

    _escapeForScriptTag(text) {
        return JSON.stringify(text || '')
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
    }

    /**
     * Main rendering method for sub-concept pages
     * Extracted from page-renderer.js renderSubConceptPage method
     */
    renderSubConceptPage(page) {
        const { concept, subConcept, isLastSubConcept, hasQuiz } = page.data;
        const currentPageIndex = page.index;
        const totalPages = this.paginationSystem?.totalPages || 1;

        // Get concept and sub-concept indices for numbering
        const conceptIndex = this.getConceptIndex(concept.id);
        const subConceptIndex = this.getSubConceptIndex(concept.id, subConcept.id);

        // Check if this is a single sub-concept with the same title
        const isSingleSubConcept = concept.sub_concepts &&
            concept.sub_concepts.length === 1 &&
            concept.sub_concepts[0].id === subConcept.id &&
            concept.sub_concepts[0].title.trim() === concept.title.trim();

        return `
            <div class="concept-page page-content sub-concept-content"
                 data-page-type="sub-concept"
                 data-concept-id="${concept.id}"
                 data-sub-concept-id="${subConcept.id}">

                <!-- Compact Breadcrumb Header -->
                <div class="sub-concept-breadcrumb">
                    <span class="breadcrumb-concept">${conceptIndex + 1}. ${concept.title}</span>
                    ${isSingleSubConcept ? '' : `
                        <i class="fas fa-chevron-right breadcrumb-separator"></i>
                        <span class="breadcrumb-subconcept">${subConcept.title}</span>
                    `}
                </div>

                <!-- Sub-concept Image/Video Container at top -->
                <div id="media-container-${subConcept.id}">
                    <!-- Image shown by default -->
                    <div id="image-container-${subConcept.id}">
                        ${this.renderSubConceptImage(subConcept)}
                    </div>
                    <!-- Video container (hidden by default) -->
                    <div id="video-container-${subConcept.id}" class="hidden">
                        ${this.renderSubConceptVideo(subConcept)}
                    </div>
                </div>

                <!-- Learning Mode Toggle -->
                ${this.renderLearningModeToggle(subConcept)}

                <!-- Learning Content Section -->
                <div id="read-lesson-content-${subConcept.id}" class="lesson-content">
                    ${this.renderLearningContentSection(subConcept)}
                </div>

                <!-- Voice Assistant Section -->
                <div id="listen-audio-content-${subConcept.id}" class="lesson-content hidden">
                    ${this.renderVoiceAssistantSection(subConcept)}
                </div>

                <!-- Video Learning Content Section (combines video player info with chat tutor) -->
                <div id="watch-video-content-${subConcept.id}" class="lesson-content hidden">
                    ${this.renderVideoLearningSection(subConcept)}
                </div>

                ${hasQuiz ? this.renderEmbeddedQuiz(concept.quiz, concept.id) : ''}

                <!-- Page Navigation -->
                ${this.renderPageNavigation(currentPageIndex, totalPages, isLastSubConcept, hasQuiz)}
            </div>
        `;
    }

    /**
     * Render sub-concept image if present
     */
    renderSubConceptImage(subConcept) {
        if (!subConcept.image) return '';

        return `
            <div class="concept-image">
                <img src="${subConcept.image}"
                     alt="${subConcept.title}"
                     class="sub-concept-image"
                     loading="lazy">
                ${subConcept.image_caption ? `
                    <p class="text-gray-600 text-sm text-center mt-2">${subConcept.image_caption}</p>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render sub-concept video player if present
     */
    renderSubConceptVideo(subConcept) {
        if (!subConcept.video || !subConcept.video.src) return '';

        const video = subConcept.video;
        const isLocal = video.type !== 'embed';
        const isEmbed = video.type === 'embed';

        if (isEmbed) {
            // Handle embed videos (YouTube, Vimeo, etc.)
            return `
                <div class="concept-video">
                    <div class="video-embed-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px;">
                        <iframe 
                            src="${video.src}"
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    </div>
                    ${video.caption ? `
                        <p class="text-gray-600 text-sm text-center mt-3">${video.caption}</p>
                    ` : ''}
                </div>
            `;
        }

        // Handle local videos
        return `
            <div class="concept-video">
                <video 
                    id="video-player-${subConcept.id}"
                    class="w-full rounded-xl shadow-lg"
                    controls
                    preload="metadata">
                    <source src="${video.src}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                ${video.caption ? `
                    <p class="text-gray-600 text-sm text-center mt-3">${video.caption}</p>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render video learning section content (shown below video when video mode is active)
     * Layout: Voice Widget on top + AI Chat Tutor card below (centered)
     */
    renderVideoLearningSection(subConcept) {
        if (!subConcept.video || !subConcept.video.src) return '';

        return `
            <!-- Voice Bot Container for Video Mode (Direct, no outer wrapper) -->
            <div id="voice-bot-video-container-${subConcept.id}" class="voice-bot-container-full mb-6 mt-4">
                <!-- Voice Activation Screen -->
                <div class="voice-activation-screen-video text-center py-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100" id="voice-activation-video-${subConcept.id}">
                    <div class="voice-activation-icon mb-4">
                        <div class="relative inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full shadow-lg">
                            <i class="fas fa-microphone text-white text-2xl"></i>
                        </div>
                    </div>
                    <h5 class="text-lg font-semibold text-gray-800 mb-2">AI Voice Assistant</h5>
                    <p class="text-gray-600 mb-4 max-w-md mx-auto text-sm">
                        Ask questions using your voice for an interactive learning experience
                    </p>
                    <button
                        onclick="window.subConceptRenderer.startVoiceAssistantForVideo('${subConcept.id}')"
                        class="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow-md hover:shadow-lg">
                        <i class="fas fa-play mr-2"></i>
                        Start Voice Assistant
                    </button>
                </div>
            </div>

            <!-- AI Chat Tutor Card (Centered below voice widget) -->
            <div class="flex justify-center">
                <div class="bg-gradient-to-br from-nebula-50 to-teal-50 rounded-2xl p-5 border border-nebula-100 max-w-md w-full">
                    <div class="flex items-center justify-center gap-3 mb-3">                      
                        <h4 class="text-base font-semibold text-gray-900">AI Chat Tutor</h4>
                    </div>
                    <p class="text-sm text-gray-600 mb-4 text-center">
                        Prefer typing? Chat with your AI tutor for instant help.
                    </p>
                    <button
                        data-bot-context="${this._escapeHtml(subConcept.bot_context || '')}"
                        data-bot-context-raw="${encodeURIComponent(subConcept.bot_context || '')}"
                        data-concept-id="${subConcept.id}"
                        class="chat-tutor-btn w-full bg-gradient-to-r from-nebula-500 to-teal-500 text-white px-6 py-2.5 rounded-xl font-medium hover:from-nebula-600 hover:to-teal-600 transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                        <i class="fas fa-comments"></i>
                        <span>Start AI Chat</span>
                    </button>
                </div>
            </div>
        `;
    }


    /**
     * Render learning mode toggle buttons
     * Using data attributes for event handling instead of onclick
     * Includes Watch Video button if video is available
     */
    renderLearningModeToggle(subConcept) {
        const hasVideo = subConcept.video && subConcept.video.src;
        const hasAudio = subConcept.audio && subConcept.audio.length > 0;

        return `
        <div class="learning-mode-toggle">
            <div class="flex items-center justify-center">
                <div class="inline-flex bg-slate-100 rounded-full p-0.5 shadow-inner">
                    <button
                        id="read-lesson-btn-${subConcept.id}"
                        data-sub-concept-id="${subConcept.id}"
                        data-mode="read"
                        class="mode-btn learning-mode-toggle px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 bg-white text-slate-800 shadow-sm ring-1 ring-slate-200">
                        <i class="fas fa-book-open mr-1.5 text-teal-500"></i>
                        Read
                    </button>
                    ${hasAudio ? `
                    <button
                        id="listen-audio-btn-${subConcept.id}"
                        data-sub-concept-id="${subConcept.id}"
                        data-mode="listen"
                        class="mode-btn learning-mode-toggle px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 text-slate-500 hover:text-slate-700">
                        <i class="fas fa-headphones mr-1.5"></i>
                        Listen
                    </button>
                    ` : ''}
                    ${hasVideo ? `
                    <button
                        id="watch-video-btn-${subConcept.id}"
                        data-sub-concept-id="${subConcept.id}"
                        data-mode="video"
                        class="mode-btn learning-mode-toggle px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 text-slate-500 hover:text-slate-700">
                        <i class="fas fa-play-circle mr-1.5"></i>
                        Watch
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    }


    /**
     * Render learning content section with markdown content and chat tutor
     */
    renderLearningContentSection(subConcept) {
        const renderedContent = this.renderLearningContent(subConcept.learning_content);

        return `
            <!-- Learning content -->
            <div class="learning-content mb-8">
                <script type="application/json" id="learning-content-source-${subConcept.id}">${this._escapeForScriptTag(subConcept.learning_content || '')}</script>

                <div
                    id="learning-content-pagination-${subConcept.id}"
                    class="learning-content-pagination"
                    data-sub-concept-id="${subConcept.id}">

                    <div
                        id="learning-content-frame-${subConcept.id}"
                        class="learning-content-frame prose prose-lg max-w-none">
                        <div
                            id="learning-content-stage-${subConcept.id}"
                            class="learning-content-stage"
                            aria-live="polite">
                            ${renderedContent}
                        </div>
                    </div>

                    <div
                        id="learning-content-controls-${subConcept.id}"
                        class="learning-content-controls hidden"
                        aria-label="Lesson section navigation">
                        <button
                            type="button"
                            id="learning-content-prev-${subConcept.id}"
                            class="learning-content-control-btn"
                            data-slide-direction="previous"
                            data-sub-concept-id="${subConcept.id}"
                            aria-label="Previous lesson section">
                            <i class="fas fa-arrow-left"></i>
                        </button>

                        <div class="learning-content-progress">
                            <div id="learning-content-counter-${subConcept.id}" class="learning-content-counter">1 / 1</div>
                            <div id="learning-content-dots-${subConcept.id}" class="learning-content-dots" aria-hidden="true"></div>
                        </div>

                        <button
                            type="button"
                            id="learning-content-next-${subConcept.id}"
                            class="learning-content-control-btn"
                            data-slide-direction="next"
                            data-sub-concept-id="${subConcept.id}"
                            aria-label="Next lesson section">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- AI Learning Assistant -->
            <div class="mb-8">
                <div class="group relative">
                    <!-- Subtle gradient background -->
                    <div class="absolute inset-0 bg-gradient-to-br from-nebula-50 via-teal-50 to-nebula-purple-50 rounded-3xl opacity-70"></div>

                    <!-- Main card container -->
                    <div class="relative bg-white/90 backdrop-blur-sm rounded-3xl p-8 border border-nebula-100 max-w-md mx-auto shadow-soft group-hover:shadow-medium transition-all duration-300 overflow-hidden">
                        <!-- Decorative accent line -->
                        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-nebula-500 to-nebula-purple-500"></div>

                        <div class="text-center">
                            <!-- Icon with subtle animation -->
                            <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-nebula-100 to-nebula-purple-100 rounded-2xl mb-4 group-hover:scale-105 transition-transform duration-300">
                                <i class="fas fa-graduation-cap text-2xl text-nebula-600"></i>
                            </div>

                            <!-- Enhanced title with better typography -->
                            <h4 class="text-xl font-bold text-gray-900 mb-3">Still Have Questions?</h4>

                            <!-- Improved subtitle with better spacing -->
                            <p class="text-base text-gray-600 mb-8 leading-relaxed max-w-sm mx-auto">
                                Connect with your AI tutor for instant help on this topic
                            </p>

                            <!-- Enhanced button with better design -->
                            <button
                                data-bot-context="${this._escapeHtml(subConcept.bot_context || '')}"
                                data-bot-context-raw="${encodeURIComponent(subConcept.bot_context || '')}"
                                data-concept-id="${subConcept.id}"
                                class="chat-tutor-btn relative bg-gradient-to-r from-nebula-500 to-nebula-purple-500 text-white px-8 py-3.5 rounded-xl font-semibold hover:from-nebula-600 hover:to-nebula-purple-600 transition-all duration-300 shadow-medium hover:shadow-strong flex items-center justify-center gap-3 mx-auto group/btn overflow-hidden">

                                <!-- Button shimmer effect -->
                                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>

                                <!-- Button content -->
                                <i class="fas fa-comments text-lg"></i>
                                <span>Start AI Tutoring</span>

                                <!-- Arrow indicator -->
                                <i class="fas fa-arrow-right text-sm opacity-70 group-hover/btn:translate-x-1 transition-transform duration-200"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeLearningContentPagination(subConcept) {
        const container = document.getElementById(`learning-content-pagination-${subConcept.id}`);
        const stage = document.getElementById(`learning-content-stage-${subConcept.id}`);
        const source = document.getElementById(`learning-content-source-${subConcept.id}`);
        const frame = document.getElementById(`learning-content-frame-${subConcept.id}`);

        if (!container || !stage || !source || !frame) return;

        const rawContent = this.getLearningContentSource(source);
        const renderedSource = this.createRenderedLearningContentTemplate(rawContent);
        const heightConfig = this.getLearningContentHeightConfig(frame);
        const slides = this.buildLearningContentSlides(renderedSource, frame, heightConfig);
        const currentIndex = Math.min(
            this.getStoredReadSlideIndex(subConcept.id),
            Math.max(slides.length - 1, 0)
        );

        this.setStoredReadSlideIndex(subConcept.id, currentIndex);

        this.learningContentSlides.set(subConcept.id, {
            slides,
            currentIndex
        });

        this.renderLearningSlide(subConcept.id);
        this.setupLearningContentControls(subConcept.id);
    }

    getLearningContentSource(sourceElement) {
        try {
            return JSON.parse(sourceElement.textContent || '""');
        } catch (error) {
            console.warn('Failed to read learning content source:', error);
            return '';
        }
    }

    createRenderedLearningContentTemplate(rawContent) {
        const template = document.createElement('template');
        template.innerHTML = this.renderLearningContent(rawContent);
        return template;
    }

    buildLearningContentSlides(source, frame, heightConfig = this.getLearningContentHeightConfig(frame)) {
        const sourceNodes = this.getRenderableTopLevelNodes(source);
        if (sourceNodes.length === 0) {
            return [{ html: '<p class="text-gray-500">No content available.</p>', allowOverflowScroll: false }];
        }

        const displayHeight = heightConfig.displayHeight;
        frame.style.setProperty('--learning-content-slide-height', `${displayHeight}px`);

        const safetyBuffers = [heightConfig.measureBuffer, 48, 72, 96];
        let slides = [];

        for (const safetyBuffer of safetyBuffers) {
            const measurementRoot = this.createLearningContentMeasurementRoot(frame, displayHeight, safetyBuffer);
            slides = this.paginateLearningContentNodes(sourceNodes, measurementRoot, heightConfig.measureHeight - safetyBuffer);

            const hasOverflow = this.hasUnexpectedSlideOverflow(slides, measurementRoot, displayHeight);
            const sandbox = measurementRoot.parentNode;
            if (sandbox) {
                sandbox.remove();
            }

            if (!hasOverflow) {
                break;
            }
        }

        const resolvedFrameHeight = this.resolveLearningContentFrameHeight(slides, frame, heightConfig);
        frame.style.setProperty('--learning-content-slide-height', `${resolvedFrameHeight}px`);

        return slides.length > 0 ? slides : [{ html: source.innerHTML, allowOverflowScroll: false }];
    }

    paginateLearningContentNodes(sourceNodes, measurementRoot, maxHeight) {
        const slides = [];
        let currentNodes = [];

        const commitSlide = (nodes, allowOverflowScroll = false) => {
            if (!nodes || nodes.length === 0) return;
            slides.push({
                html: this.serializeNodes(nodes),
                allowOverflowScroll
            });
        };

        sourceNodes.forEach((node) => {
            const candidateNodes = currentNodes.concat(node.cloneNode(true));
            this.setMeasurementContent(measurementRoot, candidateNodes, false);

            if (measurementRoot.scrollHeight <= maxHeight) {
                currentNodes = candidateNodes;
                return;
            }

            if (currentNodes.length > 0) {
                if (currentNodes.length > 1 && this.isHeadingNode(currentNodes[currentNodes.length - 1])) {
                    const detachedHeading = currentNodes.pop();
                    commitSlide(currentNodes, false);
                    currentNodes = [detachedHeading, node.cloneNode(true)];
                } else {
                    commitSlide(currentNodes, false);
                    currentNodes = [node.cloneNode(true)];
                }

                this.setMeasurementContent(measurementRoot, currentNodes, false);
                if (measurementRoot.scrollHeight <= maxHeight) {
                    return;
                }

                if (currentNodes.length > 1 && this.isHeadingNode(currentNodes[0])) {
                    commitSlide([currentNodes[0]], false);
                    currentNodes = [];
                }
            }

            const splitSlides = this.splitOversizedNode(node, maxHeight, measurementRoot);
            splitSlides.forEach((slide) => slides.push(slide));
            currentNodes = [];
        });

        commitSlide(currentNodes, false);
        return slides;
    }

    getRenderableTopLevelNodes(source) {
        const templateContent = source.content ? Array.from(source.content.childNodes) : [];
        const nodes = [];

        templateContent.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (!text) return;

                const paragraph = document.createElement('p');
                paragraph.textContent = text;
                nodes.push(paragraph);
                return;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                nodes.push(node.cloneNode(true));
            }
        });

        return nodes;
    }

    getLearningContentHeightConfig(frame) {
        const viewportHeight = window.innerHeight || 900;
        const minHeight = 760;
        const maxHeight = 1120;
        const preferredHeight = viewportHeight * 0.86;
        const displayHeight = Math.round(Math.max(minHeight, Math.min(maxHeight, preferredHeight)));

        return {
            displayHeight,
            measureHeight: displayHeight,
            measureBuffer: 8,
            minHeight,
            maxHeight
        };
    }

    resolveLearningContentFrameHeight(slides, frame, heightConfig) {
        if (!slides || slides.length === 0) {
            return heightConfig.displayHeight;
        }

        const measurementRoot = this.createLearningContentMeasurementRoot(frame, heightConfig.maxHeight, 0);
        let tallestSlideHeight = heightConfig.displayHeight;

        slides.forEach((slide) => {
            if (slide.allowOverflowScroll) {
                return;
            }

            measurementRoot.className = 'learning-content-stage learning-content-slide prose prose-lg max-w-none';
            measurementRoot.style.height = 'auto';
            measurementRoot.innerHTML = slide.html;
            tallestSlideHeight = Math.max(tallestSlideHeight, measurementRoot.scrollHeight + 12);
        });

        const sandbox = measurementRoot.parentNode;
        if (sandbox) {
            sandbox.remove();
        }

        return Math.round(Math.max(heightConfig.minHeight, Math.min(heightConfig.maxHeight, tallestSlideHeight)));
    }

    shouldUseCompactSlideFrame(slide, slideIndex, totalSlides, frame) {
        if (!slide || slide.allowOverflowScroll) {
            return false;
        }

        const isLastSlide = slideIndex === totalSlides - 1;
        if (!isLastSlide) {
            return false;
        }

        const naturalHeight = this.measureLearningSlideNaturalHeight(slide.html, frame);
        const frameHeight = parseFloat(getComputedStyle(frame).getPropertyValue('--learning-content-slide-height')) || frame.getBoundingClientRect().height || 0;
        return naturalHeight > 0 && frameHeight > 0 && naturalHeight < frameHeight * 0.72;
    }

    measureLearningSlideNaturalHeight(slideHtml, frame) {
        const measurementRoot = this.createLearningContentMeasurementRoot(frame, 320, 0);
        measurementRoot.className = 'learning-content-stage learning-content-slide prose prose-lg max-w-none';
        measurementRoot.style.height = 'auto';
        measurementRoot.style.minHeight = '0';
        measurementRoot.innerHTML = slideHtml;

        const naturalHeight = measurementRoot.scrollHeight;
        const sandbox = measurementRoot.parentNode;
        if (sandbox) {
            sandbox.remove();
        }

        return naturalHeight;
    }

    createLearningContentMeasurementRoot(frame, displayHeight, safetyBuffer = 24) {
        const sandbox = document.createElement('div');
        sandbox.className = 'learning-content-measurement-sandbox';

        const width = Math.max(frame.clientWidth || frame.getBoundingClientRect().width || 640, 320);
        sandbox.style.width = `${width}px`;

        const measurementRoot = document.createElement('div');
        measurementRoot.className = 'learning-content-stage learning-content-slide prose prose-lg max-w-none';
        measurementRoot.style.height = `${Math.max(displayHeight - safetyBuffer, 240)}px`;
        sandbox.appendChild(measurementRoot);

        document.body.appendChild(sandbox);
        return measurementRoot;
    }

    setMeasurementContent(measurementRoot, nodes, allowOverflowScroll) {
        measurementRoot.className = `learning-content-stage learning-content-slide prose prose-lg max-w-none${allowOverflowScroll ? ' is-overflowing' : ''}`;
        measurementRoot.innerHTML = '';
        nodes.forEach((node) => {
            measurementRoot.appendChild(node.cloneNode(true));
        });
    }

    hasUnexpectedSlideOverflow(slides, measurementRoot, displayHeight) {
        measurementRoot.style.height = `${displayHeight}px`;

        return slides.some((slide) => {
            if (slide.allowOverflowScroll) {
                return false;
            }

            measurementRoot.className = 'learning-content-stage learning-content-slide prose prose-lg max-w-none';
            measurementRoot.innerHTML = slide.html;
            return measurementRoot.scrollHeight > measurementRoot.clientHeight + 2;
        });
    }

    splitOversizedNode(node, maxHeight, measurementRoot) {
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';

        if (tagName === 'ul' || tagName === 'ol') {
            return this.splitListNode(node, tagName, maxHeight, measurementRoot);
        }

        return [{
            html: node.outerHTML || this.serializeNodes([node]),
            allowOverflowScroll: true
        }];
    }

    splitListNode(listNode, tagName, maxHeight, measurementRoot) {
        const items = Array.from(listNode.children || []).filter((child) => child.tagName && child.tagName.toLowerCase() === 'li');
        if (items.length === 0) {
            return [{ html: listNode.outerHTML, allowOverflowScroll: true }];
        }

        const slides = [];
        let currentItems = [];
        let consumedItems = 0;

        const buildList = (listItems) => {
            const clonedList = listNode.cloneNode(false);
            listItems.forEach((item) => clonedList.appendChild(item.cloneNode(true)));
            if (tagName === 'ol' && consumedItems > 0 && !clonedList.hasAttribute('start')) {
                clonedList.setAttribute('start', String(consumedItems + 1));
            }
            return clonedList;
        };

        const commitListSlide = (listItems, allowOverflowScroll = false) => {
            if (listItems.length === 0) return;
            const renderedList = buildList(listItems);
            slides.push({
                html: renderedList.outerHTML,
                allowOverflowScroll
            });
            consumedItems += listItems.length;
        };

        items.forEach((item) => {
            const candidateItems = currentItems.concat(item.cloneNode(true));
            const candidateList = buildList(candidateItems);
            this.setMeasurementContent(measurementRoot, [candidateList], false);

            if (measurementRoot.scrollHeight <= maxHeight) {
                currentItems = candidateItems;
                return;
            }

            if (currentItems.length > 0) {
                commitListSlide(currentItems, false);
                currentItems = [item.cloneNode(true)];
                const singleItemList = buildList(currentItems);
                this.setMeasurementContent(measurementRoot, [singleItemList], false);
                if (measurementRoot.scrollHeight <= maxHeight) {
                    return;
                }
            }

            commitListSlide([item.cloneNode(true)], true);
            currentItems = [];
        });

        commitListSlide(currentItems, false);
        return slides;
    }

    setupLearningContentControls(subConceptId) {
        const prevButton = document.getElementById(`learning-content-prev-${subConceptId}`);
        const nextButton = document.getElementById(`learning-content-next-${subConceptId}`);

        if (prevButton && !prevButton.dataset.bound) {
            prevButton.dataset.bound = 'true';
            prevButton.addEventListener('click', () => {
                this.changeLearningSlide(subConceptId, -1);
            });
        }

        if (nextButton && !nextButton.dataset.bound) {
            nextButton.dataset.bound = 'true';
            nextButton.addEventListener('click', () => {
                this.changeLearningSlide(subConceptId, 1);
            });
        }
    }

    changeLearningSlide(subConceptId, direction) {
        const state = this.learningContentSlides.get(subConceptId);
        if (!state || state.slides.length <= 1) return;

        const nextIndex = Math.max(0, Math.min(state.currentIndex + direction, state.slides.length - 1));
        if (nextIndex === state.currentIndex) return;

        state.currentIndex = nextIndex;
        this.learningContentSlides.set(subConceptId, state);
        this.setStoredReadSlideIndex(subConceptId, nextIndex);
        this.scrollToLearningContentTop(subConceptId);
        this.renderLearningSlide(subConceptId, true);
    }

    scrollToLearningContentTop(subConceptId) {
        const frame = document.getElementById(`learning-content-frame-${subConceptId}`);
        if (!frame) return;

        const pageContainer = document.getElementById('page-container');
        if (pageContainer) {
            const containerRect = pageContainer.getBoundingClientRect();
            const frameRect = frame.getBoundingClientRect();
            const targetTop = pageContainer.scrollTop + (frameRect.top - containerRect.top) - 20;

            pageContainer.scrollTo({
                top: Math.max(0, targetTop),
                behavior: 'smooth'
            });
            return;
        }

        frame.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    renderLearningSlide(subConceptId, shouldAnnounce = false) {
        const state = this.learningContentSlides.get(subConceptId);
        const stage = document.getElementById(`learning-content-stage-${subConceptId}`);
        const frame = document.getElementById(`learning-content-frame-${subConceptId}`);
        const controls = document.getElementById(`learning-content-controls-${subConceptId}`);
        const counter = document.getElementById(`learning-content-counter-${subConceptId}`);
        const dots = document.getElementById(`learning-content-dots-${subConceptId}`);
        const prevButton = document.getElementById(`learning-content-prev-${subConceptId}`);
        const nextButton = document.getElementById(`learning-content-next-${subConceptId}`);

        if (!state || !stage || !frame) return;

        const totalSlides = state.slides.length;
        const activeSlide = state.slides[state.currentIndex] || state.slides[0];
        const useCompactSlideFrame = this.shouldUseCompactSlideFrame(activeSlide, state.currentIndex, totalSlides, frame);

        const applySlideContent = () => {
            stage.className = `learning-content-slide${activeSlide.allowOverflowScroll ? ' is-overflowing' : ''}`;
            stage.innerHTML = activeSlide.html;
            stage.scrollTop = 0;
            frame.style.height = 'auto';

            requestAnimationFrame(() => {
                stage.classList.remove('is-transitioning');
            });
        };

        if (shouldAnnounce && totalSlides > 1) {
            stage.classList.add('is-transitioning');
            window.setTimeout(applySlideContent, 90);
        } else {
            applySlideContent();
        }

        frame.classList.toggle('is-paginated', totalSlides > 1);
        frame.classList.toggle('is-single-slide', totalSlides <= 1);
        frame.classList.toggle('is-compact-slide', useCompactSlideFrame);

        if (totalSlides > 1) {
            controls?.classList.remove('hidden');
        } else {
            controls?.classList.add('hidden');
        }

        if (counter) {
            counter.textContent = `${state.currentIndex + 1} / ${totalSlides}`;
        }

        if (dots) {
            dots.innerHTML = this.buildLearningSlideDots(totalSlides, state.currentIndex);
        }

        if (prevButton) {
            prevButton.disabled = state.currentIndex === 0;
        }

        if (nextButton) {
            nextButton.disabled = state.currentIndex === totalSlides - 1;
        }

        if (shouldAnnounce) {
            this.announceToScreenReader(`Showing lesson section ${state.currentIndex + 1} of ${totalSlides}`);
        }
    }

    buildLearningSlideDots(totalSlides, currentIndex) {
        if (totalSlides <= 1) return '';

        const maxDots = 7;
        if (totalSlides <= maxDots) {
            return Array.from({ length: totalSlides }, (_, index) => `
                <span class="learning-content-dot${index === currentIndex ? ' is-active' : ''}"></span>
            `).join('');
        }

        const visibleIndexes = new Set([0, currentIndex - 1, currentIndex, currentIndex + 1, totalSlides - 1]);
        const normalizedIndexes = Array.from(visibleIndexes)
            .filter((index) => index >= 0 && index < totalSlides)
            .sort((a, b) => a - b);

        let markup = '';
        normalizedIndexes.forEach((index, position) => {
            if (position > 0 && index - normalizedIndexes[position - 1] > 1) {
                markup += '<span class="learning-content-dot-gap"></span>';
            }

            markup += `<span class="learning-content-dot${index === currentIndex ? ' is-active' : ''}"></span>`;
        });

        return markup;
    }

    repaginateCurrentSubConcept() {
        const currentPage = window.pageRenderer?.getCurrentPage ? window.pageRenderer.getCurrentPage() : window.pageRenderer?.currentPage;
        if (!currentPage || currentPage.type !== 'sub-concept' || !currentPage.data?.subConcept) {
            return;
        }

        this.initializeLearningContentPagination(currentPage.data.subConcept);
    }

    getStoredReadSlideIndex(subConceptId) {
        return window.learningPathState?.readSlideState?.[subConceptId] || 0;
    }

    setStoredReadSlideIndex(subConceptId, slideIndex) {
        if (!window.learningPathState) return;

        if (!window.learningPathState.readSlideState) {
            window.learningPathState.readSlideState = {};
        }

        if (window.learningPathState.readSlideState[subConceptId] === slideIndex) {
            return;
        }

        window.learningPathState.readSlideState[subConceptId] = slideIndex;
        if (typeof window.saveLearningPathState === 'function') {
            window.saveLearningPathState();
        }
    }

    isHeadingNode(node) {
        if (!node || !node.tagName) return false;
        return /^H[1-6]$/.test(node.tagName.toUpperCase());
    }

    serializeNodes(nodes) {
        const wrapper = document.createElement('div');
        nodes.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
        return wrapper.innerHTML;
    }

    /**
     * Render voice assistant section
     */
    renderVoiceAssistantSection(subConcept) {
        const hasAudio = subConcept.audio && subConcept.audio.length > 0;

        return `
            <!-- Voice Assistant with full width - mt-8 applied here for consistent spacing -->
            <div class="voice-widget-container-full mt-8">
                ${hasAudio ? this.renderPrerecordedAudioSection(subConcept) : ''}
                <div id="voice-bot-container-${subConcept.id}" class="voice-bot-container-full" style="${hasAudio ? 'display: none;' : ''}">
                    ${hasAudio ? `
                        <!-- Audio playback waiting screen - shown initially -->
                        <div class="voice-waiting-screen text-center py-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200" id="voice-waiting-${subConcept.id}">
                            <div class="voice-waiting-icon mb-6">
                                <div class="relative inline-flex items-center justify-center w-20 h-20 bg-purple-500 rounded-full animate-pulse">
                                    <i class="fas fa-headphones text-white text-3xl"></i>
                                </div>
                            </div>
                            <h4 class="text-xl font-semibold text-gray-900 mb-3">Audio Lesson in Progress</h4>
                            <p class="text-gray-600 mb-6 max-w-md mx-auto">
                                Please complete the audio lesson above. The voice assistant will be available automatically when the audio finishes playing.
                            </p>
                            <div class="bg-purple-100 rounded-lg p-4 max-w-sm mx-auto">
                                <p class="text-sm text-purple-700">
                                    <i class="fas fa-info-circle mr-2"></i>
                                    The voice assistant will activate automatically after the audio lesson completes
                                </p>
                            </div>
                        </div>
                    ` : `
                        <!-- Voice Activation Screen - shown when no audio -->
                        <div class="voice-activation-screen text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border-2 border-blue-200">
                            <div class="voice-activation-icon mb-6">
                                <div class="relative inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-full animate-pulse">
                                    <i class="fas fa-microphone text-white text-3xl"></i>
                                </div>
                            </div>
                            <h4 class="text-xl font-semibold text-gray-900 mb-3">Interact with Live Voice Assistant</h4>
                            <p class="text-gray-600 mb-6 max-w-md mx-auto">
                                Get instant answers to your questions through voice or text chat. Click below to start your interactive learning session.
                            </p>
                            <button
                                onclick="window.subConceptRenderer.startVoiceAssistant('${subConcept.id}')"
                                class="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                                <i class="fas fa-play mr-2"></i>
                                Start Voice Assistant
                            </button>
                            <div class="mt-4 text-sm text-gray-500">
                                <i class="fas fa-info-circle mr-1"></i>
                                Voice assistant will use your microphone for interactive conversations
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Render prerecorded audio section
     */
    renderPrerecordedAudioSection(subConcept) {
        return `
            <!-- Prerecorded Audio Player with Transcript - Side by Side -->
            <div class="prerecorded-audio-section">
                <!-- Audio Player and Transcript Container -->
                <div class="flex flex-col lg:flex-row gap-2 items-start">
                    <!-- Audio Player Container - flex-1 but will shrink when transcript is shown -->
                    <div id="audio-player-container-${subConcept.id}" class="audio-player-wrapper flex-1 w-full lg:w-auto min-w-0">
                        <!-- PrerecordedAudioPlayer will be rendered here -->
                        <div class="audio-placeholder">
                            <div class="flex items-center justify-center py-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                                <div class="text-center">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-4 border-purple-500 mb-4 mx-auto"></div>
                                    <p class="text-gray-600">Loading audio player...</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Transcript Container - wider width for better readability -->
                    <div id="transcript-container-${subConcept.id}" class="transcript-placeholder w-full lg:w-[28rem] lg:max-w-[32rem] flex-shrink-0" style="height: 0; overflow: hidden;">
                        <!-- TranscriptManager will be rendered here -->
                        <div class="flex items-center justify-center py-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                            <div class="text-center">
                                <i class="fas fa-file-alt text-4xl text-gray-400 mb-3"></i>
                                <p class="text-gray-600">Transcript will appear here</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                // Initialize audio player and transcript when DOM is ready
                document.addEventListener('DOMContentLoaded', () => {
                    if (window.PrerecordedAudioPlayer && window.TranscriptManager) {
                        this.initializeAudioPlayerForSubConcept('${subConcept.id}');
                    }
                });
            </script>
        `;
    }

    /**
     * Render page navigation controls
     */
    renderPageNavigation(currentPageIndex, totalPages, isLastSubConcept, hasQuiz) {
        return `
            <div class="page-navigation mt-12 pt-8 border-t border-gray-200">
                <div class="flex justify-between items-center">
                    <!-- Previous Button -->
                    ${currentPageIndex > 0 ? `
                        <button class="page-nav-btn nav-prev flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 hover:bg-gray-50 rounded-lg" data-direction="previous">
                            <i class="fas fa-chevron-left mr-2"></i>
                            Previous
                        </button>
                    ` : '<div></div>'}

                    <!-- Next Button (conditional state) -->
                    ${!isLastSubConcept || !hasQuiz ? `
                        <button class="page-nav-btn nav-next flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nebula-500 to-teal-600 text-white font-medium rounded-lg hover:from-nebula-600 hover:to-teal-700 transition-all duration-200 shadow-soft hover:shadow-medium" data-direction="next">
                            Next
                            <i class="fas fa-chevron-right ml-2"></i>
                        </button>
                    ` : `
                        <div class="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed">
                            <i class="fas fa-chevron-right"></i>
                            Complete Quiz to Continue
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Initialize sub-concept page functionality
     * Sets up event listeners and initializes components
     */
    initializeSubConceptPage(page) {
        const { hasQuiz, concept, isLastSubConcept } = page.data;
        const subConcept = page.data.subConcept;

        // First, cleanup any existing voice widgets to prevent multiple sessions
        console.log(`SubConceptRenderer: Initializing sub-concept page, cleaning up any existing voice widgets`);
        this.cleanupVoiceWidgets();

        // Pre-warm SpaceVisualizer if this page has video
        // CRITICAL: Must happen BEFORE video element loads to avoid WebGL context limit
        if (subConcept.video && subConcept.video.src) {
            this.prewarmSpaceVisualizer();
        }

        // Setup learning mode toggle event listeners
        this.setupLearningModeListeners(subConcept);

        // Split long read content into learner-friendly slides
        this.initializeLearningContentPagination(subConcept);

        // Setup chat tutor button listener
        this.setupChatTutorListener(subConcept);

        // Setup page navigation listeners
        this.setupPageNavigationListeners();

        // Initialize embedded quiz if present
        if (hasQuiz && concept.quiz && isLastSubConcept) {
            this.initializeEmbeddedQuiz(concept, subConcept);
        }

        // Announce page ready for screen readers
        this.announceToScreenReader(`Loaded ${subConcept.title} from ${concept.title}`);
    }

    /**
     * Pre-warm the SpaceVisualizer to ensure 3D context is available
     * Must be called BEFORE video elements load, as video hardware acceleration can consume WebGL contexts
     */
    prewarmSpaceVisualizer() {
        if (typeof SpaceVisualizerManager !== 'undefined' && window.SpaceVisualizerManager) {
            // Check if visualizer already exists
            if (!window.SpaceVisualizerManager.hasVisualizer()) {
                console.log('SubConceptRenderer: Pre-warming SpaceVisualizer for video mode');

                // Create a temporary hidden canvas to initialize the WebGL context
                const tempCanvas = document.createElement('canvas');
                tempCanvas.id = 'prewarm-canvas';
                tempCanvas.style.cssText = 'position: absolute; left: -9999px; top: -9999px; width: 100px; height: 100px;';
                document.body.appendChild(tempCanvas);

                // Acquire visualizer to create the WebGL context
                const visualizer = window.SpaceVisualizerManager.acquire(tempCanvas, {}, 'prewarm');

                if (visualizer) {
                    console.log('SubConceptRenderer: SpaceVisualizer pre-warmed successfully');
                    // Release it so it can be transferred to the voice widget later
                    window.SpaceVisualizerManager.release('prewarm');
                } else {
                    console.warn('SubConceptRenderer: Failed to pre-warm SpaceVisualizer');
                }

                // Remove temporary canvas (renderer canvas stays in manager)
                document.body.removeChild(tempCanvas);
            } else {
                console.log('SubConceptRenderer: SpaceVisualizer already exists, no pre-warm needed');
            }
        }
    }


    /**
     * Setup event listeners for learning mode toggle buttons
     */
    setupLearningModeListeners(subConcept) {
        // Remove any existing listeners to prevent duplicates
        const existingButtons = document.querySelectorAll(`[data-sub-concept-id="${subConcept.id}"].learning-mode-toggle`);
        existingButtons.forEach(btn => {
            btn.removeEventListener('click', this.handleLearningModeToggle);
        });

        // Add new listeners
        const buttons = document.querySelectorAll(`[data-sub-concept-id="${subConcept.id}"].learning-mode-toggle`);
        buttons.forEach(button => {
            button.addEventListener('click', (event) => {
                this.handleLearningModeToggle(event);
            });
        });
    }

    /**
     * Handle learning mode toggle
     * Replaces the global toggleLearningMode function
     * Now supports video mode in addition to read and listen modes
     */
    handleLearningModeToggle(event) {
        const button = event.currentTarget;
        const subConceptId = button.dataset.subConceptId;
        const mode = button.dataset.mode;

        // Get all content sections
        const readContent = document.getElementById(`read-lesson-content-${subConceptId}`);
        const listenContent = document.getElementById(`listen-audio-content-${subConceptId}`);
        const videoContent = document.getElementById(`watch-video-content-${subConceptId}`);

        // Get all buttons
        const readBtn = document.getElementById(`read-lesson-btn-${subConceptId}`);
        const listenBtn = document.getElementById(`listen-audio-btn-${subConceptId}`);
        const videoBtn = document.getElementById(`watch-video-btn-${subConceptId}`);

        // Get image/video containers
        const imageContainer = document.getElementById(`image-container-${subConceptId}`);
        const videoContainer = document.getElementById(`video-container-${subConceptId}`);

        // Hide all content sections
        if (readContent) readContent.classList.add('hidden');
        if (listenContent) listenContent.classList.add('hidden');
        if (videoContent) videoContent.classList.add('hidden');

        // Remove active state from all buttons (new pill design)
        const removeActiveState = (btn) => {
            if (btn) {
                btn.classList.remove('bg-white', 'text-slate-800', 'shadow-sm', 'ring-1', 'ring-slate-200');
                btn.classList.add('text-slate-500');
                // Reset icon color
                const icon = btn.querySelector('i');
                if (icon) icon.classList.remove('text-teal-500', 'text-blue-500', 'text-indigo-500');
            }
        };

        removeActiveState(readBtn);
        removeActiveState(listenBtn);
        removeActiveState(videoBtn);

        // Helper to activate a button with appropriate icon color
        const activateButton = (btn, iconColor = 'text-teal-500') => {
            if (btn) {
                btn.classList.add('bg-white', 'text-slate-800', 'shadow-sm', 'ring-1', 'ring-slate-200');
                btn.classList.remove('text-slate-500');
                // Set icon color
                const icon = btn.querySelector('i');
                if (icon) icon.classList.add(iconColor);
            }
        };

        // Show selected content and activate button with appropriate colors
        if (mode === 'read') {
            if (readContent) readContent.classList.remove('hidden');
            activateButton(readBtn, 'text-teal-500');

            // Show image, hide video
            if (imageContainer) imageContainer.classList.remove('hidden');
            if (videoContainer) videoContainer.classList.add('hidden');

            // Kill voice bot and clean up audio player when switching to read mode
            console.log(`SubConceptRenderer: Switching to read mode, cleaning up voice bot and audio player for ${subConceptId}`);
            this.cleanupVoiceWidget(subConceptId);
            this.cleanupAudioPlayer(subConceptId);
            this.pauseVideoPlayer(subConceptId);
            this.resetVideoVoiceWidgetUI(subConceptId);

        } else if (mode === 'listen') {
            if (listenContent) listenContent.classList.remove('hidden');
            activateButton(listenBtn, 'text-blue-500');

            // Show image, hide video
            if (imageContainer) imageContainer.classList.remove('hidden');
            if (videoContainer) videoContainer.classList.add('hidden');

            // Reset to audio player state when switching to listen mode
            console.log(`SubConceptRenderer: Switching to listen mode, resetting to audio player state for ${subConceptId}`);

            // Kill any active voice bot and reset to audio player
            this.cleanupVoiceWidget(subConceptId);
            this.resetToAudioPlayerState(subConceptId);
            this.pauseVideoPlayer(subConceptId);
            this.resetVideoVoiceWidgetUI(subConceptId);

            // Initialize audio player when switching to listen mode
            setTimeout(() => {
                this.initializeAudioPlayerForSubConcept(subConceptId);
            }, 500);

        } else if (mode === 'video') {
            if (videoContent) videoContent.classList.remove('hidden');
            activateButton(videoBtn, 'text-indigo-500');

            // Hide image, show video
            if (imageContainer) imageContainer.classList.add('hidden');
            if (videoContainer) videoContainer.classList.remove('hidden');

            // Clean up audio and voice when switching to video mode
            console.log(`SubConceptRenderer: Switching to video mode for ${subConceptId}`);
            this.cleanupVoiceWidget(subConceptId);
            this.cleanupAudioPlayer(subConceptId);
            // Reset the voice widget UI to show activation screen (fixes white background issue)
            this.resetVideoVoiceWidgetUI(subConceptId);
        }

        // Announce for screen readers
        let announcement;
        switch (mode) {
            case 'read':
                announcement = 'Switched to Read Lesson mode';
                break;
            case 'listen':
                announcement = 'Switched to Listen Audio mode';
                break;
            case 'video':
                announcement = 'Switched to Watch Video mode';
                break;
            default:
                announcement = `Switched to ${mode} mode`;
        }
        this.announceToScreenReader(announcement);
    }

    /**
     * Pause video player for a sub-concept
     */
    pauseVideoPlayer(subConceptId) {
        const videoPlayer = document.getElementById(`video-player-${subConceptId}`);
        if (videoPlayer && !videoPlayer.paused) {
            videoPlayer.pause();
            console.log(`SubConceptRenderer: Paused video player for ${subConceptId}`);
        }
    }

    /**
     * Reset video voice widget UI back to activation screen
     * Called when switching away from video mode to allow restart later
     */
    resetVideoVoiceWidgetUI(subConceptId) {
        const container = document.getElementById(`voice-bot-video-container-${subConceptId}`);
        if (container) {
            // Restore the activation screen (matching renderVideoLearningSection layout)
            container.innerHTML = `
                <div class="voice-activation-screen-video text-center py-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100" id="voice-activation-video-${subConceptId}">
                    <div class="voice-activation-icon mb-4">
                        <div class="relative inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full shadow-lg">
                            <i class="fas fa-microphone text-white text-2xl"></i>
                        </div>
                    </div>
                    <h5 class="text-lg font-semibold text-gray-800 mb-2">AI Voice Assistant</h5>
                    <p class="text-gray-600 mb-4 max-w-md mx-auto text-sm">
                        Ask questions using your voice for an interactive learning experience
                    </p>
                    <button
                        onclick="window.subConceptRenderer.startVoiceAssistantForVideo('${subConceptId}')"
                        class="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow-md hover:shadow-lg">
                        <i class="fas fa-play mr-2"></i>
                        Start Voice Assistant
                    </button>
                </div>
            `;
            console.log(`SubConceptRenderer: Reset video voice widget UI for ${subConceptId}`);
        }
    }

    /**
     * Setup chat tutor button listener
     * Handles multiple chat tutor buttons (one in read mode, one in video mode)
     */
    setupChatTutorListener(subConcept) {
        const chatButtons = document.querySelectorAll(`[data-concept-id="${subConcept.id}"].chat-tutor-btn`);
        chatButtons.forEach(chatButton => {
            chatButton.addEventListener('click', () => {
                // Use new greeting mode instead of learn_more
                if (window.chatSystem && window.chatSystem.openTutorWithGreeting) {
                    window.chatSystem.openTutorWithGreeting();
                }
            });
        });
    }

    /**
     * Setup page navigation listeners
     */
    setupPageNavigationListeners() {
        // Previous button
        const prevBtn = document.querySelector('.nav-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (window.navigatePreviousPage) {
                    window.navigatePreviousPage();
                }
            });
        }

        // Next button
        const nextBtn = document.querySelector('.nav-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (window.navigateNextPage) {
                    window.navigateNextPage();
                }
            });
        }
    }

    // Continue with other methods...
    // This is a partial implementation to show the structure
    // Additional methods will be added in subsequent phases

    /**
     * Helper method to announce to screen readers
     */
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.setAttribute('class', 'sr-only');
        announcement.textContent = message;

        document.body.appendChild(announcement);

        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    /**
     * Cleanup voice widget for a specific sub-concept
     * Cleans up both listen mode and video mode widgets
     */
    cleanupVoiceWidget(subConceptId) {
        // Cleanup listen mode widget
        if (this.voiceWidgetManager && this.voiceWidgetManager.isWidgetActive(subConceptId)) {
            this.voiceWidgetManager.destroyWidget(subConceptId);
        }
        // Cleanup video mode widget (uses different ID)
        const videoWidgetId = `${subConceptId}-video`;
        if (this.voiceWidgetManager && this.voiceWidgetManager.isWidgetActive(videoWidgetId)) {
            this.voiceWidgetManager.destroyWidget(videoWidgetId);
        }
    }

    /**
     * Reset to audio player state when switching back to Listen Audio mode
     * Ensures audio player is shown and voice bot is hidden
     */
    resetToAudioPlayerState(subConceptId) {
        try {
            console.log(`SubConceptRenderer: Resetting to audio player state for ${subConceptId}`);

            // Get DOM elements
            const audioPlayerContainer = document.getElementById(`audio-player-container-${subConceptId}`);
            const transcriptContainer = document.getElementById(`transcript-container-${subConceptId}`);
            const voiceContainer = document.getElementById(`voice-bot-container-${subConceptId}`);
            const waitingScreen = document.getElementById(`voice-waiting-${subConceptId}`);

            // Hide voice container immediately
            if (voiceContainer) {
                voiceContainer.style.display = 'none';
                voiceContainer.style.opacity = '0';
                voiceContainer.innerHTML = ''; // Clear any voice widget content
            }

            // Show audio player container in full size
            if (audioPlayerContainer) {
                audioPlayerContainer.style.display = 'block';
                audioPlayerContainer.style.opacity = '1';
                audioPlayerContainer.style.transform = 'translateY(0)';

                // Remove transcript-active classes to ensure full size
                audioPlayerContainer.classList.remove('transcript-active');
            }

            // Hide transcript container completely (no transcription by default)
            if (transcriptContainer) {
                transcriptContainer.style.display = 'none';
                transcriptContainer.style.opacity = '0';
            }

            // Remove transcript-active class from the section
            const prerecordedSection = document.querySelector(`#listen-audio-content-${subConceptId} .prerecorded-audio-section`);
            if (prerecordedSection) {
                prerecordedSection.classList.remove('transcript-active');
            }

            // Hide transcript manager if it exists
            const audioPlayerData = this.activeAudioPlayers.get(subConceptId);
            if (audioPlayerData && audioPlayerData.transcriptManager) {
                try {
                    audioPlayerData.transcriptManager.hide();
                } catch (error) {
                    console.warn('Error hiding transcript manager during reset:', error);
                }
            }

            // Reset waiting screen if it exists
            if (waitingScreen) {
                waitingScreen.style.display = 'block';
            }

            console.log(`SubConceptRenderer: Successfully reset to full-size audio player state without transcription for ${subConceptId}`);

        } catch (error) {
            console.error(`Error resetting to audio player state for ${subConceptId}:`, error);
        }
    }

    /**
     * Cleanup all active voice widgets and audio players
     */
    cleanupVoiceWidgets() {
        if (this.voiceWidgetManager) {
            this.voiceWidgetManager.cleanupAllWidgets();
        }

        // Cleanup all audio players
        this.cleanupAllAudioPlayers();
    }

    /**
     * Retry voice widget initialization
     */
    retryVoiceWidget(subConceptId) {
        // Find the sub-concept data from current page
        const currentPage = window.pageRenderer?.getCurrentPage();
        if (currentPage?.type === 'sub-concept' && currentPage.data.subConcept?.id === subConceptId) {
            const subConcept = currentPage.data.subConcept;
            this.initializeVoiceWidgetForListenMode(subConceptId);
        }
    }

    // Placeholder methods for phases 2-4
    /**
     * Render learning content using markdown renderer
     * Extracted from page-renderer.js renderLearningContent method
     */
    renderLearningContent(content) {
        if (!content) return '<p class="text-gray-500">No content available.</p>';

        // Ensure content is always a string to prevent "[object Object]"
        if (typeof content !== 'string') {
            console.warn('renderLearningContent: content is not a string:', typeof content);
            content = String(content || 'No content available.');
        }

        // Use existing markdown renderer if available
        if (this.markdownRenderer && typeof this.markdownRenderer.render === 'function') {
            return this.markdownRenderer.render(content);
        }

        // Fallback to basic markdown rendering
        return this.basicMarkdownRender(content);
    }

    /**
     * Basic markdown rendering for fallback
     * Extracted from page-renderer.js basicMarkdownRender method
     */
    basicMarkdownRender(content) {
        if (!content) return '';

        const externalLinkAttrs = 'target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline"';

        // Very basic markdown rendering for fallback
        let html = content
            // Headers
            .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-10 mb-5">$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```(.*?)```/gs, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>')
            // Inline code
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm">$1</code>')
            // Links
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, `<a href="$2" ${externalLinkAttrs}>$1</a>`)
            .replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, `<a href="$1" ${externalLinkAttrs}>$1</a>`)
            // Lists
            .replace(/^\* (.*$)/gm, '<li class="ml-4">• $1</li>')
            .replace(/^\d+\. (.*$)/gm, '<li class="ml-4">$1</li>')
            // Paragraphs
            .split('\n\n').map(p => p.trim() ? `<p class="mb-4">${p}</p>` : '').join('\n');

        return html;
    }

    /**
     * Render embedded quiz for sub-concept
     * Extracted from page-renderer.js renderEmbeddedQuiz method
     */
    renderEmbeddedQuiz(quiz, conceptId) {
        if (!quiz) return '';

        // Use the same structure as the old inline quiz system for compatibility
        const quizSectionId = `quiz-section-${conceptId}`;
        return `
            <div id="${quizSectionId}" class="hidden mt-8 animate-slideInUp">
                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-100 to-indigo-100 px-6 py-4 border-b border-blue-200">
                        <div class="flex items-center justify-between">
                            <div>
                                <h5 class="text-lg font-bold text-blue-900">
                                    <i class="fas fa-brain mr-2"></i>
                                    ${quiz.title}
                                </h5>
                                <p class="text-blue-700 text-sm mt-1">${quiz.description}</p>
                            </div>
                            <button data-concept-id="${conceptId}" class="quiz-close-btn text-blue-600 hover:text-blue-800 transition-colors">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>

                    <div id="quiz-content-${conceptId}" class="p-6">
                        <!-- Quiz content will be loaded here -->
                    </div>

                    <div id="quiz-result-${conceptId}" class="hidden p-6 border-t border-blue-200">
                        <!-- Quiz results will be shown here -->
                    </div>

                    <div id="quiz-controls-${conceptId}" class="hidden border-t border-blue-200 px-6 py-4 bg-blue-50">
                        <div class="flex justify-between items-center">
                            <div id="quiz-status-${conceptId}" class="text-sm text-blue-700">
                                <!-- Status message -->
                            </div>
                            <div class="flex space-x-3">
                                <button data-concept-id="${conceptId}" class="quiz-retry-btn px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                    Try Another Question
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize embedded quiz for sub-concept
     * Extracted from page-renderer.js initializeSubConceptPage quiz logic
     */
    initializeEmbeddedQuiz(concept, subConcept) {
        // Initialize embedded quiz if present and not already initialized
        setTimeout(() => {
            try {
                // First, make the quiz section visible (like the old toggleConceptQuiz did)
                const quizSection = document.getElementById(`quiz-section-${concept.id}`);
                if (quizSection) {
                    console.log('SubConceptRenderer: Making quiz section visible for:', concept.id);
                    quizSection.classList.remove('hidden');
                    quizSection.style.display = 'block';
                    quizSection.style.visibility = 'visible';
                    quizSection.style.opacity = '1';
                    quizSection.style.height = 'auto';
                    quizSection.style.minHeight = '400px';
                    quizSection.style.width = '100%';
                    quizSection.style.overflow = 'visible';
                    quizSection.style.position = 'relative';
                    quizSection.style.zIndex = '1000';

                    // Force content area to expand
                    const contentDiv = document.getElementById(`quiz-content-${concept.id}`);
                    if (contentDiv) {
                        contentDiv.style.display = 'block';
                        contentDiv.style.height = 'auto';
                        contentDiv.style.minHeight = '300px';
                        contentDiv.style.width = '100%';
                    }

                    console.log('Quiz section made visible, now loading quiz...');

                    // Then load the quiz using the correct function
                    if (window.loadConceptQuiz && typeof window.loadConceptQuiz === 'function') {
                        window.loadConceptQuiz(concept.id);
                    } else {
                        console.warn('loadConceptQuiz function not available');
                    }
                } else {
                    console.error('Quiz section not found for concept:', concept.id);
                }
            } catch (error) {
                console.error('Error initializing quiz for sub-concept page:', error);
            }
        }, 300);

        // Listen for quiz completion to enable Next button
        const handleQuizCompletion = (event) => {
            if (event.detail.conceptId === concept.id && event.detail.passed) {
                this.enableNextButtonAfterQuiz();
            }
        };

        // Add event listener for quiz completion
        document.addEventListener('conceptQuizCompleted', handleQuizCompletion);

        // Clean up event listener when page changes
        const cleanup = () => {
            document.removeEventListener('conceptQuizCompleted', handleQuizCompletion);
        };
        document.addEventListener('pageChanged', cleanup, { once: true });

        // Setup quiz control event listeners
        this.setupQuizControlListeners(concept.id);
    }

    /**
     * Setup quiz control event listeners
     */
    setupQuizControlListeners(conceptId) {
        // Quiz close button
        const closeBtn = document.querySelector(`[data-concept-id="${conceptId}"].quiz-close-btn`);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const quizSection = document.getElementById(`quiz-section-${conceptId}`);
                if (quizSection) {
                    quizSection.classList.add('hidden');
                }
            });
        }

        // Quiz retry button
        const retryBtn = document.querySelector(`[data-concept-id="${conceptId}"].quiz-retry-btn`);
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (window.resetQuizState && window.loadQuizQuestion) {
                    window.resetQuizState(conceptId);
                    window.loadQuizQuestion(conceptId);
                }
            });
        }
    }

    /**
     * Enable next button after quiz completion
     */
    enableNextButtonAfterQuiz() {
        const pageNavigation = document.querySelector('.page-navigation');
        if (pageNavigation) {
            const nextButtonContainer = pageNavigation.querySelector('.flex.justify-between > div:last-child');
            if (nextButtonContainer && nextButtonContainer.classList.contains('cursor-not-allowed')) {
                // Replace disabled button with enabled Next button
                nextButtonContainer.outerHTML = `
                    <button class="page-nav-btn nav-next flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nebula-500 to-teal-600 text-white font-medium rounded-lg hover:from-nebula-600 hover:to-teal-700 transition-all duration-200 shadow-soft hover:shadow-medium" data-direction="next">
                        Next
                        <i class="fas fa-chevron-right ml-2"></i>
                    </button>
                `;
                // Re-setup navigation listeners
                this.setupPageNavigationListeners();
            }
        }
    }

    /**
     * Start voice assistant on user request
     */
    startVoiceAssistant(subConceptId) {
        console.log(`SubConceptRenderer: Starting voice assistant for ${subConceptId}`);
        this.initializeVoiceWidgetForListenMode(subConceptId);
    }

    /**
     * Start voice assistant for video mode (separate container)
     */
    startVoiceAssistantForVideo(subConceptId) {
        console.log(`SubConceptRenderer: Starting voice assistant for video mode ${subConceptId}`);
        this.initializeVoiceWidgetForVideoMode(subConceptId);
    }

    /**
     * Initialize voice widget for video mode
     * Similar to listen mode but uses a different container
     */
    initializeVoiceWidgetForVideoMode(subConceptId) {
        // Find the sub-concept data from current page
        const currentPage = window.pageRenderer?.getCurrentPage();
        if (currentPage?.type === 'sub-concept' && currentPage.data.subConcept?.id === subConceptId) {
            const subConcept = currentPage.data.subConcept;

            // Use voicebot_context if available, otherwise fallback to bot_context
            const voicebotContext = subConcept.voicebot_context || null;
            const botContext = subConcept.bot_context || null;
            const effectiveContext = voicebotContext || botContext;

            if (effectiveContext && this.voiceWidgetManager) {
                setTimeout(() => {
                    try {
                        console.log(`Initializing voice widget for video mode - sub-concept ${subConceptId}`);

                        // First, cleanup ALL existing widgets to free up WebGL contexts
                        // This prevents "Error creating WebGL context" when video is also using WebGL
                        this.cleanupVoiceWidget(subConceptId);  // Cleans up both listen and video mode widgets

                        // CRITICAL: Pause video to free up WebGL context before initializing 3D visualizer
                        // Video hardware acceleration can consume WebGL contexts, preventing new ones
                        const videoPlayer = document.getElementById(`video-player-${subConceptId}`);
                        const wasPlaying = videoPlayer && !videoPlayer.paused;
                        const videoTime = videoPlayer ? videoPlayer.currentTime : 0;

                        if (videoPlayer) {
                            videoPlayer.pause();
                            console.log('SubConceptRenderer: Paused video to free WebGL context for 3D visualizer');
                        }

                        // Clean up the container before initializing (use video mode container)
                        const container = document.getElementById(`voice-bot-video-container-${subConceptId}`);
                        if (container) {
                            // Show loading state when manually starting voice assistant
                            container.innerHTML = `
                                <div class="voice-widget-loading-full">
                                    <div class="flex flex-col items-center justify-center py-8 bg-white/60 rounded-lg">
                                        <div class="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-500 mb-4"></div>
                                        <p class="text-base text-gray-600">Starting voice assistant...</p>
                                        <p class="text-sm text-gray-500 mt-1">Connecting to live AI assistant</p>
                                    </div>
                                </div>
                            `;

                            // Initialize the voice widget after showing loading state
                            // Pass voicebotContext as 4th parameter, title as 5th parameter, hideBackToAudio as 6th
                            setTimeout(async () => {
                                const success = await this.voiceWidgetManager.initializeWidget(
                                    `${subConceptId}-video`,  // Unique ID for video mode widget
                                    botContext,
                                    `#voice-bot-video-container-${subConceptId}`,
                                    voicebotContext,  // Voice-specific context (takes priority if provided)
                                    subConcept.title,  // Topic title for personalized greeting
                                    true  // hideBackToAudio - not needed in video mode
                                );

                                if (success) {
                                    console.log(`SubConceptRenderer: Voice widget (video mode) initialized successfully for ${subConceptId}`);
                                } else {
                                    // Show error message if initialization failed
                                    this.showVoiceWidgetErrorForVideo(subConceptId);
                                    console.error(`SubConceptRenderer: Failed to initialize voice widget (video mode) for ${subConceptId}`);
                                }
                            }, 200);
                        }
                    } catch (error) {
                        console.error('Error initializing voice widget for video mode:', error);
                        this.showVoiceWidgetErrorForVideo(subConceptId);
                    }
                }, 300); // Small delay to ensure DOM is ready
            }
        }
    }

    /**
     * Show error state for video mode voice widget
     */
    showVoiceWidgetErrorForVideo(subConceptId) {
        const container = document.getElementById(`voice-bot-video-container-${subConceptId}`);
        if (container) {
            container.innerHTML = `
                <div class="voice-widget-error-full text-center py-6 bg-red-50 rounded-lg border border-red-200">
                    <div class="text-red-500 mb-3">
                        <i class="fas fa-exclamation-triangle text-3xl"></i>
                    </div>
                    <h4 class="text-base font-semibold text-red-700 mb-2">Voice Assistant Unavailable</h4>
                    <p class="text-sm text-red-600 mb-4">Unable to start the voice assistant. Please try again.</p>
                    <button 
                        onclick="window.subConceptRenderer.startVoiceAssistantForVideo('${subConceptId}')"
                        class="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors">
                        <i class="fas fa-redo mr-2"></i>Retry
                    </button>
                </div>
            `;
        }
    }


    /**
     * Initialize voice widget for listen mode
     * Extracted from page-renderer.js initializeVoiceWidgetForListenMode function
     */
    initializeVoiceWidgetForListenMode(subConceptId) {
        // Find the sub-concept data from current page
        const currentPage = window.pageRenderer?.getCurrentPage();
        if (currentPage?.type === 'sub-concept' && currentPage.data.subConcept?.id === subConceptId) {
            const subConcept = currentPage.data.subConcept;

            // Use voicebot_context if available, otherwise fallback to bot_context
            const voicebotContext = subConcept.voicebot_context || null;
            const botContext = subConcept.bot_context || null;
            const effectiveContext = voicebotContext || botContext;

            if (effectiveContext && this.voiceWidgetManager) {
                setTimeout(() => {
                    try {
                        console.log(`Initializing voice widget for listen mode - sub-concept ${subConceptId}`);

                        // First, cleanup any existing widget for this sub-concept to prevent duplicates
                        if (this.voiceWidgetManager.isWidgetActive(subConceptId)) {
                            console.log(`SubConceptRenderer: Cleaning up existing widget for ${subConceptId}`);
                            this.voiceWidgetManager.destroyWidget(subConceptId);
                        }

                        // Clean up the container before initializing
                        const container = document.getElementById(`voice-bot-container-${subConceptId}`);
                        if (container) {
                            container.innerHTML = `
                                <div class="voice-widget-loading-full">
                                    <div class="flex flex-col items-center justify-center py-12">
                                        <div class="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mb-4"></div>
                                        <p class="text-lg text-gray-600">Loading voice assistant...</p>
                                    </div>
                                </div>
                            `;
                        }

                        // Show loading state when manually starting voice assistant
                        container.innerHTML = `
                            <div class="voice-widget-loading-full">
                                <div class="flex flex-col items-center justify-center py-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg">
                                    <div class="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mb-4"></div>
                                    <p class="text-lg text-gray-600">Starting voice assistant...</p>
                                    <p class="text-sm text-gray-500 mt-2">Connecting to live AI assistant</p>
                                </div>
                            </div>
                        `;

                        // Initialize the voice widget after showing loading state
                        // Pass voicebotContext as 4th parameter, title as 5th parameter
                        setTimeout(async () => {
                            const success = await this.voiceWidgetManager.initializeWidget(
                                subConceptId,
                                botContext,
                                `#voice-bot-container-${subConceptId}`,
                                voicebotContext,  // Voice-specific context (takes priority if provided)
                                subConcept.title  // Topic title for personalized greeting
                            );

                            if (success) {
                                console.log(`SubConceptRenderer: Voice widget initialized successfully for ${subConceptId}`);
                            } else {
                                // Show error message if initialization failed
                                this.showVoiceWidgetError(subConceptId);
                                console.error(`SubConceptRenderer: Failed to initialize voice widget for ${subConceptId}`);
                            }
                        }, 200);
                    } catch (error) {
                        console.error('Error initializing voice widget for listen mode:', error);
                        this.showVoiceWidgetError(subConceptId);
                    }
                }, 500); // Small delay to ensure DOM is ready
            }
        }
    }

    /**
     * Initialize audio player and transcript for sub-concept
     */
    async initializeAudioPlayerForSubConcept(subConceptId) {
        try {
            // Debug logging
            console.log(`SubConceptRenderer: Initializing audio player for ${subConceptId}`);
            console.log(`SubConceptRenderer: templateData available:`, !!window.templateData);

            // Get sub-concept data from page config
            const subConcept = this.findSubConceptById(subConceptId);
            console.log(`SubConceptRenderer: Found sub-concept:`, !!subConcept);
            if (subConcept) {
                console.log(`SubConceptRenderer: Audio data:`, subConcept.audio);
            }

            if (!subConcept || !subConcept.audio || subConcept.audio.length === 0) {
                console.log(`SubConceptRenderer: No audio data found for ${subConceptId}`);
                return;
            }

            // Get the first audio file (for now, we support one audio file per sub-concept)
            const audioData = subConcept.audio[0];

            // Initialize audio player
            const audioPlayerContainer = document.getElementById(`audio-player-container-${subConceptId}`);
            const transcriptContainer = document.getElementById(`transcript-container-${subConceptId}`);

            if (!audioPlayerContainer || !transcriptContainer) {
                console.error(`SubConceptRenderer: Audio containers not found for ${subConceptId}`);
                return;
            }

            // Create audio player
            const audioPlayer = new PrerecordedAudioPlayer(audioPlayerContainer, {
                id: audioData.id,
                url: audioData.file,
                title: subConcept.title || 'Audio Lesson',
                language: audioData.language || 'en'
            });

            // Create transcript manager if segments are available
            let transcriptManager = null;
            if (audioData.segments && audioData.segments.length > 0) {
                transcriptManager = new TranscriptManager(transcriptContainer, audioData.segments, audioPlayer);

                // Connect audio player and transcript manager
                audioPlayer.setTranscriptManager(transcriptManager);

                // Setup transcript toggle event listener
                const handleTranscriptToggle = (event) => {
                    if (event.detail.audioId === audioData.id) {
                        if (event.detail.action === 'shown') {
                            transcriptManager.show();
                        } else {
                            transcriptManager.hide();
                        }
                    }
                };

                // Store event handler for cleanup
                transcriptManager._transcriptToggleHandler = handleTranscriptToggle;
                document.addEventListener('transcriptToggle', handleTranscriptToggle);
            }

            // Store references for cleanup
            if (!this.activeAudioPlayers) {
                this.activeAudioPlayers = new Map();
            }
            this.activeAudioPlayers.set(subConceptId, {
                audioPlayer,
                transcriptManager
            });

            // Setup audio player event listeners
            audioPlayer.on('play', () => {
                console.log(`SubConceptRenderer: Audio started for ${subConceptId}`);
            });

            audioPlayer.on('pause', () => {
                console.log(`SubConceptRenderer: Audio paused for ${subConceptId}`);
            });

            audioPlayer.on('ended', () => {
                console.log(`SubConceptRenderer: Audio ended for ${subConceptId}`);
                // Clear saved state when audio completes naturally
                this.clearSavedAudioState(subConceptId);
            });

            audioPlayer.on('error', (error) => {
                console.error(`SubConceptRenderer: Audio error for ${subConceptId}:`, error);
                this.showAudioPlayerError(subConceptId, 'Failed to load audio file');
            });

            // Restore saved audio state if available (e.g., after returning from voice assistant or text mode)
            const savedState = this.getSavedAudioState(subConceptId);
            if (savedState) {
                console.log(`SubConceptRenderer: Found saved state for ${subConceptId}, restoring...`);
                // Use a small delay to ensure audio player is fully initialized
                setTimeout(() => {
                    if (audioPlayer && typeof audioPlayer.restoreState === 'function') {
                        // Restore state but don't auto-resume (user can manually resume if they want)
                        audioPlayer.restoreState(savedState, false);
                    }
                }, 300);
            }

            console.log(`SubConceptRenderer: Audio player initialized for ${subConceptId}`);

        } catch (error) {
            console.error('Error initializing audio player:', error);
            this.showAudioPlayerError(subConceptId, 'Failed to initialize audio player');
        }
    }

    /**
     * Find sub-concept by ID
     */
    findSubConceptById(subConceptId) {
        if (!window.templateData || !window.templateData.concepts) {
            return null;
        }

        for (const concept of window.templateData.concepts) {
            if (concept.sub_concepts) {
                const subConcept = concept.sub_concepts.find(sc => sc.id === subConceptId);
                if (subConcept) {
                    return subConcept;
                }
            }
        }

        return null;
    }

    /**
     * Show audio player error message
     */
    showAudioPlayerError(subConceptId, message) {
        const audioPlayerContainer = document.getElementById(`audio-player-container-${subConceptId}`);
        if (audioPlayerContainer) {
            audioPlayerContainer.innerHTML = `
                <div class="flex items-center justify-center py-8 bg-red-50 border-2 border-red-200 rounded-lg">
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-3"></i>
                        <p class="text-red-600 font-medium">${message}</p>
                        <button onclick="window.subConceptRenderer.initializeAudioPlayerForSubConcept('${subConceptId}')"
                                class="mt-3 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Save audio player state for later restoration
     * Called before cleanup to preserve playback position
     */
    saveAudioState(subConceptId) {
        if (this.activeAudioPlayers && this.activeAudioPlayers.has(subConceptId)) {
            const { audioPlayer } = this.activeAudioPlayers.get(subConceptId);

            if (audioPlayer && typeof audioPlayer.getState === 'function') {
                const state = audioPlayer.getState();

                // Store the state with wasPlaying flag for potential auto-resume
                const savedState = {
                    currentTime: state.currentTime,
                    volume: state.volume,
                    playbackRate: state.playbackRate,
                    muted: state.muted,
                    wasPlaying: state.isPlaying,
                    savedAt: Date.now()
                };

                this.savedAudioStates.set(subConceptId, savedState);
            }
        }
    }

    /**
     * Clear saved audio state for a sub-concept
     * Called when user navigates away from the sub-concept page entirely
     */
    clearSavedAudioState(subConceptId) {
        if (this.savedAudioStates.has(subConceptId)) {
            this.savedAudioStates.delete(subConceptId);
        }
    }

    /**
     * Get saved audio state for a sub-concept
     */
    getSavedAudioState(subConceptId) {
        return this.savedAudioStates.get(subConceptId) || null;
    }

    /**
     * Cleanup audio player for sub-concept
     * Optionally saves state before cleanup for later restoration
     */
    cleanupAudioPlayer(subConceptId, preserveState = true) {
        if (this.activeAudioPlayers && this.activeAudioPlayers.has(subConceptId)) {
            const { audioPlayer, transcriptManager } = this.activeAudioPlayers.get(subConceptId);

            try {
                // Save audio state before cleanup if preserveState is true
                if (preserveState) {
                    this.saveAudioState(subConceptId);
                }

                // Cleanup audio player
                if (audioPlayer && typeof audioPlayer.destroy === 'function') {
                    audioPlayer.destroy();
                }

                // Cleanup transcript manager
                if (transcriptManager) {
                    // Remove transcript toggle event listener
                    if (transcriptManager._transcriptToggleHandler) {
                        document.removeEventListener('transcriptToggle', transcriptManager._transcriptToggleHandler);
                    }

                    // Destroy transcript manager
                    if (typeof transcriptManager.destroy === 'function') {
                        transcriptManager.destroy();
                    }
                }

                // Remove from active players
                this.activeAudioPlayers.delete(subConceptId);

                console.log(`SubConceptRenderer: Audio player cleaned up for ${subConceptId}${preserveState ? ' (state preserved)' : ''}`);
            } catch (error) {
                console.error(`Error cleaning up audio player for ${subConceptId}:`, error);
            }
        }
    }

    /**
     * Cleanup all audio players
     * Called when navigating away from sub-concept pages entirely
     * Does NOT preserve state since we're leaving the context
     */
    cleanupAllAudioPlayers() {
        if (this.activeAudioPlayers) {
            for (const [subConceptId] of this.activeAudioPlayers) {
                // Don't preserve state when cleaning all - user is navigating away
                this.cleanupAudioPlayer(subConceptId, false);
            }
            this.activeAudioPlayers.clear();
        }

        // Clear all saved audio states when navigating away
        // User is leaving the sub-concept context entirely
        if (this.savedAudioStates) {
            this.savedAudioStates.clear();
        }
    }

    /**
     * Show voice widget error message
     */
    showVoiceWidgetError(subConceptId) {
        const container = document.getElementById(`voice-bot-container-${subConceptId}`);
        if (container) {
            container.innerHTML = `
                <div class="voice-widget-error-full p-8 text-center bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 class="text-lg font-medium text-blue-900 mb-2">Voice Assistant Unavailable</h4>
                    <p class="text-sm text-blue-700">Unable to connect to voice assistant. Please try again later.</p>
                </div>
            `;
        }
    }

    /**
     * Handle audio playback completion event
     * Triggers sequential activation of voice assistant
     */
    handleAudioPlaybackCompleted(event) {
        const { audioId, title, duration, timestamp } = event.detail;
        console.log(`SubConceptRenderer: Audio playback completed - ID: ${audioId}, Title: ${title}`);

        // Find the sub-concept that contains this audio
        const subConceptId = this.findSubConceptIdByAudioId(audioId);
        if (!subConceptId) {
            console.warn(`SubConceptRenderer: Could not find sub-concept for audio ID: ${audioId}`);
            return;
        }

        console.log(`SubConceptRenderer: Triggering voice assistant activation for sub-concept: ${subConceptId}`);
        this.activateVoiceAssistantAfterAudio(subConceptId);
    }

    /**
     * Handle Skip and Solve Doubt event
     */
    handleSkipAndSolveDoubt(event) {
        const { audioId, title } = event.detail;
        console.log(`SubConceptRenderer: Skip and Solve Doubt triggered - ID: ${audioId}, Title: ${title}`);

        // Find the sub-concept that contains this audio
        const subConceptId = this.findSubConceptIdByAudioId(audioId);
        if (!subConceptId) {
            console.warn(`SubConceptRenderer: Could not find sub-concept for audio ID: ${audioId}`);
            return;
        }

        console.log(`SubConceptRenderer: Activating voice assistant for sub-concept: ${subConceptId}`);

        // IMPORTANT: Save audio state before transitioning to voice assistant
        // This allows the user to resume from where they left off when returning
        this.saveAudioState(subConceptId);

        // Hide audio player with smooth transition
        this.hideAudioPlayerWithTransition(subConceptId);

        // Activate voice assistant immediately (no delay)
        this.activateVoiceAssistantAfterAudio(subConceptId);
    }

    /**
     * Handle Back to Audio event from voice bot
     */
    handleBackToAudio(event) {
        const { sessionId, timestamp, language } = event.detail;
        console.log(`SubConceptRenderer: Back to Audio triggered - Session: ${sessionId}, Language: ${language}`);

        // Find the currently active sub-concept with voice widget
        const activeSubConceptId = this.findActiveVoiceWidgetSubConcept();
        if (!activeSubConceptId) {
            console.warn(`SubConceptRenderer: Could not find active voice widget sub-concept`);
            return;
        }

        console.log(`SubConceptRenderer: Switching back to audio for sub-concept: ${activeSubConceptId}`);

        // Manually handle the transition back to audio
        this.transitionBackToAudio(activeSubConceptId);

        // Announce for screen readers
        this.announceToScreenReader('Switched back to Audio Player mode');
    }

    /**
     * Transition back to audio player mode
     * Always return to full-size audio player without transcription
     */
    transitionBackToAudio(subConceptId) {
        const audioPlayerContainer = document.getElementById(`audio-player-container-${subConceptId}`);
        const transcriptContainer = document.getElementById(`transcript-container-${subConceptId}`);
        const voiceContainer = document.getElementById(`voice-bot-container-${subConceptId}`);
        const audioHeader = document.getElementById(`audio-header-${subConceptId}`);

        // Hide voice assistant
        if (voiceContainer) {
            voiceContainer.style.transition = 'all 0.5s ease-out';
            voiceContainer.style.opacity = '0';
            voiceContainer.style.transform = 'translateY(20px)';

            setTimeout(() => {
                voiceContainer.style.display = 'none';
            }, 500);
        }

        // Hide transcript container and ensure it's completely hidden
        if (transcriptContainer) {
            transcriptContainer.style.display = 'none';
            transcriptContainer.style.opacity = '0';
        }

        // Hide transcript manager if it exists
        const audioPlayerData = this.activeAudioPlayers.get(subConceptId);
        if (audioPlayerData && audioPlayerData.transcriptManager) {
            try {
                audioPlayerData.transcriptManager.hide();
            } catch (error) {
                console.warn('Error hiding transcript manager:', error);
            }
        }

        // Remove transcript-active classes to restore full-size audio player
        if (audioPlayerContainer) {
            audioPlayerContainer.classList.remove('transcript-active');
        }

        // Remove transcript-active class from the section
        const prerecordedSection = document.querySelector(`#listen-audio-content-${subConceptId} .prerecorded-audio-section`);
        if (prerecordedSection) {
            prerecordedSection.classList.remove('transcript-active');
        }

        // Show audio player in full size (without transcription)
        if (audioPlayerContainer) {
            audioPlayerContainer.style.display = 'block';
            audioPlayerContainer.style.opacity = '0';
            audioPlayerContainer.style.transform = 'translateY(-20px)';

            setTimeout(() => {
                audioPlayerContainer.style.transition = 'all 0.5s ease-out';
                audioPlayerContainer.style.opacity = '1';
                audioPlayerContainer.style.transform = 'translateY(0)';
            }, 100);
        }

        // Show audio header
        if (audioHeader) {
            audioHeader.style.display = 'block';
            audioHeader.style.opacity = '0';
            audioHeader.style.transform = 'translateY(-20px)';

            setTimeout(() => {
                audioHeader.style.transition = 'all 0.5s ease-out';
                audioHeader.style.opacity = '1';
                audioHeader.style.transform = 'translateY(0)';
            }, 100);
        }

        // Destroy voice widget if active
        if (this.voiceWidgetManager && this.voiceWidgetManager.isWidgetActive(subConceptId)) {
            this.voiceWidgetManager.destroyWidget(subConceptId);
        }

        // Reinitialize audio player after WebGL context is released
        // This ensures the 3D SpaceVisualizer is recreated properly
        setTimeout(() => {
            this.initializeAudioPlayerForSubConcept(subConceptId);
            console.log(`SubConceptRenderer: Reinitialized audio player with 3D visualizer for ${subConceptId}`);
        }, 500);

        console.log(`SubConceptRenderer: Transitioned back to audio player with full size and no transcription for ${subConceptId}`);
    }

    /**
     * Find sub-concept ID by audio ID
     */
    findSubConceptIdByAudioId(audioId) {
        if (!window.templateData || !window.templateData.concepts) {
            return null;
        }

        for (const concept of window.templateData.concepts) {
            if (concept.sub_concepts) {
                for (const subConcept of concept.sub_concepts) {
                    if (subConcept.audio && subConcept.audio.length > 0) {
                        const audioMatch = subConcept.audio.find(audio => audio.id === audioId);
                        if (audioMatch) {
                            return subConcept.id;
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Find sub-concept ID with active voice widget
     */
    findActiveVoiceWidgetSubConcept() {
        if (!this.voiceWidgetManager) {
            return null;
        }

        // Get the currently visible listen content section
        const listenContentSections = document.querySelectorAll('[id^="listen-audio-content-"]:not(.hidden)');

        for (const section of listenContentSections) {
            const subConceptId = section.id.replace('listen-audio-content-', '');

            // Check if this sub-concept has an active voice widget
            if (this.voiceWidgetManager.isWidgetActive(subConceptId)) {
                console.log(`SubConceptRenderer: Found active voice widget for sub-concept: ${subConceptId}`);
                return subConceptId;
            }
        }

        // Fallback: check all voice bot containers that are visible
        const voiceContainers = document.querySelectorAll('[id^="voice-bot-container-"]');
        for (const container of voiceContainers) {
            if (container.style.display !== 'none' && container.style.display !== '') {
                const subConceptId = container.id.replace('voice-bot-container-', '');
                if (this.voiceWidgetManager.isWidgetActive(subConceptId)) {
                    console.log(`SubConceptRenderer: Found visible voice container for sub-concept: ${subConceptId}`);
                    return subConceptId;
                }
            }
        }

        console.warn('SubConceptRenderer: No active voice widget found');
        return null;
    }

    /**
     * Activate voice assistant after audio completion with smooth transition
     */
    activateVoiceAssistantAfterAudio(subConceptId) {
        try {
            console.log(`SubConceptRenderer: Activating voice assistant after audio for ${subConceptId}`);

            // Find sub-concept data
            const subConcept = this.findSubConceptById(subConceptId);

            // Use voicebot_context if available, otherwise fallback to bot_context
            const voicebotContext = subConcept?.voicebot_context || null;
            const botContext = subConcept?.bot_context || null;
            const effectiveContext = voicebotContext || botContext;

            if (!subConcept || !effectiveContext) {
                console.warn(`SubConceptRenderer: No voice context found for sub-concept: ${subConceptId}`);
                return;
            }

            // Get DOM elements
            const voiceContainer = document.getElementById(`voice-bot-container-${subConceptId}`);
            const waitingScreen = document.getElementById(`voice-waiting-${subConceptId}`);

            if (!voiceContainer) {
                console.error(`SubConceptRenderer: Voice container not found for ${subConceptId}`);
                return;
            }

            // Hide audio player and transcript sections with smooth transition
            this.hideAudioPlayerWithTransition(subConceptId);

            // Show voice container immediately without transition screen
            voiceContainer.style.display = 'block';
            voiceContainer.style.opacity = '0';
            voiceContainer.style.transform = 'translateY(20px)';

            // Fade in the voice components immediately
            setTimeout(() => {
                voiceContainer.style.transition = 'all 0.3s ease-out';
                voiceContainer.style.opacity = '1';
                voiceContainer.style.transform = 'translateY(0)';
            }, 50);

            // Initialize voice widget after WebGL context release delay
            // Browser needs ~800ms to fully release the WebGL context after audio player's SpaceVisualizer is destroyed
            // We use forceContextLoss() but still need some time for browser to clean up
            setTimeout(() => {
                this.initializeVoiceWidgetForListenMode(subConceptId);
            }, 800);

            // Announce for screen readers
            this.announceToScreenReader('Audio lesson completed. Voice assistant is now available.');

        } catch (error) {
            console.error('Error activating voice assistant after audio:', error);
            this.showVoiceWidgetError(subConceptId);
        }
    }

    /**
     * Hide audio player and transcript with smooth transition
     */
    hideAudioPlayerWithTransition(subConceptId) {
        const audioPlayerContainer = document.getElementById(`audio-player-container-${subConceptId}`);
        const transcriptContainer = document.getElementById(`transcript-container-${subConceptId}`);
        const audioHeader = document.getElementById(`audio-header-${subConceptId}`);

        // Hide audio header
        if (audioHeader) {
            audioHeader.style.transition = 'all 0.5s ease-out';
            audioHeader.style.opacity = '0';
            audioHeader.style.transform = 'translateY(-20px)';

            setTimeout(() => {
                audioHeader.style.display = 'none';
            }, 500);
        }

        if (audioPlayerContainer) {
            audioPlayerContainer.style.transition = 'all 0.5s ease-out';
            audioPlayerContainer.style.opacity = '0';
            audioPlayerContainer.style.transform = 'translateY(-20px)';

            setTimeout(() => {
                audioPlayerContainer.style.display = 'none';
            }, 500);
        }

        if (transcriptContainer) {
            transcriptContainer.style.transition = 'all 0.5s ease-out';
            transcriptContainer.style.opacity = '0';
            transcriptContainer.style.transform = 'translateY(-20px)';

            setTimeout(() => {
                transcriptContainer.style.display = 'none';
            }, 500);
        }
    }

    /**
     * Toggle to voice assistant mode
     */
    toggleToVoice(subConceptId) {
        const voiceToggle = document.getElementById(`voice-toggle-${subConceptId}`);
        const toggleVoiceBtn = document.getElementById(`toggle-voice-${subConceptId}`);
        const toggleAudioBtn = document.getElementById(`toggle-audio-${subConceptId}`);
        const audioSection = document.getElementById(`audio-section-${subConceptId}`);
        const voiceContainer = document.getElementById(`voice-bot-container-${subConceptId}`);
        const voiceHeader = document.getElementById(`voice-widget-header-${subConceptId}`);
        const audioHeader = document.getElementById(`audio-header-${subConceptId}`);

        // Update button states
        toggleVoiceBtn.classList.add('active');
        toggleAudioBtn.classList.remove('active');

        // Hide audio player section and header
        this.hideAudioPlayerWithTransition(subConceptId);
        if (audioHeader) {
            audioHeader.style.transition = 'all 0.5s ease-out';
            audioHeader.style.opacity = '0';
            audioHeader.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                audioHeader.style.display = 'none';
            }, 500);
        }

        // Show voice assistant
        if (voiceContainer) {
            voiceContainer.style.display = 'block';
            voiceContainer.style.opacity = '0';
            voiceContainer.style.transform = 'translateY(20px)';

            setTimeout(() => {
                voiceContainer.style.transition = 'all 0.5s ease-out';
                voiceContainer.style.opacity = '1';
                voiceContainer.style.transform = 'translateY(0)';
            }, 100);
        }

        if (voiceHeader) {
            voiceHeader.style.display = 'block';
            voiceHeader.style.opacity = '0';
            voiceHeader.style.transform = 'translateY(20px)';

            setTimeout(() => {
                voiceHeader.style.transition = 'all 0.5s ease-out';
                voiceHeader.style.opacity = '1';
                voiceHeader.style.transform = 'translateY(0)';
            }, 100);
        }

        // Initialize voice widget if not already active
        if (this.voiceWidgetManager && !this.voiceWidgetManager.isWidgetActive(subConceptId)) {
            const subConcept = this.findSubConceptById(subConceptId);
            // Use voicebot_context if available, otherwise fallback to bot_context
            const effectiveContext = subConcept?.voicebot_context || subConcept?.bot_context;
            if (subConcept && effectiveContext) {
                setTimeout(() => {
                    this.initializeVoiceWidgetForListenMode(subConceptId);
                }, 600);
            }
        }

        // Announce for screen readers
        this.announceToScreenReader('Switched to Voice Assistant mode');
    }

    /**
     * Toggle to audio player mode
     */
    toggleToAudio(subConceptId) {
        const voiceToggle = document.getElementById(`voice-toggle-${subConceptId}`);
        const toggleVoiceBtn = document.getElementById(`toggle-voice-${subConceptId}`);
        const toggleAudioBtn = document.getElementById(`toggle-audio-${subConceptId}`);
        const audioSection = document.getElementById(`audio-section-${subConceptId}`);
        const audioPlayerContainer = document.getElementById(`audio-player-container-${subConceptId}`);
        const transcriptContainer = document.getElementById(`transcript-container-${subConceptId}`);
        const voiceContainer = document.getElementById(`voice-bot-container-${subConceptId}`);
        const voiceHeader = document.getElementById(`voice-widget-header-${subConceptId}`);
        const audioHeader = document.getElementById(`audio-header-${subConceptId}`);

        // Update button states
        toggleAudioBtn.classList.add('active');
        toggleVoiceBtn.classList.remove('active');

        // Hide voice assistant
        if (voiceContainer) {
            voiceContainer.style.transition = 'all 0.5s ease-out';
            voiceContainer.style.opacity = '0';
            voiceContainer.style.transform = 'translateY(20px)';

            setTimeout(() => {
                voiceContainer.style.display = 'none';
            }, 500);
        }

        if (voiceHeader) {
            voiceHeader.style.transition = 'all 0.5s ease-out';
            voiceHeader.style.opacity = '0';
            voiceHeader.style.transform = 'translateY(20px)';

            setTimeout(() => {
                voiceHeader.style.display = 'none';
            }, 500);
        }

        // Show audio player in full size (without transcription)
        if (audioPlayerContainer) {
            audioPlayerContainer.style.display = 'block';
            audioPlayerContainer.style.opacity = '0';
            audioPlayerContainer.style.transform = 'translateY(-20px)';

            // Remove transcript-active classes to ensure full size
            audioPlayerContainer.classList.remove('transcript-active');

            setTimeout(() => {
                audioPlayerContainer.style.transition = 'all 0.5s ease-out';
                audioPlayerContainer.style.opacity = '1';
                audioPlayerContainer.style.transform = 'translateY(0)';
            }, 100);
        }

        // Hide transcript container completely
        if (transcriptContainer) {
            transcriptContainer.style.display = 'none';
            transcriptContainer.style.opacity = '0';
        }

        // Remove transcript-active class from the section
        const prerecordedSection = document.querySelector(`#listen-audio-content-${subConceptId} .prerecorded-audio-section`);
        if (prerecordedSection) {
            prerecordedSection.classList.remove('transcript-active');
        }

        // Hide transcript manager if it exists
        const audioPlayerData = this.activeAudioPlayers.get(subConceptId);
        if (audioPlayerData && audioPlayerData.transcriptManager) {
            try {
                audioPlayerData.transcriptManager.hide();
            } catch (error) {
                console.warn('Error hiding transcript manager during toggle to audio:', error);
            }
        }

        if (audioHeader) {
            audioHeader.style.display = 'block';
            audioHeader.style.opacity = '0';
            audioHeader.style.transform = 'translateY(-20px)';

            setTimeout(() => {
                audioHeader.style.transition = 'all 0.5s ease-out';
                audioHeader.style.opacity = '1';
                audioHeader.style.transform = 'translateY(0)';
            }, 100);
        }

        // Pause voice widget if active
        if (this.voiceWidgetManager && this.voiceWidgetManager.isWidgetActive(subConceptId)) {
            this.voiceWidgetManager.destroyWidget(subConceptId);
        }

        // Announce for screen readers
        this.announceToScreenReader('Switched to Audio Player mode');
    }

    /**
     * Get the index of a concept in the concepts array
     */
    getConceptIndex(conceptId) {
        if (!window.templateData || !window.templateData.concepts) {
            return 0;
        }

        for (let i = 0; i < window.templateData.concepts.length; i++) {
            if (window.templateData.concepts[i].id === conceptId) {
                return i;
            }
        }
        return 0;
    }

    /**
     * Get the index of a sub-concept within its parent concept
     */
    getSubConceptIndex(conceptId, subConceptId) {
        if (!window.templateData || !window.templateData.concepts) {
            return 0;
        }

        const concept = window.templateData.concepts.find(c => c.id === conceptId);
        if (!concept || !concept.sub_concepts) {
            return 0;
        }

        for (let i = 0; i < concept.sub_concepts.length; i++) {
            if (concept.sub_concepts[i].id === subConceptId) {
                return i;
            }
        }
        return 0;
    }
}

// Initialize sub-concept renderer when this script loads
window.subConceptRenderer = new SubConceptRenderer();

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubConceptRenderer;
}
