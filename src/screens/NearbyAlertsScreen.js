import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Modal, RefreshControl, TouchableWithoutFeedback, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { SCREEN_NAMES } from '../config/constants';
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit, updateDoc, deleteDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

const NearbyAlertsScreen = () => {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showAlertDetail, setShowAlertDetail] = useState(false);
  const [linkRequests, setLinkRequests] = useState([]);

  const { userData } = useAuth();
  const isAdminUser = userData?.isAdmin === true || userData?.isMainAdmin === true;

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const alertsData = [];
      const unreadAlertIds = [];
      const currentTimestamp = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const createdAt = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().getTime() : data.createdAt) : currentTimestamp;

        // AUTO-RESOLVE STUCK ALERTS: If it's 'ongoing' but older than 1 hour, it's likely stuck.
        if (data.status === 'ongoing' && (currentTimestamp - createdAt > ONE_HOUR)) {
          updateDoc(doc(db, 'alerts', docId), { status: 'resolved' }).catch(e => console.log("Auto-resolve failed:", e));
          data.status = 'resolved'; // Update local data for immediate UI feedback
        }

        alertsData.push({
          id: docId,
          ...data,
          createdAt: new Date(createdAt),
        });
        if (data.read === false) {
          unreadAlertIds.push(docId);
        }
      });
      if (unreadAlertIds.length > 0) {
        Promise.all(unreadAlertIds.map(id => updateDoc(doc(db, 'alerts', id), { read: true }))).catch(err => console.error('Error auto-marking alerts as read:', err));
      }
      setAlerts(alertsData);
    });

    const currentUser = getAuth().currentUser;
    const linkQ = query(
      collection(db, 'linked_users'),
      where('childEmail', '==', currentUser?.email?.toLowerCase() || ''),
      where('status', '==', 'pending')
    );
    const unsubscribeLinks = onSnapshot(linkQ, (snapshot) => {
      const linksData = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        linksData.push({
          id: docSnap.id,
          isLinkRequest: true,
          title: 'Parental Link Request',
          message: `${data.parentEmail || 'Your parent'} wants to link with your account to track your location.`,
          type: 'link_request',
          priority: 'high',
          status: 'pending',
          createdAt: data.createdAt ? new Date(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
          read: false,
          ...data
        });
      });
      setLinkRequests(linksData);
    });

    return () => {
      unsubscribe();
      unsubscribeLinks();
    };
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      // Get all alerts from Firestore
      const alertsSnapshot = await getDocs(
        query(collection(db, 'alerts'), orderBy('createdAt', 'desc'))
      );

      const alertsData = [];
      const unreadAlertIds = [];

      alertsSnapshot.forEach((doc) => {
        const data = doc.data();
        alertsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
        });
        if (data.read === false) {
          unreadAlertIds.push(doc.id);
        }
      });

      // Mark all unread alerts as read when user visits the page
      if (unreadAlertIds.length > 0) {
        Promise.all(unreadAlertIds.map(id =>
          updateDoc(doc(db, 'alerts', id), { read: true })
        )).catch(err => console.error('Error auto-marking alerts as read:', err));
      }

      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading alerts:', error);
      setAlerts([]);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleClearAllAlerts = () => {
    const hasResolvedAlerts = alerts.some(a => a.status === 'resolved');
    if (!hasResolvedAlerts) {
      Alert.alert('Notice', 'There are no resolved alerts to clear. Ongoing alerts cannot be cleared.');
      return;
    }
    setShowClearModal(true);
  };

  const handleResolveAll = async () => {
    Alert.alert(
      "Resolve All Alerts",
      "Are you sure you want to mark all ongoing alerts as 'Resolved'? This will update all stuck notifications.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Resolve All",
          onPress: async () => {
            setLoading(true);
            try {
              const ongoingAlerts = alerts.filter(a => a.status === 'ongoing');
              await Promise.all(
                ongoingAlerts.map(alert => updateDoc(doc(db, 'alerts', alert.id), { status: 'resolved' }))
              );
              Alert.alert('Success', 'All ongoing alerts have been resolved.');
            } catch (error) {
              console.error('Error resolving alerts:', error);
              Alert.alert('Error', 'Failed to update alerts.');
            }
            setLoading(false);
          }
        }
      ]
    );
  };

  const confirmClearAll = async () => {
    try {
      const resolvedAlerts = alerts.filter(a => a.status === 'resolved');
      const ongoingAlertsIds = alerts.filter(a => a.status === 'ongoing').map(a => a.id);

      await Promise.all(
        resolvedAlerts.map(alert => {
          if (alert.id && alert.id.length > 5) {
            return deleteDoc(doc(db, 'alerts', alert.id));
          }
          return Promise.resolve();
        })
      );

      setShowClearModal(false);
      Alert.alert('Success', 'All resolved alerts have been cleared.');
    } catch (error) {
      console.error('Error clearing alerts:', error);
      setShowClearModal(false);
      Alert.alert('Error', 'Failed to clear alerts.');
    }
  };

  const handleAlertPress = (alert) => {
    setSelectedAlert(alert);
    setShowAlertDetail(true);
  };

  const handleMarkAsRead = async (alertId) => {
    try {
      const alertRef = doc(db, 'alerts', alertId);
      await updateDoc(alertRef, { read: true });

      setAlerts(alerts.map(alert =>
        alert.id === alertId ? { ...alert, read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (selectedAlert?.isLinkRequest) {
      try {
        await deleteDoc(doc(db, 'linked_users', alertId));
        setLinkRequests(linkRequests.filter(req => req.id !== alertId));
        setShowAlertDetail(false);
        setSelectedAlert(null);
        Alert.alert('Notice', 'Link request deleted.');
      } catch (err) {
        console.error('Error deleting link request:', err);
      }
      return;
    }

    const alertToDelete = alerts.find(a => a.id === alertId);
    if (alertToDelete && alertToDelete.status !== 'resolved') {
      Alert.alert('Notice', 'Ongoing alerts cannot be deleted.');
      return;
    }
    try {
      if (alertId && alertId.length > 5) {
        await deleteDoc(doc(db, 'alerts', alertId));
      }
      setAlerts(alerts.filter(alert => alert.id !== alertId));
      setShowAlertDetail(false);
      setSelectedAlert(null);
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleAcceptLink = async (linkId) => {
    try {
      await updateDoc(doc(db, 'linked_users', linkId), { status: 'active' });
      Alert.alert('Success', 'Link request accepted.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to accept link request.');
    }
  };

  const handleRejectLink = async (linkId) => {
    try {
      await updateDoc(doc(db, 'linked_users', linkId), { status: 'rejected' });
      Alert.alert('Notice', 'Link request rejected.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to reject link request.');
    }
  };

  const handleOpenLocation = (url) => {
    if (url) {
      Linking.openURL(url).catch(err => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Could not open location link.');
      });
    }
  };

  const getAlertIcon = (type, priority) => {
    switch (type) {
      case 'sos':
        return <Ionicons name="alert-circle" size={24} color={COLORS.danger} />;
      case 'crime':
        return <Ionicons name="warning" size={24} color={COLORS.warning} />;
      case 'link_request':
        return <Ionicons name="people" size={24} color={COLORS.primary} />;
      case 'alert':
        return <Ionicons name="notifications" size={24} color={COLORS.info} />;
      default:
        return <Ionicons name="notifications" size={24} color={COLORS.gray500} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ongoing':
        return COLORS.danger;
      case 'resolved':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      default:
        return COLORS.gray500;
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderAlertItem = ({ item }) => {
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[styles.alertCard, isUnread && styles.unreadAlert]}
        onPress={() => handleAlertPress(item)}
      >
        <View style={[styles.alertIcon, { backgroundColor: getPriorityColor(item.priority) + '20' }]}>
          {getAlertIcon(item.type, item.priority)}
        </View>

        <View style={styles.alertContent}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertTitle}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.alertMessage} numberOfLines={2}>{item.message}</Text>

          <View style={styles.alertMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="location" size={14} color={COLORS.gray500} />
              <Text style={styles.metaText}>{item.locationName || 'Location Shared'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time" size={14} color={COLORS.gray500} />
              <Text style={styles.metaText}>{getTimeAgo(item.createdAt)}</Text>
            </View>
          </View>

          {item.locationUrl && (
            <TouchableOpacity
              style={styles.cardMapButton}
              onPress={() => handleOpenLocation(item.locationUrl)}
            >
              <Ionicons name="navigate-circle" size={16} color={COLORS.primary} />
              <Text style={styles.cardMapButtonText}>View Location</Text>
            </TouchableOpacity>
          )}

          {item.isLinkRequest && (
            <View style={styles.linkActions}>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptLink(item.id)}>
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectLink(item.id)}>
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return COLORS.danger;
      case 'medium':
        return COLORS.warning;
      case 'low':
        return COLORS.info;
      default:
        return COLORS.gray500;
    }
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off" size={60} color={COLORS.gray400} />
      <Text style={styles.emptyTitle}>No Alerts</Text>
      <Text style={styles.emptyText}>You're all caught up! No nearby alerts at the moment.</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Nearby Alerts</Text>
      <View style={styles.headerButtons}>
        {isAdminUser && alerts.some(a => a.status === 'ongoing') && (
          <TouchableOpacity style={[styles.clearButton, { backgroundColor: COLORS.success, marginRight: 8 }]} onPress={handleResolveAll}>
            <Ionicons name="checkmark-done-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.clearButtonText}>Resolve All</Text>
          </TouchableOpacity>
        )}
        {alerts.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAllAlerts}>
            <Ionicons name="trash-outline" size={18} color={COLORS.white} />
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <GradientBackground colors={GRADIENTS.dark}>
      <View style={styles.container}>
        {renderHeader()}

        <FlatList
          data={[...linkRequests, ...alerts].sort((a, b) => b.createdAt - a.createdAt)}
          renderItem={renderAlertItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Clear All Confirmation Modal */}
        <Modal visible={showClearModal} animationType="fade" transparent>
          <TouchableWithoutFeedback onPress={() => setShowClearModal(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <View style={styles.modalIcon}>
                    <Ionicons name="warning" size={40} color={COLORS.warning} />
                  </View>
                  <Text style={styles.modalTitle}>Clear All Alerts?</Text>
                  <Text style={styles.modalText}>
                    This will permanently remove {alerts.filter(a => a.status === 'resolved').length} resolved alerts from your notification list. Ongoing alerts will remain. This action cannot be undone.
                  </Text>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setShowClearModal(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={confirmClearAll}
                    >
                      <Text style={styles.confirmButtonText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Alert Detail Modal */}
        <Modal visible={showAlertDetail} animationType="slide" transparent>
          <TouchableWithoutFeedback onPress={() => setShowAlertDetail(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.detailModalContent}>
                  {selectedAlert && (
                    <>
                      <View style={styles.detailHeader}>
                        <View style={[styles.detailIcon, { backgroundColor: getPriorityColor(selectedAlert.priority) + '20' }]}>
                          {getAlertIcon(selectedAlert.type, selectedAlert.priority)}
                        </View>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteAlert(selectedAlert.id)}
                        >
                          <Ionicons name="trash" size={20} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.detailStatusRow}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedAlert.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedAlert.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(selectedAlert.status) }]}>
                            {selectedAlert.status.charAt(0).toUpperCase() + selectedAlert.status.slice(1)}
                          </Text>
                        </View>
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedAlert.priority) + '20' }]}>
                          <Text style={[styles.priorityText, { color: getPriorityColor(selectedAlert.priority) }]}>
                            {selectedAlert.priority.toUpperCase()} PRIORITY
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.detailTitle}>{selectedAlert.title}</Text>
                      <Text style={styles.detailMessage}>{selectedAlert.message}</Text>

                      <View style={styles.detailInfo}>
                        <View style={styles.detailInfoItem}>
                          <Ionicons name="location-outline" size={20} color={COLORS.gray500} />
                          <View style={styles.detailInfoContent}>
                            <Text style={styles.detailInfoLabel}>Location</Text>
                            <Text style={styles.detailInfoValue}>{selectedAlert.locationName || 'Location address not specified'}</Text>
                          </View>
                        </View>

                        <View style={styles.detailInfoItem}>
                          <Ionicons name="navigate-outline" size={20} color={COLORS.gray500} />
                          <View style={styles.detailInfoContent}>
                            <Text style={styles.detailInfoLabel}>Coordinates</Text>
                            <Text style={styles.detailInfoValue}>Available via Map Link</Text>
                          </View>
                        </View>

                        <View style={styles.detailInfoItem}>
                          <Ionicons name="time-outline" size={20} color={COLORS.gray500} />
                          <View style={styles.detailInfoContent}>
                            <Text style={styles.detailInfoLabel}>Reported</Text>
                            <Text style={styles.detailInfoValue}>
                              {selectedAlert.createdAt.toLocaleString()}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.detailInfoItem}>
                          <Ionicons name="finger-print-outline" size={20} color={COLORS.gray500} />
                          <View style={styles.detailInfoContent}>
                            <Text style={styles.detailInfoLabel}>Alert ID</Text>
                            <Text style={styles.detailInfoValue}>{selectedAlert.id}</Text>
                          </View>
                        </View>

                        {selectedAlert.locationUrl && (
                          <TouchableOpacity
                            style={styles.viewLocationBtn}
                            onPress={() => handleOpenLocation(selectedAlert.locationUrl)}
                          >
                            <Ionicons name="map-outline" size={20} color={COLORS.white} />
                            <Text style={styles.viewLocationBtnText}>View on Maps</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.detailActions}>
                        {!selectedAlert.read && (
                          <TouchableOpacity
                            style={styles.markReadButton}
                            onPress={() => handleMarkAsRead(selectedAlert.id)}
                          >
                            <Ionicons name="checkmark-done" size={18} color={COLORS.primary} />
                            <Text style={styles.markReadText}>Mark as Read</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={styles.closeButton}
                          onPress={() => setShowAlertDetail(false)}
                        >
                          <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
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
  headerTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.white, flex: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  clearButtonText: { color: COLORS.white, fontSize: 11, fontWeight: '600', marginLeft: 4 },
  listContent: { padding: SPACING.md },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'flex-start',
  },
  unreadAlert: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: { flex: 1, marginLeft: 12 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  alertTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gray800, flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
  alertMessage: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, marginBottom: 8, lineHeight: 18 },
  alertMeta: { flexDirection: 'row', alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.gray500, marginLeft: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, marginLeft: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.gray600, marginTop: SPACING.md },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.gray400, textAlign: 'center', marginTop: 8, paddingHorizontal: SPACING.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 24, padding: SPACING.xl, width: '100%', maxWidth: 340 },
  modalIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.warning + '20', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800, textAlign: 'center', marginBottom: 8 },
  modalText: { fontSize: FONT_SIZES.md, color: COLORS.gray600, textAlign: 'center', marginBottom: SPACING.lg, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.gray100, marginRight: 8, alignItems: 'center' },
  cancelButtonText: { color: COLORS.gray600, fontSize: FONT_SIZES.md, fontWeight: '600' },
  confirmButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.danger, marginLeft: 8, alignItems: 'center' },
  confirmButtonText: { color: COLORS.white, fontSize: FONT_SIZES.md, fontWeight: '600' },
  detailModalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, maxHeight: '80%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  detailIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { padding: 8 },
  detailStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  priorityText: { fontSize: FONT_SIZES.xs, fontWeight: '700' },
  detailTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 8 },
  detailMessage: { fontSize: FONT_SIZES.md, color: COLORS.gray600, lineHeight: 22, marginBottom: SPACING.lg },
  detailInfo: { backgroundColor: COLORS.gray100, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.lg },
  detailInfoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailInfoContent: { marginLeft: 12 },
  detailInfoLabel: { fontSize: FONT_SIZES.xs, color: COLORS.gray500 },
  detailInfoValue: { fontSize: FONT_SIZES.sm, color: COLORS.gray800, fontWeight: '500' },
  detailActions: { flexDirection: 'row', alignItems: 'center' },
  markReadButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.primary + '20', marginRight: 8 },
  markReadText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: '600', marginLeft: 6 },
  closeButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.gray200, marginLeft: 8, alignItems: 'center' },
  closeButtonText: { color: COLORS.gray700, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  viewLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  viewLocationBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginLeft: 8,
  },
  cardMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: COLORS.primary + '10',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  cardMapButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  linkActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
});

export default NearbyAlertsScreen;