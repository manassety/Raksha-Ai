import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureEvidenceDirectory,
  saveEvidence,
  getAllEvidence,
  getEvidenceStats,
  deleteEvidence,
} from '../utils/EvidenceManager';
import { getAuth } from 'firebase/auth';

const EvidenceGalleryScreen = () => {
  const navigation = useNavigation();
  const { user, userData } = useAuth();
  const [evidence, setEvidence] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [stats, setStats] = useState({ total: 0, images: 0, videos: 0, audio: 0, documents: 0, users: 0 });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('all');
  const [uniqueUsers, setUniqueUsers] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');

  useEffect(() => {
    loadEvidence();
  }, []);

  const groupIntoFolders = (allEvidence) => {
    const folderMap = {};

    allEvidence.forEach(item => {
      const categoryLabel = item.category || 'General';
      const folderId = `${item.userName}_${categoryLabel}`.replace(/\s+/g, '_');

      if (!folderMap[folderId]) {
        folderMap[folderId] = {
          id: folderId,
          userName: item.userName,
          category: categoryLabel,
          items: [],
          lastUpdated: item.timestamp,
        };
      }
      folderMap[folderId].items.push(item);
    });

    return Object.values(folderMap).sort((a, b) => b.lastUpdated - a.lastUpdated);
  };

  const loadEvidence = async () => {
    setLoading(true);
    try {
      await ensureEvidenceDirectory();
      const allEvidence = await getAllEvidence();
      const evidenceStats = await getEvidenceStats();

      console.log('✅ Loaded Evidence into Gallery:', allEvidence.length, 'items');

      const grouped = groupIntoFolders(allEvidence);
      setFolders(grouped);
      setEvidence(allEvidence.reverse());
      setStats(evidenceStats);

      const users = [...new Set(allEvidence.map(e => e.userName))];
      setUniqueUsers(users);
    } catch (error) {
      console.error('Error loading evidence:', error);
    }
    setLoading(false);
  };

  const handlePickDocument = async (type) => {
    try {
      let result;
      const options = {
        copyToCacheDirectory: true,
      };

      if (type === 'image') result = await DocumentPicker.getDocumentAsync({ ...options, type: 'image/*' });
      else if (type === 'video') result = await DocumentPicker.getDocumentAsync({ ...options, type: 'video/*' });
      else if (type === 'audio') result = await DocumentPicker.getDocumentAsync({ ...options, type: 'audio/*' });
      else if (type === 'document') {
        result = await DocumentPicker.getDocumentAsync({
          ...options,
          type: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        setShowUploadModal(false);
        setUploading(true);

        const fileInfo = result.assets[0];
        const auth = getAuth();
        const currentUser = auth.currentUser;

        // Use folder context if uploading from inside a folder, otherwise use current user
        let targetUserName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Unknown';
        let targetCategory = null;
        let targetSource = 'manual';

        if (selectedFolderId) {
          const folder = folders.find(f => f.id === selectedFolderId);
          if (folder) {
            targetUserName = folder.userName;
            targetCategory = folder.category === 'General' ? null : folder.category;
            targetSource = 'collaborative';
          }
        }

        const saveResult = await saveEvidence(targetUserName, fileInfo, type, null, targetCategory, targetSource);

        if (saveResult.success) {
          Alert.alert('Success', 'Evidence uploaded successfully!');
          loadEvidence();
        } else {
          Alert.alert('Error', saveResult.error || 'Failed to save evidence');
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
    setUploading(false);
  };

  const handleDelete = (item) => {
    // Check for admin privileges
    if (!userData?.isAdmin && !userData?.isMainAdmin) {
      Alert.alert(
        'Access Denied',
        'Only administrators and main admins are allowed to delete evidence.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Evidence',
      `Are you sure you want to delete "${item.fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteEvidence(item.fileURL);
            if (result.success) {
              Alert.alert('Success', 'Evidence deleted successfully');
              loadEvidence();
            } else {
              Alert.alert('Error', 'Failed to delete evidence');
            }
          },
        },
      ]
    );
  };

  const handleViewFile = (item) => {
    if (item.fileURL) {
      Linking.openURL(item.fileURL);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'image': return '📷';
      case 'video': return '🎥';
      case 'audio': return '🎤';
      case 'document': return '📄';
      default: return '📁';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'image': return COLORS.success;
      case 'video': return COLORS.warning;
      case 'audio': return COLORS.info;
      case 'document': return COLORS.primary;
      default: return COLORS.gray500;
    }
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'sos': return '🚨';
      case 'complaint': return '📝';
      case 'manual': return '📤';
      case 'collaborative': return '👥';
      default: return '📁';
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredFolders = folders.filter((folder) => {
    const userMatch = selectedUser === 'all' || folder.userName === selectedUser;
    return userMatch;
  });

  const currentFolder = folders.find(f => f.id === selectedFolderId);

  const StatCard = ({ title, value }) => (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const renderFolderItem = (folder) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => setSelectedFolderId(folder.id)}
    >
      <View style={styles.folderIconContainer}>
        <Ionicons name="folder" size={48} color={COLORS.warning} />
        <View style={styles.itemCountBadge}>
          <Text style={styles.itemCountText}>{folder.items.length}</Text>
        </View>
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName} numberOfLines={1}>{folder.userName} - {folder.category}</Text>
        <Text style={styles.folderMeta}>Owner: {folder.userName}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEvidenceItem = ({ item }) => (
    <TouchableOpacity
      style={styles.evidenceCard}
      onLongPress={() => handleDelete(item)}
      onPress={() => handleViewFile(item)}
    >
      <View style={[styles.evidenceThumbnail, { backgroundColor: getTypeColor(item.type) + '20' }]}>
        <Text style={styles.thumbnailText}>{getTypeIcon(item.type)}</Text>
      </View>
      <View style={styles.evidenceInfo}>
        <Text style={styles.evidenceFileName} numberOfLines={1}>{item.fileName}</Text>
        <View style={styles.evidenceMeta}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: getTypeColor(item.type) }]}>{item.type}</Text>
          </View>
          <Text style={styles.evidenceSize}>{item.size ? formatSize(item.size) : ''}</Text>
        </View>
        <View style={styles.evidenceFooter}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>{getSourceIcon(item.source)}</Text>
            <Text style={styles.sourceText}>{item.source}</Text>
          </View>
        </View>
      </View>
      <View style={styles.evidenceActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleViewFile(item)}>
          <Ionicons name="open-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        {(userData?.isAdmin || userData?.isMainAdmin) && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <GradientBackground colors={GRADIENTS.dark}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => selectedFolderId ? setSelectedFolderId(null) : navigation.goBack()}>
            <Ionicons name={selectedFolderId ? "chevron-back" : "arrow-back"} size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{selectedFolderId ? "Folder Items" : "Evidence Gallery"}</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => setShowUploadModal(true)}>
            <Ionicons name="cloud-upload" size={26} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.white} />
            <Text style={styles.loadingText}>Loading evidence...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {!selectedFolderId && (
              <View style={styles.statsContainer}>
                <StatCard title="Total" value={stats.total} />
                <StatCard title="Folders" value={folders.length} />
                <StatCard title="Videos" value={stats.videos} />
                <StatCard title="Docs" value={stats.documents} />
              </View>
            )}

            {!selectedFolderId ? (
              <>
                {uniqueUsers.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterLabel}>Filter by Case Owner:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <TouchableOpacity
                        style={[styles.filterChip, selectedUser === 'all' && styles.filterChipActive]}
                        onPress={() => setSelectedUser('all')}
                      >
                        <Text style={[styles.filterChipText, selectedUser === 'all' && styles.filterChipTextActive]}>All Cases</Text>
                      </TouchableOpacity>
                      {uniqueUsers.map((userName, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[styles.filterChip, selectedUser === userName && styles.filterChipActive]}
                          onPress={() => setSelectedUser(userName)}
                        >
                          <Text style={[styles.filterChipText, selectedUser === userName && styles.filterChipTextActive]}>{userName}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>Case Folders ({filteredFolders.length})</Text>
                  <TouchableOpacity onPress={loadEvidence}><Ionicons name="refresh" size={20} color={COLORS.white} /></TouchableOpacity>
                </View>

                <View style={styles.foldersGrid}>
                  {filteredFolders.map(folder => <View key={folder.id}>{renderFolderItem(folder)}</View>)}
                </View>

                {filteredFolders.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="folder-open-outline" size={60} color={COLORS.gray500} />
                    <Text style={styles.emptyText}>No cases found</Text>
                  </View>
                )}
              </>
            ) : (
              // INSIDE FOLDER VIEW
              <>
                <View style={styles.folderHeaderInfo}>
                  <Ionicons name="folder-open" size={40} color={COLORS.warning} />
                  <View style={styles.folderHeaderText}>
                    <Text style={styles.folderTitleText}>{currentFolder?.userName} - {currentFolder?.category}</Text>
                    <Text style={styles.folderSubtitleText}>Collaborative evidence for this case</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.collaborativeUploadBtn}
                  onPress={() => setShowUploadModal(true)}
                >
                  <Ionicons name="add-circle" size={24} color={COLORS.white} />
                  <Text style={styles.collaborativeUploadBtnText}>Add evidence to this case</Text>
                </TouchableOpacity>

                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>Files ({currentFolder?.items.length})</Text>
                </View>

                {currentFolder?.items.map((item) => <View key={item.id}>{renderEvidenceItem({ item })}</View>)}
              </>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        )}

        <Modal visible={showUploadModal} animationType="slide" transparent>
          <TouchableWithoutFeedback onPress={() => setShowUploadModal(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {selectedFolderId ? "Add to Case" : "Upload Evidence"}
                    </Text>
                    <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                      <Ionicons name="close" size={24} color={COLORS.gray500} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.modalBody}>
                    <Text style={styles.uploadInfoText}>
                      {selectedFolderId
                        ? `This will add a file to the folder of ${currentFolder?.userName}.`
                        : "Upload evidence to organize it into folders automatically."}
                    </Text>
                    <View style={styles.uploadOptions}>
                      {['image', 'video', 'audio', 'document'].map(type => (
                        <TouchableOpacity key={type} style={styles.uploadOption} onPress={() => handlePickDocument(type)} disabled={uploading}>
                          <View style={[styles.uploadOptionIcon, { backgroundColor: getTypeColor(type) + '20' }]}>
                            <Ionicons name={type === 'document' ? 'document' : type === 'image' ? 'image' : type === 'video' ? 'videocam' : 'mic'} size={32} color={getTypeColor(type)} />
                          </View>
                          <Text style={styles.uploadOptionText}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {uploading && (
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          </View>
        )}
      </View>
    </GradientBackground>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  uploadBtn: { padding: 4 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.white, marginTop: SPACING.md, fontSize: FONT_SIZES.md },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white + '10',
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  statTitle: { fontSize: FONT_SIZES.xs, color: COLORS.white + '80', marginTop: 4 },

  // Folders UI
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: SPACING.md,
  },
  folderCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  folderIconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  itemCountBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  itemCountText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  folderInfo: {
    alignItems: 'center',
    width: '100%',
  },
  folderName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.gray800,
    textAlign: 'center',
  },
  folderMeta: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: 2,
  },

  // Inside Folder UI
  folderHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white + '15',
    padding: SPACING.md,
    borderRadius: 16,
    marginBottom: SPACING.md,
  },
  folderHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  folderTitleText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  folderSubtitleText: {
    color: COLORS.white + '70',
    fontSize: FONT_SIZES.xs,
  },
  collaborativeUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.lg,
  },
  collaborativeUploadBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  filterSection: { marginBottom: SPACING.md },
  filterLabel: { fontSize: FONT_SIZES.sm, color: COLORS.white + '80', marginBottom: 8 },
  filterChip: { backgroundColor: COLORS.white + '20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { color: COLORS.white + '80', fontSize: FONT_SIZES.sm },
  filterChipTextActive: { color: COLORS.white, fontWeight: '600' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  listTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.white },
  evidenceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md, marginBottom: 8 },
  evidenceThumbnail: { width: 50, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  thumbnailText: { fontSize: 24 },
  evidenceInfo: { flex: 1, marginLeft: 12 },
  evidenceFileName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
  evidenceMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600', textTransform: 'capitalize' },
  evidenceSize: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginLeft: 8 },
  evidenceFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  userBadge: { flexDirection: 'row', alignItems: 'center' },
  userNameText: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginLeft: 4 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  sourceText: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginLeft: 4 },
  evidenceActions: { flexDirection: 'row' },
  actionBtn: { padding: 8 },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.white, marginTop: SPACING.md },
  emptySubtext: { fontSize: FONT_SIZES.sm, color: COLORS.white + '60', marginTop: 4 },
  bottomPadding: { height: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800 },
  modalBody: { padding: SPACING.lg },
  uploadInfoText: { fontSize: FONT_SIZES.md, color: COLORS.gray600, marginBottom: SPACING.lg, lineHeight: 20 },
  uploadOptions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  uploadOption: { width: '48%', backgroundColor: COLORS.gray100, borderRadius: 16, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
  uploadOptionIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadOptionText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
  uploadOptionSubtext: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginTop: 4 },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  uploadingBox: { backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.xl, alignItems: 'center', width: '80%' },
  uploadingText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginTop: SPACING.md },
  uploadingSubtext: {
    fontSize: FONT_SIZES.sm, color: COLORS.gray500, marginTop: 4,
  }
});

export default EvidenceGalleryScreen;