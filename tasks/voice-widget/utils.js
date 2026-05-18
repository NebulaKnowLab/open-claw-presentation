/**
 * Voice Bot Utility Functions
 * Vanilla JavaScript implementation
 */

// Audio processing utilities
class AudioUtils {
    static encode(bytes) {
        const binaryArray = Array.from(bytes, (byte) => String.fromCharCode(byte));
        return btoa(binaryArray.join(''));
    }

    static decode(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    static createBlob(data) {
        const l = data.length;
        const int16 = new Int16Array(l);

        for (let i = 0; i < l; i++) {
            const sample = Math.max(-1, Math.min(1, data[i]));
            int16[i] = sample * 32767;
        }

        return {
            data: this.encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    }

    static async decodeAudioData(data, ctx, sampleRate, numChannels) {
        const buffer = ctx.createBuffer(
            numChannels,
            data.length / 2 / numChannels,
            sampleRate,
        );

        const dataInt16 = new Int16Array(data.buffer);
        const l = dataInt16.length;
        const dataFloat32 = new Float32Array(l);
        for (let i = 0; i < l; i++) {
            dataFloat32[i] = dataInt16[i] / 32768.0;
        }

        if (numChannels === 0) {
            buffer.copyToChannel(dataFloat32, 0);
        } else {
            for (let i = 0; i < numChannels; i++) {
                const channel = dataFloat32.filter(
                    (_, index) => index % numChannels === i,
                );
                buffer.copyToChannel(channel, i);
            }
        }

        return buffer;
    }
}

// DOM utilities
class DOMUtils {
    static createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);

        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });

        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });

        return element;
    }

    static addCSS(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    static find(selector, parent = document) {
        return parent.querySelector(selector);
    }

    static findAll(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }

    static createElementNS(namespace, tagName, attributes = {}) {
        const element = document.createElementNS(namespace, tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return element;
    }
}

// Event utilities
class EventUtils {
    static createEmitter() {
        const events = {};

        return {
            on(event, callback) {
                if (!events[event]) events[event] = [];
                events[event].push(callback);
            },

            off(event, callback) {
                if (events[event]) {
                    events[event] = events[event].filter(cb => cb !== callback);
                }
            },

            emit(event, data) {
                if (events[event]) {
                    events[event].forEach(callback => callback(data));
                }
            }
        };
    }
}

// Other utilities
class Utils {
    static formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return '00:00';
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    static getClientId() {
        return Math.random().toString(36).substr(2, 9);
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioUtils, DOMUtils, EventUtils, Utils };
} else {
    window.VoiceBotUtils = { AudioUtils, DOMUtils, EventUtils, Utils };
}
