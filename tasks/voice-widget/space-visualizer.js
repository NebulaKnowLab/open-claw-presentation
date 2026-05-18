/**
 * Space Visualizer - 3D Space-Themed Audio Visualization
 * Uses Three.js to create an immersive cosmic experience for voice widgets
 * Features: Starfield, nebula effects, floating logo, audio-reactive ripples
 */

class SpaceVisualizer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.isAnimating = false;
        this.animationId = null;
        this.clock = null;
        this.initFailed = false; // Track if initialization failed

        // Audio analyzers
        this.inputAnalyser = null;
        this.outputAnalyser = null;
        this.inputLevel = 0;
        this.outputLevel = 0;

        // Configuration with defaults
        this.options = {
            logoPath: './logo.png',
            theme: 'dark', // Space theme is always dark
            starCount: 500,
            nebulaParticleCount: 50, // Reduced count for subtlety
            rotationSpeed: 0.0005,
            logoFloatSpeed: 0.5,
            logoFloatAmount: 5,
            inputColor: new THREE.Color(0x4891a7), // Teal
            outputColor: new THREE.Color(0x8b4574), // Purple (Nebula brand)
            ...options
        };

        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.starField = null;
        this.nebulaParticles = null;
        this.logoMesh = null;
        this.logoTexture = null;
        this.logoLoaded = false;
        this.ripples = [];
        this.circleTexture = null; // Circular particle texture

        // Event emitter for compatibility
        this.events = window.VoiceBotUtils?.EventUtils?.createEmitter() || this.createSimpleEmitter();

        this.init();
    }

    /**
     * Simple event emitter fallback
     */
    createSimpleEmitter() {
        const listeners = {};
        return {
            on: (event, cb) => {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(cb);
            },
            off: (event, cb) => {
                if (listeners[event]) {
                    listeners[event] = listeners[event].filter(l => l !== cb);
                }
            },
            emit: (event, data) => {
                if (listeners[event]) {
                    listeners[event].forEach(cb => cb(data));
                }
            }
        };
    }

    /**
     * Initialize the Three.js scene
     */
    async init() {
        try {
            console.log('🌌 SpaceVisualizer: Initializing 3D space environment...');

            this.setupRenderer();
            this.setupScene();
            this.setupCamera();
            this.createCircleTexture(); // Create circular particle texture
            this.createStarfield();
            this.createNebulaParticles();
            await this.loadLogo();

            this.clock = new THREE.Clock();
            this.startAnimation();

            console.log('🌌 SpaceVisualizer: Initialization complete');
        } catch (error) {
            console.error('🌌 SpaceVisualizer: Initialization failed:', error);
            this.initFailed = true;
            this.events.emit('error', error);
            throw error; // Re-throw so caller knows initialization failed
        }
    }

    /**
     * Setup WebGL renderer
     */
    setupRenderer() {
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: false
            });
        } catch (error) {
            console.error('🌌 SpaceVisualizer: WebGL renderer creation failed:', error);
            throw new Error('WebGL not available or context limit reached');
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 1);

        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Setup scene with fog for depth
     */
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0008);
    }

    /**
     * Create a circular texture for particles (to avoid square appearance)
     */
    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Create radial gradient for soft circular glow
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        this.circleTexture = new THREE.CanvasTexture(canvas);
    }

    /**
     * Setup perspective camera
     */
    setupCamera() {
        const rect = this.canvas.getBoundingClientRect();
        const aspect = rect.width / rect.height;

        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Handle canvas resize
     */
    handleResize() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }

        if (this.renderer) {
            this.renderer.setSize(width, height);
        }
    }

    /**
     * Create animated starfield background
     */
    createStarfield() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.options.starCount * 3);
        const colors = new Float32Array(this.options.starCount * 3);
        const sizes = new Float32Array(this.options.starCount);

        for (let i = 0; i < this.options.starCount; i++) {
            const i3 = i * 3;

            // Spherical distribution
            const radius = 200 + Math.random() * 600;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);

            // Starlight colors (white to light blue)
            const colorChoice = Math.random();
            if (colorChoice < 0.7) {
                colors[i3] = 1.0;
                colors[i3 + 1] = 1.0;
                colors[i3 + 2] = 1.0;
            } else if (colorChoice < 0.85) {
                colors[i3] = 0.8;
                colors[i3 + 1] = 0.9;
                colors[i3 + 2] = 1.0;
            } else {
                colors[i3] = 1.0;
                colors[i3 + 1] = 0.9;
                colors[i3 + 2] = 0.7;
            }

            // Varying star sizes
            sizes[i] = 0.5 + Math.random() * 2.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Create star material with custom shader for size variation
        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });

        this.starField = new THREE.Points(geometry, material);
        this.scene.add(this.starField);
    }

    /**
     * Create nebula cloud particles for cosmic atmosphere
     * Uses circular texture for soft glow effect instead of squares
     */
    createNebulaParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.options.nebulaParticleCount * 3);
        const colors = new Float32Array(this.options.nebulaParticleCount * 3);

        // Nebula brand colors - softer, more transparent
        const nebulaColors = [
            new THREE.Color(0x6b4c93), // Purple
            new THREE.Color(0x4891a7), // Teal
            new THREE.Color(0x8b4574), // Magenta/Purple
            new THREE.Color(0x2d5a6b)  // Deep teal
        ];

        for (let i = 0; i < this.options.nebulaParticleCount; i++) {
            const i3 = i * 3;

            // Cluster around center with some spread - push further from center
            const radius = 80 + Math.random() * 180;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi) * 0.3; // Flatten more

            // Pick nebula color
            const chosenColor = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
            colors[i3] = chosenColor.r;
            colors[i3 + 1] = chosenColor.g;
            colors[i3 + 2] = chosenColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Use circular texture for soft glow effect
        const material = new THREE.PointsMaterial({
            size: 25,
            map: this.circleTexture, // Use circular texture
            vertexColors: true,
            transparent: true,
            opacity: 0.08, // More subtle
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.nebulaParticles = new THREE.Points(geometry, material);
        this.scene.add(this.nebulaParticles);
    }

    /**
     * Load and create the logo as a 3D plane
     */
    async loadLogo() {
        if (!this.options.logoPath) {
            console.log('🌌 SpaceVisualizer: No logo path provided');
            return;
        }

        return new Promise((resolve) => {
            const loader = new THREE.TextureLoader();

            // Handle CORS for different URL types
            if (this.options.logoPath.includes('storage.cloud.google.com')) {
                loader.crossOrigin = '';
            } else {
                loader.crossOrigin = 'anonymous';
            }

            loader.load(
                this.options.logoPath,
                (texture) => {
                    console.log('🌌 SpaceVisualizer: Logo texture loaded');
                    this.logoTexture = texture;
                    this.createLogoMesh(texture);
                    this.logoLoaded = true;
                    this.events.emit('logoLoaded');
                    resolve();
                },
                undefined,
                (error) => {
                    console.warn('🌌 SpaceVisualizer: Logo loading failed:', error);
                    this.createPlaceholderLogo();
                    resolve();
                }
            );
        });
    }

    /**
     * Create the logo mesh as a plane in 3D space
     */
    createLogoMesh(texture) {
        // Calculate aspect ratio from texture
        const aspect = texture.image.width / texture.image.height;
        const height = 50;
        const width = height * aspect;

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.logoMesh = new THREE.Mesh(geometry, material);
        this.logoMesh.position.set(0, 0, 0);
        this.scene.add(this.logoMesh);

        // Create glow ring around logo
        this.createLogoGlow(Math.max(width, height) / 2 + 5);
    }

    /**
     * Create placeholder if logo fails to load
     */
    createPlaceholderLogo() {
        const geometry = new THREE.RingGeometry(15, 20, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x6b4c93,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        this.logoMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.logoMesh);
    }

    /**
     * Create multi-layer 3D glowing orb effect around the logo
     * Siri-inspired floating orb with inner glow, outer halo, and ambient particles
     */
    createLogoGlow(radius) {
        // Store orb layers for animation
        this.orbLayers = [];

        // Layer 1: Inner glowing sphere (core glow) - subtle
        const innerGlowGeometry = new THREE.SphereGeometry(radius * 0.9, 32, 32);
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x8b4574, // Nebula purple
            transparent: true,
            opacity: 0.08, // Reduced for subtlety
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        innerGlow.position.set(0, 0, -3);
        this.scene.add(innerGlow);
        this.orbLayers.push({ mesh: innerGlow, type: 'inner', baseOpacity: 0.08, baseScale: 1 });

        // Layer 2: Middle glow ring (soft halo) - subtle
        const middleGlowGeometry = new THREE.RingGeometry(radius * 1.1, radius * 1.4, 64);
        const middleGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x6b4c93, // Purple
            transparent: true,
            opacity: 0.12, // Reduced for subtlety
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const middleGlow = new THREE.Mesh(middleGlowGeometry, middleGlowMaterial);
        middleGlow.position.set(0, 0, -2);
        this.scene.add(middleGlow);
        this.orbLayers.push({ mesh: middleGlow, type: 'middle', baseOpacity: 0.12, baseScale: 1 });

        // Layer 3: Outer soft glow (using sprite) - very subtle to avoid background leak
        const outerGlowTexture = this.createGlowTexture();
        const outerGlowMaterial = new THREE.SpriteMaterial({
            map: outerGlowTexture,
            color: 0x9b59b6, // Soft purple
            transparent: true,
            opacity: 0.15, // Reduced significantly to prevent background color change
            blending: THREE.NormalBlending, // Changed from Additive to prevent background leak
            depthWrite: false
        });
        const outerGlow = new THREE.Sprite(outerGlowMaterial);
        outerGlow.scale.set(radius * 3, radius * 3, 1); // Reduced size
        outerGlow.position.set(0, 0, -5);
        this.scene.add(outerGlow);
        this.orbLayers.push({ mesh: outerGlow, type: 'outer', baseOpacity: 0.15, baseScale: 1 });

        // Layer 4: Breathing pulse ring (expands with audio)
        const pulseGeometry = new THREE.RingGeometry(radius * 1.0, radius * 1.05, 64);
        const pulseMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const pulseRing = new THREE.Mesh(pulseGeometry, pulseMaterial);
        pulseRing.position.set(0, 0, -1.5);
        this.scene.add(pulseRing);
        this.orbLayers.push({ mesh: pulseRing, type: 'pulse', baseOpacity: 0.3, baseScale: 1 });

        // Create ambient glow particles around the orb
        this.createAmbientGlowParticles(radius);

        // Keep reference to main glow for compatibility
        this.logoGlow = middleGlow;
    }

    /**
     * Create radial gradient glow texture for sprites
     */
    createGlowTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Create radial gradient
        const gradient = ctx.createRadialGradient(
            size / 2, size / 2, 0,
            size / 2, size / 2, size / 2
        );
        gradient.addColorStop(0, 'rgba(155, 89, 182, 0.8)'); // Center - bright purple
        gradient.addColorStop(0.3, 'rgba(107, 76, 147, 0.5)'); // Mid - nebula purple
        gradient.addColorStop(0.6, 'rgba(72, 145, 167, 0.2)'); // Outer - hint of teal
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Edge - transparent

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Create ambient floating particles around the orb
     */
    createAmbientGlowParticles(radius) {
        const particleCount = 30;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const colorPalette = [
            new THREE.Color(0x9b59b6), // Purple
            new THREE.Color(0x8b4574), // Nebula purple
            new THREE.Color(0x4891a7), // Teal
            new THREE.Color(0xffffff)  // White
        ];

        for (let i = 0; i < particleCount; i++) {
            // Position particles in a sphere around the logo
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = radius * 1.5 + Math.random() * radius * 1.5;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi);
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 3;

            // Random color from palette
            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Random sizes
            sizes[i] = 1 + Math.random() * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            map: this.circleTexture
        });

        this.ambientParticles = new THREE.Points(geometry, material);
        this.scene.add(this.ambientParticles);
    }

    /**
     * Create modern gradient energy wave ripple effect
     * Multiple overlapping rings with gradient for smooth appearance
     */
    createRipple(isInput = true) {
        const baseColor = isInput ? this.options.inputColor : this.options.outputColor;
        const audioLevel = isInput ? this.inputLevel : this.outputLevel;

        // Create gradient-textured ripple for modern look
        const rippleTexture = this.createRippleGradientTexture(baseColor);

        // Main ripple ring - start closer to logo for compact look
        const innerRadius = 20 + audioLevel * 6;
        const outerRadius = innerRadius + 6 + audioLevel * 3;
        const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);

        const material = new THREE.MeshBasicMaterial({
            map: rippleTexture,
            color: baseColor,
            transparent: true,
            opacity: 0.25 + audioLevel * 0.15, // Reduced for subtlety
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const ripple = new THREE.Mesh(geometry, material);
        ripple.position.set(0, this.logoMesh ? this.logoMesh.position.y : 0, -4); // Further behind logo
        ripple.userData = {
            birthTime: this.clock.getElapsedTime(),
            lifetime: 2.5 + audioLevel * 0.5, // Longer lifetime for smoother effect
            isInput: isInput,
            baseOpacity: 0.25 + audioLevel * 0.15
        };

        this.scene.add(ripple);
        this.ripples.push(ripple);
    }

    /**
     * Create gradient texture for ripple effect
     */
    createRippleGradientTexture(color) {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Create radial gradient from center
        const gradient = ctx.createRadialGradient(
            size / 2, size / 2, size * 0.3,
            size / 2, size / 2, size / 2
        );

        // Use nebula color palette
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); // Bright center
        gradient.addColorStop(0.3, 'rgba(155, 89, 182, 0.6)'); // Purple mid
        gradient.addColorStop(0.7, 'rgba(107, 76, 147, 0.3)'); // Nebula fade
        gradient.addColorStop(1, 'rgba(72, 145, 167, 0)'); // Teal edge fade

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Animate orb layers with audio-reactive effects
     */
    updateOrbLayers(elapsedTime) {
        if (!this.orbLayers || this.orbLayers.length === 0) return;

        const audioLevel = Math.max(this.inputLevel, this.outputLevel);
        const breathe = Math.sin(elapsedTime * 2) * 0.5 + 0.5; // Gentle breathing

        this.orbLayers.forEach(layer => {
            const mesh = layer.mesh;
            const logoY = this.logoMesh ? this.logoMesh.position.y : 0;

            // Sync position with logo float
            if (mesh.position) {
                mesh.position.y = logoY;
            }

            switch (layer.type) {
                case 'inner':
                    // Inner sphere expands with audio
                    const innerScale = layer.baseScale * (1 + audioLevel * 0.3);
                    mesh.scale.set(innerScale, innerScale, innerScale);
                    mesh.material.opacity = layer.baseOpacity + audioLevel * 0.2;
                    break;

                case 'middle':
                    // Middle ring pulses gently
                    const middleScale = layer.baseScale * (1 + breathe * 0.1 + audioLevel * 0.2);
                    mesh.scale.set(middleScale, middleScale, 1);
                    mesh.material.opacity = layer.baseOpacity + breathe * 0.1 + audioLevel * 0.3;
                    break;

                case 'outer':
                    // Outer halo breathes and expands dramatically with audio
                    const outerScale = layer.baseScale * (1 + breathe * 0.15 + audioLevel * 0.5);
                    mesh.scale.set(
                        mesh.scale.x * 0.98 + outerScale * mesh.scale.x * 0.02, // Smooth transition
                        mesh.scale.y * 0.98 + outerScale * mesh.scale.y * 0.02,
                        1
                    );
                    mesh.material.opacity = layer.baseOpacity * (0.8 + breathe * 0.2 + audioLevel * 0.5);
                    break;

                case 'pulse':
                    // Pulse ring expands outward with audio peaks
                    const pulseScale = layer.baseScale * (1 + audioLevel * 0.8);
                    mesh.scale.set(pulseScale, pulseScale, 1);
                    mesh.material.opacity = audioLevel > 0.1 ? layer.baseOpacity + audioLevel * 0.4 : layer.baseOpacity * 0.5;
                    break;
            }
        });
    }

    /**
     * Animate ambient particles around the orb
     */
    updateAmbientParticles(elapsedTime) {
        if (!this.ambientParticles) return;

        const audioLevel = Math.max(this.inputLevel, this.outputLevel);

        // Gentle rotation
        this.ambientParticles.rotation.y += 0.001;
        this.ambientParticles.rotation.x = Math.sin(elapsedTime * 0.3) * 0.1;

        // Sync with logo position
        if (this.logoMesh) {
            this.ambientParticles.position.y = this.logoMesh.position.y;
        }

        // Pulse opacity with audio
        this.ambientParticles.material.opacity = 0.4 + audioLevel * 0.4;

        // Expand particles outward with audio
        const scale = 1 + audioLevel * 0.3;
        this.ambientParticles.scale.set(scale, scale, scale);
    }

    /**
     * Update ripple animations with smooth easing
     */
    updateRipples(deltaTime) {
        const currentTime = this.clock.getElapsedTime();

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const ripple = this.ripples[i];
            const age = currentTime - ripple.userData.birthTime;
            const lifeProgress = age / ripple.userData.lifetime;

            if (lifeProgress >= 1) {
                // Remove expired ripple and clean up resources
                this.scene.remove(ripple);
                ripple.geometry.dispose();
                if (ripple.material.map) ripple.material.map.dispose();
                ripple.material.dispose();
                this.ripples.splice(i, 1);
            } else {
                // Smooth cubic-bezier easing for organic feel
                const easeOut = 1 - Math.pow(1 - lifeProgress, 3);

                // Expand smoothly
                const scale = 1 + easeOut * 2.5;
                ripple.scale.set(scale, scale, 1);

                // Sync Y position with logo float
                if (this.logoMesh) {
                    ripple.position.y = this.logoMesh.position.y;
                }

                // Fade with easing
                const baseOpacity = ripple.userData.baseOpacity || 0.5;
                ripple.material.opacity = baseOpacity * (1 - easeOut);
            }
        }
    }

    /**
     * Set input audio node for microphone visualization
     */
    setInputAudioNode(node) {
        if (node && node.context) {
            this.inputAnalyser = node.context.createAnalyser();
            this.inputAnalyser.fftSize = 256;
            this.inputAnalyser.smoothingTimeConstant = 0.85;

            try {
                node.connect(this.inputAnalyser);
                console.log('🌌 SpaceVisualizer: Input audio node connected');
            } catch (error) {
                console.warn('🌌 SpaceVisualizer: Could not connect input analyser:', error);
            }
        }
    }

    /**
     * Set output audio node for bot speech visualization
     */
    setOutputAudioNode(node) {
        if (node && node.context) {
            this.outputAnalyser = node.context.createAnalyser();
            this.outputAnalyser.fftSize = 256;
            this.outputAnalyser.smoothingTimeConstant = 0.85;

            try {
                node.connect(this.outputAnalyser);
                console.log('🌌 SpaceVisualizer: Output audio node connected');
            } catch (error) {
                console.warn('🌌 SpaceVisualizer: Could not connect output analyser:', error);
            }
        }
    }

    /**
     * Clear audio analyzers - call this when transferring between components
     * This stops the old component's audio from affecting the visualizer
     */
    clearAudioAnalyzers() {
        console.log('🌌 SpaceVisualizer: Clearing audio analyzers');
        this.inputAnalyser = null;
        this.outputAnalyser = null;
        this.inputLevel = 0;
        this.outputLevel = 0;
    }

    /**
     * Update audio levels from analyzers
     */
    updateAudioLevels() {
        // Update input level
        if (this.inputAnalyser) {
            const inputData = new Uint8Array(this.inputAnalyser.frequencyBinCount);
            this.inputAnalyser.getByteFrequencyData(inputData);
            const inputAverage = inputData.reduce((sum, val) => sum + val, 0) / inputData.length;
            this.inputLevel = inputAverage / 255;
        }

        // Update output level
        if (this.outputAnalyser) {
            const outputData = new Uint8Array(this.outputAnalyser.frequencyBinCount);
            this.outputAnalyser.getByteFrequencyData(outputData);
            const outputAverage = outputData.reduce((sum, val) => sum + val, 0) / outputData.length;
            this.outputLevel = outputAverage / 255;
        }
    }

    /**
     * Start the animation loop
     */
    startAnimation() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.animate();
    }

    /**
     * Stop the animation loop
     */
    stopAnimation() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Main animation loop
     */
    animate() {
        if (!this.isAnimating) return;

        this.animationId = requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();
        const elapsedTime = this.clock.getElapsedTime();

        this.updateAudioLevels();
        this.updateScene(deltaTime, elapsedTime);
        this.render();
    }

    /**
     * Update scene elements
     */
    updateScene(deltaTime, elapsedTime) {
        // Rotate starfield slowly
        if (this.starField) {
            this.starField.rotation.y += this.options.rotationSpeed;
            this.starField.rotation.x += this.options.rotationSpeed * 0.3;
        }

        // Rotate nebula particles slightly faster
        if (this.nebulaParticles) {
            this.nebulaParticles.rotation.y -= this.options.rotationSpeed * 0.5;
            this.nebulaParticles.rotation.z += this.options.rotationSpeed * 0.2;
        }

        // Float logo up and down
        if (this.logoMesh) {
            const floatY = Math.sin(elapsedTime * this.options.logoFloatSpeed) * this.options.logoFloatAmount;
            this.logoMesh.position.y = floatY;

            // Scale based on audio (1.0x → 1.3x when audio peaks)
            const audioScale = 1 + (Math.max(this.inputLevel, this.outputLevel) * 0.3);
            this.logoMesh.scale.set(audioScale, audioScale, 1);
        }

        // Update logo glow
        if (this.logoGlow) {
            this.logoGlow.position.y = this.logoMesh ? this.logoMesh.position.y : 0;

            // Pulse glow based on audio
            const glowIntensity = 0.3 + Math.max(this.inputLevel, this.outputLevel) * 0.5;
            this.logoGlow.material.opacity = glowIntensity;

            // Change glow color based on who's speaking
            if (this.inputLevel > 0.1) {
                this.logoGlow.material.color.copy(this.options.inputColor);
            } else if (this.outputLevel > 0.1) {
                this.logoGlow.material.color.copy(this.options.outputColor);
            } else {
                this.logoGlow.material.color.setHex(0x6b4c93); // Default purple
            }
        }

        // Animate all orb layers with enhanced effects
        this.updateOrbLayers(elapsedTime);

        // Update ambient glow particles
        this.updateAmbientParticles(elapsedTime);

        // Create ripples when audio is active
        if (this.inputLevel > 0.15 && Math.random() < 0.1) {
            this.createRipple(true);
        }
        if (this.outputLevel > 0.15 && Math.random() < 0.1) {
            this.createRipple(false);
        }

        // Update existing ripples
        this.updateRipples(deltaTime);

        // Subtle camera movement
        this.camera.position.x = Math.sin(elapsedTime * 0.1) * 2;
        this.camera.position.y = Math.cos(elapsedTime * 0.15) * 1;
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Render the scene
     */
    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Get current input audio level
     */
    getInputLevel() {
        return this.inputLevel;
    }

    /**
     * Get current output audio level
     */
    getOutputLevel() {
        return this.outputLevel;
    }

    /**
     * Set a new logo path and reload
     */
    setLogoPath(path) {
        this.options.logoPath = path;

        // Remove existing logo
        if (this.logoMesh) {
            this.scene.remove(this.logoMesh);
            this.logoMesh.geometry.dispose();
            this.logoMesh.material.dispose();
            this.logoMesh = null;
        }
        if (this.logoGlow) {
            this.scene.remove(this.logoGlow);
            this.logoGlow.geometry.dispose();
            this.logoGlow.material.dispose();
            this.logoGlow = null;
        }
        if (this.logoTexture) {
            this.logoTexture.dispose();
            this.logoTexture = null;
        }

        this.logoLoaded = false;
        this.loadLogo();
    }

    /**
     * Update options
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Event subscription
     */
    on(event, callback) {
        this.events.on(event, callback);
    }

    /**
     * Event unsubscription
     */
    off(event, callback) {
        this.events.off(event, callback);
    }

    /**
     * Cleanup and destroy the visualizer
     */
    destroy() {
        console.log('🌌 SpaceVisualizer: Destroying...');

        this.stopAnimation();
        window.removeEventListener('resize', () => this.handleResize());

        // Dispose ripples
        this.ripples.forEach(ripple => {
            this.scene.remove(ripple);
            ripple.geometry.dispose();
            ripple.material.dispose();
        });
        this.ripples = [];

        // Dispose starfield
        if (this.starField) {
            this.scene.remove(this.starField);
            this.starField.geometry.dispose();
            this.starField.material.dispose();
            this.starField = null;
        }

        // Dispose nebula particles
        if (this.nebulaParticles) {
            this.scene.remove(this.nebulaParticles);
            this.nebulaParticles.geometry.dispose();
            this.nebulaParticles.material.dispose();
            this.nebulaParticles = null;
        }

        // Dispose logo
        if (this.logoMesh) {
            this.scene.remove(this.logoMesh);
            this.logoMesh.geometry.dispose();
            this.logoMesh.material.dispose();
            this.logoMesh = null;
        }
        if (this.logoGlow) {
            this.scene.remove(this.logoGlow);
            this.logoGlow.geometry.dispose();
            this.logoGlow.material.dispose();
            this.logoGlow = null;
        }
        if (this.logoTexture) {
            this.logoTexture.dispose();
            this.logoTexture = null;
        }

        // Dispose circle texture
        if (this.circleTexture) {
            this.circleTexture.dispose();
            this.circleTexture = null;
        }

        // CRITICAL: Force WebGL context release
        // This is necessary because browsers limit the number of WebGL contexts
        // and simply calling dispose() doesn't immediately release the context
        if (this.renderer) {
            // Get the WebGL context and force its loss
            const gl = this.renderer.getContext();
            if (gl) {
                const loseContextExt = gl.getExtension('WEBGL_lose_context');
                if (loseContextExt) {
                    loseContextExt.loseContext();
                    console.log('🌌 SpaceVisualizer: WebGL context forced loss');
                }
            }

            // Dispose the renderer
            this.renderer.dispose();

            // Clear the canvas to prevent any residual rendering
            this.renderer.domElement.width = 1;
            this.renderer.domElement.height = 1;

            this.renderer = null;
        }

        // Clear references
        this.scene = null;
        this.camera = null;
        this.inputAnalyser = null;
        this.outputAnalyser = null;

        this.events.emit('destroyed');
        console.log('🌌 SpaceVisualizer: Destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpaceVisualizer;
} else {
    window.SpaceVisualizer = SpaceVisualizer;
}
