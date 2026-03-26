// src/core/socket.js
import makeWASocket, { 
    useMultiFileAuthState, 
    Browsers, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import config from '../../config/index.js';
import Logger from '../utils/logger.js';

const logger = new Logger('WA-Socket');
let sock = null;
let store = null;

// Initialize store for message caching
export function initStore() {
    store = makeInMemoryStore({ });
    return store;
}

// Socket configuration berdasarkan dokumentasi resmi
export async function createWASocket() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("auth");
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        logger.info(`Using WA version: ${version.join('.')} (latest: ${isLatest})`);

        // Buat socket dengan config optimal
        sock = makeWASocket({
            // Auth configuration
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            
            // Browser info
            browser: Browsers.ubuntu('Chrome'),
            
            // Version info
            version,
            
            // Logger configuration
            logger: pino({ 
                level: config.logging.level,
                transport: {
                    target: 'pino-pretty',
                    options: { colorize: true }
                }
            }),
            
            // Connection settings
            connectTimeoutMs: config.wa.connectTimeoutMs,
            keepAliveIntervalMs: config.wa.keepAliveIntervalMs,
            maxRetries: config.wa.maxRetries,
            maxQRCodes: 3, // Max QR code generation attempts
            
            // Message handling
            markOnlineOnConnect: config.wa.markOnlineOnConnect,
            syncFullHistory: config.wa.syncFullHistory,
            linkPreviewImageThumbnailWidth: 192,
            generateHighQualityLinkPreview: config.wa.generateHighQualityLinkPreview,
            
            // Media settings
            mediaCache: config.wa.mediaCache,
            msgRetryCounterCache: {
                max: 1000,
                ttl: 60 * 1000 // 1 minute
            },
            
            // Message processing
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return undefined;
            },
            
            // Transaction configuration
            transactionOpts: {
                maxRetries: config.wa.maxRetries,
                delayInMs: 1000
            },
            
            // App state sync
            fireInitQueries: true,
            shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || false,
            shouldSyncHistoryMessage: (msg) => !msg.message?.protocolMessage,
        });

        // Bind store jika ada
        if (store) {
            store.bind(sock.ev);
        }

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);

        return sock;

    } catch (error) {
        logger.error('Failed to create socket:', error);
        throw error;
    }
}

// QR Code handler dengan styling yang better
export function handleQRCode(qr) {
    logger.info('QR Code received - Scan with WhatsApp');
    console.log('\n' + '═'.repeat(50));
    console.log('📱 WHATSAPP AUTHENTICATION REQUIRED');
    console.log('═'.repeat(50));
    qrcode.generate(qr, { 
        small: true,
        scale: 2 // Better visibility
    });
    console.log('\n💡 Go to: WhatsApp → Linked Devices → Link a Device');
    console.log('⏰ QR Code expires in 2 minutes');
    console.log('═'.repeat(50) + '\n');
}

// Connection state management
export function handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr, isNewLogin } = update;
    
    switch (connection) {
        case 'open':
            logger.success('WhatsApp connected successfully!');
            if (sock?.user) {
                logger.info(`User: ${sock.user.name} | Phone: ${sock.user.id}`);
            }
            break;
            
        case 'close':
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            handleDisconnect(statusCode);
            break;
            
        case 'connecting':
            logger.info('Connecting to WhatsApp...');
            break;
    }
    
    // Handle QR Code
    if (qr) {
        handleQRCode(qr);
    }
    
    // Handle new login
    if (isNewLogin) {
        logger.info('New login detected');
    }
}

// Disconnect handler berdasarkan reason code
function handleDisconnect(statusCode) {
    const reason = DisconnectReason[statusCode] || `Unknown (${statusCode})`;
    logger.warn(`Connection closed: ${reason}`);
    
    switch (statusCode) {
        case DisconnectReason.connectionLost:
            logger.info('Connection lost, attempting reconnect...');
            setTimeout(() => createWASocket(), 5000);
            break;
            
        case DisconnectReason.loggedOut:
            logger.error('Logged out from WhatsApp. Please rescan QR code.');
            // Clear auth state
            break;
            
        case DisconnectReason.restartRequired:
            logger.info('Restart required, reconnecting...');
            setTimeout(() => createWASocket(), 2000);
            break;
            
        case DisconnectReason.multideviceMismatch:
            logger.error('Multi-device conflict. Please unlink other devices.');
            break;
            
        default:
            logger.info(`Reconnecting in 3 seconds... (Reason: ${reason})`);
            setTimeout(() => createWASocket(), 3000);
    }
}

export function getSocket() {
    return sock;
}

export function getStore() {
    return store;
}