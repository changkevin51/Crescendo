class MelodyGenerator {
    constructor() {
        this.apiKey = 'TzLCrcGf8zp2ADDh4syEH6rVQyWsL6rJvri5Nm7b'; // Same API key as cohere-analytics
        this.apiUrl = 'https://api.cohere.com/v1/chat';
        this.model = 'command-r-plus';
    }

    async generateRandomMelody() {
        try {
            console.log('🎵 Generating random melody with Cohere...');
            
            const melodyPrompt = this.createMelodyPrompt();
            
            const requestBody = {
                model: this.model,
                message: melodyPrompt,
                temperature: 0.8, // Higher creativity for melody generation
                max_tokens: 1500,
                stream: false
            };
            
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
                console.error('Cohere API Error:', errorText);
                throw new Error(`Cohere API error: ${response.status}`);
            }

            const result = await response.json();
            const melodyData = result.text || result.message?.content;
            
            console.log('🎵 Raw melody response:', melodyData);
            
            // Parse the melody data from Cohere's response
            const parsedMelody = this.parseMelodyResponse(melodyData);
            
            // Convert to MusicXML
            const musicXML = this.convertToMusicXML(parsedMelody);
            
            return {
                success: true,
                melody: parsedMelody,
                musicXML: musicXML
            };

        } catch (error) {
            console.error('🎵 Melody generation failed:', error);
            return {
                success: false,
                error: error.message,
                fallbackMelody: this.generateFallbackMelody()
            };
        }
    }

    createMelodyPrompt() {
        return 'You are a music composition assistant. Generate a simple 10-bar melody suitable for a beginner music practice game.\n\n' +
               '**Requirements:**\n' +
               '- Exactly 10 bars in 4/4 time\n' +
               '- Use only notes from C4 to C6 (middle C to high C)\n' +
               '- Mix of quarter notes, half notes, and whole notes (no eighth notes or complex rhythms)\n' +
               '- Stay in C major scale (C, D, E, F, G, A, B only - no sharps or flats)\n' +
               '- Make it melodic and pleasant to play\n' +
               '- Include some repeated patterns for easier learning\n\n' +
               '**Output Format:**\n' +
               'Please provide the melody as a JSON array where each object represents one bar:\n\n' +
               '```json\n' +
               '[\n' +
               '  {\n' +
               '    "bar": 1,\n' +
               '    "notes": [\n' +
               '      {"note": "C", "octave": 4, "duration": "quarter"},\n' +
               '      {"note": "D", "octave": 4, "duration": "quarter"},\n' +
               '      {"note": "E", "octave": 4, "duration": "half"}\n' +
               '    ]\n' +
               '  },\n' +
               '  {\n' +
               '    "bar": 2,\n' +
               '    "notes": [\n' +
               '      {"note": "F", "octave": 4, "duration": "whole"}\n' +
               '    ]\n' +
               '  }\n' +
               ']\n' +
               '```\n\n' +
               '**Duration Options:**\n' +
               '- "quarter" = quarter note (1 beat)\n' +
               '- "half" = half note (2 beats)\n' +
               '- "whole" = whole note (4 beats)\n\n' +
               'Make sure each bar adds up to exactly 4 beats. Create a simple, beautiful melody that a beginner would enjoy playing!';
    }

    parseMelodyResponse(responseText) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                             responseText.match(/\[([\s\S]*?)\]/);
            
            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const melody = JSON.parse(jsonStr);
                
                // Validate the melody structure
                if (Array.isArray(melody) && melody.length === 10) {
                    return melody;
                }
            }
            
            // If JSON parsing fails, try to parse text format
            return this.parseTextMelody(responseText);
            
        } catch (error) {
            console.warn('🎵 Failed to parse Cohere melody response, using fallback');
            return this.generateFallbackMelody();
        }
    }

    parseTextMelody(text) {
        // Fallback parser for text-based melody descriptions
        const bars = [];
        const lines = text.split('\n');
        
        let currentBar = null;
        let barNumber = 1;
        
        for (const line of lines) {
            if (line.includes('Bar') || line.includes('bar')) {
                if (currentBar) {
                    bars.push(currentBar);
                }
                currentBar = { bar: barNumber++, notes: [] };
            } else if (currentBar && (line.includes('C') || line.includes('D') || line.includes('E') || 
                      line.includes('F') || line.includes('G') || line.includes('A') || line.includes('B'))) {
                // Try to extract notes from text
                const noteMatches = line.match(/([CDEFGAB])(\d)?\s*(quarter|half|whole)?/gi);
                if (noteMatches) {
                    for (const match of noteMatches) {
                        const parts = match.match(/([CDEFGAB])(\d)?\s*(quarter|half|whole)?/i);
                        if (parts) {
                            currentBar.notes.push({
                                note: parts[1].toUpperCase(),
                                octave: parseInt(parts[2]) || 4,
                                duration: parts[3] || 'quarter'
                            });
                        }
                    }
                }
            }
        }
        
        if (currentBar) {
            bars.push(currentBar);
        }
        
        // Ensure we have 10 bars
        while (bars.length < 10) {
            bars.push(this.generateRandomBar(bars.length + 1));
        }
        
        return bars.slice(0, 10);
    }

    generateFallbackMelody() {
        console.log('🎵 Generating fallback melody...');
        
        const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const octaves = [4, 5];
        const durations = ['quarter', 'half', 'whole'];
        const bars = [];
        
        for (let i = 1; i <= 10; i++) {
            bars.push(this.generateRandomBar(i));
        }
        
        return bars;
    }

    generateRandomBar(barNumber) {
        const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const octaves = [4, 5];
        const durations = [
            { name: 'quarter', beats: 1 },
            { name: 'half', beats: 2 },
            { name: 'whole', beats: 4 }
        ];
        
        const barNotes = [];
        let remainingBeats = 4;
        
        while (remainingBeats > 0) {
            // Choose a duration that fits in remaining beats
            const validDurations = durations.filter(d => d.beats <= remainingBeats);
            const chosenDuration = validDurations[Math.floor(Math.random() * validDurations.length)];
            
            const note = notes[Math.floor(Math.random() * notes.length)];
            const octave = octaves[Math.floor(Math.random() * octaves.length)];
            
            barNotes.push({
                note: note,
                octave: octave,
                duration: chosenDuration.name
            });
            
            remainingBeats -= chosenDuration.beats;
        }
        
        return {
            bar: barNumber,
            notes: barNotes
        };
    }

    convertToMusicXML(melody) {
        const divisions = 4; // Quarter note = 4 divisions
        
        const durationMap = {
            'whole': 16,
            'half': 8,
            'quarter': 4
        };
        
        let measureXML = '';
        
        melody.forEach((bar, index) => {
            measureXML += `    <measure number="${bar.bar}">\n`;
            
            if (index === 0) {
                // Add time signature and key signature to first measure
                measureXML += `      <attributes>\n`;
                measureXML += `        <divisions>${divisions}</divisions>\n`;
                measureXML += `        <key>\n`;
                measureXML += `          <fifths>0</fifths>\n`; // C major
                measureXML += `        </key>\n`;
                measureXML += `        <time>\n`;
                measureXML += `          <beats>4</beats>\n`;
                measureXML += `          <beat-type>4</beat-type>\n`;
                measureXML += `        </time>\n`;
                measureXML += `        <clef>\n`;
                measureXML += `          <sign>G</sign>\n`;
                measureXML += `          <line>2</line>\n`;
                measureXML += `        </clef>\n`;
                measureXML += `      </attributes>\n`;
            }
            
            bar.notes.forEach(noteData => {
                // Validate note data exists
                if (!noteData || !noteData.note || !noteData.octave) {
                    console.warn('Invalid note data structure:', noteData);
                    return;
                }
                
                const duration = durationMap[noteData.duration] || 4;
                const noteStep = noteData.note.toUpperCase();
                const noteOctave = parseInt(noteData.octave);
                
                // Validate note data
                if (!noteStep || !noteOctave || noteOctave < 1 || noteOctave > 8) {
                    console.warn('Invalid note data:', noteData);
                    return;
                }
                
                measureXML += `      <note>\n`;
                measureXML += `        <pitch>\n`;
                
                // Handle sharps/flats properly
                let baseNote = noteStep;
                let alter = 0;
                
                if (noteStep.includes('#')) {
                    baseNote = noteStep.replace('#', '');
                    alter = 1;
                } else if (noteStep.includes('b')) {
                    baseNote = noteStep.replace('b', '');
                    alter = -1;
                }
                
                measureXML += `          <step>${baseNote}</step>\n`;
                if (alter !== 0) {
                    measureXML += `          <alter>${alter}</alter>\n`;
                }
                measureXML += `          <octave>${noteOctave}</octave>\n`;
                measureXML += `        </pitch>\n`;
                measureXML += `        <duration>${duration}</duration>\n`;
                measureXML += `        <type>${noteData.duration}</type>\n`;
                measureXML += `      </note>\n`;
            });
            
            measureXML += `    </measure>\n`;
        });
        
        const musicXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>Generated Melody</work-title>
  </work>
  <identification>
    <creator type="composer">Crescendo AI</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Melody</part-name>
      <score-instrument id="P1-I1">
        <instrument-name>Piano</instrument-name>
      </score-instrument>
      <midi-device id="P1-I1">
        <midi-channel>1</midi-channel>
        <midi-program>1</midi-program>
      </midi-device>
    </score-part>
  </part-list>
  <part id="P1">
${measureXML}  </part>
</score-partwise>`;
        
        return musicXML;
    }

    async saveMelodyAsXML(musicXML, filename = 'generated-melody.xml') {
        try {
            // Create a blob with the XML content
            const blob = new Blob([musicXML], { type: 'application/xml' });
            
            // Create a temporary URL for the blob
            const url = URL.createObjectURL(blob);
            
            // Store the XML content for later use
            this.currentMelodyXML = musicXML;
            this.currentMelodyURL = url;
            
            console.log('🎵 Melody XML generated and ready for use');
            return { success: true, url: url, xml: musicXML };
            
        } catch (error) {
            console.error('🎵 Failed to save melody XML:', error);
            return { success: false, error: error.message };
        }
    }

    getCurrentMelodyXML() {
        return this.currentMelodyXML;
    }

    getCurrentMelodyURL() {
        return this.currentMelodyURL;
    }
}

// Global instance
window.melodyGenerator = new MelodyGenerator();
