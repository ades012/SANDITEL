// server.js - Main Entry Point
import express from 'express';
import { createWASocket, handleConnectionUpdate, initStore } from './src/core/socket.js';
import { MessageHandler } from './src/handlers/message-handler.js';
import { GroupHandler } from './src/handlers/group-handler.js';
import config from './config/index.js';
import Logger from './src/utils/logger.js';

const logger = new Logger('Server');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

class WABotServer {
    constructor() {
        this.sock = null;
        this.messageHandler = null;
        this.groupHandler = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            logger.info('🚀 Starting WhatsApp Bot Server...');

            // Initialize store
            initStore();

            // Create WhatsApp socket
            this.sock = await createWASocket();
            
            // Initialize handlers
            this.messageHandler = new MessageHandler(this.sock);
            this.groupHandler = new GroupHandler(this.sock);

            // Setup event listeners
            this.setupEventListeners();

            // Setup HTTP routes
            this.setupRoutes();

            this.isInitialized = true;
            logger.success('✅ WhatsApp Bot initialized successfully!');

        } catch (error) {
            logger.error('❌ Failed to initialize bot:', error);
            process.exit(1);
        }
    }

    setupEventListeners() {
        // Connection updates
        this.sock.ev.on('connection.update', (update) => {
            handleConnectionUpdate(update);
        });

        // Message events
        this.sock.ev.on('messages.upsert', (update) => {
            this.messageHandler.handleMessages(update);
        });

        // Group events
        this.sock.ev.on('groups.update', (update) => {
            this.groupHandler.handleGroupUpdate(update);
        });

        // Message reactions
        this.sock.ev.on('messages.reaction', (reactions) => {
            reactions.forEach(reaction => {
                logger.info(`Reaction from ${reaction.key.participant}: ${reaction.reaction.text}`);
            });
        });

        // Presence updates
        this.sock.ev.on('presence.update', (update) => {
            // Handle online/typing status
        });

        // Call events
        this.sock.ev.on('call', (call) => {
            logger.info(`Incoming call from: ${call.from}`);
        });
    }

    setupRoutes() {
        // Health check
        app.get('/health', (req, res) => {
            const health = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                whatsapp: this.sock?.user ? 'connected' : 'disconnected',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version
            };
            res.json(health);
        });

        // Bot info
        app.get('/info', (req, res) => {
            if (!this.sock?.user) {
                return res.status(503).json({ error: 'WhatsApp not connected' });
            }

            const info = {
                user: {
                    id: this.sock.user.id,
                    name: this.sock.user.name,
                    phone: this.sock.user.phone
                },
                connection: this.sock.connection,
                features: config.features,
                timestamp: new Date().toISOString()
            };
            res.json(info);
        });

        // Send message endpoint
        app.post('/send-message', async (req, res) => {
            try {
                const { jid, message, type = 'text' } = req.body;

                if (!jid || !message) {
                    return res.status(400).json({ error: 'Missing jid or message' });
                }

                let content;
                switch (type) {
                    case 'text':
                        content = { text: message };
                        break;
                    case 'image':
                        content = { image: { url: message }, caption: 'Image from API' };
                        break;
                    default:
                        content = { text: message };
                }

                const result = await this.sock.sendMessage(jid, content);
                res.json({ success: true, messageId: result.key.id });

            } catch (error) {
                logger.error('API send message error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Get groups endpoint
        app.get('/groups', async (req, res) => {
            try {
                const groups = await this.sock.groupFetchAllParticipating();
                res.json({ 
                    success: true, 
                    count: Object.keys(groups).length,
                    groups: groups 
                });
            } catch (error) {
                logger.error('API get groups error:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }

    startServer() {
        const PORT = config.port;
        
        app.listen(PORT, () => {
            logger.success(`✅ HTTP Server ready on port ${PORT}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            logger.info(`🤖 Bot info: http://localhost:${PORT}/info`);
        });
    }
}

// Start the application
const botServer = new WABotServer();

botServer.initialize().then(() => {
    botServer.startServer();
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default botServer;