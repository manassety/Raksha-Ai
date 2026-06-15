import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  SafeAreaView,
  TextInput,
  Modal,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as SMS from "expo-sms";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import * as ScreenCapture from "expo-screen-capture";
import * as Speech from "expo-speech";
import { CameraView, useCameraPermissions } from "expo-camera";
import { getAuth } from "firebase/auth";
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  where,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import GradientBackground from "../components/GradientBackground";
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from "../config/theme";
import * as LocalAuthentication from 'expo-local-authentication';
import { saveEvidence as uploadEvidence } from '../utils/EvidenceManager';

// --- Helper: Calculate Distance ---
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) *
    Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
const deg2rad = (deg) => deg * (Math.PI / 180);

const SOSEmergencyScreen = () => {
  const navigation = useNavigation();

  const [sosActive, setSosActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [voiceSOSEnabled, setVoiceSOSEnabled] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [location, setLocation] = useState(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // PIN Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [loadingPin, setLoadingPin] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Refs
  const audioRecorderRef = useRef(null);
  const cameraRef = useRef(null);
  const backgroundAudioRef = useRef(null);
  const voiceIntervalRef = useRef(null);

  useEffect(() => {
    requestPermissions();
    checkVoiceSOSPreference();
    loadLocation();
    return () => {
      stopAllRecording();
      stopBackgroundVoiceListening();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      checkVoiceSOSPreference();
      loadLocation();
    }, [])
  );

  useEffect(() => {
    if (sosActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [sosActive]);

  useEffect(() => {
    let interval;
    if (sosActive && (isRecording || isVideoRecording)) {
      interval = setInterval(
        () => setRecordingTime((prev) => prev + 1),
        1000
      );
    }
    return () => clearInterval(interval);
  }, [sosActive, isRecording, isVideoRecording]);

  const loadLocation = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(pos.coords);
    } catch (err) {
      console.log("Error loading location:", err);
    }
  };

  const checkVoiceSOSPreference = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setVoiceSOSEnabled(data.voiceSOS || false);
        }
      }
    } catch (error) {
      console.log("Error checking voice SOS preference:", error);
      setVoiceSOSEnabled(false);
    }
  };

  useEffect(() => {
    if (voiceSOSEnabled) {
      startBackgroundVoiceListening();
    } else {
      stopBackgroundVoiceListening();
    }
  }, [voiceSOSEnabled]);

  const requestPermissions = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
      await requestCameraPermission();
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log("Audio permission not granted");
      }
    } catch (err) {
      console.log("Permissions error:", err);
    }
  };

  // ---------------- BACKGROUND VOICE LISTENING (TESTING MODE) ----------------
  const startBackgroundVoiceListening = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playsThroughEarpieceAndroid: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // Listen for loud noises as a temporary simulation of a "Help" command
      recording.setProgressUpdateInterval(500);
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering) {
          // If the audio level is loud enough (metering > -5dB), mimic a voice command!
          if (status.metering > -5) {
            console.log("Loud voice detected! Metering level:", status.metering);
            // Trigger start if inactive...
            if (!sosActive) {
              setVoiceListening(false);
              triggerSOS();
            }
            // Or prompt for stop if active...
            else if (sosActive && !showPinModal) {
              setVoiceListening(false);
              handleStopRequest();
            }
          }
        }
      });

      backgroundAudioRef.current = recording;
      setVoiceListening(true);
      console.log("Audio listener started in test mode using Expo-AV metering.");
    } catch (err) {
      console.log("Background voice listening error:", err);
    }
  };

  const stopBackgroundVoiceListening = async () => {
    try {
      if (backgroundAudioRef.current) {
        await backgroundAudioRef.current.stopAndUnloadAsync();
        backgroundAudioRef.current = null;
      }
      setVoiceListening(false);
    } catch (err) {
      console.log("Stop background voice error:", err);
    }
  };

  // ---------------- RECORDING ----------------
  const startAudioRecording = async () => {
    try {
      // 1. Fully stop the background loud noise listener if it exists to free up the Audio module
      if (backgroundAudioRef.current) {
        await backgroundAudioRef.current.stopAndUnloadAsync();
        backgroundAudioRef.current = null;
        setVoiceListening(false);
      }

      if (audioRecorderRef.current) {
        await audioRecorderRef.current.stopAndUnloadAsync();
        audioRecorderRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      audioRecorderRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.log("Audio Start Err:", err);
    }
  };

  const stopAudioRecording = async () => {
    try {
      if (!audioRecorderRef.current) return;

      await audioRecorderRef.current.stopAndUnloadAsync();
      const uri = audioRecorderRef.current.getURI();

      if (uri) {
        await saveEvidence(uri, "audio");
      }

      audioRecorderRef.current = null;
      setIsRecording(false);
      setRecordingTime(0);

      // Re-enable loud noise listener if setting is enabled!
      if (voiceSOSEnabled && !sosActive) {
        startBackgroundVoiceListening();
      }
    } catch (err) {
      console.log("Audio Stop Err:", err);
    }
  };

  const startVideoRecording = async () => {
    try {
      if (!cameraRef.current || !cameraPermission?.granted) return;

      setIsVideoRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 300,
        quality: "480p",
      });

      if (video?.uri) {
        await saveEvidence(video.uri, "video");
      }
    } catch (err) {
      console.log("Video start err:", err);
      setIsVideoRecording(false);
    }
  };

  const stopVideoRecording = async () => {
    try {
      if (cameraRef.current) {
        await cameraRef.current.stopRecording();
        setIsVideoRecording(false);
      }
    } catch (err) {
      console.log("Video stop err:", err);
      setIsVideoRecording(false);
    }
  };

  const stopAllRecording = async () => {
    await stopAudioRecording();
    await stopVideoRecording();
  };

  // ---------------- SAVE EVIDENCE ----------------
  const saveEvidence = async (uri, type) => {
    try {
      const user = getAuth().currentUser;
      if (!user) {
        console.log("No user found");
        return;
      }

      const userName =
        user?.displayName ||
        user?.email?.split("@")[0] ||
        "UnknownUser";

      const fileInfo = {
        uri: uri,
        name: `${type}_${Date.now()}.${type === "video" ? "mp4" : "m4a"}`,
        size: 0,
      };

      const result = await uploadEvidence(
        userName,
        fileInfo,
        type,
        location || null,
        'SOS Emergency',
        'sos'
      );

      if (result.success) {
        setEvidenceCount((prev) => prev + 1);
      } else {
        console.log("Evidence upload failed:", result.error);
      }
    } catch (err) {
      console.log("Evidence upload err:", err);
    }
  };

  // ---------------- TRIGGER SOS ----------------
  const triggerSOS = async () => {
    if (sosActive) return;
    setSending(true);

    try {
      let loc = null;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        loc = pos.coords;
        setLocation(loc);
      } catch { }

      const user = getAuth().currentUser;
      const userId = user?.uid;

      // Contacts
      let emergencyContacts = [];
      if (userId) {
        const q = query(
          collection(db, "contacts"),
          where("userId", "==", userId)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => emergencyContacts.push(d.data()));
      }

      const locationUrl = loc
        ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
        : "Location unavailable";

      let locationName = "Unknown Location";
      if (loc) {
        try {
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
          if (geocode && geocode.length > 0) {
            const place = geocode[0];
            const addressParts = [place.street, place.city, place.region].filter(Boolean);
            if (addressParts.length > 0) {
              locationName = addressParts.join(', ');
            }
          }
        } catch (e) {
          console.log("Reverse geocoding error:", e);
        }
      }

      const message = `EMERGENCY! I need help at ${locationName}!\nLocation: ${locationUrl}`;
      let numbers = emergencyContacts.map((c) => c.phone);

      numbers.push("9411596016");

      const smsAvailable = await SMS.isAvailableAsync();
      if (smsAvailable && numbers.length > 0) {
        await SMS.sendSMSAsync(numbers, message);
      }

      await addDoc(collection(db, "sos_alerts"), {
        userId: userId || "anonymous",
        type: "SOS_EMERGENCY",
        location: loc,
        timestamp: Timestamp.now(),
        message,
        status: "ACTIVE",
      });

      // NEARBY ALERTS
      if (loc) {
        const usersSnapshot = await getDocs(
          collection(db, "users")
        );

        const nearbyUserIds = [];

        usersSnapshot.forEach((docSnap) => {
          const u = docSnap.data();

          if (
            u.uid !== userId &&
            u.lastLocation &&
            u.lastLocation.latitude &&
            u.lastLocation.longitude
          ) {
            const dist = getDistanceFromLatLonInKm(
              loc.latitude,
              loc.longitude,
              u.lastLocation.latitude,
              u.lastLocation.longitude
            );

            if (dist <= 2) nearbyUserIds.push(u.uid);
          }
        });

        // Always create the alert, even if the nearby user array is empty, so it displays globally
        await addDoc(collection(db, "alerts"), {
          type: "sos",
          priority: "high",
          title: "🚨 Emergency SOS Triggered",
          message: `SOS Triggered at ${locationName}!\n${locationUrl}`,
          locationUrl,
          locationName,
          triggeredBy: userId,
          targetUsers: nearbyUserIds,
          createdAt: Date.now(),
          status: "ongoing",
          read: false,
        });
      }

      // Start recordings
      await startAudioRecording();
      if (cameraPermission?.granted) {
        await startVideoRecording();
      }

      setSosActive(true);
      await ScreenCapture.preventScreenCaptureAsync();
      Speech.speak("SOS Activated");
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "Could not activate SOS.");
    }

    setSending(false);
  };

  // ---------------- STOP SOS ----------------
  const handleStopRequest = () => {
    setShowPinModal(true);
    setEnteredPin("");
  };

  const verifyAndStopSOS = async () => {
    setLoadingPin(true);

    try {
      // 1. Check for biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      let biometricSuccess = false;
      if (hasHardware && isEnrolled) {
        const biometricAuth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify your presence to stop SOS',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
        });

        if (biometricAuth.success) {
          biometricSuccess = true;
          await stopSOS();
          setShowPinModal(false);
          setLoadingPin(false);
          return;
        }
      }

      // 2. Fallback to PIN
      const user = getAuth().currentUser;
      let savedPin = "123456";

      if (user) {
        const userDoc = await getDoc(
          doc(db, "users", user.uid)
        );
        if (userDoc.exists()) {
          const data = userDoc.data();
          savedPin =
            data.safetyPin ||
            data.safetyPIN ||
            data.pin ||
            "123456";
        }
      }

      if (enteredPin === savedPin) {
        await stopSOS();
        setShowPinModal(false);
      } else {
        if (!biometricSuccess) {
          Alert.alert(
            "Verification Failed",
            "Incorrect safety PIN or biometric validation failed."
          );
        }
      }
    } catch (err) {
      Alert.alert("Error", "Could not verify identity.");
    }

    setLoadingPin(false);
  };

  const stopSOS = async () => {
    await stopAllRecording();

    try {
      await ScreenCapture.allowScreenCaptureAsync();
    } catch { }

    const userId = getAuth().currentUser?.uid;

    await addDoc(collection(db, "sos_alerts"), {
      userId: userId || "anonymous",
      type: "SOS_STOPPED",
      timestamp: Timestamp.now(),
      status: "RESOLVED",
      evidenceCount,
      location: location || null,
    });

    if (userId) {
      try {
        const alertsQuery = query(
          collection(db, "alerts"),
          where("triggeredBy", "==", userId),
          where("status", "==", "ongoing")
        );
        const alertsSnap = await getDocs(alertsQuery);
        const updatePromises = [];
        alertsSnap.forEach((d) => {
          updatePromises.push(updateDoc(doc(db, "alerts", d.id), { status: "resolved" }));
        });
        await Promise.all(updatePromises);
      } catch (err) {
        console.log("Error resolving nearby alerts:", err);
      }
    }

    setSosActive(false);
    setIsVideoRecording(false);
    setRecordingTime(0);
    setEvidenceCount(0);
    Speech.speak("SOS stopped");
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;

    return `${m.toString().padStart(2, "0")}`;
  };

  // ---------------- UI ----------------
  return (
    <GradientBackground colors={GRADIENTS.danger}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() =>
                navigation.canGoBack()
                  ? navigation.goBack()
                  : navigation.navigate("MainTabs")
              }
              style={styles.backButton}
            >
              <Ionicons
                name="close"
                size={28}
                color={COLORS.white}
              />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>SOS Emergency</Text>

            <View style={{ width: 28 }} />
          </View>

          {/* STATUS CARD */}
          {sosActive && (
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Animated.View
                  style={[
                    styles.recordingDot,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <Text style={styles.statusText}>
                  RECORDING IN PROGRESS
                </Text>
              </View>

              <Text style={styles.timerText}>
                {formatTime(recordingTime)}
              </Text>

              <Text style={styles.evidenceText}>
                Evidence Collected: {evidenceCount}
              </Text>
            </View>
          )}

          {/* SOS BUTTON */}
          <View style={styles.sosContainer}>
            <Animated.View
              style={[
                styles.sosButtonOuter,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Animated.View
                style={[
                  styles.sosButton,
                  { transform: [{ scale: scaleAnim }] },
                ]}
              >
                <TouchableOpacity
                  style={styles.sosButtonTouch}
                  disabled={sending}
                  onPress={() =>
                    sosActive ? handleStopRequest() : triggerSOS()
                  }
                >
                  {sending ? (
                    <ActivityIndicator
                      size="large"
                      color={COLORS.white}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={sosActive ? "stop" : "warning"}
                        size={50}
                        color={COLORS.white}
                      />
                      <Text style={styles.sosButtonText}>
                        {sosActive ? "STOP" : "HELP"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>

            <Text style={styles.sosHint}>
              {sosActive
                ? "Tap to Stop (Requires PIN)"
                : "Tap to Activate Emergency"}
            </Text>
          </View>

          {/* EVIDENCE FEATURES */}
          {sosActive && (
            <View style={styles.evidenceContainer}>
              <Text style={styles.sectionTitle}>
                Live Features
              </Text>

              {/* AUDIO */}
              <View style={styles.featureRow}>
                <Ionicons
                  name={isRecording ? "mic" : "mic-off"}
                  size={24}
                  color={
                    isRecording
                      ? COLORS.white
                      : COLORS.gray400
                  }
                />

                <Text style={styles.featureText}>
                  Audio Recording:{" "}
                  {isRecording ? "Active" : "Stopped"}
                </Text>
              </View>

              {/* VIDEO */}
              <View style={styles.featureRow}>
                <Ionicons
                  name="videocam"
                  size={24}
                  color={COLORS.white}
                />

                <Text style={styles.featureText}>
                  Video Evidence
                </Text>

                {cameraPermission?.granted ? (
                  <TouchableOpacity
                    onPress={() =>
                      isVideoRecording
                        ? stopVideoRecording()
                        : startVideoRecording()
                    }
                    style={styles.controlButton}
                  >
                    <Ionicons
                      name={
                        isVideoRecording
                          ? "stop-circle"
                          : "play-circle"
                      }
                      size={28}
                      color={COLORS.white}
                    />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.featureText}>
                    No Camera Permission
                  </Text>
                )}
              </View>

              {/* VOICE LISTENING */}
              {voiceSOSEnabled && (
                <View style={styles.featureRow}>
                  <Ionicons
                    name={voiceListening ? "mic" : "mic-off"}
                    size={24}
                    color={
                      voiceListening
                        ? COLORS.success
                        : COLORS.gray400
                    }
                  />

                  <Text style={styles.featureText}>
                    Voice SOS:{" "}
                    {voiceListening ? "Listening" : "Stopped"}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* CAMERA PREVIEW */}
          {sosActive &&
            cameraPermission?.granted && (
              <View style={styles.cameraContainer}>
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="back"
                />
              </View>
            )}

          {/* INFO CARDS */}
          <View style={styles.infoContainer}>
            <View style={styles.infoCard}>
              <Ionicons
                name="people"
                size={24}
                color={COLORS.primary}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>
                  Emergency Contacts
                </Text>
                <Text style={styles.infoText}>
                  SMS sent to saved contacts + 9411596016
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons
                name="location"
                size={24}
                color={COLORS.success}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>
                  Location Sharing
                </Text>
                <Text style={styles.infoText}>
                  Real-time coordinates + Notifies users
                  within 2km
                </Text>
              </View>
            </View>

            {voiceSOSEnabled && (
              <View style={styles.infoCard}>
                <Ionicons
                  name="mic"
                  size={24}
                  color={COLORS.danger}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>
                    Voice SOS
                  </Text>
                  <Text style={styles.infoText}>
                    Say "Help" to activate SOS automatically
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* PIN MODAL */}
        <Modal
          visible={showPinModal}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Stop SOS?
              </Text>

              <Text style={styles.modalSubtitle}>
                Enter your 6-digit PIN
              </Text>

              <View style={styles.pinInputContainer}>
                <TextInput
                  style={styles.pinInput}
                  placeholder="******"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  value={enteredPin}
                  onChangeText={setEnteredPin}
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setShowPinModal(false)}
                >
                  <Text style={styles.cancelBtnText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.confirmBtn]}
                  onPress={verifyAndStopSOS}
                  disabled={loadingPin}
                >
                  {loadingPin ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      Verify & Stop
                    </Text>
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

/* ------------------ STYLES ------------------ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: 50 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  backButton: { padding: SPACING.xs },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    color: COLORS.white,
  },

  statusCard: {
    backgroundColor: COLORS.danger,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.white + "40",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.white,
    marginRight: 8,
  },
  statusText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 12,
  },
  timerText: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.white,
    marginVertical: 8,
  },
  evidenceText: {
    color: COLORS.white + "80",
    fontSize: 12,
  },

  sosContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  sosButtonOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.white + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  sosButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.5,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sosButtonTouch: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  sosButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xl,
    fontWeight: "bold",
    marginTop: 5,
  },
  sosHint: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    marginTop: 20,
    textAlign: "center",
    opacity: 0.8,
  },

  evidenceContainer: {
    backgroundColor: COLORS.white + "15",
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: "bold",
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: COLORS.white + "10",
    padding: 10,
    borderRadius: 8,
  },
  featureText: {
    flex: 1,
    marginLeft: 12,
    color: COLORS.white,
    fontSize: 14,
  },
  controlButton: { padding: 5 },

  cameraContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  camera: { flex: 1 },

  infoContainer: { marginTop: 10 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  infoContent: { marginLeft: 15 },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray800,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.gray500,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  pinInputContainer: {
    width: "80%",
    alignItems: "center",
    marginBottom: 25,
  },
  pinInput: {
    width: "80%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 20,
    letterSpacing: 10,
    color: "#333",
  },

  modalButtons: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  modalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelBtn: { backgroundColor: "#f0f0f0" },
  confirmBtn: { backgroundColor: COLORS.danger },
  cancelBtnText: { color: "#666", fontWeight: "bold" },
  confirmBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default SOSEmergencyScreen;