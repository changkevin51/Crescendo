# 🎵 Crescendo Waiting Room System

A real-time music collaboration platform with advanced waiting room functionality, built with Node.js, Express, and Socket.IO.

## Features

### 🏠 Room Management
- **Public Rooms**: Discoverable rooms that anyone can join
- **Private Rooms**: Secure rooms with 4-digit access codes
- **Real-time Updates**: Live participant count and room status updates
- **Host Controls**: Room creators can start sessions and manage participants

### 👥 User Experience
- **Username System**: Simple username setup for identification
- **Multiple Join Methods**: 
  - Browse and click to join public rooms
  - Enter 4-digit codes for private rooms
- **Real-time Chat**: Communicate with other participants while waiting
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### 🎹 Music-Focused Features
- **Instrument Selection**: Choose your primary instrument when creating rooms
- **Skill Level Matching**: Filter rooms by skill level (Beginner, Intermediate, Advanced, Professional)
- **Room Filtering**: Find rooms by instrument type and skill level

### 📊 Dashboard & Monitoring
- **Live Statistics**: Real-time room and user counts
- **Public Room Browser**: View all active public rooms with details
- **Activity Feed**: Track room creation, joins, and other events
- **Advanced Filtering**: Filter rooms by instrument and skill level

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd Crescendo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   - **Main Waiting Room**: http://localhost:3001
   - **Dashboard**: http://localhost:3001/dashboard

### Development Mode
For development with auto-restart on file changes:
```bash
npm run dev
```

## Usage Guide

### Creating a Room

1. **Set Your Username**: Enter a username when you first visit the site
2. **Click "Create Room"**: Choose this option from the main menu
3. **Fill Room Details**:
   - Room name (e.g., "Jazz Jam Session")
   - Your instrument
   - Your skill level
   - Choose public or private room
4. **Share Room Code**: If private, share the 4-digit code with others

### Joining a Room

#### Public Rooms
1. Click "Browse Public Rooms"
2. View available rooms with instrument and skill level info
3. Click on any room to join instantly

#### Private Rooms
1. Click "Join Private Room"
2. Enter the 4-digit code provided by the host
3. Join the waiting room

### In the Waiting Room

- **Chat**: Communicate with other participants
- **View Participants**: See who's in the room
- **Host Controls**: If you're the host, you can start the music session
- **Room Code**: Private room codes are displayed for easy sharing

## Technical Architecture

### Backend (`server.js`)
- **Express.js** server for HTTP requests
- **Socket.IO** for real-time communication
- **In-memory room storage** (easily extensible to database)
- **Room lifecycle management**
- **User session tracking**

### Frontend
- **waiting-room.html**: Main application interface
- **dashboard.html**: Administrative monitoring interface
- **waiting-room.css**: Modern, responsive styling
- **waiting-room.js**: Main application logic
- **dashboard.js**: Dashboard functionality

### Real-time Events
- Room creation and joining
- Participant updates
- Chat messages
- Session start/stop
- Room status changes

## API Events

### Client to Server
- `create-room`: Create a new room
- `join-room-by-code`: Join private room with code
- `join-public-room`: Join public room by ID
- `get-public-rooms`: Request list of public rooms
- `chat-message`: Send chat message
- `start-session`: Start music session (host only)
- `leave-room`: Leave current room

### Server to Client
- `room-created`: Room creation confirmation
- `room-joined`: Room join confirmation
- `join-room-error`: Join attempt failed
- `public-rooms-list`: List of available public rooms
- `public-rooms-updated`: Updated room list
- `participant-joined/left`: Participant updates
- `chat-message`: Incoming chat message
- `session-started`: Music session began
- `room-closed`: Room was closed

## Customization

### Adding New Instruments
Edit the instrument dropdown in `waiting-room.html`:
```html
<option value="new-instrument">New Instrument</option>
```

### Styling Changes
Modify `waiting-room.css` to customize:
- Colors and gradients
- Layout and spacing
- Animations and transitions
- Responsive breakpoints

### Database Integration
Replace the in-memory `rooms` Map in `server.js` with your preferred database:
- MongoDB with Mongoose
- PostgreSQL with Sequelize
- Redis for session storage

## Deployment

### Environment Variables
```bash
PORT=3001  # Server port (default: 3001)
```

### Production Deployment
1. Set `NODE_ENV=production`
2. Configure reverse proxy (nginx/Apache)
3. Set up SSL certificates
4. Configure database connection
5. Set up monitoring and logging

## Dependencies

### Production
- **express**: Web application framework
- **socket.io**: Real-time bidirectional event-based communication
- **opensheetmusicdisplay**: Music notation display (existing)

### Development
- **nodemon**: Development server with auto-restart

## Browser Support
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the Crescendo music collaboration platform.

---

🎵 **Ready to start collaborating with musicians worldwide!** 🎵
