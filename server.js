const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const xml2js = require('xml2js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// In-memory storage for rooms (in production, use a database)
const rooms = new Map();
const userSessions = new Map();

// Generate 4-digit room code
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Room class to manage room state
class Room {
    constructor(id, hostId, isPublic, roomName, instrument, skillLevel) {
        this.id = id;
        this.code = isPublic ? null : generateRoomCode();
        this.hostId = hostId;
        this.isPublic = isPublic;
        this.roomName = roomName;
        this.instrument = instrument;
        this.skillLevel = skillLevel;
        this.participants = new Map();
        this.participants.set(hostId, { role: 'host', socketId: null });
        this.createdAt = new Date();
        this.status = 'waiting'; // waiting, active, closed
    }

    addParticipant(userId, socketId) {
        this.participants.set(userId, { role: 'participant', socketId });
    }

    removeParticipant(userId) {
        this.participants.delete(userId);
    }

    getParticipantCount() {
        return this.participants.size;
    }

    toPublicInfo() {
        return {
            id: this.id,
            roomName: this.roomName,
            instrument: this.instrument,
            skillLevel: this.skillLevel,
            participantCount: this.getParticipantCount(),
            status: this.status,
            createdAt: this.createdAt
        };
    }
}

// Handle music session start logic
function handleMusicSessionStart(socket, data) {
    console.log('🎵 Server received start-music-session event:', data);
    const room = rooms.get(data.roomId);
    const userSession = userSessions.get(socket.id);
    
    console.log('Room found:', !!room);
    console.log('User session:', userSession);
    
    if (!room) {
        console.log('❌ Room not found for ID:', data.roomId);
        socket.emit('error', { message: 'Room not found' });
        return;
    }
    
    if (!userSession || userSession.role !== 'host') {
        console.log('❌ User is not host. Session:', userSession);
        socket.emit('error', { message: 'Only the host can start the session' });
        return;
    }
    
    console.log('✅ Starting music session for room:', data.roomId);
    
    room.status = 'playing';
    room.startTime = new Date().toISOString();
    room.gameResults = new Map(); // Store individual player results
    
    // Generate synchronized music sequence for all players
    const musicSequence = generateMusicSequence();
    room.musicSequence = musicSequence;
    
    // Calculate synchronized start time (3 seconds from now to allow for loading)
    const syncStartTime = Date.now() + 3000;
    room.syncStartTime = syncStartTime;
    
    io.to(data.roomId).emit('music-session-started', {
        message: 'Music session starting in 3 seconds...',
        startTime: room.startTime,
        syncStartTime: syncStartTime,
        musicSequence: musicSequence,
        roomId: data.roomId
    });
    
    broadcastPublicRooms();
    broadcastDashboardUpdate();
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create room
    socket.on('create-room', (data) => {
        const { userId, roomName, instrument, skillLevel, isPublic } = data;
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const room = new Room(roomId, userId, isPublic, roomName, instrument, skillLevel);
        rooms.set(roomId, room);
        
        // Update user session
        userSessions.set(socket.id, { userId, roomId, role: 'host' });
        room.participants.get(userId).socketId = socket.id;
        
        // Join socket room
        socket.join(roomId);
        
        // Send room info back to creator
        socket.emit('room-created', {
            success: true,
            room: {
                id: roomId,
                code: room.code,
                roomName: room.roomName,
                instrument: room.instrument,
                skillLevel: room.skillLevel,
                isPublic: room.isPublic,
                participantCount: room.getParticipantCount()
            }
        });

        // Broadcast updated public rooms list
        if (isPublic) {
            broadcastPublicRooms();
        }

        console.log(`Room created: ${roomId} by ${userId} (${isPublic ? 'public' : 'private'})`);
    });

    // Join room by code (private rooms)
    socket.on('join-room-by-code', (data) => {
        const { userId, roomCode } = data;
        
        // Find room by code
        const room = Array.from(rooms.values()).find(r => r.code === roomCode);
        
        if (!room) {
            socket.emit('join-room-error', { message: 'Invalid room code' });
            return;
        }

        if (room.status !== 'waiting') {
            socket.emit('join-room-error', { message: 'Room is not accepting new participants' });
            return;
        }

        // Add participant to room
        room.addParticipant(userId, socket.id);
        userSessions.set(socket.id, { userId, roomId: room.id, role: 'participant' });
        
        // Join socket room
        socket.join(room.id);
        
        // Notify participant
        socket.emit('room-joined', {
            success: true,
            room: {
                id: room.id,
                roomName: room.roomName,
                instrument: room.instrument,
                skillLevel: room.skillLevel,
                participantCount: room.getParticipantCount()
            }
        });

        // Notify all participants in the room
        socket.to(room.id).emit('participant-joined', {
            userId,
            participantCount: room.getParticipantCount()
        });

        console.log(`User ${userId} joined room ${room.id} via code ${roomCode}`);
    });

    // Join public room
    socket.on('join-public-room', (data) => {
        const { userId, roomId } = data;
        
        const room = rooms.get(roomId);
        
        if (!room || !room.isPublic) {
            socket.emit('join-room-error', { message: 'Room not found or not public' });
            return;
        }

        if (room.status !== 'waiting') {
            socket.emit('join-room-error', { message: 'Room is not accepting new participants' });
            return;
        }

        // Add participant to room
        room.addParticipant(userId, socket.id);
        userSessions.set(socket.id, { userId, roomId: room.id, role: 'participant' });
        
        // Join socket room
        socket.join(room.id);
        
        // Notify participant
        socket.emit('room-joined', {
            success: true,
            room: {
                id: room.id,
                roomName: room.roomName,
                instrument: room.instrument,
                skillLevel: room.skillLevel,
                participantCount: room.getParticipantCount()
            }
        });

        // Notify all participants in the room
        socket.to(room.id).emit('participant-joined', {
            userId,
            participantCount: room.getParticipantCount()
        });

        // Update public rooms list
        broadcastPublicRooms();

        console.log(`User ${userId} joined public room ${room.id}`);
    });

    // Get public rooms
    socket.on('get-public-rooms', () => {
        const publicRooms = Array.from(rooms.values())
            .filter(room => room.isPublic && room.status === 'waiting')
            .map(room => room.toPublicInfo());
        
        socket.emit('public-rooms-list', publicRooms);
    });

    // Handle legacy start-session event (redirect to start-music-session)
    socket.on('start-session', () => {
        console.log('🔄 Legacy start-session event received, redirecting...');
        const userSession = userSessions.get(socket.id);
        if (userSession && userSession.roomId) {
            // Trigger the start-music-session handler directly
            const data = { roomId: userSession.roomId };
            console.log('🔄 Triggering start-music-session with data:', data);
            
            // Call the handler directly instead of emitting back to client
            handleMusicSessionStart(socket, data);
        }
    });

    // Handle music session start
    socket.on('start-music-session', (data) => {
        handleMusicSessionStart(socket, data);
    });

    // Handle request for room music sequence
    socket.on('get-room-music-sequence', (data) => {
        const room = rooms.get(data.roomId);
        if (!room || !room.musicSequence) {
            socket.emit('error', { message: 'Room or music sequence not found' });
            return;
        }

        socket.emit('room-music-sequence', {
            musicSequence: room.musicSequence,
            syncStartTime: room.syncStartTime
        });
    });

    // Handle game result submission
    socket.on('submit-game-result', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Store the player's result
        room.gameResults.set(socket.id, {
            userId: data.userId || socket.id,
            accuracy: data.accuracy,
            correctNotes: data.correctNotes,
            totalNotes: data.totalNotes,
            score: data.score,
            maxStreak: data.maxStreak,
            sessionId: data.sessionId,
            finishedAt: new Date().toISOString()
        });

        // Notify room about player finishing
        const playersFinished = room.gameResults.size;
        const totalPlayers = room.participants.size;
        
        io.to(data.roomId).emit('player-finished', {
            playersFinished: playersFinished,
            totalPlayers: totalPlayers,
            userId: data.userId || socket.id
        });

        // Check if all players have finished
        if (playersFinished >= totalPlayers) {
            // Calculate final results and rankings
            const results = Array.from(room.gameResults.values())
                .sort((a, b) => {
                    // Sort by accuracy first, then by score
                    if (b.accuracy !== a.accuracy) {
                        return b.accuracy - a.accuracy;
                    }
                    return b.score - a.score;
                })
                .map((result, index) => ({
                    ...result,
                    rank: index + 1,
                    isWinner: index === 0
                }));

            // Emit final results to all players
            io.to(data.roomId).emit('game-completed', {
                results: results,
                completedAt: new Date().toISOString()
            });

            // Reset room status
            room.status = 'waiting';
            room.gameResults.clear();
            
            broadcastPublicRooms();
            broadcastDashboardUpdate();
        }
    });

    // Leave room
    socket.on('leave-room', () => {
        handleUserLeave(socket);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handleUserLeave(socket);
    });

    // Chat message
    socket.on('chat-message', (data) => {
        const userSession = userSessions.get(socket.id);
        if (userSession) {
            const room = rooms.get(userSession.roomId);
            if (room) {
                io.to(room.id).emit('chat-message', {
                    userId: userSession.userId,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        }
    });

    // Handle real-time player updates during multiplayer games
    socket.on('player-note-update', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.status === 'playing') {
            // Broadcast note update to all other players in the room
            socket.to(data.roomId).emit('player-note-update', data);
        }
    });

    socket.on('player-progress-update', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.status === 'playing') {
            // Broadcast progress update to all other players in the room
            socket.to(data.roomId).emit('player-progress-update', data);
        }
    });

    socket.on('player-accuracy-update', (data) => {
        const room = rooms.get(data.roomId);
        if (room && room.status === 'playing') {
            // Broadcast accuracy update to all other players in the room
            socket.to(data.roomId).emit('player-accuracy-update', data);
        }
    });

    // Handle game control events
    socket.on('pause-game', (data) => {
        const room = rooms.get(data.roomId);
        const userSession = userSessions.get(socket.id);
        
        if (room && userSession && userSession.role === 'host') {
            room.status = 'paused';
            io.to(data.roomId).emit('game-paused', {
                message: 'Game paused by host',
                timestamp: new Date()
            });
        }
    });

    socket.on('resume-game', (data) => {
        const room = rooms.get(data.roomId);
        const userSession = userSessions.get(socket.id);
        
        if (room && userSession && userSession.role === 'host') {
            room.status = 'playing';
            io.to(data.roomId).emit('game-resumed', {
                message: 'Game resumed by host',
                timestamp: new Date()
            });
        }
    });

    socket.on('end-game', (data) => {
        const room = rooms.get(data.roomId);
        const userSession = userSessions.get(socket.id);
        
        if (room && userSession && userSession.role === 'host') {
            room.status = 'waiting';
            io.to(data.roomId).emit('game-ended', {
                message: 'Game ended by host',
                timestamp: new Date()
            });
            
            broadcastPublicRooms();
            broadcastDashboardUpdate();
        }
    });
});

