class DashboardApp {
    constructor() {
        this.socket = io();
        this.rooms = [];
        this.activityLog = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadDashboardData();
    }

    initializeElements() {
        // Stats elements
        this.totalRoomsEl = document.getElementById('totalRooms');
        this.publicRoomsEl = document.getElementById('publicRooms');
        this.privateRoomsEl = document.getElementById('privateRooms');
        this.totalUsersEl = document.getElementById('totalUsers');

        // Controls
        this.refreshBtn = document.getElementById('refreshBtn');
        this.instrumentFilter = document.getElementById('instrumentFilter');
        this.skillFilter = document.getElementById('skillFilter');

        // Content areas
        this.publicRoomsList = document.getElementById('publicRoomsList');
        this.activityFeed = document.getElementById('activityFeed');
    }

    setupEventListeners() {
        this.refreshBtn.addEventListener('click', () => this.loadDashboardData());
        this.instrumentFilter.addEventListener('change', () => this.filterRooms());
        this.skillFilter.addEventListener('change', () => this.filterRooms());
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Dashboard connected to server');
            this.addActivity('Dashboard connected', 'info');
        });

        this.socket.on('disconnect', () => {
            console.log('Dashboard disconnected from server');
            this.addActivity('Dashboard disconnected', 'error');
        });

        this.socket.on('public-rooms-list', (rooms) => {
            this.rooms = rooms;
            this.updateStats();
            this.displayRooms();
        });

        this.socket.on('public-rooms-updated', (rooms) => {
            this.rooms = rooms;
            this.updateStats();
            this.displayRooms();
        });

        // Listen for room events to update activity feed
        this.socket.on('room-activity', (data) => {
            this.addActivity(data.message, data.type);
        });
    }

    loadDashboardData() {
        this.socket.emit('get-public-rooms');
        this.addActivity('Dashboard data refreshed', 'info');
    }

    updateStats() {
        const publicRooms = this.rooms.length;
        const totalUsers = this.rooms.reduce((sum, room) => sum + room.participantCount, 0);

        this.publicRoomsEl.textContent = publicRooms;
        this.totalRoomsEl.textContent = publicRooms; // Only showing public rooms for now
        this.privateRoomsEl.textContent = '?'; // Private rooms are not exposed for privacy
        this.totalUsersEl.textContent = totalUsers;

        // Animate the numbers
        this.animateValue(this.publicRoomsEl, 0, publicRooms, 500);
        this.animateValue(this.totalUsersEl, 0, totalUsers, 500);
    }

    animateValue(element, start, end, duration) {
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(start + (end - start) * progress);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    displayRooms() {
        if (this.rooms.length === 0) {
            this.publicRoomsList.innerHTML = `
                <div class="empty-state">
                    <h3>🎵 No Public Rooms</h3>
                    <p>No public rooms are currently active. Musicians can create rooms to start collaborating!</p>
                </div>
            `;
            return;
        }

        const filteredRooms = this.getFilteredRooms();
        
        if (filteredRooms.length === 0) {
            this.publicRoomsList.innerHTML = `
                <div class="empty-state">
                    <h3>🔍 No Matching Rooms</h3>
                    <p>No rooms match your current filters. Try adjusting the filters or check back later.</p>
                </div>
            `;
            return;
        }

        this.publicRoomsList.innerHTML = filteredRooms.map(room => `
            <div class="dashboard-room-card">
                <div class="room-header">
                    <h4>${this.escapeHtml(room.roomName)}</h4>
                    <span class="room-status ${room.status}">${room.status}</span>
                </div>
                <div class="room-details">
                    <div class="detail-item">
                        <span class="detail-label">🎹 Instrument:</span>
                        <span class="detail-value">${this.escapeHtml(room.instrument)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">📊 Skill Level:</span>
                        <span class="detail-value">${this.escapeHtml(room.skillLevel)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">👥 Participants:</span>
                        <span class="detail-value">${room.participantCount}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">⏰ Created:</span>
                        <span class="detail-value">${this.formatTime(room.createdAt)}</span>
                    </div>
                </div>
                <div class="room-actions">
                    <a href="/" class="btn btn-primary btn-small">Join Room</a>
                </div>
            </div>
        `).join('');
    }

    getFilteredRooms() {
        const instrumentFilter = this.instrumentFilter.value;
        const skillFilter = this.skillFilter.value;

        return this.rooms.filter(room => {
            const matchesInstrument = !instrumentFilter || room.instrument === instrumentFilter;
            const matchesSkill = !skillFilter || room.skillLevel === skillFilter;
            return matchesInstrument && matchesSkill;
        });
    }

    filterRooms() {
        this.displayRooms();
        const filteredCount = this.getFilteredRooms().length;
        this.addActivity(`Filtered rooms: ${filteredCount} results`, 'info');
    }

    addActivity(message, type = 'info') {
        const activity = {
            message,
            type,
            timestamp: new Date()
        };

        this.activityLog.unshift(activity);
        
        // Keep only last 20 activities
        if (this.activityLog.length > 20) {
            this.activityLog = this.activityLog.slice(0, 20);
        }

        this.updateActivityFeed();
    }

    updateActivityFeed() {
        if (this.activityLog.length === 0) {
            this.activityFeed.innerHTML = `
                <div class="empty-state">
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        this.activityFeed.innerHTML = this.activityLog.map(activity => `
            <div class="activity-item ${activity.type}">
                <div class="activity-icon">
                    ${this.getActivityIcon(activity.type)}
                </div>
                <div class="activity-content">
                    <div class="activity-message">${this.escapeHtml(activity.message)}</div>
                    <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    getActivityIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '📝';
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardApp = new DashboardApp();
});
