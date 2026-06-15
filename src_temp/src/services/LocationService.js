// ====================================================================
// FILE: src/services/LocationService.js
// ====================================================================
import * as Location from 'expo-location';
import { StorageService } from './StorageService';
import { STORAGE_KEYS } from '../config/constants';

let locationTask = null;
let locationCallback = null;

export const LocationService = {
    async getCurrentLocation() {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();

            if (status !== 'granted') {
                const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
                if (newStatus !== 'granted') {
                    throw new Error('Location permission not granted');
                }
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.HIGH,
                timeout: 10000,
                maximumAge: 10000,
            });

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                altitude: location.coords.altitude,
                speed: location.coords.speed,
                timestamp: location.timestamp,
            };
        } catch (error) {
            console.log('Error getting current location:', error);
            // Return last known location if available
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown) {
                return {
                    latitude: lastKnown.coords.latitude,
                    longitude: lastKnown.coords.longitude,
                    accuracy: lastKnown.coords.accuracy,
                    timestamp: lastKnown.timestamp,
                };
            }
            throw error;
        }
    },

    async startBackgroundTracking(callback) {
        try {
            const { status } = await Location.getBackgroundPermissionsAsync();

            if (status !== 'granted') {
                const { status: newStatus } = await Location.requestBackgroundPermissionsAsync();
                if (newStatus !== 'granted') {
                    throw new Error('Background location permission not granted');
                }
            }

            locationCallback = callback;

            await Location.startLocationUpdatesAsync('location-tracking', {
                accuracy: Location.Accuracy.HIGH,
                timeInterval: 10000,
                distanceInterval: 10,
                foregroundService: {
                    notificationTitle: 'Tanprix Safety Tracking',
                    notificationBody: 'Your location is being tracked for safety',
                    notificationColor: '#1e3a8a',
                },
            });

            // Also start watching location for immediate updates
            locationTask = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.HIGH,
                    timeInterval: 10000,
                    distanceInterval: 10,
                },
                (location) => {
                    const locationData = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        accuracy: location.coords.accuracy,
                        timestamp: location.timestamp,
                    };

                    if (locationCallback) {
                        locationCallback(locationData);
                    }
                }
            );

            return { success: true };
        } catch (error) {
            console.log('Error starting background tracking:', error);
            return { success: false, error: error.message };
        }
    },

    async stopBackgroundTracking() {
        try {
            if (locationTask) {
                locationTask.remove();
                locationTask = null;
            }

            await Location.stopLocationUpdatesAsync('location-tracking');
            locationCallback = null;

            return { success: true };
        } catch (error) {
            console.log('Error stopping background tracking:', error);
            return { success: false, error: error.message };
        }
    },

    async watchLocation(callback) {
        try {
            const subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.HIGH,
                    timeInterval: 5000,
                    distanceInterval: 5,
                },
                (location) => {
                    callback({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        accuracy: location.coords.accuracy,
                        timestamp: location.timestamp,
                    });
                }
            );

            return subscription;
        } catch (error) {
            console.log('Error watching location:', error);
            return null;
        }
    },

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    toRad(deg) {
        return deg * (Math.PI / 180);
    },

    async getAddressFromCoordinates(latitude, longitude) {
        try {
            const reverseGeocodedAddress = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (reverseGeocodedAddress.length > 0) {
                const address = reverseGeocodedAddress[0];
                return {
                    street: address.street,
                    city: address.city,
                    region: address.region,
                    country: address.country,
                    postalCode: address.postalCode,
                    formatted: `${address.street || ''}, ${address.city || ''}, ${address.region || ''}`,
                };
            }
            return null;
        } catch (error) {
            console.log('Error reverse geocoding:', error);
            return null;
        }
    },
};

export default LocationService;