import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList, Modal, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { ensureEvidenceDirectory, getAllEvidence, getEvidenceStats, deleteEvidence } from '../utils/EvidenceManager';
import * as FileSystem from 'expo-file-system';

const EVIDENCE_BASE_DIR = FileSystem.documentDirectory + 'evidence/';

const EvidenceBackupScreen = () => {
    const navigation = useNavigation();
    const { user, userData } = useAuth();
    const [evidence, setEvidence] = useState([]);
    const [stats, setStats] = useState({ total: 0, images: 0, videos: 0, audio: 0, documents: 0, users: 0 });
    const [loading, setLoading] = useState(true);
    const [expandedUsers, setExpandedUsers] = useState({});
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedUserFolder, setSelectedUserFolder] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [selectedType, setSelectedType] = useState('image');

    useEffect(() => {
        // Restricted to Main Admin
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
            const allEvidence = await getAllEvidence();
            const evidenceStats = await getEvidenceStats();

            setEvidence(allEvidence);
            setStats(evidenceStats);
        } catch (error) {
            console.error('Error loading evidence:', error);
        }
        setLoading(false);
    };

    const loadFolderStructure = async () => {
        try {
            const structure = [];
            const dirInfo = await FileSystem.getInfoAsync(EVIDENCE_BASE_DIR);

            if (dirInfo.exists) {
                const users = await FileSystem.readDirectoryAsync(EVIDENCE_BASE_DIR);

                for (const userName of users) {
                    const userPath = EVIDENCE_BASE_DIR + userName + '/';
                    const userDirInfo = await FileSystem.getInfoAsync(userPath);

                    if (userDirInfo.exists) {
                        const types = await FileSystem.readDirectoryAsync(userPath);
                        const userEvidence = [];

                        for (const type of types) {
                            const typePath = userPath + type + '/';
                            const typeDirInfo = await FileSystem.getInfoAsync(typePath);

                            if (typeDirInfo.exists) {
                                const files = await FileSystem.readDirectoryAsync(typePath);

                                for (const file of files) {
                                    const filePath = typePath + file;
                                    const fileInfo = await FileSystem.getInfoAsync(filePath);

                                    userEvidence.push({
                                        id: filePath,
                                        type: type.replace('/', ''),
                                        fileName: file,
                                        path: filePath,
                                        size: fileInfo.size,
                                        modificationTime: fileInfo.modificationTime
                                    });
                                }
                            }
                        }

                        structure.push({
                            userName: userName,
                            evidence: userEvidence,
                            totalFiles: userEvidence.length,
                            expanded: expandedUsers[userName] || false
                        });
                    }
                }
            }

            return structure;
        } catch (error) {
            console.error('Error loading folder structure:', error);
            return [];
        }
    };

    const toggleUserExpansion = (userName) => {
        setExpandedUsers(prev => ({
            ...prev,
            [userName]: !prev[userName]
        }));
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
                        const result = await deleteEvidence(item.fileURL || item.path);
                        if (result.success) {
                            Alert.alert('Success', 'Evidence deleted successfully');
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
        switch (type) {
            case 'images': return '📷';
            case 'videos': return '🎥';
            case 'audio': return '🎤';
            case 'documents': return '📄';
            default: return '📁';
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'images': return COLORS.success;
            case 'videos': return COLORS.warning;
            case 'audio': return COLORS.info;
            case 'documents': return COLORS.primary;
            default: return COLORS.gray500;
        }
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

    // Get unique users from evidence
    const uniqueUsers = [...new Set(evidence.map(e => e.userName))];

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Evidence Backup</Text>
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
                        {/* Statistics */}
                        <View style={styles.statsContainer}>
                            <StatCard title="Total Files" value={stats.total} icon="folder" color={COLORS.primary} />
                            <StatCard title="Users" value={stats.users} icon="people" color={COLORS.warning} />
                            <StatCard title="Photos" value={stats.images} icon="image" color={COLORS.success} />
                            <StatCard title="Videos" value={stats.videos} icon="videocam" color={COLORS.warning} />
                        </View>

                        {/* Info Card */}
                        <View style={styles.infoCard}>
                            <Ionicons name="information-circle" size={20} color={COLORS.info} />
                            <Text style={styles.infoText}>
                                Evidence is organized by user. Each user has folders for images, videos, audio, and documents.
                            </Text>
                        </View>

                        {/* User Folders */}
                        <View style={styles.listHeader}>
                            <Text style={styles.listTitle}>User Folders ({uniqueUsers.length})</Text>
                            <TouchableOpacity onPress={loadEvidence}>
                                <Ionicons name="refresh" size={20} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>

                        {uniqueUsers.length > 0 ? (
                            uniqueUsers.map((userName, index) => {
                                const userEvidence = evidence.filter(e => e.userName === userName);
                                const isExpanded = expandedUsers[userName];

                                return (
                                    <View key={index}>
                                        <TouchableOpacity
                                            style={styles.userFolderCard}
                                            onPress={() => toggleUserExpansion(userName)}
                                        >
                                            <View style={styles.userFolderIcon}>
                                                <Ionicons name="folder" size={32} color={COLORS.warning} />
                                            </View>
                                            <View style={styles.userFolderInfo}>
                                                <Text style={styles.userFolderName}>{userName}</Text>
                                                <Text style={styles.userFolderCount}>{userEvidence.length} files</Text>
                                            </View>
                                            <Ionicons
                                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                size={24}
                                                color={COLORS.white}
                                            />
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.expandedContent}>
                                                {/* Type Folders */}
                                                {['images', 'videos', 'audio', 'documents'].map((type) => {
                                                    const typeEvidence = userEvidence.filter(e => e.type === type);
                                                    if (typeEvidence.length === 0) return null;

                                                    return (
                                                        <View key={type} style={styles.typeFolder}>
                                                            <View style={styles.typeFolderHeader}>
                                                                <Text style={styles.typeFolderIcon}>{getTypeIcon(type)}</Text>
                                                                <Text style={styles.typeFolderName}>{type}</Text>
                                                                <Text style={styles.typeFolderCount}>({typeEvidence.length})</Text>
                                                            </View>

                                                            {typeEvidence.map((item, i) => (
                                                                <TouchableOpacity key={i} style={styles.fileItem}>
                                                                    <Text style={styles.fileIcon}>{getTypeIcon(type)}</Text>
                                                                    <View style={styles.fileInfo}>
                                                                        <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
                                                                        <Text style={styles.fileMeta}>{item.date} • {item.size ? formatSize(item.size) : 'N/A'}</Text>
                                                                    </View>
                                                                    {(userData?.isAdmin || userData?.isMainAdmin) && (
                                                                        <TouchableOpacity onPress={() => handleDelete(item)}>
                                                                            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                                                                        </TouchableOpacity>
                                                                    )}
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="folder-open-outline" size={60} color={COLORS.gray500} />
                                <Text style={styles.emptyText}>No evidence backup found</Text>
                                <Text style={styles.emptySubtext}>Evidence will appear here after users upload</Text>
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
    userFolderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white + '10', borderRadius: 12, padding: SPACING.md, marginBottom: 8 },
    userFolderIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.warning + '30', alignItems: 'center', justifyContent: 'center' },
    userFolderInfo: { flex: 1, marginLeft: 12 },
    userFolderName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.white },
    userFolderCount: { fontSize: FONT_SIZES.sm, color: COLORS.white + '70', marginTop: 2 },
    expandedContent: { marginLeft: 20, marginBottom: 8 },
    typeFolder: { backgroundColor: COLORS.white + '5', borderRadius: 12, padding: SPACING.md, marginBottom: 8 },
    typeFolderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    typeFolderIcon: { fontSize: 20, marginRight: 8 },
    typeFolderName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.white, textTransform: 'capitalize' },
    typeFolderCount: { fontSize: FONT_SIZES.sm, color: COLORS.white + '70', marginLeft: 4 },
    fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, padding: SPACING.sm, marginBottom: 4 },
    fileIcon: { fontSize: 20 },
    fileInfo: { flex: 1, marginLeft: 8 },
    fileName: { fontSize: FONT_SIZES.sm, fontWeight: '500', color: COLORS.gray800 },
    fileMeta: { fontSize: FONT_SIZES.xs, color: COLORS.gray500 },
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