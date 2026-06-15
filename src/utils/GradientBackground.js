// ====================================================================
// FILE: src/components/GradientBackground.js
// ====================================================================
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS } from '../config/theme';

const GradientBackground = ({
    children,
    colors = GRADIENTS.primary,
    style,
    start = { x: 0, y: 0 },
    end = { x: 1, y: 1 },
}) => {
    return (
        <LinearGradient
            colors={colors}
            start={start}
            end={end}
            style={[styles.container, style]}
        >
            {children}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default GradientBackground;