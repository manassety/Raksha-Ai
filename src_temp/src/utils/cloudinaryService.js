import * as FileSystem from 'expo-file-system';
import { CLOUDINARY_CONFIG } from '../config/cloudinary';

/**
 * Uploads a file to Cloudinary
 * @param {Object} fileInfo - The file info object (uri, name, type)
 * @returns {Promise<Object>} - The Cloudinary response containing secure_url
 */
export const uploadToCloudinary = async (fileInfo) => {
    try {
        const { cloudName, uploadPreset, apiBaseUrl } = CLOUDINARY_CONFIG;

        if (cloudName === 'YOUR_CLOUD_NAME' || uploadPreset === 'YOUR_UPLOAD_PRESET') {
            console.warn('Cloudinary is not configured yet. Using mock response.');
            // Return a mock response for testing until keys are added
            return {
                secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
                public_id: 'mock_sample_' + Date.now(),
                mock: true
            };
        }

        // Detect MIME type more robustly
        let mimeType = (fileInfo.mimeType || fileInfo.type);

        // If type is generic (image, video, etc), force redetection
        if (!mimeType || ['image', 'video', 'audio', 'document'].includes(mimeType)) {
            const ext = fileInfo.name?.split('.').pop();
            const extLower = ext?.toLowerCase();
            if (extLower === 'jpg' || extLower === 'jpeg') mimeType = 'image/jpeg';
            else if (extLower === 'png') mimeType = 'image/png';
            else if (extLower === 'mp4') mimeType = 'video/mp4';
            else if (extLower === 'm4a') mimeType = 'audio/mp4';
            else if (extLower === 'mp3') mimeType = 'audio/mpeg';
            else if (extLower === 'pdf') mimeType = 'application/pdf';
            else mimeType = 'application/octet-stream';
        }

        console.log('--- Cloudinary Upload Attempt (via FileSystem) ---');
        console.log('Cloud Name:', cloudName);
        console.log('Preset:', uploadPreset);
        console.log('File:', fileInfo.name);
        console.log('Mime Type:', mimeType);
        console.log('---------------------------------');

        const uploadUrl = `${apiBaseUrl}/${cloudName}/upload`;

        // FileSystem.uploadAsync is more reliable than fetch for binary data in Expo
        const response = await FileSystem.uploadAsync(uploadUrl, fileInfo.uri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            parameters: {
                upload_preset: uploadPreset,
            },
        });

        const data = JSON.parse(response.body);

        if (response.status < 200 || response.status >= 300) {
            console.error('Cloudinary API Error:', data);
            throw new Error(data.error?.message || 'Upload failed');
        }

        return {
            secure_url: data.secure_url,
            public_id: data.public_id,
            resource_type: data.resource_type,
            format: data.format,
            original_filename: data.original_filename
        };
    } catch (error) {
        console.error('Cloudinary Upload Service Error:', error);
        throw error;
    }
};


// Helper to generate SHA1 signature for Cloudinary destruction
const generateSHA1 = (string) => {
    let K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
    let H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    let msg = unescape(encodeURIComponent(string));
    let n = msg.length, m = [m = 0];
    for (let i = 0; i < n; i++) m[i >> 2] |= msg.charCodeAt(i) << (24 - (i % 4) * 8);
    m[n >> 2] |= 0x80 << (24 - (n % 4) * 8);
    m[((n + 8) >> 6 << 4) + 15] = n * 8;
    for (let i = 0; i < m.length; i += 16) {
        let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];
        for (let j = 0; j < 80; j++) {
            if (j < 16) w[j] = m[i + j];
            else w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
            let t = rol(a, 5) + e + w[j] + K[Math.floor(j / 20)] + (
                j < 20 ? (b & c) | (~b & d) : j < 40 ? b ^ c ^ d : j < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d
            );
            e = d; d = c; c = rol(b, 30); b = a; a = t;
        }
        H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e;
    }
    function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
    let w = [];
    return H.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('');
};

/**
 * Delete a file from Cloudinary (requires public_id)
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        const { cloudName, apiKey, apiSecret } = CLOUDINARY_CONFIG;
        const timestamp = Math.floor(Date.now() / 1000);

        const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const signature = generateSHA1(signatureString);

        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('timestamp', timestamp);
        formData.append('api_key', apiKey);
        formData.append('signature', signature);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (data.result !== 'ok') {
            console.error('Cloudinary Destroy Error Detail:', data);
            throw new Error(data.error?.message || `Cloudinary delete failed: ${data.result}`);
        }

        console.log('--- Cloudinary Asset Deleted Successfully ---');
        return { success: true };
    } catch (error) {
        console.error('Cloudinary Delete Error:', error);
        throw error;
    }
};

export default {
    uploadToCloudinary,
    deleteFromCloudinary
};
