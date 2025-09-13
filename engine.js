const scrollSpeedSeconds = 80;
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

// Game state
let gameNotes = [];
let pitchDetector = null;
let correctCount = 0;
let missedCount = 0;
let wrongCount = 0;
let gameStartTime = 0;
let isGameRunning = false;

// Staff lines (y-coordinates)
const lineYs = [40, 60, 80, 100, 120];

// Note y positions (lines, spaces, ledger)
// spaced by 10 from 20 to 140
const notePositions = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];

// Note mapping from Y position to note name
const yToNote = {
  20: 'G5', 30: 'F5', 40: 'E5', 50: 'D5', 60: 'C5',
  70: 'B4', 80: 'A4', 90: 'G4', 100: 'F4', 110: 'E4',
  120: 'D4', 130: 'C4', 140: 'B3'
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
      stemElement: null
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
  
  // Animate scroll
  const scrollDistance = currentX + 200;
  noteGroup.style.animation = `scrollLeft ${scrollSpeedSeconds}s linear infinite`;
  barLines.style.animation = `scrollLeft ${scrollSpeedSeconds}s linear infinite`;
  
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes scrollLeft {
      from { transform: translateX(0); }
      to { transform: translateX(-${scrollDistance}px); }
    }
  `;
  document.head.appendChild(style);
  
  // Start judgment loop
  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (!isGameRunning) return;
  
  checkNoteJudgments();
  requestAnimationFrame(gameLoop);
}

function checkNoteJudgments() {
  const currentTime = Date.now();
  const elapsedTime = (currentTime - gameStartTime) / 1000;
  const scrollProgress = elapsedTime / scrollSpeedSeconds;
  const totalScrollDistance = currentX + 200;
  const currentScrollX = scrollProgress * totalScrollDistance;
  
  gameNotes.forEach(note => {
    if (note.judged) return;
    
    // Calculate current note position
    const noteCurrentX = note.x - currentScrollX;
    
    // Check if note is in judgment zone
    if (Math.abs(noteCurrentX - judgmentLineX) <= judgmentTolerance) {
      judgeNote(note);
    }
    // Check if note has passed judgment line (missed)
    else if (noteCurrentX < judgmentLineX - judgmentTolerance) {
      markNoteMissed(note);
    }
  });
}

function judgeNote(note) {
  if (note.judged) return;
  
  const pitchData = pitchDetector.detectPitch();
  
  if (pitchData && pitchData.confidence > 0.7 && pitchData.volume > 10) {
    const detectedNote = pitchDetector.frequencyToNote(pitchData.frequency);
    const expectedNote = note.noteName;
    
    // Extract note name without octave for comparison
    const detectedNoteName = detectedNote.note;
    const expectedNoteName = expectedNote.replace(/[0-9]/g, '');
    
    if (detectedNoteName === expectedNoteName && Math.abs(detectedNote.cents) < 50) {
      markNoteCorrect(note);
    } else {
      markNoteWrong(note);
    }
  } else {
    // No confident pitch detected, will be marked as missed if it passes
    return;
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
  
  updateScoreDisplay();
}

function markNoteWrong(note) {
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

// Start the game when page loads
window.addEventListener('load', initializeGame);
