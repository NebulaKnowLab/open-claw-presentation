class PrerecordedAudioPlayer {
  constructor(container, audioConfig, transcriptConfig = null) {
    // Initialize container
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) {
      throw new Error('PrerecordedAudioPlayer: Container element not found');
    }

    // Audio configuration
    this.audioConfig = audioConfig;
    this.transcriptConfig = transcriptConfig;

    // Theme configuration
    this.theme = audioConfig.theme || 'light';

    // Audio element and analysis
    this.audio = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;

    // UI elements
    this.canvas = null;
    this.visualizer = null;
    this.playPauseBtn = null;
    this.progressBar = null;
    this.progressFill = null;
    this.progressHandle = null;
    this.currentTimeDisplay = null;
    this.durationDisplay = null;
    this.volumeSlider = null;
    this.speedSelect = null;
    this.volumeBtn = null;
    this.connectionDot = null;
    this.connectionStatus = null;
    this.transcriptBtn = null;
    this.transcriptManager = null;
    this.isTranscriptVisible = false;
    this.callbacks = {
      onPlay: () => { },
      onPause: () => { },
      onEnded: () => { },
      onTimeUpdate: () => { },
      onError: (error) => { }
    };

    // Initialize the player
    this.init();
  }

  /**
   * Initialize the audio player
   */
  init() {
    this.createHTML();
    this.setupAudioElement();
    this.bindEvents();
    this.setupKeyboardShortcuts();
  }

  /**
   * Create the HTML structure for the audio player - Voice Bot UI Layout
   */
  createHTML() {
    const audioId = this.audioConfig.id || 'audio-player-' + Date.now();
    const audioTitle = this.audioConfig.title || 'Audio Lesson';

    // Add theme class - use space theme when Three.js is available for 3D visualizer
    const use3DSpace = typeof THREE !== 'undefined' && typeof SpaceVisualizer !== 'undefined';
    const themeClass = use3DSpace ? 'space-theme' : (this.theme === 'dark' ? 'dark-theme' : '');

    // Create SVG helper functions
    const createSvgIcon = (pathData, viewBox = '0 -960 960 960') => {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor" width="20" height="20"><path d="${pathData}"/></svg>`;
    };

    const playIcon = createSvgIcon('M120-160v-640l760 320-760 320Z');
    const pauseIcon = createSvgIcon('M480-320v-320h320v320H480Z');
    const volumeIcon = createSvgIcon('M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z', '0 0 24 24');
    const mutedIcon = createSvgIcon('M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z', '0 0 24 24');
    const transcriptIcon = createSvgIcon('M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M8,12H16V14H8V12M8,16H13V18H8V16Z', '0 0 24 24');

    this.container.innerHTML = `
      <div class="prerecorded-audio-player ${themeClass}" id="${audioId}">
        <!-- Canvas Background for Visualization -->
        <canvas class="audio-player-canvas" id="${audioId}-canvas"></canvas>

        <!-- Connection Indicator - Top Right -->
        <div class="audio-connection-indicator">
          <div class="connection-dot" id="${audioId}-connection-dot"></div>
          <span id="${audioId}-connection-status">Ready</span>
        </div>

        <!-- Bottom Controls Container -->
        <div class="audio-controls-container">
          <!-- Left Container - Speaker Level & Playback Speed -->
          <div class="audio-controls-left">
            <div class="control-group">
              <!-- Volume Controls -->
              <button class="voice-bot-btn volume-btn" id="${audioId}-volume-btn" title="Volume">
                <span class="volume-icon">${volumeIcon}</span>
                <span class="muted-icon" style="display: none;">${mutedIcon}</span>
              </button>

              <input type="range" class="volume-slider" id="${audioId}-volume-slider" min="0" max="1" step="0.1" value="0.7" aria-label="Volume control">

              <!-- Speed Controls -->
              <div class="speed-controls">
                <select class="speed-select" id="${audioId}-speed-select" aria-label="Playback speed">
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1" selected>1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>

              <!-- Transcript Toggle Button (only shown when transcript is available) -->
              <button class="voice-bot-btn transcript-btn" id="${audioId}-transcript-btn" title="Toggle Transcript" style="display: none;">
                <span class="transcript-icon-show">${transcriptIcon}</span>
                <span class="transcript-icon-hide" style="display: none;">${transcriptIcon}</span>
              </button>
            </div>
          </div>

          <!-- Right Container - Progress Bar & Play/Pause -->
          <div class="audio-controls-right">
            <div class="control-group">
              <!-- Time and Progress -->
              <div class="time-controls">
                <span class="time-display current-time" id="${audioId}-current-time">0:00</span>
                <div class="progress-container">
                  <div class="progress-bar" id="${audioId}-progress-bar">
                    <div class="progress-fill" id="${audioId}-progress-fill"></div>
                    <div class="progress-handle" id="${audioId}-progress-handle"></div>
                  </div>
                </div>
                <span class="time-display duration" id="${audioId}-duration">0:00</span>
              </div>

              <!-- Play/Pause Button -->
              <button class="voice-bot-btn play-pause-btn" id="${audioId}-play-pause-btn" title="Play">
                ${playIcon}
              </button>

              <!-- Skip and Solve Doubt Button -->
              <button class="voice-bot-btn skip-solve-btn" id="${audioId}-skip-solve-btn" title="Skip Audio and Start Voice Assistant">
                Skip and Solve Doubt
              </button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div class="audio-loading" style="display: none;" id="${audioId}-loading">
          <div class="loading-spinner"></div>
          <span>Loading audio...</span>
        </div>

        <!-- Error State -->
        <div class="audio-error" style="display: none;" id="${audioId}-error">
          <div class="error-icon">⚠️</div>
          <span class="error-message">Failed to load audio</span>
          <button class="retry-btn" id="${audioId}-retry-btn">Retry</button>
        </div>
      </div>
    `;

    // Cache UI elements
    this.canvas = this.container.querySelector('.audio-player-canvas');
    this.playPauseBtn = this.container.querySelector('.play-pause-btn');
    this.progressBar = this.container.querySelector('.progress-bar');
    this.progressFill = this.container.querySelector('.progress-fill');
    this.progressHandle = this.container.querySelector('.progress-handle');
    this.currentTimeDisplay = this.container.querySelector('.current-time');
    this.durationDisplay = this.container.querySelector('.duration');
    this.volumeSlider = this.container.querySelector('.volume-slider');
    this.speedSelect = this.container.querySelector('.speed-select');
    this.volumeBtn = this.container.querySelector('.volume-btn');
    this.skipSolveBtn = this.container.querySelector('.skip-solve-btn');
    this.transcriptBtn = this.container.querySelector('.transcript-btn');
    this.connectionDot = this.container.querySelector('.connection-dot');
    this.connectionStatus = this.container.querySelector('#' + audioId + '-connection-status');
  }

  /**
   * Setup the HTML5 audio element and visualizer
   */
  setupAudioElement() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';

    // crossOrigin must be set before assigning src so the browser performs
    // the fetch in CORS mode and Web Audio analysis can access the media.
    this.audio.crossOrigin = 'anonymous';

    // Set initial volume
    this.audio.volume = 0.7;

    // Set audio source
    if (this.audioConfig.url) {
      this.audio.src = this.audioConfig.url;
    }

    this.setupAudioContext();

    // Initialize visualizer
    this.initializeVisualizer();
  }

  /**
   * Setup audio context for analysis
   */
  setupAudioContext() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.7;

      // Connect audio element to context
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

    } catch (error) {
      console.warn('PrerecordedAudioPlayer: Could not setup audio context:', error);
      this.audioContext = null;
      this.analyser = null;
    }
  }

  /**
   * Initialize visualizer
   */
  initializeVisualizer() {
    if (!this.canvas) return;

    // Check if SpaceVisualizerManager and its dependencies are available
    const canUse3D = typeof THREE !== 'undefined' &&
      typeof SpaceVisualizer !== 'undefined' &&
      window.SpaceVisualizerManager;

    if (canUse3D) {
      console.log('🌌 PrerecordedAudioPlayer: Using shared 3D Space Visualizer');
      this.init3DVisualizer();
    } else {
      console.log('📊 PrerecordedAudioPlayer: Using 2D Canvas Visualizer');
      this.init2DVisualizer();
    }
  }

  /**
   * Initialize 3D Space Visualizer with Three.js
   */
  init3DVisualizer() {
    // Use the global SpaceVisualizerManager to get/create the shared visualizer
    const manager = window.SpaceVisualizerManager;

    this.spaceVisualizer = manager.acquire(this.canvas, {
      logoPath: 'voice-widget/logo.png',
      theme: 'dark'
    }, 'prerecorded-audio-player');

    // If manager couldn't create/acquire visualizer, fall back to 2D
    if (!this.spaceVisualizer) {
      console.warn('🌌 PrerecordedAudioPlayer: SpaceVisualizerManager returned null, falling back to 2D');
      this.init2DVisualizer();
      return;
    }

    // Set up update loop to sync audio levels - run at 60fps for smooth effects
    this.audioLevelUpdateInterval = setInterval(() => {
      if (this.spaceVisualizer && this.analyser) {
        if (this.isPlaying) {
          // Get frequency data for visualization
          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(dataArray);

          // Calculate weighted average (emphasize mid-frequencies for voice)
          let weightedSum = 0;
          let totalWeight = 0;
          for (let i = 0; i < dataArray.length; i++) {
            // Weight mid-frequencies higher (where voice typically sits)
            const weight = i < dataArray.length * 0.7 ? 1.5 : 0.5;
            weightedSum += dataArray[i] * weight;
            totalWeight += weight;
          }
          const average = weightedSum / totalWeight;

          // Normalize to 0-1 range with boosted sensitivity
          const normalizedLevel = Math.min(1, (average / 255) * 1.5);

          // Smooth transition for natural feel
          this.spaceVisualizer.outputLevel = this.spaceVisualizer.outputLevel * 0.3 + normalizedLevel * 0.7;
        } else {
          // Faster fade out when paused
          this.spaceVisualizer.outputLevel *= 0.85;
          if (this.spaceVisualizer.outputLevel < 0.01) {
            this.spaceVisualizer.outputLevel = 0;
          }
        }
      }
    }, 16); // 60fps for smooth updates

    // Create a simple visualizer interface for compatibility
    this.visualizer = {
      start: () => {
        if (this.spaceVisualizer) {
          this.spaceVisualizer.startAnimation();
        }
      },
      stop: () => {
        if (this.spaceVisualizer) {
          this.spaceVisualizer.stopAnimation();
        }
      },
      isAnimating: true
    };
  }

  /**
   * Initialize 2D Canvas Visualizer (fallback)
   */
  init2DVisualizer() {
    // Create simple visualizer instance
    this.visualizer = {
      canvas: this.canvas,
      ctx: this.canvas.getContext('2d'),
      isAnimating: false,
      audioLevel: 0,
      logoRotation: 0,
      logoImage: null,
      logoLoaded: false,

      start: () => {
        if (!this.visualizer.isAnimating) {
          this.visualizer.isAnimating = true;
          this.visualizer.animate();
        }
      },

      stop: () => {
        this.visualizer.isAnimating = false;
      },

      animate: () => {
        if (!this.visualizer.isAnimating) return;

        requestAnimationFrame(() => this.visualizer.animate());
        this.visualizer.draw();
      },

      draw: () => {
        const ctx = this.visualizer.ctx;
        const canvas = this.visualizer.canvas;
        const width = canvas.width;
        const height = canvas.height;

        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        // Clear canvas
        const bgColor = this.theme === 'dark' ? '#000000' : '#ffffff';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Update audio level
        if (this.analyser && this.isPlaying) {
          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
          this.visualizer.audioLevel = average / 255;
        } else if (!this.isPlaying) {
          this.visualizer.audioLevel *= 0.95; // Fade out when not playing
        }

        // Draw logo and effects
        this.drawVisualizer(ctx, rect.width, rect.height);
      }
    };

    // Load logo image
    this.loadLogo();

    // Start visualizer animation
    this.visualizer.start();
  }

  /**
   * Load logo image
   */
  loadLogo() {
    const logo = new Image();

    logo.onload = () => {
      console.log('Logo loaded successfully');
      this.visualizer.logoImage = logo;
      this.visualizer.logoLoaded = true;
    };

    logo.onerror = (error) => {
      console.warn('Failed to load logo image:', error);
      console.log('Falling back to placeholder text');
      this.visualizer.logoLoaded = false;
    };

    logo.onabort = () => {
      console.log('Logo loading aborted');
      this.visualizer.logoLoaded = false;
    };

    // Try loading the logo
    try {
      logo.src = 'https://storage.cloud.google.com/task-html-page/logo.png?authuser=1';
      console.log('Attempting to load logo from:', logo.src);
    } catch (error) {
      console.error('Error setting logo src:', error);
      this.visualizer.logoLoaded = false;
    }
  }

  /**
   * Draw visualizer elements
   */
  drawVisualizer(ctx, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const isDarkTheme = this.theme === 'dark';

    // Update logo rotation
    this.visualizer.logoRotation += 0.01;

    // Draw placeholder/audio visualization
    if (this.isPlaying && this.visualizer.audioLevel > 0.05) {
      // Draw pulsing effects
      const level = this.visualizer.audioLevel;

      // Draw pulsing rings
      for (let i = 0; i < 3; i++) {
        const time = Date.now() * 0.001;
        const pulse = Math.sin(time * 2 - i * 0.5) * 0.5 + 0.5;
        const radius = 80 + i * 30 + level * 50;
        const alpha = (1 - i * 0.3) * level * pulse * 0.3;

        ctx.strokeStyle = isDarkTheme
          ? `rgba(100, 181, 246, ${alpha})`
          : `rgba(33, 150, 243, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw center glow
      const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 100);
      glowGradient.addColorStop(0, isDarkTheme
        ? `rgba(100, 181, 246, ${level * 0.3})`
        : `rgba(33, 150, 243, ${level * 0.2})`);
      glowGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw center logo
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.visualizer.logoRotation);

    if (this.visualizer.logoLoaded && this.visualizer.logoImage) {
      // Calculate logo size and position (cover style - crop to fit)
      const containerSize = Math.min(width, height) * 0.4; // Logo takes 40% of smallest dimension
      const imgAspect = this.visualizer.logoImage.width / this.visualizer.logoImage.height;

      let logoWidth, logoHeight, cropX = 0, cropY = 0, cropWidth = this.visualizer.logoImage.width, cropHeight = this.visualizer.logoImage.height;

      if (imgAspect > 1) {
        // Wider than tall - crop sides
        logoWidth = containerSize;
        logoHeight = containerSize / imgAspect;
        // Center crop horizontally
        cropWidth = this.visualizer.logoImage.height * (logoWidth / logoHeight);
        cropX = (this.visualizer.logoImage.width - cropWidth) / 2;
      } else {
        // Taller than wide or square - crop top/bottom
        logoWidth = containerSize * imgAspect;
        logoHeight = containerSize;
        // Center crop vertically
        cropHeight = this.visualizer.logoImage.width * (logoHeight / logoWidth);
        cropY = (this.visualizer.logoImage.height - cropHeight) / 2;
      }

      const logoX = -logoWidth / 2;
      const logoY = -logoHeight / 2;

      // Apply glow effects if audio is playing
      if (this.isPlaying && this.visualizer.audioLevel > 0.05) {
        const level = this.visualizer.audioLevel;
        const glowRadius = 20 + level * 30;

        // Create multiple layers of glow for better effect
        for (let i = 0; i < 3; i++) {
          ctx.shadowBlur = glowRadius * (3 - i);
          ctx.shadowColor = isDarkTheme
            ? `rgba(100, 181, 246, ${level * (1 - i * 0.2)})`
            : `rgba(33, 150, 243, ${level * (1 - i * 0.2)})`;

          // Draw the logo with crop parameters
          ctx.drawImage(
            this.visualizer.logoImage,
            cropX, cropY, cropWidth, cropHeight,  // Source rectangle (cropped)
            logoX, logoY, logoWidth, logoHeight   // Destination rectangle
          );
        }
      } else {
        // No glow - just draw the logo normally
        ctx.shadowBlur = 0;
        ctx.drawImage(
          this.visualizer.logoImage,
          cropX, cropY, cropWidth, cropHeight,  // Source rectangle (cropped)
          logoX, logoY, logoWidth, logoHeight   // Destination rectangle
        );
      }

      // Add pulsing ring effect when playing
      if (this.isPlaying && this.visualizer.audioLevel > 0.05) {
        const level = this.visualizer.audioLevel;
        const time = Date.now() * 0.001;
        const pulse = Math.sin(time * 3) * 0.5 + 0.5;

        ctx.strokeStyle = isDarkTheme
          ? `rgba(100, 181, 246, ${level * pulse * 0.5})`
          : `rgba(33, 150, 243, ${level * pulse * 0.5})`;
        ctx.lineWidth = 3 + level * 5;
        ctx.beginPath();
        ctx.arc(0, 0, maxLogoSize / 2 + 15 + level * 25, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Fallback: Draw audio icon placeholder if logo not loaded
      ctx.shadowBlur = 0;

      // Draw a simple audio/music icon as fallback
      const iconColor = isDarkTheme ? '#ffffff' : '#666666';
      ctx.fillStyle = iconColor;
      ctx.strokeStyle = iconColor;
      ctx.lineWidth = 3;

      // Draw music note
      const size = 30;
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', 0, 0);

      // Add rotating ring effect
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.strokeStyle = iconColor;
      ctx.globalAlpha = 0.3;
      ctx.stroke();

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Play/Pause button
    if (this.playPauseBtn) {
      this.playPauseBtn.addEventListener('click', () => {
        this.togglePlayPause();
      });
    }

    // Progress bar seeking
    if (this.progressBar) {
      // Click to seek
      this.progressBar.addEventListener('click', (e) => {
        this.seekFromEvent(e);
      });

      // Drag functionality
      let isDragging = false;

      const startDrag = (e) => {
        isDragging = true;
        this.progressBar.style.cursor = 'grabbing';
        this.progressHandle.style.opacity = '1';
        this.handleSeekDrag(e);
        e.preventDefault();
      };

      const handleDrag = (e) => {
        if (isDragging) {
          this.handleSeekDrag(e);
          e.preventDefault();
        }
      };

      const endDrag = () => {
        if (isDragging) {
          isDragging = false;
          this.progressBar.style.cursor = 'pointer';
        }
      };

      // Mouse events
      this.progressBar.addEventListener('mousedown', startDrag);
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', endDrag);

      // Touch events for mobile
      this.progressBar.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        startDrag(mouseEvent);
      });

      document.addEventListener('touchmove', (e) => {
        if (isDragging) {
          const touch = e.touches[0];
          const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
          });
          handleDrag(mouseEvent);
        }
      });

      document.addEventListener('touchend', endDrag);
    }

    // Volume control
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener('input', (e) => {
        this.setVolume(parseFloat(e.target.value));
      });
    }

    if (this.volumeBtn) {
      this.volumeBtn.addEventListener('click', () => {
        this.toggleMute();
      });
    }

    // Skip and Solve Doubt button
    if (this.skipSolveBtn) {
      this.skipSolveBtn.addEventListener('click', () => {
        this.handleSkipAndSolve();
      });
    }

    // Transcript toggle button
    if (this.transcriptBtn) {
      this.transcriptBtn.addEventListener('click', () => {
        this.toggleTranscript();
      });
    }

    // Speed control
    if (this.speedSelect) {
      this.speedSelect.addEventListener('change', (e) => {
        this.setPlaybackRate(parseFloat(e.target.value));
      });
    }


    // Audio element events
    this.audio.addEventListener('loadstart', () => this.onLoadStart());
    this.audio.addEventListener('canplay', () => this.onCanPlay());
    this.audio.addEventListener('play', () => this.onPlay());
    this.audio.addEventListener('pause', () => this.onPause());
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('error', (e) => this.onError(e));

    // Retry button
    const retryBtn = this.container.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.retry();
      });
    }

    // Window resize for canvas
    window.addEventListener('resize', () => {
      if (this.visualizer) {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
      }
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      if (!this.container.contains(document.activeElement)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seekBackward(5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seekForward(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.adjustVolume(-0.1);
          break;
        case 'KeyM':
          e.preventDefault();
          this.toggleMute();
          break;
        case 'KeyT':
          e.preventDefault();
          this.toggleTranscript();
          break;
      }
    };

    document.addEventListener('keydown', handleKeydown);

    // Store for cleanup
    this._keydownHandler = handleKeydown;
  }

  /**
   * Play the audio
   */
  async play() {
    try {
      await this.audio.play();
    } catch (error) {
      console.error('PrerecordedAudioPlayer: Failed to play audio', error);
      this.callbacks.onError(error);
    }
  }

  /**
   * Pause the audio
   */
  pause() {
    this.audio.pause();
  }

  /**
   * Toggle play/pause state
   */
  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Seek to a specific position
   * @param {number} time - Time in seconds
   */
  seek(time) {
    this.audio.currentTime = time;
  }

  /**
   * Seek to position based on click event
   * @param {MouseEvent} e - Click event
   */
  seekFromEvent(e) {
    if (!this.audio.duration) return;

    const rect = this.progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.seek(percent * this.audio.duration);
  }

  /**
   * Handle seeking during drag
   * @param {MouseEvent} e - Mouse/touch event
   */
  handleSeekDrag(e) {
    if (!this.audio.duration) return;

    const rect = this.progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * this.audio.duration;

    // Update UI immediately for responsive feedback
    this.updateProgressDisplay(newTime);

    // Seek audio
    this.seek(newTime);
  }

  /**
   * Update progress display without triggering audio events
   * @param {number} time - Current time in seconds
   */
  updateProgressDisplay(time) {
    if (!this.audio.duration) return;

    const percent = (time / this.audio.duration) * 100;

    if (this.progressFill) {
      this.progressFill.style.width = `${percent}%`;
    }

    if (this.progressHandle) {
      this.progressHandle.style.left = `${percent}%`;
    }

    if (this.currentTimeDisplay) {
      this.currentTimeDisplay.textContent = this.formatTime(time);
    }
  }

  /**
   * Seek backward by specified seconds
   * @param {number} seconds - Seconds to seek backward
   */
  seekBackward(seconds = 5) {
    this.seek(Math.max(0, this.audio.currentTime - seconds));
  }

  /**
   * Seek forward by specified seconds
   * @param {number} seconds - Seconds to seek forward
   */
  seekForward(seconds = 5) {
    this.seek(Math.min(this.audio.duration, this.audio.currentTime + seconds));
  }

  /**
   * Set volume
   * @param {number} volume - Volume level (0-1)
   */
  setVolume(volume) {
    volume = Math.max(0, Math.min(1, volume));

    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    } else {
      this.audio.volume = volume;
    }

    if (this.volumeSlider) {
      this.volumeSlider.value = volume;
    }
    this.updateVolumeIcon();
  }

  /**
   * Adjust volume by specified amount
   * @param {number} delta - Volume adjustment amount
   */
  adjustVolume(delta) {
    this.setVolume(this.audio.volume + delta);
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.updateVolumeIcon();
  }

  /**
   * Set playback rate
   * @param {number} rate - Playback rate
   */
  setPlaybackRate(rate) {
    this.audio.playbackRate = rate;
    this.speedSelect.value = rate;
  }

  /**
   * Format time for display
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time (MM:SS or HH:MM:SS)
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    if (!this.audio.duration) return;

    const percent = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressFill.style.width = `${percent}%`;
    this.progressHandle.style.left = `${percent}%`;
    this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
  }

  /**
   * Update volume icon based on current volume and mute state
   */
  updateVolumeIcon() {
    const volumeIcon = this.container.querySelector('.volume-icon');
    const mutedIcon = this.container.querySelector('.muted-icon');

    const currentVolume = this.gainNode ? this.gainNode.gain.value : this.audio.volume;

    if (this.audio.muted || currentVolume === 0) {
      if (volumeIcon) volumeIcon.style.display = 'none';
      if (mutedIcon) mutedIcon.style.display = 'block';
    } else {
      if (volumeIcon) volumeIcon.style.display = 'block';
      if (mutedIcon) mutedIcon.style.display = 'none';
    }
  }

  /**
   * Toggle transcript visibility
   */
  toggleTranscript() {
    this.isTranscriptVisible = !this.isTranscriptVisible;
    this.updateTranscriptButton();

    // Dispatch custom event for external listeners
    const event = new CustomEvent('transcriptToggle', {
      detail: {
        audioId: this.audioConfig.id,
        action: this.isTranscriptVisible ? 'shown' : 'hidden',
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);

    console.log(`PrerecordedAudioPlayer: Transcript ${this.isTranscriptVisible ? 'shown' : 'hidden'} for audio ${this.audioConfig.id}`);
  }

  /**
   * Update transcript button appearance based on visibility state
   */
  updateTranscriptButton() {
    if (!this.transcriptBtn) return;

    const showIcon = this.transcriptBtn.querySelector('.transcript-icon-show');
    const hideIcon = this.transcriptBtn.querySelector('.transcript-icon-hide');

    if (this.isTranscriptVisible) {
      // When transcript is visible, button should indicate "hide transcript"
      this.transcriptBtn.classList.add('active');
      this.transcriptBtn.title = 'Hide Transcript';
      if (showIcon) showIcon.style.display = 'none';
      if (hideIcon) hideIcon.style.display = 'block';
    } else {
      // When transcript is hidden, button should indicate "show transcript"
      this.transcriptBtn.classList.remove('active');
      this.transcriptBtn.title = 'Show Transcript';
      if (showIcon) showIcon.style.display = 'block';
      if (hideIcon) hideIcon.style.display = 'none';
    }
  }

  /**
   * Set transcript manager reference and show transcript button if segments are available
   */
  setTranscriptManager(transcriptManager) {
    this.transcriptManager = transcriptManager;

    // Show transcript button only if transcript has segments
    if (this.transcriptManager && this.transcriptManager.segments && this.transcriptManager.segments.length > 0) {
      if (this.transcriptBtn) {
        this.transcriptBtn.style.display = 'flex';
        console.log(`PrerecordedAudioPlayer: Transcript button shown for audio ${this.audioConfig.id} with ${this.transcriptManager.segments.length} segments`);
      }

      // Remove any existing listener to prevent duplicates
      if (this._transcriptClosedHandler) {
        document.removeEventListener('transcriptClosed', this._transcriptClosedHandler);
      }

      // Listen for transcript closed event from the transcript manager
      this._transcriptClosedHandler = (e) => {
        if (e.detail && e.detail.audioId === this.audioConfig.id) {
          this.isTranscriptVisible = false;
          this.updateTranscriptButtonState();
        }
      };
      document.addEventListener('transcriptClosed', this._transcriptClosedHandler);

    } else {
      if (this.transcriptBtn) {
        this.transcriptBtn.style.display = 'none';
      }
    }
  }

  /**
   * Get current transcript visibility state
   */
  isTranscriptShowing() {
    return this.isTranscriptVisible;
  }

  /**
   * Create SVG icon helper
   */
  createSvgIcon(pathData, viewBox = '0 -960 960 960') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor" width="20" height="20"><path d="${pathData}"/></svg>`;
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(isPlaying) {
    if (this.connectionDot) {
      if (isPlaying) {
        this.connectionDot.classList.remove('disconnected');
      } else {
        this.connectionDot.classList.add('disconnected');
      }
    }

    if (this.connectionStatus) {
      this.connectionStatus.textContent = isPlaying ? 'Playing' : 'Ready';
    }
  }


  /**
   * Event handlers
   */
  onLoadStart() {
    this.showLoading(true);
  }

  onCanPlay() {
    this.showLoading(false);
    this.durationDisplay.textContent = this.formatTime(this.audio.duration);
  }

  onPlay() {
    this.isPlaying = true;

    // Update play/pause button
    if (this.playPauseBtn) {
      this.playPauseBtn.classList.add('active');
      // Pause icon - two vertical bars (Material Icons pause path)
      this.playPauseBtn.innerHTML = this.createSvgIcon('M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z');
      this.playPauseBtn.title = 'Pause';
    }
    // Update connection status
    this.updateConnectionStatus(true);

    // Resume audio context if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.callbacks.onPlay();
  }

  onPause() {
    this.isPlaying = false;

    // Update play/pause button
    if (this.playPauseBtn) {
      this.playPauseBtn.classList.remove('active');
      this.playPauseBtn.innerHTML = this.createSvgIcon('M120-160v-640l760 320-760 320Z');
      this.playPauseBtn.title = 'Play';
    }

    this.callbacks.onPause();
  }

  onTimeUpdate() {
    this.updateProgress();
    this.callbacks.onTimeUpdate(this.audio.currentTime);
  }

  onLoadedMetadata() {
    this.duration = this.audio.duration;
    this.durationDisplay.textContent = this.formatTime(this.audio.duration);
  }

  onEnded() {
    this.isPlaying = false;

    // Update play/pause button
    if (this.playPauseBtn) {
      this.playPauseBtn.classList.remove('active');
      this.playPauseBtn.innerHTML = this.createSvgIcon('M120-160v-640l760 320-760 320Z');
      this.playPauseBtn.title = 'Play';
    }

    // Update connection status
    this.updateConnectionStatus(false);

    // Trigger custom event for voice assistant activation
    this.dispatchAudioCompletedEvent();

    this.callbacks.onEnded();
  }

  /**
   * Handle Skip and Solve Doubt button click
   */
  handleSkipAndSolve() {
    // Pause the audio
    this.pause();

    // CRITICAL: Destroy the 3D SpaceVisualizer to free up WebGL context
    // This is necessary because browsers limit the number of WebGL contexts
    // and the voice widget needs to create its own SpaceVisualizer
    this.destroySpaceVisualizer();

    // Dispatch custom event to trigger voice assistant
    const event = new CustomEvent('skipAndSolveDoubt', {
      detail: {
        audioId: this.audioConfig.id,
        title: this.audioConfig.title,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);

    console.log('PrerecordedAudioPlayer: Skip and Solve Doubt triggered');
  }

  /**
   * Release the 3D Space Visualizer so voice widget can use it
   * Uses the shared manager - doesn't destroy, just releases ownership
   */
  destroySpaceVisualizer() {
    // Use the shared manager to release (not destroy) the visualizer
    if (window.SpaceVisualizerManager && this.spaceVisualizer) {
      console.log('PrerecordedAudioPlayer: Releasing SpaceVisualizer for voice widget');
      window.SpaceVisualizerManager.release('prerecorded-audio-player');
      this.spaceVisualizer = null;
    }

    // Clear the audio level update interval
    if (this.audioLevelUpdateInterval) {
      clearInterval(this.audioLevelUpdateInterval);
      this.audioLevelUpdateInterval = null;
    }

    // Clear the visualizer interface
    if (this.visualizer) {
      this.visualizer.stop && this.visualizer.stop();
      this.visualizer = null;
    }
  }

  /**
   * Dispatch custom event when audio completes
   */
  dispatchAudioCompletedEvent() {
    // Destroy SpaceVisualizer to free WebGL context for voice widget
    this.destroySpaceVisualizer();

    const event = new CustomEvent('audioPlaybackCompleted', {
      detail: {
        audioId: this.audioConfig.id,
        title: this.audioConfig.title,
        duration: this.duration,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(event);
    console.log('PrerecordedAudioPlayer: Audio playback completed event dispatched');
  }

  onError(error) {
    this.showLoading(false);
    this.showError(true, 'Failed to load audio file');
    console.error('PrerecordedAudioPlayer: Audio error', error);
    this.callbacks.onError(error);
  }

  /**
   * UI state helpers
   */
  showLoading(show) {
    const loadingElement = this.container.querySelector('.audio-loading');
    loadingElement.style.display = show ? 'flex' : 'none';
  }

  showError(show, message = 'Failed to load audio') {
    const errorElement = this.container.querySelector('.audio-error');
    const errorMessage = this.container.querySelector('.error-message');

    errorElement.style.display = show ? 'flex' : 'none';
    errorMessage.textContent = message;
  }

  /**
   * Retry loading audio
   */
  retry() {
    this.showError(false);
    this.audio.load();
  }

  /**
   * Set callback functions
   * @param {Object} callbacks - Callback functions
   */
  on(event, callback) {
    if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase() + event.slice(1)}`)) {
      this.callbacks[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] = callback;
    }
  }

  /**
   * Get current playback state
   * @returns {Object} Current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration,
      volume: this.audio.volume,
      playbackRate: this.audio.playbackRate,
      muted: this.audio.muted
    };
  }

  /**
   * Restore playback state from a saved state object
   * Used to resume audio from where user left off when switching modes
   * @param {Object} state - Saved state object with currentTime, volume, playbackRate, muted, and optionally wasPlaying
   * @param {boolean} autoResume - Whether to automatically resume playback if it was playing before
   */
  restoreState(state, autoResume = false) {
    if (!state || !this.audio) {
      console.warn('PrerecordedAudioPlayer: Cannot restore state - invalid state or audio element');
      return;
    }

    // Wait for audio to be ready before seeking
    const restorePlaybackPosition = () => {
      // Restore playback position
      if (typeof state.currentTime === 'number' && !isNaN(state.currentTime) && state.currentTime > 0) {
        this.audio.currentTime = state.currentTime;
        this.updateProgressDisplay(state.currentTime);
      }

      // Restore volume
      if (typeof state.volume === 'number' && !isNaN(state.volume)) {
        this.setVolume(state.volume);
      }

      // Restore playback rate
      if (typeof state.playbackRate === 'number' && !isNaN(state.playbackRate)) {
        this.setPlaybackRate(state.playbackRate);
      }

      // Restore mute state
      if (typeof state.muted === 'boolean') {
        this.audio.muted = state.muted;
        this.updateVolumeIcon();
      }

      // Auto-resume playback if it was playing before and autoResume is enabled
      if (autoResume && state.wasPlaying) {
        // Small delay to ensure state is fully restored before playing
        setTimeout(() => {
          this.play();
        }, 100);
      }
    };

    // Check if audio is ready
    if (this.audio.readyState >= 1) {
      // Audio metadata is loaded, we can seek
      restorePlaybackPosition();
    } else {
      // Wait for audio to load before restoring position
      const handleLoadedMetadata = () => {
        restorePlaybackPosition();
        this.audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
      this.audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }

  /**
   * Destroy the player and cleanup resources
   */
  destroy() {
    // Stop audio
    this.pause();

    // Stop visualizer
    if (this.visualizer) {
      this.visualizer.stop();
    }

    // Cleanup audio context
    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
    }

    // Remove event listeners
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
    }

    if (this._transcriptClosedHandler) {
      document.removeEventListener('transcriptClosed', this._transcriptClosedHandler);
    }

    // Release 3D Space Visualizer (DON'T destroy - it's shared!)
    if (this.spaceVisualizer) {
      if (window.SpaceVisualizerManager) {
        console.log('🎵 PrerecordedAudioPlayer: Releasing shared SpaceVisualizer to manager');
        window.SpaceVisualizerManager.release('prerecorded-audio-player');
      }
      this.spaceVisualizer = null;
    }

    // Clear audio level update interval
    if (this.audioLevelUpdateInterval) {
      clearInterval(this.audioLevelUpdateInterval);
      this.audioLevelUpdateInterval = null;
    }

    // Clear HTML
    this.container.innerHTML = '';

    // Clear references
    this.audio = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.gainNode = null;
    this.visualizer = null;
    this.canvas = null;
    this.playPauseBtn = null;
    this.progressBar = null;
    this.progressFill = null;
    this.currentTimeDisplay = null;
    this.durationDisplay = null;
    this.volumeSlider = null;
    this.speedSelect = null;
    this.volumeBtn = null;
    this.skipSolveBtn = null;
    this.transcriptBtn = null;
    this.connectionDot = null;
    this.connectionStatus = null;
    this.transcriptManager = null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrerecordedAudioPlayer;
} else if (typeof window !== 'undefined') {
  window.PrerecordedAudioPlayer = PrerecordedAudioPlayer;
}
