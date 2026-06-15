import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Modal,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { resetApplicationData } from '../utils/SystemManager';

const MainAdminPanelScreen = () => {
    const navigation = useNavigation();
    const { user, userData } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalEvidence: 0,
        totalComplaints: 0,
        activeSOS: 0,
    });
    const [users, setUsers] = useState([]);
    const [evidence, setEvidence] = useState([]);
    const [complaints, setComplaints] = useState([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showEvidenceModal, setShowEvidenceModal] = useState(false);
    const [showComplaintModal, setShowComplaintModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedEvidence, setSelectedEvidence] = useState(null);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        // Real-time permission check
        if (!loading && userData && !userData.isMainAdmin) {
            Alert.alert('Access Denied', 'Your Main Admin privileges have been removed.');
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('MainTabs');
            }
        }
    }, [userData, loading]);

    useEffect(() => {
        loadAdminData();

        // Real-time listener for complaints to keep synced with regular Admin
        const q = query(collection(db, 'complaints'), orderBy('submittedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const complaintsList = [];
            snapshot.forEach((doc) => {
                complaintsList.push({ id: doc.id, ...doc.data() });
            });
            setComplaints(complaintsList);
            setStats(prev => ({
                ...prev,
                totalComplaints: complaintsList.length,
                activeSOS: complaintsList.filter(c => c.status === 'pending').length,
            }));
        });

        const sosQ = query(collection(db, 'sos_alerts'), where('status', '==', 'ongoing'));
        const unsubscribeSOS = onSnapshot(sosQ, (snapshot) => {
            setStats(prev => ({
                ...prev,
                activeSOS: snapshot.size,
            }));
        });

        return () => {
            unsubscribe();
            unsubscribeSOS();
        };
    }, []);



    const loadAdminData = async () => {
        setLoading(true);
        try {
            // Load users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersList = [];
            usersSnapshot.forEach((doc) => {
                usersList.push({ id: doc.id, ...doc.data() });
            });
            setUsers(usersList);

            // Load evidence
            const evidenceSnapshot = await getDocs(collection(db, 'evidence'));
            const evidenceList = [];
            evidenceSnapshot.forEach((doc) => {
                evidenceList.push({ id: doc.id, ...doc.data() });
            });
            setEvidence(evidenceList);

            // Load complaints
            const complaintsSnapshot = await getDocs(collection(db, 'complaints'));
            const complaintsList = [];
            complaintsSnapshot.forEach((doc) => {
                complaintsList.push({ id: doc.id, ...doc.data() });
            });
            setComplaints(complaintsList);

            // Calculate stats
            const sosSnapshot = await getDocs(query(collection(db, 'sos_alerts'), where('status', '==', 'ongoing')));
            setStats({
                totalUsers: usersList.length,
                totalEvidence: evidenceList.length,
                totalComplaints: complaintsList.length,
                activeSOS: sosSnapshot.size,
            });
        } catch (error) {
            console.error('Error loading admin data:', error);
        }
        setLoading(false);
    };

    const handleDeleteUser = (userId) => {
        Alert.alert(
            'Delete User',
            'Are you sure you want to delete this user? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'users', userId));
                            Alert.alert('Success', 'User deleted successfully');
                            loadAdminData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete user');
                        }
                    },
                },
            ]
        );
    };

    const handleMakeAdmin = async (userId) => {
        try {
            await updateDoc(doc(db, 'users', userId), {
                isAdmin: true,
                isMainAdmin: false
            });
            Alert.alert('Success', 'User made admin successfully');
            loadAdminData();
        } catch (error) {
            Alert.alert('Error', 'Failed to make user admin');
        }
    };

    const handleMakeMainAdmin = async (userId) => {
        Alert.alert(
            'Appoint Main Admin',
            'Are you sure you want to give this user full Master permissions?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        try {
                            await updateDoc(doc(db, 'users', userId), {
                                isAdmin: true,
                                isMainAdmin: true
                            });
                            Alert.alert('Success', 'User is now a Main Admin');
                            loadAdminData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to update user role');
                        }
                    }
                }
            ]
        );
    };

    const handleRemoveAdmin = async (userId) => {
        try {
            await updateDoc(doc(db, 'users', userId), {
                isAdmin: false,
                isMainAdmin: false
            });
            Alert.alert('Success', 'All administrative privileges removed');
            loadAdminData();
        } catch (error) {
            Alert.alert('Error', 'Failed to remove admin privileges');
        }
    };

    const handleDeleteEvidence = (evidenceId) => {
        Alert.alert(
            'Delete Evidence',
            'Are you sure you want to delete this evidence?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'evidence', evidenceId));
                            Alert.alert('Success', 'Evidence deleted successfully');
                            loadAdminData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete evidence');
                        }
                    },
                },
            ]
        );
    };

    const handleUpdateComplaint = async (complaintId, newStatus) => {
        try {
            await updateDoc(doc(db, 'complaints', complaintId), {
                status: newStatus,
                updatedAt: Timestamp.now(),
            });
            Alert.alert('Success', 'Complaint status updated successfully');
            // No need to call loadAdminData here as onSnapshot will handle it
        } catch (error) {
            Alert.alert('Error', 'Failed to update complaint');
        }
    };


    const filteredUsers = users.filter((u) =>
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredEvidence = evidence.filter((e) =>
        e.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.userName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredComplaints = complaints.filter((c) =>
        c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const StatCard = ({ title, value, icon, color }) => (
        <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statTitle}>{title}</Text>
        </View>
    );

    const UserCard = ({ user }) => (
        <View style={styles.userCard}>
            <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </Text>
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.displayName || 'Unknown'}</Text>
                <Text style={styles.userEmail}>{user.email || 'No email'}</Text>
                <View style={styles.userBadges}>
                    {user.isMainAdmin ? (
                        <View style={[styles.badge, { backgroundColor: COLORS.warning + '20' }]}>
                            <Text style={[styles.badgeText, { color: COLORS.warning }]}>Main Admin</Text>
                        </View>
                    ) : user.isAdmin ? (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>Admin</Text>
                        </View>
                    ) : null}
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{user.source || 'User'}</Text>
                    </View>
                </View>
            </View>
            <View style={styles.userActions}>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                        setSelectedUser(user);
                        setShowUserModal(true);
                    }}
                >
                    <Ionicons name="eye" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                {!user.isMainAdmin && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleMakeMainAdmin(user.id)}
                    >
                        <Ionicons name="star" size={20} color={COLORS.warning} />
                    </TouchableOpacity>
                )}
                {!user.isMainAdmin && !user.isAdmin && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleMakeAdmin(user.id)}
                    >
                        <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
                    </TouchableOpacity>
                )}
                {(user.isMainAdmin || user.isAdmin) && (user.id !== userData.uid) && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleRemoveAdmin(user.id)}
                    >
                        <Ionicons name="shield-outline" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                )}
                {!user.isMainAdmin && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDeleteUser(user.id)}
                    >
                        <Ionicons name="trash" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const EvidenceCard = ({ item }) => (
        <View style={styles.evidenceCard}>
            <View style={[styles.evidenceIcon, { backgroundColor: COLORS.primary + '20' }]}>
                <Ionicons name="folder" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.evidenceInfo}>
                <Text style={styles.evidenceName} numberOfLines={1}>{item.fileName}</Text>
                <Text style={styles.evidenceMeta}>
                    {item.type} • {item.userName} • {item.date}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.evidenceAction}
                onPress={() => handleDeleteEvidence(item.id)}
            >
                <Ionicons name="trash" size={20} color={COLORS.danger} />
            </TouchableOpacity>
        </View>
    );

    const ComplaintCard = ({ item }) => (
        <View style={styles.complaintCard}>
            <View style={[styles.complaintIcon, { backgroundColor: COLORS.danger + '20' }]}>
                <Ionicons name="alert-circle" size={24} color={COLORS.danger} />
            </View>
            <View style={styles.complaintInfo}>
                <Text style={styles.complaintCategory}>{item.categoryName}</Text>
                <Text style={styles.complaintDescription} numberOfLines={2}>
                    {item.description}
                </Text>
                <View style={styles.complaintMeta}>
                    <Text style={styles.complaintUser}>{item.userName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status}
                        </Text>
                    </View>
                </View>
            </View>
            <View style={styles.complaintActions}>
                {item.status === 'pending' && (
                    <TouchableOpacity
                        style={styles.statusBtn}
                        onPress={() => handleUpdateComplaint(item.id, 'in-progress')}
                    >
                        <Text style={styles.statusBtnText}>In Progress</Text>
                    </TouchableOpacity>
                )}
                {item.status === 'in-progress' && (
                    <TouchableOpacity
                        style={styles.statusBtn}
                        onPress={() => handleUpdateComplaint(item.id, 'resolved')}
                    >
                        <Text style={styles.statusBtnText}>Resolve</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.statusBtn}
                    onPress={() => {
                        setSelectedComplaint(item);
                        setShowComplaintModal(true);
                    }}
                >
                    <Ionicons name="eye" size={20} color={COLORS.primary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return COLORS.warning;
            case 'in-progress':
                return COLORS.info;
            case 'resolved':
                return COLORS.success;
            default:
                return COLORS.gray500;
        }
    };

    const handleResetData = () => {
        Alert.alert(
            '⚠️ MEGA RESET',
            'This will permanently DELETE all complaints, SOS alerts, evidence records, and contacts. User accounts will be saved. ARE YOU SURE?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'YES, RESET ALL',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Final Confirmation',
                            'This action is IRREVERSIBLE. All testing analysis will be lost forever. Proceed?',
                            [
                                { text: 'Back', style: 'cancel' },
                                {
                                    text: 'DELETE EVERYTHING',
                                    style: 'destructive',
                                    onPress: async () => {
                                        setLoading(true);
                                        const result = await resetApplicationData();
                                        setLoading(false);
                                        if (result.success) {
                                            Alert.alert('System Purged', `Successfully cleared ${result.count} testing records. The app is now fresh.`);
                                            loadAdminData();
                                        } else {
                                            Alert.alert('Reset Failed', result.error);
                                        }
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    };

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('AdminPanel')}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Main Admin Panel</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.white} />
                            <Text style={styles.loadingText}>Loading admin data...</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                            {/* Emergency Banner */}
                            {stats.activeSOS > 0 && (
                                <TouchableOpacity 
                                    style={styles.emergencyBanner}
                                    onPress={() => navigation.navigate('LiveSOSMonitor')}
                                >
                                    <View style={styles.emergencyBannerContent}>
                                        <Ionicons name="warning" size={24} color={COLORS.white} />
                                        <Text style={styles.emergencyBannerText}>
                                            {stats.activeSOS} ACTIVE SOS EMERGENCY IN PROGRESS
                                        </Text>
                                        <Text style={styles.emergencyBannerSubtext}>TAP TO TAKE CONTROL</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            {/* Stats */}
                            <View style={styles.statsContainer}>
                                <StatCard
                                    title="Total Users"
                                    value={stats.totalUsers}
                                    icon="people"
                                    color={COLORS.primary}
                                />
                                <StatCard
                                    title="Evidence"
                                    value={stats.totalEvidence}
                                    icon="folder"
                                    color={COLORS.success}
                                />
                                <StatCard
                                    title="Complaints"
                                    value={stats.totalComplaints}
                                    icon="document-text"
                                    color={COLORS.warning}
                                />
                                <StatCard
                                    title="Active SOS"
                                    value={stats.activeSOS}
                                    icon="alert-circle"
                                    color={COLORS.danger}
                                />
                            </View>

                            {/* Tabs */}
                            <View style={styles.tabsContainer}>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
                                    onPress={() => setActiveTab('overview')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                                        Overview
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'users' && styles.tabActive]}
                                    onPress={() => setActiveTab('users')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
                                        Users ({users.length})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'evidence' && styles.tabActive]}
                                    onPress={() => setActiveTab('evidence')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'evidence' && styles.tabTextActive]}>
                                        Evidence ({evidence.length})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'complaints' && styles.tabActive]}
                                    onPress={() => setActiveTab('complaints')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'complaints' && styles.tabTextActive]}>
                                        Complaints ({complaints.length})
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Search */}
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={20} color={COLORS.gray500} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search..."
                                    placeholderTextColor={COLORS.gray500}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            {/* Content */}
                            {activeTab === 'overview' && (
                                <View style={styles.overviewContent}>
                                    <Text style={styles.sectionTitle}>Main Admin Actions</Text>
                                    <View style={styles.quickActions}>
                                        <TouchableOpacity
                                            style={styles.quickActionBtn}
                                            onPress={() => navigation.navigate('UserManagement')}
                                        >
                                            <Ionicons name="people" size={24} color={COLORS.primary} />
                                            <Text style={styles.quickActionText}>Manage Users</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.quickActionBtn}
                                            onPress={() => navigation.navigate('EvidenceBackup')}
                                        >
                                            <Ionicons name="cloud-upload" size={24} color={COLORS.success} />
                                            <Text style={styles.quickActionText}>Evidence Backup</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.quickActionBtn}
                                            onPress={() => navigation.navigate('DatabaseAnalytics')}
                                        >
                                            <Ionicons name="stats-chart" size={24} color={COLORS.danger} />
                                            <Text style={styles.quickActionText}>Analytics</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.quickActionBtn}
                                            onPress={() => setActiveTab('complaints')}
                                        >
                                            <Ionicons name="document-text" size={24} color={COLORS.warning} />
                                            <Text style={styles.quickActionText}>Complaints</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.quickActionBtn}
                                            onPress={() => navigation.navigate('LiveSOSMonitor')}
                                        >
                                            <Ionicons name="videocam" size={24} color={COLORS.success} />
                                            <Text style={styles.quickActionText}>Live SOS Streams</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.quickActionBtn, { borderTopWidth: 2, borderTopColor: COLORS.danger }]}
                                            onPress={handleResetData}
                                        >
                                            <Ionicons name="trash-bin" size={24} color={COLORS.danger} />
                                            <Text style={[styles.quickActionText, { color: COLORS.danger, fontWeight: 'bold' }]}>Reset App</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {activeTab === 'users' && (
                                <View style={styles.listContainer}>
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <UserCard key={user.id} user={user} />
                                        ))
                                    ) : (
                                        <View style={styles.emptyState}>
                                            <Ionicons name="people-outline" size={60} color={COLORS.gray500} />
                                            <Text style={styles.emptyText}>No users found</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {activeTab === 'evidence' && (
                                <View style={styles.listContainer}>
                                    {filteredEvidence.length > 0 ? (
                                        filteredEvidence.map((item) => (
                                            <EvidenceCard key={item.id} item={item} />
                                        ))
                                    ) : (
                                        <View style={styles.emptyState}>
                                            <Ionicons name="folder-outline" size={60} color={COLORS.gray500} />
                                            <Text style={styles.emptyText}>No evidence found</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {activeTab === 'complaints' && (
                                <View style={styles.listContainer}>
                                    {filteredComplaints.length > 0 ? (
                                        filteredComplaints.map((item) => (
                                            <ComplaintCard key={item.id} item={item} />
                                        ))
                                    ) : (
                                        <View style={styles.emptyState}>
                                            <Ionicons name="document-text-outline" size={60} color={COLORS.gray500} />
                                            <Text style={styles.emptyText}>No complaints found</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={styles.bottomPadding} />
                        </ScrollView>
                    )}
                </View>

                {/* User Detail Modal */}
                <Modal visible={showUserModal} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>User Details</Text>
                                <TouchableOpacity
                                    onPress={() => setShowUserModal(false)}
                                    style={styles.closeButton}
                                >
                                    <Ionicons name="close" size={24} color={COLORS.gray500} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalBody}>
                                {selectedUser && (
                                    <View style={styles.userDetail}>
                                        <View style={styles.userDetailAvatar}>
                                            <Text style={styles.userDetailAvatarText}>
                                                {selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : 'U'}
                                            </Text>
                                        </View>
                                        <Text style={styles.userDetailName}>{selectedUser.displayName || 'Unknown'}</Text>
                                        <Text style={styles.userDetailEmail}>{selectedUser.email || 'No email'}</Text>
                                        <Text style={styles.userDetailId}>ID: {selectedUser.id}</Text>
                                        <View style={styles.userDetailBadges}>
                                            {selectedUser.isMainAdmin && (
                                                <View style={[styles.badge, { backgroundColor: COLORS.warning + '20' }]}>
                                                    <Text style={[styles.badgeText, { color: COLORS.warning }]}>Main Admin</Text>
                                                </View>
                                            )}
                                            {selectedUser.isAdmin && (
                                                <View style={styles.badge}>
                                                    <Text style={styles.badgeText}>Admin</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Complaint Detail Modal */}
                <Modal visible={showComplaintModal} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Complaint Details</Text>
                                <TouchableOpacity
                                    onPress={() => setShowComplaintModal(false)}
                                    style={styles.closeButton}
                                >
                                    <Ionicons name="close" size={24} color={COLORS.gray500} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalBody}>
                                {selectedComplaint && (
                                    <View style={styles.complaintDetail}>
                                        <Text style={styles.complaintDetailCategory}>{selectedComplaint.categoryName}</Text>
                                        <Text style={styles.complaintDetailDescription}>{selectedComplaint.description}</Text>
                                        <Text style={styles.complaintDetailUser}>User: {selectedComplaint.userName}</Text>
                                        <Text style={styles.complaintDetailStatus}>Status: {selectedComplaint.status}</Text>
                                        <Text style={styles.complaintDetailDate}>
                                            Date: {selectedComplaint.submittedAt?.toDate().toLocaleDateString() || 'Unknown'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
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
    title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.md },
    emergencyBanner: {
        backgroundColor: COLORS.danger,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.white,
        elevation: 5,
        shadowColor: COLORS.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    emergencyBannerContent: { alignItems: 'center' },
    emergencyBannerText: { color: COLORS.white, fontWeight: '900', fontSize: FONT_SIZES.md, marginTop: 4 },
    emergencyBannerSubtext: { color: COLORS.white, fontSize: 10, fontWeight: 'bold', textDecorationLine: 'underline', marginTop: 2 },
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
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.white + '10',
        borderRadius: 12,
        padding: 4,
        marginBottom: SPACING.md,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: COLORS.primary,
    },
    tabText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.white + '80',
    },
    tabTextActive: {
        color: COLORS.white,
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white + '10',
        borderRadius: 8,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        color: COLORS.white,
        fontSize: FONT_SIZES.md,
    },
    overviewContent: {
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.white,
        marginBottom: SPACING.md,
    },
    quickActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    quickActionBtn: {
        width: '30%',
        backgroundColor: COLORS.white + '10',
        borderRadius: 12,
        padding: SPACING.md,
        alignItems: 'center',
        marginBottom: SPACING.md,
        marginRight: SPACING.sm,
    },
    quickActionText: {
        color: COLORS.white,
        fontSize: FONT_SIZES.sm,
        marginTop: 8,
    },
    listContainer: {
        marginBottom: SPACING.md,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: 8,
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userAvatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.gray800,
    },
    userEmail: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray500,
        marginTop: 2,
    },
    userBadges: {
        flexDirection: 'row',
        marginTop: 4,
    },
    badge: {
        backgroundColor: COLORS.primary + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 4,
    },
    badgeText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.primary,
        fontWeight: '600',
    },
    userActions: {
        flexDirection: 'row',
    },
    actionBtn: {
        padding: 8,
    },
    evidenceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: 8,
    },
    evidenceIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    evidenceInfo: {
        flex: 1,
        marginLeft: 12,
    },
    evidenceName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.gray800,
    },
    evidenceMeta: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray500,
        marginTop: 2,
    },
    evidenceAction: {
        padding: 8,
    },
    complaintCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: SPACING.md,
        marginBottom: 8,
    },
    complaintIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    complaintInfo: {
        flex: 1,
        marginLeft: 12,
    },
    complaintCategory: {
        fontSize: FONT_SIZES.md,
        fontWeight: 'bold',
        color: COLORS.gray800,
    },
    complaintDescription: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
        marginTop: 4,
    },
    complaintMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    complaintUser: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.gray500,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: 'bold',
    },
    complaintActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBtn: {
        backgroundColor: COLORS.primary + '10',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
    },
    statusBtnText: {
        color: COLORS.primary,
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: COLORS.gray500,
        marginTop: 12,
        fontSize: FONT_SIZES.md,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        overflow: 'hidden',
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
        fontSize: FONT_SIZES.lg,
        fontWeight: 'bold',
        color: COLORS.gray800,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        padding: SPACING.lg,
    },
    userDetail: {
        alignItems: 'center',
    },
    userDetailAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    userDetailAvatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    userDetailName: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.gray800,
    },
    userDetailEmail: {
        fontSize: FONT_SIZES.md,
        color: COLORS.gray600,
        marginTop: 4,
    },
    userDetailId: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.gray400,
        marginTop: 8,
    },
    userDetailBadges: {
        flexDirection: 'row',
        marginTop: 16,
    },
    complaintDetail: {
        paddingVertical: 8,
    },
    complaintDetailCategory: {
        fontSize: FONT_SIZES.lg,
        fontWeight: 'bold',
        color: COLORS.gray800,
        marginBottom: 8,
    },
    complaintDetailDescription: {
        fontSize: FONT_SIZES.md,
        color: COLORS.gray700,
        lineHeight: 22,
        marginBottom: 16,
    },
    complaintDetailUser: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
        marginBottom: 4,
    },
    complaintDetailStatus: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
        marginBottom: 4,
    },
    complaintDetailDate: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
    },
    bottomPadding: {
        height: 40,
    },
});

export default MainAdminPanelScreen;
