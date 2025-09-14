class WaitingRoomApp {
    constructor() {
        this.socket = io('http://10.37.114.110:3001');
        this.username = '';
        this.currentRoom = null;
        this.isHost = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.handleUrlParams();
    }

    initializeElements() {
        // Screens
        this.usernameScreen = document.getElementById('usernameScreen');
        this.mainMenuScreen = document.getElementById('mainMenuScreen');
        this.createRoomScreen = document.getElementById('createRoomScreen');
        this.joinPrivateScreen = document.getElementById('joinPrivateScreen');
        this.publicRoomsScreen = document.getElementById('publicRoomsScreen');
        this.waitingRoomScreen = document.getElementById('waitingRoomScreen');

        // Username elements
        this.usernameInput = document.getElementById('usernameInput');
        this.usernameSetup = document.getElementById('usernameSetup');
        this.setUsernameBtn = document.getElementById('setUsernameBtn');
        this.confirmUsernameBtn = document.getElementById('confirmUsernameBtn');

        // Menu buttons
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinPrivateBtn = document.getElementById('joinPrivateBtn');
        this.browsePublicBtn = document.getElementById('browsePublicBtn');

        // Form elements
        this.createRoomForm = document.getElementById('createRoomForm');
        this.joinPrivateForm = document.getElementById('joinPrivateForm');
        this.roomNameInput = document.getElementById('roomName');
        this.instrumentSelect = document.getElementById('instrument');
        this.skillLevelSelect = document.getElementById('skillLevel');
        this.isPublicCheckbox = document.getElementById('isPublic');
        this.roomCodeInput = document.getElementById('roomCode');
        this.joinUsernameInput = document.getElementById('joinUsername');

        // Navigation buttons
        this.backToMenuBtn = document.getElementById('backToMenuBtn');
        this.backToMenuFromPrivate = document.getElementById('backToMenuFromPrivate');
        this.backToMenuFromPublic = document.getElementById('backToMenuFromPublic');

        // Public rooms elements
        this.publicRoomsList = document.getElementById('publicRoomsList');
        this.refreshRoomsBtn = document.getElementById('refreshRoomsBtn');

        // Waiting room elements
        this.currentRoomName = document.getElementById('currentRoomName');
        this.currentInstrument = document.getElementById('currentInstrument');
        this.currentSkillLevel = document.getElementById('currentSkillLevel');
        this.participantCount = document.getElementById('participantCount');
        this.roomCodeSection = document.getElementById('roomCodeSection');
        this.displayRoomCode = document.getElementById('displayRoomCode');
        this.copyCodeBtn = document.getElementById('copyCodeBtn');
        this.participantsList = document.getElementById('participantsList');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendChatBtn = document.getElementById('sendChatBtn');
        this.hostControls = document.getElementById('hostControls');
        this.startSessionBtn = document.getElementById('startSessionBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');

        // Status message
        this.statusMessage = document.getElementById('statusMessage');
    }

    setupEventListeners() {
        // Username setup
        this.confirmUsernameBtn.addEventListener('click', () => this.setUsername());
        this.setUsernameBtn.addEventListener('click', () => this.setUsername());
        this.usernameSetup.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.setUsername();
        });

        // Menu navigation
        this.createRoomBtn.addEventListener('click', () => this.showScreen('createRoomScreen'));
        this.joinPrivateBtn.addEventListener('click', () => this.showScreen('joinPrivateScreen'));
        this.browsePublicBtn.addEventListener('click', () => {
            this.showScreen('publicRoomsScreen');
            this.loadPublicRooms();
        });

        // Back buttons
        this.backToMenuBtn.addEventListener('click', () => this.showScreen('mainMenuScreen'));
        this.backToMenuFromPrivate.addEventListener('click', () => this.showScreen('mainMenuScreen'));
        this.backToMenuFromPublic.addEventListener('click', () => this.showScreen('mainMenuScreen'));

        // Forms
        this.createRoomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoom();
        });

        this.joinPrivateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinPrivateRoom();
        });

        // Room code input formatting
        this.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });

        // Public rooms
        this.refreshRoomsBtn.addEventListener('click', () => this.loadPublicRooms());

        // Waiting room
        this.copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        this.sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        this.startSessionBtn.addEventListener('click', () => this.startSession());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
    }

    setupSocketListeners() {
        // Room creation
        this.socket.on('room-created', (data) => {
            if (data.success) {
                this.currentRoom = data.room;
                this.isHost = true;
                this.showWaitingRoom();
                this.showStatus('Room created successfully!', 'success');
            }
        });

        // Room joining
        this.socket.on('room-joined', (data) => {
            if (data.success) {
                this.currentRoom = data.room;
                this.isHost = false;
                this.showWaitingRoom();
                this.showStatus('Joined room successfully!', 'success');
            }
        });

        // Join errors
        this.socket.on('join-room-error', (data) => {
            this.showStatus(data.message, 'error');
        });

        // Public rooms updates
        this.socket.on('public-rooms-list', (rooms) => {
            this.displayPublicRooms(rooms);
        });

        this.socket.on('public-rooms-updated', (rooms) => {
            if (this.publicRoomsScreen.classList.contains('active')) {
                this.displayPublicRooms(rooms);
            }
        });

        // Participant updates
        this.socket.on('participant-joined', (data) => {
            this.updateParticipantCount(data.participantCount);
            this.addChatMessage('System', `${data.userId} joined the room`, true);
        });

        this.socket.on('participant-left', (data) => {
            this.updateParticipantCount(data.participantCount);
            this.addChatMessage('System', `${data.userId} left the room`, true);
        });

        // Chat messages
        this.socket.on('chat-message', (data) => {
            this.addChatMessage(data.userId, data.message, false, data.timestamp);
        });

        // Listen for music session start
        this.socket.on('music-session-started', (data) => {
            this.showStatus(`${data.message}`, 'success');
            
            // Show countdown and redirect all participants to the game
            this.showMusicSessionCountdown(data);
        });

        // Room closed
        this.socket.on('room-closed', (data) => {
            this.showStatus(data.message, 'error');
            this.leaveRoom();
        });

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.showStatus('Disconnected from server', 'error');
        });
    }

    setUsername() {
        const username = this.usernameSetup.value.trim() || this.usernameInput.value.trim();
        if (username.length < 2) {
            this.showStatus('Username must be at least 2 characters long', 'error');
            return;
        }

        this.username = username;
        this.usernameInput.value = username;
        this.showScreen('mainMenuScreen');
        this.showStatus(`Welcome, ${username}!`, 'success');
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        document.getElementById(screenId).classList.add('active');
    }

    createRoom() {
        if (!this.username) {
            this.showStatus('Please set your username first', 'error');
            return;
        }

        const roomData = {
            userId: this.username,
            roomName: this.roomNameInput.value.trim(),
            instrument: this.instrumentSelect.value,
            skillLevel: this.skillLevelSelect.value,
            isPublic: this.isPublicCheckbox.checked
        };

        if (!roomData.roomName || !roomData.instrument || !roomData.skillLevel) {
            this.showStatus('Please fill in all required fields', 'error');
            return;
        }

        this.socket.emit('create-room', roomData);
    }

    joinPrivateRoom() {
        const username = this.joinUsernameInput.value.trim();
        const roomCode = this.roomCodeInput.value.trim();

        if (!username || username.length < 2) {
            this.showStatus('Please enter a username (at least 2 characters)', 'error');
            return;
        }

        if (roomCode.length !== 4) {
            this.showStatus('Please enter a valid 4-digit room code', 'error');
            return;
        }

        // Set the username for the session
        this.username = username;

        this.socket.emit('join-room-by-code', {
            userId: this.username,
            roomCode: roomCode
        });
    }

    loadPublicRooms() {
        this.publicRoomsList.innerHTML = '<div class="loading">Loading rooms...</div>';
        this.socket.emit('get-public-rooms');
    }

    displayPublicRooms(rooms) {
        if (rooms.length === 0) {
            this.publicRoomsList.innerHTML = '<div class="loading">No public rooms available</div>';
            return;
        }

        this.publicRoomsList.innerHTML = rooms.map(room => `
            <div class="room-item" onclick="waitingRoomApp.joinPublicRoom('${room.id}')">
                <h4>${this.escapeHtml(room.roomName)}</h4>
                <div class="room-details">
                    <span>🎹 ${this.escapeHtml(room.instrument)}</span>
                    <span>📊 ${this.escapeHtml(room.skillLevel)}</span>
                </div>
                <div class="room-participants">
                    👥 ${room.participantCount} participant${room.participantCount !== 1 ? 's' : ''}
                </div>
            </div>
        `).join('');
    }

    joinPublicRoom(roomId) {
        if (!this.username) {
            this.showStatus('Please set your username first', 'error');
            return;
        }

        this.socket.emit('join-public-room', {
            userId: this.username,
            roomId: roomId
        });
    }

    showWaitingRoom() {
        this.showScreen('waitingRoomScreen');
        this.updateRoomDisplay();
        this.updateParticipantsList();
        this.clearChat();
    }

    updateRoomDisplay() {
        if (!this.currentRoom) return;

        this.currentRoomName.textContent = this.currentRoom.roomName;
        this.currentInstrument.textContent = `🎹 ${this.currentRoom.instrument}`;
        this.currentSkillLevel.textContent = this.currentRoom.skillLevel;
        this.updateParticipantCount(this.currentRoom.participantCount);

        // Show room code for private rooms
        if (this.currentRoom.code) {
            this.roomCodeSection.style.display = 'block';
            this.displayRoomCode.textContent = this.currentRoom.code;
        } else {
            this.roomCodeSection.style.display = 'none';
        }

        // Show host controls if user is host
        if (this.isHost) {
            this.hostControls.style.display = 'block';
        } else {
            this.hostControls.style.display = 'none';
        }
    }

    updateParticipantCount(count) {
        this.participantCount.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
    }

    updateParticipantsList() {
        // For now, just show the current user
        // In a full implementation, you'd track all participants
        this.participantsList.innerHTML = `
            <div class="participant-item">
                <div class="participant-avatar">${this.username.charAt(0).toUpperCase()}</div>
                <div class="participant-info">
                    <div class="participant-name">${this.escapeHtml(this.username)}</div>
                    <div class="participant-role">${this.isHost ? 'Host' : 'Participant'}</div>
                </div>
            </div>
        `;
    }

    copyRoomCode() {
        if (this.currentRoom && this.currentRoom.code) {
            navigator.clipboard.writeText(this.currentRoom.code).then(() => {
                this.showStatus('Room code copied to clipboard!', 'success');
            }).catch(() => {
                this.showStatus('Failed to copy room code', 'error');
            });
        }
    }

    sendChatMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        this.socket.emit('chat-message', { message });
        this.chatInput.value = '';
    }

    addChatMessage(username, message, isSystem = false, timestamp = new Date()) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="chat-message-header">
                <span class="chat-username">${isSystem ? '🤖 System' : this.escapeHtml(username)}</span>
                <span class="chat-timestamp">${time}</span>
            </div>
            <div class="chat-text">${this.escapeHtml(message)}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    clearChat() {
        this.chatMessages.innerHTML = '';
        this.addChatMessage('System', 'Welcome to the room! Chat with other participants while waiting.', true);
    }

    startSession() {
        console.log('🎵 Start Session clicked!');
        console.log('Current room:', this.currentRoom);
        console.log('Is host:', this.isHost);
        
        if (!this.currentRoom || !this.isHost) {
            console.log('❌ Cannot start session - not host or no room');
            this.showStatus('Only the host can start the music session', 'error');
            return;
        }
        
        console.log('✅ Emitting start-music-session event with roomId:', this.currentRoom.id);
        this.socket.emit('start-music-session', {
            roomId: this.currentRoom.id
        });
    }

    startMusicGame() {
        if (this.currentRoom && this.isHost) {
            // Host starts the music session for all players
            this.socket.emit('start-music-session', {
                roomId: this.currentRoom.id
            });
        } else {
            // Non-host players shouldn't be able to start sessions
            this.showStatus('Only the host can start the music session', 'error');
        }
    }

    showMusicSessionCountdown(data) {
        // Create countdown overlay
        const overlay = document.createElement('div');
        overlay.className = 'countdown-overlay';
        overlay.innerHTML = `
            <div class="countdown-content">
                <h2>🎵 Music Session Starting!</h2>
                <div class="countdown-number">3</div>
                <p>Get ready to play together...</p>
            </div>
        `;
        document.body.appendChild(overlay);

        let countdown = 3;
        const countdownElement = overlay.querySelector('.countdown-number');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                countdownElement.textContent = countdown;
            } else {
                clearInterval(countdownInterval);
                countdownElement.textContent = 'GO!';
                
                // Redirect to main.html with multiplayer data
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    this.redirectToMultiplayerGame(data);
                }, 500);
            }
        }, 1000);
    }

    leaveRoom() {
        if (this.currentRoom) {
            this.socket.emit('leave-room');
            this.currentRoom = null;
            this.isHost = false;
        }
        this.showScreen('mainMenuScreen');
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type} show`;
        
        setTimeout(() => {
            this.statusMessage.classList.remove('show');
        }, 4000);
    }

    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const code = urlParams.get('code');

        if (action === 'create') {
            // Skip username screen and go directly to create room
            this.showScreen('createRoomScreen');
        } else if (action === 'join') {
            // Go directly to join screen (username + code on same page)
            if (code) {
                this.roomCodeInput.value = code;
            }
            this.showScreen('joinPrivateScreen');
        } else if (action === 'browse') {
            // Go directly to public rooms browser
            this.showScreen('publicRoomsScreen');
            this.loadPublicRooms();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    hideAllScreens() {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    redirectToMultiplayerGame(sessionData) {
        // Store multiplayer session data in localStorage for main.html to use
        const multiplayerData = {
            roomId: this.currentRoom.id,
            username: this.username,
            isHost: this.isHost,
            musicSequence: sessionData.musicSequence,
            syncStartTime: sessionData.syncStartTime,
            isMultiplayer: true,
            participants: Array.from(this.currentRoom.participants || [])
        };
        
        localStorage.setItem('multiplayerSession', JSON.stringify(multiplayerData));
        
        // Redirect to main.html
        window.location.href = '/main.html?mode=multiplayer';
    }

    showMultiplayerGameScreen(sessionData) {
        // Create multiplayer game screen
        const gameScreen = document.createElement('div');
        gameScreen.id = 'multiplayerGameScreen';
        gameScreen.className = 'screen active';
        gameScreen.innerHTML = `
            <div class="multiplayer-game">
                <div class="game-header">
                    <div class="room-info">
                        <h2>${this.currentRoom.roomName}</h2>
                        <span class="room-status">🎵 Playing</span>
                    </div>
                    <div class="game-controls">
                        <button id="pauseGameBtn" class="btn btn-secondary">Pause</button>
                        <button id="endGameBtn" class="btn btn-danger">End Game</button>
                    </div>
                </div>

                <div class="players-panel">
                    <div class="players-grid" id="playersGrid">
                        <!-- Player progress cards will be populated here -->
                    </div>
                </div>

                <div class="game-area">
                    <div class="detection-info">
                        <div class="detected-note-display">
                            <span class="label">Current Note:</span>
                            <span id="currentDetectedNote">-</span>
                        </div>
                        <div class="detected-frequency-display">
                            <span class="label">Frequency:</span>
                            <span id="currentDetectedFrequency">- Hz</span>
                        </div>
                        <div class="accuracy-display">
                            <span class="label">Your Accuracy:</span>
                            <span id="liveAccuracy">0.0%</span>
                        </div>
                    </div>

                    <div id="musicSheetContainer" class="music-sheet-container">
                        <div class="judgment-line"></div>
                        <!-- Music sheet will be rendered here -->
                    </div>

                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="gameProgressFill"></div>
                        </div>
                        <div class="progress-text">
                            <span id="progressTime">0:00</span> / <span id="totalTime">0:00</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelector('.container').appendChild(gameScreen);
        this.setupMultiplayerGameEventListeners();
    }

    setupMultiplayerGameEventListeners() {
        const pauseBtn = document.getElementById('pauseGameBtn');
        const endBtn = document.getElementById('endGameBtn');

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (this.isHost) {
                    this.socket.emit('pause-game', { roomId: this.currentRoom.id });
                } else {
                    this.showStatus('Only the host can pause the game', 'error');
                }
            });
        }

        if (endBtn) {
            endBtn.addEventListener('click', () => {
                if (this.isHost) {
                    this.socket.emit('end-game', { roomId: this.currentRoom.id });
                } else {
                    this.showStatus('Only the host can end the game', 'error');
                }
            });
        }
    }

    initializeMultiplayerGame(sessionData) {
        console.log('🎮 Initializing multiplayer game with data:', sessionData);
        
        // Initialize pitch detector
        this.initializePitchDetector();
        
        // Initialize statistics tracking
        this.initializeStatistics();
        
        // Load and display the synchronized music sheet
        this.loadSynchronizedMusicSheet(sessionData.musicSequence);
        
        // Initialize player tracking
        this.initializePlayerTracking();
        
        // Start the synchronized game
        this.startSynchronizedGameplay(sessionData);
        
        console.log('✅ Multiplayer game initialization complete');
    }

    async initializePitchDetector() {
        try {
            if (!window.pitchDetector) {
                window.pitchDetector = new PitchDetector();
                await window.pitchDetector.initialize();
                window.pitchDetector.start();
            }
            console.log('🎤 Pitch detector initialized for multiplayer');
        } catch (error) {
            console.error('Failed to initialize pitch detector:', error);
            // Don't block the game if pitch detector fails - continue without it
            console.log('⚠️ Continuing multiplayer game without pitch detection');
            this.showStatus('Microphone access denied - playing in visual mode only', 'warning');
        }
    }

    initializeStatistics() {
        if (typeof NoteStatistics !== 'undefined') {
            window.noteStatistics = new NoteStatistics();
            window.noteStatistics.startSession('multiplayer', 5000);
            console.log('📊 Statistics initialized for multiplayer');
        }
    }

    loadSynchronizedMusicSheet(musicSequence) {
        console.log('🎼 Loading music sheet with sequence:', musicSequence);
        const container = document.getElementById('musicSheetContainer');
        if (!container) {
            console.error('❌ Music sheet container not found!');
            return;
        }

        console.log('✅ Music sheet container found');

        // Clear existing content
        container.innerHTML = '';

        // Create SVG for the music sheet
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "200");
        svg.setAttribute("viewBox", "0 0 1200 200");
        svg.id = "multiplayerMusicSheet";
        svg.style.border = "1px solid #ccc"; // Add border for debugging

        console.log('🎵 Created SVG element');

        // Draw staff lines
        for (let i = 0; i < 5; i++) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", "0");
            line.setAttribute("y1", 50 + i * 20);
            line.setAttribute("x2", "1200");
            line.setAttribute("y2", 50 + i * 20);
            line.setAttribute("stroke", "#333");
            line.setAttribute("stroke-width", "1");
            svg.appendChild(line);
        }

        console.log('📏 Added staff lines');

        // Draw notes from the music sequence
        if (musicSequence && musicSequence.gameNotes) {
            console.log(`🎵 Drawing ${musicSequence.gameNotes.length} notes`);
            musicSequence.gameNotes.forEach((note, index) => {
                const noteElement = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                noteElement.setAttribute("cx", note.x);
                noteElement.setAttribute("cy", note.y);
                noteElement.setAttribute("rx", "8");
                noteElement.setAttribute("ry", "6");
                noteElement.setAttribute("fill", "#333");
                noteElement.setAttribute("data-note-id", note.id);
                noteElement.setAttribute("data-note-name", note.noteName);
                svg.appendChild(noteElement);

                // Add note label
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", note.x);
                label.setAttribute("y", note.y - 15);
                label.setAttribute("text-anchor", "middle");
                label.setAttribute("font-size", "12");
                label.setAttribute("fill", "#666");
                label.textContent = note.noteName;
                svg.appendChild(label);
            });
        } else {
            console.error('❌ No music sequence or gameNotes found!', musicSequence);
            // Add fallback content
            const fallbackText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            fallbackText.setAttribute("x", "600");
            fallbackText.setAttribute("y", "100");
            fallbackText.setAttribute("text-anchor", "middle");
            fallbackText.setAttribute("font-size", "20");
            fallbackText.setAttribute("fill", "#666");
            fallbackText.textContent = "Loading music...";
            svg.appendChild(fallbackText);
        }

        container.appendChild(svg);
        this.gameNotes = musicSequence?.gameNotes || [];
        
        console.log('✅ Music sheet loaded successfully');
    }

    initializePlayerTracking() {
        const playersGrid = document.getElementById('playersGrid');
        if (!playersGrid || !this.currentRoom) return;

        // Create player cards for all participants
        Array.from(this.currentRoom.participants || []).forEach(participant => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.id = `player-${participant.userId}`;
            playerCard.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${participant.userId}</div>
                    <div class="player-instrument">${this.currentRoom.instrument}</div>
                </div>
                <div class="player-stats">
                    <div class="stat">
                        <span class="stat-label">Accuracy:</span>
                        <span class="stat-value" id="accuracy-${participant.userId}">0%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Score:</span>
                        <span class="stat-value" id="score-${participant.userId}">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Progress:</span>
                        <div class="mini-progress-bar">
                            <div class="mini-progress-fill" id="progress-${participant.userId}"></div>
                        </div>
                    </div>
                </div>
            `;
            playersGrid.appendChild(playerCard);
        });
    }

    startSynchronizedGameplay(sessionData) {
        console.log('🎮 Starting synchronized gameplay with data:', sessionData);
        this.gameStartTime = sessionData.syncStartTime;
        this.musicSequence = sessionData.musicSequence;
        this.isGameActive = true;
        
        console.log('🎵 Game marked as active, starting components...');
        
        // Start the scrolling animation
        this.startMusicSheetAnimation();
        
        // Start pitch detection and note tracking
        this.startNoteTracking();
        
        // Start progress tracking
        this.startProgressTracking();
        
        // Listen for real-time updates from other players
        this.setupRealtimePlayerUpdates();
        
        console.log('✅ All game components started');
    }

    startMusicSheetAnimation() {
        console.log('🎬 Starting music sheet animation');
        const svg = document.getElementById('multiplayerMusicSheet');
        if (!svg) {
            console.error('❌ SVG element not found for animation');
            return;
        }

        const totalDuration = this.musicSequence.totalScrollTime || 60;
        console.log(`⏱️ Setting animation duration: ${totalDuration}s`);
        svg.style.animation = `scrollLeft ${totalDuration}s linear`;
        console.log('✅ Animation started');
    }

    startNoteTracking() {
        this.noteTrackingInterval = setInterval(() => {
            if (!this.isGameActive) return;

            // Only track pitch if detector is available
            if (window.pitchDetector) {
                const pitchData = window.pitchDetector.detectPitch();
                if (pitchData && pitchData.confidence > 0.1 && pitchData.volume > 5) {
                    const noteInfo = window.pitchDetector.frequencyToNote(pitchData.frequency);
                    
                    // Update local display
                    document.getElementById('currentDetectedNote').textContent = `${noteInfo.note}${noteInfo.octave}`;
                    document.getElementById('currentDetectedFrequency').textContent = `${pitchData.frequency.toFixed(1)} Hz`;
                    
                    // Send real-time data to other players
                    this.socket.emit('player-note-update', {
                        roomId: this.currentRoom.id,
                        userId: this.username,
                        note: `${noteInfo.note}${noteInfo.octave}`,
                        frequency: pitchData.frequency,
                        confidence: pitchData.confidence,
                        timestamp: Date.now()
                    });

                    // Record for statistics
                    if (window.noteStatistics) {
                        window.noteStatistics.recordDetectionSample(
                            pitchData.frequency,
                            noteInfo.note,
                            noteInfo.octave,
                            pitchData.confidence,
                            pitchData.volume,
                            Date.now()
                        );
                    }
                }
            } else {
                // Visual mode - show placeholder text
                document.getElementById('currentDetectedNote').textContent = 'Visual Mode';
                document.getElementById('currentDetectedFrequency').textContent = 'No Mic';
            }
        }, 100);
    }

    startProgressTracking() {
        const startTime = Date.now();
        const totalDuration = (this.musicSequence.totalScrollTime || 60) * 1000;

        this.progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);
            
            // Update progress bar
            const progressFill = document.getElementById('gameProgressFill');
            if (progressFill) {
                progressFill.style.width = `${progress * 100}%`;
            }

            // Update time display
            const progressTime = document.getElementById('progressTime');
            const totalTime = document.getElementById('totalTime');
            if (progressTime && totalTime) {
                progressTime.textContent = this.formatTime(elapsed / 1000);
                totalTime.textContent = this.formatTime(totalDuration / 1000);
            }

            // Send progress update to other players
            this.socket.emit('player-progress-update', {
                roomId: this.currentRoom.id,
                userId: this.username,
                progress: progress,
                timestamp: Date.now()
            });

            // End game when complete
            if (progress >= 1) {
                this.endMultiplayerGame();
            }
        }, 1000);
    }

    setupRealtimePlayerUpdates() {
        // Listen for other players' note updates
        this.socket.on('player-note-update', (data) => {
            if (data.userId !== this.username) {
                // Update other player's display (could show their current note)
                console.log(`${data.userId} played: ${data.note}`);
            }
        });

        // Listen for other players' progress updates
        this.socket.on('player-progress-update', (data) => {
            if (data.userId !== this.username) {
                const progressElement = document.getElementById(`progress-${data.userId}`);
                if (progressElement) {
                    progressElement.style.width = `${data.progress * 100}%`;
                }
            }
        });

        // Listen for accuracy updates
        this.socket.on('player-accuracy-update', (data) => {
            const accuracyElement = document.getElementById(`accuracy-${data.userId}`);
            const scoreElement = document.getElementById(`score-${data.userId}`);
            
            if (accuracyElement) {
                accuracyElement.textContent = `${data.accuracy.toFixed(1)}%`;
            }
            if (scoreElement) {
                scoreElement.textContent = data.score.toString();
            }
        });
    }

    endMultiplayerGame() {
        this.isGameActive = false;
        
        // Clear intervals
        if (this.noteTrackingInterval) {
            clearInterval(this.noteTrackingInterval);
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        // End statistics session
        if (window.noteStatistics) {
            const gameStats = {
                difficulty: 'multiplayer',
                timePerNote: 5000,
                score: this.calculateFinalScore(),
                totalNotes: this.gameNotes.length,
                correctNotes: this.calculateCorrectNotes(),
                maxStreak: this.maxStreak || 0
            };
            window.noteStatistics.endSession(gameStats);
        }

        // Show final results
        this.showMultiplayerResults();
    }

    calculateFinalScore() {
        // Implementation for calculating final score
        return 0; // Placeholder
    }

    calculateCorrectNotes() {
        // Implementation for calculating correct notes
        return 0; // Placeholder
    }

    showMultiplayerResults() {
        // Create results overlay
        const overlay = document.createElement('div');
        overlay.className = 'results-overlay';
        overlay.innerHTML = `
            <div class="results-content">
                <h2>🎵 Game Complete!</h2>
                <p>Calculating final results...</p>
                <button id="backToWaitingRoom" class="btn btn-primary">Back to Room</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('backToWaitingRoom').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.returnToWaitingRoom();
        });
    }

    returnToWaitingRoom() {
        // Remove multiplayer game screen
        const gameScreen = document.getElementById('multiplayerGameScreen');
        if (gameScreen) {
            gameScreen.remove();
        }

        // Show waiting room screen
        this.hideAllScreens();
        this.waitingRoomScreen.classList.add('active');
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.waitingRoomApp = new WaitingRoomApp();
});
