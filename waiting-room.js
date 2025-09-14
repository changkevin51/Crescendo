class WaitingRoomApp {
    constructor() {
        this.socket = io();
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
        this.socket.emit('start-session');
    }

    startMusicGame() {
        if (this.currentRoom) {
            window.location.href = `main.html?room=${this.currentRoom.id}`;
        } else {
            window.location.href = 'main.html';
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
                
                // Redirect all participants to the game with synchronized data
                setTimeout(() => {
                    const gameUrl = `main.html?room=${data.roomId}&sync=${data.syncStartTime}&multiplayer=true`;
                    window.location.href = gameUrl;
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
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.waitingRoomApp = new WaitingRoomApp();
});
