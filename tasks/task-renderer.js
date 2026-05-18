/**
 * TaskRenderer - Handles rendering of tasks with all steps and interactions
 * Extracted from topic-template.html to work with pagination system
 */

// Initialize global PiP steps registry
if (!window.pipStepsRegistry) {
    window.pipStepsRegistry = {};
}

class TaskRenderer {
    constructor() {
        this.initialized = false;
        this.activeCarousels = new Map();
        this.activeVideos = new Map();
    }

    /**
     * Initialize syntax highlighting for all code blocks using Prism.js
     * Called after task content is rendered to the DOM
     */
    initializeCodeHighlighting() {
        // Check if Prism is available
        if (typeof Prism !== 'undefined') {
            try {
                // Highlight all code blocks on the page
                Prism.highlightAll();
                console.log('✅ Prism.js syntax highlighting initialized');
            } catch (error) {
                console.warn('Prism.js highlighting error:', error);
            }
        } else {
            console.warn('Prism.js not loaded - syntax highlighting unavailable');
        }
    }

    /**
     * Initialize image carousels in task steps
     */
    initializeImageCarousels() {
        // Carousels are handled via onclick handlers in the HTML
        // This method ensures any dynamic carousel setup is performed
        console.log('📸 Image carousels ready');
    }

    /**
     * Initialize video players in task steps
     */
    initializeVideoPlayers() {
        // Videos are handled via HTML5 video elements
        // This method can be extended for custom video player initialization
        console.log('🎬 Video players ready');
    }

    /**
     * Setup event listeners for task interactions
     */
    setupTaskEventListeners(task) {
        // Task event listeners are primarily set via onclick handlers
        // This method can be extended for additional dynamic listeners
        console.log('🔧 Task event listeners configured for:', task?.id || 'unknown task');
    }

    /**
     * Main task rendering method - extracted from topic-template.html
     */
    renderTask(task, allTaskSteps, prerequisiteConcept) {
        const isUnlocked = !prerequisiteConcept || window.learningPathState.completedConcepts.has(prerequisiteConcept.id);

        // Get global task number
        const taskNumber = this.getGlobalTaskNumber(task.id);

        // Get steps directly from the task object (new v2.0 structure)
        const steps = task.steps || [];

        return `
            ${isUnlocked && steps.length > 0 ? this.renderLegacyTaskSteps(steps, task.id) : isUnlocked ?
                '<div class="p-8 text-center text-gray-500">No steps available for this task</div>' :
                '<div class="p-8 text-center text-gray-500">Complete the prerequisite concept to unlock this task</div>'}
        `;
    }

    /**
     * Render task steps container - extracted from topic-template.html
     */
    renderLegacyTaskSteps(steps, taskId) {
        if (!steps || steps.length === 0) {
            return '<div class="p-8 text-center text-gray-500">No steps available for this task</div>';
        }
        
        // Convert steps to legacy format for existing UI
        const legacySteps = steps.map((step, index) => {
            // Add legacy properties expected by existing task step UI
            return {
                ...step,
                _idx: index,
                displayIndex: index + 1,
                // Handle images (convert single image to images array if needed)
                images: step.images || (step.image ? [step.image] : []),
                image: step.images && step.images.length === 1 ? step.images[0] : step.image,
                // Handle video
                video: step.video || null,
                // Handle code
                code: step.code || null,
                // Handle hint
                hint: step.hint ? {
                    ...step.hint,
                    // Normalize hint images - convert single image to array if needed
                    images: step.hint.images || (step.hint.image ? [step.hint.image] : []),
                    image: step.hint.images && step.hint.images.length === 1 ? step.hint.images[0] : step.hint.image
                } : null,
                // Legacy flags
                hasAnyImage: !!(step.images && step.images.length > 0) || !!step.image,
                hasVideo: !!step.video,
                hasMedia: !!(step.images && step.images.length > 0) || !!step.image || !!step.video,
                imagesLength: step.images ? step.images.length : (step.image ? 1 : 0),
                hintImagesLength: step.hint && (step.hint.images ? step.hint.images.length : (step.hint.image ? 1 : 0)),
                hasMultipleImages: step.images && step.images.length > 1,
                hintHasMultipleImages: step.hint && ((step.hint.images && step.hint.images.length > 1) || (step.hint.image && !step.hint.images))
            };
        });

        // Prepare steps data for PiP (full content for enhanced PiP experience)
        const pipSteps = legacySteps.map(step => ({
            title: step.title,
            description: step.description,
            instructions: step.instructions,
            // Asset data
            images: step.images || [],
            hasMultipleImages: step.hasMultipleImages,
            imagesLength: step.imagesLength,
            video: step.video || null,
            hasVideo: step.hasVideo,
            hasMedia: step.hasMedia,
            // Code data
            code: step.code ? {
                content: step.code.content,
                language: step.code.language
            } : null,
            // Hint data
            hint: step.hint ? {
                text: step.hint.text,
                code: step.hint.code
            } : null
        }));

        // Store steps in global registry for PiP access (more reliable than data attributes)
        if (!window.pipStepsRegistry) {
            window.pipStepsRegistry = {};
        }
        window.pipStepsRegistry[taskId] = pipSteps;

        return `
            <div class="p-6" data-task-id="${taskId}">
                <!-- Task Header -->
                <div class="flex items-center mb-6">
                    <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <i class="fas fa-tasks text-teal-500"></i>
                        Task Steps
                    </h3>
                </div>
                
                <!-- Task Steps Container -->
                <div class="flex flex-col space-y-6">
                    ${legacySteps.map((step) => this.renderLegacyTaskStep(step, taskId)).join('')}
                </div>
                
                <!-- Task Completion Section -->
                ${this.renderTaskCompletionButton(taskId)}
            </div>
        `;
    }

