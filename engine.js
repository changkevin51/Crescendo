let totalScrollTime = 80;
let tempoMultiplier = 1.0;
const quarterNoteSpacing = 60;
const halfNoteSpacing = 120;
const wholeNoteSpacing = 240;
const screenWidth = window.innerWidth;
const noteOffsetFromBar = 30;
const judgmentLineX = 80;
const judgmentTolerance = 30; // pixels tolerance for note judgment

// Check if elements exist before using them
const svg = document.getElementById("music-staff");
const noteGroup = document.getElementById("note-group");
const staffLines = document.getElementById("staff-lines");
const barLines = document.getElementById("bar-lines");

// If using OpenSheetMusicDisplay, these elements won't exist
if (!svg || !noteGroup || !staffLines || !barLines) {
  console.log('Custom SVG elements not found - likely using OpenSheetMusicDisplay');
}

// UI elements for new features
const currentDetectedNote = document.getElementById('current-detected-note');
const currentDetectedFrequency = document.getElementById('current-detected-frequency');
const pauseBtn = document.getElementById('pause-btn');
const endGameBtn = document.getElementById('end-game-btn');
const tempoSlider = document.getElementById('tempo-slider');
const tempoValue = document.getElementById('tempo-value');
const metronomeCheckbox = document.getElementById('metronome-checkbox');

// Game state
let gameNotes = [];
let pitchDetector = null;
let correctCount = 0;
let missedCount = 0;
let wrongCount = 0;
let gameStartTime = 0;
let isGameRunning = false;
let isPaused = false;
let pausedTime = 0;
let totalPausedTime = 0;
let animationId = null;
let detectionInterval = null;
let noteStatistics = null;
let currentNoteIndex = 0;
let maxStreak = 0;
let currentStreak = 0;
let level = 1;

// Metronome state
let metronomeInterval = null;
let metronomeAudioContext = null;
let isMetronomeEnabled = false;

// Note detection state
let lastDetectedNote = null;
let lastDetectionTime = 0;
let noteDetectionHistory = [];
const NOTE_CHANGE_THRESHOLD = 300; // ms to consider a "new" note
const WRONG_NOTE_BUFFER_PERIOD = 400; // ms buffer before marking as wrong
const HIGH_CONFIDENCE_WINDOW = 300; // ms window to collect samples
const MIN_CONFIDENCE_FOR_SAMPLE = 0.4; // minimum confidence to include in detection
const SMOOTHING_WINDOW = 150; // ms for smoothing fluctuating detections

// Staff lines (y-coordinates)
const lineYs = [40, 60, 80, 100, 120];

// Note y positions (lines, spaces, ledger)
// spaced by 10 from 20 to 140
const notePositions = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];

// Note mapping from Y position to note name
const yToNote = {
  20: 'A5', 30: 'G5', 40: 'F5', 50: 'E5', 60: 'D5',
  70: 'C5', 80: 'B4', 90: 'A4', 100: 'G4', 110: 'F4',
  120: 'E4', 130: 'D4', 140: 'C4'
};

// Draw staff lines only if staffLines element exists
if (staffLines && staffLines !== null) {
  lineYs.forEach(y => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", "8000");
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    staffLines.appendChild(line);
  });
} else {
  console.log('staffLines element is null - skipping staff line generation');
}

