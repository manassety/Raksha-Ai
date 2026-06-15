export const STORAGE_KEYS = {
  IS_FIRST_LAUNCH: 'isFirstLaunch',
  USER_PROFILE: 'userProfile',
  SAFETY_PIN: 'safetyPin',
  EMERGENCY_CONTACTS: 'emergencyContacts',
  DEVICE_CONTACTS: 'deviceContacts',
  EVIDENCE_DATA: 'evidenceData',
  EMERGENCY_LOGS: 'emergencyLogs',
  SETTINGS: 'appSettings',
  ADMIN_MODE: 'adminMode',
};

export const SCREEN_NAMES = {
  HOME: 'Home',
  SOS_EMERGENCY: 'SOSEmergency',
  LIVE_TRACKING: 'LiveTracking',
  NEARBY_ALERTS: 'NearbyAlerts',
  FAKE_CALL: 'FakeCall',
  COMPLAINT_REPORT: 'ComplaintReport',
  CONTACTS_MANAGER: 'ContactsManager',
  EVIDENCE_GALLERY: 'EvidenceGallery',
  SAFETY_PIN: 'SafetyPIN',
  SOS_RECORDING: 'SOSRecording',
  SETTINGS: 'Settings',
  ACCESSIBILITY: 'Accessibility',
  ADMIN_VERIFICATION: 'AdminVerification',
  USER_MANAGEMENT: 'UserManagement',
  EVIDENCE_BACKUP: 'EvidenceBackup',
  EDIT_PROFILE: 'EditProfile',
  REPORTS_ANALYTICS: 'ReportsAnalytics',
  DATABASE_ANALYTICS: 'DatabaseAnalytics',
  APP_LOCK: 'AppLock',
  PIN_SETUP: 'PINSetup',
  PIN_INPUT: 'PINInput',
  CRIME_ANALYSIS: 'CrimeAnalysis',
};

export const EMERGENCY_CONFIG = {
  AUTO_ESCALATION_TIME: 30000,
  PIN_ATTEMPTS_BEFORE_LOCK: 3,
  LOCKOUT_DURATION: 300000,
  VOICE_TRIGGER_WORDS: ['help', 'sos', 'emergency', 'save me'],
  RECORDING_MAX_DURATION: 300,
};

export const POLICE_CONTACTS = {
  GENERAL: '100',
  WOMEN_HELPLINE: '1091',
  EMERGENCY: '112',
  CHILD_HELPLINE: '1098',
};

export const COMPLAINT_CATEGORIES = [
  { id: 'harassment', label: 'Harassment', icon: '👤' },
  { id: 'assault', label: 'Assault', icon: '⚠️' },
  { id: 'stalking', label: 'Stalking', icon: '👁️' },
  { id: 'cybercrime', label: 'Cybercrime', icon: '💻' },
  { id: 'theft', label: 'Theft', icon: '👜' },
  { id: 'accident', label: 'Accident', icon: '🚗' },
  { id: 'landslide', label: 'Land Slide', icon: '⛰️' },
  { id: 'other', label: 'Other', icon: '📋' },
];

export const FAKE_CALLERS = [
  { id: '1', name: 'Mom', number: '+1234567890', avatar: '👩' },
  { id: '2', name: 'Dad', number: '+1234567891', avatar: '👨' },
  { id: '3', name: 'Boss', number: '+1234567892', avatar: '👔' },
  { id: '4', name: 'Friend', number: '+1234567893', avatar: '👥' },
  { id: '5', name: 'Custom', number: '', avatar: '👤' },
];

export const EVIDENCE_TYPES = {
  PHOTO: 'photo',
  VIDEO: 'video',
  AUDIO: 'audio',
};

export const NOTIFICATION_CHANNELS = {
  EMERGENCY: 'emergency_alerts',
  ALERTS: 'nearby_alerts',
  GENERAL: 'general_notifications',
};

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBzfBhpdOw7bwt_PMykOP0icdGK7wkcaM4",
  authDomain: "tanprix-52683.firebaseapp.com",
  projectId: "tanprix-52683",
  storageBucket: "tanprix-52683.firebasestorage.app",
  messagingSenderId: "179060902521",
  appId: "1:179060902521:web:b717f47e67f304ff36e2a8",
  measurementId: "G-55HCRBEWNF"
};

export const FAKE_CALL_TIMERS = [
  { id: '5', label: '5 seconds', value: 5 },
  { id: '10', label: '10 seconds', value: 10 },
  { id: '15', label: '15 seconds', value: 15 },
  { id: '30', label: '30 seconds', value: 30 },
  { id: '60', label: '1 minute', value: 60 },
  { id: '120', label: '2 minutes', value: 120 },
  { id: '300', label: '5 minutes', value: 300 },
];

export const FAKE_CALL_DURATION = 30;

export const EMERGENCY_MESSAGE = "EMERGENCY! I need help! This is an automated message from RakshaAi Safety App. My last known location: ";



export default {
  STORAGE_KEYS,
  SCREEN_NAMES,
  EMERGENCY_CONFIG,
  POLICE_CONTACTS,
  COMPLAINT_CATEGORIES,
  FAKE_CALLERS,
  EVIDENCE_TYPES,
  NOTIFICATION_CHANNELS,
  FIREBASE_CONFIG
};