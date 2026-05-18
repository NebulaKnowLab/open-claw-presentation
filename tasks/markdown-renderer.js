/**
 * MARKED.JS v5 IMPLEMENTATION - SIMPLE, RELIABLE, NO FRILLS
 * Replaces complex custom parser with mature, stable markdown library
 */
class MarkdownRenderer {
    constructor() {
        this.initialized = true;
        this.isReady = true;
        this.markedConfigured = false;

        // Wait for marked to be available (CDN loading)
        this.initializeWhenMarkedReady();
    }

    initializeWhenMarkedReady() {
        if (typeof marked !== 'undefined') {
            this.setupMarked();
        } else {
            // Poll for marked to be available
            const checkInterval = setInterval(() => {
                if (typeof marked !== 'undefined') {
                    clearInterval(checkInterval);
                    this.setupMarked();
                }
            }, 100);

            // Fail after 5 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (typeof marked === 'undefined') {
                    console.error('Marked.js failed to load from CDN');
                }
            }, 5000);
        }
    }

    setupMarked() {
        try {
            if (this.markedConfigured) {
                return;
            }

            const renderer = new marked.Renderer();
            const defaultLinkRenderer = renderer.link.bind(renderer);

            renderer.link = (href, title, text) => {
                const linkHref = typeof href === 'string' ? href : '';
                const renderedLink = defaultLinkRenderer(href, title, text);

                if (!this.isExternalUrl(linkHref)) {
                    return renderedLink;
                }

                return this.addLinkAttributes(renderedLink);
            };

            // Configure marked ONCE with simple settings
            marked.setOptions({
                gfm: true,           // GitHub Flavored Markdown
                tables: true,        // Enable tables
                breaks: true,        // Line breaks
                pedantic: false,     // Not strict
                sanitize: false,     // Allow HTML (we control input)
                smartLists: true,    // Smart list handling
                smartypants: false,  // Disable smart quotes to avoid issues
                renderer
            });

            this.markedConfigured = true;

            console.log('Marked.js v5 renderer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Marked.js:', error);
        }
    }

    render(content) {
        // ALWAYS ensure string - prevents "[object Object]"
        if (content === null || content === undefined) {
            content = '';
        } else if (typeof content !== 'string') {
            console.warn('MarkdownRenderer: content is not a string, converting:', typeof content);
            content = String(content || '');
        }

        // Check if marked is available
        if (typeof marked === 'undefined') {
            console.error('Marked.js not loaded, returning plain content');
            return `<div class="plain-content">${this.escapeHtml(content)}</div>`;
        }

        try {
            // Simple, direct rendering
            return marked.parse(content);
        } catch (error) {
            console.error('Markdown rendering error:', error);
            // Fallback: basic HTML conversion
            return `<div class="error-content">
                <p class="text-red-600 font-semibold">Markdown rendering error</p>
                <pre class="text-sm text-gray-600 mt-2">${this.escapeHtml(content.substring(0, 200))}</pre>
            </div>`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    isExternalUrl(url) {
        return /^https?:\/\//i.test((url || '').trim());
    }

    addLinkAttributes(html) {
        if (!html || !html.includes('<a ')) {
            return html;
        }

        let updatedHtml = html;

        if (!/\btarget=/i.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace('<a ', '<a target="_blank" ');
        }

        if (/\brel=/i.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace(/rel="([^"]*)"/i, (match, relValue) => {
                const parts = relValue.split(/\s+/).filter(Boolean);

                if (!parts.includes('noopener')) {
                    parts.push('noopener');
                }

                if (!parts.includes('noreferrer')) {
                    parts.push('noreferrer');
                }

                return `rel="${parts.join(' ')}"`;
            });
        } else {
            updatedHtml = updatedHtml.replace('<a ', '<a rel="noopener noreferrer" ');
        }

        return updatedHtml;
    }

    getStatus() {
        return {
            initialized: this.initialized,
            ready: this.isReady && typeof marked !== 'undefined',
            parser: 'Marked.js v5',
            features: ['gfm', 'tables', 'breaks', 'smartLists'],
            cdnVersion: '5.1.2'
        };
    }
}

// Create global instance
window.markdownRenderer = new MarkdownRenderer();

console.log('MarkdownRenderer module loaded - waiting for Marked.js CDN...');
