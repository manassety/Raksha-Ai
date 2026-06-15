// ====================================================================
// FILE: src/hooks/useLocation.js
// ====================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { LocationService } from '../services/LocationService';
import { useLocation as useLocationContext } from '../contexts/LocationContext';

export const useLocation = () => {
    const {
        currentLocation,
        locationHistory,
        isTracking,
        hasPermission,
        error,
        getCurrentLocation: contextGetCurrentLocation,
        requestPermissions: contextRequestPermissions,
        startTracking: contextStartTracking,
        stopTracking: contextStopTracking,
        watchLocation: contextWatchLocation,
        calculateDistance,
    } = useLocationContext();

    const [watchId, setWatchId] = useState(null);
    const [isWatching, setIsWatching] = useState(false);
    const [locationError, setLocationError] = useState(null);

    const startWatching = useCallback(async (callback) => {
        try {
            if (!hasPermission) {
                await contextRequestPermissions();
            }

            const subscription = await LocationService.watchLocation((location) => {
                setWatchId(subscription);
                setIsWatching(true);
                if (callback) {
                    callback(location);
                }
            });

            return subscription;
        } catch (error) {
            setLocationError(error.message);
            return null;
        }
    }, [hasPermission, contextRequestPermissions]);

    const stopWatching = useCallback(() => {
        if (watchId) {
            watchId.remove();
            setWatchId(null);
            setIsWatching(false);
        }
    }, [watchId]);

    const getLocationOnce = useCallback(async () => {
        try {
            setLocationError(null);
            return await contextGetCurrentLocation();
        } catch (error) {
            setLocationError(error.message);
            return null;
        }
    }, [contextGetCurrentLocation]);

    const startBackgroundTracking = useCallback(async (callback) => {
        try {
            setLocationError(null);
            return await contextStartTracking(callback);
        } catch (error) {
            setLocationError(error.message);
            return { success: false, error: error.message };
        }
    }, [contextStartTracking]);

    const stopBackgroundTracking = useCallback(async () => {
        try {
            stopWatching();
            return await contextStopTracking();
        } catch (error) {
            setLocationError(error.message);
            return { success: false, error: error.message };
        }
    }, [contextStopTracking, stopWatching]);

    const getDistanceTo = useCallback((targetLat, targetLon) => {
        if (!currentLocation) return null;
        return calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            targetLat,
            targetLon
        );
    }, [currentLocation, calculateDistance]);

    const formatLocation = useCallback((location) => {
        if (!location) return 'Unknown location';
        return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    }, []);

    const getMapUrl = useCallback((location) => {
        if (!location) return null;
        return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    }, []);

    return {
        currentLocation,
        locationHistory,
        isTracking,
        isWatching,
        hasPermission,
        error: locationError,
        startWatching,
        stopWatching,
        getLocationOnce,
        startBackgroundTracking,
        stopBackgroundTracking,
        getDistanceTo,
        formatLocation,
        getMapUrl,
    };
};

export default useLocation;