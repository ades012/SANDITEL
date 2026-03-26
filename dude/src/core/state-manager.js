// src/core/state-manager.js
import { makeInMemoryStore } from "@whiskeysockets/baileys";
import fs from 'fs/promises';
import path from 'path';
import Logger from '../utils/logger.js';

const logger = new Logger('State-Manager');

export class StateManager {
    constructor() {
        this.store = null;
        this.sessionPath = 'auth';
        this.stateFile = 'bot-state.json';
        this.isInitialized = false;
        
        this.state = {
            connection: {
                status: 'disconnected',
                lastConnected: null,
                connectionCount: 0,
                totalUptime: 0
            },
            messages: {
                sent: 0,
                received: 0,
                failed: 0
            },
            groups: {
                total: 0,
                joined: [],
                left: []
            },
            users: {
                interacted: new Set(),
                blocked: new Set()
            },
            performance: {
                averageLatency: 0,
                lastLatency: 0,
                requestsPerMinute: 0
            },
            errors: {
                total: 0,
                byType: new Map(),
                lastError: null
            },
            startupTime: Date.now()
        };
    }

    // Initialize store dan load state
    async initialize() {
        try {
            // Initialize Baileys store
            this.store = makeInMemoryStore({ 
                logger: {
                    level: 'silent'
                }
            });
            
            // Load persisted state
            await this.loadState();
            
            this.isInitialized = true;
            logger.success('State manager initialized');
            
            return this.store;
            
        } catch (error) {
            logger.error('Failed to initialize state manager:', error);
            throw error;
        }
    }

    // Bind store ke socket
    bindToSocket(sock) {
        if (!this.store) {
            throw new Error('Store not initialized. Call initialize() first.');
        }
        
        this.store.bind(sock.ev);
        logger.info('Store bound to socket events');
    }

    // Persist state ke file
    async persistState() {
        try {
            const stateToSave = {
                ...this.state,
                users: {
                    interacted: Array.from(this.state.users.interacted),
                    blocked: Array.from(this.state.users.blocked)
                },
                errors: {
                    ...this.state.errors,
                    byType: Array.from(this.state.errors.byType.entries())
                },
                lastSaved: Date.now()
            };

            await fs.mkdir(this.sessionPath, { recursive: true });
            await fs.writeFile(
                path.join(this.sessionPath, this.stateFile),
                JSON.stringify(stateToSave, null, 2)
            );
            
        } catch (error) {
            logger.error('Failed to persist state:', error);
        }
    }

