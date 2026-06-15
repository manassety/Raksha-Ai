# RakshaAi Live Streaming & AI Detection (WebRTC + Fast TFLite)

This module implements real-time live streaming inside the RakshaAi app using WebRTC and on-device AI Object / Human Detection using TensorFlow Lite.

## 📁 Architecture Overview

1. **WebRTC for Live Streaming**: Replaces the Python server video-processing setup with direct P2P connections or relayed streams, drastically reducing latency.
2. **Socket.io Signaling Server (`server/`)**: Facilitates WebRTC offer/answer/ICE candidate exchanges without processing video.
3. **React Native VisionCamera + Fast TFLite**: Extracts camera frames at max performance. The TFLite Frame Processor runs detection logic on-device.
4. **Firebase Metadata**: Logs SOS creation, live streaming status, and AI detection results securely in `/sosSessions/{sosId}` for remote Admin viewing.

## 🚀 Added Components

* `src/screens/LiveStreamScreen.js` - Start SOS stream, access camera, and run TFLite detection.
* `src/screens/AdminLiveViewerScreen.js` - Admin side WebRTC video receiver and Firebase metadata watcher.
* `src/services/DetectionService.js` - On-device AI object detection via `react-native-fast-tflite`.
* `src/services/WebRTCStreamingService.js` - Existing/Updated handler for RTCPeerConnection and stream broadcasting.
* `server/` - Node.js Signaling server for Socket.io.

## 🛠 Setup & Local Testing

### 1. Install Dependencies
```bash
npm install react-native-vision-camera react-native-fast-tflite react-native-webrtc socket.io-client firebase
```

### 2. Download TFLite Model
You need a proper `.tflite` model (like SSD MobileNet for Object Detection).
1. Download a pre-trained `mobilenet_v1.tflite` or similar.
2. Place it in your project's `assets/` folder: `assets/model.tflite`.

### 3. Start Signaling Server
```bash
cd server
npm install
node index.js
```
The server will start on port `3001` and update its IP into Firebase (`admin/streaming_config`).

### 4. Run Mobile App
Run your Expo Dev Client (as VisionCamera + WebRTC require native modules).
```bash
npx expo run:android
# OR
npx expo run:ios
```

### 5. Testing Flow
1. **User Side:** Navigate to `LiveStreamScreen` with a `sosId`. Press **Start Stream**.
2. Context: The app starts WebRTC stream to the Socket.io room and runs On-device ML.
3. **Admin Side:** Navigate to `AdminLiveViewerScreen` with the identical `sosId`.
4. Context: The Admin connects via P2P (WebRTC), visualizes the real-time video block, and observes `Human Detected: YES/NO` via Firebase real-time listeners.

## ☁️ Deployment (Signaling Server)

To work globally (outside your personal Wi-Fi):
1. **Host Node.js App:** Deploy the `server/` folder to Render, Heroku, or AWS EC2.
2. **Environment Variable:** Ensure the deployed instance listens openly (`0.0.0.0`).
3. **App Setting Config:** Fetch the global HTTPS URL of the Socket.io server within your `StreamingService.js` endpoint connection logic, or let the server auto-sync to Firebase `admin/streaming_config` to be synced automatically.

## 🔒 Firebase Rules Requirement
Please make sure the `/sosSessions` path is read/write accessible to the respective authenticated clients.
```javascript
match /sosSessions/{docId} {
  allow read, write: if true; // TODO: Restrict in production
}
```

## 🐍 Python AI Server (Render Deployment)
If deploying the Python backend to Render, use the following specifications to avoid memory issues (under 8GB):
1. **Python Version**: Configured explicitly to `3.11.9` using `.python-version`.
2. **Start Command**: 
   ```bash
   gunicorn --worker-class eventlet -w 1 app:app --timeout 120
   ```
*(Note: OpenCV and lightweight algorithms are used instead of heavy deep-learning dependencies to keep memory limits minimal for free-tier deployments)*.
