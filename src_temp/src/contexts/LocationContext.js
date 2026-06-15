// ====================================================================
// FILE: src/contexts/LocationContext.js
// ====================================================================
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { StorageService } from '../services/StorageService';
import { LocationService } from '../services/LocationService';
import { STORAGE_KEYS } from '../config/constants';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationHistory, setLocationHistory] = useState([]);
    const [isTracking, setIsTracking] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkPermissions();
        loadLocationHistory();
    }, []);

    const checkPermissions = async () => {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
                (true);
            }
        } catch (setHasPermissionerror) {
            console.log('Error checking permissions:', error);
        }
    };

    const requestPermissions = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                setHasPermission(true);
                return { success: true };
            }
            setHasPermission(false);
            return { success: false, error: 'Permission denied' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const loadLocationHistory = async () => {
        try {
            const history = await StorageService.get(STORAGE_KEYS.EMERGENCY_LOGS);
            if (history) {
                // Extract location data from logs
                const locations = history
                    .filter(log => log.location)
                    .map(log => log.location);
                setLocationHistory(locations);
            }
        } catch (error) {
            console.log('Error loading location history:', error);
        }
    };

    const getCurrentLocation = useCallback(async () => {
        try {
            if (!hasPermission) {
                await requestPermissions();
            }

            const location = await LocationService.getCurrentLocation();
            setCurrentLocation(location);

            // Add to history
            const newHistory = [location, ...locationHistory].slice(0, 100);
            setLocationHistory(newHistory);

            return location;
        } catch (error) {
            setError(error.message);
            return null;
        }
    }, [hasPermission]);

    const startTracking = useCallback(async () => {
        try {
            if (!hasPermission) {
                await requestPermissions();
            }

            setIsTracking(true);

            // Start background location tracking
            await LocationService.startBackgroundTracking((location) => {
                setCurrentLocation(location);
                const newHistory = [location, ...locationHistory].slice(0, 100);
                setLocationHistory(newHistory);
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [hasPermission]);

    const stopTracking = useCallback(async () => {
        try {
            setIsTracking(false);
            await LocationService.stopBackgroundTracking();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, []);

    const watchLocation = useCallback(async () => {
        try {
            return await LocationService.watchLocation((location) => {
                setCurrentLocation(location);
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, []);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        return LocationService.calculateDistance(lat1, lon1, lat2, lon2);
    };

    const value = {
        currentLocation,
        locationHistory,
        isTracking,
        hasPermission,
        error,
        getCurrentLocation,
        requestPermissions,
        startTracking,
        stopTracking,
        watchLocation,
        calculateDistance,
    };

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};

export default LocationContext;