const scrollSpeedSeconds = 40;
const unitSpacingQuarter = 60;
const unitSpacingHalf = 120;
const unitSpacingWhole = 240;
const minSpacingAfterLastNote = 30;
const screenWidth = window.innerWidth;
const noteOffsetFromBar = 30;

const svg = document.getElementById("music-staff");
const noteGroup = document.getElementById("note-group");
const staffLines = document.getElementById("staff-lines");
const barLines = document.getElementById("bar-lines");

// Staff lines (y-coordinates)
const lineYs = [40, 60, 80, 100, 120];

// Note y positions (lines, spaces, ledger)
// spaced by 10 from 20 to 140
const notePositions = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];

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

measures.forEach(measure => {
  currentX += noteOffsetFromBar;

  measure.forEach(note => {
    let spacing = note.beats === 1 ? unitSpacingQuarter
               : note.beats === 2 ? unitSpacingHalf
               : unitSpacingWhole;

    // Draw note head
    const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    ellipse.setAttribute("cx", currentX);
    ellipse.setAttribute("cy", note.y);
    ellipse.setAttribute("rx", 8);
    ellipse.setAttribute("ry", 6);
    ellipse.setAttribute("fill", note.type === "quarter" ? "black" : "white");
    ellipse.setAttribute("stroke", "black");
    ellipse.setAttribute("stroke-width", "1");
    noteGroup.appendChild(ellipse);

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
      noteGroup.appendChild(stem);
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

    currentX += spacing;
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
