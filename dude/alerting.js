// enhanced-server.js - DEVELOP FROM WORKING BASE
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import express from 'express';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import ping from 'ping';

const app = express();
app.use(express.json());

let sock = null;
let welcomeSent = false;
let isOfficeDown = false;
// const ALERT_GROUP = '120363023559262906@g.us'; // Group untuk alerts
const ALERT_GROUP = '6281293709447-1562291997@g.us';


// UniFi Alert Service
class UniFiAlertService {
    constructor() {
        this.alertHistory = new Map();
        this.cooldownPeriod = 300000; // 5 menit cooldown
    }

    // Format message untuk alert UniFi
    formatAlert(event) {
        const { eventType, device, message, timestamp } = event;
        
        const priorityIcons = {
            high: '🔴',
            medium: '🟡', 
            low: '🔵'
        };
        
        const priority = this.getEventPriority(eventType);
        const icon = priorityIcons[priority] || '📡';
        
        let alertMessage = `${icon} *UNIFI NETWORK ALERT*\n`;
        alertMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
        alertMessage += `🎯 *Priority*: ${priority.toUpperCase()}\n`;
        alertMessage += `🔧 *Event*: ${eventType}\n`;
        
        if (device) {
            alertMessage += `📍 *Device*: ${device}\n`;
        }
        
        if (message) {
            alertMessage += `💬 *Details*: ${message}\n`;
        }
        
        alertMessage += `🕒 *Time*: ${new Date(timestamp || Date.now()).toLocaleString('id-ID')}\n`;
        alertMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
        
        // Tambahkan suggested action
        const action = this.getSuggestedAction(eventType);
        if (action) {
            alertMessage += `💡 *Suggested Action*: ${action}\n`;
            alertMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
        }
        
        return alertMessage;
    }

    getEventPriority(eventType) {
        const highPriority = [
            'DEVICE_UNREACHABLE',
            'event.unifi_device_disconnected',
            'INTERNET_DISCONNECTED',
            'WAN_DROPPED',
            'PACKET_LOSS'
        ];
        
        const mediumPriority = [
            'HIGH_LATENCY',
            'AP_OVERHEAT',
            'SWITCH_PORT_DOWN',
            'SECURITY_ALERT'
        ];
        
        if (highPriority.includes(eventType)) return 'high';
        if (mediumPriority.includes(eventType)) return 'medium';
        return 'low';
    }

    getSuggestedAction(eventType) {
        const actions = {
            'DEVICE_UNREACHABLE': 'SEGERA CEK PORT / INJEKTOR / POE SWITCH. Pastikan device mendapat power.',
            'event.unifi_device_disconnected': 'Cek kabel, adaptor, atau POE pada perangkat tersebut.',
            'INTERNET_DISCONNECTED': 'Periksa modem, router ISP, atau uptime ONT.',
            'WAN_DROPPED': 'Cek koneksi WAN dan status gateway.',
            'PACKET_LOSS': 'Cek kabel, port switch, dan congestion jaringan.',
            'HIGH_LATENCY': 'Periksa bandwidth, client overload, atau upstream congestion.',
            'AP_OVERHEAT': 'Pastikan AP tidak overheat — pindahkan dan cek ventilasi.',
            'SWITCH_PORT_DOWN': 'Periksa kabel atau perangkat yang terhubung.',
            'SECURITY_ALERT': 'Investigasi aktivitas mencurigakan pada controller.'
        };
        
        return actions[eventType] || 'Monitor the situation';
    }

    // Cegah alert spam dengan cooldown
    shouldSendAlert(event) {
        const key = `${event.eventType}-${event.device || 'global'}`;
        const lastAlert = this.alertHistory.get(key);
        
        if (lastAlert && (Date.now() - lastAlert) < this.cooldownPeriod) {
            console.log(`⏳ Alert in cooldown: ${event.eventType}`);
            return false;
        }
        
        this.alertHistory.set(key, Date.now());
        return true;
    }
}

