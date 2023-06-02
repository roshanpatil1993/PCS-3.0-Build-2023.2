const httpReq = require("../mc/http")(null, null);
const dbName = process.env.BASE_DB_NAME;
const masterCollectionName = process.env.MASTER_COLLECTION_NAME;
const printerCollectionName = process.env.PRINTERS_COLLECTION_NAME;
const ObjectId = require("mongodb").ObjectId;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")
module.exports = (dbClient, passport) => {

    async function validatePrinter(req, res, next) {
        const log = logger("validatePrinter")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            if (!req.body.name) {
                req.error = CONSTANTS.PRINTER_NAME_REQUIRED;
                req.errorCode = 400;
                next();
            } else {
                const query = {
                    isDeleted: false,
                    name: new RegExp(req.body.name.trim(), 'i')
                };
                const db = dbClient.db(dbName);
                const result = await db
                    .collection(printerCollectionName)
                    .find(query).toArray();
                if (result[0]) {
                    log.warn(CONSTANTS.PRINTER_NAME_EXIST);
                    req.error = CONSTANTS.PRINTER_NAME_EXIST;
                    req.errorCode = 400;
                    next();
                } else {
                    const printerObj = {
                        name: req.body.name.trim(),
                        isWhiteList: req.body.isWhiteList,
                        isDeleted: false
                    }
                    if (req.body._id) {
                        printerObj._id = req.body._id;
                    }
                    req.body = printerObj;
                    log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
                    next();
                }
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function addPrinter(req, res, next) {
        const log = logger("addPrinter")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            if (!req.error) {
                const db = dbClient.db(dbName);
                const result = await db.collection(printerCollectionName).insertOne(req.body);
                if (result) {
                    req.payload = result.ops[0];
                    req.audit = {
                        eventType: 'Add Printer',
                        name: req.payload.name
                    };
                    req.msg = "Printer added successfully"
                    log.info("Printer added successfully")
                    log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                    next();
                }
            } else {
                log.warn("Failed to add Printer")
                req.error = "Failed to add Printer";
                req.errorCode = 500;
                next();
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function getPrinterList(req, res, next) {
        const log = logger("getPrinterList")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const query = {
                "isDeleted": false
            };
            if (req.body.isDeleted !== undefined) {
                query.isDeleted = req.body.isDeleted
            }
            if (req.body.name) {
                query.name = new RegExp(req.body.name, 'i');
            }
            const db = dbClient.db(dbName);
            req.payload = {};
            const printerFlag = await db
                .collection(masterCollectionName)
                .find({
                    type: "PrinterApproach"
                }).toArray();
            if (printerFlag && printerFlag[0]) {
                req.payload.printerFlag = printerFlag[0].isWhiteList;
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
            } else {
                req.payload.printerFlag = true;
            }
            query.isWhiteList = req.payload.printerFlag;
            log.debug(`Query for ${printerCollectionName} :: ${JSON.stringify(query)}`)
            const result = await db
                .collection(printerCollectionName)
                .find(query).toArray();
            if (result) {
                req.payload.printerList = result;
                req.msg = "Getting List of printers"
                log.info("Getting List of printers")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                req.payload.printerList = [];
                req.msg = "Error in getting printerList"
                log.warn("Error in getting printerList")
                next();
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function updatePrinter(req, res, next) {
        const log = logger("updatePrinter")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            if (!req.error) {
                const db = dbClient.db(dbName);
                const result = await db.collection(printerCollectionName).findOneAndUpdate({
                    _id: ObjectId(req.body._id)
                }, {
                    $set: {
                        name: req.body.name.trim()
                    }
                }, { returnOriginal: false });
                if (result) {
                    req.payload = result.value;
                    req.audit = {
                        eventType: 'Update Printer',
                        name: req.payload.name
                    };
                    req.msg = "Printer updated successfully"
                    log.info("Printer updated successfully")
                    log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                    next();
                } else {
                    log.warn("Failed to update Printer")
                    req.error = "Failed to update Printer";
                    req.errorCode = 500;
                    next();
                }
            } else {
                next();
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function deletePrinter(req, res, next) {
        const log = logger("deletePrinter")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const db = dbClient.db(dbName);
            const result = await db.collection(printerCollectionName).findOneAndUpdate({
                _id: ObjectId(req.body._id)
            }, {
                $set: {
                    isDeleted: true
                }
            });
            if (result && result.lastErrorObject && result.lastErrorObject.updatedExisting) {
                req.payload = result.value;
                req.audit = {
                    eventType: 'Delete Printer',
                    name: req.payload.name
                };
                req.msg = "Printer deleted successfully"
                log.info("Printer deleted successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                log.warn("Failed to delete Printer")
                req.error = "Failed to delete Printer";
                req.errorCode = 400;
                next();
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function updatePrinterConfiguration(req, res, next) {
        const log = logger("updatePrinterConfiguration")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const db = dbClient.db(dbName);
            const result = await db
                .collection(masterCollectionName)
                .findOneAndUpdate({
                    type: "PrinterApproach"
                }, {
                    $set: {
                        isWhiteList: req.body.isWhiteList
                    }
                }, { returnOriginal: false });
            if (result && result.value) {
                req.payload = { printerFlag: result.value.isWhiteList };
                req.audit = {
                    eventType: 'Update Printer Approach',
                    name: 'N/A'
                };
                req.msg = "printer configuration updated"
                log.info("printer configuration updated")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function deleteAllPrinter(req, res, next) {
        const log = logger("deleteAllPrinter")
        log.info(CONSTANTS.SOF)
        try {
            const db = dbClient.db(dbName);
            const result = await db
                .collection(printerCollectionName)
                .updateMany({
                    isDeleted: false
                }, {
                    $set: {
                        isDeleted: false
                    }
                }, { returnOriginal: false });
            if (result && result.value) {
                next();
            } else {
                next();
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }


    async function validatePrinterList(req, res, next) {
        const log = logger("validatePrinterList")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const db = dbClient.db(dbName);
            const printerApproach = await db
                .collection(masterCollectionName)
                .findOne({
                    type: "PrinterApproach"
                });
            if (printerApproach && printerApproach.isWhiteList) {
                const printerList = await db
                    .collection(printerCollectionName)
                    .find({ isDeleted: false, isWhiteList: printerApproach.isWhiteList, name: { $in: req.body.printerList } }, { name: 1 }).toArray();
                req.payload = printerList.map(printer => printer.name);
                req.msg = "PrinterList validate successfully"
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                const printerList = await db
                    .collection(printerCollectionName)
                    .find({ isDeleted: false, isWhiteList: printerApproach.isWhiteList, name: { $in: req.body.printerList } }, { name: 1 }).toArray();
                const blackList = printerList.map(printer => printer.name);
                req.payload = req.body.printerList.filter(pri => !blackList.includes(pri));
                req.msg = "PrinterList validate successfully"
                log.info("PrinterList validate successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            }
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    return {
        validatePrinter,
        addPrinter,
        deletePrinter,
        getPrinterList,
        updatePrinter,
        updatePrinterConfiguration,
        validatePrinterList,
        deleteAllPrinter
    };
};