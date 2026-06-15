import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Linking, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as SMS from 'expo-sms';
import GradientBackground from '../components/GradientBackground';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';

// List of emergency authorities and helpline numbers
const AUTHORITIES_LIST = [
    {
        id: '1',
        name: 'Police Emergency',
        number: '100',
        icon: 'shield-checkmark',
        color: '#1E88E5',
        description: 'For immediate police assistance',
    },
    {
        id: '2',
        name: 'Women Helpline',
        number: '1091',
        icon: 'woman',
        color: '#E91E63',
        description: 'Women safety and assistance',
    },
    {
        id: '3',
        name: 'Ambulance',
        number: '102',
        icon: 'medkit',
        color: '#F44336',
        description: 'Medical emergency services',
    },
    {
        id: '4',
        name: 'Fire Department',
        number: '101',
        icon: 'flame',
        color: '#FF9800',
        description: 'Fire and rescue services',
    },
    {
        id: '5',
        name: 'Child Helpline',
        number: '1098',
        icon: 'happy',
        color: '#4CAF50',
        description: 'Child protection and rescue',
    },
    {
        id: '6',
        name: 'Emergency Response',
        number: '112',
        icon: 'call',
        color: '#9C27B0',
        description: 'National emergency number',
    },
    {
        id: '7',
        name: 'Traffic Police',
        number: '103',
        icon: 'car',
        color: '#00BCD4',
        description: 'Traffic emergencies',
    },
    {
        id: '8',
        name: 'Cyber Crime',
        number: '1930',
        icon: 'globe',
        color: '#607D8B',
        description: 'Cyber fraud and crime reporting',
    },
];

const AuthoritiesListScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location } = route.params || {};
    const [loading, setLoading] = useState(false);

    const handleCall = (item) => {
        const phoneNumber = `tel:${item.number}`;
        Linking.openURL(phoneNumber).catch(err => {
            Alert.alert('Error', 'Unable to make call');
        });
    };

    const handleShareLocation = async (item) => {
        if (!location) {
            Alert.alert('Error', 'Location not available');
            return;
        }

        setLoading(true);
        try {
            // Check if SMS is available
            const canSend = await SMS.isAvailableAsync();
            if (!canSend) {
                Alert.alert('Error', 'SMS is not available on this device');
                setLoading(false);
                return;
            }

            // Create location URL
            const locationUrl = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=15`;
            const message = `EMERGENCY! I need help from ${item.name}.\n\nMy Location: ${locationUrl}\n\nCoordinates: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

            // Open SMS app with pre-filled message
            await SMS.sendSMSAsync([item.number], message);

            Alert.alert('Success', `Location shared with ${item.name} via SMS!`);
        } catch (error) {
            console.error('SMS Error:', error);
            Alert.alert('Error', 'Failed to send SMS. Please try again.');
        }
        setLoading(false);
    };

    const renderAuthorityItem = ({ item }) => (
        <TouchableOpacity
            style={styles.authorityCard}
            onPress={() => {
                Alert.alert(
                    item.name,
                    `Choose an action for ${item.name} (${item.number})`,
                    [
                        {
                            text: 'Call Now',
                            onPress: () => handleCall(item),
                        },
                        {
                            text: 'Share Location',
                            onPress: () => handleShareLocation(item),
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel',
                        },
                    ]
                );
            }}
        >
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={28} color={item.color} />
            </View>

            <View style={styles.authorityInfo}>
                <Text style={styles.authorityName}>{item.name}</Text>
                <Text style={styles.authorityNumber}>{item.number}</Text>
                <Text style={styles.authorityDescription}>{item.description}</Text>
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: item.color }]}
                    onPress={() => handleCall(item)}
                >
                    <Ionicons name="call" size={20} color={COLORS.white} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                    onPress={() => handleShareLocation(item)}
                >
                    {loading ? (
                        <Ionicons name="time" size={20} color={COLORS.white} />
                    ) : (
                        <Ionicons name="location" size={20} color={COLORS.white} />
                    )}
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Emergency Contacts</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Info Text */}
                <View style={styles.infoContainer}>
                    <Ionicons name="information-circle" size={20} color={COLORS.primary} />
                    <Text style={styles.infoText}>
                        Tap on an authority to call or share your live location via SMS
                    </Text>
                </View>

                {/* Authorities List */}
                <FlatList
                    data={AUTHORITIES_LIST}
                    keyExtractor={(item) => item.id}
                    renderItem={renderAuthorityItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                />

                {/* Current Location Info */}
                {location && (
                    <View style={styles.locationInfo}>
                        <Ionicons name="location" size={16} color={COLORS.success} />
                        <Text style={styles.locationText}>
                            Your location will be shared: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </Text>
                    </View>
                )}
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: SPACING.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.lg,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary + '20',
        padding: SPACING.md,
        borderRadius: 12,
        marginBottom: SPACING.md,
    },
    infoText: {
        color: COLORS.white,
        fontSize: FONT_SIZES.sm,
        marginLeft: SPACING.sm,
        flex: 1,
    },
    listContent: {
        paddingBottom: SPACING.lg,
    },
    authorityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    authorityInfo: {
        flex: 1,
    },
    authorityName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.gray800,
    },
    authorityNumber: {
        fontSize: FONT_SIZES.lg,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginTop: 2,
    },
    authorityDescription: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.gray500,
        marginTop: 2,
    },
    actionButtons: {
        flexDirection: 'column',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.success + '20',
        padding: SPACING.md,
        borderRadius: 12,
        marginTop: SPACING.sm,
    },
    locationText: {
        color: COLORS.success,
        fontSize: FONT_SIZES.sm,
        marginLeft: SPACING.sm,
        flex: 1,
    },
});

export default AuthoritiesListScreen;