import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameProcessor } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { db } from '../config/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

/**
 * DetectionService
 * Handles TFLite model loading, frame processing, and Firebase metadata syncing.
 */

// Save detection result to Firebase
const saveDetectionToFirebase = async (sosId, detectionData) => {
    if (!sosId) return;
    try {
        const sessionRef = doc(db, 'sosSessions', sosId);
        await setDoc(sessionRef, {
            detection: detectionData,
            humanDetected: detectionData.humanDetected,
            objectLabel: detectionData.label,
            confidence: detectionData.confidence,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error('[DetectionService] Firebase Update Error:', error);
    }
};

export const useDetectionService = (sosId, onDetection) => {
    // Load TFLite Model (e.g., mobilenet or yolov8 tflite)
    // Ensure the model is placed in android/app/src/main/assets or ios/ bundle
    const model = useTensorflowModel(require('../../assets/model.tflite'));

    const processDetection = (detections) => {
        // Process raw TFLite outputs to determine if human/object is detected
        // Assuming a simple classification or detection model

        // Placeholder logic for generic output:
        let isHuman = false;
        let confidence = 0;

        // If it's a typical Object Detection API (e.g. SSD MobileNet)
        // outputs might be [boxes, classes, scores, num_detections]
        if (detections && detections.length > 0) {
            // Analyze detections (mock implementation based on expected model output)
            const firstOutput = detections[0];
            if (typeof firstOutput === 'number') {
                confidence = firstOutput;
                isHuman = confidence > 0.5;
            }
        }

        const detectionData = {
            humanDetected: isHuman,
            label: isHuman ? 'person' : 'none',
            confidence: confidence
        };

        if (onDetection) {
            onDetection(detectionData);
        }

        // Save to Firebase occasionally to avoid spam
        if (isHuman && Math.random() < 0.1) { // Throttle updates or manage in UI
            saveDetectionToFirebase(sosId, detectionData);
        }
    };

    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';
        if (model.state === 'loaded') {
            try {
                // Run model on frame
                // TFLite model expects specific input shapes (e.g. 224x224 RGB)
                // Note: react-native-fast-tflite auto handles conversion if supported
                const outputs = model.model.runSync([frame]);

                // Pass results back to JS thread
                runOnJS(processDetection)(outputs);
            } catch (error) {
                console.error('[DetectionService] Frame Process Error:', error);
            }
        }
    }, [model, sosId]);

    return {
        frameProcessor,
        modelLoaded: model.state === 'loaded',
        modelError: model.state === 'error'
    };
};

export default {
    saveDetectionToFirebase
};
