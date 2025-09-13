class CohereAnalytics {
    constructor() {
        this.apiKey = 'TzLCrcGf8zp2ADDh4syEH6rVQyWsL6rJvri5Nm7b';
        this.apiUrl = 'https://api.cohere.com/v1/chat';
        this.model = 'command-r-plus';
    }

    async requestUnlimitedStorage() {
        if ('storage' in navigator && 'persist' in navigator.storage) {
            try {
                const isPersistent = await navigator.storage.persist();
                console.log(`📦 Storage persistence: ${isPersistent ? 'granted' : 'denied'}`);
                return isPersistent;
            } catch (error) {
                console.warn('📦 Could not request persistent storage:', error);
                return false;
            }
        }
        return false;
    }

    async analyzeSession(sessionData) {
        try {
            // Request unlimited storage before processing
            await this.requestUnlimitedStorage();

            const analysisPrompt = this.createAnalysisPrompt(sessionData);
            
            const requestBody = {
                model: this.model,
                message: analysisPrompt,
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            };
            
            console.log('Cohere API Request:', requestBody);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Cohere API Error Response:', errorText);
                throw new Error(`Cohere API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Cohere API Response:', result);
            const analysis = result.text || result.message?.content || 'No analysis received';
            
            // Save analysis to localStorage
            this.saveAnalysisToStorage(sessionData.sessionId, analysis, sessionData);
            
            return {
                success: true,
                analysis: analysis,
                sessionId: sessionData.sessionId
            };

        } catch (error) {
            console.error('🤖 Cohere analysis failed:', error);
            return {
                success: false,
                error: error.message,
                fallbackAnalysis: this.generateFallbackAnalysis(sessionData)
            };
        }
    }

    createAnalysisPrompt(sessionData) {
        const { gameSession, noteEvents, rhythmAnalysis } = sessionData.sessionData;
        
        // Calculate summary statistics
        const totalNotes = noteEvents.length;
        const correctNotes = noteEvents.filter(e => e.outcome === 'correct').length;
        const wrongNotes = noteEvents.filter(e => e.outcome === 'incorrect').length;
        const missedNotes = noteEvents.filter(e => e.outcome === 'missed' || e.outcome === 'timeout').length;
        const accuracy = totalNotes > 0 ? (correctNotes / totalNotes * 100).toFixed(1) : '0';
        
        console.log('📊 Stats Debug:', { totalNotes, correctNotes, wrongNotes, missedNotes, accuracy });

        // Calculate pitch accuracy statistics
        const correctEvents = noteEvents.filter(e => e.outcome === 'correct' && e.frequencyAccuracy);
        const avgPitchAccuracy = correctEvents.length > 0 
            ? (correctEvents.reduce((sum, e) => sum + e.frequencyAccuracy, 0) / correctEvents.length).toFixed(1)
            : 0;

        // Calculate timing statistics
        const timingEvents = noteEvents.filter(e => e.timingAnalysis && e.timingAnalysis.timingAccuracy !== null);
        const avgTimingOffset = timingEvents.length > 0
            ? (timingEvents.reduce((sum, e) => sum + e.timingAnalysis.timingAccuracy, 0) / timingEvents.length).toFixed(0)
            : 0;

        return `You are a panel of 3 expert music instructors analyzing a student's musical performance. Please provide a detailed analysis as if you are 3 council members judging their progress:

**PERFORMANCE DATA:**
- Session Duration: ${Math.round(gameSession.sessionDuration / 1000)} seconds
- Total Notes: ${totalNotes}
- Correct: ${correctNotes} (${accuracy}%)
- Wrong: ${wrongNotes}
- Missed: ${missedNotes}
- Average Pitch Accuracy: ${avgPitchAccuracy}%
- Average Timing Offset: ${avgTimingOffset}ms (negative = early, positive = late)

**RHYTHM ANALYSIS:**
- Overall Rhythm Accuracy: ${rhythmAnalysis.overallRhythmAccuracy?.toFixed(1) || 0}%
- Timing Pattern: ${rhythmAnalysis.timingPattern || 'unknown'}
- Tends to be Early: ${rhythmAnalysis.tendencyToBeEarly ? 'Yes' : 'No'}
- Tends to be Late: ${rhythmAnalysis.tendencyToBeLate ? 'Yes' : 'No'}
- Rhythm Consistency: ${rhythmAnalysis.rhythmConsistency?.toFixed(1) || 0}%
- Early Notes: ${rhythmAnalysis.earlyNotePercentage?.toFixed(1) || 0}%
- On-Time Notes: ${rhythmAnalysis.onTimePercentage?.toFixed(1) || 0}%
- Late Notes: ${rhythmAnalysis.lateNotePercentage?.toFixed(1) || 0}%

**DETAILED NOTE EVENTS:**
${noteEvents.slice(0, 10).map((event, i) => `
Note ${i + 1} [${event.targetNoteString || 'Unknown'}]: 
- Outcome: ${event.outcome}
- Response Time: ${event.responseTime || 'N/A'}ms
- Pitch Accuracy: ${event.frequencyAccuracy || 'N/A'}%
- Timing: ${event.timingAnalysis?.rhythmCategory || 'unknown'}
- Volume: ${event.averageVolume || 'N/A'}
- Expected: ${event.targetNoteString} | Detected: ${event.detectedNoteString || 'None'}
`).join('')}

Please provide your analysis in the following format:

## 🎼 COUNCIL ASSESSMENT

### 👨‍🏫 **PITCH ACCURACY JUDGE**
[Detailed analysis of pitch accuracy, intonation, and note recognition skills]

### ⏰ **RHYTHM & TIMING JUDGE** 
[Detailed analysis of timing, rhythm consistency, and whether they play early/late]

### 🎵 **OVERALL PERFORMANCE JUDGE**
[Holistic assessment combining all aspects, strengths, and areas for improvement]

## 📊 PERFORMANCE SUMMARY
- **Overall Grade:** [A+/A/B+/B/C+/C/D/F]
- **Key Strengths:** [2-3 bullet points]
- **Areas for Improvement:** [2-3 bullet points]
- **Practice Recommendations:** [Specific actionable advice]

## 🎯 NEXT STEPS
[Concrete suggestions for continued improvement]

Make the analysis encouraging but honest, focusing on specific actionable feedback based on the data provided.`;
    }

    generateFallbackAnalysis(sessionData) {
        const { gameSession, noteEvents, rhythmAnalysis } = sessionData.sessionData;
        const totalNotes = noteEvents.length;
        const correctNotes = noteEvents.filter(e => e.outcome === 'correct').length;
        const accuracy = totalNotes > 0 ? (correctNotes / totalNotes * 100).toFixed(1) : 0;

        return `## 🎼 PERFORMANCE ANALYSIS (Offline Mode)

### 📊 Session Summary
- **Accuracy:** ${accuracy}% (${correctNotes}/${totalNotes} notes)
- **Rhythm Consistency:** ${rhythmAnalysis.rhythmConsistency?.toFixed(1) || 0}%
- **Timing Pattern:** ${rhythmAnalysis.timingPattern || 'Variable'}

### 🎯 Key Observations
${accuracy >= 80 ? '✅ Excellent note accuracy!' : accuracy >= 60 ? '👍 Good progress on note recognition' : '📚 Focus on note identification practice'}

${rhythmAnalysis.rhythmConsistency > 70 ? '✅ Strong rhythm consistency!' : '⏰ Work on maintaining steady timing'}

${rhythmAnalysis.tendencyToBeEarly ? '⚡ Tendency to rush - practice with metronome' : rhythmAnalysis.tendencyToBeLate ? '🐌 Tendency to drag - work on anticipation' : '🎯 Good timing balance'}

### 📈 Recommendations
- Continue regular practice sessions
- Focus on areas with lower accuracy
- Use metronome for timing consistency
- Record yourself to track progress

*Note: This is a simplified analysis. For detailed feedback, ensure internet connection for AI analysis.*`;
    }

    async saveAnalysisToStorage(sessionId, analysis, sessionData) {
        try {
            const analysisData = {
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                analysis: analysis,
                sessionSummary: {
                    sessionId: sessionId,
                    totalNotes: sessionData.sessionData.noteEvents.length,
                    correctNotes: sessionData.sessionData.noteEvents.filter(e => e.outcome === 'correct').length,
                    accuracy: sessionData.sessionData.gameSession.accuracy || 0,
                    rhythmAnalysis: sessionData.sessionData.rhythmAnalysis
                }
            };

            // Save to localStorage
            localStorage.setItem(`crescendo_analysis_${sessionId}`, JSON.stringify(analysisData));
            
            // Also save to Chrome storage if available
            await this.saveAnalysisToChromeStorage(sessionId, analysisData);
            
            // Keep only last 5 analyses in localStorage
            const allAnalyses = Object.keys(localStorage)
                .filter(key => key.startsWith('crescendo_analysis_'))
                .sort();
            
            if (allAnalyses.length > 5) {
                for (let i = 0; i < allAnalyses.length - 5; i++) {
                    localStorage.removeItem(allAnalyses[i]);
                }
            }

            console.log(`💾 Analysis saved for session: ${sessionId}`);
        } catch (error) {
            console.warn('💾 Could not save analysis to localStorage:', error);
        }
    }
    
    async saveAnalysisToChromeStorage(sessionId, analysisData) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const storageKey = `crescendo_analysis_${sessionId}`;
                await chrome.storage.local.set({ [storageKey]: analysisData });
                
                // Keep only last 5 analyses in Chrome storage
                const allKeys = await chrome.storage.local.get(null);
                const analysisKeys = Object.keys(allKeys)
                    .filter(key => key.startsWith('crescendo_analysis_'))
                    .sort();
                
                if (analysisKeys.length > 5) {
                    const keysToRemove = analysisKeys.slice(0, analysisKeys.length - 5);
                    await chrome.storage.local.remove(keysToRemove);
                }
                
                console.log(`💾 Analysis saved to Chrome storage: ${sessionId}`);
            }
        } catch (error) {
            console.warn('💾 Could not save analysis to Chrome storage:', error);
        }
    }

    async getAllStoredAnalyses() {
        const analyses = [];
        
        // Get from localStorage first
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('crescendo_analysis_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    analyses.push(data);
                } catch (error) {
                    console.warn(`Could not parse analysis data for key: ${key}`);
                }
            }
        }
        
        // Also try to get from Chrome storage if available
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const allKeys = await chrome.storage.local.get(null);
                for (const [key, value] of Object.entries(allKeys)) {
                    if (key.startsWith('crescendo_analysis_')) {
                        // Only add if not already in localStorage results
                        const existingIndex = analyses.findIndex(a => a.sessionId === value.sessionId);
                        if (existingIndex === -1) {
                            analyses.push(value);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Could not access Chrome storage:', error);
        }
        
        return analyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    async displayAnalysis(sessionId, containerId = 'analytics-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with id '${containerId}' not found`);
            return;
        }

        // Show loading state
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <h2>Council is Analyzing Your Performance...</h2>
                <p>Please wait while our expert judges review your session data.</p>
            </div>
        `;

        // Try to get stored analysis first
        const storedAnalysis = localStorage.getItem(`crescendo_analysis_${sessionId}`);
        if (storedAnalysis) {
            try {
                const analysisData = JSON.parse(storedAnalysis);
                this.renderAnalysis(container, analysisData.analysis, analysisData.sessionSummary);
                return;
            } catch (error) {
                console.warn('Could not load stored analysis:', error);
            }
        }

        // If no stored analysis, show message
        container.innerHTML = `
            <div class="error-state">
                <h2>Analysis Not Available</h2>
                <p>No analysis found for this session. Make sure to end the game properly to generate analysis.</p>
                <button onclick="window.location.href='main.html'" class="btn btn-primary">Start New Game</button>
            </div>
        `;
    }

    renderAnalysis(container, analysisText, sessionSummary) {
        // Parse the analysis text to extract judge sections
        const sections = this.parseAnalysisText(analysisText);
        
        // Calculate proper accuracy from sessionSummary
        const accuracy = sessionSummary.totalNotes > 0 ? 
            ((sessionSummary.correctNotes / sessionSummary.totalNotes) * 100).toFixed(1) : 0;
        
        // Generate specific feedback based on actual performance data
        const generateSpecificFeedback = (type, sessionSummary) => {
            const totalNotes = sessionSummary.totalNotes || 0;
            const correctNotes = sessionSummary.correctNotes || 0;
            const rhythmData = sessionSummary.rhythmAnalysis || {};
            
            if (type === 'pitch') {
                const pitchAccuracy = totalNotes > 0 ? ((correctNotes / totalNotes) * 100).toFixed(1) : 0;
                if (pitchAccuracy >= 80) {
                    return `Excellent pitch control! You hit ${correctNotes} out of ${totalNotes} notes correctly (${pitchAccuracy}%). Your intonation on the higher register notes was particularly impressive. Keep this precision up!`;
                } else if (pitchAccuracy >= 60) {
                    return `Good progress on pitch accuracy with ${correctNotes}/${totalNotes} notes correct (${pitchAccuracy}%). I noticed some wavering on sustained notes around measures 3-5. Practice holding steady pitches with a tuner.`;
                } else {
                    return `Pitch accuracy needs attention - ${correctNotes}/${totalNotes} correct (${pitchAccuracy}%). Focus on ear training exercises. The notes in the middle register seemed most challenging for you today.`;
                }
            } else if (type === 'rhythm') {
                const rhythmConsistency = rhythmData.rhythmConsistency || 0;
                const isEarly = rhythmData.tendencyToBeEarly;
                const isLate = rhythmData.tendencyToBeLate;
                
                if (rhythmConsistency >= 75) {
                    return `Solid rhythmic foundation! ${rhythmConsistency.toFixed(1)}% consistency shows you've got the groove. ${isEarly ? 'You tend to rush slightly - try counting "1-e-and-a" to stay steady.' : isLate ? 'You drag the tempo a bit - feel the pulse more actively.' : 'Your timing is well-balanced.'}`;
                } else if (rhythmConsistency >= 50) {
                    return `Rhythm is developing with ${rhythmConsistency.toFixed(1)}% consistency. ${isEarly ? 'You\'re rushing through the faster passages - slow practice will help.' : isLate ? 'You\'re behind the beat, especially on syncopated rhythms.' : 'Work on maintaining steady tempo throughout.'} Try practicing with a metronome at 80 BPM.`;
                } else {
                    return `Rhythm needs focused work - ${rhythmConsistency.toFixed(1)}% consistency. ${isEarly ? 'You\'re anticipating beats too much.' : isLate ? 'You\'re consistently behind the pulse.' : 'Timing is inconsistent.'} Start with simple quarter note patterns and build up complexity.`;
                }
            } else { // overall
                const overallGrade = accuracy >= 80 ? 'A-' : accuracy >= 70 ? 'B+' : accuracy >= 60 ? 'B-' : accuracy >= 50 ? 'C+' : 'C';
                return `Overall performance earns a ${overallGrade}. With ${correctNotes}/${totalNotes} notes correct and ${(rhythmData.rhythmConsistency || 0).toFixed(1)}% rhythm consistency, you're ${accuracy >= 70 ? 'showing strong musical understanding' : 'building your foundation well'}. ${accuracy >= 80 ? 'Ready for more challenging pieces!' : accuracy >= 60 ? 'Focus on the fundamentals and you\'ll improve quickly.' : 'Take your time with basics - every musician started here.'}`;
            }
        };
        
        // Define council member data with specific feedback
        const councilMembers = [
            {
                id: 'pitch',
                name: 'Lord of Harmony',
                role: 'Pitch Master',
                image: 'images/lord-of-harmony.png',
                content: sections.pitchJudge || generateSpecificFeedback('pitch', sessionSummary)
            },
            {
                id: 'rhythm',
                name: 'DJ Tempo',
                role: 'Rhythm Keeper',
                image: 'images/dj-tempo.png',
                content: sections.rhythmJudge || generateSpecificFeedback('rhythm', sessionSummary)
            },
            {
                id: 'overall',
                name: 'The Vibe Judge',
                role: 'Musicality and Dynamics',
                image: 'images/vibe-judge.png',
                content: sections.overallJudge || generateSpecificFeedback('overall', sessionSummary)
            }
        ];
        
        container.innerHTML = `
            <div class="container">
                <div class="stats-dashboard">
                    <div class="stat-card">
                        <span class="stat-number">${accuracy}%</span>
                        <span class="stat-label">Accuracy</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${sessionSummary.correctNotes || 0}/${sessionSummary.totalNotes || 0}</span>
                        <span class="stat-label">Notes Hit</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${sessionSummary.rhythmAnalysis?.rhythmConsistency?.toFixed(1) || 0}%</span>
                        <span class="stat-label">Rhythm</span>
                    </div>
                </div>
                
                <div class="council-chamber">
                    ${councilMembers.map(member => `
                        <div class="judge-panel ${member.id}">
                            <div class="judge-image-container">
                                <img src="${member.image}" alt="${member.name}" class="judge-image">
                                <div class="judge-image-overlay"></div>
                                <div class="judge-role-badge">${member.role}</div>
                            </div>
                            <div class="judge-content">
                                <div class="judge-name">${member.name}</div>
                                <div class="judge-verdict">${member.content}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="summary-section">
                    <div class="grade-display">
                        <span class="grade-letter">${sections.grade || 'B+'}</span>
                        <span class="grade-text">Overall Performance Grade</span>
                    </div>
                    
                    <div class="summary-grid">
                        <div class="summary-item">
                            <h4>Key Strengths</h4>
                            <ul>
                                ${sections.strengths.map(strength => `<li>${strength}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="summary-item">
                            <h4>Areas for Improvement</h4>
                            <ul>
                                ${sections.improvements.map(improvement => `<li>${improvement}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="next-steps">
                        <h4>Next Steps & Recommendations</h4>
                        <p>${sections.nextSteps || 'Continue practicing regularly and focus on the areas identified above. Each council member has provided specific guidance to help you improve your musical skills.'}</p>
                    </div>
                    
                    <div class="actions">
                        <button onclick="window.location.href='main.html'" class="btn btn-primary">Practice Again</button>
                        <button onclick="window.print()" class="btn btn-secondary">Save Analysis</button>
                        <button onclick="window.cohereAnalytics.shareAnalysis('${sessionSummary.sessionId || 'unknown'}')" class="btn btn-secondary">Share Results</button>
                    </div>
                </div>
            </div>
        `;
    }

    parseAnalysisText(analysisText) {
        const sections = {
            pitchJudge: '',
            rhythmJudge: '',
            overallJudge: '',
            grade: 'B+',
            strengths: [],
            improvements: [],
            nextSteps: ''
        };

        // Extract judge sections
        const pitchMatch = analysisText.match(/### 👨‍🏫.*?PITCH ACCURACY JUDGE.*?\*\*(.*?)(?=###|##|$)/s);
        if (pitchMatch) {
            sections.pitchJudge = this.cleanText(pitchMatch[1]);
        }

        const rhythmMatch = analysisText.match(/### ⏰.*?RHYTHM & TIMING JUDGE.*?\*\*(.*?)(?=###|##|$)/s);
        if (rhythmMatch) {
            sections.rhythmJudge = this.cleanText(rhythmMatch[1]);
        }

        const overallMatch = analysisText.match(/### 🎵.*?OVERALL PERFORMANCE JUDGE.*?\*\*(.*?)(?=###|##|$)/s);
        if (overallMatch) {
            sections.overallJudge = this.cleanText(overallMatch[1]);
        }

        // Extract grade
        const gradeMatch = analysisText.match(/\*\*Overall Grade:\*\*\s*\[([^\]]+)\]/);
        if (gradeMatch) {
            sections.grade = gradeMatch[1];
        }

        // Extract strengths
        const strengthsMatch = analysisText.match(/\*\*Key Strengths:\*\*(.*?)(?=\*\*|##|$)/s);
        if (strengthsMatch) {
            const strengthsList = strengthsMatch[1].match(/- ([^\n]+)/g);
            if (strengthsList) {
                sections.strengths = strengthsList.map(s => s.replace('- ', '').trim());
            }
        }

        // Extract improvements
        const improvementsMatch = analysisText.match(/\*\*Areas for Improvement:\*\*(.*?)(?=\*\*|##|$)/s);
        if (improvementsMatch) {
            const improvementsList = improvementsMatch[1].match(/- ([^\n]+)/g);
            if (improvementsList) {
                sections.improvements = improvementsList.map(s => s.replace('- ', '').trim());
            }
        }

        // Extract next steps
        const nextStepsMatch = analysisText.match(/## 🎯 NEXT STEPS(.*?)(?=##|$)/s);
        if (nextStepsMatch) {
            sections.nextSteps = this.cleanText(nextStepsMatch[1]);
        }

        // Fallback content if parsing fails
        if (!sections.pitchJudge && !sections.rhythmJudge && !sections.overallJudge) {
            sections.pitchJudge = "Your pitch accuracy shows good potential. Focus on listening carefully to each note and adjusting your intonation.";
            sections.rhythmJudge = "Timing consistency is developing well. Continue practicing with a metronome to improve rhythm stability.";
            sections.overallJudge = "Overall performance demonstrates musical understanding. Keep practicing to build confidence and technical skills.";
        }

        if (sections.strengths.length === 0) {
            sections.strengths = ["Shows musical potential", "Demonstrates effort and dedication"];
        }

        if (sections.improvements.length === 0) {
            sections.improvements = ["Focus on pitch accuracy", "Work on timing consistency"];
        }

        return sections;
    }

    cleanText(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .trim();
    }

    shareAnalysis(sessionId) {
        const analysisData = localStorage.getItem(`crescendo_analysis_${sessionId}`);
        if (analysisData && navigator.share) {
            const data = JSON.parse(analysisData);
            navigator.share({
                title: 'My Crescendo Performance Analysis',
                text: `I just completed a music practice session with ${data.sessionSummary.accuracy?.toFixed(1) || 0}% accuracy!`,
                url: window.location.href
            }).catch(console.error);
        } else {
            // Fallback: copy to clipboard
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                alert('Analysis link copied to clipboard!');
            }).catch(() => {
                alert('Could not share analysis. Try the Save Analysis button instead.');
            });
        }
    }
}

// Global instance
window.cohereAnalytics = new CohereAnalytics();
