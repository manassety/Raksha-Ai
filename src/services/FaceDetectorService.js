/**
 * Face Detector Service
 * Note: expo-face-detector is problematic in current Expo Go versions.
 * Disabling native face detection for stability.
 */

export const detectFacesAsync = async (uri) => {
  // Return empty array as fallback since expo-face-detector is not found in the environment
  return [];
};
