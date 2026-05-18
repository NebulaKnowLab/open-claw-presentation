/**
 * Space Visualizer Manager - Global Singleton for Shared WebGL Context
 * 
 * This manager ensures only ONE WebGL context is used across the entire application.
 * It transfers the SpaceVisualizer between components (audio player / voice widget)
 * instead of creating/destroying separate contexts.
 * 
 * Browsers limit WebGL contexts to ~16 per page, and context creation/destruction
 * is slow and unreliable. This singleton pattern avoids those issues.
 */

class SpaceVisualizerManager {
    constructor() {
        // Singleton instance
        if (SpaceVisualizerManager.instance) {
            return SpaceVisualizerManager.instance;
        }
        SpaceVisualizerManager.instance = this;

        // The single shared SpaceVisualizer instance
        this.visualizer = null;

        // Current owner component
        this.currentOwner = null;

        // Canvas currently being used
        this.currentCanvas = null;

        // Configuration
        this.defaultOptions = {
            logoPath: 'voice-widget/logo.png',
            theme: 'dark'
        };

        console.log('🌌 SpaceVisualizerManager: Singleton initialized');
    }

    /**
     * Get or create the shared SpaceVisualizer for a component
     * @param {HTMLCanvasElement} canvas - The canvas to render to
     * @param {Object} options - Visualizer options
     * @param {string} ownerId - Unique ID of the requesting component
     * @returns {SpaceVisualizer|null} - The shared visualizer or null if WebGL not available
     */
    acquire(canvas, options = {}, ownerId = 'unknown') {
        console.log(`🌌 SpaceVisualizerManager: Acquiring visualizer for ${ownerId}`);

        // Check if Three.js is available
        if (typeof THREE === 'undefined' || typeof SpaceVisualizer === 'undefined') {
            console.warn('🌌 SpaceVisualizerManager: Three.js or SpaceVisualizer not available');
            return null;
        }

        // If we already have a visualizer
        if (this.visualizer) {
            // If same owner is re-acquiring, just return it
            if (this.currentOwner === ownerId && this.currentCanvas === canvas) {
                console.log(`🌌 SpaceVisualizerManager: Same owner ${ownerId} re-acquiring, returning existing`);
                return this.visualizer;
            }

            // Transfer to new canvas/owner
            console.log(`🌌 SpaceVisualizerManager: Transferring from ${this.currentOwner} to ${ownerId}`);
            this.transferToCanvas(canvas);
            this.currentOwner = ownerId;
            this.currentCanvas = canvas;

            return this.visualizer;
        }

        // Create new visualizer (first time only)
        console.log(`🌌 SpaceVisualizerManager: Creating new SpaceVisualizer for ${ownerId}`);
        try {
            const mergedOptions = { ...this.defaultOptions, ...options };
            this.visualizer = new SpaceVisualizer(canvas, mergedOptions);
            this.currentOwner = ownerId;
            this.currentCanvas = canvas;

            // Check if initialization failed
            if (this.visualizer.initFailed) {
                console.error('🌌 SpaceVisualizerManager: SpaceVisualizer initialization failed');
                this.visualizer = null;
                return null;
            }

            return this.visualizer;
        } catch (error) {
            console.error('🌌 SpaceVisualizerManager: Failed to create SpaceVisualizer:', error);
            return null;
        }
    }

    /**
     * Transfer the visualizer to a new canvas
     * This is the key to sharing a single WebGL context between components
     */
    transferToCanvas(newCanvas) {
        if (!this.visualizer || !this.visualizer.renderer) {
            console.warn('🌌 SpaceVisualizerManager: No visualizer to transfer');
            return;
        }

        console.log('🌌 SpaceVisualizerManager: Transferring renderer to new canvas');

        // Stop current animation
        this.visualizer.stopAnimation();

        // CRITICAL: Clear audio analyzers from previous component
        // This disconnects the old component's audio sources, stopping ripples
        if (typeof this.visualizer.clearAudioAnalyzers === 'function') {
            this.visualizer.clearAudioAnalyzers();
        } else {
            // Fallback if method doesn't exist
            this.visualizer.inputLevel = 0;
            this.visualizer.outputLevel = 0;
            this.visualizer.inputAnalyser = null;
            this.visualizer.outputAnalyser = null;
            console.log('🌌 SpaceVisualizerManager: Cleared audio analyzers manually');
        }

        // Get the renderer's canvas element
        const rendererCanvas = this.visualizer.renderer.domElement;

        // Copy the WebGL canvas content to the new canvas position
        // We need to update the renderer to use the new canvas dimensions
        const rect = newCanvas.getBoundingClientRect();

        // Get the parent of the new canvas and insert the renderer's canvas
        if (newCanvas.parentNode) {
            // Hide the original canvas (we'll use the renderer's canvas)
            newCanvas.style.display = 'none';

            // Style the renderer's canvas to match the target
            rendererCanvas.style.position = 'absolute';
            rendererCanvas.style.top = '0';
            rendererCanvas.style.left = '0';
            rendererCanvas.style.width = '100%';
            rendererCanvas.style.height = '100%';
            rendererCanvas.style.background = '#000000';

            // If renderer canvas is not already in this parent, move it
            if (rendererCanvas.parentNode !== newCanvas.parentNode) {
                newCanvas.parentNode.insertBefore(rendererCanvas, newCanvas);
            }
        }

        // Update renderer size for new canvas dimensions
        this.visualizer.renderer.setSize(rect.width, rect.height);

        // Update camera aspect ratio
        if (this.visualizer.camera) {
            this.visualizer.camera.aspect = rect.width / rect.height;
            this.visualizer.camera.updateProjectionMatrix();
        }

        // Restart animation
        this.visualizer.startAnimation();
    }

    /**
     * Release the visualizer from a component (doesn't destroy it)
     * @param {string} ownerId - ID of the component releasing
     */
    release(ownerId) {
        if (this.currentOwner === ownerId) {
            console.log(`🌌 SpaceVisualizerManager: Releasing visualizer from ${ownerId}`);
            // Don't destroy, just mark as unowned
            // The visualizer stays alive for the next component to use
            this.currentOwner = null;

            // Stop animation while unused
            if (this.visualizer) {
                this.visualizer.stopAnimation();
            }
        }
    }

    /**
     * Get the current visualizer (without acquiring ownership)
     */
    getVisualizer() {
        return this.visualizer;
    }

    /**
     * Check if a visualizer exists
     */
    hasVisualizer() {
        return this.visualizer !== null && !this.visualizer.initFailed;
    }

    /**
     * Get audio level methods for external audio analysis
     */
    setInputLevel(level) {
        if (this.visualizer) {
            this.visualizer.inputLevel = level;
        }
    }

    setOutputLevel(level) {
        if (this.visualizer) {
            this.visualizer.outputLevel = level;
        }
    }

    /**
     * Completely destroy the visualizer (only call when leaving page)
     */
    destroy() {
        if (this.visualizer) {
            console.log('🌌 SpaceVisualizerManager: Destroying shared visualizer');
            this.visualizer.destroy();
            this.visualizer = null;
            this.currentOwner = null;
            this.currentCanvas = null;
        }
    }
}

// Create global singleton instance
window.SpaceVisualizerManager = new SpaceVisualizerManager();

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpaceVisualizerManager;
}
