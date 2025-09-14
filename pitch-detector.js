class PitchDetector {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.isRunning = false;
        
        // Pitch detection settings
        this.sampleRate = 44100;
        this.bufferSize = 4096;
        
        // Note frequencies (A4 = 440Hz)
        this.noteFrequencies = {
            'C': [16.35, 32.70, 65.41, 130.81, 261.63, 523.25, 1046.50, 2093.00],
            'C#': [17.32, 34.65, 69.30, 138.59, 277.18, 554.37, 1108.73, 2217.46],
            'D': [18.35, 36.71, 73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32],
            'D#': [19.45, 38.89, 77.78, 155.56, 311.13, 622.25, 1244.51, 2489.02],
            'E': [20.60, 41.20, 82.41, 164.81, 329.63, 659.25, 1318.51, 2637.02],
            'F': [21.83, 43.65, 87.31, 174.61, 349.23, 698.46, 1396.91, 2793.83],
            'F#': [23.12, 46.25, 92.50, 185.00, 369.99, 739.99, 1479.98, 2959.96],
            'G': [24.50, 49.00, 98.00, 196.00, 392.00, 783.99, 1567.98, 3135.96],
            'G#': [25.96, 51.91, 103.83, 207.65, 415.30, 830.61, 1661.22, 3322.44],
            'A': [27.50, 55.00, 110.00, 220.00, 440.00, 880.00, 1760.00, 3520.00],
            'A#': [29.14, 58.27, 116.54, 233.08, 466.16, 932.33, 1864.66, 3729.31],
            'B': [30.87, 61.74, 123.47, 246.94, 493.88, 987.77, 1975.53, 3951.07]
        };
    }

    async initialize() {
        try {
            // Check if we're in a secure context (required for getUserMedia)
            if (!window.isSecureContext && location.protocol !== 'https:' && location.hostname !== 'localhost') {
                throw new Error('getUserMedia requires HTTPS or localhost');
            }

            let stream;
            
            // Try modern API first
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        } 
                    });
                } catch (modernError) {
                    console.log('Modern getUserMedia failed, trying fallbacks:', modernError);
                    throw modernError;
                }
            } else if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) {
                // Fallback for older browsers
                const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                stream = await new Promise((resolve, reject) => {
                    getUserMedia.call(navigator, { audio: true }, resolve, reject);
                });
            } else {
                throw new Error('No getUserMedia support detected');
            }
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sampleRate = this.audioContext.sampleRate;
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Create analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Connect microphone to analyser
            this.microphone.connect(this.analyser);
            
            // Set up data arrays
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            this.floatArray = new Float32Array(this.bufferLength);
            
            // Configure Meyda
            Meyda.audioContext = this.audioContext;
            Meyda.bufferSize = this.bufferSize;
            Meyda.sampleRate = this.sampleRate;
            
            return true;
        } catch (error) {
            console.error('Error initializing audio:', error);
            throw error;
        }
    }

    frequencyToNote(frequency) {
        if (frequency < 20 || frequency > 4000) {
            return { note: '-', octave: '-', cents: 0 };
        }

        // Calculate the note number (A4 = 69)
        const noteNumber = 12 * Math.log2(frequency / 440) + 69;
        const roundedNoteNumber = Math.round(noteNumber);
        
        // Calculate cents deviation
        const cents = Math.round((noteNumber - roundedNoteNumber) * 100);
        
        // Get note name and octave
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = noteNames[roundedNoteNumber % 12];
        const octave = Math.floor(roundedNoteNumber / 12) - 1;
        
        return { note: noteName, octave: octave, cents: cents };
    }

    detectPitchAutocorrelation(buffer) {
        // Autocorrelation pitch detection
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;
        let foundGoodCorrelation = false;
        const GOOD_ENOUGH_CORRELATION = 0.9;

        // Calculate RMS
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        
        if (rms < 0.01) return { frequency: 0, confidence: 0 };

        let lastCorrelation = 1;
        for (let offset = 1; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;

            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            
            if (correlation > GOOD_ENOUGH_CORRELATION && correlation > lastCorrelation) {
                foundGoodCorrelation = true;
                if (correlation > bestCorrelation) {
                    bestCorrelation = correlation;
                    bestOffset = offset;
                }
            } else if (foundGoodCorrelation) {
                break;
            }
            lastCorrelation = correlation;
        }
        
        if (bestCorrelation > 0.01) {
            const fundamentalFreq = this.sampleRate / bestOffset;
            return { frequency: fundamentalFreq, confidence: bestCorrelation };
        }
        
        return { frequency: 0, confidence: 0 };
    }

    detectPitchFFT(buffer) {
        // FFT-based pitch detection using frequency domain
        const fft = new Float32Array(this.bufferLength);
        this.analyser.getFloatFrequencyData(fft);
        
        let maxMagnitude = -Infinity;
        let maxIndex = 0;
        
        // Find the peak frequency
        for (let i = 1; i < fft.length / 2; i++) {
            if (fft[i] > maxMagnitude) {
                maxMagnitude = fft[i];
                maxIndex = i;
            }
        }
        
        // Convert bin to frequency
        const frequency = maxIndex * this.sampleRate / (2 * fft.length);
        const confidence = Math.max(0, (maxMagnitude + 100) / 100); // Normalize dB to 0-1
        
        return { frequency, confidence };
    }

    detectPitchMeyda(buffer) {
        try {
            // Use Meyda's chroma and spectral features
            const features = Meyda.extract(['chroma', 'spectralCentroid', 'rms'], buffer);
            
            if (!features || !features.chroma || features.rms < 0.01) {
                return { frequency: 0, confidence: 0 };
            }
            
            // Find the dominant chroma bin
            let maxChroma = 0;
            let maxChromaIndex = 0;
            
            for (let i = 0; i < features.chroma.length; i++) {
                if (features.chroma[i] > maxChroma) {
                    maxChroma = features.chroma[i];
                    maxChromaIndex = i;
                }
            }
            
            // Estimate frequency from spectral centroid and chroma
            const frequency = features.spectralCentroid || 0;
            const confidence = Math.min(maxChroma * features.rms * 10, 1);
            
            return { frequency, confidence };
        } catch (error) {
            console.error('Meyda detection error:', error);
            return { frequency: 0, confidence: 0 };
        }
    }

    detectPitch() {
        if (!this.analyser) return null;

        // Get time domain data for autocorrelation
        this.analyser.getFloatTimeDomainData(this.floatArray);
        
        // Calculate volume (RMS)
        const volume = this.calculateVolume(this.floatArray);
        
        // Try multiple detection methods
        const autocorrelation = this.detectPitchAutocorrelation(this.floatArray);
        const fft = this.detectPitchFFT(this.floatArray);
        const meyda = this.detectPitchMeyda(this.floatArray);
        
        // Choose the best result based on confidence
        const results = [
            { ...autocorrelation, method: 'Autocorrelation' },
            { ...fft, method: 'FFT' },
            { ...meyda, method: 'Meyda' }
        ].filter(r => r.frequency > 20 && r.frequency < 4000);
        
        if (results.length === 0) {
            return { frequency: 0, confidence: 0, method: 'None', volume: volume, timestamp: Date.now() };
        }
        
        // Return the result with highest confidence
        const bestResult = results.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        );
        
        return { ...bestResult, volume: volume, timestamp: Date.now() };
    }

    getWaveformData() {
        if (!this.analyser) return null;
        
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    }

    getFrequencyData() {
        if (!this.analyser) return null;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    start() {
        this.isRunning = true;
    }

    stop() {
        this.isRunning = false;
        if (this.audioContext) {
            this.audioContext.suspend();
        }
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.isRunning = true;
    }

    calculateVolume(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        // Convert to relative volume (0-100)
        return Math.min(100, rms * 1000);
    }

    getVolumeLevel() {
        if (!this.analyser) return 0;
        
        this.analyser.getFloatTimeDomainData(this.floatArray);
        return this.calculateVolume(this.floatArray);
    }
}
