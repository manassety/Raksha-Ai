// src/services/PythonAIApi.js
// ADD-ON for Python Backend Integration
// Handles communication between React Native and the Flask AI server.
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DiscoveryService from './DiscoveryService';

// Fetch the dynamically determined python server URL that updates automatically
const getPythonServerUrl = () => {
    return DiscoveryService.getPythonUrl();
};

// Safe Fetch Wrapper with Timeout so it doesn't indefinitely hang on "Network Request Failed"
const fetchWithTimeout = async (url, options = {}, timeout = 6000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Connection timed out. Ensure Python server is running at ${getPythonServerUrl()}`);
        }
        throw new Error(`Server unreachable. Is the Python app running on ${getPythonServerUrl()}?`);
    }
};

/**
 * FEATURE 2: Facial Authentication During Registration
 * Sends the user's face image to the Python server to store their encoding.
 */
export const registerFaceWithPython = async (userId, base64Image) => {
    try {
        const url = `${getPythonServerUrl()}/api/auth/register`;
        console.log("Connecting to Python AI at:", url);

        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, image: base64Image })
        }, 10000); // 10s wait since processing takes time

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Python AI Registration Error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * FEATURE 3: Intelligent Evidence Collection System
 * Streams frames to Python. Python detects humans, ignores the registered user,
 * and automatically saves evidence of unknown individuals.
 */
export const analyzeFrameWithPython = async (userId, base64Image, encoding = null) => {
    try {
        const url = `${getPythonServerUrl()}/api/evidence/analyze`;
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, image: base64Image, encoding })
        }, 12000); // 12s wait for AI frame processing
        const result = await response.json();
        return result; // Contains { unknown_detected, evidence_saved, total_evidence_saved, boxes }
    } catch (error) {
        console.error('Python AI Analysis Error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Hook this function into your camera frame processor or interval loop
 * inside SOSEmergencyScreen.js. It acts as a modular extension.
 */
export const handleAIEvidenceCollection = async (userId, base64Image, encoding, onUnknownDetected) => {
    const analysis = await analyzeFrameWithPython(userId, base64Image, encoding);

    if (analysis && analysis.success && analysis.unknown_detected) {
        console.log(`Unknown person detected! Evidence saved: ${analysis.evidence_saved}. Total: ${analysis.total_evidence_saved}/10`);

        // Trigger UI alert or sound via callback if optional features are requested
        if (onUnknownDetected) {
            onUnknownDetected(analysis.boxes);
        }
    }
    return analysis;
};

/**
 * FEATURE 1: Python ADB Automation
 * Triggers the Python server to take control of the phone via ADB.
 */
export const triggerPythonAutomation = async (phone, message) => {
    try {
        const url = `${getPythonServerUrl()}/api/sos/automate`;
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message })
        }, 8000);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Python Automation Error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * FEATURE: Cloud SMS Integration
 * Sends SMS via Backend Gateway (Twilio/Fast2SMS) silently.
 */
export const sendCloudSMS = async (numbers, message) => {
    try {
        const url = `${getPythonServerUrl()}/api/sos/send_cloud_sms`;
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers, message })
        }, 8000);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Cloud SMS Error:', error.message);
        return { success: false, error: error.message };
    }
};
