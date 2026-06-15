import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

const UserManagementScreen = () => {
    const navigation = useNavigation();
    const { user, userData } = useAuth();
    const [users, setUsers] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [isAdmin, setIsAdmin] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        if (userData) {
            setIsAdmin(userData.isAdmin || userData.isMainAdmin || false);
        }
        loadUsers();
    }, [user, userData]);

    const loadUsers = async () => {
        try {
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const usersList = [];
            querySnapshot.forEach((doc) => {
                usersList.push({ id: doc.id, ...doc.data() });
            });
            setUsers(usersList);
        } catch (error) {
            console.error('Error loading users:', error);
            // Fallback to non-ordered if createdAt doesn't exist yet
            try {
                const querySnapshot = await getDocs(collection(db, 'users'));
                const usersList = [];
                querySnapshot.forEach((doc) => {
                    usersList.push({ id: doc.id, ...doc.data() });
                });
                setUsers(usersList);
            } catch (err) {
                console.error('Final fallback error:', err);
            }
        }
    };

    const checkAdminStatus = async () => {
        // Admin status is now handled in useEffect via userData
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadUsers();
        setRefreshing(false);
    };

    const getRoleBadge = (userItem) => {
        if (userItem.isMainAdmin) {
            return { text: 'Main Admin', color: COLORS.warning, bgColor: COLORS.warning + '20' };
        } else if (userItem.isAdmin) {
            return { text: 'Admin', color: COLORS.primary, bgColor: COLORS.primary + '20' };
        } else {
            return { text: 'User', color: COLORS.gray500, bgColor: COLORS.gray200 };
        }
    };

    const handleGrantAdmin = async (targetUser) => {
        if (!userData?.isMainAdmin) {
            Alert.alert('Access Denied', 'Only the Main Admin can grant admin privileges.');
            return;
        }

        Alert.alert(
            'Grant Admin Access',
            `Are you sure you want to make "${targetUser.name}" an admin?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Grant',
                    style: 'default',
                    onPress: async () => {
                        try {
                            await updateDoc(doc(db, 'users', targetUser.id), {
                                isAdmin: true,
                                isMainAdmin: false
                            });
                            await loadUsers();
                            setShowRoleModal(false);
                            Alert.alert('Success', `${targetUser.displayName || targetUser.name} is now an admin.`);
                        } catch (error) {
                            console.error('Error granting admin:', error);
                            Alert.alert('Error', 'Failed to update user role.');
                        }
                    }
                }
            ]
        );
    };

    const handleRemoveAdmin = async (targetUser) => {
        if (!userData?.isMainAdmin) {
            Alert.alert('Access Denied', 'Only the Main Admin can remove admin privileges.');
            return;
        }

        if (targetUser.isMainAdmin) {
            Alert.alert('Cannot Remove', 'Cannot remove main admin privileges.');
            return;
        }

        Alert.alert(
            'Remove Admin Access',
            `Are you sure you want to remove admin access from "${targetUser.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await updateDoc(doc(db, 'users', targetUser.id), {
                                isAdmin: false,
                                isMainAdmin: false
                            });
                            await loadUsers();
                            setShowRoleModal(false);
                            Alert.alert('Success', `Admin access removed from ${targetUser.displayName || targetUser.name}.`);
                        } catch (error) {
                            console.error('Error removing admin:', error);
                            Alert.alert('Error', 'Failed to update user role.');
                        }
                    }
                }
            ]
        );
    };

    const handleMakeMainAdmin = async (targetUser) => {
        if (!userData?.isMainAdmin) {
            Alert.alert('Access Denied', 'Only the Main Admin can appoint new Main Admins.');
            return;
        }
        Alert.alert(
            'Make Main Admin',
            `Are you sure you want to make "${targetUser.displayName || targetUser.name}" the MAIN ADMIN?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'default',
                    onPress: async () => {
                        try {
                            // 1. Remove main admin from current main admin (optional, if we want only one)
                            // In this simple version, we just set the target as main admin
                            await updateDoc(doc(db, 'users', targetUser.id), {
                                isMainAdmin: true,
                                isAdmin: true
                            });
                            await loadUsers();
                            setShowRoleModal(false);
                            Alert.alert('Success', `${targetUser.displayName || targetUser.name} is now the MAIN ADMIN.`);
                        } catch (error) {
                            console.error('Error making main admin:', error);
                            Alert.alert('Error', 'Failed to update user role.');
                        }
                    }
                }
            ]
        );
    };

    const filteredUsers = users.filter(userItem => {
        const name = userItem.displayName || userItem.name || '';
        const email = userItem.email || '';
        const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.toLowerCase().includes(searchQuery.toLowerCase());

        if (filter === 'admins') return matchesSearch && userItem.isAdmin;
        if (filter === 'users') return matchesSearch && !userItem.isAdmin;
        return matchesSearch;
    });

    const renderUserItem = ({ item }) => {
        const roleBadge = getRoleBadge(item);

        return (
            <View style={styles.userCard}>
                <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                        {(item.displayName || item.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                        <Text style={styles.userName}>{item.displayName || item.name || 'Unknown User'}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: roleBadge.bgColor }]}>
                            <Text style={[styles.roleBadgeText, { color: roleBadge.color }]}>{roleBadge.text}</Text>
                        </View>
                    </View>
                    <Text style={styles.userEmail}>{item.email || 'No Email'}</Text>
                    <View style={styles.userPhoneRow}>
                        <Ionicons name="call-outline" size={12} color={COLORS.gray500} />
                        <Text style={styles.userPhone}>{item.phoneNumber || item.phone || 'N/A'}</Text>
                        <Ionicons name="calendar-outline" size={12} color={COLORS.gray500} style={{ marginLeft: 12 }} />
                        <Text style={styles.userDate}>
                            {item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString() : new Date(item.createdAt).toLocaleDateString()) : 'N/A'}
                        </Text>
                    </View>
                </View>
                {isAdmin && (
                    <TouchableOpacity
                        style={styles.moreButton}
                        onPress={() => {
                            setSelectedUser(item);
                            setShowRoleModal(true);
                        }}
                    >
                        <Ionicons name="ellipsis-vertical" size={20} color={COLORS.gray400} />
                    </TouchableOpacity>
                )}
            </View>
        );
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

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : (userData?.isMainAdmin ? navigation.navigate('MainAdminPanel') : navigation.navigate('AdminPanel'))}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.title}>User Management</Text>
                    <TouchableOpacity onPress={onRefresh}>
                        <Ionicons name="refresh" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
                >
                    {/* Statistics Cards */}
                    <View style={styles.statsContainer}>
                        <StatCard title="Total Users" value={users.length} icon="people" color={COLORS.primary} />
                        <StatCard title="Admins" value={users.filter(u => u.isAdmin).length} icon="shield-checkmark" color={COLORS.warning} />
                        <StatCard title="Users" value={users.filter(u => !u.isAdmin).length} icon="person" color={COLORS.success} />
                    </View>

                    {/* Search and Filter */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBox}>
                            <Ionicons name="search" size={20} color={COLORS.gray400} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search users..."
                                placeholderTextColor={COLORS.gray400}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={20} color={COLORS.gray400} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.filterContainer}>
                            <TouchableOpacity
                                style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                                onPress={() => setFilter('all')}
                            >
                                <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.filterButton, filter === 'admins' && styles.filterButtonActive]}
                                onPress={() => setFilter('admins')}
                            >
                                <Text style={[styles.filterText, filter === 'admins' && styles.filterTextActive]}>Admins</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.filterButton, filter === 'users' && styles.filterButtonActive]}
                                onPress={() => setFilter('users')}
                            >
                                <Text style={[styles.filterText, filter === 'users' && styles.filterTextActive]}>Users</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* User List */}
                    <View style={styles.listHeader}>
                        <Text style={styles.listTitle}>Users ({filteredUsers.length})</Text>
                    </View>

                    {filteredUsers.length > 0 ? (
                        filteredUsers.map((userItem) => (
                            <View key={userItem.id}>
                                {renderUserItem({ item: userItem })}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={60} color={COLORS.gray500} />
                            <Text style={styles.emptyText}>No users found</Text>
                        </View>
                    )}

                    <View style={styles.bottomPadding} />
                </ScrollView>

                {/* Role Management Modal */}
                <Modal visible={showRoleModal} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={() => setShowRoleModal(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Manage User</Text>
                                        <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                                            <Ionicons name="close" size={24} color={COLORS.gray500} />
                                        </TouchableOpacity>
                                    </View>

                                    {selectedUser && (
                                        <View style={styles.selectedUserInfo}>
                                            <View style={styles.selectedUserAvatar}>
                                                <Text style={styles.selectedUserAvatarText}>
                                                    {(selectedUser.displayName || selectedUser.name || 'U').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={styles.selectedUserDetails}>
                                                <Text style={styles.selectedUserName}>{selectedUser.displayName || selectedUser.name}</Text>
                                                <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.modalOptions}>
                                        {!selectedUser?.isAdmin ? (
                                            <TouchableOpacity
                                                style={styles.modalOption}
                                                onPress={() => handleGrantAdmin(selectedUser)}
                                            >
                                                <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
                                                <Text style={styles.modalOptionText}>Grant Admin Access</Text>
                                            </TouchableOpacity>
                                        ) : !selectedUser?.isMainAdmin ? (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.modalOption}
                                                    onPress={() => handleMakeMainAdmin(selectedUser)}
                                                >
                                                    <Ionicons name="star" size={24} color={COLORS.warning} />
                                                    <Text style={styles.modalOptionText}>Make Main Admin</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.modalOption, styles.dangerOption]}
                                                    onPress={() => handleRemoveAdmin(selectedUser)}
                                                >
                                                    <Ionicons name="shield-outline" size={24} color={COLORS.danger} />
                                                    <Text style={[styles.modalOptionText, styles.dangerText]}>Remove Admin Access</Text>
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <View style={styles.mainAdminInfo}>
                                                <Ionicons name="shield-checkmark" size={40} color={COLORS.warning} />
                                                <Text style={styles.mainAdminText}>This is the Main Admin</Text>
                                                <Text style={styles.mainAdminSubtext}>Cannot modify main admin privileges</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
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
    searchContainer: { marginBottom: SPACING.md },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        paddingHorizontal: SPACING.md,
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.sm,
        fontSize: FONT_SIZES.md,
        color: COLORS.gray800,
    },
    filterContainer: { flexDirection: 'row' },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: COLORS.white + '20',
        marginRight: 4,
        borderRadius: 8,
    },
    filterButtonActive: { backgroundColor: COLORS.primary },
    filterText: { fontSize: FONT_SIZES.sm, color: COLORS.white + '80' },
    filterTextActive: { color: COLORS.white, fontWeight: '600' },
    listHeader: { marginBottom: SPACING.sm },
    listTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.white },
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
    userAvatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
    userInfo: { flex: 1, marginLeft: 12 },
    userNameRow: { flexDirection: 'row', alignItems: 'center' },
    userName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800 },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    roleBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
    userEmail: { fontSize: FONT_SIZES.sm, color: COLORS.gray600 },
    userPhoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    userPhone: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginLeft: 4 },
    userDate: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginLeft: 4 },
    moreButton: { padding: 8 },
    emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
    emptyText: { fontSize: FONT_SIZES.md, color: COLORS.gray500, marginTop: SPACING.md },
    bottomPadding: { height: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
    modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800 },
    selectedUserInfo: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
    selectedUserAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    selectedUserAvatarText: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
    selectedUserDetails: { flex: 1, marginLeft: 12 },
    selectedUserName: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800 },
    selectedUserEmail: { fontSize: FONT_SIZES.sm, color: COLORS.gray500 },
    modalOptions: { padding: SPACING.lg },
    modalOption: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: 12, marginBottom: 8 },
    modalOptionText: { fontSize: FONT_SIZES.md, color: COLORS.gray800, marginLeft: 12 },
    dangerOption: { backgroundColor: COLORS.danger + '10' },
    dangerText: { color: COLORS.danger },
    mainAdminInfo: { alignItems: 'center', padding: SPACING.lg },
    mainAdminText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.warning, marginTop: SPACING.md },
    mainAdminSubtext: { fontSize: FONT_SIZES.sm, color: COLORS.gray500, marginTop: 4 },
});

export default UserManagementScreen;