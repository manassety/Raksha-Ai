import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import GradientBackground from '../components/GradientBackground';
import GradientButton from '../components/GradientButton';
import { COLORS, GRADIENTS, FONT_SIZES, SPACING } from '../config/theme';
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';

const ChildSetupScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [childEmail, setChildEmail] = useState('');
    const [childName, setChildName] = useState('');
    const [linkedChildren, setLinkedChildren] = useState([]);

    React.useEffect(() => {
        loadLinkedChildren();
    }, []);

    const loadLinkedChildren = async () => {
        try {
            const auth = getAuth();
            const currentUserId = auth.currentUser?.uid;

            if (currentUserId) {
                const linkedUsersRef = collection(db, 'linked_users');
                const q = query(linkedUsersRef, where('parentId', '==', currentUserId));
                const snapshot = await getDocs(q);

                const children = [];
                snapshot.forEach((docSnap) => {
                    children.push({ id: docSnap.id, ...docSnap.data() });
                });
                setLinkedChildren(children);
            }
        } catch (error) {
            console.error('Error loading children:', error);
        }
    };

    const handleLinkChild = async () => {
        if (!childEmail.trim() || !childName.trim()) {
            Alert.alert('Error', 'Please enter both child name and email');
            return;
        }

        setLoading(true);
        try {
            // Find child user by email
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', childEmail.trim().toLowerCase()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                Alert.alert('Error', 'No account found with this email. Please ask your child to create an account first.');
                setLoading(false);
                return;
            }

            let childUserId = null;
            snapshot.forEach((docSnap) => {
                childUserId = docSnap.id;
            });

            if (!childUserId) {
                Alert.alert('Error', 'Could not find user');
                setLoading(false);
                return;
            }

            // Check if already linked
            const existingLinkQuery = query(
                collection(db, 'linked_users'),
                where('parentId', '==', getAuth().currentUser.uid),
                where('childId', '==', childUserId)
            );
            const existingLink = await getDocs(existingLinkQuery);

            if (!existingLink.empty) {
                Alert.alert('Info', 'This child is already linked');
                setLoading(false);
                return;
            }

            // Create link request
            await addDoc(collection(db, 'linked_users'), {
                parentId: getAuth().currentUser.uid,
                parentEmail: getAuth().currentUser.email,
                childId: childUserId,
                childName: childName.trim(),
                childEmail: childEmail.trim().toLowerCase(),
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            // Send notification to child (you can implement this)

            Alert.alert(
                'Success',
                `Link request sent to ${childName}. They need to accept the request from their app.`,
                [{
                    text: 'OK', onPress: () => {
                        setChildEmail('');
                        setChildName('');
                        loadLinkedChildren();
                    }
                }]
            );
        } catch (error) {
            console.error('Error linking child:', error);
            Alert.alert('Error', 'Failed to link child. Please try again.');
        }
        setLoading(false);
    };

    const handleUnlinkChild = async (childId) => {
        Alert.alert(
            'Unlink Child',
            'Are you sure you want to unlink this child?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unlink',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'linked_users', childId));
                            loadLinkedChildren();
                            Alert.alert('Success', 'Child has been unlinked');
                        } catch (error) {
                            console.error('Error unlinking child:', error);
                            Alert.alert('Error', 'Failed to unlink child');
                        }
                    },
                },
            ]
        );
    };

    return (
        <GradientBackground colors={GRADIENTS.dark}>
            <ScrollView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Child Setup</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Instructions */}
                <View style={styles.instructionCard}>
                    <Ionicons name="information-circle" size={24} color={COLORS.primary} />
                    <Text style={styles.instructionText}>
                        Link your child's account to track their location. Your child needs to accept the link request from their app.
                    </Text>
                </View>

                {/* Link New Child Form */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Link New Child</Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Child's Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter child's name"
                            placeholderTextColor={COLORS.gray400}
                            value={childName}
                            onChangeText={setChildName}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Child's Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter child's email"
                            placeholderTextColor={COLORS.gray400}
                            value={childEmail}
                            onChangeText={setChildEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={handleLinkChild}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                            <>
                                <Ionicons name="person-add" size={20} color={COLORS.white} />
                                <Text style={styles.linkButtonText}>Send Link Request</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Linked Children List */}
                <View style={styles.listCard}>
                    <Text style={styles.sectionTitle}>Linked Children</Text>

                    {linkedChildren.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={48} color={COLORS.gray400} />
                            <Text style={styles.emptyText}>No children linked yet</Text>
                        </View>
                    ) : (
                        linkedChildren.map((child) => (
                            <View key={child.id} style={styles.childItem}>
                                <View style={styles.childAvatar}>
                                    <Ionicons name="person" size={24} color={COLORS.primary} />
                                </View>
                                <View style={styles.childInfo}>
                                    <Text style={styles.childName}>{child.childName}</Text>
                                    <View style={styles.statusBadge}>
                                        <View style={[
                                            styles.statusDot,
                                            { backgroundColor: child.status === 'active' ? COLORS.success : COLORS.warning }
                                        ]} />
                                        <Text style={styles.statusText}>
                                            {child.status === 'active' ? 'Active' : 'Pending'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.unlinkButton}
                                    onPress={() => handleUnlinkChild(child.id)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                {/* Help Card */}
                <View style={styles.helpCard}>
                    <Ionicons name="help-circle" size={24} color={COLORS.info} />
                    <Text style={styles.helpText}>
                        Need help? Make sure your child has created an account and accepted the link request from their app settings.
                    </Text>
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    headerTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    instructionCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary + '20',
        marginHorizontal: SPACING.md,
        borderRadius: 12,
        padding: SPACING.md,
        alignItems: 'center',
    },
    instructionText: {
        flex: 1,
        marginLeft: SPACING.sm,
        color: COLORS.white,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
    },
    formCard: {
        backgroundColor: COLORS.white,
        marginHorizontal: SPACING.md,
        borderRadius: 16,
        padding: SPACING.md,
        marginTop: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.gray800,
        marginBottom: SPACING.md,
    },
    inputContainer: {
        marginBottom: SPACING.md,
    },
    inputLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray600,
        marginBottom: 6,
    },
    input: {
        backgroundColor: COLORS.gray100,
        borderRadius: 12,
        padding: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.gray800,
    },
    linkButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.sm,
    },
    linkButtonText: {
        color: COLORS.white,
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        marginLeft: 8,
    },
    listCard: {
        backgroundColor: COLORS.white,
        marginHorizontal: SPACING.md,
        borderRadius: 16,
        padding: SPACING.md,
        marginTop: SPACING.md,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    emptyText: {
        color: COLORS.gray500,
        fontSize: FONT_SIZES.md,
        marginTop: SPACING.sm,
    },
    childItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray100,
    },
    childAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    childInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    childName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.gray800,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.gray500,
    },
    unlinkButton: {
        padding: SPACING.sm,
    },
    helpCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.info + '20',
        marginHorizontal: SPACING.md,
        borderRadius: 12,
        padding: SPACING.md,
        marginTop: SPACING.md,
        alignItems: 'center',
    },
    helpText: {
        flex: 1,
        marginLeft: SPACING.sm,
        color: COLORS.white,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
    },
    bottomPadding: {
        height: 40,
    },
});

export default ChildSetupScreen;