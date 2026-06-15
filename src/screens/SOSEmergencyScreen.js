import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Animated, Platform, ScrollView, SafeAreaView, TextInput, Modal, BackHandler,
} from "react-native";
import { scale, normalize } from '../utils/responsive';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import * as SMS from "expo-sms";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import * as ScreenCapture from "expo-screen-capture";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system";
import { CameraView, Camera, useCameraPermissions } from "expo-camera";
// import * as FaceDetector from 'expo-face-detector'; // Deprecated in Expo 51+ and problematic in Expo Go
import { getAuth } from "firebase/auth";
import {
  collection, addDoc, Timestamp, getDocs, query, where,
  getDoc, doc, updateDoc, onSnapshot, setDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import GradientBackground from "../components/GradientBackground";
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from "../config/theme";
import * as LocalAuthentication from 'expo-local-authentication';
import { saveEvidence as uploadEvidence } from '../utils/EvidenceManager';
// Removed TensorFlow imports
// import { initDetector, hasHumanInImage } from '../services/HumanDetector';
import StreamingService, {
  sendFrame, connectToStreamingServer, startStreamingSession,
  stopStreamingSession, disconnectStreaming, isStreamingConnected,
} from '../services/StreamingService';
import WebRTCStreamingService from '../services/WebRTCStreamingService';
import { mediaDevices } from 'react-native-webrtc';
import { STREAMING_CONFIG } from '../config/streaming';
import DiscoveryService from '../services/DiscoveryService';
import Constants from 'expo-constants';
import { analyzeFrameWithPython, sendCloudSMS } from '../services/PythonAIApi';





// --- Helper: Haversine Distance ---
const deg2rad = (deg) => deg * (Math.PI / 180);
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};


// Global audio refs to prevent "Only one Recording object" error on fast remounts/hot reloads
let globalAudioRecorder = null;
let globalBackgroundAudio = null;

