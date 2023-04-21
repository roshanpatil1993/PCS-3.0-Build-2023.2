const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp, method }) => {
    return `${timestamp} [${level}] ${method}: ${message}`;
});

const logger = winston.createLogger({
    level: 'info',
    format: combine(
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.metadata(),
        logFormat
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/info.log',
            level:'info',
            maxsize: 10000000, // 10MB
            maxFiles: 5, // 5 log files
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({
            filename: 'logs/error.log',
            level:'error',
            maxsize: 10000000, // 10MB
            maxFiles: 5, // 5 log files
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({
            filename: 'logs/warn.log',
            level:'warn',
            maxsize: 10000000, // 10MB
            maxFiles: 5, // 5 log files
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({
            filename: 'logs/debug.log',
            level:'debug',
            maxsize: 10000000, // 10MB
            maxFiles: 5, // 5 log files
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
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