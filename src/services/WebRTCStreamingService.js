import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';
import StreamingService, { getSocket } from './StreamingService';

// PeerConnection configuration (using free Google STUN servers)
const PC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

const peerConnections = new Map(); // toId -> RTCPeerConnection
let localStream = null;
let currentSosId = null;

/**
 * Initialize WebRTC streaming for an SOS session.
 * @param {string} sosId - The ID of the SOS alert
 * @param {MediaStream} stream - The local camera/mic stream
 */
export const initWebRTCStreaming = (sosId, stream) => {
  currentSosId = sosId;
  localStream = stream;
  const socket = getSocket();

  if (!socket) {
    console.error('[WebRTC] Socket not connected');
    return;
  }

  console.log('[WebRTC] Initializing stream for session:', sosId);

  // Listen for admin offers (if admin initiates) - though usually mobile initiates
  socket.on('signal:offer', async (data) => {
    const { from, offer } = data;
    console.log('[WebRTC] Received offer from admin:', from);
    await handleOffer(from, offer);
  });

  // Listen for answers to our offers
  socket.on('signal:answer', async (data) => {
    const { from, answer } = data;
    console.log('[WebRTC] Received answer from admin:', from);
    const pc = peerConnections.get(from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  // Listen for ICE candidates
  socket.on('signal:candidate', async (data) => {
    const { from, candidate } = data;
    const pc = peerConnections.get(from);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  // Listen for admins choosing to 'watch' (this triggers the mobile to send an offer)
  socket.on('admin:watch', async (data) => {
    const adminSocketId = data.adminId; // We need server to send the admin's socket id
    console.log('[WebRTC] Admin joined session, creating offer for:', adminSocketId);
    await createOffer(adminSocketId);
  });
};

/**
 * Handle an incoming offer (Admin -> Mobile)
 */
const handleOffer = async (adminId, offer) => {
  const pc = createPeerConnection(adminId);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  getSocket().emit('signal:answer', {
    sosId: currentSosId,
    answer,
    to: adminId,
  });
};

/**
 * Create an offer (Mobile -> Admin)
 */
const createOffer = async (adminId) => {
  const pc = createPeerConnection(adminId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  getSocket().emit('signal:offer', {
    sosId: currentSosId,
    offer,
    to: adminId, 
  });

  // Set encoding parameters for better quality/bitrate control
  const senders = pc.getSenders();
  senders.forEach(sender => {
    if (sender.track && sender.track.kind === 'video') {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      params.encodings[0].maxBitrate = 1500000; // 1.5 Mbps
      sender.setParameters(params).catch(e => console.log("[WebRTC] Bitrate set fail:", e));
    }
  });
};

/**
 * Create and configure a PeerConnection for a specific peer
 */
const createPeerConnection = (peerId) => {
  if (peerConnections.has(peerId)) {
    console.log('[WebRTC] Closing existing connection for:', peerId);
    peerConnections.get(peerId).close();
  }

  const pc = new RTCPeerConnection(PC_CONFIG);

  // Add local tracks to the connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      getSocket().emit('signal:candidate', {
        sosId: currentSosId,
        candidate: event.candidate,
        to: peerId,
      });
    }
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log(`[WebRTC] Connection state (${peerId}):`, state);
    
    if (state === 'failed') {
        console.log("[WebRTC] ICE Failed, retrying...");
        pc.restartIce();
    } else if (state === 'disconnected' || state === 'closed') {
      peerConnections.delete(peerId);
    }
  };

  peerConnections.set(peerId, pc);
  return pc;
};

/**
 * Stop all WebRTC connections and cleanup
 */
export const stopWebRTCStreaming = () => {
  console.log('[WebRTC] Stopping all connections');
  peerConnections.forEach((pc) => pc.close());
  peerConnections.clear();
  localStream = null;
  currentSosId = null;

  const socket = getSocket();
  if (socket) {
    socket.off('signal:offer');
    socket.off('signal:answer');
    socket.off('signal:candidate');
    socket.off('admin:watch');
  }
};

const WebRTCStreamingService = {
  init: initWebRTCStreaming,
  stop: stopWebRTCStreaming,
};

export default WebRTCStreamingService;
