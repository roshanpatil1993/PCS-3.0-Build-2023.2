const winston = require('winston');

const DailyRotateFile = require('winston-daily-rotate-file');

const { combine, timestamp, printf } = winston.format;

const logger = winston.createLogger({
    level: 'debug',
    format: combine(
        timestamp(),
        printf(({ level, message, method, timestamp }) => `${level}: ${timestamp}: ${method}: ${message}`)
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/node_logs-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxsize: 50000000, // 50MB
            maxFiles: '30d', // 30 days
        }),
    ]
});

module.exports = function logWithMethod(method) {

    return {
        info: (message) => logger.log('info', message, { method }),
        error: (message) => logger.log('error', message, { method }),
        warn: (message) => logger.log('warn', message, { method }),
        debug: (message) => logger.log('debug', message, { method }),
    };
};