const unifiService = new UniFiAlertService();

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        console.log('🔗 Connection status:', connection);
        
        if (qr) {
            console.log('\n' + '='.repeat(50));
            console.log('📱 SCAN QR CODE INI DENGAN WHATSAPP!');
            console.log('='.repeat(50));
            qrcode.generate(qr, { small: true });
            console.log('\n💡 Buka WhatsApp → Linked Devices → Link a Device');
            console.log('='.repeat(50) + '\n');
        }
        
        if (connection === 'open') {
            console.log('🎉 WHATSAPP CONNECTED SUCCESSFULLY!');
            console.log('🤖 Bot siap menerima alerts UniFi...');
            
            if (!welcomeSent) {
                welcomeSent = true; // Set flag agar tidak kirim ulang
                
                setTimeout(async () => {
                    if (sock && sock.user) {
                        try {
                            await sock.sendMessage(ALERT_GROUP, {
                                text: '✅ *UniFi Alert Bot Activated*\nBot sekarang siap menerima alerts dari UniFi Controller!'
                            });
                            console.log('✅ Welcome message sent to group');
                        } catch (error) {
                            console.error('❌ Failed to send welcome message:', error);
                        }
                    }
                }, 2000);
            }
            // setInterval(async () => {
            //     if (!sock || !sock.user) return; 

            //     try {
            //         const ipKantor = '103.147.222.243'; 
            //         const res = await ping.promise.probe(ipKantor);
                    
            //         if (!res.alive && !isOfficeDown) {
            //             isOfficeDown = true;
            //             await sock.sendMessage(ALERT_GROUP, { 
            //                 text: `🚨 *[OFFLINE ALERT]*\n\nKoneksi ke Kantor terputus!\nStatus: UNREACHABLE 🔴` 
            //             });
            //         } else if (res.alive && isOfficeDown) {
            //             isOfficeDown = false;
            //             await sock.sendMessage(ALERT_GROUP, { 
            //                 text: `✅ *[RECOVERY]*\n\nKoneksi ke Kantor sudah kembali normal.\nStatus: ONLINE 🟢` 
            //             });
            //         }
            //     } catch (err) {
            //         console.error('Ping Error:', err);
            //     }
            // }, 300000);
        
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Connection closed:', statusCode);
            
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting in 3 seconds...');
                setTimeout(connectToWhatsApp, 3000);
            }
        }
    });

    // Handle incoming messages untuk admin commands
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        
        if (!message.key.fromMe && message.message) {
            const jid = message.key.remoteJid;
            const text = message.message.conversation || 
                        message.message.extendedTextMessage?.text || '';
            
            console.log(`📨 Pesan dari ${jid}: ${text}`);
            
            // Admin commands
            if (text.startsWith('!')) {
                const command = text.slice(1).toLowerCase();
                
                switch (command) {
                    case 'status':
                        await sock.sendMessage(jid, {
                            text: `🤖 *BOT STATUS*\n\n` +
                                  `🟢 WhatsApp: Connected\n` +
                                  `👤 User: ${sock.user?.name || 'Unknown'}\n` +
                                  `📡 UniFi: Ready\n` +
                                  `🕒 Uptime: ${formatUptime(process.uptime())}`
                        });
                        break;

                    case 'eks-status':
                        await sock.sendMessage(jid, {
                            text: '☁️ *[AWS EKS Status]*\nCluster: Prod-Cluster\nStatus: HEALTHY ✅\nNodes: 3/3 Active\nNetwork: VXLAN Tunnel UP'
                        });
                        break;
                        
                    case 'cek-ip':
                        await sock.sendMessage(jid, {
                            text: '🌐 *[NetBox IPAM]*\nSinkronisasi source of truth berhasil. Alokasi IP untuk service Unifi webhook aman.'
                        });
                        break;
                    
                    case 'cek-kantor':
                        const ipKantor = '10.11.255.5';
                        const res = await ping.promise.probe(ipKantor);
                        
                        if (res.alive) {
                            await sock.sendMessage(jid, { 
                                text: `✅ *[Koneksi Kantor]*\nStatus: ONLINE\nLatency: ${res.time}ms\nISP: Aman terkendali.` 
                            });
                        } else {
                            await sock.sendMessage(jid, { 
                                text: `🔴 *[KONEKSI KANTOR MATI]*\nStatus: UNREACHABLE\nSegera cek power atau hubungi ISP!` 
                            });
                        }
                        break;
                            
                    case 'testalert':
                        const testEvent = {
                            eventType: 'Test Alert',
                            device: 'Test Device',
                            message: 'This is a test alert from bot',
                            timestamp: new Date().toISOString()
                        };
                        await sendUniFiAlert(testEvent);
                        await sock.sendMessage(jid, { text: '✅ Test alert sent!' });
                        break;
                        
                    case 'help':
                        await sock.sendMessage(jid, {
                            text: `📋 *UNIFI BOT COMMANDS*\n\n` +
                                  `!status - Bot status\n` +
                                  `!testalert - Test alert system\n` +
                                  `!help - Show this help\n\n` +
                                  `🔧 Auto alerts from UniFi webhook will be sent to group.`
                        });
                        break;
                }
            }
        }
    });

    return sock;
}

