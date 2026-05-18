class TranscriptManager {
  constructor(container, segments, audioPlayer) {
    // Initialize container
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) {
      throw new Error('TranscriptManager: Container element not found');
    }

    // Transcript data
    this.segments = segments || [];
    this.audioPlayer = audioPlayer;

    // State tracking
    this.currentSegmentIndex = -1;
    this.isHovering = false;
    this.isVisible = false; // Start hidden by default

    // UI elements
    this.transcriptContainer = null;

    // Event callbacks
    this.callbacks = {
      onSegmentClick: (segment) => { },
    };

    // Initialize
    this.init();
  }

  /**
   * Initialize the transcript manager
   */
  init() {
    this.injectStyles();
    this.createHTML();
    this.renderTranscript();
    this.bindEvents();
    this.setupAudioPlayerIntegration();

    // Hide transcript initially
    this.container.style.display = 'none';
    this.container.style.opacity = '0';
  }

  /**
   * Inject Ultra-Modern CSS directly
   */
  injectStyles() {
    const styleId = 'transcript-manager-styles';
    if (document.getElementById(styleId)) return;

    const css = `
      .yt-transcript-modal {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid rgba(139, 69, 116, 0.3);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        overflow: hidden;
      }

      .yt-transcript-header {
        position: relative;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(139, 69, 116, 0.2);
        background: linear-gradient(135deg, rgba(139, 69, 116, 0.95) 0%, rgba(107, 76, 147, 0.95) 100%);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .yt-transcript-title {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
        text-align: center;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }
      
      .yt-close-btn {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        outline: none;
      }

      .yt-close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .yt-close-btn svg {
        width: 14px;
        height: 14px;
        stroke-width: 2.5;
      }

      .yt-transcript-wrapper {
        position: relative;
        width: 100%;
        flex: 1;
        background: #ffffff;
        font-family: 'Roboto', 'Segoe UI', sans-serif;
        overflow: hidden;
      }

      .yt-transcript-content {
        height: 100%;
        overflow-y: auto;
        padding: 24px 16px;
        box-sizing: border-box;
        scroll-behavior: smooth;
        /* Strong fade gradient - creates natural focus on center content */
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
        mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .yt-transcript-content::-webkit-scrollbar { 
        display: none; 
      }

      /* ALL segments look IDENTICAL - no active/inactive distinction */
      /* The fade gradient + scroll-to-center creates the lyrical flow */
      .yt-segment {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.4;
        color: rgba(70, 70, 80, 0.75);
        margin-bottom: 4px;
        padding: 4px 12px;
        cursor: pointer;
        text-align: center;
        border-radius: 4px;
      }

      /* Only hover state for interactivity - no other visual states */
      .yt-segment:hover {
        background: rgba(139, 69, 116, 0.06);
      }

      /* REMOVED: .yt-segment.active - no visual distinction */
      /* REMOVED: .yt-segment.past - no visual distinction */
      /* All segments look the same, sync issues become invisible */

      /* Mobile adjustment */
      @media (max-width: 768px) {
        .yt-transcript-modal {
          border-radius: 8px;
          border: 2px solid #e0e0e0;
          max-height: 400px;
        }

        .yt-transcript-header {
          padding: 10px 12px;
        }

        .yt-transcript-title {
          font-size: 14px;
        }

        .yt-transcript-content {
          padding: 20px 12px;
        }

        .yt-segment {
          font-size: 13px;
          margin-bottom: 3px;
          padding: 3px 10px;
        }
      }

      @media (max-width: 480px) {
        .yt-transcript-modal {
          max-height: 300px;
        }

        .yt-transcript-header {
          padding: 8px 10px;
        }

        .yt-transcript-title {
          font-size: 13px;
        }

        .yt-segment {
          font-size: 12px;
          margin-bottom: 2px;
          padding: 2px 8px;
        }
      }

      .yt-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(100, 100, 110, 0.6);
        font-size: 1rem;
        text-align: center;
        padding: 20px;
      }
    `;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Create HTML structure
   */
  createHTML() {
    this.container.innerHTML = `
      <div class="yt-transcript-modal">
        <div class="yt-transcript-header">
          <h3 class="yt-transcript-title">Transcription</h3>
          <button class="yt-close-btn" aria-label="Close transcription">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="yt-transcript-wrapper">
          <div class="yt-transcript-content"></div>
        </div>
      </div>
    `;

    this.transcriptContainer = this.container.querySelector('.yt-transcript-content');
  }

  /**
   * Render transcript segments (Text Only)
   */
  renderTranscript() {
    if (!this.segments.length) {
      this.transcriptContainer.innerHTML = `
        <div class="yt-empty">No lyrics available</div>
      `;
      return;
    }

    const segmentsHTML = this.segments.map((segment, index) => {
      return `
        <div
          class="yt-segment"
          data-index="${index}"
          data-start="${segment.start}"
          role="button"
        >
          ${this.escapeHtml(segment.text)}
        </div>
      `;
    }).join('');

    this.transcriptContainer.innerHTML = segmentsHTML;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Info: Close button listener
    const closeBtn = this.container.querySelector('.yt-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
      });
    }

    // Segment click events
    this.transcriptContainer.addEventListener('click', (e) => {
      const segment = e.target.closest('.yt-segment');
      if (segment) {
        const index = parseInt(segment.dataset.index);
        this.onSegmentClick(index);
      }
    });

    // Detect user interaction to pause auto-scroll momentarily
    this.transcriptContainer.addEventListener('mouseenter', () => {
      this.isHovering = true;
    });

    this.transcriptContainer.addEventListener('mouseleave', () => {
      this.isHovering = false;
      // Re-center immediately on mouse leave
      this.scrollToSegment(this.currentSegmentIndex);
    });

    this.transcriptContainer.addEventListener('touchstart', () => {
      this.isHovering = true;
    });
  }

  /**
   * Setup integration with audio player
   */
  setupAudioPlayerIntegration() {
    if (!this.audioPlayer) return;

    // Listen for time updates
    this.audioPlayer.on('timeUpdate', (currentTime) => {
      this.highlightCurrentSegment(currentTime);
    });
  }

  /**
   * Highlight the current segment based on playback time
   */
  highlightCurrentSegment(currentTime) {
    const newIndex = this.findCurrentSegmentIndex(currentTime);

    // Only update if the index actually changed
    if (newIndex !== this.currentSegmentIndex) {
      this.currentSegmentIndex = newIndex;
      this.updateVisualState();
    }
  }

  /**
   * Update the classes and scroll position
   */
  updateVisualState() {
    const segments = this.transcriptContainer.querySelectorAll('.yt-segment');

    segments.forEach((segment, index) => {
      segment.classList.remove('active');

      if (index === this.currentSegmentIndex) {
        segment.classList.add('active');
      }
    });

    // Auto-scroll logic (Always active unless user is hovering/interacting)
    if (!this.isHovering && this.currentSegmentIndex !== -1) {
      this.scrollToSegment(this.currentSegmentIndex);
    }
  }

  /**
   * Find the index of the current segment based on time
   */
  findCurrentSegmentIndex(currentTime) {
    // Optimization: Check next segment first if strictly linear playback
    if (this.currentSegmentIndex !== -1 && this.currentSegmentIndex < this.segments.length - 1) {
      const next = this.segments[this.currentSegmentIndex + 1];
      if (currentTime >= next.start && currentTime <= next.end) {
        return this.currentSegmentIndex + 1;
      }
    }

    // Fallback: Linear search (or binary search for huge lists)
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      // Logic: It's current if time is between start and end
      // OR if it's the last segment and time is past start
      if ((currentTime >= segment.start && currentTime <= segment.end) ||
        (i === this.segments.length - 1 && currentTime >= segment.start)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Scroll segment to the EXACT center of the container
   */
  scrollToSegment(index) {
    const segments = this.transcriptContainer.querySelectorAll('.yt-segment');
    const targetSegment = segments[index];

    if (targetSegment && this.transcriptContainer) {
      // Calculate the position to center the segment within the transcript container
      const containerHeight = this.transcriptContainer.clientHeight;
      const segmentTop = targetSegment.offsetTop;
      const segmentHeight = targetSegment.offsetHeight;
      const scrollTop = segmentTop - (containerHeight / 2) + (segmentHeight / 2);

      // Scroll only the transcript container, not the entire page
      this.transcriptContainer.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Handle segment click
   */
  onSegmentClick(index) {
    const segment = this.segments[index];
    if (segment && this.audioPlayer) {
      this.audioPlayer.seek(segment.start);
    }

    // Force visual update immediately for responsiveness
    this.currentSegmentIndex = index;
    this.updateVisualState();

    this.callbacks.onSegmentClick(segment);
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Set callback functions
   */
  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
  }

  /**
   * Update segments dynamically
   */
  updateSegments(segments) {
    this.segments = segments;
    this.currentSegmentIndex = -1;
    this.renderTranscript();
  }

  /**
   * Show the transcript
   */
  show() {
    this.isVisible = true;

    // Match audio player height if possible
    this.matchAudioPlayerHeight();

    // Add responsive class to audio player container
    this.addTranscriptActiveClass();

    this.container.style.display = 'block';
    this.container.style.overflow = 'hidden';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateX(20px)';

    // Smooth slide-in animation from right
    setTimeout(() => {
      this.container.style.transition = 'all 0.3s ease-out';
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateX(0)';
    }, 50);

    console.log('TranscriptManager: Transcript shown');
  }

  /**
   * Match the height of the audio player
   */
  matchAudioPlayerHeight() {
    if (!this.audioPlayer) return;

    try {
      // Try to get the audio player container
      const audioPlayerElement = this.audioPlayer.container;
      if (audioPlayerElement) {
        const audioPlayerHeight = audioPlayerElement.offsetHeight;
        if (audioPlayerHeight > 0) {
          // Set transcript container to match audio player height
          this.container.style.height = `${audioPlayerHeight}px`;
          this.container.style.minHeight = `${audioPlayerHeight}px`;
          console.log(`TranscriptManager: Set transcript height to match audio player: ${audioPlayerHeight}px`);
        }
      }
    } catch (error) {
      console.warn('TranscriptManager: Could not match audio player height:', error);
    }
  }

  /**
   * Hide the transcript
   */
  hide() {
    this.isVisible = false;

    // Remove responsive class from audio player container
    this.removeTranscriptActiveClass();

    this.container.style.transition = 'all 0.3s ease-out';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateX(20px)';

    // Hide after animation completes
    setTimeout(() => {
      if (!this.isVisible) {
        this.container.style.display = 'none';
        this.container.style.height = '0px';
        this.container.style.overflow = 'hidden';
      }
    }, 300);

    // Dispatch event to notify listeners (like audio player)
    if (this.audioPlayer && this.audioPlayer.audioConfig) {
      const event = new CustomEvent('transcriptClosed', {
        detail: {
          audioId: this.audioPlayer.audioConfig.id
        }
      });
      document.dispatchEvent(event);
    }

    console.log('TranscriptManager: Transcript hidden');
  }

  /**
   * Toggle transcript visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
    return this.isVisible;
  }

  /**
   * Check if transcript is visible
   */
  isShown() {
    return this.isVisible;
  }

  /**
   * Add transcript active class to audio player for responsive behavior
   */
  addTranscriptActiveClass() {
    try {
      // Find the audio player container by looking for the parent section
      const prerecordedSection = this.container.closest('.prerecorded-audio-section');
      if (prerecordedSection) {
        // Add class to the section
        prerecordedSection.classList.add('transcript-active');

        // Find the audio player container
        const audioPlayerContainer = prerecordedSection.querySelector('[id^="audio-player-container-"]');
        if (audioPlayerContainer) {
          audioPlayerContainer.classList.add('transcript-active');
        }
      }
    } catch (error) {
      console.warn('TranscriptManager: Could not add transcript active class:', error);
    }
  }

  /**
   * Remove transcript active class from audio player
   */
  removeTranscriptActiveClass() {
    try {
      // Find the audio player container by looking for the parent section
      const prerecordedSection = this.container.closest('.prerecorded-audio-section');
      if (prerecordedSection) {
        // Remove class from the section
        prerecordedSection.classList.remove('transcript-active');

        // Find the audio player container
        const audioPlayerContainer = prerecordedSection.querySelector('[id^="audio-player-container-"]');
        if (audioPlayerContainer) {
          audioPlayerContainer.classList.remove('transcript-active');
        }
      }
    } catch (error) {
      console.warn('TranscriptManager: Could not remove transcript active class:', error);
    }
  }

  /**
   * Destroy the transcript manager
   */
  destroy() {
    this.removeTranscriptActiveClass();
    this.container.innerHTML = '';
    this.transcriptContainer = null;
    this.audioPlayer = null;
    this.segments = [];
    this.isVisible = false;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptManager;
} else if (typeof window !== 'undefined') {
  window.TranscriptManager = TranscriptManager;
}

