// src/services/metrics-service.js
import client from 'prom-client';
import Logger from '../utils/logger.js';

const logger = new Logger('Metrics-Service');

export class MetricsService {
    constructor() {
        this.metrics = {};
        this.initializeMetrics();
    }

    initializeMetrics() {
        try {
            // Reset registry untuk avoid duplicate metrics
            client.register.clear();

            // Message metrics
            this.metrics.messagesTotal = new client.Counter({
                name: 'whatsapp_messages_total',
                help: 'Total number of WhatsApp messages processed',
                labelNames: ['type', 'direction']
            });

            this.metrics.messagesFailed = new client.Counter({
                name: 'whatsapp_messages_failed_total',
                help: 'Total number of failed WhatsApp messages',
                labelNames: ['type', 'error_type']
            });

            // Group metrics
            this.metrics.groupsTotal = new client.Gauge({
                name: 'whatsapp_groups_total',
                help: 'Total number of groups the bot is in'
            });

            this.metrics.groupEvents = new client.Counter({
                name: 'whatsapp_group_events_total',
                help: 'Total number of group events',
                labelNames: ['event_type']
            });

            // Connection metrics
            this.metrics.connectionStatus = new client.Gauge({
                name: 'whatsapp_connection_status',
                help: 'WhatsApp connection status (1 = connected, 0 = disconnected)'
            });

            this.metrics.connectionChanges = new client.Counter({
                name: 'whatsapp_connection_changes_total',
                help: 'Total number of connection state changes',
                labelNames: ['from_state', 'to_state']
            });

            // Performance metrics
            this.metrics.messageLatency = new client.Histogram({
                name: 'whatsapp_message_latency_seconds',
                help: 'Message processing latency in seconds',
                buckets: [0.1, 0.5, 1, 2, 5, 10]
            });

            this.metrics.apiRequests = new client.Counter({
                name: 'whatsapp_api_requests_total',
                help: 'Total number of API requests',
                labelNames: ['endpoint', 'method', 'status']
            });

            // Memory metrics
            this.metrics.memoryUsage = new client.Gauge({
                name: 'whatsapp_bot_memory_usage_bytes',
                help: 'Memory usage of the bot process',
                labelNames: ['type']
            });

            // Business metrics (jika menggunakan WhatsApp Business)
            this.metrics.businessMessages = new client.Counter({
                name: 'whatsapp_business_messages_total',
                help: 'Total business messages processed',
                labelNames: ['message_type']
            });

            // Error metrics
            this.metrics.errorsTotal = new client.Counter({
                name: 'whatsapp_errors_total',
                help: 'Total number of errors',
                labelNames: ['error_type', 'severity']
            });

            // Custom metrics untuk webhook
            this.metrics.webhookEvents = new client.Counter({
                name: 'webhook_events_total',
                help: 'Total webhook events received',
                labelNames: ['event_type', 'source']
            });

            this.metrics.webhookDeliveryLatency = new client.Histogram({
                name: 'webhook_delivery_latency_seconds',
                help: 'Webhook delivery latency in seconds',
                buckets: [0.1, 0.5, 1, 2, 5]
            });

            logger.success('Metrics initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize metrics:', error);
        }
    }

    // Message metrics
    recordMessageProcessed(type = 'text', direction = 'incoming') {
        this.metrics.messagesTotal.inc({ type, direction });
    }

    recordMessageFailed(type = 'text', errorType = 'unknown') {
        this.metrics.messagesFailed.inc({ type, errorType });
    }

    // Group metrics
    updateGroupsCount(count) {
        this.metrics.groupsTotal.set(count);
    }

    recordGroupEvent(eventType) {
        this.metrics.groupEvents.inc({ event_type: eventType });
    }

    // Connection metrics
    updateConnectionStatus(connected) {
        this.metrics.connectionStatus.set(connected ? 1 : 0);
    }

    recordConnectionChange(fromState, toState) {
        this.metrics.connectionChanges.inc({ from_state: fromState, to_state: toState });
    }

    // Performance metrics
    recordMessageLatency(startTime) {
        const latency = (Date.now() - startTime) / 1000;
        this.metrics.messageLatency.observe(latency);
    }

    recordApiRequest(endpoint, method, status) {
        this.metrics.apiRequests.inc({ endpoint, method, status });
    }

    // Memory metrics
    updateMemoryMetrics() {
        const memoryUsage = process.memoryUsage();
        
        this.metrics.memoryUsage.set({ type: 'rss' }, memoryUsage.rss);
        this.metrics.memoryUsage.set({ type: 'heap_total' }, memoryUsage.heapTotal);
        this.metrics.memoryUsage.set({ type: 'heap_used' }, memoryUsage.heapUsed);
        this.metrics.memoryUsage.set({ type: 'external' }, memoryUsage.external);
    }

    // Business metrics
    recordBusinessMessage(messageType) {
        this.metrics.businessMessages.inc({ message_type: messageType });
    }

    // Error metrics
    recordError(errorType, severity = 'medium') {
        this.metrics.errorsTotal.inc({ error_type: errorType, severity });
    }

    // Webhook metrics
    recordWebhookEvent(eventType, source = 'unknown') {
        this.metrics.webhookEvents.inc({ event_type: eventType, source });
    }

    recordWebhookDeliveryLatency(startTime) {
        const latency = (Date.now() - startTime) / 1000;
        this.metrics.webhookDeliveryLatency.observe(latency);
    }

    // Get all metrics sebagai string
    async getMetrics() {
        try {
            this.updateMemoryMetrics();
            return await client.register.metrics();
        } catch (error) {
            logger.error('Error getting metrics:', error);
            return '';
        }
    }

    // Get metrics content type
    getContentType() {
        return client.register.contentType;
    }

    // Reset metrics (hati-hati!)
    resetMetrics() {
        client.register.resetMetrics();
        logger.warn('Metrics reset requested');
    }

    // Get metrics metadata
    getMetricsInfo() {
        const metrics = client.register.getMetricsAsArray();
        return metrics.map(metric => ({
            name: metric.name,
            help: metric.help,
            type: metric.aggregator,
            labels: metric.labelNames
        }));
    }
}

// Singleton instance
export const metricsService = new MetricsService();
export default metricsService;