function handleUserLeave(socket) {
    const userSession = userSessions.get(socket.id);
    if (!userSession) return;

    const room = rooms.get(userSession.roomId);
    if (!room) return;

    // Remove participant from room
    room.removeParticipant(userSession.userId);
    
    // If host leaves, close the room
    if (userSession.role === 'host') {
        io.to(room.id).emit('room-closed', { message: 'Host has left the room' });
        rooms.delete(room.id);
        
        // Update public rooms if it was public
        if (room.isPublic) {
            broadcastPublicRooms();
        }
    } else {
        // Notify remaining participants
        socket.to(room.id).emit('participant-left', {
            userId: userSession.userId,
            participantCount: room.getParticipantCount()
        });
        
        // Update public rooms count if public
        if (room.isPublic) {
            broadcastPublicRooms();
        }
    }

    userSessions.delete(socket.id);
}

function broadcastPublicRooms() {
    const publicRooms = Array.from(rooms.values())
        .filter(room => room.isPublic && room.status === 'waiting')
        .map(room => room.toPublicInfo());
    
    io.emit('public-rooms-updated', publicRooms);
}

function broadcastDashboardUpdate() {
    const stats = {
        totalRooms: rooms.size,
        totalUsers: Array.from(rooms.values()).reduce((sum, room) => sum + room.participants.size, 0),
        activeRooms: Array.from(rooms.values()).filter(room => room.status === 'waiting').length,
        playingRooms: Array.from(rooms.values()).filter(room => room.status === 'playing').length
    };
    
    io.emit('dashboard-update', stats);
}