// Fungsi untuk kirim alert UniFi
async function sendUniFiAlert(event) {
    if (!sock || !sock.user) {
        console.log('⚠️ WhatsApp not connected, skipping alert');
        return;
    }

    // Cek cooldown
    if (!unifiService.shouldSendAlert(event)) {
        return;
    }

    try {
        const alertMessage = unifiService.formatAlert(event);
        await sock.sendMessage(ALERT_GROUP, { text: alertMessage });
        console.log(`✅ UniFi alert sent: ${event.eventType}`);
        
    } catch (error) {
        console.error('❌ Failed to send alert:', error);
    }
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// ==================== HTTP ROUTES ====================

app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'UniFi WhatsApp Alert Bot',
        whatsapp: sock && sock.user ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    const health = {
        status: sock && sock.user ? 'connected' : 'disconnected',
        user: sock?.user?.name || 'Not connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
    res.json(health);
});

// enhanced-server.js - UPDATE WEBHOOK ENDPOINT
app.post('/webhook', async (req, res) => {
    const event = req.body;
    
    console.log('📡 FULL UNIFI WEBHOOK DATA:');
    console.log(JSON.stringify(event, null, 2));
    console.log('----------------------------------------');
    
    try {
        // ⚠️ TAMBAH AWAIT DI SINI!
        const normalizedEvent = await normalizeUnifiEvent(event);
        
        console.log('📝 Normalized Event:', normalizedEvent.eventType);
        
        // Kirim alert ke WhatsApp
        await sendUniFiAlert(normalizedEvent);
        
        res.json({ 
            success: true, 
            message: 'Alert processed',
            event_type: normalizedEvent.eventType
        });
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

import { getDeviceByMac } from "./src/utils/unifi.js";

// enhanced-server.js - SIMPLIFIED NORMALIZE FUNCTION
async function normalizeUnifiEvent(data) {
    console.log("🔄 Normalizing UniFi event data...");

    // Pastikan minimal ada satu event
    const ev = data?.events?.[0];
    if (!ev) {
        console.log("⚠️ No event object found in UniFi webhook");
        return {
            eventType: "Unknown Event",
            device: "Unknown Device",
            message: "No details provided",
            timestamp: new Date().toISOString()
        };
    }

    const mac = ev.scope?.ui_device_id;
    const eventType = ev.alert_key || ev.id || "Unknown Event";
    
    console.log(`🔍 Event details: ${eventType}, MAC: ${mac}`);

    // Lookup device info dari UniFi API (jika ada)
    let deviceInfo = null;
    if (mac) {
        try {
            deviceInfo = await getDeviceByMac(mac);
            console.log(`📱 Device info:`, deviceInfo);
        } catch (error) {
            console.log(`⚠️ Device lookup failed for MAC ${mac}:`, error.message);
        }
    }

    // Format message berdasarkan event type
    let message = "Device status changed";
    if (eventType === "DEVICE_UNREACHABLE") {
        message = "Device became unreachable from controller";
    } else if (eventType === "event.unifi_device_disconnected") {
        message = "Device disconnected from network";
    }

    const normalized = {
        eventType: eventType,
        device: deviceInfo?.name || mac || "Unknown Device",
        message: message,
        timestamp: new Date().toISOString()
    };

    console.log("✅ Normalized Event:", normalized);
    return normalized;
}


// Test endpoint untuk manual alert
app.post('/test-alert', async (req, res) => {
    const testEvent = {
        eventType: req.body.eventType || 'Test Alert',
        device: req.body.device || 'Test Device',
        message: req.body.message || 'Manual test alert',
        timestamp: new Date().toISOString()
    };
    
    await sendUniFiAlert(testEvent);
    res.json({ success: true, test_event: testEvent });
});

// Send message endpoint (untuk manual testing)
app.post('/send-message', async (req, res) => {
    try {
        const { jid, message } = req.body;
        
        if (!jid || !message) {
            return res.status(400).json({ error: 'Missing jid or message' });
        }
        
        if (!sock || !sock.user) {
            return res.status(503).json({ error: 'WhatsApp not connected' });
        }
        
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true, message: 'Message sent' });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 UniFi Alert Bot running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`📡 Webhook: http://localhost:${PORT}/webhook`);
    console.log('🔗 Connecting to WhatsApp...');
    
    await connectToWhatsApp();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down UniFi Alert Bot...');
    process.exit(0);
});
