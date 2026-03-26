// simple-server.js - VERSION SIMPLE UNTUK TESTING
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import express from 'express';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

const app = express();
app.use(express.json());

let sock = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Kita handle manual
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
            console.log('🤖 Bot siap menerima pesan...');
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

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        
        if (!message.key.fromMe && message.message) {
            const jid = message.key.remoteJid;
            const text = message.message.conversation || 
                        message.message.extendedTextMessage?.text || '';
            
            console.log(`📨 Pesan dari ${jid}: ${text}`);
            
            // Auto reply
            if (text.toLowerCase().includes('ping')) {
                await sock.sendMessage(jid, { text: '🏓 Pong!' });
            }
            
            if (text.toLowerCase().includes('hello')) {
                await sock.sendMessage(jid, { 
                    text: '👋 Hello! Saya adalah WhatsApp Bot. Gunakan !menu untuk melihat commands.' 
                });
            }
            
            // Command handler sederhana
            if (text.startsWith('!')) {
                const command = text.slice(1).toLowerCase();
                
                switch (command) {
                    case 'menu':
                        await sock.sendMessage(jid, {
                            text: `📋 *MENU BOT*\n\n` +
                                  `!ping - Test bot\n` +
                                  `!info - Info bot\n` +
                                  `!time - Waktu sekarang\n` +
                                  `!menu - Menu ini`
                        });
                        break;
                        
                    case 'info':
                        await sock.sendMessage(jid, {
                            text: `🤖 *BOT INFO*\n\n` +
                                  `🕒 Uptime: ${formatUptime(process.uptime())}\n` +
                                  `💻 Platform: ${process.platform}\n` +
                                  `📊 Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`
                        });
                        break;
                        
                    case 'time':
                        await sock.sendMessage(jid, {
                            text: `🕒 Waktu sekarang: ${new Date().toLocaleString('id-ID')}`
                        });
                        break;
                        
                    case 'ping':
                        const start = Date.now();
                        await sock.sendMessage(jid, { text: '🏓 Pong!' });
                        const latency = Date.now() - start;
                        await sock.sendMessage(jid, { 
                            text: `⏱️ Latency: ${latency}ms` 
                        });
                        break;
                }
            }
        }
    });

    return sock;
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// HTTP Routes
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'WhatsApp Bot Server is running',
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

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log('🔗 Menghubungkan ke WhatsApp...');
    
    await connectToWhatsApp();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Mematikan server...');
    process.exit(0);
});