// Generate synchronized music sequence for multiplayer sessions
function generateMusicSequence() {
    const notePositions = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];
    const yToNote = {
        20: 'A5', 30: 'G5', 40: 'F5', 50: 'E5', 60: 'D5',
        70: 'C5', 80: 'B4', 90: 'A4', 100: 'G4', 110: 'F4',
        120: 'E4', 130: 'D4', 140: 'C4'
    };
    
    const totalMeasures = 20;
    const measures = [];
    const quarterNoteSpacing = 60;
    const halfNoteSpacing = 120;
    const wholeNoteSpacing = 240;
    const screenWidth = 800; // Assuming standard screen width
    const noteOffsetFromBar = 30;
    
    let currentX = screenWidth;
    let noteIndex = 0;
    const gameNotes = [];

    // Generate measures randomly but deterministically
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

    // Convert measures to game notes format
    measures.forEach(measure => {
        currentX += noteOffsetFromBar;

        measure.forEach(note => {
            let spacing = note.beats === 1 ? quarterNoteSpacing
                       : note.beats === 2 ? halfNoteSpacing
                       : wholeNoteSpacing;

            const gameNote = {
                id: `note-${noteIndex}`,
                x: currentX,
                y: note.y,
                type: note.type,
                beats: note.beats,
                noteName: yToNote[note.y] || 'Unknown',
                judged: false
            };

            gameNotes.push(gameNote);
            currentX += spacing;
            noteIndex++;
        });

        currentX += noteOffsetFromBar; // Bar spacing
    });

    return {
        measures: measures,
        gameNotes: gameNotes,
        totalScrollTime: 80, // Default scroll time
        screenWidth: screenWidth
    };
}



