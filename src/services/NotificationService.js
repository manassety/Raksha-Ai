// ====================================================================
// FILE: src/services/NotificationService.js
// ====================================================================
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { STORAGE_KEYS, NOTIFICATION_CHANNELS } from '../config/constants';

export const NotificationService = {
    async initialize() {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Notification permission not granted');
                return { success: false, error: 'Permission denied' };
            }

            // Set up notification channels for Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.EMERGENCY, {
                    name: 'Emergency Alerts',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#EF4444',
                    sound: 'default',
                });

                await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.ALERTS, {
                    name: 'Nearby Alerts',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 100, 100, 100],
                    lightColor: '#3B82F6',
                    sound: 'default',
                });

                await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.GENERAL, {
                    name: 'General Notifications',
                    importance: Notifications.AndroidImportance.DEFAULT,
                    vibrationPattern: [0, 50],
                    lightColor: '#10B981',
                });
            }

            return { success: true };
        } catch (error) {
            console.log('Error initializing notifications:', error);
            return { success: false, error: error.message };
        }
    },

    async getExpoPushToken() {
        try {
            const { data: token } = await Notifications.getExpoPushTokenAsync({
                experienceId: '@rakshaai/emergency',
            });
            return token;
        } catch (error) {
            console.log('Error getting push token:', error);
            return null;
        }
    },

    async sendEmergencyAlert(notification) {
        try {
            const { title, body, data } = notification;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: {
                        ...data,
                        type: 'emergency',
                        channelId: NOTIFICATION_CHANNELS.EMERGENCY,
                    },
                    priority: 'max',
                    vibrate: [0, 250, 250, 250],
                    sound: 'default',
                },
                trigger: null, // Send immediately
            });

            return { success: true };
        } catch (error) {
            console.log('Error sending emergency alert:', error);
            return { success: false, error: error.message };
        }
    },

    async sendNearbyAlert(notification) {
        try {
            const { title, body, data } = notification;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: {
                        ...data,
                        type: 'nearby_alert',
                        channelId: NOTIFICATION_CHANNELS.ALERTS,
                    },
                    priority: 'high',
                    vibrate: [0, 100, 100, 100],
                    sound: 'default',
                },
                trigger: null,
            });

            return { success: true };
        } catch (error) {
            console.log('Error sending nearby alert:', error);
            return { success: false, error: error.message };
        }
    },

    async sendLocalNotification(notification) {
        try {
            const { title, body, data } = notification;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: {
                        ...data,
                        channelId: NOTIFICATION_CHANNELS.GENERAL,
                    },
                },
                trigger: null,
            });

            return { success: true };
        } catch (error) {
            console.log('Error sending local notification:', error);
            return { success: false, error: error.message };
        }
    },

    async cancelAllNotifications() {
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            return { success: true };
        } catch (error) {
            console.log('Error canceling notifications:', error);
            return { success: false, error: error.message };
        }
    },

    async cancelNotification(notificationId) {
        try {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
            return { success: true };
        } catch (error) {
            console.log('Error canceling notification:', error);
            return { success: false, error: error.message };
        }
    },

    async getBadgeCount() {
        try {
            const badgeCount = await Notifications.getBadgeCountAsync();
            return badgeCount;
        } catch (error) {
            return 0;
        }
    },

    async setBadgeCount(count) {
        try {
            await Notifications.setBadgeCountAsync(count);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async incrementBadge() {
        try {
            const current = await this.getBadgeCount();
            await this.setBadgeCount(current + 1);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    addNotificationReceivedListener(callback) {
        return Notifications.addNotificationReceivedListener(callback);
    },

    addNotificationResponseReceivedListener(callback) {
        return Notifications.addNotificationResponseReceivedListener(callback);
    },
};

export default NotificationService;