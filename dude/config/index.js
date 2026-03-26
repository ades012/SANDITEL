// config/index.js
import dotenv from 'dotenv';
dotenv.config();

export default {
    // Server Config
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    UNIFI_URL: process.env.UNIFI_URL,
    UNIFI_API_KEY: process.env.UNIFI_API_KEY,
    
    // WhatsApp Config
    wa: {
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        version: [2, 3000, 1010101010], // Latest version
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 15000,
        maxRetries: 5,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        mediaCache: {
            maxItems: 100,
            maxSize: 500 * 1024 * 1024 // 500MB
        }
    },
    
    // Webhook Config
    webhook: {
        enabled: true,
        events: ['message', 'group.update', 'connection.update']
    },
    
    // Group Config
    groups: {
        allowed: process.env.ALLOWED_GROUPS?.split(',') || [],
        adminOnly: true,
        autoJoin: false
    },
    
    // Features
    features: {
        autoReply: true,
        broadcastEnabled: false,
        businessFeatures: false
    },
    
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        saveMessages: true,
        saveMedia: false
    }
};