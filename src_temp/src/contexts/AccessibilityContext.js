// ====================================================================
// FILE: src/contexts/AccessibilityContext.js
// ====================================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { StorageService } from '../services/StorageService';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../config/constants';

const AccessibilityContext = createContext();

export const AccessibilityProvider = ({ children }) => {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const savedSettings = await StorageService.get(STORAGE_KEYS.ACCESSIBILITY_SETTINGS);
            if (savedSettings) {
                setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
            }
        } catch (error) {
            console.log('Error loading accessibility settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateSettings = async (updates) => {
        try {
            const newSettings = { ...settings, ...updates };
            setSettings(newSettings);
            await StorageService.set(STORAGE_KEYS.ACCESSIBILITY_SETTINGS, newSettings);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const resetSettings = async () => {
        try {
            setSettings(DEFAULT_SETTINGS);
            await StorageService.set(STORAGE_KEYS.ACCESSIBILITY_SETTINGS, DEFAULT_SETTINGS);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    // Computed values based on settings
    const getFontSize = (baseSize) => {
        return settings.largeText ? baseSize * 1.3 : baseSize;
    };

    const getColorScheme = () => {
        if (settings.highContrast) {
            return {
                background: '#000000',
                text: '#FFFFFF',
                primary: '#FFFF00',
                secondary: '#00FFFF',
            };
        }

        if (settings.colorBlindMode !== 'none') {
            // Color-blind friendly palette
            return {
                background: '#FFFFFF',
                text: '#000000',
                primary: '#0077BB',
                secondary: '#EE7733',
            };
        }

        return null; // Default colors
    };

    const value = {
        settings,
        isLoading,
        updateSettings,
        resetSettings,
        getFontSize,
        getColorScheme,
    };

    return (
        <AccessibilityContext.Provider value={value}>
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = () => {
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error('useAccessibility must be used within an AccessibilityProvider');
    }
    return context;
};

export default AccessibilityContext;