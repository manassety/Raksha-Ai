// ====================================================================
// FILE: src/utils/validators.js
// ====================================================================
export const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }

    return { valid: true };
};

export const validatePassword = (password) => {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters' };
    }

    if (password.length > 50) {
        return { valid: false, error: 'Password must be less than 50 characters' };
    }

    return { valid: true };
};

export const validateConfirmPassword = (password, confirmPassword) => {
    if (password !== confirmPassword) {
        return { valid: false, error: 'Passwords do not match' };
    }

    return { valid: true };
};

export const validateName = (name) => {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Name is required' };
    }

    const trimmed = name.trim();
    if (trimmed.length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters' };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: 'Name must be less than 50 characters' };
    }

    return { valid: true };
};

export const validatePhone = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'Phone number is required' };
    }

    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length < 10) {
        return { valid: false, error: 'Please enter a valid phone number' };
    }

    if (cleaned.length > 15) {
        return { valid: false, error: 'Phone number is too long' };
    }

    return { valid: true, cleaned };
};

export const validatePIN = (pin) => {
    if (!pin || typeof pin !== 'string') {
        return { valid: false, error: 'PIN is required' };
    }

    if (!/^\d{4,6}$/.test(pin)) {
        return { valid: false, error: 'PIN must be 4-6 digits' };
    }

    return { valid: true };
};

export const validateContactName = (name) => {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Contact name is required' };
    }

    const trimmed = name.trim();
    if (trimmed.length < 1) {
        return { valid: false, error: 'Contact name is required' };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: 'Name is too long' };
    }

    return { valid: true };
};

export const validateContactPhone = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'Phone number is required' };
    }

    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length < 10) {
        return { valid: false, error: 'Please enter a valid phone number' };
    }

    return { valid: true, cleaned };
};

export const validateComplaint = (complaint) => {
    const errors = [];

    if (!complaint.category) {
        errors.push('Please select a category');
    }

    if (!complaint.description || complaint.description.trim().length < 10) {
        errors.push('Description must be at least 10 characters');
    }

    if (complaint.description && complaint.description.length > 1000) {
        errors.push('Description must be less than 1000 characters');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true };
};

export const validateEvidence = (evidence) => {
    if (!evidence.type) {
        return { valid: false, error: 'Evidence type is required' };
    }

    if (!evidence.uri) {
        return { valid: false, error: 'Evidence file is required' };
    }

    return { valid: true };
};

export const validateSettings = (settings) => {
    const errors = {};

    if (settings.voiceFeedback !== undefined && typeof settings.voiceFeedback !== 'boolean') {
        errors.voiceFeedback = 'Invalid voice feedback setting';
    }

    if (settings.autoLocationTracking !== undefined && typeof settings.autoLocationTracking !== 'boolean') {
        errors.autoLocationTracking = 'Invalid location tracking setting';
    }

    if (settings.backgroundMonitoring !== undefined && typeof settings.backgroundMonitoring !== 'boolean') {
        errors.backgroundMonitoring = 'Invalid background monitoring setting';
    }

    if (Object.keys(errors).length > 0) {
        return { valid: false, errors };
    }

    return { valid: true };
};

export const validateAdminCode = (code) => {
    if (!code || typeof code !== 'string') {
        return { valid: false, error: 'Admin code is required' };
    }

    if (code.length < 4) {
        return { valid: false, error: 'Invalid admin code' };
    }

    return { valid: true };
};

export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 1000); // Limit length
};

export const sanitizePhone = (phone) => {
    if (typeof phone !== 'string') return '';
    return phone.replace(/\D/g, '');
};