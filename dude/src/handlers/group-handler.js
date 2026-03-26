// src/handlers/group-handler.js
import Logger from '../utils/logger.js';

const logger = new Logger('Group-Handler');

export class GroupHandler {
    constructor(socket) {
        this.sock = socket;
    }

    // Handle group updates
    async handleGroupUpdate(update) {
        try {
            for (const event of update) {
                if (event.type === 'group-participant-update') {
                    await this.handleParticipantUpdate(event);
                } else if (event.type === 'group-update') {
                    await this.handleGroupSettingsUpdate(event);
                }
            }
        } catch (error) {
            logger.error('Error handling group update:', error);
        }
    }

    // Handle participant updates (join/leave/promote/etc)
    async handleParticipantUpdate(event) {
        const { id, participants, action } = event;
        
        for (const participant of participants) {
            const user = participant.id;
            
            switch (action) {
                case 'add':
                    await this.handleUserJoin(id, user);
                    break;
                case 'remove':
                    await this.handleUserLeave(id, user);
                    break;
                case 'promote':
                    await this.handleUserPromote(id, user);
                    break;
                case 'demote':
                    await this.handleUserDemote(id, user);
                    break;
            }
        }
    }

    async handleUserJoin(groupJid, userJid) {
        logger.info(`User ${userJid} joined group ${groupJid}`);
        
        // Welcome message
        await this.sock.sendMessage(groupJid, {
            text: `👋 Welcome to the group, @${userJid.split('@')[0]}!\n\n` +
                  `Please read the group rules and enjoy your stay!`,
            mentions: [userJid]
        });
    }

    async handleUserLeave(groupJid, userJid) {
        logger.info(`User ${userJid} left group ${groupJid}`);
        
        // Goodbye message (optional)
        await this.sock.sendMessage(groupJid, {
            text: `👋 Farewell, @${userJid.split('@')[0]}!`,
            mentions: [userJid]
        });
    }

    async handleUserPromote(groupJid, userJid) {
        logger.info(`User ${userJid} promoted in group ${groupJid}`);
        
        await this.sock.sendMessage(groupJid, {
            text: `🎉 Congratulations @${userJid.split('@')[0]} on becoming an admin!`,
            mentions: [userJid]
        });
    }

    async handleUserDemote(groupJid, userJid) {
        logger.info(`User ${userJid} demoted in group ${groupJid}`);
    }

    // Handle group settings updates
    async handleGroupSettingsUpdate(event) {
        const { id, update } = event;
        
        if (update.announce) {
            logger.info(`Group ${id} announcements: ${update.announce ? 'enabled' : 'disabled'}`);
        }
        
        if (update.restrict) {
            logger.info(`Group ${id} restrictions: ${update.restrict ? 'enabled' : 'disabled'}`);
        }
    }

    // Get group metadata
    async getGroupInfo(groupJid) {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            return metadata;
        } catch (error) {
            logger.error('Error getting group info:', error);
            return null;
        }
    }

    // Get group participants
    async getGroupParticipants(groupJid) {
        try {
            const metadata = await this.getGroupInfo(groupJid);
            return metadata?.participants || [];
        } catch (error) {
            logger.error('Error getting group participants:', error);
            return [];
        }
    }

    // Update group subject
    async updateGroupSubject(groupJid, newSubject) {
        try {
            await this.sock.groupUpdateSubject(groupJid, newSubject);
            logger.info(`Group subject updated to: ${newSubject}`);
            return true;
        } catch (error) {
            logger.error('Error updating group subject:', error);
            return false;
        }
    }

    // Update group description
    async updateGroupDescription(groupJid, newDescription) {
        try {
            await this.sock.groupUpdateDescription(groupJid, newDescription);
            logger.info(`Group description updated`);
            return true;
        } catch (error) {
            logger.error('Error updating group description:', error);
            return false;
        }
    }

    // Group utilities
    async isUserAdmin(groupJid, userJid) {
        const participants = await this.getGroupParticipants(groupJid);
        const user = participants.find(p => p.id === userJid);
        return user?.admin === 'admin' || user?.admin === 'superadmin';
    }

    async getBotRole(groupJid) {
        const participants = await this.getGroupParticipants(groupJid);
        const bot = participants.find(p => p.id === this.sock.user.id);
        return bot?.admin || 'member';
    }
}