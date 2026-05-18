/**
 * Audio Visualizer for Voice Bot
 * Creates animated visual effects based on audio input/output
 * Automatically delegates to SpaceVisualizer (3D) when Three.js is available
 */

class Visualizer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isAnimating = false;
        this.animationId = null;

        // 3D Space Visualizer delegate (when Three.js is available)
        this.spaceVisualizer = null;
        this.use3D = false;

        // Audio nodes for analysis
        this.inputAnalyser = null;
        this.outputAnalyser = null;

        // Configuration
        this.options = {
            logoPath: './logo.png', // Default logo path
            theme: 'light', // Default theme
            backgroundColor: '#ffffff',
            inputColor: 'rgba(72, 145, 167, 0.8)', // Teal
            outputColors: [
                'rgba(72, 145, 167, 0.8)',   // Teal
                'rgba(139, 69, 116, 0.8)',   // Purple
                'rgba(177, 102, 88, 0.8)',   // Coral/red
                'rgba(128, 128, 128, 0.8)'   // Gray
            ],
            rotationSpeed: 8, // seconds for full rotation
            ...options
        };

        // Apply theme-specific settings
        if (this.options.theme === 'dark') {
            console.log('🎨 Visualizer applying dark theme with black background');
            this.options.backgroundColor = '#000000';
            // Adjust colors for dark theme
            this.options.inputColor = 'rgba(100, 181, 246, 0.8)'; // Lighter teal for dark theme
            this.options.outputColors = [
                'rgba(100, 181, 246, 0.8)',   // Light teal
                'rgba(186, 104, 200, 0.8)',   // Light purple
                'rgba(255, 167, 38, 0.8)',    // Light orange
                'rgba(158, 158, 158, 0.8)'    // Light gray
            ];
        } else {
            console.log('🎨 Visualizer applying light theme');
        }

        // State
        this.logoImage = null;
        this.logoLoaded = false;
        this.inputLevel = 0;
        this.outputLevel = 0;
        this.stars = []; // For 2D space background animation

        // Event emitter
        this.events = window.VoiceBotUtils.EventUtils.createEmitter();

        this.init();
    }

    async init() {
        try {
            console.log('Initializing visualizer...');

            // Check if Three.js and SpaceVisualizer are available
            if (this.canUse3D()) {
                console.log('🌌 Three.js detected! Attempting 3D Space Visualizer');
                await this.initSpaceVisualizer();

                // Check if SpaceVisualizer actually initialized successfully
                if (this.spaceVisualizer && !this.spaceVisualizer.initFailed) {
                    console.log('🌌 3D Space Visualizer initialized successfully');
                } else {
                    console.log('📊 3D failed, falling back to 2D Canvas Visualizer');
                    this.use3D = false;
                    this.spaceVisualizer = null;
                    this.setupCanvas();
                    await this.loadLogo();
                    this.startAnimation();
                }
            } else {
                console.log('📊 Using 2D Canvas Visualizer (Three.js not available)');
                this.setupCanvas();
                await this.loadLogo();
                this.startAnimation();
            }

            console.log('Visualizer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize visualizer:', error);
            // Fallback to 2D if 3D fails
            if (this.use3D) {
                console.log('📊 Exception caught, falling back to 2D visualizer...');
                this.use3D = false;
                this.spaceVisualizer = null;
                this.setupCanvas();
                await this.loadLogo();
            }
            this.startAnimation();
        }
    }

    /**
     * Check if Three.js, SpaceVisualizer, and Manager are available
     */
    canUse3D() {
        return typeof THREE !== 'undefined' &&
            typeof SpaceVisualizer !== 'undefined' &&
            window.SpaceVisualizerManager;
    }

    /**
     * Initialize the 3D Space Visualizer using the shared manager
     */
    async initSpaceVisualizer() {
        this.use3D = true;

        return new Promise((resolve) => {
            try {
                // Use the global SpaceVisualizerManager to get/acquire the shared visualizer
                const manager = window.SpaceVisualizerManager;

                this.spaceVisualizer = manager.acquire(this.canvas, {
                    logoPath: this.options.logoPath,
                    theme: this.options.theme
                }, 'voice-widget');

                // If manager couldn't acquire visualizer
                if (!this.spaceVisualizer) {
                    console.warn('🌌 Visualizer: SpaceVisualizerManager returned null');
                    this.use3D = false;
                    resolve();
                    return;
                }

                // Forward events from space visualizer
                this.spaceVisualizer.on('logoLoaded', () => {
                    this.logoLoaded = true;
                    this.events.emit('logoLoaded');
                });

                this.spaceVisualizer.on('error', (error) => {
                    console.warn('🌌 SpaceVisualizer error received:', error);
                    this.events.emit('error', error);
                    // Mark as failed and fall back
                    this.use3D = false;
                    resolve();
                });

                this.spaceVisualizer.on('destroyed', () => {
                    this.events.emit('destroyed');
                });

                console.log('🌌 Visualizer: Acquired shared SpaceVisualizer successfully');
                resolve();

            } catch (error) {
                console.error('🌌 SpaceVisualizer acquisition failed:', error);
                this.use3D = false;
                this.spaceVisualizer = null;
                resolve();
            }
        });
    }

    setupCanvas() {
        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = this.canvas.getBoundingClientRect();

            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;

            this.ctx.scale(dpr, dpr);

            console.log('Canvas resized:', {
                width: this.canvas.width,
                height: this.canvas.height,
                dpr: dpr
            });
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }

    async loadLogo() {
        // Skip logo loading if logoPath is null or undefined
        if (!this.options.logoPath) {
            console.log('Logo loading skipped - no logo path provided');
            this.logoLoaded = false;
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            console.log('Attempting to load logo from:', this.options.logoPath);
            this.logoImage = new Image();

            // For Google Cloud Storage, we need to handle CORS properly
            // Try without crossOrigin first for GCS URLs with auth tokens
            if (this.options.logoPath.includes('storage.cloud.google.com')) {
                console.log('Detected Google Cloud Storage URL - loading without crossOrigin attribute');
                // Don't set crossOrigin for GCS URLs with auth tokens
            } else {
                this.logoImage.crossOrigin = 'anonymous';
            }

            this.logoImage.onload = () => {
                console.log('Logo loaded successfully');
                this.logoLoaded = true;
                this.events.emit('logoLoaded');
                resolve();
            };

            this.logoImage.onerror = (error) => {
                console.warn('Failed to load logo - continuing without logo');
                console.warn('Logo path attempted:', this.options.logoPath);
                console.warn('Error details:', error);

                // Try fallback without crossOrigin if first attempt failed
                if (this.options.logoPath.includes('storage.cloud.google.com') && this.logoImage.crossOrigin === 'anonymous') {
                    console.log('Retrying logo loading without crossOrigin for GCS URL');
                    this.logoImage.crossOrigin = null;
                    this.logoImage.src = this.options.logoPath;
                    return;
                }

                this.logoLoaded = false;
                this.events.emit('logoError', error);
                resolve(); // Don't reject, just continue without logo
            };

            this.logoImage.src = this.options.logoPath;
        });
    }

    setInputAudioNode(node) {
        // Delegate to 3D visualizer if active
        if (this.use3D && this.spaceVisualizer) {
            this.spaceVisualizer.setInputAudioNode(node);
            return;
        }

        if (node && node.context) {
            this.inputAnalyser = node.context.createAnalyser();
            this.inputAnalyser.fftSize = 256;
            this.inputAnalyser.smoothingTimeConstant = 0.85;

            try {
                node.connect(this.inputAnalyser);
            } catch (error) {
                console.warn('Could not connect input analyser:', error);
            }
        }
    }

    setOutputAudioNode(node) {
        // Delegate to 3D visualizer if active
        if (this.use3D && this.spaceVisualizer) {
            this.spaceVisualizer.setOutputAudioNode(node);
            return;
        }

        if (node && node.context) {
            this.outputAnalyser = node.context.createAnalyser();
            this.outputAnalyser.fftSize = 256;
            this.outputAnalyser.smoothingTimeConstant = 0.85;

            try {
                node.connect(this.outputAnalyser);
            } catch (error) {
                console.warn('Could not connect output analyser:', error);
            }
        }
    }

    startAnimation() {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.animate();
    }

    stopAnimation() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animate() {
        if (!this.isAnimating) return;

        this.animationId = requestAnimationFrame(() => this.animate());
        this.draw();
    }

    draw() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        // Clear canvas with space-themed background
        this.drawSpaceBackground(width, height);

        // Update audio levels
        this.updateAudioLevels();

        // Draw visualization
        if (this.logoLoaded && this.logoImage.complete) {
            this.drawLogo(width, height);
        } else {
            this.drawPlaceholder(width, height);
        }

        // Draw effects if audio is active
        if (this.inputLevel > 0.05 || this.outputLevel > 0.05) {
            this.drawAudioEffects(width, height);
        }
    }

    /**
     * Draw space-themed background with gradient and stars (2D fallback)
     */
    drawSpaceBackground(width, height) {
        // Create space gradient background
        const gradient = this.ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) * 0.7
        );
        gradient.addColorStop(0, '#0a0a1a');  // Dark center
        gradient.addColorStop(0.5, '#050510'); // Darker
        gradient.addColorStop(1, '#000000');   // Black edge

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);

        // Initialize stars if not already done
        if (!this.stars || this.stars.length === 0) {
            this.stars = [];
            for (let i = 0; i < 80; i++) {
                this.stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: 0.5 + Math.random() * 2,
                    brightness: 0.3 + Math.random() * 0.7,
                    twinkleSpeed: 0.01 + Math.random() * 0.03,
                    twinkleOffset: Math.random() * Math.PI * 2
                });
            }
        }

        // Draw twinkling stars
        const time = Date.now() * 0.001;
        this.stars.forEach(star => {
            const twinkle = Math.sin(time * star.twinkleSpeed * 10 + star.twinkleOffset) * 0.3 + 0.7;
            const alpha = star.brightness * twinkle;

            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Add subtle nebula glow in center
        const nebulaGradient = this.ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.min(width, height) * 0.4
        );
        nebulaGradient.addColorStop(0, 'rgba(107, 76, 147, 0.08)');
        nebulaGradient.addColorStop(0.5, 'rgba(72, 145, 167, 0.04)');
        nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = nebulaGradient;
        this.ctx.fillRect(0, 0, width, height);
    }

    updateAudioLevels() {
        // Update input level
        if (this.inputAnalyser) {
            const inputData = new Uint8Array(this.inputAnalyser.frequencyBinCount);
            this.inputAnalyser.getByteFrequencyData(inputData);
            const inputAverage = inputData.reduce((sum, val) => sum + val, 0) / inputData.length;
            this.inputLevel = inputAverage / 255; // Normalize to 0-1
        }

        // Update output level
        if (this.outputAnalyser) {
            const outputData = new Uint8Array(this.outputAnalyser.frequencyBinCount);
            this.outputAnalyser.getByteFrequencyData(outputData);
            const outputAverage = outputData.reduce((sum, val) => sum + val, 0) / outputData.length;
            this.outputLevel = outputAverage / 255; // Normalize to 0-1
        }

        // Log audio levels for debugging
        if (this.inputLevel > 0.05 || this.outputLevel > 0.05) {
            console.log('Audio levels detected:', {
                input: this.inputLevel.toFixed(3),
                output: this.outputLevel.toFixed(3),
                hasInputAnalyser: !!this.inputAnalyser,
                hasOutputAnalyser: !!this.outputAnalyser
            });
        }
    }

    drawLogo(width, height) {
        // Calculate logo size and position (centered, preserve aspect ratio)
        const maxLogoSize = Math.min(width, height) * 0.55; // Logo takes 55% of smallest dimension
        const imgAspect = this.logoImage.width / this.logoImage.height;
        let logoWidth = maxLogoSize;
        let logoHeight = maxLogoSize;

        if (imgAspect > 1) {
            // Wider than tall
            logoHeight = maxLogoSize / imgAspect;
        } else {
            // Taller than wide or square
            logoWidth = maxLogoSize * imgAspect;
        }

        const logoX = (width - logoWidth) / 2;
        const logoY = (height - logoHeight) / 2;

        // Calculate rotation angle
        const now = Date.now();
        const rotation = ((now % (this.options.rotationSpeed * 1000)) / (this.options.rotationSpeed * 1000)) * Math.PI * 2;

        // Apply glow effects and rotation
        this.ctx.save();
        this.ctx.translate(logoX + logoWidth / 2, logoY + logoHeight / 2);
        this.ctx.rotate(rotation);
        this.ctx.translate(-logoWidth / 2, -logoHeight / 2);

        const isUserSpeaking = this.inputLevel > 0.05;
        const isBotSpeaking = this.outputLevel > 0.05;

        if (isUserSpeaking || isBotSpeaking) {
            const glowIntensity = isUserSpeaking ? this.inputLevel : this.outputLevel;
            const glowRadius = 30 + glowIntensity * 50;

            // Create multiple layers of glow for better effect
            for (let i = 0; i < 3; i++) {
                this.ctx.shadowBlur = glowRadius * (3 - i);
                this.ctx.shadowColor = this.getGlowColor(isUserSpeaking, isBotSpeaking, glowIntensity * (1 - i * 0.2));

                // Draw the logo
                this.ctx.drawImage(this.logoImage, 0, 0, logoWidth, logoHeight);
            }
        } else {
            // No glow - just draw the logo normally
            this.ctx.drawImage(this.logoImage, 0, 0, logoWidth, logoHeight);
        }

        this.ctx.restore();

        // Add pulsing ring effect when speaking
        if (isUserSpeaking || isBotSpeaking) {
            const level = isUserSpeaking ? this.inputLevel : this.outputLevel;
            this.drawPulsingRing(width, height, maxLogoSize, level, isUserSpeaking, isBotSpeaking);
        }
    }

    drawPulsingRing(width, height, logoSize, level, isUserSpeaking, isBotSpeaking) {
        const time = Date.now() * 0.001;
        const pulse = Math.sin(time * 3) * 0.5 + 0.5;

        this.ctx.save();
        this.ctx.strokeStyle = this.getGlowColor(isUserSpeaking, isBotSpeaking, level * pulse * 0.5);
        this.ctx.lineWidth = 3 + level * 5;
        this.ctx.beginPath();
        this.ctx.arc(
            width / 2,
            height / 2,
            logoSize / 2 + 20 + level * 30,
            0,
            Math.PI * 2
        );
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawPlaceholder(width, height) {
        this.ctx.save();

        const isDarkTheme = this.options.theme === 'dark';
        const textColor = isDarkTheme ? '#ffffff' : '#666';
        const subTextColor = isDarkTheme ? '#cccccc' : '#999';
        const bgColor = isDarkTheme ? '#000000' : '#f0f0f0';

        // Draw background
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, width, height);

        // Draw loading text
        this.ctx.fillStyle = textColor;
        this.ctx.font = '20px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Voice Bot Ready', width / 2, height / 2 - 20);

        // Draw smaller subtext
        this.ctx.font = '14px sans-serif';
        this.ctx.fillStyle = subTextColor;
        this.ctx.fillText('Click the microphone button to start', width / 2, height / 2 + 10);

        // Draw connection status
        if (!this.logoLoaded) {
            this.ctx.font = '12px sans-serif';
            this.ctx.fillStyle = subTextColor;
            this.ctx.fillText('Logo loading...', width / 2, height / 2 + 35);
        }

        this.ctx.restore();
    }

    drawAudioEffects(width, height) {
        // Draw subtle audio visualization effects
        const centerX = width / 2;
        const centerY = height / 2;
        const time = Date.now() * 0.001;

        // Draw pulsing waves
        if (this.inputLevel > 0.05 || this.outputLevel > 0.05) {
            const level = Math.max(this.inputLevel, this.outputLevel);
            const waveCount = 3;

            this.ctx.save();
            for (let i = 0; i < waveCount; i++) {
                const waveProgress = ((time * 2 + i * 0.3) % 1);
                const waveRadius = Math.min(width, height) * 0.3 * (1 + waveProgress);
                const alpha = (1 - waveProgress) * level * 0.3;

                this.ctx.strokeStyle = this.getGlowColor(
                    this.inputLevel > this.outputLevel,
                    this.outputLevel > this.inputLevel,
                    alpha
                );
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
    }

    getGlowColor(isUserSpeaking, isBotSpeaking, intensity) {
        if (isUserSpeaking) {
            // User speaking: Blue glow
            const alpha = Math.min(0.8, intensity);
            return this.options.inputColor.replace(/[\d.]+\)$/, `${alpha})`);
        } else if (isBotSpeaking) {
            // Bot speaking: Multi-color glow (cycling through logo colors)
            const time = Date.now() * 0.001;
            const colorIndex = Math.floor((time * 2) % this.options.outputColors.length);
            const baseColor = this.options.outputColors[colorIndex];
            const alpha = Math.min(0.8, intensity);
            return baseColor.replace(/[\d.]+\)$/, `${alpha})`);
        }

        return 'transparent';
    }

    // Get current audio levels
    getInputLevel() {
        if (this.use3D && this.spaceVisualizer) {
            return this.spaceVisualizer.getInputLevel();
        }
        return this.inputLevel;
    }

    getOutputLevel() {
        if (this.use3D && this.spaceVisualizer) {
            return this.spaceVisualizer.getOutputLevel();
        }
        return this.outputLevel;
    }

    // Set custom logo
    setLogoPath(path) {
        this.options.logoPath = path;

        // Delegate to 3D visualizer if active
        if (this.use3D && this.spaceVisualizer) {
            this.spaceVisualizer.setLogoPath(path);
            return;
        }

        this.logoLoaded = false;
        this.loadLogo().catch(error => {
            console.error('Failed to load new logo:', error);
        });
    }

    // Update options
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };

        // Delegate to 3D visualizer if active
        if (this.use3D && this.spaceVisualizer) {
            this.spaceVisualizer.updateOptions(newOptions);
        }
    }

    // Event methods
    on(event, callback) {
        this.events.on(event, callback);
    }

    off(event, callback) {
        this.events.off(event, callback);
    }

    // Cleanup
    destroy() {
        // Release 3D visualizer back to the manager (DON'T destroy - it's shared!)
        if (this.use3D && this.spaceVisualizer) {
            // Use the manager to release ownership - this keeps the visualizer alive
            // for other components (audio player) to acquire later
            if (window.SpaceVisualizerManager) {
                console.log('🎨 Visualizer: Releasing shared SpaceVisualizer to manager');
                window.SpaceVisualizerManager.release('voice-widget');
            }
            this.spaceVisualizer = null;
            this.use3D = false;
            return;
        }

        this.stopAnimation();

        // Clear canvas
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Reset state
        this.logoLoaded = false;
        this.logoImage = null;
        this.inputAnalyser = null;
        this.outputAnalyser = null;

        this.events.emit('destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Visualizer;
} else {
    window.Visualizer = Visualizer;
}