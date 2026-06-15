const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Use Render's dynamic port, fallback to 3001 for local dev
const PORT = process.env.PORT || 3001;

// Detect if we are running on Render
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || null;

// --- Firebase Config (Copied from Client) ---
const firebaseConfig = {
  apiKey: "AIzaSyBzfBhpdOw7bwt_PMykOP0icdGK7wkcaM4",
  authDomain: "tanprix-52683.firebaseapp.com",
  projectId: "tanprix-52683",
  storageBucket: "tanprix-52683.firebasestorage.app",
  messagingSenderId: "179060902521",
  appId: "1:179060902521:web:b717f47e67f304ff36e2a8",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e6, // 5MB max for frame data
});

// Track active SOS sessions
const activeSessions = new Map();

io.on('connection', (socket) => {
  console.log(`[Connect] Client: ${socket.id}`);

  // ─── Mobile Device: Start streaming a new SOS session ───
  socket.on('sos:start', (data) => {
    const { sosId, userId, userName, location } = data;
    console.log(`[SOS Start] Session: ${sosId} by ${userName}`);

    activeSessions.set(sosId, {
      sosId,
      userId,
      userName,
      location,
      streamerSocket: socket.id,
      startTime: Date.now(),
      lastFrameTime: Date.now(),
      humanDetected: false,
    });

    // Notify all admin clients about the new SOS
    socket.broadcast.emit('sos:new_session', {
      sosId,
      userId,
      userName,
      location,
      startTime: Date.now(),
    });

    // Join session-specific room
    socket.join(`sos:${sosId}`);
  });

  // ─── Mobile Device: Send a video frame ───
  socket.on('sos:frame', (data) => {
    const { sosId, frame, timestamp, humanDetected } = data;
    const session = activeSessions.get(sosId);

    if (session) {
      session.lastFrameTime = Date.now();
      session.humanDetected = humanDetected || session.humanDetected;

      // Relay the frame to all admin clients watching this session
      socket.broadcast.emit(`sos:live_frame:${sosId}`, {
        frame,
        timestamp,
        humanDetected,
      });
    }
  });

  // ─── Mobile Device: Stop SOS session ───
  socket.on('sos:stop', (data) => {
    const { sosId } = data;
    console.log(`[SOS Stop] Session: ${sosId}`);

    activeSessions.delete(sosId);

    socket.broadcast.emit('sos:session_ended', { sosId });
    socket.leave(`sos:${sosId}`);
  });

  // ─── Admin: Request list of active sessions ───
  socket.on('admin:get_sessions', () => {
    const sessions = Array.from(activeSessions.values()).map((s) => ({
      sosId: s.sosId,
      userId: s.userId,
      userName: s.userName,
      location: s.location,
      startTime: s.startTime,
      lastFrameTime: s.lastFrameTime,
      humanDetected: s.humanDetected,
    }));
    socket.emit('admin:sessions_list', sessions);
  });

  // ─── Admin: Join a specific SOS stream ───
  socket.on('admin:watch', (data) => {
    const { sosId } = data;
    console.log(`[Admin Watch] ${socket.id} watching ${sosId}`);
    socket.join(`sos:${sosId}`);

    // Notify the streamer that an admin is watching, so mobile can create an offer
    const session = activeSessions.get(sosId);
    if (session && session.streamerSocket) {
      io.to(session.streamerSocket).emit('admin:watch', { adminId: socket.id });
    }
  });

  // ─── Admin: Send voice command to user ───
  socket.on('admin:voice_command', (data) => {
    const { sosId, message } = data;
    const session = activeSessions.get(sosId);
    if (session) {
      io.to(session.streamerSocket).emit('sos:voice_command', {
        message,
        sosId,
      });
      console.log(`[Voice Command] → ${session.userName}: "${message}"`);
    }
  });

  // ─── WebRTC Signaling ───
  // Relay offer from streamer to specific admin or all admins in session
  socket.on('signal:offer', (data) => {
    const { sosId, offer } = data;
    console.log(`[Signal] Offer from ${socket.id} for session ${sosId}`);
    socket.to(`sos:${sosId}`).emit('signal:offer', {
      sosId,
      offer,
      from: socket.id,
    });
  });

  // Relay answer from admin back to the streamer
  socket.on('signal:answer', (data) => {
    const { sosId, answer, to } = data;
    console.log(`[Signal] Answer from ${socket.id} to ${to}`);
    io.to(to).emit('signal:answer', {
      sosId,
      answer,
    });
  });

  // Relay ICE candidates between any peers
  socket.on('signal:candidate', (data) => {
    const { sosId, candidate, to } = data;
    // If 'to' is provided, send to that specific peer, otherwise broadcast to session
    if (to) {
      io.to(to).emit('signal:candidate', { sosId, candidate });
    } else {
      socket.to(`sos:${sosId}`).emit('signal:candidate', { sosId, candidate });
    }
  });

  // ─── Disconnect cleanup ───
  socket.on('disconnect', () => {
    console.log(`[Disconnect] Client: ${socket.id}`);

    // Clean up any sessions owned by this socket
    for (const [sosId, session] of activeSessions.entries()) {
      if (session.streamerSocket === socket.id) {
        console.log(`[Auto-cleanup] Session ${sosId} (streamer disconnected)`);
        activeSessions.delete(sosId);
        io.emit('sos:session_ended', { sosId });
      }
    }
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'RakshaAi Streaming Server Active',
    activeSessions: activeSessions.size,
    sessions: Array.from(activeSessions.keys()),
  });
});

