let scrollSpeedSeconds = 80;
let tempoMultiplier = 1.0;
const unitSpacingQuarter = 60;
const unitSpacingHalf = 120;
const unitSpacingWhole = 240;
const minSpacingAfterLastNote = 30;
const screenWidth = window.innerWidth;
const noteOffsetFromBar = 30;
const judgmentLineX = 80;
const judgmentTolerance = 30; // pixels tolerance for note judgment

const svg = document.getElementById("music-staff");
const noteGroup = document.getElementById("note-group");
const staffLines = document.getElementById("staff-lines");
const barLines = document.getElementById("bar-lines");

// UI elements for new features
const currentDetectedNote = document.getElementById('current-detected-note');
const currentDetectedFrequency = document.getElementById('current-detected-frequency');
const pauseBtn = document.getElementById('pause-btn');
const tempoSlider = document.getElementById('tempo-slider');
const tempoValue = document.getElementById('tempo-value');

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

// Note detection state
let lastDetectedNote = null;
let lastDetectionTime = 0;
let noteDetectionHistory = [];
const NOTE_CHANGE_THRESHOLD = 300; // ms to consider a "new" note
const WRONG_NOTE_BUFFER_PERIOD = 400; // ms buffer before marking as wrong
const HIGH_CONFIDENCE_WINDOW = 500; // ms window to collect high-confidence samples
const MIN_CONFIDENCE_FOR_SAMPLE = 0.8; // minimum confidence to include in mode calculation

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

// Draw staff lines
lineYs.forEach(y => {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "0");
  line.setAttribute("x2", "8000");
  line.setAttribute("y1", y);
  line.setAttribute("y2", y);
  staffLines.appendChild(line);
});

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
    let spacing = note.beats === 1 ? unitSpacingQuarter
               : note.beats === 2 ? unitSpacingHalf
               : unitSpacingWhole;

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
    noteGroup.appendChild(ellipse);
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
      noteGroup.appendChild(stem);
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
      noteGroup.appendChild(ledger);
    }

    // Add floating note letter above the note
    const noteLetter = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const fullNoteName = yToNote[note.y] || 'X';
    noteLetter.textContent = fullNoteName;
    noteLetter.setAttribute("x", currentX);
    noteLetter.setAttribute("y", note.y - 20);
    noteLetter.setAttribute("class", "note-letter");
    noteLetter.setAttribute("id", `letter-${noteIndex}`);
    noteGroup.appendChild(noteLetter);
    gameNote.letterElement = noteLetter;

    gameNotes.push(gameNote);
    currentX += spacing;
    noteIndex++;
  });

  // Bar line position - at least 30px after last note
  const barX = currentX + minSpacingAfterLastNote;
  const barLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  barLine.setAttribute("x1", barX);
  barLine.setAttribute("x2", barX);
  barLine.setAttribute("y1", lineYs[0] - 5);
  barLine.setAttribute("y2", lineYs[lineYs.length - 1] + 5);
  barLines.appendChild(barLine);

  currentX = barX;
});

// Initialize pitch detector and start game
async function initializeGame() {
  try {
    pitchDetector = new PitchDetector();
    await pitchDetector.initialize();
    pitchDetector.start();
    
    // Start the game
    startGame();
  } catch (error) {
    console.error('Failed to initialize pitch detector:', error);
    alert('Microphone access required for the game. Please allow microphone access and refresh.');
  }
}

function startGame() {
  gameStartTime = Date.now();
  isGameRunning = true;
  isPaused = false;
  totalPausedTime = 0;
  
  // Start continuous pitch detection
  startPitchDetection();
  
  // Animate scroll
  const scrollDistance = currentX + 200;
  const adjustedScrollSpeed = scrollSpeedSeconds / tempoMultiplier;
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
  const adjustedScrollSpeed = scrollSpeedSeconds / tempoMultiplier;
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
    
    // Check if note is in extended judgment zone
    if (Math.abs(noteCurrentX - judgmentLineX) <= extendedTolerance) {
      judgeNote(note, closestUpcomingNote);
    }
    // Check if note has passed judgment line significantly (missed)
    else if (noteCurrentX < judgmentLineX - extendedTolerance) {
      markNoteMissed(note);
    }
  });
}

