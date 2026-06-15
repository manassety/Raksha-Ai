export const COLORS = {
  primary: '#1e3a8a',
  primaryLight: '#3b82f6',
  secondary: '#0ea5e9',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  info: '#3b82f6',
  white: '#ffffff',
  black: '#000000',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  transparent: 'transparent',
};

export const GRADIENTS = {
  primary: ['#1e3a8a', '#3b82f6'],
  secondary: ['#0ea5e9', '#06b6d4'],
  danger: ['#ef4444', '#dc2626'],
  success: ['#10b981', '#059669'],
  warning: ['#f59e0b', '#d97706'],
  dark: ['#1f2937', '#111827'],
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const DEFAULT_SETTINGS = {
  largeText: false,
  highContrast: false,
  colorBlindMode: 'none',
  voiceFeedback: true,
  hapticFeedback: true,
};

export default { COLORS, GRADIENTS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS, DEFAULT_SETTINGS };
