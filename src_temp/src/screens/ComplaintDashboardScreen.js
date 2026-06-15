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
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import GradientBackground from '../components/GradientBackground';

const ComplaintDashboardScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [globalStats, setGlobalStats] = useState({
        total: 0,
        resolved: 0,
        avgDays: 0,
    });
    const [myComplaints, setMyComplaints] = useState([]);

    useEffect(() => {
        const complaintsQuery = query(collection(db, 'complaints'));

        const unsubscribe = onSnapshot(complaintsQuery, (snapshot) => {
            const allComplaints = [];
            let resolvedCount = 0;
            let totalResolutionDays = 0;

            snapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                allComplaints.push(data);

                if (data.status === 'resolved') {
                    resolvedCount++;
                    if (data.submittedAt && data.updatedAt) {
                        const start = data.submittedAt.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt);
                        const end = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                        const diffTime = Math.abs(end - start);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        totalResolutionDays += diffDays;
                    }
                }
            });

            setGlobalStats({
                total: allComplaints.length,
                resolved: resolvedCount,
                avgDays: resolvedCount > 0 ? (totalResolutionDays / resolvedCount).toFixed(1) : 0,
            });

            if (user) {
                const filtered = allComplaints.filter(c => c.userId === user.uid);
                setMyComplaints(filtered.sort((a, b) => {
                    const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date();
                    const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date();
                    return dateB - dateA;
                }));
            }
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
    };

    const handleConfirmResolution = async (complaintId, agreed) => {
        try {
            if (agreed) {
                await updateDoc(doc(db, 'complaints', complaintId), {
                    userConfirmation: 'agreed',
                    confirmationDate: Timestamp.now(),
                });
                Alert.alert('Thank You', 'We are glad the issue was resolved to your satisfaction.');
            } else {
                await updateDoc(doc(db, 'complaints', complaintId), {
                    status: 'in-progress',
                    userConfirmation: 'disagreed',
                    reopenedAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                Alert.alert('Status Updated', 'The complaint has been reopened and notified to authorities.');
            }
        } catch (error) {
            console.error('Error updating confirmation:', error);
            Alert.alert('Error', 'Failed to update confirmation status.');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return COLORS.warning;
            case 'in-progress': return COLORS.info;
            case 'resolved': return COLORS.success;
            default: return COLORS.gray500;
        }
    };

    const StatCard = ({ title, value, subtitle, icon, color }) => (
        <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statTitle}>{title}</Text>
            {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
    );

    const ComplaintItem = ({ item }) => (
        <View style={styles.complaintCard}>
            <View style={styles.complaintHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: COLORS.primary + '15' }]}>
                    <Text style={styles.categoryText}>{item.categoryName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <Text style={styles.description} numberOfLines={3}>{item.description}</Text>

            <View style={styles.complaintFooter}>
                <Text style={styles.dateText}>
                    Filed on: {item.submittedAt?.toDate().toLocaleDateString()}
                </Text>
                <Text style={styles.idText}>ID: {item.reportId}</Text>
            </View>

            {item.status === 'resolved' && !item.userConfirmation && (
                <View style={styles.confirmationBox}>
                    <Text style={styles.confirmationTitle}>Is this case really solved?</Text>
                    <View style={styles.confirmationButtons}>
                        <TouchableOpacity
                            style={[styles.confirmBtn, styles.agreeBtn]}
                            onPress={() => handleConfirmResolution(item.id, true)}
                        >
                            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                            <Text style={styles.confirmBtnText}>Agree</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmBtn, styles.disagreeBtn]}
                            onPress={() => handleConfirmResolution(item.id, false)}
                        >
                            <Ionicons name="close-circle" size={18} color={COLORS.white} />
                            <Text style={styles.confirmBtnText}>Disagree</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {item.userConfirmation && (
                <View style={[styles.confirmationResult, { backgroundColor: item.userConfirmation === 'agreed' ? COLORS.success + '10' : COLORS.danger + '10' }]}>
                    <Ionicons
                        name={item.userConfirmation === 'agreed' ? "checkmark-circle" : "alert-circle"}
                        size={16}
                        color={item.userConfirmation === 'agreed' ? COLORS.success : COLORS.danger}
                    />
                    <Text style={[styles.resultText, { color: item.userConfirmation === 'agreed' ? COLORS.success : COLORS.danger }]}>
                        You {item.userConfirmation} with the resolution
                    </Text>
                </View>
            )}
        </View>
    );

    return (
        <GradientBackground colors={GRADIENTS.primary}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Complaints Dashboard</Text>
                    <View style={{ width: 40 }} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.white} />
                        <Text style={styles.loadingText}>Fetching status...</Text>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.container}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    >
                        <Text style={styles.sectionTitle}>Global Statistics</Text>
                        <View style={styles.statsGrid}>
                            <StatCard
                                title="Total Filed"
                                value={globalStats.total}
                                icon="document-text"
                                color={COLORS.primary}
                            />
                            <StatCard
                                title="Resolved"
                                value={globalStats.resolved}
                                icon="shield-checkmark"
                                color={COLORS.success}
                            />
                            <StatCard
                                title="Avg. Resolve"
                                value={`${globalStats.avgDays} days`}
                                icon="time"
                                color={COLORS.warning}
                            />
                        </View>

                        <View style={styles.myComplaintsHeader}>
                            <Text style={styles.sectionTitle}>My Complaints</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('ComplaintReport')}>
                                <Text style={styles.reportLink}>+ File New</Text>
                            </TouchableOpacity>
                        </View>

                        {myComplaints.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="document-outline" size={64} color={COLORS.gray400} />
                                <Text style={styles.emptyText}>You haven't filed any complaints yet.</Text>
                            </View>
                        ) : (
                            myComplaints.map(complaint => (
                                <ComplaintItem key={complaint.id} item={complaint} />
                            ))
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    backButton: { padding: 4 },
    title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    container: {
        flex: 1,
        backgroundColor: COLORS.gray100,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: SPACING.lg,
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: COLORS.white, marginTop: 12 },
    sectionTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.gray800,
        marginBottom: SPACING.md,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xl,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: SPACING.md,
        marginHorizontal: 4,
        alignItems: 'center',
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.gray900 },
    statTitle: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, textAlign: 'center' },
    myComplaintsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    reportLink: { color: COLORS.primary, fontWeight: '600' },
    complaintCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    complaintHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    categoryBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    categoryText: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.primary },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: { fontSize: FONT_SIZES.xs, fontWeight: 'bold' },
    description: { fontSize: FONT_SIZES.sm, color: COLORS.gray700, lineHeight: 20, marginBottom: 12 },
    complaintFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: COLORS.gray100,
        paddingTop: 8,
    },
    dateText: { fontSize: 11, color: COLORS.gray500 },
    idText: { fontSize: 11, color: COLORS.gray400 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: COLORS.gray500, marginTop: 12, textAlign: 'center' },
    confirmationBox: {
        marginTop: 15,
        padding: 12,
        backgroundColor: COLORS.gray100,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
    },
    confirmationTitle: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.gray800, marginBottom: 10, textAlign: 'center' },
    confirmationButtons: { flexDirection: 'row', justifyContent: 'space-around' },
    confirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 100,
        justifyContent: 'center',
    },
    agreeBtn: { backgroundColor: COLORS.success },
    disagreeBtn: { backgroundColor: COLORS.danger },
    confirmBtnText: { color: COLORS.white, fontWeight: 'bold', marginLeft: 6, fontSize: FONT_SIZES.sm },
    confirmationResult: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
    },
    resultText: { fontSize: FONT_SIZES.xs, fontWeight: '600', marginLeft: 6 },
});

export default ComplaintDashboardScreen;