// Helper function to calculate mode of detected notes
function calculateNoteMode(samples) {
  if (samples.length === 0) return null;
  
  const noteCounts = {};
  samples.forEach(sample => {
    noteCounts[sample.note] = (noteCounts[sample.note] || 0) + sample.confidence;
  });
  
  let maxCount = 0;
  let modeNote = null;
  for (const [note, count] of Object.entries(noteCounts)) {
    if (count > maxCount) {
      maxCount = count;
      modeNote = note;
    }
  }
  
  return { note: modeNote, confidence: maxCount / samples.length };
}

function judgeNote(note, closestUpcomingNote = null) {
  if (note.judged) return;
  
  const currentTime = Date.now();
  const pitchData = pitchDetector.detectPitch();
  const expectedNoteName = note.noteName.replace(/[0-9]/g, '');
  
  // Collect high-confidence samples for this note
  if (pitchData && pitchData.confidence >= MIN_CONFIDENCE_FOR_SAMPLE && pitchData.volume > 8) {
    const detectedNote = pitchDetector.frequencyToNote(pitchData.frequency);
    const detectedNoteName = detectedNote.note;
    
    // Add to high-confidence samples for this specific note
    note.highConfidenceSamples.push({
      note: detectedNoteName,
      confidence: pitchData.confidence,
      time: currentTime,
      cents: Math.abs(detectedNote.cents)
    });
    
    // Keep only samples from the last HIGH_CONFIDENCE_WINDOW ms
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
  
  // Analyze collected samples to determine the most likely played note
  if (note.highConfidenceSamples.length >= 3) { // Need at least 3 samples
    const modeResult = calculateNoteMode(note.highConfidenceSamples);
    
    if (modeResult && modeResult.confidence > 0.85) {
      // Check if the mode matches the expected note
      if (modeResult.note === expectedNoteName) {
        // Additional check: make sure this note is actually the closest one to judge
        if (!closestUpcomingNote || closestUpcomingNote === note) {
          // Verify that recent samples are consistent and have good pitch accuracy
          const recentSamples = note.highConfidenceSamples
            .filter(s => s.note === expectedNoteName && currentTime - s.time <= 200)
            .filter(s => s.cents < 50); // Good pitch accuracy
          
          if (recentSamples.length >= 2) {
            markNoteCorrect(note);
            return;
          }
        }
      } else {
        // Mode is a different note - start buffer period or mark wrong
        if (!note.wrongDetectionTime) {
          note.wrongDetectionTime = currentTime;
          note.inBufferPeriod = true;
        } else if (currentTime - note.wrongDetectionTime > WRONG_NOTE_BUFFER_PERIOD) {
          markNoteWrong(note, modeResult.note);
          return;
        }
      }
    }
  }
  
  // Check if we're in buffer period and should look for recovery
  if (note.inBufferPeriod && note.wrongDetectionTime) {
    // Check if we've collected enough correct samples during buffer period
    const bufferSamples = note.highConfidenceSamples.filter(
      s => s.time >= note.wrongDetectionTime && s.note === expectedNoteName
    );
    
    if (bufferSamples.length >= 2) {
      const bufferMode = calculateNoteMode(bufferSamples);
      if (bufferMode && bufferMode.note === expectedNoteName && bufferMode.confidence > 0.8) {
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
        const wrongMode = calculateNoteMode(wrongSamples);
        markNoteWrong(note, wrongMode ? wrongMode.note : 'Unknown');
      }
    }
  }
}

function markNoteCorrect(note) {
  note.judged = true;
  correctCount++;
  
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
  
  // Keep original color but mark as missed
  updateScoreDisplay();
}

function updateScoreDisplay() {
  document.getElementById('correct-count').textContent = correctCount;
  document.getElementById('missed-count').textContent = missedCount;
  document.getElementById('wrong-count').textContent = wrongCount;
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
    const adjustedScrollSpeed = scrollSpeedSeconds / tempoMultiplier;
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
    const adjustedScrollSpeed = scrollSpeedSeconds / tempoMultiplier;
    
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

if (tempoSlider) {
  tempoSlider.addEventListener('input', updateTempo);
  // Initialize tempo display
  updateTempo();
}

// Start the game when page loads
window.addEventListener('load', initializeGame);