// Only generate measures if we have the required SVG elements
if (!svg || !noteGroup || !staffLines || !barLines) {
  console.log('SVG elements not found - skipping note generation for engine.js');
} else {
  const totalMeasures = 20;
  const measures = [];

  // Generate measures randomly
  for (let i = 0; i < totalMeasures; i++) {
  const measure = [];

  // 25% chance whole note (4 beats alone)
  if (Math.random() < 0.25) {
    const y = notePositions[Math.floor(Math.random() * notePositions.length)];
    measure.push({ beats: 4, type: "whole", y });
  } else {
    let beatsLeft = 4;
    while (beatsLeft > 0) {
      let beat = Math.random() < 0.5 ? 1 : 2;
      if (beat > beatsLeft) beat = 1;
      const y = notePositions[Math.floor(Math.random() * notePositions.length)];
      const type = beat === 1 ? "quarter" : "half";
      measure.push({ beats: beat, type, y });
      beatsLeft -= beat;
    }
  }

    measures.push(measure);
  }

  let currentX = screenWidth;
  let noteIndex = 0;

  measures.forEach(measure => {
  currentX += noteOffsetFromBar;

  measure.forEach(note => {
    let spacing = note.beats === 1 ? quarterNoteSpacing
               : note.beats === 2 ? halfNoteSpacing
               : wholeNoteSpacing;

    // Create note object for game tracking
    const gameNote = {
      id: `note-${noteIndex}`,
      x: currentX,
      y: note.y,
      type: note.type,
      beats: note.beats,
      noteName: yToNote[note.y] || 'Unknown',
      judged: false,
      element: null,
      stemElement: null,
      letterElement: null,
      wrongNoteElement: null,
      wrongDetectionTime: null,
      inBufferPeriod: false,
      highConfidenceSamples: []
    };
    
    // Draw note head
    const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    ellipse.setAttribute("cx", currentX);
    ellipse.setAttribute("cy", note.y);
    ellipse.setAttribute("rx", 8);
    ellipse.setAttribute("ry", 6);
    ellipse.setAttribute("fill", note.type === "quarter" ? "black" : "white");
    ellipse.setAttribute("stroke", "black");
    ellipse.setAttribute("stroke-width", "1");
    ellipse.setAttribute("id", gameNote.id);
    if (noteGroup) {
      noteGroup.appendChild(ellipse);
    }
    gameNote.element = ellipse;

    // Stems for half and quarter notes
    if (note.type !== "whole") {
      const stem = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const isAboveMiddle = note.y <= lineYs[2]; // middle line = 80
      if (isAboveMiddle) {
        // Stem down left
        stem.setAttribute("x1", currentX - 8);
        stem.setAttribute("y1", note.y);
        stem.setAttribute("x2", currentX - 8);
        stem.setAttribute("y2", note.y + 35);
      } else {
        // Stem up right
        stem.setAttribute("x1", currentX + 8);
        stem.setAttribute("y1", note.y);
        stem.setAttribute("x2", currentX + 8);
        stem.setAttribute("y2", note.y - 35);
      }
      stem.setAttribute("stroke", "black");
      stem.setAttribute("stroke-width", "1.5");
      stem.setAttribute("id", `stem-${noteIndex}`);
      if (noteGroup) {
        noteGroup.appendChild(stem);
      }
      gameNote.stemElement = stem;
    }

    // Ledger lines only for notes above or below staff range
    if (note.y < 30 || note.y > 130) {
      const ledger = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ledger.setAttribute("x1", currentX - 10);
      ledger.setAttribute("x2", currentX + 10);
      ledger.setAttribute("y1", note.y);
      ledger.setAttribute("y2", note.y);
      ledger.setAttribute("stroke", "black");
      ledger.setAttribute("stroke-width", "1");
      if (noteGroup) {
        noteGroup.appendChild(ledger);
      }
    }

    // Add floating note letter above the note
    const noteLetter = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const fullNoteName = yToNote[note.y] || 'X';
    // Remove octave number from note name
    const noteNameOnly = fullNoteName.replace(/\d+$/, '');
    noteLetter.textContent = noteNameOnly;
    noteLetter.setAttribute("x", currentX);
    noteLetter.setAttribute("y", note.y - 20);
    noteLetter.setAttribute("class", "note-letter");
    noteLetter.setAttribute("id", `letter-${noteIndex}`);
    if (noteGroup) {
      noteGroup.appendChild(noteLetter);
    }
    gameNote.letterElement = noteLetter;

    gameNotes.push(gameNote);
    currentX += spacing;
    noteIndex++;
  });

  // Bar line position - at least 30px after last note
  const barX = currentX;
  const barLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  barLine.setAttribute("x1", barX);
  barLine.setAttribute("x2", barX);
  barLine.setAttribute("y1", lineYs[0] - 5);
  barLine.setAttribute("y2", lineYs[lineYs.length - 1] + 5);
  if (barLines) {
    barLines.appendChild(barLine);
  }

    currentX = barX;
  });
}

