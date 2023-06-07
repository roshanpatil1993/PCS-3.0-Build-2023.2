const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")

module.exports = () => {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER_NAME,
            pass: process.env.EMAIL_PASSWORD
        },
        requireTLS: true
    });

    async function wrappedSendMail(mailOptions) {
        const log = logger("wrappedSendMail")
        log.info(CONSTANTS.SOF)
        try {
            return new Promise((resolve, reject) => {
                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        reject(error);
                    }
                    else {
                        log.info("Email sent successfully")
                        resolve(info.response);
                    }
                });
            });
        } catch (error) {
           log.error(CONSTANTS.ERROR_OCCURED + error)
        }
        log.info(CONSTANTS.EOF)
    }

    function getMailOption(to) {
        const log = logger("getMailOption")
        log.info(CONSTANTS.SOF)
        try {
            let mailOption = {};
            switch (process.env.environment) {
                case 'development':
                    log.info(CONSTANTS.CASE_SELECTION + "development")
                    mailOption = {
                        from: `"printer-app-dev" <${process.env.MAIL_FROM}>`,
                        to: ["vikas@zogato.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
                    }
                    break;
                case 'test':
                    log.info(CONSTANTS.CASE_SELECTION + "test")
                    mailOption = {
                        from: `"printer-app-test" <${process.env.MAIL_FROM}>`,
                        to: ["aniket.raje@impactsystems.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
                    }
                    break;
                case 'demo':
                    log.info(CONSTANTS.CASE_SELECTION + "demo")
                    mailOption = {
                        from: `"printer-app-demo" <${process.env.MAIL_FROM}>`,
                        to: ["aniket.raje@impactsystems.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
                    }
                    break;
                case 'prod':
                    log.info(CONSTANTS.CASE_SELECTION + "prod")
                    mailOption = {
                        from: `"printer-app" <${process.env.MAIL_FROM}>`,
                        to: to,
                    }
                    break;
                default:
                    log.info(CONSTANTS.CASE_SELECTION + "default")
                    mailOption = {
                        from: `"printer-app-default" <${process.env.MAIL_FROM}>`,
                        to: ["aniket.raje@impactsystems.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
                    }
                    break;
            }
            log.info(CONSTANTS.EOF)
            return mailOption;
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
        }
    }

    async function recallInit(docs) {
        const log = logger("recallInit")
        log.info(CONSTANTS.SOF)
        try {
            log.debug("Inside Docs :: " + JSON.stringify(docs))
            let re = [];
            for (let i = 0; i < docs.length; i++) {
                const doc = docs[i];
                const to = doc['#recipient'];
                const tos = to.email;
                log.debug("Inside tos (email of recipient) :: " + tos)
                if (!(tos==undefined || tos == 'undefined') && tos.length > 0) {
                    const docId = doc['#printCopyNo'];
                    const mailOption = getMailOption(tos);
                    mailOption.subject = `ReCall-Doc || ${docId}`;
                    mailOption.text = `Recall task is pending for Document ${doc['@infocardNumber']} version ${doc['@revision']}\nPlease check the details in PCS inbox.`;
                    log.debug("Inside mailoption :: " + JSON.stringify(mailOption))
                    const r = await wrappedSendMail(mailOption);
                    re.push(r);
                    log.debug("Inside re :: " + JSON.stringify(re))
                }
                else {
                    log.warn(CONSTANTS.EMAIL_MISSING + " " + to.name)
                }
            }
            log.info(CONSTANTS.EOF)
            return re;
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
        }
    }

    async function recallInitMail(req, res, next) {
        const log = logger("recallInitMail")
        log.info(CONSTANTS.SOF)
        const result = await recallInit(req.payload);
        if (result) {
            next();
        } else {
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    return {
        recallInitMail,
        recallInit
    };
};
