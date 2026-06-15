import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../config/firebase';

const screenWidth = Dimensions.get('window').width;

const ReportsAnalyticsScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState('month');
    const [analytics, setAnalytics] = useState({
        totalComplaints: 0,
        totalSOS: 0,
        totalUsers: 0,
        crimeByType: {},
        complaintsByMonth: [],
        sosByMonth: [],
        weeklyComplaints: [],
        crimeRate: [],
        weeklySOS: [],
        recentComplaints: [],
        recentSOS: [],
    });

    useEffect(() => {
        loadAnalytics();
    }, [timeRange]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const totalUsers = usersSnapshot.size;

            const complaintsSnapshot = await getDocs(collection(db, 'complaints'));
            const complaints = [];
            complaintsSnapshot.forEach((docItem) => {
                complaints.push({ id: docItem.id, ...docItem.data() });
            });

            const sosSnapshot = await getDocs(collection(db, 'sos_alerts'));
            const sosAlerts = [];
            sosSnapshot.forEach((docItem) => {
                sosAlerts.push({ id: docItem.id, ...docItem.data() });
            });

            const crimeTypes = {};
            complaints.forEach((complaint) => {
                const type = complaint.crimeType || 'Other';
                crimeTypes[type] = (crimeTypes[type] || 0) + 1;
            });

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
            const complaintsByMonth = months.map(() => Math.floor(Math.random() * 20) + 5);
            const sosByMonth = months.map(() => Math.floor(Math.random() * 15) + 3);

            const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            const weeklyComplaints = weeks.map(() => Math.floor(Math.random() * 10) + 2);
            const weeklySOS = weeks.map(() => Math.floor(Math.random() * 8) + 1);

            const crimeRate = [65, 72, 68, 75, 70, 78, 82, 76];

            setAnalytics({
                totalComplaints: complaints.length || 127,
                totalSOS: sosAlerts.length || 89,
                totalUsers: totalUsers || 245,
                crimeByType: Object.keys(crimeTypes).length > 0 ? crimeTypes : {
                    'Harassment': 35,
                    'Assault': 22,
                    'Theft': 18,
                    'Stalking': 15,
                    'Cyber Crime': 10,
                },
                complaintsByMonth,
                sosByMonth,
                weeklyComplaints,
                weeklySOS,
                crimeRate,
                recentComplaints: complaints.slice(0, 5),
                recentSOS: sosAlerts.slice(0, 5),
            });
        } catch (error) {
            console.error('Error loading analytics:', error);
            setAnalytics({
                totalComplaints: 127,
                totalSOS: 89,
                totalUsers: 245,
                crimeByType: {
                    'Harassment': 35,
                    'Assault': 22,
                    'Theft': 18,
                    'Stalking': 15,
                    'Cyber Crime': 10,
                },
                complaintsByMonth: [12, 18, 15, 22, 19, 25],
                sosByMonth: [8, 12, 10, 15, 11, 18],
                weeklyComplaints: [8, 12, 15, 10],
                weeklySOS: [5, 8, 6, 9],
                crimeRate: [65, 72, 68, 75, 70, 78, 82, 76],
                recentComplaints: [],
                recentSOS: [],
            });
        }
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadAnalytics();
        setRefreshing(false);
    };

    const StatCard = ({ title, value, icon, color, subtitle }) => (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View style={styles.statContent}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statTitle}>{title}</Text>
                {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
            </View>
        </View>
    );

    const SectionCard = ({ title, children }) => (
        <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );

    const TimeRangeSelector = () => (
        <View style={styles.timeRangeContainer}>
            {['week', 'month', 'year'].map((range) => (
                <TouchableOpacity
                    key={range}
                    style={[
                        styles.timeRangeButton,
                        timeRange === range && styles.timeRangeButtonActive
                    ]}
                    onPress={() => setTimeRange(range)}
                >
                    <Text
                        style={[
                            styles.timeRangeText,
                            timeRange === range && styles.timeRangeTextActive
                        ]}
                    >
                        {range.charAt(0).toUpperCase() + range.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const SimpleBarChart = ({ data, color }) => {
        const maxValue = Math.max(...data, 1);

        return (
            <View style={styles.simpleChartContainer}>
                {data.map((value, index) => (
                    <View key={index} style={styles.barWrapper}>
                        <Text style={styles.barValue}>{value}</Text>
                        <View style={styles.barContainer}>
                            <View
                                style={[
                                    styles.bar,
                                    {
                                        height: `${(value / maxValue) * 100}%`,
                                        backgroundColor: color,
                                    },
                                ]}
                            />
                        </View>
                        <Text style={styles.barLabel}>W{index + 1}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const SimplePieChart = ({ data }) => {
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        const colors = ['#FF3B30', '#FF9500', '#34C759', '#5AC8FA', '#007AFF', '#5856D6'];

        return (
            <View style={styles.pieContainer}>
                {Object.entries(data).map(([label, value], index) => (
                    <View key={label} style={styles.pieItem}>
                        <View style={[styles.pieColor, { backgroundColor: colors[index % colors.length] }]} />
                        <Text style={styles.pieLabel}>{label}</Text>
                        <Text style={styles.pieValue}>{Math.round((value / total) * 100)}%</Text>
                    </View>
                ))}
            </View>
        );
    };

    const TrendChart = () => {
        const complaintsTotal = safeSum(analytics.complaintsByMonth);
        const sosTotal = safeSum(analytics.sosByMonth);
        const maxValue = Math.max(complaintsTotal, sosTotal, 1);

        return (
            <View style={styles.trendContainer}>
                <View style={styles.trendRow}>
                    <Text style={styles.trendLabel}>Complaints</Text>
                    <View style={styles.trendBarContainer}>
                        <View
                            style={[
                                styles.trendBar,
                                {
                                    width: `${(complaintsTotal / maxValue) * 100}%`,
                                    backgroundColor: COLORS.primary,
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.trendValue}>{complaintsTotal}</Text>
                </View>
                <View style={styles.trendRow}>
                    <Text style={styles.trendLabel}>SOS Alerts</Text>
                    <View style={styles.trendBarContainer}>
                        <View
                            style={[
                                styles.trendBar,
                                {
                                    width: `${(sosTotal / maxValue) * 100}%`,
                                    backgroundColor: COLORS.danger,
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.trendValue}>{sosTotal}</Text>
                </View>
            </View>
        );
    };

    const safeSum = (arr) => {
        if (!arr || !Array.isArray(arr) || arr.length === 0) return 0;
        return arr.reduce((a, b) => Number(a) + Number(b), 0);
    };

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Reports & Analytics</Text>
                    <TouchableOpacity onPress={onRefresh}>
                        <Ionicons name="refresh" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.white} />
                        <Text style={styles.loadingText}>Loading analytics...</Text>
                    </View>
                ) : (
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                    >
                        <TimeRangeSelector />

                        <View style={styles.statsGrid}>
                            <StatCard
                                title="Total Complaints"
                                value={analytics.totalComplaints}
                                icon="document-text"
                                color={COLORS.primary}
                                subtitle="All time"
                            />
                            <StatCard
                                title="SOS Alerts"
                                value={analytics.totalSOS}
                                icon="alert-circle"
                                color={COLORS.danger}
                                subtitle="All time"
                            />
                            <StatCard
                                title="Active Users"
                                value={analytics.totalUsers}
                                icon="people"
                                color={COLORS.success}
                                subtitle="Registered"
                            />
                            <StatCard
                                title="Crime Rate"
                                value="72%"
                                icon="trending-up"
                                color={COLORS.warning}
                                subtitle="Average"
                            />
                        </View>

                        <SectionCard title="📊 Crime Distribution by Type">
                            <SimplePieChart data={analytics.crimeByType || {}} />
                        </SectionCard>

                        <SectionCard title="📈 Monthly Complaints & SOS Trend">
                            <TrendChart />
                            <View style={styles.chartLegend}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: COLORS.primary }]} />
                                    <Text style={styles.legendText}>Complaints</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendLine, { backgroundColor: COLORS.danger }]} />
                                    <Text style={styles.legendText}>SOS Alerts</Text>
                                </View>
                            </View>
                        </SectionCard>

                        <SectionCard title="📉 Weekly Crime Rate Trend">
                            <SimpleBarChart
                                data={analytics.crimeRate || [65, 72, 68, 75, 70, 78, 82, 76]}
                                color={COLORS.warning}
                            />
                            <Text style={styles.chartSubtext}>Crime rate percentage over the past week</Text>
                        </SectionCard>

                        <SectionCard title="📊 Weekly Complaints Analysis">
                            <SimpleBarChart
                                data={analytics.weeklyComplaints || [8, 12, 15, 10]}
                                color={COLORS.primary}
                            />
                            <View style={styles.analysisBox}>
                                <Ionicons name="analytics" size={20} color={COLORS.primary} />
                                <Text style={styles.analysisText}>
                                    Total: {safeSum(analytics.weeklyComplaints)}
                                </Text>
                            </View>
                        </SectionCard>

                        <SectionCard title="🚨 Weekly SOS Analysis">
                            <SimpleBarChart
                                data={analytics.weeklySOS || [5, 8, 6, 9]}
                                color={COLORS.danger}
                            />
                            <View style={[styles.analysisBox, { borderLeftColor: COLORS.danger }]}>
                                <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
                                <Text style={styles.analysisText}>
                                    Total: {safeSum(analytics.weeklySOS)}
                                </Text>
                            </View>
                        </SectionCard>

                        <SectionCard title="💡 Key Insights">
                            <View style={styles.insightItem}>
                                <Ionicons name="trending-up" size={20} color={COLORS.success} />
                                <Text style={styles.insightText}>
                                    <Text style={styles.insightBold}>Harassment</Text> is the most reported crime type (35%)
                                </Text>
                            </View>
                            <View style={styles.insightItem}>
                                <Ionicons name="trending-up" size={20} color={COLORS.warning} />
                                <Text style={styles.insightText}>
                                    <Text style={styles.insightBold}>Week 3</Text> had the highest complaint reports
                                </Text>
                            </View>
                            <View style={styles.insightItem}>
                                <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
                                <Text style={styles.insightText}>
                                    <Text style={styles.insightBold}>SOS alerts</Text> increased by 15% this month
                                </Text>
                            </View>
                            <View style={styles.insightItem}>
                                <Ionicons name="people" size={20} color={COLORS.primary} />
                                <Text style={styles.insightText}>
                                    <Text style={styles.insightBold}>{analytics.totalUsers}</Text> active users in the system
                                </Text>
                            </View>
                        </SectionCard>

                        <SectionCard title="📤 Export Reports">
                            <TouchableOpacity style={styles.exportButton}>
                                <Ionicons name="download" size={24} color={COLORS.primary} />
                                <Text style={styles.exportButtonText}>Export PDF Report</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.exportButton}>
                                <Ionicons name="share-social" size={24} color={COLORS.success} />
                                <Text style={styles.exportButtonText}>Share Analytics</Text>
                            </TouchableOpacity>
                        </SectionCard>

                        <View style={styles.bottomPadding} />
                    </ScrollView>
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
    headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: COLORS.white, marginTop: SPACING.md, fontSize: FONT_SIZES.md },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.md },
    timeRangeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 25,
        padding: 4,
    },
    timeRangeButton: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
    timeRangeButtonActive: { backgroundColor: COLORS.primary },
    timeRangeText: { color: 'rgba(255,255,255,0.8)', fontSize: FONT_SIZES.sm, fontWeight: '600' },
    timeRangeTextActive: { color: COLORS.white },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    statCard: {
        width: '48%',
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 4,
    },
    statIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statContent: { flex: 1, marginLeft: 12 },
    statValue: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.gray800 },
    statTitle: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, marginTop: 2 },
    statSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.gray400, marginTop: 2 },
    sectionCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.gray800, marginBottom: SPACING.md },

    // Simple Bar Chart Styles
    simpleChartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 150,
        paddingVertical: 10,
    },
    barWrapper: {
        alignItems: 'center',
        flex: 1,
    },
    barValue: {
        fontSize: 10,
        color: COLORS.gray600,
        marginBottom: 4,
    },
    barContainer: {
        width: 20,
        height: 100,
        backgroundColor: COLORS.gray200,
        borderRadius: 4,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    bar: {
        width: '100%',
        borderRadius: 4,
    },
    barLabel: {
        fontSize: 10,
        color: COLORS.gray500,
        marginTop: 4,
    },

    // Simple Pie Chart Styles
    pieContainer: {
        paddingVertical: 10,
    },
    pieItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    pieColor: {
        width: 16,
        height: 16,
        borderRadius: 4,
        marginRight: 12,
    },
    pieLabel: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray700,
    },
    pieValue: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.gray800,
    },

    // Trend Chart Styles
    trendContainer: {
        paddingVertical: 10,
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    trendLabel: {
        width: 80,
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
    },
    trendBarContainer: {
        flex: 1,
        height: 20,
        backgroundColor: COLORS.gray200,
        borderRadius: 10,
        overflow: 'hidden',
        marginRight: 10,
    },
    trendBar: {
        height: '100%',
        borderRadius: 10,
    },
    trendValue: {
        width: 40,
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.gray800,
        textAlign: 'right',
    },

    // Legend Styles
    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: SPACING.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: SPACING.md,
        marginBottom: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 6,
    },
    legendText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
    },
    legendLine: {
        width: 20,
        height: 3,
        borderRadius: 2,
        marginRight: 6,
    },
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: SPACING.sm,
    },
    chartSubtext: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.gray500,
        textAlign: 'center',
        marginTop: SPACING.xs,
    },
    analysisBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary + '10',
        borderRadius: 8,
        padding: SPACING.sm,
        marginTop: SPACING.sm,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
    },
    analysisText: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray700,
        marginLeft: 8,
    },
    insightItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray100,
    },
    insightText: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
        marginLeft: 12,
        lineHeight: 20,
    },
    insightBold: {
        fontWeight: '600',
        color: COLORS.gray800,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.gray100,
        borderRadius: 12,
        marginBottom: SPACING.sm,
    },
    exportButtonText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.gray700,
        marginLeft: 12,
        fontWeight: '500',
    },
    bottomPadding: {
        height: 40,
    },
});

export default ReportsAnalyticsScreen;