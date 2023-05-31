const httpReq = require("../mc/http")(null, null);
const dbName = process.env.BASE_DB_NAME;
const reasonCollectionName = process.env.REASONS_COLLECTION_NAME;
const reasonsMaster = require('../constants/reason');
const ObjectId = require("mongodb").ObjectId;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")
module.exports = (dbClient, passport) => {

    async function validateReason(req, res, next) {
        const log = logger("validateReason")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            let isReasonAssigned = false;
            reasonsMaster.map(reason => {
                if (req.body[reason]) {
                    isReasonAssigned = true;
                }
            });
            if (!req.body.name) {
                req.error = CONSTANTS.REASON_NAME_REQUIRED;
                req.errorCode = 400;
                next();
            } else if (!isReasonAssigned) {
                req.error = CONSTANTS.REASON_CATEGORY_REQUIRED;
                req.errorCode = 400;
                next();
            } else {
                const query = {
                    isDeleted: false,
                    name: new RegExp(req.body.name.trim(), 'i')
                };
                if (req.body._id) {
                    query._id = { $ne: ObjectId(req.body._id) };
                }
                const db = dbClient.db(dbName);
                log.debug(`Query for ${reasonCollectionName} :: ${JSON.stringify(query)}`)
                const result = await db
                    .collection(reasonCollectionName)
                    .find(query).toArray();
                if (result[0]) {
                    log.warn(CONSTANTS.REASON_EXIST)
                    req.error = CONSTANTS.REASON_EXIST;
                    req.errorCode = 400;
                    next();
                } else {
                    const reasonObj = {
                        name: req.body.name.trim(),
                        isDeleted: false,
                        print: req.body.print,
                        reprint: req.body.reprint,
                        recall: req.body.recall,
                        reconcile: req.body.reconcile,
                    }
                    if (req.body._id) {
                        reasonObj._id = req.body._id;
                    }
                    req.body = reasonObj;
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

    async function addReason(req, res, next) {
        const log = logger("addReason")
        log.info(CONSTANTS.SOF)
        try {
            if (!req.error) {
                const db = dbClient.db(dbName);
                const result = await db.collection(reasonCollectionName).insertOne(req.body);
                log.debug(`Inside Result :: ${JSON.stringify(result)}`)
                if (result) {
                    req.payload = result.ops[0];
                    req.audit = {
                        eventType: 'Add Reason',
                        name: req.payload.name
                    };
                    req.msg = "Reason added successfully"
                    log.info("Reason added successfully")
                    log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                    next();
                } else{
                    req.error = "Failed to add a Reason"
                    req.errorCode = 500;
                    log.warn("Failed to add a Reason");
                    next();
                }

            } else {
                next();
            }
        } catch (err) {
            log.error(CONSTANTS.ERROR_OCCURED + err)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.debug(CONSTANTS.EOF)
    }

    async function getReasonList(req, res, next) {
        const log = logger("getReasonList")
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

            if (req.body.print) {
                query.print = req.body.print;
            }

            if (req.body.reprint) {
                query.reprint = req.body.reprint;
            }

            if (req.body.recall) {
                query.recall = req.body.recall;
            }

            if (req.body.reconcile) {
                query.reconcile = req.body.reconcile;
            }
            log.debug(`Query for ${reasonCollectionName} :: ${JSON.stringify(query)}`)
            const db = dbClient.db(dbName);
            const result = await db
                .collection(reasonCollectionName)
                .find(query).toArray();
            if (result) {
                req.payload = result;
                req.msg = "ReasonList fetched successsfully"
                log.info("ReasonList fetched successsfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
                next();
            } else {
                req.payload = [];
                req.error = "Error in fetching ReasonList"
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

    async function updateReason(req, res, next) {
        const log = logger("updateReason")
        log.info(CONSTANTS.SOF)
        try {
            if (!req.error) {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
                const db = dbClient.db(dbName);
                const result = await db.collection(reasonCollectionName).findOneAndUpdate({
                    _id: ObjectId(req.body._id)
                }, {
                    $set: {
                        name: req.body.name.trim(),
                        isDeleted: false,
                        print: req.body.print,
                        reprint: req.body.reprint,
                        recall: req.body.recall,
                        reconcile: req.body.reconcile
                    }
                });
                if (result) {
                    req.payload = result.value;
                    req.audit = {
                        eventType: 'Update Reason',
                        name: req.body.name   
                    };
                    req.msg = "Reason updated successfully"
                    log.info("Reason updated successfully")
                    log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                    next();
                } else {
                    log.warn("Failed to update a reason")
                    req.error = "Failed to update a reason";
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

    async function deleteReason(req, res, next) {
        const log = logger("deleteReason")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const db = dbClient.db(dbName);
            const result = await db.collection(reasonCollectionName).findOneAndUpdate({
                _id: ObjectId(req.body._id)
            }, {
                $set: {
                    isDeleted: true
                }
            });
            if (result && result.lastErrorObject && result.lastErrorObject.updatedExisting) {
                req.payload = result.value;
                req.audit = {
                    eventType: 'Delete Reason',
                    name: req.payload.name
                };
                req.msg = "Reason deleted successfully"
                log.info("Reason deleted successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                log.warn("Failed to delete a Reason")
                req.error = "Failed to delete a Reason";
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

    async function getReasonForPrinting(req, res, next) {
        const log = logger("getReasonForPrinting")
        log.info(CONSTANTS.SOF)
        try {
            const query = { isDeleted: false };
            if (req.query && req.query.type === 'print') {
                query.print = true;
            } else {
                query.reprint = true;
            }
            log.debug(`Query for ${reasonCollectionName} :: ${JSON.stringify(query)}`)
            const db = dbClient.db(dbName);
            const result = await db
                .collection(reasonCollectionName)
                .find(query, { _id: 1, name: 1 }).toArray();
            if (result) {
                req.payload = result.map(re => {
                    return { label: re.name, value: re.name };
                });
                req.msg = "Fetching reasons for printing"
                log.info("Fetching reasons for printing")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                req.payload = [];
                req.msg = "Unable to fetch reasons for printing"
                log.info("Unable to fetch reasons for printing")
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

    async function getReasonForRecall(req, res, next) {
        const log = logger("getReasonForRecall")
        log.info(CONSTANTS.SOF)
        try {
            const query = { isDeleted: false, recall: true };
            const db = dbClient.db(dbName);
            log.debug(`Query for ${reasonCollectionName} :: ${JSON.stringify(query)}`)
            const result = await db
                .collection(reasonCollectionName)
                .find(query, { _id: 1, name: 1 }).toArray();
            if (result) {
                req.payload = result.map(re => {
                    return { label: re.name, value: re.name };
                });
                req.msg = "Fetching reasons for recall"
                log.info("Fetching reasons for recall")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                req.payload = [];
                req.msg = "Failed to fetch reasons for recall"
                log.info("Failed to fetch reasons for recall")
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

    async function getReasonForRePrinting(req, res, next) {
        const log = logger("getReasonForRePrinting")
        log.info(CONSTANTS.SOF)
        try {
            const query = { isDeleted: false, reprint: true };
            log.debug(`Query for ${reasonCollectionName} :: ${query}`)
            const db = dbClient.db(dbName);
            const result = await db
                .collection(reasonCollectionName)
                .find(query, { _id: 1, name: 1 }).toArray();
            if (result) {
                req.payload = result.map(re => {
                    return { label: re.name, value: re.name };
                });
                req.msg = "Fetching reasons for reprinting"
                log.info("Fetching reasons for reprinting")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                req.payload = [];
                req.msg = "Unable to fetch reasons for reprinting"
                log.info("Unable to fetch reasons for reprinting")
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

    async function getReasonForReconcile(req, res, next) {
        const log = logger("getReasonForReconciledeleteReason")
        log.info(CONSTANTS.SOF)
        try {
            const query = { isDeleted: false, reconcile: true };
            log.debug(`Query for ${reasonCollectionName} :: ${query}`)
            const db = dbClient.db(dbName);
            const result = await db
                .collection(reasonCollectionName)
                .find(query, { _id: 1, name: 1 }).toArray();
            if (result) {
                req.payload = result.map(re => {
                    return { label: re.name, value: re.name };
                });
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                req.payload = [];
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
        validateReason,
        addReason,
        deleteReason,
        getReasonList,
        updateReason,
        getReasonForPrinting,
        getReasonForRePrinting,
        getReasonForRecall,
        getReasonForReconcile
    };
};
