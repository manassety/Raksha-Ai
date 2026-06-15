import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import { getAuth } from 'firebase/auth';
import { getDocs, query, where, collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';

const { width } = Dimensions.get('window');


const LiveTrackingScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authoritiesNotified, setAuthoritiesNotified] = useState(false);
  const [emergencyContactNotified, setEmergencyContactNotified] = useState(false);
  const [linkedChildren, setLinkedChildren] = useState([]);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
  const mapRef = useRef(null);

  // Refresh location tracking status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      checkLocationTrackingPreference();
      loadLinkedChildren();
    }, [])
  );

  useEffect(() => {
    checkLocationTrackingPreference();
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      setLoading(false);

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
        newLoc => {
          setLocation(newLoc);
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 1000);
          }
        }
      );
    })();
  }, []);

  const checkLocationTrackingPreference = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setLocationTrackingEnabled(data.locationTracking !== false);
        }
      }
    } catch (error) {
      console.log("Error checking location preference:", error);
      setLocationTrackingEnabled(false);
    }
  };

  const loadLinkedChildren = async () => {
    try {
      const userId = getAuth().currentUser?.uid;
      if (userId) {
        const q = query(collection(db, 'linked_users'), where('parentId', '==', userId), where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        const children = [];
        snapshot.forEach((doc) => {
          children.push({ id: doc.id, ...doc.data() });
        });
        setLinkedChildren(children);
      }
    } catch (error) {
      console.error('Error loading children:', error);
    }
  };

  const notifyAuthorities = async () => {
    if (!locationTrackingEnabled) {
      Alert.alert(
        'Location Tracking Disabled',
        'Please enable Location Tracking in Settings first to share your location.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Settings' })
          }
        ]
      );
      return;
    }
    navigation.navigate('AuthoritiesList', {
      location: { latitude: location.coords.latitude, longitude: location.coords.longitude },
    });
  };

  const notifyContacts = async () => {
    if (!locationTrackingEnabled) {
      Alert.alert(
        'Location Tracking Disabled',
        'Please enable Location Tracking in Settings first to share your location.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Settings' })
          }
        ]
      );
      return;
    }
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Contacts permission required.');
        return;
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (contact?.phoneNumbers?.length) {
        const phone = contact.phoneNumbers[0].number;
        const canSend = await SMS.isAvailableAsync();
        if (canSend) {
          const url = `https://www.google.com/maps/search/?api=1&query=${location.coords.latitude},${location.coords.longitude}`;
          setEmergencyContactNotified(true);
          await SMS.sendSMSAsync([phone], `EMERGENCY! My location: ${url}`);
          Alert.alert('Sent', `Location shared with ${contact.name}.`);
          setTimeout(() => setEmergencyContactNotified(false), 5000);
        } else {
          Alert.alert('Error', 'SMS not available.');
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to access contacts or send SMS.');
    }
  };

  const viewChildLocation = (child) => {
    navigation.navigate('TrackChild', {
      childId: child.childId,
      childName: child.childName,
    });
  };

  const childSetup = () => {
    navigation.navigate('ChildSetup');
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${location.coords.latitude},${location.coords.longitude}`;
    Linking.openURL(url);
  };

  const centerOnUser = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  };

  if (loading) {
    return (
      <GradientBackground colors={GRADIENTS.dark} style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Acquiring location...</Text>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground colors={GRADIENTS.dark} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Live Tracking</Text>
        <TouchableOpacity onPress={childSetup} style={styles.childSetupButton}>
          <Ionicons name="people-circle" size={28} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Location Tracking Status */}
      {!locationTrackingEnabled && (
        <View style={styles.trackingDisabledBanner}>
          <Ionicons name="location-off" size={20} color={COLORS.danger} />
          <Text style={styles.trackingDisabledText}>Location Tracking is Disabled</Text>
          <TouchableOpacity
            style={styles.enableTrackingButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Settings' })}
          >
            <Text style={styles.enableTrackingButtonText}>Enable in Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Leaflet Map via WebView */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="My Location"
          >
            <View style={styles.customMarker}>
              <Ionicons name="person" size={20} color={COLORS.white} />
            </View>
          </Marker>
        </MapView>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.mapButton} onPress={centerOnUser}>
            <Ionicons name="locate" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapButton} onPress={openInMaps}>
            <Ionicons name="globe" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.button, authoritiesNotified && styles.disabledButton, !locationTrackingEnabled && styles.disabledButton]}
          onPress={notifyAuthorities}
          disabled={authoritiesNotified || !locationTrackingEnabled}
        >
          <Ionicons name="call" size={20} color={COLORS.white} />
          <Text style={styles.buttonText}>{authoritiesNotified ? 'Notified' : 'Authorities'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, emergencyContactNotified && styles.disabledButton, !locationTrackingEnabled && styles.disabledButton]}
          onPress={notifyContacts}
          disabled={emergencyContactNotified || !locationTrackingEnabled}
        >
          <Ionicons name="people" size={20} color={COLORS.white} />
          <Text style={styles.buttonText}>{emergencyContactNotified ? 'Notified' : 'Contacts'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            if (linkedChildren.length === 1) {
              viewChildLocation(linkedChildren[0]);
            } else if (linkedChildren.length > 1) {
              Alert.alert('Select a Child', 'You have multiple linked users. Please tap their profile from the list below the map to view their location.');
            } else {
              Alert.alert('No Users Linked', 'Please setup tracking first.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Setup', onPress: childSetup }
              ]);
            }
          }}
        >
          <Ionicons name="locate" size={20} color={COLORS.white} />
          <Text style={styles.buttonText}>Track Child</Text>
        </TouchableOpacity>
      </View>

      {/* Linked Children Section */}
      {linkedChildren.length > 0 && (
        <View style={styles.childrenSection}>
          <Text style={styles.sectionTitle}>Linked Users</Text>
          <FlatList
            horizontal
            data={linkedChildren}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.childCard} onPress={() => viewChildLocation(item)}>
                <View style={styles.childAvatar}>
                  <Ionicons name="person" size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.childName}>{item.childName}</Text>
                <View style={styles.childStatus}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Location Info */}
      <View style={styles.locationInfoBox}>
        <View style={styles.locationInfoRow}>
          <Ionicons name="location-outline" size={18} color={COLORS.primary} />
          <Text style={styles.locationInfoText}>
            {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
          </Text>
        </View>
        <View style={styles.locationInfoRow}>
          <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
          <Text style={styles.locationInfoText}>Accuracy: ±{Math.round(location.coords.accuracy)} m</Text>
        </View>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.lg },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  childSetupButton: { padding: 4 },
  loadingText: { color: COLORS.white, marginTop: SPACING.md, fontSize: FONT_SIZES.md },
  trackingDisabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger + '20',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    gap: 8,
  },
  trackingDisabledText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    flex: 1,
  },
  enableTrackingButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  enableTrackingButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  mapContainer: { height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: SPACING.md, backgroundColor: '#242f3e' },
  map: { flex: 1, backgroundColor: '#242f3e' },
  mapControls: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'column', gap: 8 },
  mapButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  customMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white, elevation: 5 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  button: { flex: 1, backgroundColor: COLORS.primary, marginHorizontal: SPACING.xs, paddingVertical: SPACING.md, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  disabledButton: { backgroundColor: COLORS.gray600 },
  buttonText: { color: COLORS.white, marginLeft: 8, fontSize: FONT_SIZES.xs, fontWeight: '600' },
  childrenSection: { marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.white, marginBottom: SPACING.sm },
  childCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md, marginRight: SPACING.sm, width: 140, alignItems: 'center' },
  childAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  childName: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.gray800, textAlign: 'center' },
  childStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 4 },
  statusText: { fontSize: FONT_SIZES.xs, color: COLORS.gray500 },
  locationInfoBox: { backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md },
  locationInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  locationInfoText: { marginLeft: 8, color: COLORS.gray700, fontSize: FONT_SIZES.sm },
});

export default LiveTrackingScreen;