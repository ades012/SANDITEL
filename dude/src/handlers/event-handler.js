// src/handlers/event-handler.js
import Logger from '../utils/logger.js';
import { metricsService } from '../services/metrics-service.js';
import { webhookService } from '../services/webhook-service.js';
import Helpers from '../utils/helpers.js';

const logger = new Logger('Event-Handler');

export class EventHandler {
    constructor(socket, messageHandler, groupHandler) {
        this.sock = socket;
        this.messageHandler = messageHandler;
        this.groupHandler = groupHandler;
        this.eventCallbacks = new Map();
        
        this.initializeEventHandlers();
    }

    initializeEventHandlers() {
        // Register internal event handlers
        this.setupConnectionHandlers();
        this.setupMessageHandlers();
        this.setupGroupHandlers();
        this.setupPresenceHandlers();
        this.setupCallHandlers();
        this.setupHistorySyncHandlers();
        
        logger.success('Event handlers initialized');
    }

    setupConnectionHandlers() {
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;
            
            // Record metrics
            metricsService.recordConnectionChange(
                this.lastConnectionState || 'unknown', 
                connection
            );
            this.lastConnectionState = connection;

            // Handle different connection states
            switch (connection) {
                case 'open':
                    await this.handleConnectionOpen(update);
                    break;
                case 'close':
                    await this.handleConnectionClose(update);
                    break;
                case 'connecting':
                    await this.handleConnecting(update);
                    break;
            }

            // Handle QR code
            if (qr) {
                await this.handleQRCode(qr);
            }

            // Handle new login
            if (isNewLogin) {
                await this.handleNewLogin();
            }

            // Broadcast ke webhooks
            await webhookService.broadcastEvent(update, 'connection.update');

            // Trigger custom callbacks
            this.triggerCallbacks('connection.update', update);
        });
    }

    setupMessageHandlers() {
        this.sock.ev.on('messages.upsert', async (update) => {
            const startTime = Date.now();
            
            try {
                const { messages, type } = update;
                
                // Record metrics
                metricsService.recordMessageProcessed('message', 'incoming');
                
                // Handle message
                await this.messageHandler.handleMessages(update);
                
                // Record latency
                metricsService.recordMessageLatency(startTime);

                // Broadcast ke webhooks
                await webhookService.broadcastEvent(
                    { messages, type }, 
                    'messages.upsert'
                );

                // Trigger custom callbacks
                this.triggerCallbacks('messages.upsert', update);

            } catch (error) {
                logger.error('Error in message handler:', error);
                metricsService.recordMessageFailed('message', 'processing_error');
                metricsService.recordError('message_processing', 'medium');
            }
        });

        // Message reactions
        this.sock.ev.on('messages.reaction', async (reactions) => {
            try {
                for (const reaction of reactions) {
                    await this.handleMessageReaction(reaction);
                }

                await webhookService.broadcastEvent(
                    { reactions },
                    'messages.reaction'
                );

                this.triggerCallbacks('messages.reaction', reactions);

            } catch (error) {
                logger.error('Error handling reaction:', error);
            }
        });

        // Message updates (edit/delete)
        this.sock.ev.on('messages.update', async (updates) => {
            try {
                for (const update of updates) {
                    await this.handleMessageUpdate(update);
                }

                await webhookService.broadcastEvent(
                    { updates },
                    'messages.update'
                );

                this.triggerCallbacks('messages.update', updates);

            } catch (error) {
                logger.error('Error handling message update:', error);
            }
        });
    }

    setupGroupHandlers() {
        // Group updates
        this.sock.ev.on('groups.update', async (updates) => {
            try {
                for (const update of updates) {
                    await this.handleGroupUpdate(update);
                }

                await webhookService.broadcastEvent(
                    { updates },
                    'groups.update'
                );

                this.triggerCallbacks('groups.update', updates);

            } catch (error) {
                logger.error('Error handling group update:', error);
            }
        });

        // Group participants update
        this.sock.ev.on('group-participants.update', async (update) => {
            try {
                await this.groupHandler.handleGroupUpdate([update]);

                metricsService.recordGroupEvent('participants.update');

                await webhookService.broadcastEvent(
                    update,
                    'group.participants.update'
                );

                this.triggerCallbacks('group-participants.update', update);

            } catch (error) {
                logger.error('Error handling group participants update:', error);
            }
        });
    }

    setupPresenceHandlers() {
        this.sock.ev.on('presence.update', async (update) => {
            try {
                await this.handlePresenceUpdate(update);

                await webhookService.broadcastEvent(
                    update,
                    'presence.update'
                );

                this.triggerCallbacks('presence.update', update);

            } catch (error) {
                logger.error('Error handling presence update:', error);
            }
        });
    }

    setupCallHandlers() {
        this.sock.ev.on('call', async (call) => {
            try {
                await this.handleCall(call);

                await webhookService.broadcastEvent(
                    call,
                    'call'
                );

                this.triggerCallbacks('call', call);

            } catch (error) {
                logger.error('Error handling call:', error);
            }
        });
    }

    setupHistorySyncHandlers() {
        this.sock.ev.on('messaging-history.set', async (update) => {
            try {
                await this.handleHistorySync(update);

                await webhookService.broadcastEvent(
                    { type: 'history_sync', data: update },
                    'history.sync'
                );

                this.triggerCallbacks('messaging-history.set', update);

            } catch (error) {
                logger.error('Error handling history sync:', error);
            }
        });
    }

    // Individual event handlers
    async handleConnectionOpen(update) {
        logger.success('WhatsApp connected successfully!');
        metricsService.updateConnectionStatus(true);
        
        // Update groups count
        try {
            const groups = await this.sock.groupFetchAllParticipating();
            metricsService.updateGroupsCount(Object.keys(groups).length);
        } catch (error) {
            logger.error('Error fetching groups count:', error);
        }
    }

    async handleConnectionClose(update) {
        const { lastDisconnect } = update;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        logger.warn(`Connection closed with status: ${statusCode}`);
        metricsService.updateConnectionStatus(false);
        
        // Handle specific disconnect reasons
        if (statusCode === 401) {
            logger.error('Unauthorized -可能需要重新扫描QR码');
        } else if (statusCode === 403) {
            logger.error('Forbidden - 检查权限设置');
        } else if (statusCode === 404) {
            logger.error('Not found - 检查连接配置');
        } else if (statusCode === 405) {
            logger.error('Multi-device conflict - 请检查已连接的设备');
        } else if (statusCode === 500) {
            logger.error('Server error - WhatsApp服务器问题');
        }
    }

    async handleConnecting(update) {
        logger.info('Connecting to WhatsApp...');
    }

    async handleQRCode(qr) {
        logger.info('QR Code received - waiting for scan...');
        // QR code handling sudah di socket.js
    }

    async handleNewLogin() {
        logger.info('New login detected - session updated');
    }

    async handleMessageReaction(reaction) {
        const { key, reaction: reactionObj } = reaction;
        const user = key.participant || key.remoteJid;
        
        logger.info(`Reaction from ${Helpers.formatJid(user)}: ${reactionObj.text}`);
        
        // Bisa ditambahkan logic untuk handle reaction specific
        if (reactionObj.text === '❤️') {
            // Handle like reaction
        }
    }

    async handleMessageUpdate(update) {
        const { key, update: updateData } = update;
        
        if (updateData.messageStubType === 'message-delete-for-me' ||
            updateData.messageStubType === 'message-delete-for-everyone') {
            
            logger.info(`Message deleted: ${key.id}`);
            metricsService.recordMessageProcessed('delete', 'incoming');
        }
    }

    async handleGroupUpdate(update) {
        // Group updates sudah ditangani oleh groupHandler
        metricsService.recordGroupEvent('settings.update');
    }

    async handlePresenceUpdate(update) {
        const { id, presences } = update;
        
        for (const [participant, presence] of Object.entries(presences)) {
            logger.debug(`Presence update: ${Helpers.formatJid(participant)} -> ${presence}`);
        }
    }

    async handleCall(call) {
        logger.info(`Incoming call from: ${call.from}`);
        
        // Auto reject calls jika diperlukan
        if (process.env.AUTO_REJECT_CALLS === 'true') {
            // this.sock.rejectCall(call.id, call.from);
        }
    }

    async handleHistorySync(update) {
        logger.info('History sync completed');
        
        // Bisa digunakan untuk sync message history
        const { chats, contacts, messages } = update;
        
        if (chats) {
            logger.info(`Synced ${Object.keys(chats).length} chats`);
        }
        
        if (messages) {
            logger.info(`Synced ${messages.length} messages`);
        }
    }

    // Custom event callback registration
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
        
        logger.debug(`Callback registered for event: ${event}`);
    }

    off(event, callback) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
                logger.debug(`Callback removed for event: ${event}`);
            }
        }
    }

    triggerCallbacks(event, data) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    logger.error(`Error in event callback for ${event}:`, error);
                }
            }
        }
    }

    // Get event statistics
    getEventStats() {
        const stats = {
            totalCallbacks: 0,
            events: {}
        };
        
        for (const [event, callbacks] of this.eventCallbacks) {
            stats.events[event] = callbacks.length;
            stats.totalCallbacks += callbacks.length;
        }
        
        return stats;
    }

    // Cleanup
    cleanup() {
        this.eventCallbacks.clear();
        logger.info('Event handler cleaned up');
    }
}

export default EventHandler;