function generateMusicXMLFromMeasures(measures, title = 'AI Generated Practice') {
    const durationMap = {
        'whole': 4,
        'half': 2,
        'dotted-quarter': 1.5,
        'quarter': 1,
        'eighth': 0.5,
        'sixteenth': 0.25
    };
    
    let measureXML = '';
    measures.forEach((measure, index) => {
        if (index === 0) {
            // First measure includes attributes
            measureXML += `    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>\n`;
        } else {
            measureXML += `    <measure number="${index + 1}">\n`;
        }
        
        measure.notes.forEach(note => {
            const duration = durationMap[note.duration] || 1;
            const divisions = 4; // Quarter note = 4 divisions
            const noteDuration = Math.round(duration * divisions);
            
            measureXML += `      <note>
        <pitch>
          <step>${note.pitch}</step>
          <octave>${note.octave}</octave>
        </pitch>
        <duration>${noteDuration}</duration>
        <type>${note.duration.replace('dotted-', '')}</type>`;
            if (note.duration.includes('dotted')) {
                measureXML += `
        <dot/>`;
            }
            measureXML += `
      </note>
`;
        });
        
        measureXML += `    </measure>
`;
    });
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${title}</work-title>
  </work>
  <identification>
    <creator type="composer">Crescendo AI</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Practice Exercise</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measureXML}  </part>
</score-partwise>`;
}

// AI Music Generation endpoint
app.post('/api/generate-music', async (req, res) => {
    try {
        const { practiceGoals } = req.body;
        
        if (!practiceGoals) {
            return res.status(400).json({ error: 'Practice goals are required' });
        }

        console.log('🤖 Generating music for goals:', practiceGoals);
        
        // Generate music using Cohere AI
        const musicXML = await generateMusicWithAI(practiceGoals);
        
        res.json({
            success: true,
            musicXML: musicXML,
            practiceGoals: practiceGoals,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('🤖 AI music generation failed:', error);
        res.status(500).json({ 
            error: 'Failed to generate music', 
            details: error.message 
        });
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/waiting-room', (req, res) => {
    res.sendFile(path.join(__dirname, 'waiting-room.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Bind to all network interfaces

server.listen(PORT, HOST, () => {
    console.log(`🎵 Crescendo Waiting Room Server running on ${HOST}:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🏠 Waiting Room: http://localhost:${PORT}`);
    console.log(`🌐 Network Access: http://[YOUR_LOCAL_IP]:${PORT}`);
    console.log(`💡 To find your local IP, run: ipconfig | findstr "IPv4"`);
});
