class NotesUI {
    constructor() {
        this.isOpen = false;
        this.isExpanded = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 0, y: 0 };
        this.currentSectionInfo = null;
        this.currentContent = '';
        this.hasUnsavedChanges = false;
        this.autoSaveTimer = null;
        this.autoSaveDelay = 2000;
        this.saveStatus = 'idle';
        this.windowEl = null;
        this.textareaEl = null;
        this.statusDotEl = null;
        this.statusTextEl = null;
        this.charCountEl = null;
        this.sectionLabelEl = null;
        this.triggerButtonEl = null;
        this.triggerDotEl = null;
        this.tabContainerEl = null;
        this.initialized = false;
        this.focusedBeforeOpen = null;
        this.triggerObserver = null;
        this.triggerElementObserver = null;
    }

    initialize() {
        if (this.initialized) return;

        this.restorePosition();
        this.restoreMode();
        this.createWindowDOM();
        this.createFloatingButton();
        this.bindEvents();

        if (window.notesService) {
            window.notesService.setupConnectivityListeners();
        }

        this.initialized = true;
        console.log('NotesUI: initialized');
    }

    createWindowDOM() {
        if (this.windowEl) return;

        const win = document.createElement('div');
        win.className = `notes-floating-window compact notes-hidden`;
        win.id = 'notes-floating-window';
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-label', 'Session Notes');
        win.setAttribute('aria-hidden', 'true');
        win.style.left = `${this.position.x}px`;
        win.style.top = `${this.position.y}px`;

        win.innerHTML = `
            <div class="notes-title-bar" id="notes-title-bar">
                <div class="notes-title-left">
                    <i class="fas fa-sticky-note notes-title-icon" aria-hidden="true"></i>
                    <span class="notes-title-text">My Notes</span>
                    <span class="notes-section-label" id="notes-section-label"></span>
                </div>
                <div class="notes-title-right">
                    <button class="notes-btn-icon" id="notes-toggle-size-btn" title="Expand" aria-label="Expand notes window">
                        <i class="fas fa-expand-alt" aria-hidden="true"></i>
                    </button>
                    <button class="notes-btn-icon" id="notes-close-btn" title="Close (Esc)" aria-label="Close notes window">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
            <div class="notes-section-tabs" id="notes-section-tabs" role="tablist" aria-label="Note sections"></div>
            <div class="notes-content-area">
                <textarea class="notes-textarea" id="notes-textarea"
                    placeholder="Add notes for this section..."
                    spellcheck="true"
                    aria-label="Note content"
                    maxlength="15000"></textarea>
            </div>
            <div class="notes-footer">
                <div class="notes-footer-left">
                    <span class="notes-status-dot saved" id="notes-status-dot" aria-hidden="true"></span>
                    <span class="notes-status-text" id="notes-status-text">Ready</span>
                </div>
                <span class="notes-char-count" id="notes-char-count" aria-live="polite">0/15k</span>
                <div class="notes-footer-right">
                    <button class="notes-footer-btn notes-export-btn" id="notes-export-btn" aria-label="Export all notes as PDF">
                        <i class="fas fa-file-pdf" aria-hidden="true"></i> Export
                    </button>
                    <button class="notes-footer-btn notes-delete-btn" id="notes-delete-btn" aria-label="Clear current section notes">
                        <i class="fas fa-trash-alt" aria-hidden="true"></i> Clear
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(win);

        this.windowEl = win;
        this.textareaEl = win.querySelector('#notes-textarea');
        this.statusDotEl = win.querySelector('#notes-status-dot');
        this.statusTextEl = win.querySelector('#notes-status-text');
        this.charCountEl = win.querySelector('#notes-char-count');
        this.sectionLabelEl = win.querySelector('#notes-section-label');
        this.tabContainerEl = win.querySelector('#notes-section-tabs');

        win.querySelector('#notes-close-btn').addEventListener('click', () => this.close());
        win.querySelector('#notes-toggle-size-btn').addEventListener('click', () => this.toggleSize());
        win.querySelector('#notes-export-btn').addEventListener('click', () => this.exportPDF());
        win.querySelector('#notes-delete-btn').addEventListener('click', () => this.confirmClearSection());
        this.textareaEl.addEventListener('input', () => this.onTextareaInput());
    }

    createFloatingButton() {
        const existingBtn = document.getElementById('notes-fab-btn');
        if (existingBtn) {
            existingBtn.addEventListener('click', () => this.toggle());
            existingBtn.setAttribute('aria-label', 'Toggle notes window (Ctrl+Shift+N)');
            this.triggerButtonEl = existingBtn;
            this.triggerDotEl = document.getElementById('notes-fab-dot');
            this.updateFloatingButtonPosition();
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'notes-fab-btn';
        btn.className = 'notes-fab-btn';
        btn.title = 'My Notes (Ctrl+Shift+N)';
        btn.setAttribute('aria-label', 'Toggle notes window (Ctrl+Shift+N)');
        btn.innerHTML = `
            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
            <span class="notes-fab-dot" id="notes-fab-dot"></span>
        `;
        btn.addEventListener('click', () => this.toggle());

        document.body.appendChild(btn);

        this.triggerButtonEl = btn;
        this.triggerDotEl = document.getElementById('notes-fab-dot');
        this.updateFloatingButtonPosition();
    }

    bindEvents() {
        const titleBar = this.windowEl.querySelector('#notes-title-bar');

        titleBar.addEventListener('mousedown', (e) => this.onDragStart(e));
        document.addEventListener('mousemove', (e) => this.onDragMove(e));
        document.addEventListener('mouseup', () => this.onDragEnd());

        titleBar.addEventListener('touchstart', (e) => this.onDragStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.onDragMove(e), { passive: false });
        document.addEventListener('touchend', () => this.onDragEnd());

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                this.toggle();
                return;
            }

            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
                return;
            }

            if (this.isOpen && e.key === 'Tab') {
                this.trapFocus(e);
            }
        });

        document.addEventListener('pageChanged', (e) => this.onPageChanged(e));
        document.addEventListener('paginationPageChanged', (e) => this.onPageChanged(e));

        document.addEventListener('notesConnectivityChanged', (e) => {
            if (!e.detail.online) {
                this.setStatus('offline');
            } else if (this.saveStatus === 'offline' || this.saveStatus === 'error') {
                this.setStatus('saving');
                this.saveNow();
            }
        });

        document.addEventListener('notesSaveRetried', (e) => {
            if (e.detail.success) {
                this.hasUnsavedChanges = false;
                this.setStatus('saved');
            }
        });

        window.addEventListener('resize', () => {
            this.updateFloatingButtonPosition();
            if (this.isOpen) {
                this.clampPosition();
            }
        });

        window.addEventListener('chatOpened', () => this.updateFloatingButtonPosition());
        window.addEventListener('chatClosed', () => this.updateFloatingButtonPosition());

        this.setupFloatingTriggerObservers();

        window.addEventListener('beforeunload', () => {
            if (this.hasUnsavedChanges) {
                this.saveNow();
            }
        });
    }

    trapFocus(e) {
        const focusableSelectors = 'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusable = Array.from(this.windowEl.querySelectorAll(focusableSelectors));
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    async loadInitialContent() {
        if (!window.notesService) return;

        try {
            await window.notesService.loadNote();
            const content = window.notesService.getContent();

            this.detectCurrentSection();
            this.loadSectionIntoTextarea();
            this.updateCharCount();
            this.updateTriggerDot(content);
            this.updateFloatingButtonPosition();

            console.log('NotesUI: initial content loaded');
        } catch (error) {
            console.warn('NotesUI: failed to load initial content:', error);
        }
    }

    detectCurrentSection() {
        let pageType = null;
        let pageId = null;

        if (window.paginationSystem) {
            const currentPage = window.paginationSystem.currentPageIndex;
            const pages = window.paginationSystem.getAllPages();

            if (pages[currentPage]) {
                const page = pages[currentPage];
                pageType = page.type;
                pageId = page.id;
            }
        }

        if (!pageType && window.learningPathState) {
            const currentId = window.learningPathState.currentPage;
            if (currentId) {
                pageId = currentId;
                if (currentId === 'introduction') {
                    pageType = 'introduction';
                } else if (currentId === 'final-quiz') {
                    pageType = 'final-quiz';
                } else if (currentId.includes('-Task')) {
                    pageType = 'task';
                } else {
                    pageType = 'sub-concept';
                }
            }
        }

        if (!pageType) {
            pageType = 'introduction';
            pageId = 'introduction';
        }

        this.currentSectionInfo = window.notesService.getSectionKey(pageType, pageId);

        if (this.currentSectionInfo) {
            const content = window.notesService.getContent();
            window.notesService.ensureSectionExists(content, this.currentSectionInfo);
        }
    }

    loadSectionIntoTextarea() {
        if (!this.textareaEl || !window.notesService || !this.currentSectionInfo) return;

        const content = window.notesService.getContent();
        this.currentContent = window.notesService.getSectionContent(content, this.currentSectionInfo) || '';
        this.textareaEl.value = this.currentContent;
        this.hasUnsavedChanges = false;

        this.updateSectionLabel();
        this.updatePlaceholder();
        this.updateSectionTabs();
    }

    updateSectionLabel() {
        if (!this.sectionLabelEl || !this.currentSectionInfo) return;

        const label = this.findSectionLabel(this.currentSectionInfo);
        this.sectionLabelEl.textContent = label ? `| ${label}` : '';
    }

    findSectionLabel(sectionInfo) {
        if (!sectionInfo) return '';
        const sections = window.notesService ? window.notesService.getAllSectionLabels() : [];
        const match = sections.find(s => s.group === sectionInfo.group && s.key === sectionInfo.key);
        if (!match) return '';

        if (match.group === 'concepts') {
            const conceptMatch = String(match.compactLabel || '').match(/^C-(\d+(?:\.\d+)?)$/);
            return conceptMatch ? `${conceptMatch[1]} ${match.label}` : match.label;
        }

        if (match.group === 'tasks') {
            const taskMatch = String(match.compactLabel || '').match(/^Task-(\d+)$/);
            return taskMatch ? `Task-${taskMatch[1]} ${match.label}` : match.label;
        }

        return match.label;
    }

    updatePlaceholder() {
        if (!this.textareaEl || !this.currentSectionInfo) return;

        const { group } = this.currentSectionInfo;
        const placeholders = {
            'introduction': 'Add notes about the introduction...',
            'concepts': 'Add notes about this concept...',
            'tasks': 'Add notes about this task...',
            'final-quiz': 'Add revision notes for the assessment...'
        };

        this.textareaEl.placeholder = placeholders[group] || 'Add notes...';
    }

    findPageTitle(pageId, fallback) {
        try {
            const topicConfig = window.topicConfig || window.templateData?.content || {};

            if (topicConfig.concepts) {
                for (const c of topicConfig.concepts) {
                    if (c.sub_concepts) {
                        for (const sc of c.sub_concepts) {
                            if (sc.id === pageId) return sc.title || fallback;
                        }
                    }
                    if (c.id === pageId) return c.title || fallback;
                }
            }

            if (topicConfig.tasks) {
                for (const t of topicConfig.tasks) {
                    if (t.id === pageId) return t.title || fallback;
                }
            }
        } catch (e) {
        }

        return fallback;
    }

    updateSectionTabs() {
        this.tabContainerEl.innerHTML = '';
        this.tabContainerEl.setAttribute('aria-hidden', 'true');
    }

    switchToSection(sectionInfo) {
        if (this.hasUnsavedChanges) {
            this.saveCurrentSection();
        }

        this.currentSectionInfo = sectionInfo;
        this.loadSectionIntoTextarea();
        this.updateCharCount();

        if (this.textareaEl) {
            this.textareaEl.focus();
        }
    }

    onTextareaInput() {
        if (!this.textareaEl) return;

        this.currentContent = this.textareaEl.value;
        this.hasUnsavedChanges = true;

        const content = window.notesService.getContent();
        window.notesService.setSectionContent(content, this.currentSectionInfo, this.currentContent);

        this.updateCharCount();

        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => this.saveNow(), this.autoSaveDelay);

        this.setStatus('saving');
    }

    updateCharCount() {
        if (!this.charCountEl || !window.notesService) return;

        const content = window.notesService.getContent();
        const serializedLen = window.notesService.getSerializedLength(content);
        const formatted = window.notesService.formatCharCount(serializedLen);

        this.charCountEl.textContent = formatted;
        this.charCountEl.classList.remove('warning', 'danger');

        if (serializedLen > 14000) {
            this.charCountEl.classList.add('danger');
        } else if (serializedLen > 10000) {
            this.charCountEl.classList.add('warning');
        }
    }

    async saveCurrentSection() {
        if (!window.notesService || !this.currentSectionInfo) return;

        const content = window.notesService.getContent();
        window.notesService.setSectionContent(content, this.currentSectionInfo, this.currentContent);
        window.notesService.saveLocalCache(content);
    }

    async saveNow() {
        if (!window.notesService) return;

        this.setStatus('saving');

        try {
            const content = window.notesService.getContent();
            window.notesService.setSectionContent(content, this.currentSectionInfo, this.currentContent);

            await window.notesService.saveNote(content);

            this.hasUnsavedChanges = false;
            this.setStatus('saved');
            this.updateTriggerDot(content);
            this.updateSectionTabs();
        } catch (error) {
            if (!window.navigator.onLine) {
                this.setStatus('offline');
            } else {
                this.setStatus('error');
            }
        }
    }

    setStatus(status) {
        this.saveStatus = status;

        if (!this.statusDotEl || !this.statusTextEl) return;

        this.statusDotEl.className = 'notes-status-dot';

        const states = {
            saving: { cls: 'saving', text: 'Saving...' },
            saved: { cls: 'saved', text: 'Saved' },
            error: { cls: 'error', text: 'Error - will retry' },
            offline: { cls: 'offline', text: 'Saved locally' },
            idle: { cls: 'saved', text: 'Ready' }
        };

        const state = states[status] || states.idle;
        this.statusDotEl.classList.add(state.cls);
        this.statusTextEl.textContent = state.text;

        this.statusTextEl.setAttribute('aria-label', `Notes save status: ${state.text}`);
    }

    updateTriggerDot(content) {
        if (!this.triggerDotEl || !window.notesService) return;

        if (!content) {
            content = window.notesService.getContent();
        }

        const hasAny = window.notesService.getSectionsWithContent().length > 0;

        if (hasAny) {
            this.triggerDotEl.classList.add('has-note');
        } else {
            this.triggerDotEl.classList.remove('has-note');
        }
    }

    isFloatingTriggerVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0;
    }

    setupFloatingTriggerObservers() {
        if (this.triggerObserver || !document.body) return;

        this.triggerObserver = new MutationObserver(() => {
            this.refreshFloatingTriggerObservers();
            this.updateFloatingButtonPosition();
        });

        this.triggerObserver.observe(document.body, {
            childList: true
        });

        this.refreshFloatingTriggerObservers();
    }

    refreshFloatingTriggerObservers() {
        if (this.triggerElementObserver) {
            this.triggerElementObserver.disconnect();
        }

        this.triggerElementObserver = new MutationObserver(() => this.updateFloatingButtonPosition());

        ['.chat-trigger', '#pip-floating-trigger'].forEach((selector) => {
            const element = document.querySelector(selector);
            if (!element) return;

            this.triggerElementObserver.observe(element, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        });
    }

    updateFloatingButtonPosition() {
        if (!this.triggerButtonEl) return;

        const defaultBottom = 20;
        const gap = 14;
        const step = 52 + gap;
        const pipTrigger = document.querySelector('#pip-floating-trigger');
        const chatTrigger = document.querySelector('.chat-trigger');
        const chatOpen = document.body.classList.contains('chat-open');
        const pipVisible = this.isFloatingTriggerVisible(pipTrigger);
        const chatVisible = this.isFloatingTriggerVisible(chatTrigger) && !chatOpen;

        let occupiedSlots = 0;

        if (pipTrigger) {
            pipTrigger.style.bottom = `${defaultBottom}px`;
        }

        if (pipVisible) {
            occupiedSlots += 1;
        }

        if (chatTrigger) {
            const chatBottom = defaultBottom + (pipVisible ? step : 0);
            chatTrigger.style.bottom = `${chatBottom}px`;
        }

        if (chatVisible) {
            occupiedSlots += 1;
        }

        this.triggerButtonEl.style.bottom = `${defaultBottom + occupiedSlots * step}px`;
    }

    onPageChanged(event) {
        if (!this.initialized || !window.notesService) return;

        if (this.hasUnsavedChanges) {
            this.saveCurrentSection();
        }

        this.detectCurrentSection();
        this.loadSectionIntoTextarea();
        this.updateCharCount();
        this.updateFloatingButtonPosition();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (!this.windowEl) return;

        if (!this.initialized) {
            this.initialize();
        }

        this.focusedBeforeOpen = document.activeElement;

        this.detectCurrentSection();
        this.loadSectionIntoTextarea();
        this.updateCharCount();

        this.windowEl.classList.remove('notes-hidden');
        this.windowEl.classList.add('notes-visible');
        this.windowEl.setAttribute('aria-hidden', 'false');
        this.isOpen = true;

        if (this.triggerButtonEl) this.triggerButtonEl.classList.add('active');

        this.clampPosition();

        setTimeout(() => {
            if (this.textareaEl) this.textareaEl.focus();
        }, 250);
    }

    close() {
        if (!this.windowEl) return;

        if (this.hasUnsavedChanges) {
            this.saveCurrentSection();
            this.saveNow();
        }

        this.windowEl.classList.remove('notes-visible');
        this.windowEl.classList.add('notes-hidden');
        this.windowEl.setAttribute('aria-hidden', 'true');
        this.isOpen = false;

        if (this.triggerButtonEl) this.triggerButtonEl.classList.remove('active');

        this.savePosition();

        if (this.focusedBeforeOpen && typeof this.focusedBeforeOpen.focus === 'function') {
            try {
                this.focusedBeforeOpen.focus();
            } catch (e) {
            }
        }
        this.focusedBeforeOpen = null;
    }

    toggleSize() {
        const btn = this.windowEl.querySelector('#notes-toggle-size-btn');

        if (this.isExpanded) {
            this.windowEl.classList.remove('expanded');
            this.windowEl.classList.add('compact');
            this.isExpanded = false;
            if (btn) {
                btn.innerHTML = '<i class="fas fa-expand-alt" aria-hidden="true"></i>';
                btn.title = 'Expand';
                btn.setAttribute('aria-label', 'Expand notes window');
            }
        } else {
            this.windowEl.classList.remove('compact');
            this.windowEl.classList.add('expanded');
            this.isExpanded = true;
            if (btn) {
                btn.innerHTML = '<i class="fas fa-compress-alt" aria-hidden="true"></i>';
                btn.title = 'Compact';
                btn.setAttribute('aria-label', 'Compact notes window');
            }
        }

        this.saveMode();
        this.clampPosition();
    }

    onDragStart(e) {
        if (e.target.closest('button')) return;

        this.isDragging = true;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = this.windowEl.getBoundingClientRect();

        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;

        if (e.touches) {
            e.preventDefault();
        }
    }

    onDragMove(e) {
        if (!this.isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const newX = clientX - this.dragOffset.x;
        const newY = clientY - this.dragOffset.y;

        this.position.x = newX;
        this.position.y = newY;

        this.windowEl.style.left = `${newX}px`;
        this.windowEl.style.top = `${newY}px`;

        if (e.touches) {
            e.preventDefault();
        }
    }

    onDragEnd() {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.clampPosition();
        this.savePosition();
    }

    clampPosition() {
        if (!this.windowEl) return;

        const rect = this.windowEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let x = this.position.x;
        let y = this.position.y;

        if (x + rect.width > vw) x = vw - rect.width - 10;
        if (y + rect.height > vh) y = vh - rect.height - 10;
        if (x < 0) x = 10;
        if (y < 0) y = 10;

        this.position.x = x;
        this.position.y = y;
        this.windowEl.style.left = `${x}px`;
        this.windowEl.style.top = `${y}px`;
    }

    savePosition() {
        try {
            localStorage.setItem('scorm_notes_position', JSON.stringify(this.position));
        } catch (e) {
        }
    }

    restorePosition() {
        try {
            const saved = localStorage.getItem('scorm_notes_position');
            if (saved) {
                this.position = JSON.parse(saved);
                return;
            }
        } catch (e) {
        }

        this.position = {
            x: Math.max(10, window.innerWidth - 360),
            y: 80
        };
    }

    saveMode() {
        try {
            localStorage.setItem('scorm_notes_mode', this.isExpanded ? 'expanded' : 'compact');
        } catch (e) {
        }
    }

    restoreMode() {
        try {
            const mode = localStorage.getItem('scorm_notes_mode');
            this.isExpanded = mode === 'expanded';
        } catch (e) {
            this.isExpanded = false;
        }
    }

    confirmClearSection() {
        if (!this.currentSectionInfo) return;

        const sectionLabel = this.sectionLabelEl?.textContent?.replace('| ', '') || 'this section';

        const overlay = document.createElement('div');
        overlay.className = 'notes-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-label', 'Confirm clear notes');
        overlay.innerHTML = `
            <div class="notes-confirm-dialog">
                <div class="notes-confirm-title">Clear Notes</div>
                <div class="notes-confirm-message">
                    Are you sure you want to clear notes for <strong>${sectionLabel}</strong>? This cannot be undone.
                </div>
                <div class="notes-confirm-actions">
                    <button class="notes-confirm-cancel" id="notes-confirm-cancel">Cancel</button>
                    <button class="notes-confirm-confirm" id="notes-confirm-confirm">Clear</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add('visible'));

        const cancelBtn = overlay.querySelector('#notes-confirm-cancel');
        const confirmBtn = overlay.querySelector('#notes-confirm-confirm');

        cancelBtn.focus();

        const cleanup = () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 200);
        };

        cancelBtn.addEventListener('click', () => {
            cleanup();
            if (this.textareaEl) this.textareaEl.focus();
        });

        confirmBtn.addEventListener('click', async () => {
            const content = window.notesService.getContent();
            window.notesService.deleteSection(content, this.currentSectionInfo);
            this.currentContent = '';
            this.textareaEl.value = '';
            this.hasUnsavedChanges = false;

            cleanup();

            this.updateCharCount();
            await this.saveNow();
            if (this.textareaEl) this.textareaEl.focus();
        });

        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cleanup();
                if (this.textareaEl) this.textareaEl.focus();
            }
        });
    }

    async exportPDF() {
        if (!window.notesService) return false;

        const sections = window.notesService.getSectionsWithContent();
        if (sections.length === 0) {
            alert('No notes to export yet.');
            return false;
        }

        try {
            if (typeof window.jspdf === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });

            const PRIMARY = [74, 155, 142];
            const SECONDARY = [107, 76, 147];

            const topicTitle = window.templateData?.title || window.topicConfig?.title || 'My Notes';
            const learnerName = window.notesService.getLearnerName() || '';
            const dateStr = new Date().toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            const pw = doc.internal.pageSize.getWidth();
            const ph = doc.internal.pageSize.getHeight();
            const marginTop = 20;
            const marginBottom = 20;
            const marginLeft = 20;
            const marginRight = 20;
            const contentX = marginLeft + 14;
            const contentW = pw - contentX - marginRight;
            const topY = 28;
            const bottomY = ph - marginBottom - 8;

            let logoData = null;
            let logoIconData = null;
            try {
                logoData = await this.loadLogoAsBase64();
            } catch (e) {
                console.warn('NotesUI: Could not load logo for PDF:', e);
            }

            try {
                logoIconData = await this.loadImageAssetAsBase64('assets/logo-icon.png');
            } catch (e) {
                console.warn('NotesUI: Could not load logo icon for PDF:', e);
            }

            const description = window.templateData?.description ||
                                window.topicConfig?.description || '';
            const sectionsWithContent = window.notesService.getSectionsWithContent().length;

            this.drawCoverPage(doc, {
                topicTitle, learnerName, dateStr,
                logoData, PRIMARY, SECONDARY, pw, ph,
                sectionsWithContent, description
            });

            doc.addPage();
            this.drawNotebookPageBackground(doc, {
                pw, ph, contentX, contentW, topY, bottomY, PRIMARY
            });

            const allSections = window.notesService.getAllSectionLabels();
            const noteContent = window.notesService.getContent();
            let y = topY;

            for (const section of allSections) {
                const text = window.notesService.getSectionContent(noteContent, section);
                if (!text || !text.trim()) continue;

                const headerH = 10;
                if (y + headerH + 8 > bottomY) {
                    doc.addPage();
                    this.drawNotebookPageBackground(doc, {
                        pw, ph, contentX, contentW, topY, bottomY, PRIMARY
                    });
                    y = topY;
                }

                this.drawSectionHeader(doc, {
                    y, section, contentX, contentW, PRIMARY, SECONDARY
                });
                y += headerH + 3;

                const lines = doc.splitTextToSize(text.trim(), contentW - 4);
                const lineH = 6;
                let lineIdx = 0;

                while (lineIdx < lines.length) {
                    const availableH = bottomY - y;
                    const maxLines = Math.floor(availableH / lineH);
                    const chunkSize = Math.min(maxLines, lines.length - lineIdx);

                    if (chunkSize <= 0) {
                        doc.addPage();
                        this.drawNotebookPageBackground(doc, {
                            pw, ph, contentX, contentW, topY, bottomY, PRIMARY
                        });
                        y = topY;
                        continue;
                    }

                    const chunkLines = lines.slice(lineIdx, lineIdx + chunkSize);
                    doc.setFontSize(10.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(55, 55, 55);

                    let textY = y + 4.7;
                    for (const line of chunkLines) {
                        doc.text(line, contentX + 2, textY);
                        textY += lineH;
                    }

                    y += chunkLines.length * lineH + 4;
                    lineIdx += chunkSize;

                    if (lineIdx < lines.length) {
                        doc.addPage();
                        this.drawNotebookPageBackground(doc, {
                            pw, ph, contentX, contentW, topY, bottomY, PRIMARY
                        });
                        y = topY;
                    }
                }
            }

            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 2; i <= totalPages; i++) {
                doc.setPage(i);

                doc.setDrawColor(210, 216, 220);
                doc.setLineWidth(0.35);
                doc.line(contentX, 16, pw - marginRight, 16);

                doc.setFontSize(8);
                doc.setTextColor(125, 125, 125);
                doc.setFont('helvetica', 'normal');
                doc.text(topicTitle, contentX, 11);

                if (logoIconData) {
                    try {
                        doc.addImage(logoIconData.dataUrl, 'PNG', pw - marginRight - 10, 4.5, 10, 10);
                    } catch (e) {}
                }

                doc.setDrawColor(210, 216, 220);
                doc.line(contentX, ph - 15, pw - marginRight, ph - 15);

                doc.setFontSize(8);
                doc.setTextColor(125, 125, 125);
                doc.text(
                    `Page ${i - 1} of ${totalPages - 1}`,
                    pw - marginRight,
                    ph - 9,
                    { align: 'right' }
                );

                if (learnerName) {
                    doc.text(`${learnerName} - Personal Notes`, contentX, ph - 9);
                }
            }

            doc.setProperties({
                title: `${topicTitle} - Personal Notes`,
                subject: `Training course notes${learnerName ? ` for ${learnerName}` : ''}`,
                author: 'Nebula KnowLab',
                keywords: 'training, course, notes, personal notes',
                creator: 'SCORM Builder'
            });

            const filename = `${topicTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Notes.pdf`;
            doc.save(filename);
            return true;

        } catch (error) {
            console.error('NotesUI: PDF export failed:', error);
            alert('Failed to export PDF. Please try again.');
            return false;
        }
    }

    async loadImageAssetAsBase64(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const maxW = 600;
                    const scale = maxW / img.width;
                    canvas.width = maxW;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve({
                        dataUrl: canvas.toDataURL('image/png'),
                        aspectRatio: img.width / img.height
                    });
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = () => reject(new Error('Logo load failed'));
            img.src = src;
        });
    }

    async loadLogoAsBase64() {
        return this.loadImageAssetAsBase64('assets/logo.png');
    }

    drawCoverPage(doc, opts) {
        const {
            topicTitle, learnerName, dateStr,
            logoData, PRIMARY, SECONDARY, pw, ph,
            sectionsWithContent, description
        } = opts;

        doc.setFillColor(252, 249, 242);
        doc.rect(0, 0, pw, ph, 'F');

        let y = 62;

        if (logoData) {
            try {
                const maxLogoW = 70;
                const maxLogoH = 30;
                let logoW, logoH;
                if (logoData.aspectRatio >= 1) {
                    logoW = maxLogoW;
                    logoH = maxLogoW / logoData.aspectRatio;
                    if (logoH > maxLogoH) {
                        logoH = maxLogoH;
                        logoW = maxLogoH * logoData.aspectRatio;
                    }
                } else {
                    logoH = maxLogoH;
                    logoW = maxLogoH * logoData.aspectRatio;
                    if (logoW > maxLogoW) {
                        logoW = maxLogoW;
                        logoH = maxLogoW / logoData.aspectRatio;
                    }
                }
                doc.addImage(logoData.dataUrl, 'PNG', (pw - logoW) / 2, y, logoW, logoH);
                y += logoH + 22;
            } catch (e) {
                y += 22;
            }
        }

        doc.setFont('times', 'bold');
        doc.setFontSize(28);
        doc.setTextColor(...PRIMARY);
        doc.text('My Learning Notes', pw / 2, y, { align: 'center' });
        y += 11;

        doc.setFont('times', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text(topicTitle, pw / 2, y, { align: 'center' });
        y += 9;

        if (description) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(110, 110, 110);
            const descLines = doc.splitTextToSize(description, pw - 80);
            for (let i = 0; i < Math.min(descLines.length, 2); i++) {
                doc.text(descLines[i], pw / 2, y, { align: 'center' });
                y += 5;
            }
        }

        y += 4;
        doc.setDrawColor(198, 220, 216);
        doc.setLineWidth(0.45);
        const lineW = 40;
        doc.line((pw - lineW) / 2, y, (pw + lineW) / 2, y);
        y += 12;

        if (learnerName) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text('Notes by', pw / 2, y, { align: 'center' });
            y += 8;
            doc.setFontSize(14);
            doc.setFont('times', 'bold');
            doc.setTextColor(...SECONDARY);
            doc.text(learnerName, pw / 2, y, { align: 'center' });
            y += 10;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140, 140, 140);
        doc.text(dateStr, pw / 2, y, { align: 'center' });
        y += 26;

        if (sectionsWithContent > 0) {
            if (y > ph - 50) {
                // skip if too low
            } else {
                const statsY = Math.max(y + 2, ph - 50);
                doc.setFillColor(243, 239, 231);
                const pillW = 60;
                const pillH = 10;
                doc.roundedRect((pw - pillW) / 2, statsY, pillW, pillH, 5, 5, 'F');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...SECONDARY);
                doc.text(
                    `${sectionsWithContent} sections with notes`,
                    pw / 2, statsY + 6.5,
                    { align: 'center' }
                );
            }
        }

        doc.setDrawColor(210, 216, 220);
        doc.setLineWidth(0.35);
        doc.line(28, ph - 22, pw - 28, ph - 22);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text('Nebula KnowLab', pw / 2, ph - 12, { align: 'center' });
    }

    drawSectionHeader(doc, opts) {
        const { y, section, contentX, contentW, PRIMARY } = opts;
        const heading = this.formatPDFSectionHeading(section);

        doc.setFont('times', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(42, 42, 42);
        doc.text(heading, contentX, y + 6, { maxWidth: contentW });

        const underlineY = y + 8.5;
        const underlineW = Math.min(contentW, Math.max(26, doc.getTextWidth(heading) + 2));
        doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.setLineWidth(0.35);
        doc.line(contentX, underlineY, contentX + underlineW, underlineY);
    }

    drawNotebookPageBackground(doc, opts) {
        const { pw, ph, contentX, contentW, topY, bottomY, PRIMARY } = opts;

        doc.setFillColor(252, 249, 242);
        doc.rect(0, 0, pw, ph, 'F');

        doc.setDrawColor(227, 231, 236);
        doc.setLineWidth(0.2);
        for (let y = topY + 12; y <= bottomY; y += 6) {
            doc.line(contentX, y, contentX + contentW, y);
        }

        doc.setDrawColor(198, 220, 216);
        doc.setLineWidth(0.35);
        doc.line(contentX - 8, topY, contentX - 8, bottomY);

        doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.setLineWidth(0.18);
        doc.line(contentX, 20, contentX + contentW, 20);
    }

    formatPDFSectionHeading(section) {
        if (!section) return '';

        if (section.group === 'introduction') {
            return 'Introduction';
        }

        if (section.group === 'final-quiz') {
            return 'Assessment';
        }

        if (section.group === 'concepts') {
            const match = String(section.compactLabel || '').match(/^C-(\d+(?:\.\d+)?)$/);
            if (match) {
                return `${match[1]} ${section.label}`;
            }
            return section.label;
        }

        if (section.group === 'tasks') {
            const match = String(section.compactLabel || '').match(/^Task-(\d+)$/);
            if (match) {
                return `Task ${match[1]} - ${section.label}`;
            }
            return `Task - ${section.label}`;
        }

        return section.label || '';
    }
}

window.notesUI = new NotesUI();