// Initialize pitch detector and start game
async function initializeGame() {
  try {
    pitchDetector = new PitchDetector();
    await pitchDetector.initialize();
    pitchDetector.start();
    
    // Initialize statistics tracking
    noteStatistics = new NoteStatistics();
    
    // Start the game
    startGame();
  } catch (error) {
    console.error('Failed to initialize pitch detector:', error);
    alert('Microphone access required for the game. Please allow microphone access and refresh.');
  }
}

function showLevelText() {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", 200);
  text.setAttribute("y", lineYs[2]);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("font-size", "40");
  text.setAttribute("fill", "black");
  text.setAttribute("class", "fade-text");
  text.textContent = `Level ${level}`;
  svg.appendChild(text);
  
  // Remove the text after animation completes
  setTimeout(() => {
      if (text.parentNode) {
          text.parentNode.removeChild(text);
      }
  }, 3000); // Remove after 3 seconds
}

function startGame() {
  gameStartTime = Date.now();
  isGameRunning = true;
  isPaused = false;
  totalPausedTime = 0;
  currentNoteIndex = 0;
  currentStreak = 0;
  maxStreak = 0;
  
  // Start statistics session
  if (noteStatistics) {
    noteStatistics.startSession('medium', 5000); // Default difficulty and time per note
  }
  
  // Start continuous pitch detection
  startPitchDetection();
  
  // Animate scroll
  const scrollDistance = currentX + 200;
  const adjustedScrollSpeed = totalScrollTime / tempoMultiplier;
  noteGroup.style.animation = `scrollLeft ${adjustedScrollSpeed}s linear infinite`;
  barLines.style.animation = `scrollLeft ${adjustedScrollSpeed}s linear infinite`;
  
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes scrollLeft {
      from { transform: translateX(0); }
      to { transform: translateX(-${scrollDistance}px); }
    }
  `;
  document.head.appendChild(style);
  
  showLevelText();
  
  // Start judgment loop
  gameLoop();
}

function gameLoop() {
  if (!isGameRunning) return;
  
  if (!isPaused) {
    checkNoteJudgments();
  }
  
  animationId = requestAnimationFrame(gameLoop);
}

function checkNoteJudgments() {
  const currentTime = Date.now();
  const elapsedTime = (currentTime - gameStartTime - totalPausedTime) / 1000;
  const adjustedScrollSpeed = totalScrollTime / tempoMultiplier;
  const scrollProgress = elapsedTime / adjustedScrollSpeed;
  const totalScrollDistance = currentX + 200;
  const currentScrollX = scrollProgress * totalScrollDistance;
  
  // Find the closest upcoming note for context
  let closestUpcomingNote = null;
  let closestDistance = Infinity;
  
  gameNotes.forEach(note => {
    if (note.judged) return;
    
    const noteCurrentX = note.x - currentScrollX;
    const distanceToJudgment = Math.abs(noteCurrentX - judgmentLineX);
    
    if (noteCurrentX >= judgmentLineX - judgmentTolerance * 2 && distanceToJudgment < closestDistance) {
      closestUpcomingNote = note;
      closestDistance = distanceToJudgment;
    }
  });
  
  gameNotes.forEach(note => {
    if (note.judged) return;
    
    // Calculate current note position
    const noteCurrentX = note.x - currentScrollX;
    
    // More lenient judgment zone - check if note is anywhere close
    const extendedTolerance = judgmentTolerance * 1.5;
    
    // Debug logging for note positions
    const distanceToJudgment = Math.abs(noteCurrentX - judgmentLineX);
    if (distanceToJudgment <= extendedTolerance * 2) {
      console.log(`Note ${note.noteName} at distance ${distanceToJudgment.toFixed(1)} from judgment line (tolerance: ${extendedTolerance})`);
    }
    
    // Check if note is in extended judgment zone
    if (Math.abs(noteCurrentX - judgmentLineX) <= extendedTolerance) {
      console.log(`Judging note ${note.noteName} in judgment zone`);
      judgeNote(note, closestUpcomingNote);
    }
    // Check if note has passed judgment line significantly (missed)
    else if (noteCurrentX < judgmentLineX - extendedTolerance) {
      markNoteMissed(note);
    }
  });
}

// Helper function to smooth fluctuating note detections
function getSmoothedNote(samples, currentTime) {
  if (samples.length === 0) return null;
  
  // Get recent samples for smoothing
  const recentSamples = samples.filter(s => currentTime - s.time <= SMOOTHING_WINDOW);
  if (recentSamples.length === 0) return null;
  
  // Weight by confidence and recency
  const noteWeights = {};
  recentSamples.forEach(sample => {
    const recencyWeight = 1 - (currentTime - sample.time) / SMOOTHING_WINDOW;
    const weight = sample.confidence * recencyWeight;
    noteWeights[sample.note] = (noteWeights[sample.note] || 0) + weight;
  });
  
  // Find the note with highest weight
  let maxWeight = 0;
  let bestNote = null;
  let totalWeight = 0;
  
  for (const [note, weight] of Object.entries(noteWeights)) {
    totalWeight += weight;
    if (weight > maxWeight) {
      maxWeight = weight;
      bestNote = note;
    }
  }
  
  const confidence = totalWeight > 0 ? maxWeight / totalWeight : 0;
  return { note: bestNote, confidence, sampleCount: recentSamples.length };
}

function judgeNote(note, closestUpcomingNote = null) {
  if (note.judged) return;
  
  const currentTime = Date.now();
  const pitchData = pitchDetector.detectPitch();
  const expectedNoteName = note.noteName.replace(/[0-9]/g, '');
  const expectedOctave = parseInt(note.noteName.match(/[0-9]/)[0]);
  const expectedFrequency = getFrequencyFromNote(note.noteName);
  
  // Debug logging
  if (pitchData) {
    console.log(`Judging note ${note.noteName}: detected ${pitchData.frequency.toFixed(1)}Hz, confidence ${pitchData.confidence.toFixed(2)}, volume ${pitchData.volume.toFixed(1)}`);
  } else {
    console.log(`Judging note ${note.noteName}: no pitch data detected`);
  }
  
  // Start note tracking if not already started
  if (!note.statisticsStarted && noteStatistics) {
    const expectedTimestamp = calculateExpectedNoteTime(note);
    noteStatistics.startNoteTracking(
      expectedNoteName, 
      expectedOctave, 
      expectedFrequency, 
      'medium', 
      5000,
      expectedTimestamp
    );
    note.statisticsStarted = true;
  }
  
  // Record detection samples for statistics
  if (pitchData && pitchData.confidence >= MIN_CONFIDENCE_FOR_SAMPLE && pitchData.volume > 5 && noteStatistics) {
    const detectedNote = pitchDetector.frequencyToNote(pitchData.frequency);
    noteStatistics.recordDetectionSample(
      pitchData.frequency,
      detectedNote.note,
      detectedNote.octave,
      pitchData.confidence,
      pitchData.volume,
      currentTime
    );
  }
  
  // Collect samples with lower threshold to catch more detections
  if (pitchData && pitchData.confidence >= MIN_CONFIDENCE_FOR_SAMPLE && pitchData.volume > 5) {
    const detectedNote = pitchDetector.frequencyToNote(pitchData.frequency);
    const detectedNoteName = detectedNote.note;
    console.log(`Adding sample: ${detectedNoteName} (conf: ${pitchData.confidence.toFixed(2)}, vol: ${pitchData.volume.toFixed(1)}) for note ${note.noteName}`);
    
    // Add to samples for this specific note
    note.highConfidenceSamples.push({
      note: detectedNoteName,
      confidence: pitchData.confidence,
      time: currentTime,
      cents: Math.abs(detectedNote.cents)
    });
    
    // Keep only samples from the last window
    note.highConfidenceSamples = note.highConfidenceSamples.filter(
      sample => currentTime - sample.time <= HIGH_CONFIDENCE_WINDOW
    );
    
    // Update global detection history for display purposes
    const isNewNote = !lastDetectedNote || 
                     lastDetectedNote !== detectedNoteName || 
                     (currentTime - lastDetectionTime) > NOTE_CHANGE_THRESHOLD;
    
    if (isNewNote) {
      noteDetectionHistory.push({
        note: detectedNoteName,
        time: currentTime,
        confidence: pitchData.confidence
      });
      noteDetectionHistory = noteDetectionHistory.filter(h => currentTime - h.time < 2000);
    }
    
    lastDetectedNote = detectedNoteName;
    lastDetectionTime = currentTime;
  }
  
  // Use smoothed detection with lower requirements
  if (note.highConfidenceSamples.length >= 2) { // Reduced from 3 to 2
    const smoothedResult = getSmoothedNote(note.highConfidenceSamples, currentTime);
    console.log(`Note ${note.noteName} has ${note.highConfidenceSamples.length} samples, smoothed result:`, smoothedResult);
    
    if (smoothedResult && smoothedResult.sampleCount >= 2) {
      // Check if the smoothed note matches the expected note
      if (smoothedResult.note === expectedNoteName) {
        console.log(`Correct note detected: ${smoothedResult.note} matches expected ${expectedNoteName}`);
        // Additional check: make sure this note is actually the closest one to judge
        if (!closestUpcomingNote || closestUpcomingNote === note) {
          // Check for reasonable confidence and pitch accuracy
          const goodSamples = note.highConfidenceSamples
            .filter(s => s.note === expectedNoteName)
            .filter(s => s.confidence > 0.3 && s.cents < 75); // More lenient
          
          if (goodSamples.length >= 1 && smoothedResult.confidence > 0.3) {
            markNoteCorrect(note);
            return;
          }
        }
      } else {
        // Different note detected - start buffer period or mark wrong
        if (!note.wrongDetectionTime && smoothedResult.confidence > 0.5) {
          note.wrongDetectionTime = currentTime;
          note.inBufferPeriod = true;
        } else if (note.wrongDetectionTime && currentTime - note.wrongDetectionTime > WRONG_NOTE_BUFFER_PERIOD) {
          if (smoothedResult.confidence > 0.4) {
            markNoteWrong(note, smoothedResult.note);
            return;
          }
        }
      }
    }
  }
  
  // Check if we're in buffer period and should look for recovery
  if (note.inBufferPeriod && note.wrongDetectionTime) {
    // Check if we've detected correct note during buffer period
    const bufferSamples = note.highConfidenceSamples.filter(
      s => s.time >= note.wrongDetectionTime && s.note === expectedNoteName
    );
    
    if (bufferSamples.length >= 1) { // More lenient
      const bufferSmoothed = getSmoothedNote(bufferSamples, currentTime);
      if (bufferSmoothed && bufferSmoothed.note === expectedNoteName && bufferSmoothed.confidence > 0.3) {
        markNoteCorrect(note);
        return;
      }
    }
    
    // If buffer period expired, mark as wrong
    if (currentTime - note.wrongDetectionTime > WRONG_NOTE_BUFFER_PERIOD) {
      const wrongSamples = note.highConfidenceSamples.filter(
        s => s.time >= note.wrongDetectionTime && s.note !== expectedNoteName
      );
      
      if (wrongSamples.length > 0) {
        const wrongSmoothed = getSmoothedNote(wrongSamples, currentTime);
        if (wrongSmoothed && wrongSmoothed.confidence > 0.4) {
          markNoteWrong(note, wrongSmoothed.note);
        }
      }
    }
  }
}

function markNoteCorrect(note) {
  note.judged = true;
  correctCount++;
  currentStreak++;
  maxStreak = Math.max(maxStreak, currentStreak);
  
  // End note tracking with correct outcome
  if (noteStatistics && note.statisticsStarted) {
    const pitchData = pitchDetector.detectPitch();
    const detectedNote = pitchData ? pitchDetector.frequencyToNote(pitchData.frequency) : null;
    
    const detectedData = detectedNote ? {
      note: detectedNote.note,
      octave: detectedNote.octave,
      frequency: pitchData.frequency,
      centsDifference: detectedNote.cents,
      frequencyAccuracy: Math.max(0, 100 - Math.abs(detectedNote.cents) / 2),
      responseTime: note.highConfidenceSamples.length > 0 ? 
        note.highConfidenceSamples[0].time - (note.statisticsStartTime || Date.now()) : null,
      confidence: pitchData.confidence,
      points: 100
    } : null;
    
    console.log('✅ Correct note:', note.noteName, 'Detected:', detectedData);
    
    noteStatistics.endNoteTracking('correct', detectedData, {
      streak: currentStreak
    });
  }
  
  // Change note color to green
  if (note.element) {
    note.element.setAttribute('fill', 'green');
    note.element.setAttribute('stroke', 'green');
  }
  if (note.stemElement) {
    note.stemElement.setAttribute('stroke', 'green');
  }
  if (note.letterElement) {
    note.letterElement.setAttribute('fill', 'green');
  }
  
  updateScoreDisplay();
}

function markNoteWrong(note, detectedNoteName = null) {
  note.judged = true;
  wrongCount++;
  currentStreak = 0; // Reset streak on wrong note
  
  // End note tracking with incorrect outcome
  if (noteStatistics && note.statisticsStarted) {
    const pitchData = pitchDetector.detectPitch();
    const detectedNote = pitchData ? pitchDetector.frequencyToNote(pitchData.frequency) : null;
    
    const detectedData = detectedNote ? {
      note: detectedNote.note,
      octave: detectedNote.octave,
      frequency: pitchData.frequency,
      centsDifference: detectedNote.cents,
      frequencyAccuracy: Math.max(0, 100 - Math.abs(detectedNote.cents) / 2),
      responseTime: note.highConfidenceSamples.length > 0 ? 
        note.highConfidenceSamples[0].time - (note.statisticsStartTime || Date.now()) : null,
      confidence: pitchData.confidence,
      points: 0
    } : null;
    
    console.log('❌ Wrong note:', note.noteName, 'Expected vs Detected:', detectedData);
    
    noteStatistics.endNoteTracking('incorrect', detectedData, {
      streak: currentStreak
    });
  }
  
  // Change note color to red
  if (note.element) {
    note.element.setAttribute('fill', 'red');
    note.element.setAttribute('stroke', 'red');
  }
  if (note.stemElement) {
    note.stemElement.setAttribute('stroke', 'red');
  }
  if (note.letterElement) {
    note.letterElement.setAttribute('fill', 'red');
  }
  
  // Add label below the note showing what was actually played
  if (detectedNoteName && !note.wrongNoteElement) {
    const wrongNoteLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    wrongNoteLabel.textContent = detectedNoteName;
    wrongNoteLabel.setAttribute("x", note.x);
    wrongNoteLabel.setAttribute("y", note.y + 35);
    wrongNoteLabel.setAttribute("class", "note-letter");
    wrongNoteLabel.setAttribute("fill", "red");
    wrongNoteLabel.setAttribute("font-size", "12");
    wrongNoteLabel.setAttribute("id", `wrong-${note.id}`);
    noteGroup.appendChild(wrongNoteLabel);
    note.wrongNoteElement = wrongNoteLabel;
  }
  
  updateScoreDisplay();
}

function markNoteMissed(note) {
  if (note.judged) return;
  
  note.judged = true;
  missedCount++;
  currentStreak = 0; // Reset streak on missed note
  
  // End note tracking with missed outcome
  if (noteStatistics && note.statisticsStarted) {
    console.log('⏭️ Missed note:', note.noteName);
    
    noteStatistics.endNoteTracking('missed', null, {
      streak: currentStreak
    });
  } else if (noteStatistics) {
    // If statistics wasn't started for this note, start and immediately end it as missed
    const expectedNoteName = note.noteName.replace(/[0-9]/g, '');
    const expectedOctave = parseInt(note.noteName.match(/[0-9]/)[0]);
    const expectedFrequency = getFrequencyFromNote(note.noteName);
    const expectedTimestamp = calculateExpectedNoteTime(note);
    
    noteStatistics.startNoteTracking(
      expectedNoteName, 
      expectedOctave, 
      expectedFrequency, 
      'medium', 
      5000,
      expectedTimestamp
    );
    
    noteStatistics.endNoteTracking('missed', null, {
      streak: currentStreak
    });
  }
  
  // Keep original color but mark as missed
  updateScoreDisplay();
}

function updateScoreDisplay() {
  document.getElementById('correct-count').textContent = correctCount;
  document.getElementById('missed-count').textContent = missedCount;
  document.getElementById('wrong-count').textContent = wrongCount;
  
  // Calculate and update live accuracy
  const totalNotes = correctCount + missedCount + wrongCount;
  const accuracy = totalNotes > 0 ? ((correctCount / totalNotes) * 100).toFixed(1) : 0.0;
  document.getElementById('live-accuracy').textContent = `${accuracy}%`;
}

// New functions for added features
function startPitchDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
  }
  
  detectionInterval = setInterval(() => {
    if (!isPaused && pitchDetector) {
      const pitchData = pitchDetector.detectPitch();
      
      if (pitchData && pitchData.confidence > 0.1 && pitchData.volume > 5) {
        const noteInfo = pitchDetector.frequencyToNote(pitchData.frequency);
        currentDetectedNote.textContent = `${noteInfo.note}${noteInfo.octave}`;
        currentDetectedFrequency.textContent = `${pitchData.frequency.toFixed(1)} Hz`;
      } else {
        currentDetectedNote.textContent = '-';
        currentDetectedFrequency.textContent = '- Hz';
      }
    }
  }, 100); // Update 10 times per second
}

function togglePause() {
  if (!isGameRunning) return;
  
  if (isPaused) {
    // Resume
    isPaused = false;
    pauseBtn.textContent = 'Pause';
    pauseBtn.classList.remove('paused');
    
    // Calculate total paused time
    totalPausedTime += Date.now() - pausedTime;
    
    // Resume animations
    const adjustedScrollSpeed = totalScrollTime / tempoMultiplier;
    noteGroup.style.animationPlayState = 'running';
    barLines.style.animationPlayState = 'running';
  } else {
    // Pause
    isPaused = true;
    pauseBtn.textContent = 'Resume';
    pauseBtn.classList.add('paused');
    pausedTime = Date.now();
    
    // Pause animations
    noteGroup.style.animationPlayState = 'paused';
    barLines.style.animationPlayState = 'paused';
  }
}

function updateTempo() {
  tempoMultiplier = parseFloat(tempoSlider.value);
  tempoValue.textContent = `${tempoMultiplier.toFixed(1)}x`;
  
  if (isGameRunning && !isPaused) {
    // Update animation speed
    const scrollDistance = currentX + 200;
    const adjustedScrollSpeed = totalScrollTime / tempoMultiplier;
    
    // Remove existing animations
    noteGroup.style.animation = 'none';
    barLines.style.animation = 'none';
    
    // Force reflow
    noteGroup.offsetHeight;
    barLines.offsetHeight;
    
    // Apply new animations
    noteGroup.style.animation = `scrollLeft ${adjustedScrollSpeed}s linear infinite`;
    barLines.style.animation = `scrollLeft ${adjustedScrollSpeed}s linear infinite`;
  }
}

function stopGame() {
  isGameRunning = false;
  isPaused = false;
  
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  
  // Stop animations
  noteGroup.style.animation = 'none';
  barLines.style.animation = 'none';
  
  // Reset UI
  pauseBtn.textContent = 'Pause';
  pauseBtn.classList.remove('paused');
  currentDetectedNote.textContent = '-';
  currentDetectedFrequency.textContent = '- Hz';
}

// Event listeners for new controls
if (pauseBtn) {
  pauseBtn.addEventListener('click', togglePause);
}

if (endGameBtn) {
  endGameBtn.addEventListener('click', endGameAndAnalyze);
}

if (tempoSlider) {
  tempoSlider.addEventListener('input', updateTempo);
  // Initialize tempo display
  updateTempo();
}

// Helper functions for statistics integration
function getFrequencyFromNote(noteName) {
  // Simple frequency calculation for common notes
  const noteFrequencies = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77
  };
  return noteFrequencies[noteName] || 440.00;
}

function calculateExpectedNoteTime(note) {
  // Calculate when this note should ideally be played based on scroll position
  const scrollDistance = currentX + 200;
  const adjustedScrollSpeed = totalScrollTime / tempoMultiplier;
  const timeToReachJudgmentLine = ((note.x - judgmentLineX) / scrollDistance) * adjustedScrollSpeed * 1000;
  return gameStartTime + timeToReachJudgmentLine;
}

async function endGameAndAnalyze() {
  if (!isGameRunning) return;
  
  // Stop the game
  stopGame();
  
  // End statistics session
  if (noteStatistics) {
    const gameStats = {
      difficulty: 'medium',
      timePerNote: 5000,
      score: correctCount * 100,
      totalNotes: correctCount + wrongCount + missedCount, // Use actual count of judged notes
      correctNotes: correctCount,
      wrongNotes: wrongCount,
      missedNotes: missedCount,
      maxStreak: maxStreak
    };
    
    console.log('🎮 Game Stats:', gameStats);
    
    noteStatistics.endSession(gameStats);
    
    // Show loading message
    const loadingDiv = document.createElement('div');
    loadingDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; color: white; font-family: Inter, sans-serif;">
        <div style="text-align: center; background: white; color: #333; padding: 40px; border-radius: 20px; max-width: 500px;">
          <div style="width: 60px; height: 60px; border: 4px solid #e2e8f0; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 30px;"></div>
          <h2 style="margin-bottom: 15px;">🤖 Analyzing Your Performance...</h2>
          <p>Our AI council is reviewing your session data and preparing detailed feedback.</p>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loadingDiv);
    
    try {
      // Get session data for analysis
      const sessionData = noteStatistics.getSessionDataForAnalysis();
      
      // Send to Cohere for analysis
      const analysisResult = await window.cohereAnalytics.analyzeSession(sessionData);
      
      // Remove loading message
      document.body.removeChild(loadingDiv);
      
      if (analysisResult.success) {
        // Redirect to analytics page
        window.location.href = `analytics.html?session=${sessionData.sessionId}`;
      } else {
        // Show error and redirect anyway with fallback analysis
        alert('AI analysis temporarily unavailable. Showing basic analysis.');
        window.location.href = `analytics.html?session=${sessionData.sessionId}`;
      }
      
    } catch (error) {
      // Remove loading message
      if (document.body.contains(loadingDiv)) {
        document.body.removeChild(loadingDiv);
      }
      
      console.error('Analysis failed:', error);
      alert('Analysis failed, but your session data has been saved. You can view basic statistics.');
      
      // Still redirect to analytics page for basic analysis
      const sessionData = noteStatistics.getSessionDataForAnalysis();
      window.location.href = `analytics.html?session=${sessionData.sessionId}`;
    }
  } else {
    alert('No statistics data available. Please start a new game.');
  }
}

// Note label toggle functionality
function toggleNoteLabels() {
  const checkbox = document.getElementById('note-labels-checkbox');
  const noteLabels = document.querySelectorAll('.note-letter');
  
  noteLabels.forEach(label => {
    if (checkbox.checked) {
      label.classList.remove('hidden');
    } else {
      label.classList.add('hidden');
    }
  });
}

// Start the game when page loads
window.addEventListener('load', initializeGame);

// Add event listener for note label toggle
document.addEventListener('DOMContentLoaded', function() {
  const noteLabelCheckbox = document.getElementById('note-labels-checkbox');
  if (noteLabelCheckbox) {
    noteLabelCheckbox.addEventListener('change', toggleNoteLabels);
  }
});
