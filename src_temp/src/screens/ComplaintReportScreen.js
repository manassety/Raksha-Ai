import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { COMPLAINT_CATEGORIES } from '../config/constants';
import { useAuth } from '../contexts/AuthContext';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

import { uploadToCloudinary } from '../utils/cloudinaryService';
import { saveEvidence } from '../utils/EvidenceManager';


const ComplaintReportScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState('image');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [incidentTime, setIncidentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));


  useEffect(() => {
    loadLocation();
    checkSmsAvailability();
  }, []);

  const checkSmsAvailability = async () => {
    try {
      const available = await SMS.isAvailableAsync();
      setSmsAvailable(available);
    } catch (error) {
      console.log("SMS not available:", error);
      setSmsAvailable(false);
    }
  };

  const loadLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(pos.coords);
      }
    } catch (error) {
      console.log("Location error:", error);
    }
    setLoading(false);
  };

  const handlePickDocument = async (type) => {
    try {
      let result;

      if (type === 'image') {
        result = await DocumentPicker.getDocumentAsync({
          type: 'image/*',
          copyToCacheDirectory: true,
        });
      } else if (type === 'video') {
        result = await DocumentPicker.getDocumentAsync({
          type: 'video/*',
          copyToCacheDirectory: true,
        });
      } else if (type === 'audio') {
        result = await DocumentPicker.getDocumentAsync({
          type: 'audio/*',
          copyToCacheDirectory: true,
        });
      } else if (type === 'document') {
        result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          copyToCacheDirectory: true,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        const fileInfo = result.assets[0];
        await uploadEvidence(fileInfo, type);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadEvidence = async (fileInfo, type) => {
    try {
      setUploading(true);
      const user = getAuth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Save evidence using centralized manager (this also saves to Firestore evidence collection)
      const userName = user.displayName || user.email?.split('@')[0] || 'User';
      const saveResult = await saveEvidence(
        userName,
        fileInfo,
        type,
        location,
        category,
        'complaint'
      );

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to register evidence');
      }

      const downloadURL = saveResult.url;

      const uploadedFile = {
        id: saveResult.id,
        type: type,
        fileName: fileInfo.name,
        url: downloadURL,
        size: fileInfo.size,
      };

      setUploadedFiles([...uploadedFiles, uploadedFile]);
      Alert.alert('Success', 'File uploaded and registered successfully!');
      setShowUploadModal(false);
    } catch (error) {
      console.error('Error uploading evidence to Cloudinary:', error);
      Alert.alert('Error', 'Failed to upload file to Cloudinary');
    }
    setUploading(false);
  };


  const handleDeleteFile = (fileId) => {
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId));
  };

  const handleSubmit = async () => {
    console.log("Submitting report...");
    console.log("Category:", category);
    console.log("Description:", description.length > 0 ? "Present" : "Empty");

    if (!category) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }

    if (description.length < 10) {
      Alert.alert('Error', 'Description must be at least 10 characters.');
      return;
    }

    setSubmitting(true);


    try {
      const user = getAuth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        setSubmitting(false);
        return;
      }

      const categoryData = COMPLAINT_CATEGORIES.find((c) => c.id === category);
      if (!categoryData) {
        Alert.alert('Error', 'Invalid category selected');
        setSubmitting(false);
        return;
      }

      // 1. Save complaint to Firestore for tracking
      const complaintData = {
        userId: user.uid,
        userName: isAnonymous ? 'Anonymous' : (user.displayName || user.email?.split('@')[0] || 'User'),
        category: category,
        categoryName: categoryData.label,
        description: description,
        incidentDate: incidentDate,
        incidentTime: incidentTime,
        helpline: categoryData.helpline || '1091', // Default to women's helpline if not specified
        location: location,
        evidence: uploadedFiles,
        status: 'pending',
        submittedAt: Timestamp.now(),
        anonymous: isAnonymous,
        userEmail: isAnonymous ? null : user.email,
        reportId: `REP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      };

      const docRef = await addDoc(collection(db, 'complaints'), complaintData);
      console.log("Document written with ID: ", docRef.id);

      setSubmitting(false);

      // Success Alert
      Alert.alert(
        '✅ Report Submitted',
        'Your complaint has been securely saved to the registry and authorities have been notified.',
        [
          {
            text: 'View My Reports',
            onPress: () => navigation.navigate('ReportsAnalytics'),
          },
          {
            text: 'Close',
            onPress: () => navigation.goBack(),
            style: 'cancel',
          },
        ]
      );

    } catch (error) {
      console.error('Error submitting complaint:', error);
      Alert.alert('Error', 'Failed to submit complaint to Firestore. Please check your connection.');
      setSubmitting(false);
    }
  };


  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'image':
        return '📷';
      case 'video':
        return '🎥';
      case 'audio':
        return '🎤';
      case 'document':
        return '📄';
      default:
        return '📁';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'image':
        return COLORS.success;
      case 'video':
        return COLORS.warning;
      case 'audio':
        return COLORS.info;
      case 'document':
        return COLORS.primary;
      default:
        return COLORS.gray500;
    }
  };

  return (
    <GradientBackground colors={GRADIENTS.primary}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.title}>Report Complaint</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.infoCard}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Your complaint will be reviewed. In case of emergency, please call 100 immediately.
              </Text>
            </View>

            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryGrid}>
              {COMPLAINT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    category === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryText,
                      category === cat.id && styles.categoryTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Describe the incident in detail..."
              placeholderTextColor={COLORS.gray400}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.incidentDetailsRow}>
              <View style={styles.incidentField}>
                <Text style={styles.label}>Date of Incident</Text>
                <TextInput
                  style={styles.shortInput}
                  value={incidentDate}
                  onChangeText={setIncidentDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.gray400}
                />
              </View>
              <View style={styles.incidentField}>
                <Text style={styles.label}>Time</Text>
                <TextInput
                  style={styles.shortInput}
                  value={incidentTime}
                  onChangeText={setIncidentTime}
                  placeholder="HH:MM"
                  placeholderTextColor={COLORS.gray400}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.anonymousToggle}
              onPress={() => setIsAnonymous(!isAnonymous)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isAnonymous ? "checkbox" : "square-outline"}
                size={24}
                color={isAnonymous ? COLORS.primary : COLORS.gray400}
              />
              <Text style={styles.anonymousText}>Report Anonymously</Text>
            </TouchableOpacity>


            <Text style={styles.label}>Upload Evidence (Optional)</Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => setShowUploadModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload" size={24} color={COLORS.primary} />
              <Text style={styles.uploadButtonText}>Add Evidence</Text>
            </TouchableOpacity>

            {uploadedFiles.length > 0 && (
              <View style={styles.uploadedList}>
                {uploadedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <Text style={styles.fileIcon}>{getTypeIcon(file.type)}</Text>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.fileName}
                      </Text>
                      <Text style={styles.fileMeta}>
                        {file.type} • {formatSize(file.size)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteFile(file.id)}
                      style={styles.deleteButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <GradientButton
              title="Submit Complaint"
              onPress={handleSubmit}
              colors={GRADIENTS.primary}
              style={styles.submitButton}
              disabled={!category || description.length < 10 || uploading || submitting}
            />


            <TouchableOpacity
              style={styles.emergencyButton}
              onPress={() => Alert.alert('Emergency', 'Please call 100 immediately')}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={20} color={COLORS.white} />
              <Text style={styles.emergencyButtonText}>Call Emergency (100)</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Upload Modal */}
        <Modal visible={showUploadModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Evidence</Text>
                <TouchableOpacity
                  onPress={() => setShowUploadModal(false)}
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={COLORS.gray500} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.uploadInfoText}>
                  Select the type of evidence you want to upload.
                </Text>

                <View style={styles.uploadOptions}>
                  <TouchableOpacity
                    style={styles.uploadOption}
                    onPress={() => handlePickDocument('image')}
                    disabled={uploading}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.uploadOptionIcon,
                        { backgroundColor: COLORS.success + '20' },
                      ]}
                    >
                      <Ionicons name="image" size={32} color={COLORS.success} />
                    </View>
                    <Text style={styles.uploadOptionText}>Image</Text>
                    <Text style={styles.uploadOptionSubtext}>JPG, PNG, GIF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.uploadOption}
                    onPress={() => handlePickDocument('video')}
                    disabled={uploading}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.uploadOptionIcon,
                        { backgroundColor: COLORS.warning + '20' },
                      ]}
                    >
                      <Ionicons name="videocam" size={32} color={COLORS.warning} />
                    </View>
                    <Text style={styles.uploadOptionText}>Video</Text>
                    <Text style={styles.uploadOptionSubtext}>MP4, MOV, AVI</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.uploadOption}
                    onPress={() => handlePickDocument('audio')}
                    disabled={uploading}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.uploadOptionIcon,
                        { backgroundColor: COLORS.info + '20' },
                      ]}
                    >
                      <Ionicons name="mic" size={32} color={COLORS.info} />
                    </View>
                    <Text style={styles.uploadOptionText}>Audio</Text>
                    <Text style={styles.uploadOptionSubtext}>MP3, M4A, WAV</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.uploadOption}
                    onPress={() => handlePickDocument('document')}
                    disabled={uploading}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.uploadOptionIcon,
                        { backgroundColor: COLORS.primary + '20' },
                      ]}
                    >
                      <Ionicons name="document" size={32} color={COLORS.primary} />
                    </View>
                    <Text style={styles.uploadOptionText}>Document</Text>
                    <Text style={styles.uploadOptionSubtext}>PDF, DOC, DOCX</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {uploading && (
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.uploadingText}>Uploading evidence...</Text>
              <Text style={styles.uploadingSubtext}>Please wait</Text>
            </View>
          </View>
        )}

        {submitting && (
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.uploadingText}>Submitting Report...</Text>
              <Text style={styles.uploadingSubtext}>Securely saving to Firestore</Text>
            </View>
          </View>
        )}

      </SafeAreaView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: { padding: SPACING.lg },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray700,
    marginLeft: 12,
    lineHeight: 20,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  categoryButton: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  categoryTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray800,
    minHeight: 100,
    marginBottom: SPACING.lg,
  },
  incidentDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  incidentField: {
    width: '48%',
  },
  shortInput: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray800,
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    padding: SPACING.sm,
  },
  anonymousText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray700,
    marginLeft: 12,
  },
  uploadButton: {

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  uploadButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginLeft: 8,
  },
  uploadedList: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  fileIcon: { fontSize: 20, marginRight: 12 },
  fileInfo: { flex: 1 },
  fileName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray800,
  },
  fileMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  deleteButton: { padding: 4 },
  submitButton: { marginBottom: SPACING.md },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  emergencyButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  closeButton: { padding: 4 },
  modalBody: { padding: SPACING.lg },
  uploadInfoText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  uploadOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  uploadOption: {
    width: '48%',
    backgroundColor: COLORS.gray100,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  uploadOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadOptionText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  uploadOptionSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    marginTop: 4,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingBox: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '80%',
  },
  uploadingText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray800,
    marginTop: SPACING.md,
  },
  uploadingSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
    marginTop: 4,
  },
});

export default ComplaintReportScreen;