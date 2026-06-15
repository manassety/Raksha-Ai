// Streaming server configuration
// Change SERVER_URL to your computer's local IP when testing on physical device
// Find your IP: run `ipconfig` in cmd and look for IPv4 Address under Wi-Fi

export const STREAMING_CONFIG = {
  // For testing on same network: use your computer's local IP
  // Example: 'http://192.168.1.100:3001'
  // For production: use a deployed server URL
  SERVER_URL: "https://silly-news-eat.loca.lt" || 'http://192.168.1.107:3001',

  // Frame capture settings
  STREAM_FPS: 2, // Frames per second for live stream (2 = smooth enough, low bandwidth)
  STREAM_QUALITY: 0.08, // JPEG quality for stream frames (lower = less bandwidth)
  EVIDENCE_QUALITY: 0.5, // JPEG quality for evidence photos (higher = better evidence)
  EVIDENCE_INTERVAL_MS: 10000, // Capture evidence photo every 10 seconds

  // Connection settings
  RECONNECT_ATTEMPTS: 10,
  RECONNECT_DELAY_MS: 2000,
};

export default STREAMING_CONFIG;
