// ====================================================================
// FILE: src/hooks/usePermissions.js
// ====================================================================
import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as Audio from 'expo-av';
import * as SMS from 'expo-sms';

export const usePermissions = () => {
    const [permissions, setPermissions] = useState({
        location: 'undetermined',
        contacts: 'undetermined',
        notifications: 'undetermined',
        camera: 'undetermined',
        microphone: 'undetermined',
        sms: 'undetermined',
    });

    const [allGranted, setAllGranted] = useState(false);

    useEffect(() => {
        checkAllPermissions();
    }, []);

    useEffect(() => {
        const allGrantedNow = Object.values(permissions).every(p => p === 'granted');
        setAllGranted(allGrantedNow);
    }, [permissions]);

    const checkAllPermissions = async () => {
        try {
            const [location, contacts, camera, microphone, sms] = await Promise.all([
                Location.getForegroundPermissionsAsync(),
                Contacts.getPermissionsAsync(),
                ImagePicker.getCameraPermissionsAsync(),
                Audio.getPermissionsAsync(),
                SMS.isAvailableAsync().then(available => ({ status: available ? 'granted' : 'denied' })),
            ]);

            // Check notification permission separately as it might not have status
            let notifications = { status: 'granted' };
            try {
                await Notifications.getPermissionsAsync();
            } catch (e) {
                notifications = { status: 'denied' };
            }

            setPermissions({
                location: location.status,
                contacts: contacts.status,
                notifications: notifications.status,
                camera: camera.status,
                microphone: microphone.status,
                sms: sms.status,
            });
        } catch (error) {
            console.log('Error checking permissions:', error);
        }
    };

    const requestLocation = useCallback(async (background = false) => {
        try {
            const { status } = background
                ? await Location.requestBackgroundPermissionsAsync()
                : await Location.requestForegroundPermissionsAsync();

            setPermissions(prev => ({ ...prev, location: status }));
            return status === 'granted';
        } catch (error) {
            return false;
        }
    }, []);

    const requestContacts = useCallback(async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            setPermissions(prev => ({ ...prev, contacts: status }));
            return status === 'granted';
        } catch (error) {
            return false;
        }
    }, []);

    const requestNotifications = useCallback(async () => {
        try {
            const { status } = await Notifications.requestPermissionsAsync();
            setPermissions(prev => ({ ...prev, notifications: status }));
            return status === 'granted';
        } catch (error) {
            return false;
        }
    }, []);

    const requestCamera = useCallback(async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            setPermissions(prev => ({ ...prev, camera: status }));
            return status === 'granted';
        } catch (error) {
            return false;
        }
    }, []);

    const requestMicrophone = useCallback(async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            setPermissions(prev => ({ ...prev, microphone: status }));
            return status === 'granted';
        } catch (error) {
            return false;
        }
    }, []);

    const requestSMS = useCallback(async () => {
        try {
            const isAvailable = await SMS.isAvailableAsync();
            setPermissions(prev => ({ ...prev, sms: isAvailable ? 'granted' : 'unavailable' }));
            return isAvailable;
        } catch (error) {
            return false;
        }
    }, []);

    const requestAllPermissions = useCallback(async () => {
        const results = await Promise.all([
            requestLocation(),
            requestContacts(),
            requestNotifications(),
            requestCamera(),
            requestMicrophone(),
            requestSMS(),
        ]);

        await checkAllPermissions();
        return results.every(r => r);
    }, [requestLocation, requestContacts, requestNotifications, requestCamera, requestMicrophone, requestSMS]);

    const getPermissionStatus = useCallback((permission) => {
        return permissions[permission] || 'undetermined';
    }, [permissions]);

    return {
        permissions,
        allGranted,
        checkAllPermissions,
        requestLocation,
        requestContacts,
        requestNotifications,
        requestCamera,
        requestMicrophone,
        requestSMS,
        requestAllPermissions,
        getPermissionStatus,
    };
};

export default usePermissions;