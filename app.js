class CrescendoApp {
    constructor() {
        this.pitchDetector = new PitchDetector();
        this.isDetecting = false;
        this.animationId = null;
        
        // UI elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.noteName = document.getElementById('noteName');
        this.noteOctave = document.getElementById('noteOctave');
        this.frequencyValue = document.getElementById('frequencyValue');
        this.confidenceFill = document.getElementById('confidenceFill');
        this.confidenceValue = document.getElementById('confidenceValue');
        this.status = document.getElementById('status');
        this.detectionMethod = document.getElementById('detectionMethod');
        this.canvas = document.getElementById('waveform');
        this.canvasCtx = this.canvas.getContext('2d');
        
        this.setupEventListeners();
        this.setupCanvas();
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startDetection());
        this.stopBtn.addEventListener('click', () => this.stopDetection());
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isDetecting) {
                this.pauseDetection();
            } else if (!document.hidden && this.isDetecting) {
                this.resumeDetection();
            }
        });
    }

    setupCanvas() {
        // Set up canvas for high DPI displays
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.canvasCtx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    async startDetection() {
        try {
            this.updateStatus('Initializing audio...', 'warning');
            this.startBtn.disabled = true;
            
            await this.pitchDetector.initialize();
            
            this.isDetecting = true;
            this.pitchDetector.start();
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            this.updateStatus('Listening for audio input...', 'success');
            this.startAnalysis();
            
        } catch (error) {
            console.error('Failed to start detection:', error);
            this.updateStatus('Failed to access microphone. Please check permissions.', 'error');
            this.startBtn.disabled = false;
        }
    }

    stopDetection() {
        this.isDetecting = false;
        this.pitchDetector.stop();
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        this.resetDisplay();
        this.updateStatus('Detection stopped', 'info');
        this.clearCanvas();
    }

    pauseDetection() {
        if (this.isDetecting) {
            this.pitchDetector.stop();
            this.updateStatus('Detection paused (tab not visible)', 'warning');
        }
    }

    resumeDetection() {
        if (this.isDetecting) {
            this.pitchDetector.resume();
            this.updateStatus('Listening for audio input...', 'success');
        }
    }

    startAnalysis() {
        const analyze = () => {
            if (!this.isDetecting) return;
            
            const pitchResult = this.pitchDetector.detectPitch();
            
            if (pitchResult && pitchResult.frequency > 0 && pitchResult.confidence > 0.1) {
                const noteInfo = this.pitchDetector.frequencyToNote(pitchResult.frequency);
                this.updateDisplay(pitchResult.frequency, noteInfo, pitchResult.confidence, pitchResult.method);
            } else {
                this.updateDisplay(0, { note: '-', octave: '-' }, 0, pitchResult?.method || 'None');
            }
            
            this.drawWaveform();
            this.animationId = requestAnimationFrame(analyze);
        };
        
        analyze();
    }

    updateDisplay(frequency, noteInfo, confidence, method) {
        // Update note display
        this.noteName.textContent = noteInfo.note;
        this.noteOctave.textContent = noteInfo.octave !== '-' ? noteInfo.octave : '';
        
        // Update frequency display
        this.frequencyValue.textContent = frequency > 0 ? frequency.toFixed(2) : '0.00';
        
        // Update confidence display
        const confidencePercent = Math.round(confidence * 100);
        this.confidenceFill.style.width = `${confidencePercent}%`;
        this.confidenceValue.textContent = `${confidencePercent}%`;
        
        // Update detection method
        this.detectionMethod.textContent = `Method: ${method}`;
        
        // Add visual feedback for strong signals
        if (confidence > 0.7) {
            this.noteName.classList.add('pulse');
        } else {
            this.noteName.classList.remove('pulse');
        }
        
        // Color coding based on confidence
        if (confidence > 0.8) {
            this.confidenceFill.style.background = 'linear-gradient(90deg, #4ecdc4, #44a08d)';
        } else if (confidence > 0.5) {
            this.confidenceFill.style.background = 'linear-gradient(90deg, #ffeaa7, #fdcb6e)';
        } else {
            this.confidenceFill.style.background = 'linear-gradient(90deg, #ff7675, #fd79a8)';
        }
    }

    resetDisplay() {
        this.noteName.textContent = '-';
        this.noteOctave.textContent = '';
        this.frequencyValue.textContent = '0.00';
        this.confidenceFill.style.width = '0%';
        this.confidenceValue.textContent = '0%';
        this.detectionMethod.textContent = 'Method: -';
        this.noteName.classList.remove('pulse');
    }

    drawWaveform() {
        const waveformData = this.pitchDetector.getWaveformData();
        if (!waveformData) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.canvasCtx.fillStyle = '#f8f9fa';
        this.canvasCtx.fillRect(0, 0, width, height);
        
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#667eea';
        this.canvasCtx.beginPath();
        
        const sliceWidth = width / waveformData.length;
        let x = 0;
        
        for (let i = 0; i < waveformData.length; i++) {
            const v = waveformData[i] / 128.0;
            const y = v * height / 2;
            
            if (i === 0) {
                this.canvasCtx.moveTo(x, y);
            } else {
                this.canvasCtx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.canvasCtx.stroke();
        
        // Draw center line
        this.canvasCtx.strokeStyle = '#dee2e6';
        this.canvasCtx.lineWidth = 1;
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(0, height / 2);
        this.canvasCtx.lineTo(width, height / 2);
        this.canvasCtx.stroke();
    }

    clearCanvas() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.canvasCtx.fillStyle = '#f8f9fa';
        this.canvasCtx.fillRect(0, 0, width, height);
        
        // Draw center line
        this.canvasCtx.strokeStyle = '#dee2e6';
        this.canvasCtx.lineWidth = 1;
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(0, height / 2);
        this.canvasCtx.lineTo(width, height / 2);
        this.canvasCtx.stroke();
    }

    updateStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = 'Your browser does not support microphone access';
        document.getElementById('status').className = 'status error';
        document.getElementById('startBtn').disabled = true;
        return;
    }
    
    if (!window.AudioContext && !window.webkitAudioContext) {
        document.getElementById('status').textContent = 'Your browser does not support Web Audio API';
        document.getElementById('status').className = 'status error';
        document.getElementById('startBtn').disabled = true;
        return;
    }
    
    // Initialize the app
    window.crescendoApp = new CrescendoApp();
    
    // Add some helpful information
    console.log('🎵 Crescendo Audio Pitch Detector loaded successfully!');
    console.log('Click "Start Detection" to begin analyzing audio input.');
});