    renderTaskCompletionButton(taskId) {
        var isCompleted = window.learningPathState.completedTasks &&
            window.learningPathState.completedTasks.has(taskId);

        if (isCompleted) {
            return '<div class="mt-10 pt-8 border-t-2 border-dashed border-gray-200" id="task-upload-section-' + taskId + '">'
                + '<div class="flex flex-col items-center justify-center space-y-3">'
                + '<div class="flex items-center space-x-3 bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-4 rounded-2xl border-2 border-green-200 shadow-sm">'
                + '<div class="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">'
                + '<i class="fas fa-check text-white text-lg"></i></div>'
                + '<span class="text-lg font-semibold text-green-700">Task Completed</span>'
                + '</div></div></div>';
        }

        return '<div class="mt-10 pt-8 border-t-2 border-dashed border-gray-200" id="task-upload-section-' + taskId + '">'
            + '<div class="flex flex-col items-center justify-center space-y-4">'
            + '<button onclick="handleTaskCompletion(\'' + taskId + '\')"'
            + ' id="task-complete-btn-' + taskId + '"'
            + ' class="group bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-3">'
            + '<i class="fas fa-check-circle text-lg group-hover:scale-110 transition-transform"></i>'
            + '<span>Mark as Complete</span>'
            + '</button></div></div>';
    }

    /**
     * Analyze instruction content complexity to determine layout mode
     * Returns: 'compact' for two-column layout, 'expanded' for vertical stacked layout
     * 
     * Factors considered:
     * - Word count
     * - Paragraph count (detected by double newlines)
     * - List items count
     * - Code block presence in instructions
     * - Overall character length
     */
    analyzeContentComplexity(instructions) {
        if (!instructions || typeof instructions !== 'string') {
            return 'compact';
        }

        // Configuration thresholds (tunable for production)
        // These values are calibrated for typical task step instructions
        const THRESHOLDS = {
            maxWordsForCompact: 120,          // Max words for compact layout
            maxCharsForCompact: 700,          // Max characters for compact layout
            maxParagraphsForCompact: 4,       // Max paragraphs for compact layout
            maxListItemsForCompact: 8,        // Max list items for compact layout
            codeBlockForcesExpanded: true     // If instructions contain code blocks, use expanded
        };

        // Count words
        const wordCount = instructions.trim().split(/\s+/).filter(w => w.length > 0).length;

        // Count characters (excluding extra whitespace)
        const charCount = instructions.replace(/\s+/g, ' ').trim().length;

        // Count paragraphs (separated by double newlines or markdown paragraph breaks)
        const paragraphCount = instructions.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

        // Count list items (lines starting with -, *, or numbers)
        const listItemMatches = instructions.match(/^[\s]*[-*•]|\n[\s]*[-*•]|^[\s]*\d+\.|[\n][\s]*\d+\./gm);
        const listItemCount = listItemMatches ? listItemMatches.length : 0;

        // Check for inline code blocks in instructions (triple backticks)
        const hasCodeBlocks = /```[\s\S]*?```/.test(instructions);

        // Decision logic
        if (THRESHOLDS.codeBlockForcesExpanded && hasCodeBlocks) {
            return 'expanded';
        }

        if (wordCount > THRESHOLDS.maxWordsForCompact) {
            return 'expanded';
        }

        if (charCount > THRESHOLDS.maxCharsForCompact) {
            return 'expanded';
        }

        if (paragraphCount > THRESHOLDS.maxParagraphsForCompact) {
            return 'expanded';
        }

        if (listItemCount > THRESHOLDS.maxListItemsForCompact) {
            return 'expanded';
        }

        return 'compact';
    }

