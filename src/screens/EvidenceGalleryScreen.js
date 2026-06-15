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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureEvidenceDirectory,
  saveEvidence,
  getEvidenceStats,
  deleteEvidence,
  cleanupStaleEvidence,
  subscribeToEvidence,
  retryUploadEvidence,
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

  // Folder Lock State
  const [folderToUnlock, setFolderToUnlock] = useState(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');

  useEffect(() => {
    let unsubscribe = () => { };
    setLoading(true);

    const setupListener = async () => {
      await ensureEvidenceDirectory();
      const isAdminUser = userData?.isAdmin || userData?.isMainAdmin;

      unsubscribe = subscribeToEvidence((allEvidence) => {
        // Handle incoming real-time data
        const evidenceToShow = [...allEvidence].reverse();
        console.log('🔄 Real-time Evidence Update:', evidenceToShow.length, 'total items');

        const grouped = groupIntoFolders(allEvidence);
        setFolders(grouped);
        setEvidence(evidenceToShow);

        // Refresh stats separately
        loadEvidence();

        const users = [...new Set(allEvidence.map(e => e.userName))];
        setUniqueUsers(users);
        setLoading(false);
      }, isAdminUser, user?.uid);
    };

    setupListener();

    return () => unsubscribe();
  }, [user, userData]);

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const isAdminUser = userData?.isAdmin || userData?.isMainAdmin;
      const evidenceStats = await getEvidenceStats(isAdminUser, user?.uid);
      setStats(evidenceStats);
    } catch (error) {
      console.error('Error loading evidence stats:', error);
    }
    setLoading(false);
  };

  const groupIntoFolders = (allEvidence) => {
    const folderMap = {};

    allEvidence.forEach(item => {
      const folderId = item.userName || 'Unknown_User';

      if (!folderMap[folderId]) {
        folderMap[folderId] = {
          id: folderId,
          userName: item.userName,
          ownerId: item.userId,
          items: [],
          lastUpdated: item.timestamp,
        };
      }
      folderMap[folderId].items.push(item);

      const itemTime = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      const currentFolderTime = folderMap[folderId].lastUpdated?.toDate ? folderMap[folderId].lastUpdated.toDate() : new Date(folderMap[folderId].lastUpdated);

      if (itemTime > currentFolderTime) {
        folderMap[folderId].lastUpdated = item.timestamp;
      }
    });

    return Object.values(folderMap).sort((a, b) => {
      const timeA = a.lastUpdated?.toDate ? a.lastUpdated.toDate() : new Date(a.lastUpdated);
      const timeB = b.lastUpdated?.toDate ? b.lastUpdated.toDate() : new Date(b.lastUpdated);
      return timeB - timeA;
    });
  };

  const filteredEvidence = evidence.filter(item => {
    const userMatch = selectedUser === 'all' || item.userName === selectedUser;
    const sourceMatch = selectedSource === 'all' || item.source === selectedSource;
    return userMatch && sourceMatch;
  });

  const handlePickDocument = async (type) => {
    try {
      let result;
      const options = { copyToCacheDirectory: true };

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
    if (!userData?.isAdmin && !userData?.isMainAdmin) {
      Alert.alert('Access Denied', 'Only administrators are allowed to delete evidence.');
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
    } else if (item.localUri) {
      Linking.openURL(item.localUri);
    } else {
      Alert.alert("Error", "File not found locally or in cloud.");
    }
  };

  const handleDownload = (item) => {
    if (item.status === 'queued') {
      Alert.alert("Queued File", "This file is waiting to be uploaded to the cloud.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save to Device",
          onPress: async () => {
            try {
              const isAvailable = await Sharing.isAvailableAsync();
              if (isAvailable && item.localUri) {
                await Sharing.shareAsync(item.localUri);
              } else {
                Alert.alert("Error", "File not found locally or sharing unavailable.");
              }
            } catch (err) {
              console.log("Share err:", err);
            }
          }
        },
        {
          text: "Upload Now", onPress: async () => {
            const res = await retryUploadEvidence(item);
            if (res.success) {
              Alert.alert("Success", "File uploaded successfully!");
              loadEvidence();
            } else {
              Alert.alert("Upload Failed", res.error || "Check your internet and Firebase rules.");
            }
          }
        }
      ]);
      return;
    }

    if (item.status === 'uploading' || !item.fileURL) {
      Alert.alert("Pending Sync", `This file is currently ${item.status || 'offline'} and is already saved locally on your device.`);
      return;
    }

    Alert.alert(
      "Download Evidence",
      "Open file in browser to download? Once downloaded, it will be removed from the cloud.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download & Remove", onPress: async () => {
            Linking.openURL(item.fileURL);
            await deleteEvidence(item.fileURL, true);
            loadEvidence();
          }
        }
      ]
    );
  };

  const handleSyncCloud = async () => {
    if (!userData?.isAdmin && !userData?.isMainAdmin) return;
    Alert.alert(
      "Cloud Sync",
      "Scan and remove evidence records that are missing from cloud storage?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Sync", onPress: async () => {
            setLoading(true);
            const res = await cleanupStaleEvidence();
            setLoading(false);
            if (res.success) {
              Alert.alert("Sync Complete", `Pruned ${res.pruned} dead asset records.`);
            } else {
              Alert.alert("Sync Error", res.error);
            }
          }
        }
      ]
    );
  };

  const handleDownloadFolder = async () => {
    if (!currentFolder || currentFolder.items.length === 0) return;
    Alert.alert(
      "Download Folder",
      "Download all files? This will remove them from the cloud.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download & Remove", onPress: async () => {
            for (const item of currentFolder.items) {
              if (item.fileURL) {
                Linking.openURL(item.fileURL);
                await deleteEvidence(item.fileURL, true);
              }
            }
            loadEvidence();
          }
        }
      ]);
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
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredFolders = folders.filter((folder) => {
    const userMatch = selectedUser === 'all' || folder.userName === selectedUser;
    return userMatch;
  });

  const currentFolder = folders.find(f => f.id === selectedFolderId);

  const StatCard = ({ title, value, icon, color }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const renderUserFolder = (folder) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => setFolderToUnlock(folder.id)}
    >
      <View style={styles.folderIconContainer}>
        <Ionicons name="folder" size={42} color={COLORS.warning} />
        <View style={styles.itemCountBadge}>
          <Text style={styles.itemCountText}>{folder.items.length}</Text>
        </View>
      </View>
      <View style={styles.folderInfo}>
        <View style={styles.folderHeaderRow}>
          <Text style={styles.folderName} numberOfLines={1}>{folder.userName}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
        </View>
        <View style={styles.folderMetaRow}>
          <View style={styles.ownerBadge}>
            <Ionicons name="person-outline" size={12} color={COLORS.gray500} />
            <Text style={styles.folderMetaText}>Case Files</Text>
          </View>
          <Text style={styles.folderDateText}>Owner ID: {folder.ownerId?.slice(-6) || 'N/A'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEvidenceItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.evidenceCard, item.isDeleted && styles.archivedFileCard]}
      onLongPress={() => handleDelete(item)}
      onPress={() => handleViewFile(item)}
    >
      <View style={[styles.evidenceThumbnail, { backgroundColor: getTypeColor(item.type) + '20' }]}>
        <Text style={styles.thumbnailText}>{getTypeIcon(item.type)}</Text>
      </View>
      <View style={styles.evidenceInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.evidenceFileName} numberOfLines={1}>{item.fileName}</Text>
          {item.isDeleted && (
            <View style={styles.deletedBadge}>
              <Text style={styles.deletedBadgeText}>ARCHIVED</Text>
            </View>
          )}
        </View>
        <View style={styles.evidenceMeta}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: getTypeColor(item.type) }]}>{item.type}</Text>
          </View>
          <Text style={styles.evidenceSize}>{item.date} • {item.size ? formatSize(item.size) : 'N/A'}</Text>
        </View>
        <View style={styles.evidenceFooter}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>{getSourceIcon(item.source)}</Text>
            <Text style={styles.sourceText}>{item.source}</Text>
          </View>

          {item.status === 'uploading' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <ActivityIndicator size="small" color={COLORS.warning} />
              <Text style={{ fontSize: 10, color: COLORS.warning, marginLeft: 4, fontWeight: 'bold' }}>Uploading...</Text>
            </View>
          )}

          {item.status === 'queued' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <Ionicons name="cloud-offline" size={12} color={COLORS.danger} />
              <Text style={{ fontSize: 10, color: COLORS.danger, marginLeft: 4, fontWeight: 'bold' }}>Queued</Text>
            </View>
          )}

          {item.status === 'success' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <Ionicons name="cloud-done" size={12} color={COLORS.success} />
            </View>
          )}
        </View>
      </View>
      <View style={styles.evidenceActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleViewFile(item)}>
          <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        {item.fileURL ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(item)}>
            <Ionicons name="download-outline" size={20} color={COLORS.success} />
          </TouchableOpacity>
        ) : item.status === 'queued' ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(item)}>
            <Ionicons name="cloud-upload" size={20} color={COLORS.warning} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(item)}>
            <Ionicons name="phone-portrait-outline" size={20} color={COLORS.gray500} />
          </TouchableOpacity>
        )}

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
          <View style={{ flexDirection: 'row' }}>
            {(userData?.isAdmin || userData?.isMainAdmin) && !selectedFolderId && (
              <TouchableOpacity style={[styles.uploadBtn, { marginRight: 15 }]} onPress={handleSyncCloud}>
                <Ionicons name="refresh-circle" size={26} color={COLORS.success} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.uploadBtn} onPress={() => setShowUploadModal(true)}>
              <Ionicons name="cloud-upload" size={26} color={COLORS.white} />
            </TouchableOpacity>
          </View>
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
                <StatCard title="Total" value={stats.total} icon="folder" color={COLORS.primary} />
                <StatCard title="Folders" value={folders.length} icon="people" color={COLORS.warning} />
                <StatCard title="Videos" value={stats.videos} icon="videocam" color={COLORS.warning} />
                <StatCard title="Docs" value={stats.documents} icon="document" color={COLORS.info} />
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
                  {filteredFolders.map(folder => <View key={folder.id}>{renderUserFolder(folder)}</View>)}
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
                    <Text style={styles.folderTitleText}>{currentFolder?.userName}</Text>
                    <Text style={styles.folderSubtitleText}>All evidence for this case owner</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.collaborativeUploadBtn}
                  onPress={() => setShowUploadModal(true)}
                >
                  <Ionicons name="add-circle" size={24} color={COLORS.white} />
                  <Text style={styles.collaborativeUploadBtnText}>Add evidence to this case</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.collaborativeUploadBtn, { backgroundColor: COLORS.success, marginTop: -8 }]}
                  onPress={handleDownloadFolder}
                >
                  <Ionicons name="download" size={24} color={COLORS.white} />
                  <Text style={styles.collaborativeUploadBtnText}>Download Case Folder</Text>
                </TouchableOpacity>

                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>Files ({currentFolder?.items.length || 0})</Text>
                </View>

                {currentFolder?.items.length > 0 ? (
                  currentFolder.items.map((item) => <View key={item.id}>{renderEvidenceItem({ item })}</View>)
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={60} color={COLORS.gray500} />
                    <Text style={styles.emptyText}>No files in this case</Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        )}

        <Modal visible={!!folderToUnlock} animationType="fade" transparent>
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadingBox}>
              <Ionicons name="lock-closed" size={40} color={COLORS.danger} />
              <Text style={styles.uploadingText}>Folder Locked</Text>
              <Text style={styles.uploadingSubtext}>Enter Safety PIN or Admin Password</Text>
              <TextInput
                style={{ width: '100%', marginTop: 15, textAlign: 'center', backgroundColor: COLORS.gray100, padding: 12, borderRadius: 8, fontSize: FONT_SIZES.lg, color: COLORS.gray800 }}
                secureTextEntry
                placeholder="PIN / Password"
                placeholderTextColor={COLORS.gray400}
                value={unlockPin}
                onChangeText={(text) => { setUnlockPin(text); setUnlockError(''); }}
                autoCapitalize="none"
              />
              {unlockError ? <Text style={{ color: COLORS.danger, marginTop: 5 }}>{unlockError}</Text> : null}

              <View style={{ flexDirection: 'row', marginTop: 20, justifyContent: 'space-between', width: '100%' }}>
                <TouchableOpacity onPress={() => { setFolderToUnlock(null); setUnlockPin(''); setUnlockError(''); }} style={{ padding: 10, flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.gray500, fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  const userPin = userData?.safetyPIN || userData?.safetyPin || userData?.pin;
                  if (unlockPin === 'man*dep#2005' || (userPin && unlockPin === userPin)) {
                    setSelectedFolderId(folderToUnlock);
                    setFolderToUnlock(null);
                    setUnlockPin('');
                    setUnlockError('');
                  } else {
                    setUnlockError('Incorrect PIN or Password');
                  }
                }} style={{ backgroundColor: COLORS.primary, padding: 10, flex: 1, borderRadius: 8, alignItems: 'center', marginLeft: 10 }}>
                  <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
    borderRadius: 16,
    padding: SPACING.md,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  statTitle: { fontSize: FONT_SIZES.xs, color: COLORS.white + '80', marginTop: 4 },

  foldersGrid: {
    paddingBottom: SPACING.md,
    gap: 12,
  },
  folderCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 4
  },
  folderIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  itemCountBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  itemCountText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: 'bold',
  },
  folderInfo: {
    flex: 1,
  },
  folderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  folderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  folderName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  folderMetaText: {
    fontSize: 11,
    color: COLORS.gray600,
    marginLeft: 4,
    fontWeight: '500',
  },
  folderDateText: {
    fontSize: 11,
    color: COLORS.gray400,
  },

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
  evidenceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, marginBottom: 8 },
  evidenceThumbnail: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  thumbnailText: { fontSize: 20 },
  evidenceInfo: { flex: 1, marginLeft: 12 },
  evidenceFileName: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.gray800 },
  evidenceMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 8, fontWeight: '600', textTransform: 'capitalize' },
  evidenceSize: { fontSize: 10, color: COLORS.gray500, marginLeft: 8 },
  evidenceFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  userBadge: { flexDirection: 'row', alignItems: 'center' },
  userNameText: { fontSize: 11, color: COLORS.gray500, marginLeft: 4 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  sourceText: { fontSize: 11, color: COLORS.gray500, marginLeft: 4 },
  evidenceActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 4 },
  archivedFileCard: { backgroundColor: COLORS.gray100, opacity: 0.8 },
  deletedBadge: {
    backgroundColor: COLORS.danger + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: COLORS.danger + '40'
  },
  deletedBadgeText: { fontSize: 8, fontWeight: 'bold', color: COLORS.danger },
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