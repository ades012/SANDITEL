// src/handlers/message-handler.js
import { proto } from "@whiskeysockets/baileys";
import Logger from '../utils/logger.js';
import { handleGroupEvent } from './group-handler.js';

const logger = new Logger('Message-Handler');

export class MessageHandler {
    constructor(socket) {
        this.sock = socket;
        this.commands = new Map();
        this.initCommands();
    }

    initCommands() {
        // Basic commands
        this.commands.set('ping', this.handlePing.bind(this));
        this.commands.set('info', this.handleInfo.bind(this));
        this.commands.set('menu', this.handleMenu.bind(this));
    }

    // Handle incoming messages
    async handleMessages(update) {
        try {
            const { messages } = update;
            if (!messages?.[0]) return;

            const message = messages[0];
            const messageType = Object.keys(message.message || {})[0];
            
            // Skip protocol messages and others
            if (this.shouldIgnoreMessage(message, messageType)) return;

            logger.info(`New ${messageType} message from ${message.key.remoteJid}`);

            // Handle different message types
            switch (messageType) {
                case 'conversation':
                case 'extendedTextMessage':
                    await this.handleTextMessage(message);
                    break;
                    
                case 'imageMessage':
                    await this.handleImageMessage(message);
                    break;
                    
                case 'videoMessage':
                    await this.handleVideoMessage(message);
                    break;
                    
                case 'groupInviteMessage':
                    await this.handleGroupInvite(message);
                    break;
                    
                default:
                    logger.debug(`Unhandled message type: ${messageType}`);
            }

        } catch (error) {
            logger.error('Error handling message:', error);
        }
    }

    // Handle text messages dengan command parsing
    async handleTextMessage(message) {
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || '';
        const jid = message.key.remoteJid;
        const sender = message.key.participant || jid;
        const isGroup = jid.endsWith('@g.us');
        const isCommand = text.startsWith('!');

        if (isCommand) {
            await this.handleCommand(text, jid, sender, isGroup);
            return;
        }

        // Auto-reply atau processing lainnya
        if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
            await this.sendMessage(jid, {
                text: `Hello! I'm a WhatsApp bot. Use !menu to see available commands.`,
                mentions: [sender]
            });
        }
    }

    // Command handler
    async handleCommand(text, jid, sender, isGroup) {
        const [command, ...args] = text.slice(1).split(' ');
        const cmdHandler = this.commands.get(command.toLowerCase());

        if (cmdHandler) {
            await cmdHandler(jid, sender, args, isGroup);
        } else {
            await this.sendMessage(jid, {
                text: `❌ Unknown command: ${command}\nUse !menu to see available commands.`
            });
        }
    }

    // Command implementations
    async handlePing(jid, sender, args, isGroup) {
        const start = Date.now();
        const msg = await this.sendMessage(jid, { text: 'Pong! 🏓' });
        const latency = Date.now() - start;
        
        await this.sock.sendMessage(jid, {
            text: `🏓 Pong!\n⏱️ Latency: ${latency}ms\n💬 Message ID: ${msg.key.id}`,
            edit: msg.key
        });
    }

    async handleInfo(jid, sender, args, isGroup) {
        const info = {
            text: `🤖 *BOT INFORMATION*\n\n` +
                  `👤 *User:* ${this.sock.user?.name || 'Unknown'}\n` +
                  `📱 *Phone:* ${this.sock.user?.id || 'Unknown'}\n` +
                  `🕒 *Uptime:* ${this.formatUptime(process.uptime())}\n` +
                  `🔗 *Connection:* ${this.sock.connection ? 'Connected' : 'Disconnected'}\n` +
                  `💻 *Platform:* ${process.platform}\n` +
                  `📊 *Memory:* ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`
        };

        await this.sendMessage(jid, info);
    }

    async handleMenu(jid, sender, args, isGroup) {
        const menu = {
            text: `📋 *BOT COMMANDS MENU*\n\n` +
                  `🔧 *Basic Commands:*\n` +
                  `• !ping - Test bot responsiveness\n` +
                  `• !info - Bot information\n` +
                  `• !menu - Show this menu\n\n` +
                  `👥 *Group Commands:*\n` +
                  `• !groupinfo - Group information\n` +
                  `• !members - List group members\n\n` +
                  `⚡ *More features coming soon...*`
        };

        await this.sendMessage(jid, menu);
    }

    // Media message handlers
    async handleImageMessage(message) {
        const jid = message.key.remoteJid;
        const caption = message.message.imageMessage.caption;
        
        if (caption) {
            await this.sendMessage(jid, {
                text: `📸 Image received with caption: "${caption}"`
            });
        }
    }

    async handleVideoMessage(message) {
        const jid = message.key.remoteJid;
        await this.sendMessage(jid, {
            text: '🎥 Video received and processed'
        });
    }

    async handleGroupInvite(message) {
        const jid = message.key.remoteJid;
        const inviteCode = message.message.groupInviteMessage.groupJid;
        
        await this.sendMessage(jid, {
            text: `📨 Group invite received for: ${inviteCode}\n\nUse !joingroup to accept invitation.`
        });
    }

    // Utility methods
    shouldIgnoreMessage(message, messageType) {
        if (message.key.fromMe) return true;
        if (messageType === 'protocolMessage') return true;
        if (messageType === 'senderKeyDistributionMessage') return true;
        return false;
    }

    async sendMessage(jid, content) {
        try {
            return await this.sock.sendMessage(jid, content);
        } catch (error) {
            logger.error('Failed to send message:', error);
            throw error;
        }
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        return `${days}d ${hours}h ${minutes}m`;
    }
}