// Cleanup stale sessions every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sosId, session] of activeSessions.entries()) {
    if (now - session.lastFrameTime > 300000) {
      // 5 min no frames
      console.log(`[Stale Cleanup] Session ${sosId}`);
      activeSessions.delete(sosId);
      io.emit('sos:session_ended', { sosId });
    }
  }
}, 120000);

// PORT is now declared at the top of the file (reads from process.env.PORT)

// Helper to get local IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = 'localhost';

  // Preferred interface names in order of priority
  const priorities = ['wi-fi', 'eth', 'wlan', 'en0', 'en1'];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();

    // Skip virtual adapters that often mess up local discovery
    if (lowerName.includes('vmware') || lowerName.includes('virtualbox') || lowerName.includes('vbox') || lowerName.includes('host-only')) {
      continue;
    }

    for (const iface of interfaces[name]) {
      // Filter for IPv4 and non-internal
      if (iface.family === 'IPv4' && !iface.internal) {
        // If it's a priority interface, return immediately
        if (priorities.some(p => lowerName.includes(p))) {
          return iface.address;
        }
        // Otherwise keep it as a fallback
        fallbackIp = iface.address;
      }
    }
  }
  return fallbackIp;
}

// Function to update Firestore with current server URL
async function syncIpToFirestore(ip) {
  try {
    // On Render, use the full public HTTPS URL; locally use http://ip:port
    const serverUrl = RENDER_URL ? RENDER_URL : `http://${ip}:${PORT}`;
    console.log(`[Firestore] Syncing server URL (${serverUrl}) to common config...`);
    await setDoc(doc(db, 'admin', 'streaming_config'), {
      serverIp: serverUrl,
      serverUrl: serverUrl,
      updatedAt: new Date().toISOString(),
      status: 'online',
      port: PORT,
      isCloud: !!RENDER_URL,
    }, { merge: true });
    console.log(`[Firestore] Sync Successful! All apps will now connect to: ${serverUrl}`);
  } catch (error) {
    console.error(`[Firestore] Sync Failed:`, error.message);
    console.log(`[Firestore] Please ensure Firestore rules allow public write to 'admin/streaming_config'`);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  const displayUrl = RENDER_URL ? RENDER_URL : `http://${localIp}:${PORT}`;

  console.log(`\n=========================================`);
  console.log(`🚀 RAKSHAAI STREAMING SERVER (CLOUD-READY)`);
  console.log(`=========================================`);
  console.log(`PORT:        ${PORT}`);
  console.log(`ENVIRONMENT: ${RENDER_URL ? '☁️  Render Cloud' : '💻 Local Dev'}`);
  console.log(`PUBLIC URL:  ${displayUrl}`);
  console.log(`=========================================`);
  console.log(`Waiting for SOS connections...\n`);

  // Auto-sync to Firestore so all mobile clients discover this server
  syncIpToFirestore(localIp);
});
