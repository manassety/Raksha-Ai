import { io } from 'socket.io-client';
import { STREAMING_CONFIG } from '../config/streaming';
import DiscoveryService from './DiscoveryService';

let socket = null;
let isConnected = false;

// Initialize discovery
DiscoveryService.init();

// Watch for URL changes and reconnect if needed
DiscoveryService.onUrlChange((newUrl) => {
  if (socket) {
    console.log('[Stream] Discovery updated IP. Reconnecting to:', newUrl);
    socket.disconnect();
    socket = null;
    isConnected = false;
    // Attempt automatic reconnection to new IP
    connectToStreamingServer();
  }
});

/**
 * Initialize the Socket.IO connection to the streaming server.
 * @returns {object} The socket instance
 */
export const connectToStreamingServer = () => {
  // If already connected, reuse
  if (socket && isConnected) {
    console.log('[Stream] Already connected');
    return socket;
  }

  // If socket exists but not yet connected, don't create another
  if (socket && !isConnected) {
    console.log('[Stream] Connection in progress, reusing existing socket');
    return socket;
  }

  const serverUrl = DiscoveryService.getUrl();
  console.log('[Stream] Connecting to:', serverUrl);

  socket = io(serverUrl, {
    transports: ['websocket'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 45000, // Very long timeout for busy threads
    pingInterval: 10000,
    pingTimeout: 10000, // Extra time for client to respond
  });

  socket.on('connect', () => {
    isConnected = true;
    console.log('[Stream] Connected to streaming server:', socket.id);

    // Emit the active session start
    if (activeSessionParams) {
      socket.emit('sos:start', activeSessionParams);
      console.log('[Stream] SOS session started/reconnected:', activeSessionParams.sosId);
    }
  });

  socket.on('disconnect', (reason) => {
    isConnected = false;
    console.log('[Stream] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.log('[Stream] Connection error:', err.message);
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log(`[Stream] Reconnecting... attempt ${attempt}`);
  });

  // Handle voice commands from admin
  socket.on('sos:voice_command', (data) => {
    console.log('[Stream] Received admin voice command:', data.message);
    if (StreamingService._onVoiceCommand) {
      StreamingService._onVoiceCommand(data.message);
    }
  });

  return socket;
};

// The current active session
let activeSessionParams = null;

/**
 * Start an SOS streaming session.
 * @param {object} params - { sosId, userId, userName, location }
 */
export const startStreamingSession = (params) => {
  activeSessionParams = params;

  if (socket && isConnected) {
    socket.emit('sos:start', params);
    console.log('[Stream] SOS session started:', params.sosId);
    return;
  }

  // Queue the session — it will be emitted once connected
  console.log('[Stream] Queuing session start until connected:', params.sosId);

  // Ensure connection is initiated
  if (!socket) {
    connectToStreamingServer();
  }
};

/**
 * Send a video frame to the streaming server.
 * @param {string} sosId - The SOS session ID
 * @param {string} base64Frame - The base64 encoded JPEG frame
 * @param {boolean} humanDetected - Whether a human was detected
 */
export const sendFrame = (sosId, base64Frame, humanDetected = false) => {
  if (!socket || !isConnected) return;

  socket.emit('sos:frame', {
    sosId,
    frame: base64Frame,
    timestamp: Date.now(),
    humanDetected,
  });
};

/**
 * Stop the SOS streaming session.
 * @param {string} sosId - The session to stop
 */
export const stopStreamingSession = (sosId) => {
  activeSessionParams = null;
  if (!socket) return;

  socket.emit('sos:stop', { sosId });
  console.log('[Stream] SOS session stopped:', sosId);
};

/**
 * Disconnect from the streaming server entirely.
 */
export const disconnectStreaming = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected = false;
    console.log('[Stream] Fully disconnected');
  }
};

/**
 * Check if the streaming server is connected.
 */
export const isStreamingConnected = () => isConnected;

/**
 * Get the socket instance for admin use (receiving frames).
 */
export const getSocket = () => socket;

// Service object for callback registration
const StreamingService = {
  _onVoiceCommand: null,

  /**
   * Register a callback for admin voice commands.
   * @param {Function} callback - Called with (message: string)
   */
  onVoiceCommand: (callback) => {
    StreamingService._onVoiceCommand = callback;
  },
};

export default StreamingService;
