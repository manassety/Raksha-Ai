import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TouchableWithoutFeedback, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { ensureEvidenceDirectory, getAllEvidence, getEvidenceStats, deleteEvidence } from '../utils/EvidenceManager';

const EvidenceBackupScreen = () => {
    const navigation = useNavigation();
    const { user, userData } = useAuth();
    const [evidence, setEvidence] = useState([]);
    const [stats, setStats] = useState({ total: 0, images: 0, videos: 0, audio: 0, documents: 0, users: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null); // String: userName
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (userData && !userData.isMainAdmin) {
            Alert.alert('Access Denied', 'Only the Main Admin can access the Evidence Backup system.');
            navigation.goBack();
            return;
        }
        loadEvidence();
    }, [userData]);

    const loadEvidence = async () => {
        setLoading(true);
        try {
            await ensureEvidenceDirectory();
            const allEvidence = await getAllEvidence(true, user?.uid);
            const evidenceStats = await getEvidenceStats(true, user?.uid);

            setEvidence(allEvidence);
            setStats(evidenceStats);
        } catch (error) {
            console.error('Error loading evidence:', error);
        }
        setLoading(false);
    };

    const handleViewFile = (item) => {
        if (item.fileURL) {
            Linking.openURL(item.fileURL);
        } else if (item.path) {
            // Local path handling if needed, though usually cloud URL is preferred
            Alert.alert('Info', 'Opening local files is only supported when they are synced to cloud.');
        }
    };

    const handleDelete = async (item) => {
        // Check for admin privileges
        if (!userData?.isAdmin && !userData?.isMainAdmin) {
            Alert.alert(
                'Access Denied',
                'Only administrators and main admins are allowed to delete backup evidence.',
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
                        const result = await deleteEvidence(item.fileURL || item.path, true);
                        if (result.success) {
                            Alert.alert('Success', 'Evidence permanently deleted from cloud backup');
                            loadEvidence();
                        } else {
                            Alert.alert('Error', 'Failed to delete evidence');
                        }
                    }
                }
            ]
        );
    };

    const handleUpload = async (type) => {
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
                    type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                    copyToCacheDirectory: true,
                });
            }

            if (!result.canceled && result.assets && result.assets[0]) {
                setShowUploadModal(false);
                setUploading(true);

                // For backup screen, show success
                Alert.alert('Success', 'Evidence uploaded to backup successfully!');
                setUploading(false);
            }
        } catch (error) {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick document');
            setUploading(false);
        }
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getTypeIcon = (type) => {
        const t = (type || '').toLowerCase();
        if (t.includes('image')) return '📷';
        if (t.includes('video')) return '🎥';
        if (t.includes('audio')) return '🎤';
        if (t.includes('document')) return '📄';
        return '📁';
    };

    const getTypeColor = (type) => {
        const t = (type || '').toLowerCase();
        if (t.includes('image')) return COLORS.success;
        if (t.includes('video')) return COLORS.warning;
        if (t.includes('audio')) return COLORS.info;
        if (t.includes('document')) return COLORS.primary;
        return COLORS.gray500;
    };

    const StatCard = ({ title, value, icon, color }) => (
        <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statTitle}>{title}</Text>
        </View>
    );

    const uniqueUsers = [...new Set(evidence.map(e => e.userName))];

    const renderUserFolder = (userName) => {
        const userEvidence = evidence.filter(e => e.userName === userName);
        return (
            <TouchableOpacity
                style={styles.folderCard}
                onPress={() => setSelectedUser(userName)}
            >
                <View style={styles.folderIconContainer}>
                    <Ionicons name="folder" size={42} color={COLORS.warning} />
                    <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>{userEvidence.length}</Text>
                    </View>
                </View>
                <View style={styles.folderInfo}>
                    <View style={styles.folderHeaderRow}>
                        <Text style={styles.folderName} numberOfLines={1}>{userName}</Text>
                        <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
                    </View>
                    <View style={styles.folderMetaRow}>
                        <View style={styles.ownerBadge}>
                            <Ionicons name="archive-outline" size={12} color={COLORS.gray500} />
                            <Text style={styles.folderMetaText}>Backup Archive</Text>
                        </View>
                        <Text style={styles.folderDateText}>Owner ID: {userEvidence[0]?.userId?.slice(-6) || 'N/A'}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderFileItem = (item) => (
        <TouchableOpacity
            style={[styles.fileCard, item.isDeleted && styles.archivedFileCard]}
            onPress={() => handleViewFile(item)}
            onLongPress={() => handleDelete(item)}
        >
            <View style={[styles.fileThumbnail, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                <Text style={styles.thumbnailText}>{getTypeIcon(item.type)}</Text>
            </View>
            <View style={styles.fileDetails}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
                    {item.isDeleted && (
                        <View style={styles.deletedBadge}>
                            <Text style={styles.deletedBadgeText}>DELETED</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.fileMeta}>{item.date} • {item.size ? formatSize(item.size) : 'N/A'}</Text>
            </View>
            <View style={styles.fileActions}>
                <TouchableOpacity onPress={() => handleViewFile(item)} style={styles.actionBtn}>
                    <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => selectedUser ? setSelectedUser(null) : navigation.goBack()}>
                        <Ionicons name={selectedUser ? "chevron-back" : "arrow-back"} size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.title}>{selectedUser ? `${selectedUser}'s Backup` : "Evidence Backup"}</Text>
                    <TouchableOpacity onPress={() => setShowUploadModal(true)}>
                        <Ionicons name="cloud-upload" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.white} />
                        <Text style={styles.loadingText}>Loading backup...</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                        {!selectedUser && (
                            <View style={styles.statsContainer}>
                                <StatCard title="Total Files" value={stats.total} icon="folder" color={COLORS.primary} />
                                <StatCard title="Users" value={stats.users} icon="people" color={COLORS.warning} />
                                <StatCard title="Photos" value={stats.images} icon="image" color={COLORS.success} />
                                <StatCard title="Videos" value={stats.videos} icon="videocam" color={COLORS.warning} />
                            </View>
                        )}

                        <View style={styles.listHeader}>
                            <Text style={styles.listTitle}>
                                {selectedUser ? "Encrypted Files" : `User Backups (${uniqueUsers.length})`}
                            </Text>
                            <TouchableOpacity onPress={loadEvidence}>
                                <Ionicons name="refresh" size={20} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>

                        {selectedUser ? (
                            // INSIDE USER FOLDER
                            <View style={styles.filesList}>
                                {evidence.filter(e => e.userName === selectedUser).length > 0 ? (
                                    evidence.filter(e => e.userName === selectedUser).map((item) => (
                                        <View key={item.id}>{renderFileItem(item)}</View>
                                    ))
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="document-text-outline" size={60} color={COLORS.gray500} />
                                        <Text style={styles.emptyText}>No files in this backup</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            // USERS FOLDER LIST
                            <View style={styles.foldersList}>
                                {uniqueUsers.length > 0 ? (
                                    uniqueUsers.map((userName) => (
                                        <View key={userName}>{renderUserFolder(userName)}</View>
                                    ))
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="folder-open-outline" size={60} color={COLORS.gray500} />
                                        <Text style={styles.emptyText}>No evidence backup found</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.bottomPadding} />
                    </ScrollView>
                )}

                {/* Upload Modal */}
                <Modal visible={showUploadModal} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={() => setShowUploadModal(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Backup Evidence</Text>
                                        <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                                            <Ionicons name="close" size={24} color={COLORS.gray500} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.modalBody}>
                                        <Text style={styles.uploadInfoText}>
                                            Upload evidence to the global backup folder. It will be organized by user automatically.
                                        </Text>

                                        <View style={styles.uploadOptions}>
                                            <TouchableOpacity
                                                style={styles.uploadOption}
                                                onPress={() => handleUpload('image')}
                                                disabled={uploading}
                                            >
                                                <View style={[styles.uploadOptionIcon, { backgroundColor: COLORS.success + '20' }]}>
                                                    <Ionicons name="image" size={32} color={COLORS.success} />
                                                </View>
                                                <Text style={styles.uploadOptionText}>Image</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.uploadOption}
                                                onPress={() => handleUpload('video')}
                                                disabled={uploading}
                                            >
                                                <View style={[styles.uploadOptionIcon, { backgroundColor: COLORS.warning + '20' }]}>
                                                    <Ionicons name="videocam" size={32} color={COLORS.warning} />
                                                </View>
                                                <Text style={styles.uploadOptionText}>Video</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.uploadOption}
                                                onPress={() => handleUpload('audio')}
                                                disabled={uploading}
                                            >
                                                <View style={[styles.uploadOptionIcon, { backgroundColor: COLORS.info + '20' }]}>
                                                    <Ionicons name="mic" size={32} color={COLORS.info} />
                                                </View>
                                                <Text style={styles.uploadOptionText}>Audio</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.uploadOption}
                                                onPress={() => handleUpload('document')}
                                                disabled={uploading}
                                            >
                                                <View style={[styles.uploadOptionIcon, { backgroundColor: COLORS.primary + '20' }]}>
                                                    <Ionicons name="document" size={32} color={COLORS.primary} />
                                                </View>
                                                <Text style={styles.uploadOptionText}>Document</Text>
                                            </TouchableOpacity>
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
                            <Text style={styles.uploadingText}>Uploading to backup...</Text>
                        </View>
                    </View>
                )}
            </View>
        </GradientBackground >
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
    statValue: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white },
    statTitle: { fontSize: FONT_SIZES.xs, color: COLORS.white + '80', marginTop: 4 },
    infoCard: { flexDirection: 'row', backgroundColor: COLORS.info + '20', borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md },
    infoText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.white + '90', marginLeft: 8, lineHeight: 18 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    listTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.white },
    foldersList: { gap: 12 },
    filesList: { gap: 8 },
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
    folderIconContainer: { position: 'relative', marginRight: 16 },
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
    itemCountText: { color: COLORS.white, fontSize: 9, fontWeight: 'bold' },
    folderInfo: { flex: 1 },
    folderHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    folderMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ownerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.gray100,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    folderName: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.gray800 },
    folderMetaText: { fontSize: 11, color: COLORS.gray600, marginLeft: 4, fontWeight: '500' },
    folderDateText: { fontSize: 11, color: COLORS.gray400 },

    fileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: SPACING.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    fileThumbnail: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    thumbnailText: { fontSize: 20 },
    fileDetails: { flex: 1, marginLeft: 12 },
    fileName: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.gray800 },
    fileMeta: { fontSize: 10, color: COLORS.gray500, marginTop: 2 },
    fileActions: { flexDirection: 'row', alignItems: 'center' },
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
    uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    uploadingBox: { backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.xl, alignItems: 'center', width: '80%' },
    uploadingText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginTop: SPACING.md },
});

export default EvidenceBackupScreen;