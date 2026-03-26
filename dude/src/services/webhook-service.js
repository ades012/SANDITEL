// src/services/webhook-service.js
import axios from 'axios';
import Logger from '../utils/logger.js';
import { metricsService } from './metrics-service.js';

const logger = new Logger('Webhook-Service');

export class WebhookService {
    constructor() {
        this.webhooks = new Map();
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            timeout: 5000
        };
    }

    // Register webhook endpoint
    registerWebhook(name, url, options = {}) {
        const config = {
            url,
            secret: options.secret,
            events: options.events || ['message', 'group.update', 'connection.update'],
            retry: options.retry !== false,
            enabled: options.enabled !== false,
            headers: options.headers || {}
        };

        this.webhooks.set(name, config);
        logger.info(`Webhook registered: ${name} -> ${url}`);
    }

    // Unregister webhook
    unregisterWebhook(name) {
        const existed = this.webhooks.delete(name);
        if (existed) {
            logger.info(`Webhook unregistered: ${name}`);
        }
        return existed;
    }

    // Send data ke webhook
    async sendToWebhook(name, data, eventType) {
        const webhook = this.webhooks.get(name);
        
        if (!webhook || !webhook.enabled) {
            return { success: false, error: 'Webhook not found or disabled' };
        }

        // Check jika event type didukung
        if (!webhook.events.includes(eventType) && !webhook.events.includes('*')) {
            return { success: false, error: 'Event type not supported' };
        }

        const payload = this.buildPayload(data, eventType, webhook.secret);
        const startTime = Date.now();

        try {
            const response = await this.makeRequest(webhook, payload, eventType);
            const latency = Date.now() - startTime;

            // Record metrics
            metricsService.recordWebhookEvent(eventType, name);
            metricsService.recordWebhookDeliveryLatency(startTime);

            logger.info(`Webhook ${name} delivered successfully (${latency}ms)`);
            
            return {
                success: true,
                status: response.status,
                data: response.data,
                latency
            };

        } catch (error) {
            logger.error(`Webhook ${name} delivery failed:`, error.message);
            metricsService.recordError('webhook_delivery', 'high');
            
            return {
                success: false,
                error: error.message,
                status: error.response?.status
            };
        }
    }

    // Broadcast event ke semua webhook yang relevan
    async broadcastEvent(data, eventType) {
        const results = [];
        
        for (const [name, webhook] of this.webhooks) {
            if (webhook.enabled && 
                (webhook.events.includes(eventType) || webhook.events.includes('*'))) {
                
                const result = await this.sendToWebhook(name, data, eventType);
                results.push({
                    webhook: name,
                    ...result
                });
            }
        }

        return results;
    }

    // Build payload dengan signature
    buildPayload(data, eventType, secret = null) {
        const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: data,
            bot: {
                version: process.env.npm_package_version || '1.0.0',
                instance: process.env.INSTANCE_ID || 'default'
            }
        };

        // Add signature jika secret tersedia
        if (secret) {
            const crypto = require('crypto');
            const signature = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            
            payload.signature = signature;
        }

        return payload;
    }

    // Make HTTP request dengan retry logic
    async makeRequest(webhook, payload, eventType, attempt = 1) {
        try {
            const response = await axios({
                method: 'POST',
                url: webhook.url,
                data: payload,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'WhatsApp-Bot/1.0.0',
                    'X-Webhook-Event': eventType,
                    ...webhook.headers
                },
                timeout: this.retryConfig.timeout
            });

            return response;

        } catch (error) {
            // Retry logic
            if (webhook.retry && attempt < this.retryConfig.maxRetries) {
                const delay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
                
                logger.warn(`Webhook attempt ${attempt} failed, retrying in ${delay}ms`);
                await this.delay(delay);
                
                return this.makeRequest(webhook, payload, eventType, attempt + 1);
            }

            throw error;
        }
    }

    // Utility delay
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get webhook status
    getWebhookStatus(name) {
        const webhook = this.webhooks.get(name);
        if (!webhook) return null;

        return {
            name,
            url: webhook.url,
            enabled: webhook.enabled,
            events: webhook.events,
            lastDelivery: webhook.lastDelivery
        };
    }

    // Get semua webhooks
    getAllWebhooks() {
        const webhooks = [];
        
        for (const [name, config] of this.webhooks) {
            webhooks.push({
                name,
                url: config.url,
                enabled: config.enabled,
                events: config.events
            });
        }
        
        return webhooks;
    }

    // Enable/disable webhook
    setWebhookStatus(name, enabled) {
        const webhook = this.webhooks.get(name);
        if (webhook) {
            webhook.enabled = enabled;
            logger.info(`Webhook ${name} ${enabled ? 'enabled' : 'disabled'}`);
            return true;
        }
        return false;
    }

    // Test webhook connectivity
    async testWebhook(name) {
        const testData = {
            test: true,
            message: 'Webhook connectivity test',
            timestamp: new Date().toISOString()
        };

        return await this.sendToWebhook(name, testData, 'test');
    }

    // Validate webhook URL
    isValidWebhookUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }

    // Cleanup resources
    cleanup() {
        this.webhooks.clear();
        logger.info('Webhook service cleaned up');
    }
}

// Singleton instance
export const webhookService = new WebhookService();
export default webhookService;