    // Load state dari file
    async loadState() {
        try {
            const stateFile = path.join(this.sessionPath, this.stateFile);
            const data = await fs.readFile(stateFile, 'utf-8');
            const loadedState = JSON.parse(data);
            
            // Restore Sets and Maps
            this.state = {
                ...loadedState,
                users: {
                    interacted: new Set(loadedState.users?.interacted || []),
                    blocked: new Set(loadedState.users?.blocked || [])
                },
                errors: {
                    ...loadedState.errors,
                    byType: new Map(loadedState.errors?.byType || [])
                }
            };
            
            logger.info('State loaded from persistence');
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('Error loading state:', error);
            }
            // File doesn't exist, use default state
        }
    }

    // Connection state management
    updateConnectionStatus(status) {
        this.state.connection.status = status;
        this.state.connection.lastConnected = status === 'connected' ? Date.now() : null;
        
        if (status === 'connected') {
            this.state.connection.connectionCount++;
        }
        
        this.persistState();
    }

    // Message statistics
    recordMessageSent() {
        this.state.messages.sent++;
        this.persistState();
    }

    recordMessageReceived() {
        this.state.messages.received++;
        this.persistState();
    }

    recordMessageFailed() {
        this.state.messages.failed++;
        this.persistState();
    }

    // Group management
    updateGroupStats(groups) {
        this.state.groups.total = Object.keys(groups).length;
        this.state.groups.joined = Object.keys(groups);
        this.persistState();
    }

    addGroup(groupJid) {
        if (!this.state.groups.joined.includes(groupJid)) {
            this.state.groups.joined.push(groupJid);
            this.persistState();
        }
    }

    removeGroup(groupJid) {
        this.state.groups.joined = this.state.groups.joined.filter(jid => jid !== groupJid);
        this.state.groups.left.push(groupJid);
        this.persistState();
    }

    // User interaction tracking
    recordUserInteraction(jid) {
        this.state.users.interacted.add(jid);
        this.persistState();
    }

    blockUser(jid) {
        this.state.users.blocked.add(jid);
        this.persistState();
    }

    unblockUser(jid) {
        this.state.users.blocked.delete(jid);
        this.persistState();
    }

    isUserBlocked(jid) {
        return this.state.users.blocked.has(jid);
    }

    // Performance tracking
    recordLatency(latency) {
        this.state.performance.lastLatency = latency;
        this.state.performance.averageLatency = 
            (this.state.performance.averageLatency * 0.9) + (latency * 0.1);
        this.persistState();
    }

    // Error tracking
    recordError(errorType, error = null) {
        this.state.errors.total++;
        
        const currentCount = this.state.errors.byType.get(errorType) || 0;
        this.state.errors.byType.set(errorType, currentCount + 1);
        
        this.state.errors.lastError = {
            type: errorType,
            message: error?.message,
            timestamp: Date.now()
        };
        
        this.persistState();
    }

    // Store operations
    async getMessage(jid, messageId) {
        if (!this.store) return null;
        return this.store.loadMessage(jid, messageId);
    }

    async getChat(jid) {
        if (!this.store) return null;
        return this.store.chats.get(jid);
    }

    async getContact(jid) {
        if (!this.store) return null;
        return this.store.contacts.get(jid);
    }

    // Get all chats
    getAllChats() {
        if (!this.store) return {};
        return Object.fromEntries(this.store.chats);
    }

    // Get all contacts
    getAllContacts() {
        if (!this.store) return {};
        return Object.fromEntries(this.store.contacts);
    }

    // Get all messages untuk chat tertentu
    getChatMessages(jid, limit = 50) {
        if (!this.store) return [];
        return this.store.messages.get(jid)?.slice(-limit) || [];
    }

    // Search messages
    searchMessages(query, limit = 20) {
        if (!this.store) return [];
        
        const results = [];
        for (const [jid, messages] of this.store.messages) {
            for (const message of messages) {
                const text = this.extractMessageText(message);
                if (text && text.toLowerCase().includes(query.toLowerCase())) {
                    results.push({ jid, message, text });
                    if (results.length >= limit) break;
                }
            }
            if (results.length >= limit) break;
        }
        
        return results;
    }

    // Utility method untuk extract message text
    extractMessageText(message) {
        if (!message.message) return '';
        
        if (message.message.conversation) {
            return message.message.conversation;
        }
        
        if (message.message.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        }
        
        if (message.message.imageMessage?.caption) {
            return message.message.imageMessage.caption;
        }
        
        return '';
    }

    // Get statistics
    getStats() {
        const now = Date.now();
        const uptime = now - this.state.startupTime;
        
        return {
            connection: {
                ...this.state.connection,
                currentUptime: this.state.connection.status === 'connected' ? 
                    now - this.state.connection.lastConnected : 0
            },
            messages: { ...this.state.messages },
            groups: { ...this.state.groups },
            users: {
                interacted: this.state.users.interacted.size,
                blocked: this.state.users.blocked.size
            },
            performance: { ...this.state.performance },
            errors: {
                total: this.state.errors.total,
                byType: Object.fromEntries(this.state.errors.byType)
            },
            uptime: {
                total: uptime,
                formatted: this.formatUptime(uptime)
            },
            store: {
                chats: this.store ? this.store.chats.size : 0,
                contacts: this.store ? this.store.contacts.size : 0,
                messages: this.store ? Array.from(this.store.messages.values())
                    .reduce((sum, msgs) => sum + msgs.length, 0) : 0
            }
        };
    }

    // Format uptime
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        return `${days}d ${hours}h ${minutes}m`;
    }

    // Cleanup resources
    async cleanup() {
        await this.persistState();
        logger.info('State manager cleaned up');
    }

    // Export data untuk backup
    async exportData() {
        const data = {
            state: this.state,
            chats: this.getAllChats(),
            contacts: this.getAllContacts(),
            exportTime: Date.now(),
            version: '1.0.0'
        };
        
        return JSON.stringify(data, null, 2);
    }

    // Import data dari backup
    async importData(backupData) {
        try {
            const data = JSON.parse(backupData);
            
            // Validate backup data
            if (!data.state || !data.chats || !data.contacts) {
                throw new Error('Invalid backup data format');
            }
            
            // Restore state
            this.state = {
                ...data.state,
                users: {
                    interacted: new Set(data.state.users?.interacted || []),
                    blocked: new Set(data.state.users?.blocked || [])
                },
                errors: {
                    ...data.state.errors,
                    byType: new Map(data.state.errors?.byType || [])
                }
            };
            
            // Note: Store data tidak bisa langsung di-import ke Baileys store
            // karena store structure yang complex
            
            await this.persistState();
            logger.info('Data imported successfully');
            
            return true;
            
        } catch (error) {
            logger.error('Error importing data:', error);
            return false;
        }
    }
}

// Singleton instance
export const stateManager = new StateManager();
export default stateManager;