    /**
     * Render individual task step with adaptive layout
     * 
     * Layout modes:
     * - 'compact': Two-column layout (asset left, instructions right) - for short content
     * - 'expanded': Vertical stacked layout (asset centered + larger, instructions full-width below) - for long content
     * - No media: Always full-width instructions
     * 
     * Code block is always full-width at the end
     */
    renderLegacyTaskStep(step, taskId) {
        const stepId = `${taskId}-step-${step._idx}`;
        const isCompleted = window.learningPathState.completedTaskSteps.has(stepId);

        // Determine layout mode based on content complexity
        const layoutMode = step.hasMedia ? this.analyzeContentComplexity(step.instructions) : 'expanded';

        return `
            <div class="task-step bg-white rounded-3xl shadow-medium border border-gray-200 overflow-hidden" data-step="${step._idx}" data-layout="${layoutMode}">
                <!-- Step Header -->
                <div class="bg-gradient-to-r from-teal-50 via-purple-50 to-teal-50 px-8 py-6 border-b border-gray-200">
                    <div class="flex items-center space-x-4">
                        <div class="w-12 h-12 bg-gradient-to-br from-teal-400 to-purple-400 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-medium">
                            ${step.displayIndex}
                        </div>
                        <div class="flex-1">
                            <h4 class="text-xl font-bold text-gray-900">${step.title}</h4>
                            ${step.description ? `<p class="text-gray-600 mt-1">${step.description}</p>` : ''}
                        </div>
                        <div class="flex items-center space-x-3">
                            ${step.taskPage ? `
                            <button onclick="openTaskWorkspace('${step.taskPage.url}', '${stepId}')" class="text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-sm hover:shadow-md">
                                <i class="fas fa-external-link-alt mr-1"></i>
                                <span class="align-middle">Open Task Workspace</span>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Step Content -->
                <div class="p-8 bg-white">
                    ${step.hasMedia && layoutMode === 'compact' ?
                this.renderCompactLayout(step, stepId) :
                this.renderExpandedLayout(step, stepId)
            }

                    <!-- Code Block (always full width at the end) -->
                    ${step.code ? this.renderCodeBlock(step, stepId, step._idx) : ''}

                    <!-- Hint Section (if present) -->
                    ${step.hint ? this.renderHintSection(step, stepId, step._idx) : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render compact layout - Two-column: asset left, instructions right
     * Used when instructions are short/compact
     */
    renderCompactLayout(step, stepId) {
        return `
            <div class="task-step-compact-layout mb-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Left Column: Asset -->
                    <div class="task-step-asset-compact">
                        ${step.video ? this.renderVideoContent(step, stepId) : ''}
                        ${!step.video && step.hasAnyImage ? this.renderImageContent(step, stepId) : ''}
                    </div>

                    <!-- Right Column: Instructions -->
                    <div class="task-step-instructions-compact">
                        <h5 class="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                            <i class="fas fa-list-ol text-teal-500 mr-2"></i>
                            Instructions
                        </h5>
                        <div class="prose prose-lg max-w-none text-gray-700 leading-relaxed learning-content">
                            ${window.markdownRenderer && window.markdownRenderer.isReady ?
                window.markdownRenderer.render(step.instructions) :
                `<p>${step.instructions}</p>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render expanded layout - Vertical stacked: asset centered (larger), instructions full-width below
     * Used when instructions are long or no media present
     */
    renderExpandedLayout(step, stepId) {
        return `
            <div class="task-step-expanded-layout">
                ${step.hasMedia ? `
                <!-- Asset (centered, larger) -->
                <div class="task-step-asset-expanded mb-6">
                    ${step.video ? this.renderVideoContent(step, stepId) : ''}
                    ${!step.video && step.hasAnyImage ? this.renderImageContent(step, stepId) : ''}
                </div>
                ` : ''}

                <!-- Instructions (full width) -->
                <div class="task-step-instructions-expanded mb-6">
                    <h5 class="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <i class="fas fa-list-ol text-teal-500 mr-2"></i>
                        Instructions
                    </h5>
                    <div class="prose prose-lg max-w-none text-gray-700 leading-relaxed learning-content">
                        ${window.markdownRenderer && window.markdownRenderer.isReady ?
                window.markdownRenderer.render(step.instructions) :
                `<p>${step.instructions}</p>`}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render video content - for float-based layout
     */
    renderVideoContent(step, stepId) {
        return `
        <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-soft">
            <!-- Video Preview with Thumbnail -->
            <div class="relative group cursor-pointer" onclick="openVideoModal('${step.video.type}', '${step.video.src}', '${step.video.caption || ''}')">
                <!-- Video Thumbnail Container -->
                <div class="aspect-video bg-gray-900 rounded-xl overflow-hidden relative">
                    <!-- Local Video Preview -->
                    <video class="w-full h-full object-cover" muted preload="metadata">
                        <source src="${step.video.src}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>

                    <!-- Video Overlay Icon - Always visible with smooth animation -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-center justify-center">
                        <div class="video-play-btn bg-white/10 backdrop-blur-xl border border-white/40 rounded-full p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transform transition-all duration-500 group-hover:scale-110 group-hover:bg-white/20 group-hover:border-white/60">
                            <i class="fas fa-play text-white drop-shadow-lg text-xl ml-0.5 video-play-pulse"></i>
                        </div>
                    </div>
                </div>

                <!-- Video Caption -->
                ${step.video.caption ? `<p class="text-sm text-gray-600 mt-3 font-medium text-center">${step.video.caption}</p>` : ''}
            </div>
        </div>`;
    }

    /**
     * Helper to escape strings for embedding in JavaScript string literals (single-quoted)
     */
    escapeJsString(str) {
        if (!str) return '';
        return str
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/'/g, "\\'")    // Escape single quotes
            .replace(/"/g, '\\"')    // Escape double quotes
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r');  // Escape carriage returns
    }

    /**
     * Render image content with carousel support - for float-based layout
     * Now includes step instructions for the enhanced modal view
     * Uses Base64 encoding for instructions to handle special characters safely
     */
    renderImageContent(step, stepId) {
        // Base64 encode instructions for safe HTML attribute embedding
        // This handles all special characters including quotes, newlines, markdown code blocks, etc.
        let instructionsBase64 = '';
        try {
            if (step.instructions) {
                // Encode to Base64: first encode as UTF-8, then Base64
                instructionsBase64 = btoa(unescape(encodeURIComponent(step.instructions)));
            }
        } catch (e) {
            console.warn('Failed to encode instructions to Base64:', e);
        }

        if (step.hasMultipleImages) {
            // Escape images JSON for safe embedding in single-quoted attribute
            // Use HTML entity encoding for problematic characters
            const imagesJsonSafe = JSON.stringify(step.images)
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            return `
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-soft">
                <div class="relative" data-carousel="step" data-step-index="${stepId}" data-images='${imagesJsonSafe}' data-instructions-b64="${instructionsBase64}">
                    <div class="overflow-hidden rounded-xl">
                        <div class="task-step-carousel-container bg-white rounded-xl">
                            <div class="flex h-full w-full transition-transform duration-500" id="step-carousel-track-${stepId}">
                                ${step.images.map((img, idx) => `
                                <div class="w-full h-full flex-none flex items-center justify-center">
                                    <img src="${img.src}" alt="${this.escapeHtml(img.alt || '')}" class="w-full h-auto max-h-80 object-contain rounded-xl shadow-medium cursor-zoom-in" onclick="openCarouselImageModal('${stepId}', ${idx})">
                                </div>`).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center mt-3">
                        <button class="px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-soft text-gray-700 text-sm" data-step-index="${stepId}" onclick="prevStepImage(this.dataset.stepIndex)"><i class="fas fa-chevron-left mr-1"></i>Prev</button>
                        <div class="text-xs text-gray-500"><span id="step-carousel-indicator-${stepId}">1</span> / ${step.imagesLength}</div>
                        <button class="px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-soft text-gray-700 text-sm" data-step-index="${stepId}" onclick="nextStepImage(this.dataset.stepIndex)">Next<i class="fas fa-chevron-right ml-1"></i></button>
                    </div>
                </div>
            </div>`;
        } else {
            const img = step.image;
            // For single images, also use Base64 encoded instructions
            return `
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 shadow-soft">
                <img src="${img.src}" alt="${this.escapeHtml(img.alt || '')}" class="w-full h-auto rounded-xl shadow-medium transition-transform duration-300 hover:scale-105 cursor-zoom-in" onclick="openImageModalB64('${this.escapeJsString(img.src)}', '${this.escapeJsString(img.alt || '')}', '${instructionsBase64}')">
                ${img.caption ? `<p class="text-sm text-gray-600 mt-3 font-medium text-center">${img.caption}</p>` : ''}
            </div>`;
        }
    }

    /**
     * Escape HTML entities for safe display in code blocks
     */
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Map common language aliases to Prism.js language classes
     */
    mapLanguageToPrism(language) {
        if (!language) return 'text';

        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'python3': 'python',
            'sh': 'bash',
            'shell': 'bash',
            'zsh': 'bash',
            'yml': 'yaml',
            'html': 'markup',
            'xml': 'markup',
            'svg': 'markup',
            'text': 'none',
            'plaintext': 'none'
        };

        const lowerLang = language.toLowerCase().trim();
        return languageMap[lowerLang] || lowerLang;
    }

    /**
     * Render code block with Prism.js syntax highlighting
     */
    renderCodeBlock(step, stepId, stepIndex) {
        const isLongCode = step.code.content && step.code.content.length > 100;
        const language = this.mapLanguageToPrism(step.code.language);
        const escapedCode = this.escapeHtml(step.code.content);
        const displayLanguage = step.code.language || 'Code';

        return `
        <div class="code-block-container mb-6">
            <div class="flex items-center justify-between mb-3">
                <h5 class="text-lg font-semibold text-gray-900 flex items-center">
                    <i class="fas fa-code text-purple-500 mr-2"></i>
                    Code
                    <span class="ml-3 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-md uppercase">${displayLanguage}</span>
                </h5>
                <div class="flex space-x-2">
                    <button onclick="copyCodeFromStep('${stepId}')" class="copy-code-btn bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-1">
                        <i class="fas fa-copy"></i>
                        <span>Copy</span>
                    </button>
                    ${isLongCode ? `
                    <button onclick="openCodeModal('${stepId}')" class="open-code-modal-btn bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-1">
                        <i class="fas fa-expand"></i>
                        <span>Fullscreen</span>
                    </button>` : ''}
                </div>
            </div>
            <div class="relative code-block-wrapper">
                <pre class="rounded-xl shadow-medium overflow-x-auto" style="max-height: calc(16rem + 50px);"><code id="task-step-${stepId}" class="language-${language}" data-language="${displayLanguage}">${escapedCode}</code></pre>
            </div>
        </div>`;
    }

    /**
     * Render hint section - extracted from topic-template.html
     */
    renderHintSection(step, stepId, stepIndex) {
        return `
        <div class="mt-8 pt-6 border-t border-gray-200">
            <button onclick="revealStepHintFromTask('${stepId}')"
                    data-step-index="${stepId}"
                    class="step-hint-btn group bg-gradient-to-r from-teal-500 to-purple-500 hover:from-teal-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center space-x-2">
                <i class="fas fa-lightbulb text-sm group-hover:animate-pulse"></i>
                <span>Reveal Hint</span>
            </button>

            <div id="step-hint-${stepId}" class="step-hint-content hidden mt-4 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                <div class="bg-gradient-to-r from-teal-500 to-purple-500 px-4 py-2">
                    <h6 class="text-white font-semibold flex items-center">
                        <i class="fas fa-lightbulb mr-2"></i>
                        Hint
                    </h6>
                </div>
                <div class="p-6">
                    <!-- Hint Text -->
                    ${step.hint.text ? `
                    <div class="text-gray-700 leading-relaxed mb-6 prose prose-lg max-w-none learning-content">
                        ${window.markdownRenderer && window.markdownRenderer.isReady ?
                    window.markdownRenderer.render(step.hint.text) :
                    `<p>${step.hint.text}</p>`}
                    </div>` : ''}

                    <!-- Hint Image(s) -->
                    ${step.hintHasMultipleImages ? this.renderHintCarousel(step.hint, stepId) : ''}
                    ${step.hintImagesLength === 1 && step.hint.image ? this.renderHintImage(step.hint.image) : ''}

                    <!-- Hint Code (if present) -->
                    ${step.hint.code ? this.renderHintCode(step.hint, stepId) : ''}
                </div>
            </div>
        </div>`;
    }

    /**
     * Render hint image - extracted from topic-template.html
     */
    renderHintImage(image) {
        return `
        <div class="mb-4">
            <div class="h-80 bg-gray-100 rounded-xl flex items-center justify-center">
                <img src="${image.src}" alt="${image.alt}" class="w-full h-full object-contain cursor-zoom-in rounded-lg shadow-lg transition-transform duration-300 hover:scale-105" onclick="openImageModal('${image.src}', '${image.alt}')">
            </div>
            ${image.caption ? `<p class="text-sm text-amber-600 mt-3 font-medium text-center">${image.caption}</p>` : ''}
        </div>`;
    }

    /**
     * Render hint carousel - extracted from topic-template.html
     */
    renderHintCarousel(hint, stepId) {
        return `
        <div class="mb-4">
            <div class="relative" data-carousel="hint" data-step-index="${stepId}">
                <div class="overflow-hidden rounded-xl">
                    <div class="h-80 bg-gray-100 rounded-xl">
                        <div class="flex h-full w-full transition-transform duration-500" id="hint-carousel-track-${stepId}">
                            ${hint.images.map(img => `
                            <div class="w-full h-full flex-none flex items-center justify-center">
                                <img src="${img.src}" alt="${img.alt}" class="w-full h-full object-contain cursor-zoom-in rounded-lg transition-transform duration-300 hover:scale-105" onclick="openImageModal('${img.src}', '${img.alt}')">
                            </div>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-3">
                    <button class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors duration-200 shadow-sm hover:shadow-md" data-step-index="${stepId}" onclick="prevHintImage(this.dataset.stepIndex)"><i class="fas fa-chevron-left mr-1"></i>Previous</button>
                    <div class="text-sm text-amber-700 font-medium"><span id="hint-carousel-indicator-${stepId}">1</span> of ${hint.images.length}</div>
                    <button class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors duration-200 shadow-sm hover:shadow-md" data-step-index="${stepId}" onclick="nextHintImage(this.dataset.stepIndex)">Next<i class="fas fa-chevron-right ml-1"></i></button>
                </div>
            </div>
        </div>`;
    }

    /**
     * Render hint code - extracted from topic-template.html
     */
    renderHintCode(hint, stepId) {
        return `
        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <h6 class="text-sm font-semibold text-gray-700">Code Example:</h6>
                <button onclick="copyHintCodeFromStep('${stepId}')" class="copy-hint-code-btn bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200 flex items-center space-x-1">
                    <i class="fas fa-copy text-xs"></i>
                    <span>Copy</span>
                </button>
            </div>
            <div class="bg-gray-900 rounded-lg p-4 shadow-medium overflow-x-auto">
                <pre style="color: #f9fafb; margin: 0;"><code id="hint-code-${stepId}" class="language-${hint.code.language || 'text'}" style="background: transparent; color: inherit; padding: 0; font-size: 0.875rem; line-height: 1.5;">${hint.code.content}</code></pre>
            </div>
        </div>`;
    }

    /**
     * Helper functions for task step interactions - extracted from topic-template.html
     */
    copyCodeFromStep(stepIndex) {
        const codeElement = document.getElementById(`task-step-${stepIndex}`);
        if (codeElement) {
            navigator.clipboard.writeText(codeElement.textContent).then(() => {
                console.log('Code copied to clipboard');
                // Show feedback
                const copyBtn = document.querySelector(`button[onclick="copyCodeFromStep('${stepIndex}')"]`);
                if (copyBtn) {
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy code: ', err);
            });
        }
    }

    revealStepHintFromTask(stepIndex) {
        console.log('revealStepHintFromTask called with stepIndex:', stepIndex);

        const hintContent = document.getElementById(`step-hint-${stepIndex}`);
        const button = document.querySelector(`[data-step-index="${stepIndex}"].step-hint-btn`);

        console.log('Found hintContent:', !!hintContent);
        console.log('Found button:', !!button);

        if (hintContent) {
            console.log('Hint content classes before:', hintContent.className);
            console.log('Hint content style display before:', hintContent.style.display);
            console.log('Hint content offsetParent:', hintContent.offsetParent);
        }

        if (hintContent && button) {
            // Force remove hidden class and set display
            hintContent.classList.remove('hidden');
            hintContent.style.display = 'block';
            button.style.display = 'none';

            console.log('Hint content classes after:', hintContent.className);
            console.log('Hint content style display after:', hintContent.style.display);

        } else {
            console.warn('Hint elements not found for stepIndex:', stepIndex);
            console.warn('Looking for element ID: step-hint-' + stepIndex);
            // Try alternative selectors
            const allHintContents = document.querySelectorAll('[id^="step-hint-"]');
            const allButtons = document.querySelectorAll('.step-hint-btn');
            console.log('Available hint contents:', Array.from(allHintContents).map(el => el.id));
            console.log('Available hint buttons:', Array.from(allButtons).map(el => el.dataset.stepIndex));
        }
    }

    copyHintCodeFromStep(stepIndex) {
        const codeElement = document.getElementById(`hint-code-${stepIndex}`);
        if (codeElement) {
            navigator.clipboard.writeText(codeElement.textContent).then(() => {
                console.log('Hint code copied to clipboard');
                // Show feedback
                const copyBtn = document.querySelector(`button[onclick="copyHintCodeFromStep('${stepIndex}')"]`);
                if (copyBtn) {
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check text-xs"></i><span>Copied!</span>';
                    copyBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                    copyBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');

                    // Revert after 2 seconds
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                        copyBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                        copyBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy hint code: ', err);
            });
        }
    }

    toggleHint(hintId) {
        const hintContent = document.getElementById(hintId);
        if (hintContent) {
            hintContent.classList.toggle('hidden');
        }
    }

    openTaskWorkspace(url, stepId) {
        console.log('openTaskWorkspace called with URL:', url, 'stepId:', stepId);

        // Extract step index from stepId (format: "taskId-step-X")
        const stepIndexMatch = stepId.match(/step-(\d+)$/);
        const stepIndex = stepIndexMatch ? parseInt(stepIndexMatch[1]) : stepId;

        console.log('Extracted stepIndex:', stepIndex);

        // Try to use the existing split screen system
        if (window.openSplitScreen && typeof window.openSplitScreen === 'function') {
            console.log('Using split screen system');
            const taskPageObject = { url: url };
            window.openSplitScreen(taskPageObject, stepIndex);
        } else {
            console.log('Split screen not available, opening in new window');
            // Fallback: open in new window
            window.open(url, '_blank', 'width=1200,height=800');
        }
    }

    openCodeModal(stepIndex) {
        const codeElement = document.querySelector(`#task-step-${stepIndex}`);
        if (codeElement) {
            const code = codeElement.textContent;
            const language = codeElement.className.replace('language-', '');

            // Use the existing code modal
            const modal = document.getElementById('codeModal');
            const codeContent = document.getElementById('modalCodeContent');

            if (modal && codeContent) {
                // Set the code content
                codeContent.textContent = code;
                codeContent.className = `language-${language}`;

                // Show modal
                modal.classList.remove('hidden');
                modal.classList.add('flex');

            }
        }
    }

    closeCodeModal() {
        const modal = document.getElementById('codeModal');
        const codeContent = document.getElementById('modalCodeContent');

        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        if (codeContent) {
            codeContent.textContent = '';
            codeContent.className = 'language-';
        }
    }

    copyModalCode() {
        const codeContent = document.getElementById('modalCodeContent');
        if (codeContent) {
            navigator.clipboard.writeText(codeContent.textContent).then(() => {
                console.log('Code copied to clipboard');
                // Optionally show a toast or change button text temporarily
                const copyBtn = document.getElementById('modalCopyBtn');
                if (copyBtn) {
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                    }, 2000);
                }
            });
        }
    }

    /**
     * Task step completion handler - extracted from topic-template.html
     */
    markTaskStepCompleted(stepId, taskId) {
        if (!window.learningPathState.completedTaskSteps.has(stepId)) {
            window.learningPathState.completedTaskSteps.add(stepId);

            // Save state and re-render
            if (typeof saveLearningPathState === 'function') {
                saveLearningPathState();
            }

            // Dispatch event for sidebar synchronization
            document.dispatchEvent(new CustomEvent('taskStepCompleted', {
                detail: { stepId, taskId }
            }));

            console.log(`✅ Task step ${stepId} completed`);
        }
    }

    /**
     * Initialize dynamic components after task rendering
     */
    initializeImageCarousels() {
        // Initialize step image carousels
        document.querySelectorAll('[data-carousel="step"]').forEach(carousel => {
            const stepIndex = carousel.dataset.stepIndex;
            if (!this.activeCarousels.has(stepIndex)) {
                this.activeCarousels.set(stepIndex, {
                    currentImage: 0,
                    totalImages: carousel.querySelectorAll('#' + stepIndex + '-carousel-track img').length
                });
                this.updateCarouselIndicator(stepIndex, 'step');
            }
        });

        // Initialize hint image carousels
        document.querySelectorAll('[data-carousel="hint"]').forEach(carousel => {
            const stepIndex = carousel.dataset.stepIndex;
            const hintKey = `${stepIndex}-hint`;
            if (!this.activeCarousels.has(hintKey)) {
                this.activeCarousels.set(hintKey, {
                    currentImage: 0,
                    totalImages: carousel.querySelectorAll('#hint-carousel-track-' + stepIndex + ' img').length
                });
                this.updateCarouselIndicator(stepIndex, 'hint');
            }
        });
    }

    updateCarouselIndicator(stepIndex, type) {
        const carousel = this.activeCarousels.get(type === 'hint' ? `${stepIndex}-hint` : stepIndex);
        if (carousel) {
            const indicatorId = type === 'hint' ? `hint-carousel-indicator-${stepIndex}` : `step-carousel-indicator-${stepIndex}`;
            const indicator = document.getElementById(indicatorId);
            if (indicator) {
                indicator.textContent = carousel.currentImage + 1;
            }
        }
    }

    initializeVideoPlayers() {
        // Initialize video players with proper controls
        document.querySelectorAll('.task-video video').forEach(video => {
            // Add video initialization logic if needed
            video.addEventListener('loadedmetadata', () => {
                console.log('Video loaded:', video.src);
            });
        });
    }


    /**
     * Setup event listeners for dynamic task elements
     */
    setupTaskEventListeners(task) {
        // This method can be used to set up any additional event listeners
        // needed for task functionality
        console.log('Setting up event listeners for task:', task.id);
    }

    /**
     * Get the global task number based on task position in all tasks array
     */
    getGlobalTaskNumber(taskId) {
        if (!window.templateData || !window.templateData.tasks) {
            return 1;
        }

        for (let i = 0; i < window.templateData.tasks.length; i++) {
            if (window.templateData.tasks[i].id === taskId) {
                return i + 1;
            }
        }
        return 1;
    }

    initializeTaskUploadState(taskId) {
    }
}

// Make available globally
window.taskRenderer = new TaskRenderer();

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskRenderer;
}

function handleTaskCompletion(taskId) {
    if (!taskId) return;

    if (window.learningPathState.completedTasks &&
        window.learningPathState.completedTasks.has(taskId)) {
        return;
    }

    if (window.markTaskCompleted) {
        var success = window.markTaskCompleted(taskId);

        if (success) {
            var button = document.getElementById('task-complete-btn-' + taskId);
            if (button) {
                button.innerHTML = '<i class="fas fa-check-circle text-lg"></i><span>Completed!</span>';
                button.classList.remove('from-green-500', 'to-emerald-500', 'hover:from-green-600', 'hover:to-emerald-600');
                button.classList.add('from-green-600', 'to-emerald-600', 'cursor-default');
                button.disabled = true;
                button.onclick = null;

                setTimeout(function() {
                    var completionSection = button.closest('.mt-10');
                    if (completionSection) {
                        completionSection.innerHTML = '<div class="flex items-center justify-center">'
                            + '<div class="flex items-center space-x-3 bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-4 rounded-2xl border-2 border-green-200 shadow-sm">'
                            + '<div class="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">'
                            + '<i class="fas fa-check text-white text-lg"></i></div>'
                            + '<span class="text-lg font-semibold text-green-700">Task Completed</span>'
                            + '</div></div>';
                    }
                }, 800);
            }
        }
    }
}

window.handleTaskCompletion = handleTaskCompletion;

function openTaskPip(taskId) {
    if (!window.pipManager) return;

    var steps = [];
    if (window.pipStepsRegistry && window.pipStepsRegistry[taskId]) {
        steps = window.pipStepsRegistry[taskId];
    }

    if (steps.length === 0) return;

    window.pipManager.createPip(taskId, steps, 0, {
        userInitiated: true,
        source: 'task-renderer'
    });
}

window.openTaskPip = openTaskPip;
