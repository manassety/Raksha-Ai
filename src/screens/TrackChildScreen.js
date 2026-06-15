import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';

import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';

import { db } from '../config/firebase';

const TrackChildScreen = () => {

  const navigation = useNavigation();
  const route = useRoute();
  const { childId, childName } = route.params;

  const [loading, setLoading] = useState(true);
  const [childLocation, setChildLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [homeLocation, setHomeLocation] = useState(null);
  const [isAtHome, setIsAtHome] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const mapRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const [isTrackingOff, setIsTrackingOff] = useState(false);

  useEffect(() => {
    loadChildData();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [childId]);

  /* ================= LOAD DATA ================= */

  const loadChildData = async () => {
    try {

      // Get Home Location
      const childDoc = await getDoc(doc(db, 'users', childId));
      let trackingOff = false;

      if (childDoc.exists()) {
        const data = childDoc.data();
        if (data.homeLocation) {
          setHomeLocation(data.homeLocation);
        }
        if (data.locationTracking === false) {
          trackingOff = true;
          setIsTrackingOff(true);
        }
      }

      // History
      const historyQuery = query(
        collection(db, 'location_history'),
        where('userId', '==', childId),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(historyQuery);

      const history = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      setLocationHistory(history);

      // LIVE LOCATION
      const locationRef = doc(db, 'user_locations', childId);

      const processLocationData = (data) => {
        const newLocation = {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp?.toDate?.() || new Date(),
        };

        setChildLocation(newLocation);
        setLastUpdated(newLocation.timestamp);
        setLoading(false);

        // Distance Check
        if (homeLocation) {
          const distance = getDistanceFromLatLonInKm(
            newLocation.latitude,
            newLocation.longitude,
            homeLocation.latitude,
            homeLocation.longitude
          );
          setIsAtHome(distance <= 0.1);
        }

        // Animate map
        mapRef.current?.animateToRegion({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      };

      if (trackingOff) {
        const docSnap = await getDoc(locationRef);
        if (docSnap.exists()) {
          processLocationData(docSnap.data());
        } else if (history.length > 0) {
          processLocationData(history[0]);
        } else {
          setLoading(false);
          setIsTrackingOff(true); // they have no location
        }
      } else {
        unsubscribeRef.current = onSnapshot(locationRef, snap => {
          if (!snap.exists()) return;
          processLocationData(snap.data());
        });
      }

    } catch (err) {
      console.log('Error:', err);
      setLoading(false);
    }
  };

  /* ================= DISTANCE ================= */

  const deg2rad = deg => deg * (Math.PI / 180);

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;

    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  /* ================= HELPERS ================= */

  const formatTime = date => {
    if (!date) return 'Unknown';

    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ✅ FIXED reverse mutation bug
  const getRouteCoordinates = () =>
    [...locationHistory]
      .reverse()
      .map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <GradientBackground colors={GRADIENTS.dark}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.loadingText}>
            Loading {childName}'s location...
          </Text>
        </View>
      </GradientBackground>
    );
  }

  /* ================= UI ================= */

  return (
    <GradientBackground colors={GRADIENTS.dark}>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{childName}</Text>

          <View style={{ width: 24 }} />
        </View>

        {isTrackingOff && (
          <View style={{ backgroundColor: COLORS.warning, padding: SPACING.sm, alignItems: 'center' }}>
            <Text style={{ color: COLORS.gray900, fontWeight: 'bold' }}>Live Tracking is OFF. Showing Last Location.</Text>
          </View>
        )}

        {/* MAP */}
        <View style={styles.mapContainer}>
          {childLocation && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: childLocation.latitude,
                longitude: childLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >

              <Marker coordinate={childLocation}>
                <View style={styles.childMarker}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
              </Marker>

              {homeLocation && (
                <Circle
                  center={homeLocation}
                  radius={100}
                  strokeWidth={2}
                  strokeColor={COLORS.success}
                  fillColor={COLORS.success + '30'}
                />
              )}

              {locationHistory.length > 1 && (
                <Polyline
                  coordinates={getRouteCoordinates()}
                  strokeColor={COLORS.primary}
                  strokeWidth={3}
                />
              )}

            </MapView>
          )}
        </View>

      </View>
    </GradientBackground>
  );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: COLORS.white,
    marginTop: 10,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },

  mapContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },

  map: { flex: 1 },

  childMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TrackChildScreen;