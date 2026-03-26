// src/utils/logger.js
import chalk from 'chalk';

class Logger {
    constructor(prefix = 'App') {
        this.prefix = prefix;
        this.colors = {
            info: chalk.blue,
            success: chalk.green,
            warn: chalk.yellow,
            error: chalk.red,
            debug: chalk.magenta,
            timestamp: chalk.gray
        };
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    formatMessage(level, message) {
        const timestamp = this.colors.timestamp(`[${this.getTimestamp()}]`);
        const prefix = chalk.cyan(`[${this.prefix}]`);
        const levelColor = this.colors[level] || chalk.white;
        const levelText = levelColor(`[${level.toUpperCase()}]`);
        
        return `${timestamp} ${prefix} ${levelText} ${message}`;
    }

    info(message) {
        console.log(this.formatMessage('info', message));
    }

    success(message) {
        console.log(this.formatMessage('success', message));
    }

    warn(message) {
        console.log(this.formatMessage('warn', message));
    }

    error(message) {
        console.error(this.formatMessage('error', message));
    }

    debug(message) {
        if (process.env.DEBUG) {
            console.log(this.formatMessage('debug', message));
        }
    }
}

export default Logger;