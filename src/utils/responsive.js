import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Basic scale function with a cap to avoid over-zooming on very wide devices
const scale = (size) => {
    const rawScale = (SCREEN_WIDTH / guidelineBaseWidth) * size;
    // If width is larger than base, slow down the growth to prevent "zoomed" appearance
    if (SCREEN_WIDTH > 400) {
        return size + (rawScale - size) * 0.4; // Only grow by 40% of the difference
    }
    return rawScale;
};

const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

// Moderate scale helps maintain a balance between raw scale and original size
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Responsive font size calculation
 * Uses a more balanced approach to prevent "zoomed" appearance on high-density
 * Android devices like Samsung while keeping iOS looking crisp.
 */
const normalize = (size) => {
    const scaleFactor = SCREEN_WIDTH / guidelineBaseWidth;
    const newSize = size * scaleFactor;

    // Balanced adjustment for Android vs iOS
    const adjustedSize = Platform.select({
        ios: newSize,
        android: size + (newSize - size) * 0.5 // Moderate scaling for Android to prevent zooming
    });

    // Final safety checks for tablets or very large screens
    if (SCREEN_WIDTH > 600) {
        return Math.round(PixelRatio.roundToNearestPixel(adjustedSize)) * 0.75;
    }

    return Math.round(PixelRatio.roundToNearestPixel(adjustedSize));
};

export {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    scale,
    verticalScale,
    moderateScale,
    normalize
};
