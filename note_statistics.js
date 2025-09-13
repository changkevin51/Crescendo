class NoteStatistics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = null;
        this.sessionEndTime = null;
        this.noteEvents = [];
        this.currentNoteStartTime = null;
        this.currentNoteData = null;
        this.detectionSamples = [];
        this.isTracking = false;
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    startSession(difficulty, timePerNote) {
        this.sessionStartTime = new Date().toISOString();
        this.sessionId = this.generateSessionId();
        this.noteEvents = [];
        this.isTracking = true;
        
        console.log(`📊 Statistics tracking started for session: ${this.sessionId}`);
    }

    endSession(gameStats) {
        this.sessionEndTime = new Date().toISOString();
        this.isTracking = false;
        
        // Save complete session data
        this.saveSessionData(gameStats);
        
        console.log(`📊 Statistics tracking ended for session: ${this.sessionId}`);
        console.log(`📊 Total note events recorded: ${this.noteEvents.length}`);
    }

    startNoteTracking(targetNote, targetOctave, targetFrequency, difficulty, timePerNote) {
        if (!this.isTracking) return;

        this.currentNoteStartTime = Date.now();
        this.detectionSamples = [];
        
        this.currentNoteData = {
            noteId: `note_${this.sessionId}_${this.noteEvents.length + 1}`,
            sessionId: this.sessionId,
            targetNote: targetNote,
            targetOctave: targetOctave,
            targetFrequency: targetFrequency,
            targetNoteString: `${targetNote}${targetOctave}`,
            difficulty: difficulty,
            timeAllowed: timePerNote,
            startTime: new Date().toISOString(),
            startTimestamp: this.currentNoteStartTime,
            endTime: null,
            endTimestamp: null,
            duration: null,
            outcome: null, // 'correct', 'incorrect', 'missed', 'timeout'
            detectedNote: null,
            detectedOctave: null,
            detectedFrequency: null,
            detectedNoteString: null,
            accuracyCents: null,
            frequencyAccuracy: null,
            responseTime: null,
            holdDuration: null,
            averageVolume: null,
            maxVolume: null,
            volumeStability: null,
            pitchStability: null,
            confidenceScore: null,
            detectionSamples: [],
            pointsEarned: 0,
            streakAtTime: 0,
            timeBonus: 0,
            accuracyBonus: 0
        };
    }

    recordDetectionSample(frequency, note, octave, confidence, volume, timestamp) {
        if (!this.isTracking || !this.currentNoteData) return;

        const relativeTime = timestamp - this.currentNoteStartTime;
        
        const sample = {
            timestamp: new Date(timestamp).toISOString(),
            relativeTime: relativeTime,
            frequency: frequency || 0,
            note: note || null,
            octave: octave || null,
            noteString: (note && octave) ? `${note}${octave}` : null,
            confidence: confidence || 0,
            volume: volume || 0,
            isCorrectNote: (note === this.currentNoteData.targetNote && octave === this.currentNoteData.targetOctave),
            centsDifference: this.calculateCentsDifference(frequency, this.currentNoteData.targetFrequency),
            volumeCategory: this.categorizeVolume(volume || 0),
            detectionQuality: this.assessDetectionQuality(confidence || 0, volume || 0)
        };

        this.detectionSamples.push(sample);
        
        // Track continuous performance metrics
        this.updateContinuousMetrics(sample);
    }

    endNoteTracking(outcome, detectedData = null, gameStats = null) {
        if (!this.isTracking || !this.currentNoteData) return;

        const endTime = Date.now();
        const duration = endTime - this.currentNoteStartTime;

        this.currentNoteData.endTime = new Date().toISOString();
        this.currentNoteData.endTimestamp = endTime;
        this.currentNoteData.duration = duration;
        this.currentNoteData.outcome = outcome;
        this.currentNoteData.detectionSamples = [...this.detectionSamples];

        if (detectedData) {
            this.currentNoteData.detectedNote = detectedData.note;
            this.currentNoteData.detectedOctave = detectedData.octave;
            this.currentNoteData.detectedFrequency = detectedData.frequency;
            this.currentNoteData.detectedNoteString = `${detectedData.note}${detectedData.octave}`;
            this.currentNoteData.accuracyCents = detectedData.centsDifference;
            this.currentNoteData.frequencyAccuracy = detectedData.frequencyAccuracy;
            this.currentNoteData.responseTime = detectedData.responseTime;
            this.currentNoteData.confidenceScore = detectedData.confidence;
            this.currentNoteData.pointsEarned = detectedData.points || 0;
            this.currentNoteData.timeBonus = detectedData.timeBonus || 0;
            this.currentNoteData.accuracyBonus = detectedData.accuracyBonus || 0;
        }

        if (gameStats) {
            this.currentNoteData.streakAtTime = gameStats.streak;
        }

        // Calculate advanced statistics from detection samples
        this.calculateAdvancedStats();

        // Add to note events
        this.noteEvents.push({...this.currentNoteData});

        // Reset current note data
        this.currentNoteData = null;
        this.detectionSamples = [];

        console.log(`📊 Note event recorded: ${outcome} - ${this.noteEvents.length} total events`);
    }

    calculateAdvancedStats() {
        if (!this.currentNoteData || this.detectionSamples.length === 0) return;

        const validSamples = this.detectionSamples.filter(s => s.frequency > 0);
        const correctSamples = this.detectionSamples.filter(s => s.isCorrectNote);
        const volumeSamples = this.detectionSamples.filter(s => s.volume > 0);

        // Enhanced timing analysis
        this.calculateTimingMetrics(correctSamples);
        
        // Enhanced volume analysis
        this.calculateVolumeMetrics(volumeSamples);
        
        // Enhanced pitch analysis
        this.calculatePitchMetrics(correctSamples, validSamples);
        
        // Performance quality assessment
        this.calculatePerformanceQuality();
        
        // Error pattern analysis
        this.analyzeErrorPatterns(validSamples);
    }

    async saveSessionData(gameStats) {
        const sessionData = {
            gameSession: {
                sessionId: this.sessionId,
                startTime: this.sessionStartTime,
                endTime: this.sessionEndTime,
                difficulty: gameStats.difficulty || 'unknown',
                timePerNote: gameStats.timePerNote || 0,
                totalScore: gameStats.score || 0,
                totalNotes: gameStats.totalNotes || 0,
                correctNotes: gameStats.correctNotes || 0,
                accuracy: gameStats.totalNotes > 0 ? (gameStats.correctNotes / gameStats.totalNotes * 100) : 0,
                maxStreak: gameStats.maxStreak || 0,
                sessionDuration: this.sessionEndTime && this.sessionStartTime ? 
                    new Date(this.sessionEndTime) - new Date(this.sessionStartTime) : 0
            },
            noteEvents: this.noteEvents.map(event => ({
                ...event,
                // Ensure DynamoDB compatibility by converting any undefined values to null
                ...Object.fromEntries(
                    Object.entries(event).map(([key, value]) => [key, value === undefined ? null : value])
                )
            }))
        };

        try {
            // Save to local JSON file (in a real app, this would go to DynamoDB)
            await this.saveToLocalFile(sessionData);
            console.log(`📊 Session data saved successfully: ${this.noteEvents.length} note events`);
        } catch (error) {
            console.error('📊 Failed to save session data:', error);
        }
    }

    async saveToLocalFile(sessionData) {
        try {
            // Create DynamoDB-compatible format
            const dynamoDbData = this.convertToDynamoDbFormat(sessionData);
            
            // Save both formats
            await this.saveJsonFile(sessionData, 'detailed');
            await this.saveJsonFile(dynamoDbData, 'dynamodb');
            
            // Also save to browser's localStorage for persistence
            this.saveToLocalStorage(sessionData);
            
        } catch (error) {
            console.error('📊 Error saving session data:', error);
        }
    }
    
    async saveJsonFile(data, type) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `crescendo-session-${type}-${this.sessionId}-${timestamp}.json`;
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(dataBlob);
        downloadLink.download = fileName;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        
        // Auto-download the file
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        console.log(`📊 ${type} session data saved: ${fileName}`);
    }
    
    saveToLocalStorage(sessionData) {
        try {
            const storageKey = `crescendo_session_${this.sessionId}`;
            localStorage.setItem(storageKey, JSON.stringify(sessionData));
            
            // Keep only last 10 sessions in localStorage
            const allSessions = Object.keys(localStorage)
                .filter(key => key.startsWith('crescendo_session_'))
                .sort();
            
            if (allSessions.length > 10) {
                for (let i = 0; i < allSessions.length - 10; i++) {
                    localStorage.removeItem(allSessions[i]);
                }
            }
        } catch (error) {
            console.warn('📊 Could not save to localStorage:', error);
        }
    }

    // Method to get current session statistics
    getCurrentSessionStats() {
        if (!this.isTracking) return null;

        const completedEvents = this.noteEvents.filter(event => event.outcome !== null);
        const correctEvents = completedEvents.filter(event => event.outcome === 'correct');
        
        return {
            sessionId: this.sessionId,
            totalEvents: completedEvents.length,
            correctEvents: correctEvents.length,
            accuracy: completedEvents.length > 0 ? (correctEvents.length / completedEvents.length * 100) : 0,
            averageResponseTime: correctEvents.length > 0 ? 
                correctEvents.reduce((sum, event) => sum + (event.responseTime || 0), 0) / correctEvents.length : 0,
            averageAccuracy: correctEvents.length > 0 ?
                correctEvents.reduce((sum, event) => sum + (event.frequencyAccuracy || 0), 0) / correctEvents.length : 0
        };
    }

    // Method to export data in DynamoDB format
    convertToDynamoDbFormat(sessionData) {
        const items = [];
        
        // Session metadata item
        items.push({
            PK: `SESSION#${this.sessionId}`,
            SK: 'METADATA',
            EntityType: 'SessionMetadata',
            SessionId: this.sessionId,
            StartTime: this.sessionStartTime,
            EndTime: this.sessionEndTime || null,
            Difficulty: sessionData.gameSession.difficulty,
            TimePerNote: sessionData.gameSession.timePerNote,
            TotalScore: sessionData.gameSession.totalScore,
            TotalNotes: sessionData.gameSession.totalNotes,
            CorrectNotes: sessionData.gameSession.correctNotes,
            Accuracy: sessionData.gameSession.accuracy,
            MaxStreak: sessionData.gameSession.maxStreak,
            SessionDuration: sessionData.gameSession.sessionDuration,
            CreatedAt: new Date().toISOString(),
            TTL: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
        });
        
        // Note event items
        sessionData.noteEvents.forEach(event => {
            items.push({
                PK: `SESSION#${this.sessionId}`,
                SK: `NOTE#${event.noteId}`,
                EntityType: 'NoteEvent',
                NoteId: event.noteId,
                SessionId: this.sessionId,
                TargetNote: event.targetNote,
                TargetOctave: event.targetOctave,
                TargetFrequency: event.targetFrequency,
                TargetNoteString: event.targetNoteString,
                Difficulty: event.difficulty,
                TimeAllowed: event.timeAllowed,
                StartTime: event.startTime,
                EndTime: event.endTime,
                Duration: event.duration,
                Outcome: event.outcome,
                DetectedNote: event.detectedNote,
                DetectedOctave: event.detectedOctave,
                DetectedFrequency: event.detectedFrequency,
                DetectedNoteString: event.detectedNoteString,
                AccuracyCents: event.accuracyCents,
                FrequencyAccuracy: event.frequencyAccuracy,
                ResponseTime: event.responseTime,
                HoldDuration: event.holdDuration,
                AverageVolume: event.averageVolume,
                MaxVolume: event.maxVolume,
                VolumeStability: event.volumeStability,
                PitchStability: event.pitchStability,
                ConfidenceScore: event.confidenceScore,
                PointsEarned: event.pointsEarned,
                StreakAtTime: event.streakAtTime,
                TimeBonus: event.timeBonus,
                AccuracyBonus: event.accuracyBonus,
                PerformanceQuality: event.performanceQuality || null,
                ErrorType: event.errorType || null,
                CreatedAt: new Date().toISOString(),
                TTL: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
            });
            
            // Store detection samples as separate items for detailed analysis
            if (event.detectionSamples && event.detectionSamples.length > 0) {
                event.detectionSamples.forEach((sample, index) => {
                    items.push({
                        PK: `SESSION#${this.sessionId}`,
                        SK: `SAMPLE#${event.noteId}#${index.toString().padStart(4, '0')}`,
                        EntityType: 'DetectionSample',
                        NoteId: event.noteId,
                        SessionId: this.sessionId,
                        SampleIndex: index,
                        Timestamp: sample.timestamp,
                        RelativeTime: sample.relativeTime,
                        Frequency: sample.frequency,
                        Note: sample.note,
                        Octave: sample.octave,
                        NoteString: sample.noteString,
                        Confidence: sample.confidence,
                        Volume: sample.volume,
                        IsCorrectNote: sample.isCorrectNote,
                        CentsDifference: sample.centsDifference,
                        VolumeCategory: sample.volumeCategory,
                        DetectionQuality: sample.detectionQuality,
                        CreatedAt: new Date().toISOString(),
                        TTL: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL for samples
                    });
                });
            }
        });
        
        return {
            TableName: 'CrescendoGameStatistics',
            Items: items
        };
    }
    
    // Helper methods for enhanced statistics
    calculateCentsDifference(detectedFreq, targetFreq) {
        if (!detectedFreq || !targetFreq || detectedFreq <= 0 || targetFreq <= 0) return null;
        return Math.round(1200 * Math.log2(detectedFreq / targetFreq));
    }
    
    categorizeVolume(volume) {
        if (volume < 10) return 'silent';
        if (volume < 30) return 'quiet';
        if (volume < 60) return 'moderate';
        if (volume < 85) return 'loud';
        return 'very_loud';
    }
    
    assessDetectionQuality(confidence, volume) {
        if (confidence > 0.8 && volume > 20) return 'excellent';
        if (confidence > 0.6 && volume > 15) return 'good';
        if (confidence > 0.4 && volume > 10) return 'fair';
        if (confidence > 0.2 || volume > 5) return 'poor';
        return 'very_poor';
    }
    
    updateContinuousMetrics(sample) {
        if (!this.currentNoteData.continuousMetrics) {
            this.currentNoteData.continuousMetrics = {
                totalSamples: 0,
                correctSamples: 0,
                avgConfidence: 0,
                avgVolume: 0,
                stabilityScore: 0
            };
        }
        
        const metrics = this.currentNoteData.continuousMetrics;
        metrics.totalSamples++;
        
        if (sample.isCorrectNote) {
            metrics.correctSamples++;
        }
        
        // Running averages
        metrics.avgConfidence = ((metrics.avgConfidence * (metrics.totalSamples - 1)) + sample.confidence) / metrics.totalSamples;
        metrics.avgVolume = ((metrics.avgVolume * (metrics.totalSamples - 1)) + sample.volume) / metrics.totalSamples;
    }
    
    calculateTimingMetrics(correctSamples) {
        if (correctSamples.length === 0) {
            this.currentNoteData.timingAnalysis = {
                responseTime: null,
                holdDuration: 0,
                sustainQuality: 'none',
                timingConsistency: 0
            };
            return;
        }
        
        const firstCorrect = correctSamples[0].relativeTime;
        const lastCorrect = correctSamples[correctSamples.length - 1].relativeTime;
        const holdDuration = lastCorrect - firstCorrect;
        
        // Assess sustain quality
        let sustainQuality = 'poor';
        if (holdDuration > 1000) sustainQuality = 'excellent';
        else if (holdDuration > 500) sustainQuality = 'good';
        else if (holdDuration > 200) sustainQuality = 'fair';
        
        this.currentNoteData.responseTime = firstCorrect;
        this.currentNoteData.holdDuration = holdDuration;
        this.currentNoteData.timingAnalysis = {
            responseTime: firstCorrect,
            holdDuration: holdDuration,
            sustainQuality: sustainQuality,
            timingConsistency: this.calculateTimingConsistency(correctSamples)
        };
    }
    
    calculateVolumeMetrics(volumeSamples) {
        if (volumeSamples.length === 0) {
            this.currentNoteData.volumeAnalysis = {
                averageVolume: 0,
                maxVolume: 0,
                minVolume: 0,
                volumeStability: 0,
                volumeConsistency: 'none'
            };
            return;
        }
        
        const volumes = volumeSamples.map(s => s.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const maxVolume = Math.max(...volumes);
        const minVolume = Math.min(...volumes);
        
        // Calculate volume stability (coefficient of variation)
        const variance = volumes.reduce((acc, vol) => acc + Math.pow(vol - avgVolume, 2), 0) / volumes.length;
        const stdDev = Math.sqrt(variance);
        const volumeStability = avgVolume > 0 ? (stdDev / avgVolume) : 0;
        
        let volumeConsistency = 'poor';
        if (volumeStability < 0.2) volumeConsistency = 'excellent';
        else if (volumeStability < 0.4) volumeConsistency = 'good';
        else if (volumeStability < 0.6) volumeConsistency = 'fair';
        
        this.currentNoteData.averageVolume = avgVolume;
        this.currentNoteData.maxVolume = maxVolume;
        this.currentNoteData.volumeStability = volumeStability;
        this.currentNoteData.volumeAnalysis = {
            averageVolume: avgVolume,
            maxVolume: maxVolume,
            minVolume: minVolume,
            volumeStability: volumeStability,
            volumeConsistency: volumeConsistency
        };
    }
    
    calculatePitchMetrics(correctSamples, validSamples) {
        if (correctSamples.length === 0) {
            this.currentNoteData.pitchAnalysis = {
                pitchStability: 0,
                pitchAccuracy: 0,
                pitchConsistency: 'none'
            };
            return;
        }
        
        const frequencies = correctSamples.map(s => s.frequency);
        const avgFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
        
        // Calculate pitch stability
        const variance = frequencies.reduce((acc, freq) => acc + Math.pow(freq - avgFreq, 2), 0) / frequencies.length;
        const pitchStability = Math.sqrt(variance);
        
        // Calculate overall pitch accuracy
        const targetFreq = this.currentNoteData.targetFrequency;
        const pitchAccuracy = targetFreq > 0 ? Math.max(0, 100 - (Math.abs(avgFreq - targetFreq) / targetFreq * 100)) : 0;
        
        let pitchConsistency = 'poor';
        if (pitchStability < 5) pitchConsistency = 'excellent';
        else if (pitchStability < 15) pitchConsistency = 'good';
        else if (pitchStability < 30) pitchConsistency = 'fair';
        
        this.currentNoteData.pitchStability = pitchStability;
        this.currentNoteData.frequencyAccuracy = pitchAccuracy;
        this.currentNoteData.pitchAnalysis = {
            pitchStability: pitchStability,
            pitchAccuracy: pitchAccuracy,
            pitchConsistency: pitchConsistency
        };
    }
    
    calculatePerformanceQuality() {
        const timing = this.currentNoteData.timingAnalysis || {};
        const volume = this.currentNoteData.volumeAnalysis || {};
        const pitch = this.currentNoteData.pitchAnalysis || {};
        
        let qualityScore = 0;
        let maxScore = 0;
        
        // Timing quality (30% weight)
        if (timing.responseTime !== null) {
            maxScore += 30;
            if (timing.responseTime < 500) qualityScore += 30;
            else if (timing.responseTime < 1000) qualityScore += 20;
            else if (timing.responseTime < 2000) qualityScore += 10;
        }
        
        // Volume quality (20% weight)
        if (volume.volumeConsistency) {
            maxScore += 20;
            switch (volume.volumeConsistency) {
                case 'excellent': qualityScore += 20; break;
                case 'good': qualityScore += 15; break;
                case 'fair': qualityScore += 10; break;
                case 'poor': qualityScore += 5; break;
            }
        }
        
        // Pitch quality (50% weight)
        if (pitch.pitchAccuracy > 0) {
            maxScore += 50;
            qualityScore += (pitch.pitchAccuracy / 100) * 50;
        }
        
        const finalQuality = maxScore > 0 ? (qualityScore / maxScore) * 100 : 0;
        
        let qualityRating = 'poor';
        if (finalQuality >= 90) qualityRating = 'excellent';
        else if (finalQuality >= 75) qualityRating = 'good';
        else if (finalQuality >= 60) qualityRating = 'fair';
        
        this.currentNoteData.performanceQuality = {
            score: Math.round(finalQuality),
            rating: qualityRating,
            breakdown: {
                timing: timing.sustainQuality || 'none',
                volume: volume.volumeConsistency || 'none',
                pitch: pitch.pitchConsistency || 'none'
            }
        };
    }
    
    analyzeErrorPatterns(validSamples) {
        let errorType = null;
        let errorDetails = {};
        
        if (this.currentNoteData.outcome === 'missed' || this.currentNoteData.outcome === 'timeout') {
            errorType = 'no_input';
            errorDetails = {
                reason: this.currentNoteData.outcome,
                samplesDetected: validSamples.length,
                avgVolume: validSamples.length > 0 ? 
                    validSamples.reduce((sum, s) => sum + s.volume, 0) / validSamples.length : 0
            };
        } else if (this.currentNoteData.outcome === 'incorrect') {
            const wrongNotes = validSamples.filter(s => !s.isCorrectNote && s.note);
            if (wrongNotes.length > 0) {
                errorType = 'wrong_note';
                const mostCommonWrong = this.findMostCommonNote(wrongNotes);
                errorDetails = {
                    detectedNote: mostCommonWrong,
                    targetNote: this.currentNoteData.targetNoteString,
                    avgCentsDifference: wrongNotes.reduce((sum, s) => sum + Math.abs(s.centsDifference || 0), 0) / wrongNotes.length
                };
            } else {
                errorType = 'poor_detection';
                errorDetails = {
                    avgConfidence: validSamples.reduce((sum, s) => sum + s.confidence, 0) / validSamples.length,
                    avgVolume: validSamples.reduce((sum, s) => sum + s.volume, 0) / validSamples.length
                };
            }
        }
        
        this.currentNoteData.errorType = errorType;
        this.currentNoteData.errorDetails = errorDetails;
    }
    
    calculateTimingConsistency(correctSamples) {
        if (correctSamples.length < 3) return 0;
        
        const intervals = [];
        for (let i = 1; i < correctSamples.length; i++) {
            intervals.push(correctSamples[i].relativeTime - correctSamples[i-1].relativeTime);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((acc, interval) => acc + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        
        return avgInterval > 0 ? Math.max(0, 100 - (Math.sqrt(variance) / avgInterval * 100)) : 0;
    }
    
    findMostCommonNote(samples) {
        const noteCounts = {};
        samples.forEach(s => {
            if (s.noteString) {
                noteCounts[s.noteString] = (noteCounts[s.noteString] || 0) + 1;
            }
        });
        
        return Object.keys(noteCounts).reduce((a, b) => noteCounts[a] > noteCounts[b] ? a : b, null);
    }
}
