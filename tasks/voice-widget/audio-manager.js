/**
 * Audio Manager for Voice Bot
 * Handles all audio recording, processing, and playback
 */

class AudioManager {
    constructor() {
        this.inputContext = null;
        this.outputContext = null;
        this.inputGainNode = null;
        this.outputGainNode = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.audioWorkletNode = null;
        this.isRecording = false;
        this.isInitialized = false;
        this.sources = new Set();
        this.nextStartTime = 0;

        // Event emitter
        this.events = window.VoiceBotUtils.EventUtils.createEmitter();

        // Initialize audio contexts
        this.initializeAudioContexts();
    }

    async initializeAudioContexts() {
        try {
            this.inputContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            this.outputContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000
            });

            this.inputGainNode = this.inputContext.createGain();
            this.outputGainNode = this.outputContext.createGain();

            // Connect output to speakers
            this.outputGainNode.connect(this.outputContext.destination);

            this.isInitialized = true;
            console.log('Audio contexts initialized successfully');
        } catch (error) {
            console.error('Failed to initialize audio contexts:', error);
            this.events.emit('error', { type: 'initialization', error });
        }
    }

    async startRecording() {
        if (!this.isInitialized || this.isRecording) {
            return false;
        }

        try {
            // Resume contexts if suspended
            if (this.inputContext.state === 'suspended') {
                await this.inputContext.resume();
            }

            // Get microphone permission
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                },
                video: false
            });

            // Create audio source and connect to nodes
            this.sourceNode = this.inputContext.createMediaStreamSource(this.mediaStream);
            this.sourceNode.connect(this.inputGainNode);

            // Initialize audio worklet for processing
            await this.initializeAudioWorklet();

            // Start recording
            this.isRecording = true;
            this.events.emit('recordingStarted');

            console.log('Recording started');
            return true;

        } catch (error) {
            console.error('Failed to start recording:', error);
            this.events.emit('error', { type: 'recording', error });
            return false;
        }
    }

    stopRecording() {
        if (!this.isRecording) {
            return;
        }

        console.log('Stopping recording');
        this.isRecording = false;

        // Disconnect audio worklet
        if (this.audioWorkletNode && this.sourceNode) {
            this.audioWorkletNode.disconnect();
            this.sourceNode.disconnect();
        }

        // Stop microphone stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        this.sourceNode = null;
        this.events.emit('recordingStopped');
    }

    async initializeAudioWorklet() {
        try {
            if (!this.inputContext.audioWorklet) {
                throw new Error('AudioWorklet not supported in this browser');
            }

            // Create audio worklet processor inline
            const processorCode = `
                class AudioProcessor extends AudioWorkletProcessor {
                    process(inputs, outputs, parameters) {
                        const input = inputs[0];

                        if (input.length > 0) {
                            const inputChannel = input[0];

                            if (inputChannel.length > 0) {
                                const audioData = new Float32Array(inputChannel);
                                const currentTime = currentFrame / sampleRate;

                                this.port.postMessage({
                                    type: 'audioData',
                                    audioData: audioData,
                                    timestamp: currentTime,
                                    sampleCount: inputChannel.length
                                });
                            }
                        }

                        return true;
                    }
                }

                registerProcessor('audio-processor', AudioProcessor);
            `;

            const blob = new Blob([processorCode], { type: 'application/javascript' });
            const processorUrl = URL.createObjectURL(blob);

            await this.inputContext.audioWorklet.addModule(processorUrl);
            this.audioWorkletNode = new AudioWorkletNode(this.inputContext, 'audio-processor');

            // Handle audio data from worklet
            this.audioWorkletNode.port.onmessage = (event) => {
                if (event.data.type === 'audioData' && this.isRecording) {
                    this.handleAudioData(event.data);
                }
            };

            // Connect to input and output
            this.sourceNode.connect(this.audioWorkletNode);
            this.audioWorkletNode.connect(this.inputContext.destination);

        } catch (error) {
            console.error('Failed to initialize AudioWorklet:', error);
            throw error;
        }
    }

    handleAudioData(audioDataMessage) {
        const processingStart = performance.now();
        const audioData = audioDataMessage.audioData;
        const processingTime = performance.now() - processingStart;

        if (processingTime > 5) {
            console.log(`Audio processing took ${processingTime.toFixed(2)}ms for ${audioData.length} samples`);
        }

        // Convert to blob for transmission
        const audioBlob = window.VoiceBotUtils.AudioUtils.createBlob(audioData);
        this.events.emit('audioData', audioBlob);
    }

    async playAudio(audioBase64) {
        if (!this.isInitialized) {
            throw new Error('Audio manager not initialized');
        }

        try {
            const audioData = window.VoiceBotUtils.AudioUtils.decode(audioBase64);

            // Schedule playback
            this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputContext.currentTime
            );

            const audioBuffer = await window.VoiceBotUtils.AudioUtils.decodeAudioData(
                audioData,
                this.outputContext,
                24000,
                1
            );

            const source = this.outputContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputGainNode);

            // Handle end of playback
            source.addEventListener('ended', () => {
                this.sources.delete(source);
                this.events.emit('audioPlaybackEnded');
            });

            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.sources.add(source);

            this.events.emit('audioPlaybackStarted', { duration: audioBuffer.duration });

        } catch (error) {
            console.error('Error playing audio:', error);
            this.events.emit('error', { type: 'playback', error });
        }
    }

    stopAllPlayback() {
        for (const source of this.sources.values()) {
            try {
                source.stop();
                this.sources.delete(source);
            } catch (e) {
                console.warn('Error stopping audio source:', e);
            }
        }
        this.nextStartTime = this.outputContext.currentTime;
    }

    getInputVolume() {
        if (!this.isInitialized) {
            return 0;
        }

        // Create analyser for volume monitoring
        const analyser = this.inputContext.createAnalyser();
        analyser.fftSize = 256;
        this.inputGainNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        return average / 255; // Normalize to 0-1
    }

    getOutputVolume() {
        if (!this.isInitialized) {
            return 0;
        }

        // Create analyser for volume monitoring
        const analyser = this.outputContext.createAnalyser();
        analyser.fftSize = 256;
        this.outputGainNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        return average / 255; // Normalize to 0-1
    }

    // Get audio nodes for visualization
    getInputNode() {
        return this.inputGainNode;
    }

    getOutputNode() {
        return this.outputGainNode;
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
        this.stopRecording();
        this.stopAllPlayback();

        if (this.inputContext && this.inputContext.state !== 'closed') {
            this.inputContext.close();
        }
        if (this.outputContext && this.outputContext.state !== 'closed') {
            this.outputContext.close();
        }

        this.events.emit('destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioManager;
} else {
    window.AudioManager = AudioManager;
}