// ============================================================================
//  SOSEmergencyScreen
// ============================================================================
const SOSEmergencyScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ── State ──
  const [sosActive, setSosActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturingPhotos, setIsCapturingPhotos] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [currentSosId, setCurrentSosId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [voiceSOSEnabled, setVoiceSOSEnabled] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [location, setLocation] = useState(null);
  const [hwErrorCount, setHwErrorCount] = useState(0);
  const [lastSyncStatus, setLastSyncStatus] = useState('initializing');
  const [streamFrameCount, setStreamFrameCount] = useState(0);
  const [isDebug, setIsDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [loadingPin, setLoadingPin] = useState(false);



  // ── Animations ──
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Refs ──
  const liveStreamIntervalRef = useRef(null);
  const isMonitoringRef = useRef(false);
  const hardwareLockRef = useRef(false);
  const cameraRef = useRef(null);
  const isCameraReadyRef = useRef(false);
  const localStreamRef = useRef(null);
  const lastFaceTimeRef = useRef(0);
  const isDetectingFaceRef = useRef(false);
  const lastVoiceCmdIdRef = useRef(null);
  const smsTimeoutRef = useRef(null);
  const sosActiveRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isAudioBusyRef = useRef(false);
  const isAiBusyRef = useRef(false);
  const isCapturingRef = useRef(false);

  // ── Debug logger ──
  const addDebugLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 10));
    console.log(`[SOS] ${msg}`);
  }, []);


  // Shared state for detection
  const faceDetectedRef = useRef(false);
  const lastCaptureTimeRef = useRef(0);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // ===========================================================================
  //  LIFECYCLE
  // ===========================================================================
  useEffect(() => {
    // Parallel init — don't block mount
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') console.log("Camera permission denied");
    })();
    DiscoveryService.init();
    checkVoiceSOSPreference();
    loadLocation();

    // Start SOS immediately if triggered by global voice listener or widget
    if (route?.params?.autoStart) {
      triggerSOS("voice_command");
    }

    return () => {
      // Non-blocking cleanup — don't await, just fire
      try { stopMonitoring("unmount"); } catch (e) { }
      try { stopVoiceRecognition(); } catch (e) { }
      if (smsTimeoutRef.current) clearTimeout(smsTimeoutRef.current);
    };
  }, [route?.params?.autoStart]);

  useFocusEffect(
    useCallback(() => {
      checkVoiceSOSPreference();

      // Handle Android Hardware Back Button
      const onBackPress = () => {
        if (sosActiveRef.current) {
          handleStopRequest();
          return true;
        }
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );


  // ── Keep sosActiveRef in sync ──
  useEffect(() => {
    sosActiveRef.current = sosActive;
  }, [sosActive]);

  // ── Pulse animation ──
  useEffect(() => {
    if (!sosActive) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [sosActive]);


  // ── Camera readiness → Start monitoring ──
  useEffect(() => {
    isCameraReadyRef.current = isCameraReady;
    if (sosActive && isCameraReady && currentSosId && !isMonitoringRef.current) {
      console.log("Hardware ready → starting monitoring");
      startSOSMonitoring(currentSosId);
    }
  }, [sosActive, isCameraReady, currentSosId]);


  // ── Recording timer ──
  useEffect(() => {
    if (!sosActive) return;
    const interval = setInterval(() => setRecordingTime(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [sosActive]);


  // ── Admin remote listener ──
  useEffect(() => {
    if (!currentSosId) return;
    const unsub = onSnapshot(doc(db, "sos_alerts", currentSosId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // Remote stop — use REF to avoid stale closure
      // Also guard against our own stopSOS triggering this
      if (data.status === "resolved" && sosActiveRef.current && !isStoppingRef.current) {
        console.log("[Admin] Remote stop detected");
        stopSOS();
        Speech.speak("Emergency cancelled by Administrator.");
      }

      // Admin voice command
      if (data.adminVoiceCommand && data.adminVoiceCommandId !== lastVoiceCmdIdRef.current) {
        lastVoiceCmdIdRef.current = data.adminVoiceCommandId;
        Speech.speak(data.adminVoiceCommand, { rate: 0.9 });
      }
    });
    return () => unsub();
  }, [currentSosId]); // removed sosActive dep — we use ref instead


  // ── Voice SOS toggle ──
  useEffect(() => {
    if (voiceSOSEnabled) startVoiceRecognition();
    else stopVoiceRecognition();
  }, [voiceSOSEnabled]);


  // ── Permissions consolidation ──
  useEffect(() => {
    (async () => {
      const { status: camStatus } = await Camera.getCameraPermissionsAsync();
      if (camStatus !== 'granted') await Camera.requestCameraPermissionsAsync();
      const aud = await Audio.getPermissionsAsync();
      if (aud.status !== 'granted') await Audio.requestPermissionsAsync();
      const loc = await Location.getForegroundPermissionsAsync();
      if (loc.status !== 'granted') await Location.requestForegroundPermissionsAsync();
    })();
  }, []);


  // ===========================================================================
  //  DATA HELPERS
  // ===========================================================================
  const loadLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      // Use last known position first (instant), then try fresh GPS with timeout
      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastKnown?.coords) setLocation(lastKnown.coords);

      // Fresh GPS with 5s timeout — never hang indefinitely
      const gps = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000));
      const pos = await Promise.race([gps, timeout]);
      if (pos?.coords) setLocation(pos.coords);
    } catch (e) { /* silently fail — we have lastKnown as fallback */ }
  };

  const checkVoiceSOSPreference = async () => {
    try {
      const user = getAuth().currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setVoiceSOSEnabled(snap.data().voiceSOS || false);
    } catch (e) {
      setVoiceSOSEnabled(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };


  // ===========================================================================
  //  VOICE TRIGGER (expo-av metering)
  // ===========================================================================
  const startVoiceRecognition = async () => {
    if (isAudioBusyRef.current || isRecording || globalAudioRecorder || globalBackgroundAudio) return;

    try {
      isAudioBusyRef.current = true;
      let { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') {
        const req = await Audio.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        isAudioBusyRef.current = false;
        return;
      }

      // 1. Thoroughly clean any existing recorder (Both refs)
      if (globalBackgroundAudio) {
        try {
          await globalBackgroundAudio.stopAndUnloadAsync();
        } catch (e) { }
        globalBackgroundAudio = null;
      }
      if (globalAudioRecorder) {
        try {
          await globalAudioRecorder.stopAndUnloadAsync();
        } catch (e) { }
        globalAudioRecorder = null;
      }

      // 2. Reset Audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      await new Promise(r => setTimeout(r, 800)); // Increased delay for hardware release

      // 3. Create new recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recording.setProgressUpdateInterval(250);
      recording.setOnRecordingStatusUpdate((st) => {
        if (st.isRecording && st.metering && st.metering > -10) {
          if (!sosActiveRef.current) {
            console.log("[Voice] 'Help'/Sound trigger detected! Activating SOS...");
            triggerSOS("voice_command");
          }
          // Removed the else-if block that called handleStopRequest() on loud noise
        }
      });

      globalBackgroundAudio = recording;
      setVoiceListening(true);
      console.log("Sound Trigger listener started.");
    } catch (err) {
      console.log("Sound Trigger start error:", err);
    } finally {
      isAudioBusyRef.current = false;
    }
  };

  const stopVoiceRecognition = async () => {
    if (isAudioBusyRef.current) {
      await new Promise(r => setTimeout(r, 200));
    }
    try {
      isAudioBusyRef.current = true;
      if (globalBackgroundAudio) {
        try {
          await globalBackgroundAudio.stopAndUnloadAsync();
        } catch (e) { }
        globalBackgroundAudio = null;
      }
      setVoiceListening(false);
      console.log("Sound Trigger listener stopped.");
    } catch (err) {
      globalBackgroundAudio = null;
      setVoiceListening(false);
    } finally {
      isAudioBusyRef.current = false;
    }
  };

  const toggleVoiceSharing = () => {
    voiceListening ? stopVoiceRecognition() : startVoiceRecognition();
  };


  // ===========================================================================
  //  AUDIO RECORDING (Evidence)
  // ===========================================================================
  const startAudioRecording = async () => {
    let retries = 5;
    while (isAudioBusyRef.current && retries > 0) {
      await new Promise(r => setTimeout(r, 400));
      retries--;
    }

    try {
      isAudioBusyRef.current = true;
      console.log("Starting Main Audio Evidence...");

      // Stop voice trigger first
      if (globalBackgroundAudio) {
        try {
          await globalBackgroundAudio.stopAndUnloadAsync();
        } catch (e) { }
        globalBackgroundAudio = null;
      }

      if (globalAudioRecorder) {
        try {
          await globalAudioRecorder.stopAndUnloadAsync();
        } catch (e) { }
        globalAudioRecorder = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      await new Promise(r => setTimeout(r, 1000)); // Solid buffer for hardware

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // 🎤 SMARTER "DUAL" RECORDING:
      // We use ONE recorder for everything. Check metering for stop request disabled
      // as it falsely triggered the PIN modal on any loud noise.
      recording.setProgressUpdateInterval(250);

      globalAudioRecorder = recording;
      setIsRecording(true);
      if (voiceSOSEnabled) setVoiceListening(true);
    } catch (err) {
      console.log("Audio Start Err:", err);
    } finally {
      isAudioBusyRef.current = false;
    }
  };

  const stopAudioRecording = async () => {
    if (isAudioBusyRef.current) {
      await new Promise(r => setTimeout(r, 300));
    }
    try {
      isAudioBusyRef.current = true;
      if (!globalAudioRecorder) return;
      console.log("Stopping Main Audio Evidence...");

      try {
        await globalAudioRecorder.stopAndUnloadAsync();
      } catch (e) { }

      const uri = globalAudioRecorder.getURI();
      if (uri) {
        const user = getAuth().currentUser;
        const userName = user?.displayName || user?.email?.split('@')[0] || "User";
        await uploadEvidence(userName, {
          uri, name: `SOS_Audio_${Date.now()}.m4a`, size: 0,
        }, "audio", location, "sos", "sos");
      }

      globalAudioRecorder = null;
      setIsRecording(false);
      setRecordingTime(0);

      await new Promise(r => setTimeout(r, 600));
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true,
        });
      } catch (e) { }

      await new Promise(r => setTimeout(r, 400));
      // Release busy before calling another audio function
      isAudioBusyRef.current = false;

      if (voiceSOSEnabled && !sosActiveRef.current) {
        startVoiceRecognition();
      }
    } catch (err) {
      console.log("Audio Stop Err:", err);
      globalAudioRecorder = null;
      setIsRecording(false);
      isAudioBusyRef.current = false;
    }
  };


  // ===========================================================================
  //  CAMERA MONITORING (Stream + AI)
  // ===========================================================================
  const stopMonitoring = async (caller = "unknown") => {
    console.log(`stopMonitoring called by: ${caller}`);
    isMonitoringRef.current = false;
    hardwareLockRef.current = false;

    if (liveStreamIntervalRef.current) {
      clearInterval(liveStreamIntervalRef.current);
      liveStreamIntervalRef.current = null;
    }
    setIsLiveStreaming(false);
    setIsCapturingPhotos(false);

    try { WebRTCStreamingService.stop(); } catch (e) { console.log("WebRTC stop err:", e.message); }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setIsCameraReady(false);
    console.log("Monitoring stopped.");
  };

  const startSOSMonitoring = async (sosDocId) => {
    if (isMonitoringRef.current) return;
    isMonitoringRef.current = true;
    console.log("[SOS] Starting ML Kit monitoring (2s sync, real-time AI)...");

    try {
      // Vision Camera uses its own isActive prop, we just need to ensure monitoring state is set
      setIsLiveStreaming(true);
      setIsCapturingPhotos(true);
      setLastSyncStatus('active');

      let frameCount = 0;
      let localEvidence = 0;
      const MAX_EVIDENCE = 15;
      const EVIDENCE_EVERY_N_FRAMES = 3; // Save evidence every 3rd photo (every ~9s)

      const runMonitoringCycle = async () => {
        if (!isMonitoringRef.current || !sosActiveRef.current) return;

        // Prevent overlapping captures
        if (isCapturingRef.current || !cameraRef.current) {
          liveStreamIntervalRef.current = setTimeout(runMonitoringCycle, 500);
          return;
        }

        try {
          // ── 1. Streaming Sync (Every 2s) ──
          isCapturingRef.current = true;

          // Use takePictureAsync for evidence or lightweight snapshots
          // For streaming, we take a low quality photo to send as base64
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.3,
            base64: true,
            skipProcessing: true,
          });

          isCapturingRef.current = false;

          if (!sosActiveRef.current) return;
          frameCount++;

          // Convert to base64 for the streaming server
          const base64 = photo.base64;
          let hasFace = faceDetectedRef.current;
          let streamBase64 = base64;
          let evType = "SOS Auto Capture";

          // Process with Python AI for YOLO Object/Human Detection
          try {
            const user = getAuth().currentUser;
            const uid = user ? user.uid : 'unknown';
            const aiResponse = await analyzeFrameWithPython(uid, base64, null);

            if (aiResponse && aiResponse.success) {
              if (aiResponse.annotated_frame) {
                streamBase64 = aiResponse.annotated_frame;
              }
              if (aiResponse.unknown_detected) {
                hasFace = true; // Use hasFace flag to trigger evidence save
                evType = "AI Human Detected - Priority";
                addDebugLog("👤 AI Detected Human - Priority Evidence");
              }
            }
          } catch (aiErr) {
            console.log("Python AI Error:", aiErr);
          }

          // Stream to Admin (Now sends annotated frame if AI succeeded)
          sendFrame(sosDocId, streamBase64, hasFace);
          setStreamFrameCount(p => p + 1);

          // ── 2. Evidence Logic ──
          let shouldSave = false;

          // Priority: Human detected by AI
          if (hasFace && (Date.now() - lastCaptureTimeRef.current > 5000)) {
            shouldSave = true;
            lastCaptureTimeRef.current = Date.now();
            faceDetectedRef.current = false; // Reset for next detection

            // Auto start recording if not already (user requirement)
            if (!isRecording) startAudioRecording();
          }
          // Regular interval evidence
          else if (frameCount % EVIDENCE_EVERY_N_FRAMES === 0 && localEvidence < MAX_EVIDENCE) {
            shouldSave = true;
          }

          if (shouldSave && localEvidence < MAX_EVIDENCE) {
            localEvidence++;
            setEvidenceCount(localEvidence);

            const user = getAuth().currentUser;
            uploadEvidence(user?.displayName || "User", {
              uri: photo.uri,
              name: `SOS_Expo_${Date.now()}.jpg`,
              size: 0,
            }, "image", location, evType, "sos").catch(() => { });

            if (sosDocId) {
              updateDoc(doc(db, "sos_alerts", sosDocId), {
                lastEvidenceTime: Timestamp.now(),
                evidenceUploaded: localEvidence,
                humanDetected: hasFace,
              }).catch(() => { });
            }
          }

        } catch (e) {
          console.log("Monitoring Loop Error:", e.message);
          isCapturingRef.current = false;
        }

        liveStreamIntervalRef.current = setTimeout(runMonitoringCycle, 2000);
      };

      runMonitoringCycle();

    } catch (err) {
      console.log("Monitoring Startup Error:", err);
      isMonitoringRef.current = false;
      setLastSyncStatus('error');
    }
  };


  // ===========================================================================
  //  MANUAL EVIDENCE
  // ===========================================================================
  const takeManualPhoto = async () => {
    if (!cameraRef.current || !isCameraReady || hardwareLockRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        const user = getAuth().currentUser;
        const userName = user?.displayName || user?.email?.split("@")[0] || "User";
        const info = await FileSystem.getInfoAsync(photo.uri).catch(() => ({ size: 0 }));
        await uploadEvidence(userName, {
          uri: photo.uri, name: `Manual_${Date.now()}.jpg`, size: info.size || 0,
        }, "image", location || null, 'SOS Emergency', 'sos');
        setEvidenceCount(p => p + 1);
        Speech.speak("Photo captured.");
      }
    } catch (e) {
      console.log("Manual photo error:", e.message);
    }
  };

  const takeVoiceNote = async () => {
    if (isRecording) { Speech.speak("Already recording."); return; }
    try {
      await startAudioRecording();
      Speech.speak("Voice recording active.");
    } catch (e) {
      console.log("Voice note error:", e.message);
    }
  };


  // ===========================================================================
  //  TRIGGER SOS  (Non-blocking, fast)
  // ===========================================================================
  const triggerSOS = async () => {
    if (sosActive) return;

    // ⚡ INSTANT: UI + speech + audio (0ms)
    isStoppingRef.current = false; // Reset for this new SOS
    setSosActive(true);
    setSending(false);
    setRecordingTime(0);
    setEvidenceCount(0);
    setStreamFrameCount(0);
    Speech.speak("Emergency activated!", { rate: 1.3 });
    addDebugLog("SOS TRIGGERED");

    // Fire-and-forget hardware
    ScreenCapture.preventScreenCaptureAsync().catch(() => { });
    startAudioRecording().catch(e => console.log("Audio err:", e.message));

    const user = getAuth().currentUser;
    const userId = user?.uid;
    const userName = user?.displayName || user?.email?.split('@')[0] || 'User';

    try {
      // Connect streaming right away
      connectToStreamingServer();

      // ── BACKGROUND TASKS (fire-and-forget IIFE) ──
      (async () => {
        try {
          // ⚡ Create Firestore doc safely without blocking offline operations!
          const sosRef = doc(collection(db, "sos_alerts"));
          const newSosId = sosRef.id;
          setCurrentSosId(newSosId);
          addDebugLog(`SOS Doc: ${newSosId}`);

          // Fire-and-forget: do NOT await this, or else offline mode hangs FOREVER!
          setDoc(sosRef, {
            userId: userId || "anonymous",
            type: "SOS_EMERGENCY",
            location: location,
            timestamp: Timestamp.now(),
            message: "EMERGENCY SOS!",
            status: "ongoing",
            userName,
          }).catch(e => console.log("Offline Document Save queued/failed:", e.message));

          // ✨ NEW: Create a public alert so other users get the popup notification
          const publicAlertRef = doc(collection(db, "alerts"));
          setDoc(publicAlertRef, {
            type: "sos",
            priority: "high",
            title: "🚨 EMERGENCY SOS ACTIVATED",
            message: `Emergency triggered by ${userName}!`,
            status: "ongoing",
            createdAt: Timestamp.now(),
            triggeredBy: userId || "anonymous",
            read: false,
            broadcastToAll: true,
            location: location,
          }).catch(() => { });

          startStreamingSession({
            sosId: newSosId,
            userId: userId || 'anonymous',
            userName,
            location: location,
          });

          // 1. More aggressive GPS fetch
          let loc = location;
          try {
            // Quick fallback to last known to ensure we have something
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown?.coords) loc = lastKnown.coords;

            // Try fresh GPS with low accuracy for speed (prevents hanging indoors)
            const gps = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
            const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("GPS timeout")), 3500));
            const pos = await Promise.race([gps, timeout]);
            loc = pos?.coords || loc;
            if (loc) setLocation(loc);
            console.log("[BG] GPS OK:", loc?.latitude, loc?.longitude);
          } catch (e) {
            console.log("[BG] GPS Error/Timeout:", e.message);
          }

          // 2. Geocode
          let locationName = "Unknown Location";
          if (loc) {
            try {
              const geo = await Location.reverseGeocodeAsync(loc);
              if (geo?.[0]) {
                const p = geo[0];
                const parts = [p.street, p.city, p.region].filter(Boolean);
                if (parts.length > 0) locationName = parts.join(', ');
              }
            } catch (e) { }
          }

          const locationUrl = loc
            ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
            : "Location unavailable";
          const message = `EMERGENCY! I need help at ${locationName}!\nLocation: ${locationUrl}`;

          // 3. Update Firestore doc with real location
          updateDoc(doc(db, "sos_alerts", newSosId), {
            location: loc, message, locationName,
          }).catch(() => { });

          // 4. Contacts
          let numbers = ["9411596016"];
          try {
            if (userId) {
              const snap = await getDocs(query(collection(db, "contacts"), where("userId", "==", userId)));
              snap.forEach(d => { if (d.data().phone) numbers.push(d.data().phone); });
            }
          } catch (e) { }

          // 5. SEAMLESS CLOUD SMS (No UI interruption)
          smsTimeoutRef.current = setTimeout(async () => {
            try {
              if (numbers.length > 0) {
                console.log("[BG] Dispatching silent cloud SMS via Render...");
                addDebugLog("Dispatching emergency SMS silently...");

                // Uses the live Render Python backend to dispatch texts silently
                const response = await sendCloudSMS(numbers, message);

                if (response && response.success) {
                  addDebugLog("Cloud SMS dispatched successfully.");
                  Speech.speak("Emergency alerts have been dispatched silently via the cloud.", { rate: 1.1 });
                } else {
                  addDebugLog("Cloud SMS failed, monitoring continues.");
                }

                // Ensure hardware monitoring is still running or resumes
                if (sosActiveRef.current && !isMonitoringRef.current) {
                  startSOSMonitoring(newSosId);
                }
              }
            } catch (smsErr) {
              console.log("Cloud SMS Automation Error:", smsErr.message);
            }
          }, 1500); // Quick 1.5s delay to assure SOS Doc generation completes

          // 6. Nearby alerts (Modified to always broadcast for safety/testing)
          if (userId) {
            getDocs(collection(db, "users")).then(snap => {
              const nearby = [];
              if (loc) {
                snap.forEach(ds => {
                  const u = ds.data();
                  if (u.uid !== userId && u.lastLocation?.latitude && u.lastLocation?.longitude) {
                    if (getDistanceFromLatLonInKm(loc.latitude, loc.longitude, u.lastLocation.latitude, u.lastLocation.longitude) <= 2) {
                      nearby.push(u.uid);
                    }
                  }
                });
              }

              // Always trigger the alert so admin and nearby can see it. 
              // If nearby is empty, we still add it so it shows in the global alert feed.
              addDoc(collection(db, "alerts"), {
                type: "sos", priority: "high",
                title: "🚨 Emergency SOS Triggered",
                message: `SOS at ${locationName}!\n${locationUrl}`,
                locationUrl, locationName,
                triggeredBy: userId, targetUsers: nearby.length > 0 ? nearby : ['all'],
                createdAt: Date.now(), status: "ongoing", read: false,
              });

            }).catch(() => { });
          }

          console.log("[BG] All tasks done");
        } catch (bgErr) {
          console.log("[BG] Error:", bgErr.message);
        }
      })();

    } catch (err) {
      addDebugLog(`SOS Create Error: ${err.message}`);
    }
  };


  // ===========================================================================
  //  STOP SOS
  // ===========================================================================
  const handleStopRequest = () => {
    setShowPinModal(true);
    setEnteredPin("");
    Speech.speak("Emergency stop requested. Use Fingerprint or enter PIN to verify.");
  };

  const verifyWithBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert("Biometrics Unavailable", "Please use PIN to stop SOS.");
        return;
      }
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to stop SOS',
        fallbackLabel: 'Use PIN',
      });
      if (auth.success) {
        await stopSOS();
        setShowPinModal(false);
      } else {
        Alert.alert("Verification Failed", "Biometric check failed. Please enter PIN.");
      }
    } catch (err) {
      console.log("Biometric error:", err);
    }
  };

  const verifyAndStopSOS = async () => {
    setLoadingPin(true);
    try {
      const user = getAuth().currentUser;
      let savedPin = "123456";
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          savedPin = data.safetyPin || data.safetyPIN || data.pin || "123456";
        }
      }
      if (enteredPin === savedPin) {
        setShowPinModal(false); // Close instantly
        await stopSOS();
      } else {
        Alert.alert("Verification Failed", "Incorrect safety PIN.");
      }
    } catch (err) {
      Alert.alert("Error", "Could not verify identity.");
    }
    setLoadingPin(false);
  };

  const stopSOS = async () => {
    if (isStoppingRef.current) return; // Prevent double-stop
    isStoppingRef.current = true;
    addDebugLog("stopSOS: Termination requested");

    // Instant UI reset
    setSosActive(false);
    setIsCapturingPhotos(false);
    setRecordingTime(0);
    setEvidenceCount(0);
    setIsCameraReady(false);
    setLoadingPin(false);
    setShowPinModal(false);

    Speech.speak("SOS stopped. All evidence has been secured.");

    // Cancel pending SMS
    if (smsTimeoutRef.current) {
      clearTimeout(smsTimeoutRef.current);
      smsTimeoutRef.current = null;
    }

    // Background cleanup
    (async () => {
      const user = getAuth().currentUser;
      const userId = user?.uid;
      const targetSosId = currentSosId;

      try {
        await stopMonitoring("stopSOS").catch(() => { });
        await stopAudioRecording().catch(() => { });
        disconnectStreaming();
        await ScreenCapture.allowScreenCaptureAsync().catch(() => { });

        await addDoc(collection(db, "sos_alerts"), {
          userId: userId || "anonymous",
          userName: user?.displayName || user?.email?.split('@')[0] || "User",
          type: "SOS_STOPPED",
          timestamp: Timestamp.now(),
          status: "resolved",
          evidenceCount: evidenceCount,
          location: location || null,
        });

        if (targetSosId) {
          await updateDoc(doc(db, "sos_alerts", targetSosId), { status: "resolved" });
          setCurrentSosId(null);
        }

        if (userId) {
          const alertsQuery = query(
            collection(db, "alerts"),
            where("triggeredBy", "==", userId),
            where("status", "==", "ongoing")
          );
          const alertsSnap = await getDocs(alertsQuery);
          const updates = [];
          alertsSnap.forEach(d => {
            updates.push(updateDoc(doc(db, "alerts", d.id), { status: "resolved" }));
          });
          await Promise.all(updates);
        }
      } catch (err) {
        addDebugLog(`Stop error: ${err.message}`);
      }
      isStoppingRef.current = false; // Allow future SOS
    })();
  };


  // ===========================================================================
  //  UI  (identical layout)
  // ===========================================================================
  return (
    <GradientBackground colors={GRADIENTS.danger}>
      <SafeAreaView style={styles.container}>
        {sosActive && (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              onCameraReady={() => setIsCameraReady(true)}
              onFacesDetected={({ faces }) => {
                // if (faces.length > 0) faceDetectedRef.current = true;
              }}
            /* faceDetectorSettings={{
              mode: FaceDetector.FaceDetectorMode.fast,
              detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
              runClassifications: FaceDetector.FaceDetectorClassifications.none,
              minDetectionInterval: 1000,
              tracking: true,
            }} */
            />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MainTabs")}
              onLongPress={() => {
                setIsDebug(!isDebug);
                Speech.speak(isDebug ? "Debug mode disabled" : "Developer debug mode enabled");
              }}
              style={styles.backButton}
            >
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SOS Emergency</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* DEBUG PANEL */}
          {isDebug && (
            <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>DEV DEBUG OVERLAY</Text>
              <Text style={styles.debugText}>Server: {DiscoveryService.getUrl()}</Text>
              <Text style={styles.debugText}>Status: {lastSyncStatus}</Text>
              <Text style={styles.debugText}>Frames: {streamFrameCount}</Text>
              <View style={styles.debugLogContainer}>
                {debugLogs.map((log, i) => (
                  <Text key={i} style={styles.debugLogText}>{log}</Text>
                ))}
              </View>
              <TouchableOpacity style={styles.debugResetBtn} onPress={() => { stopMonitoring("debugReset"); setSosActive(false); }}>
                <Text style={styles.debugResetText}>FORCE RESET HARDWARE</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STATUS CARD */}
          {sosActive && (
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.recordingDot} />
                <Text style={styles.statusText}>RECORDING IN PROGRESS</Text>
              </View>
              <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
              <Text style={styles.evidenceText}>Evidence Collected: {evidenceCount}</Text>
            </View>
          )}

          {/* SOS BUTTON */}
          <View style={styles.sosContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={sending}
              onPress={() => {
                console.log("SOS button pressed, sosActive:", sosActive);
                sosActive ? handleStopRequest() : triggerSOS();
              }}
            >
              <Animated.View
                style={[
                  styles.sosButtonOuter,
                  { transform: [{ scale: sosActive ? 1 : pulseAnim }] },
                ]}
              >
                <View style={styles.sosButton}>
                  {sending ? (
                    <ActivityIndicator size="large" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name={sosActive ? "stop" : "warning"} size={50} color={COLORS.white} />
                      <Text style={styles.sosButtonText}>{sosActive ? "STOP" : "HELP"}</Text>
                    </>
                  )}
                </View>
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.sosHint}>
              {sosActive ? "Tap to Stop (Requires PIN)" : "Tap to Activate Emergency"}
            </Text>
          </View>

          {/* EVIDENCE FEATURES */}
          {sosActive && (
            <View style={styles.evidenceContainer}>
              <Text style={styles.sectionTitle}>Live Features</Text>

              {/* Audio */}
              <View style={styles.featureRow}>
                <Ionicons name={isRecording ? "mic" : "mic-off"} size={24} color={isRecording ? COLORS.danger : COLORS.gray400} />
                <Text style={styles.featureText}>Audio Recording: {isRecording ? "Active" : "Stopped"}</Text>
                <TouchableOpacity onPress={isRecording ? stopAudioRecording : takeVoiceNote}
                  style={[styles.controlButton, isRecording && { backgroundColor: COLORS.danger + '20' }]}>
                  <Ionicons name={isRecording ? "stop-circle" : "radio-button-on"} size={28} color={isRecording ? COLORS.danger : COLORS.white} />
                </TouchableOpacity>
              </View>

              {/* Photos */}
              <View style={styles.featureRow}>
                <Ionicons name="camera" size={24} color={COLORS.white} />
                <Text style={styles.featureText}>Periodic Photo Evidence</Text>
                {cameraPermission?.granted ? (
                  <TouchableOpacity onPress={takeManualPhoto} style={styles.controlButton}>
                    <Ionicons name="camera" size={28} color={COLORS.white} />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.featureText}>No Camera Permission</Text>
                )}
              </View>

              {/* Streaming */}
              <View style={styles.featureRow}>
                <Ionicons name="radio" size={24}
                  color={lastSyncStatus === 'active' ? COLORS.success : lastSyncStatus === 'error' ? COLORS.danger : COLORS.warning} />
                <Text style={styles.featureText}>
                  Live Stream: {lastSyncStatus === 'active' ? `Broadcasting (${streamFrameCount})` :
                    lastSyncStatus === 'error' ? 'Connection Error' : 'Syncing...'}
                </Text>
              </View>

              {/* Voice */}
              {voiceSOSEnabled && (
                <View style={styles.featureRow}>
                  <Ionicons name={voiceListening ? "mic" : "mic-off"} size={24} color={voiceListening ? COLORS.success : COLORS.gray400} />
                  <Text style={styles.featureText}>Voice SOS: {voiceListening ? "Listening" : "Stopped"}</Text>
                </View>
              )}
            </View>
          )}

          {/* VOICE ACTIVATION BUTTON */}
          <View style={styles.voiceActivationContainer}>
            <TouchableOpacity
              style={[styles.voiceControlBtn, voiceListening ? styles.voiceControlBtnActive : styles.voiceControlBtnInactive]}
              onPress={toggleVoiceSharing} activeOpacity={0.7}
            >
              <View style={styles.voiceBtnContent}>
                <Ionicons name={voiceListening ? "mic" : "mic-outline"} size={24} color={COLORS.white} />
                <View style={styles.voiceBtnTextContainer}>
                  <Text style={styles.voiceBtnTitle}>{voiceListening ? "Sound Trigger Active" : "Activate Sound Trigger"}</Text>
                  <Text style={styles.voiceBtnSubtitle}>
                    {voiceListening ? "Speak 'Help' or 'Stop' to control SOS" : "Tap to listen for emergency voice commands"}
                  </Text>
                </View>
                {voiceListening && <View style={styles.activeIndicator} />}
              </View>
            </TouchableOpacity>
          </View>

          {/* INFO CARDS */}
          <View style={styles.infoContainer}>
            <View style={styles.infoCard}>
              <Ionicons name="people" size={24} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Emergency Contacts</Text>
                <Text style={styles.infoText}>SMS sent to saved contacts + 9411596016</Text>
              </View>
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="location" size={24} color={COLORS.success} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Location Sharing</Text>
                <Text style={styles.infoText}>Real-time coordinates + Notifies users within 2km</Text>
              </View>
            </View>
            {voiceSOSEnabled && (
              <View style={styles.infoCard}>
                <Ionicons name="mic" size={24} color={COLORS.danger} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Voice SOS</Text>
                  <Text style={styles.infoText}>Say "Help" to activate or "Stop" to verify</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* VERIFICATION MODAL */}
        <Modal visible={showPinModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>STOP EMERGENCY</Text>

              <TouchableOpacity style={styles.biometricBtn} onPress={verifyWithBiometrics}>
                <Ionicons name="finger-print" size={40} color={COLORS.white} />
                <Text style={styles.biometricBtnText}>Tap for Fingerprint / FaceID</Text>
              </TouchableOpacity>

              <View style={styles.modalDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.modalSubtitle}>Enter 6-digit Safety PIN</Text>

              <View style={styles.pinInputContainer}>
                <TextInput
                  style={styles.pinInput}
                  placeholder="PIN"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  autoFocus
                  value={enteredPin}
                  onChangeText={setEnteredPin}
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowPinModal(false)}>
                  <Text style={styles.cancelBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={verifyAndStopSOS} disabled={loadingPin}>
                  {loadingPin ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator color={COLORS.white} size="small" />
                      <Text style={[styles.confirmBtnText, { marginLeft: 8 }]}>Stopping...</Text>
                    </View>
                  ) : (
                    <Text style={styles.confirmBtnText}>Stop SOS</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
};


/* ═══════════════════════ STYLES ═══════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  debugPanel: {
    backgroundColor: 'rgba(0,0,0,0.85)', margin: SPACING.md, padding: SPACING.md,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary,
  },
  debugTitle: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  debugText: { color: COLORS.white, fontSize: 10, fontFamily: 'monospace', marginBottom: 4 },
  debugLogContainer: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.white + '20', paddingTop: 8 },
  debugLogText: { color: COLORS.success, fontSize: 9, fontFamily: 'monospace' },
  debugResetBtn: { marginTop: 12, backgroundColor: COLORS.danger, padding: 8, borderRadius: 6, alignItems: 'center' },
  debugResetText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  scrollContent: { padding: SPACING.md, paddingBottom: 50 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: SPACING.md, marginBottom: SPACING.lg,
  },
  backButton: { padding: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: "bold", color: COLORS.white },
  statusCard: {
    backgroundColor: COLORS.danger, borderRadius: 16, padding: SPACING.md,
    marginBottom: SPACING.lg, alignItems: "center", borderWidth: 1, borderColor: COLORS.white + "40",
  },
  statusRow: { flexDirection: "row", alignItems: "center" },
  recordingDot: {
    width: scale(10), height: scale(10), borderRadius: scale(5),
    backgroundColor: COLORS.white, marginRight: scale(8),
  },
  statusText: { color: COLORS.white, fontWeight: "bold", fontSize: normalize(12) },
  timerText: { fontSize: normalize(32), fontWeight: "bold", color: COLORS.white, marginVertical: scale(8) },
  evidenceText: { color: COLORS.white + "80", fontSize: normalize(12) },
  sosContainer: { alignItems: "center", justifyContent: "center", marginVertical: scale(20) },
  sosButtonOuter: {
    width: scale(180), height: scale(180), borderRadius: scale(90),
    backgroundColor: COLORS.white + "30", alignItems: "center", justifyContent: "center",
  },
  sosButton: {
    width: scale(150), height: scale(150), borderRadius: scale(75),
    backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: scale(10), shadowOffset: { width: 0, height: scale(5) } },
      android: { elevation: 10 },
    }),
  },
  sosButtonTouch: { alignItems: "center", justifyContent: "center", width: "100%", height: "100%" },
  sosButtonText: { color: COLORS.white, fontSize: normalize(20), fontWeight: "bold", marginTop: scale(5) },
  sosHint: { color: COLORS.white, fontSize: normalize(16), marginTop: scale(20), textAlign: "center", opacity: 0.8 },
  evidenceContainer: {
    backgroundColor: COLORS.white + "15", borderRadius: scale(16), padding: SPACING.md, marginBottom: SPACING.md,
  },
  sectionTitle: { color: COLORS.white, fontSize: normalize(18), fontWeight: "bold", marginBottom: scale(10) },
  featureRow: {
    flexDirection: "row", alignItems: "center", marginBottom: scale(12),
    backgroundColor: COLORS.white + "10", padding: scale(10), borderRadius: scale(8),
  },
  featureText: { flex: 1, marginLeft: scale(12), color: COLORS.white, fontSize: normalize(14) },
  controlButton: { padding: scale(5) },
  cameraContainer: { height: scale(200), borderRadius: scale(12), overflow: "hidden", marginBottom: scale(20) },
  camera: { flex: 1 },
  infoContainer: { marginTop: scale(10) },
  infoCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    borderRadius: scale(12), padding: scale(15), marginBottom: scale(10),
  },
  infoContent: { marginLeft: scale(15) },
  infoTitle: { fontSize: normalize(16), fontWeight: "600", color: COLORS.gray800 },
  infoText: { fontSize: normalize(12), color: COLORS.gray500 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "85%", backgroundColor: "#fff", borderRadius: scale(20), padding: scale(25), alignItems: "center" },
  modalTitle: { fontSize: normalize(22), fontWeight: "bold", color: "#333", marginBottom: scale(5) },
  modalSubtitle: { fontSize: normalize(14), color: "#666", marginBottom: scale(20) },
  pinInputContainer: { width: "80%", alignItems: "center", marginBottom: scale(25) },
  pinInput: {
    width: "80%", height: scale(50), borderWidth: 1, borderColor: "#ddd", borderRadius: scale(10),
    textAlign: "center", fontSize: normalize(20), letterSpacing: 10, color: "#333",
  },
  modalButtons: { flexDirection: "row", width: "100%", justifyContent: "space-between" },
  modalBtn: { flex: 1, padding: scale(12), borderRadius: scale(10), alignItems: "center", marginHorizontal: scale(5) },
  cancelBtn: { backgroundColor: "#f0f0f0" },
  confirmBtn: { backgroundColor: COLORS.danger },
  cancelBtnText: { color: "#666", fontWeight: "bold" },
  confirmBtnText: { color: "#fff", fontWeight: "bold" },
  voiceActivationContainer: { marginVertical: SPACING.md, paddingHorizontal: scale(2) },
  voiceControlBtn: {
    borderRadius: scale(16), padding: scale(16), borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: scale(4), shadowOffset: { width: 0, height: scale(2) } },
      android: { elevation: 4 },
    }),
  },
  voiceControlBtnInactive: { backgroundColor: COLORS.white + "15", borderColor: COLORS.white + "30" },
  voiceControlBtnActive: { backgroundColor: COLORS.success + "80", borderColor: COLORS.success },
  voiceBtnContent: { flexDirection: "row", alignItems: "center" },
  voiceBtnTextContainer: { flex: 1, marginLeft: scale(15) },
  voiceBtnTitle: { color: COLORS.white, fontSize: normalize(16), fontWeight: "bold" },
  voiceBtnSubtitle: { color: COLORS.white + "80", fontSize: normalize(12), marginTop: scale(2) },
  activeIndicator: { width: scale(10), height: scale(10), borderRadius: scale(5), backgroundColor: COLORS.white },
  modalDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: scale(20) },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.gray300 },
  dividerText: { marginHorizontal: scale(10), color: COLORS.gray500, fontWeight: 'bold', fontSize: normalize(12) },
  biometricBtn: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: SPACING.md, borderRadius: scale(16), marginTop: scale(10),
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  biometricBtnText: { color: COLORS.white, fontSize: normalize(16), fontWeight: 'bold', marginLeft: scale(10) },
});


export default SOSEmergencyScreen;