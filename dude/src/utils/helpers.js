// src/utils/helpers.js
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from 'fs/promises';
import path from 'path';
import Logger from './logger.js';

const logger = new Logger('Helpers');

export class Helpers {
    // Format JID untuk display
    static formatJid(jid) {
        if (!jid) return 'Unknown';
        return jid.replace(/@.+/, '');
    }

    // Extract phone number dari JID
    static extractPhoneNumber(jid) {
        if (!jid) return null;
        const match = jid.match(/^(\d+)@/);
        return match ? match[1] : null;
    }

    // Check jika JID adalah group
    static isGroupJid(jid) {
        return jid?.endsWith('@g.us');
    }

    // Check jika JID adalah broadcast
    static isBroadcastJid(jid) {
        return jid?.endsWith('@broadcast');
    }

    // Check jika JID adalah user
    static isUserJid(jid) {
        return jid?.endsWith('@s.whatsapp.net');
    }

    // Generate message ID
    static generateMessageId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Format timestamp ke readable format
    static formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        return new Date(timestamp * 1000).toLocaleString();
    }

    // Delay utility
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Validate phone number
    static validatePhoneNumber(phone) {
        const regex = /^[1-9]\d{8,14}$/;
        return regex.test(phone.replace(/\D/g, ''));
    }

    // Download media message
    static async downloadMedia(message, filename = null) {
        try {
            const buffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                {
                    logger: console,
                    reuploadRequest: async () => {
                        // Handle reupload if needed
                    }
                }
            );

            if (filename) {
                const filePath = path.join('media', filename);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, buffer);
                return filePath;
            }

            return buffer;
        } catch (error) {
            logger.error('Error downloading media:', error);
            return null;
        }
    }

    // Parse message text
    static parseMessageText(message) {
        if (!message) return '';
        
        if (message.conversation) {
            return message.conversation;
        }
        
        if (message.extendedTextMessage?.text) {
            return message.extendedTextMessage.text;
        }
        
        if (message.imageMessage?.caption) {
            return message.imageMessage.caption;
        }
        
        if (message.videoMessage?.caption) {
            return message.videoMessage.caption;
        }
        
        return '';
    }

    // Extract mentions dari message
    static extractMentions(message) {
        const mentions = [];
        
        if (message.extendedTextMessage?.contextInfo?.mentionedJid) {
            mentions.push(...message.extendedTextMessage.contextInfo.mentionedJid);
        }
        
        return mentions.filter(mention => mention && !mention.includes('status'));
    }

    // Check jika message ada mention bot
    static isBotMentioned(message, botJid) {
        const mentions = this.extractMentions(message);
        return mentions.includes(botJid);
    }

    // Format bytes ke readable size
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Sanitize text untuk mencegah injection
    static sanitizeText(text) {
        if (!text) return '';
        return text
            .replace(/[`$\\]/, '\\$&')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/~/g, '\\~')
            .replace(/`/g, '\\`')
            .replace(/>/g, '\\>')
            .replace(/#/g, '\\#')
            .replace(/\+/g, '\\+')
            .replace(/-/g, '\\-')
            .replace(/=/g, '\\=')
            .replace(/\|/g, '\\|')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}')
            .replace(/\./g, '\\.')
            .replace(/!/g, '\\!');
    }

    // Generate progress bar
    static generateProgressBar(percentage, length = 20) {
        const filled = Math.round((percentage / 100) * length);
        const empty = length - filled;
        
        return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage.toFixed(1)}%`;
    }

    // Parse duration dari seconds ke HH:MM:SS
    static parseDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // Extract URL dari text
    static extractUrls(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
    }

    // Validate URL
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Generate random string
    static randomString(length = 8) {
        return Math.random().toString(36).substring(2, 2 + length);
    }

    // Deep clone object
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Merge objects
    static mergeObjects(target, source) {
        return { ...target, ...source };
    }

    // Check jika object kosong
    static isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }

    // Retry function dengan exponential backoff
    static async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                logger.warn(`Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    await this.delay(delay);
                }
            }
        }
        
        throw lastError;
    }
}

export default Helpers;