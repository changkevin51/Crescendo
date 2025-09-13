class NoteTrainingGame {
    constructor() {
        this.pitchDetector = new PitchDetector();
        this.statistics = new NoteStatistics();
        this.isGameActive = false;
        this.isPaused = false;
        this.currentTargetNote = null;
        this.currentTargetOctave = null;
        this.currentTargetFrequency = null;
        this.gameTimer = null;
        this.detectionTimer = null;
        
        // Game state
        this.score = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.totalNotes = 0;
        this.correctNotes = 0;
        this.timePerNote = 5; // seconds
        this.timeRemaining = 0;
        
        // Difficulty settings
        this.difficulties = {
            easy: { minOctave: 4, maxOctave: 4, notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
            medium: { minOctave: 3, maxOctave: 6, notes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] },
            hard: { minOctave: 2, maxOctave: 7, notes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] }
        };
        this.currentDifficulty = 'easy';
        
        // Detection state
        this.detectedNote = null;
        this.detectedOctave = null;
        this.isListening = false;
        this.noteDetected = false;
        
        // UI elements
        this.startGameBtn = document.getElementById('startGameBtn');
        this.pauseGameBtn = document.getElementById('pauseGameBtn');
        this.stopGameBtn = document.getElementById('stopGameBtn');
        this.scoreValue = document.getElementById('scoreValue');
        this.streakValue = document.getElementById('streakValue');
        this.accuracyValue = document.getElementById('accuracyValue');
        this.instructionText = document.getElementById('instructionText');
        this.targetNote = document.getElementById('targetNote');
        this.targetOctave = document.getElementById('targetOctave');
        this.detectedNote = document.getElementById('detectedNote');
        this.detectionStatus = document.getElementById('detectionStatus');
        this.feedbackArea = document.getElementById('feedbackArea');
        this.feedbackMessage = document.getElementById('feedbackMessage');
        this.accuracyDetails = document.getElementById('accuracyDetails');
        this.timerValue = document.getElementById('timerValue');
        this.progressFill = document.getElementById('progressFill');
        this.difficultySelect = document.getElementById('difficultySelect');
        this.timePerNoteSelect = document.getElementById('timePerNote');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.pauseGameBtn.addEventListener('click', () => this.pauseGame());
        this.stopGameBtn.addEventListener('click', () => this.stopGame());
        
        this.difficultySelect.addEventListener('change', (e) => {
            this.currentDifficulty = e.target.value;
        });
        
        this.timePerNoteSelect.addEventListener('change', (e) => {
            this.timePerNote = parseInt(e.target.value);
        });
    }

    async startGame() {
        try {
            // Initialize pitch detector
            await this.pitchDetector.initialize();
            this.pitchDetector.start();
            
            // Reset game state
            this.isGameActive = true;
            this.isPaused = false;
            this.score = 0;
            this.streak = 0;
            this.maxStreak = 0;
            this.totalNotes = 0;
            this.correctNotes = 0;
            
            // Start statistics tracking
            this.statistics.startSession(this.currentDifficulty, this.timePerNote);
            
            // Update UI
            this.startGameBtn.disabled = true;
            this.pauseGameBtn.disabled = false;
            this.stopGameBtn.disabled = false;
            this.difficultySelect.disabled = true;
            this.timePerNoteSelect.disabled = true;
            
            this.updateStats();
            this.nextNote();
            
        } catch (error) {
            console.error('Failed to start game:', error);
            this.detectionStatus.textContent = 'Failed to access microphone. Please check permissions.';
        }
    }

    pauseGame() {
        if (this.isPaused) {
            // Resume
            this.isPaused = false;
            this.pauseGameBtn.textContent = 'Pause';
            this.startNoteTimer();
            this.startDetection();
        } else {
            // Pause
            this.isPaused = true;
            this.pauseGameBtn.textContent = 'Resume';
            this.clearTimers();
            this.stopDetection();
        }
    }

    stopGame() {
        this.isGameActive = false;
        this.isPaused = false;
        this.clearTimers();
        this.stopDetection();
        
        // End statistics tracking
        const gameStats = {
            difficulty: this.currentDifficulty,
            timePerNote: this.timePerNote,
            score: this.score,
            totalNotes: this.totalNotes,
            correctNotes: this.correctNotes,
            maxStreak: this.maxStreak
        };
        this.statistics.endSession(gameStats);
        
        // Update UI
        this.startGameBtn.disabled = false;
        this.pauseGameBtn.disabled = true;
        this.stopGameBtn.disabled = true;
        this.difficultySelect.disabled = false;
        this.timePerNoteSelect.disabled = false;
        this.pauseGameBtn.textContent = 'Pause';
        
        this.showGameOver();
    }

    nextNote() {
        if (!this.isGameActive || this.isPaused) return;
        
        this.clearTimers();
        this.clearFeedback();
        
        // Generate random note
        const difficulty = this.difficulties[this.currentDifficulty];
        const randomNote = difficulty.notes[Math.floor(Math.random() * difficulty.notes.length)];
        const randomOctave = Math.floor(Math.random() * (difficulty.maxOctave - difficulty.minOctave + 1)) + difficulty.minOctave;
        
        this.currentTargetNote = randomNote;
        this.currentTargetOctave = randomOctave;
        this.currentTargetFrequency = this.getTargetFrequency(randomNote, randomOctave);
        this.noteDetected = false;
        
        // Start note tracking in statistics
        this.statistics.startNoteTracking(
            randomNote, 
            randomOctave, 
            this.currentTargetFrequency, 
            this.currentDifficulty, 
            this.timePerNote * 1000
        );
        
        // Update display
        this.targetNote.textContent = randomNote;
        this.targetOctave.textContent = randomOctave;
        this.instructionText.textContent = `Play: ${randomNote}${randomOctave}`;
        this.detectedNote.textContent = '-';
        this.detectionStatus.textContent = 'Listening...';
        
        // Reset visual states
        this.targetNote.className = 'target-note';
        
        // Start timers
        this.timeRemaining = this.timePerNote;
        this.startNoteTimer();
        this.startDetection();
    }

    startNoteTimer() {
        this.gameTimer = setInterval(() => {
            this.timeRemaining -= 0.1;
            this.updateTimer();
            
            if (this.timeRemaining <= 0) {
                this.timeUp();
            }
        }, 100);
    }

    updateTimer() {
        this.timerValue.textContent = `${this.timeRemaining.toFixed(1)}s`;
        
        // Update progress bar
        const progress = (this.timeRemaining / this.timePerNote) * 100;
        this.progressFill.style.width = `${progress}%`;
        
        // Warning color when time is low
        if (this.timeRemaining <= 2) {
            this.timerValue.classList.add('warning');
        } else {
            this.timerValue.classList.remove('warning');
        }
    }

    startDetection() {
        this.isListening = true;
        this.detectionTimer = setInterval(() => {
            if (!this.isListening || this.noteDetected) return;
            
            const pitchResult = this.pitchDetector.detectPitch();
            
            if (pitchResult && pitchResult.frequency > 0 && pitchResult.confidence > 0.1) {
                const noteInfo = this.pitchDetector.frequencyToNote(pitchResult.frequency);
                
                // Record detection sample for statistics
                this.statistics.recordDetectionSample(
                    pitchResult.frequency,
                    noteInfo.note !== '-' ? noteInfo.note : null,
                    noteInfo.octave !== '-' ? noteInfo.octave : null,
                    pitchResult.confidence,
                    pitchResult.volume || 0,
                    pitchResult.timestamp || Date.now()
                );
                
                if (noteInfo.note !== '-' && noteInfo.octave !== '-') {
                    this.detectedNote.textContent = `${noteInfo.note}${noteInfo.octave}`;
                    this.detectionStatus.textContent = `Detected: ${noteInfo.note}${noteInfo.octave} (${pitchResult.confidence.toFixed(2)})`;
                    
                    // Check if correct note
                    if (noteInfo.note === this.currentTargetNote && noteInfo.octave === this.currentTargetOctave) {
                        this.correctNoteDetected(pitchResult.frequency, noteInfo, pitchResult);
                    }
                } else {
                    this.detectedNote.textContent = '-';
                    this.detectionStatus.textContent = `Listening... (${pitchResult.confidence.toFixed(2)})`;
                }
            } else {
                // Record silent sample
                this.statistics.recordDetectionSample(
                    0, null, null, 0, 0, Date.now()
                );
                
                this.detectedNote.textContent = '-';
                this.detectionStatus.textContent = 'Listening...';
            }
        }, 50); // 20fps detection
    }

    correctNoteDetected(frequency, noteInfo, pitchResult) {
        if (this.noteDetected) return; // Prevent multiple detections
        
        this.noteDetected = true;
        this.clearTimers();
        
        // Calculate accuracy based on how close the frequency is to the target
        const targetFreq = this.currentTargetFrequency;
        const freqDifference = Math.abs(frequency - targetFreq);
        const centsDifference = Math.abs(1200 * Math.log2(frequency / targetFreq));
        
        // Score based on accuracy (cents difference)
        let points = 100;
        if (centsDifference > 50) points = 50;
        else if (centsDifference > 20) points = 75;
        else if (centsDifference > 10) points = 90;
        
        // Bonus for speed
        const responseTime = (this.timePerNote * 1000) - (this.timeRemaining * 1000);
        const timeBonus = Math.floor((this.timeRemaining / this.timePerNote) * 20);
        points += timeBonus;
        
        // Streak bonus
        const streakBonus = Math.min(this.streak * 5, 50);
        points += streakBonus;
        
        this.score += points;
        this.streak++;
        this.maxStreak = Math.max(this.maxStreak, this.streak);
        this.correctNotes++;
        this.totalNotes++;
        
        // Prepare detailed data for statistics
        const detectedData = {
            note: noteInfo.note,
            octave: noteInfo.octave,
            frequency: frequency,
            centsDifference: centsDifference,
            frequencyAccuracy: Math.max(0, 100 - (freqDifference / targetFreq * 100)),
            responseTime: responseTime,
            confidence: pitchResult.confidence,
            points: points,
            timeBonus: timeBonus,
            accuracyBonus: streakBonus
        };
        
        const gameStats = {
            streak: this.streak,
            score: this.score,
            totalNotes: this.totalNotes,
            correctNotes: this.correctNotes
        };
        
        // End note tracking with success
        this.statistics.endNoteTracking('correct', detectedData, gameStats);
        
        this.showFeedback(true, points, centsDifference, frequency, targetFreq);
        this.updateStats();
        
        // Visual feedback
        this.targetNote.classList.add('correct');
        
        // Move to next note after delay
        setTimeout(() => {
            this.nextNote();
        }, 2000);
    }

    timeUp() {
        this.clearTimers();
        this.totalNotes++;
        this.streak = 0;
        
        const gameStats = {
            streak: this.streak,
            score: this.score,
            totalNotes: this.totalNotes,
            correctNotes: this.correctNotes
        };
        
        // End note tracking with timeout
        this.statistics.endNoteTracking('timeout', null, gameStats);
        
        this.showFeedback(false, 0, null, null, null);
        this.updateStats();
        
        // Visual feedback
        this.targetNote.classList.add('incorrect');
        
        // Move to next note after delay
        setTimeout(() => {
            this.nextNote();
        }, 2000);
    }

    showFeedback(correct, points, centsDifference, detectedFreq, targetFreq) {
        this.feedbackArea.style.display = 'block';
        
        if (correct) {
            this.feedbackMessage.textContent = `Correct! +${points} points`;
            this.feedbackMessage.className = 'feedback-message correct';
            
            let accuracyText = '';
            if (centsDifference <= 10) {
                accuracyText = `Perfect! (${centsDifference.toFixed(1)} cents off)`;
            } else if (centsDifference <= 20) {
                accuracyText = `Great! (${centsDifference.toFixed(1)} cents off)`;
            } else if (centsDifference <= 50) {
                accuracyText = `Good! (${centsDifference.toFixed(1)} cents off)`;
            } else {
                accuracyText = `Close! (${centsDifference.toFixed(1)} cents off)`;
            }
            
            this.accuracyDetails.textContent = `${accuracyText} | Target: ${targetFreq.toFixed(1)}Hz, You: ${detectedFreq.toFixed(1)}Hz`;
        } else {
            this.feedbackMessage.textContent = 'Time\'s up!';
            this.feedbackMessage.className = 'feedback-message incorrect';
            this.accuracyDetails.textContent = 'Try to play the note faster next time.';
        }
    }

    clearFeedback() {
        this.feedbackMessage.textContent = '';
        this.accuracyDetails.textContent = '';
    }

    updateStats() {
        this.scoreValue.textContent = this.score;
        this.streakValue.textContent = this.streak;
        
        const accuracy = this.totalNotes > 0 ? (this.correctNotes / this.totalNotes * 100) : 0;
        this.accuracyValue.textContent = `${accuracy.toFixed(1)}%`;
    }

    getTargetFrequency(note, octave) {
        // Calculate frequency using A4 = 440Hz as reference
        const noteNumbers = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
        const noteNumber = noteNumbers[note] + (octave * 12);
        const a4NoteNumber = 9 + (4 * 12); // A4
        
        return 440 * Math.pow(2, (noteNumber - a4NoteNumber) / 12);
    }

    clearTimers() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
        this.timerValue.classList.remove('warning');
    }

    stopDetection() {
        this.isListening = false;
        if (this.detectionTimer) {
            clearInterval(this.detectionTimer);
            this.detectionTimer = null;
        }
        if (this.pitchDetector) {
            this.pitchDetector.stop();
        }
    }

    showGameOver() {
        const accuracy = this.totalNotes > 0 ? (this.correctNotes / this.totalNotes * 100) : 0;
        
        this.instructionText.innerHTML = `
            <div class="game-over">
                <h2>Game Over!</h2>
                <div class="final-stats">
                    <div class="final-stat">
                        <div class="final-stat-value">${this.score}</div>
                        <div class="final-stat-label">Final Score</div>
                    </div>
                    <div class="final-stat">
                        <div class="final-stat-value">${this.correctNotes}/${this.totalNotes}</div>
                        <div class="final-stat-label">Notes Correct</div>
                    </div>
                    <div class="final-stat">
                        <div class="final-stat-value">${accuracy.toFixed(1)}%</div>
                        <div class="final-stat-label">Accuracy</div>
                    </div>
                </div>
            </div>
        `;
        
        this.targetNote.textContent = '-';
        this.targetOctave.textContent = '-';
        this.detectedNote.textContent = '-';
        this.detectionStatus.textContent = 'Game stopped';
        this.clearFeedback();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('detectionStatus').textContent = 'Your browser does not support microphone access';
        document.getElementById('startGameBtn').disabled = true;
        return;
    }
    
    if (!window.AudioContext && !window.webkitAudioContext) {
        document.getElementById('detectionStatus').textContent = 'Your browser does not support Web Audio API';
        document.getElementById('startGameBtn').disabled = true;
        return;
    }
    
    // Initialize the game
    window.noteGame = new NoteTrainingGame();
    
    console.log('🎯 Note Training Game loaded successfully!');
    console.log('Click "Start Game" to begin practicing your pitch accuracy.');
});
