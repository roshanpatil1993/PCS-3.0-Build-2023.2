const httpReq = require("../mc/http")(null, null);
const dbName = process.env.BASE_DB_NAME;
const reasonCollectionName = process.env.REASONS_COLLECTION_NAME;
const reasonsMaster = require('../constants/reason');
const ObjectId = require("mongodb").ObjectId;
const logger = require('../utils/logger');
module.exports = (dbClient, passport) => {

    async function validateReason(req, res, next) {
        let isReasonAssigned = false;
        reasonsMaster.map(reason => {
            if (req.body[reason]) {
                isReasonAssigned = true;
            }
        });

        if (!req.body.name) {
            req.error = "Reason Name Required";
            req.errorCode = 400;
            next();
        } else if (!isReasonAssigned) {
            req.error = "Reason Category Required";
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
            const result = await db
                .collection(reasonCollectionName)
                .find(query).toArray();
            if (result[0]) {
                req.error = "Reason Name Exists";
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
                next();
            }
        }
    }

    async function addReason(req, res, next) {
        const log = logger("addReason")
        if (!req.error) {
            const db = dbClient.db(dbName);
            const result = await db.collection(reasonCollectionName).insertOne(req.body);
            if (result) {
                req.payload = result.ops[0];
                req.audit = {
                    eventType: 'Add Reason',
                    name: req.payload.name
                };
                next();
            }
        } else {
            next();
        }
    }

    async function getReasonList(req, res, next) {
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

        const db = dbClient.db(dbName);
        const result = await db
            .collection(reasonCollectionName)
            .find(query).toArray();
        if (result) {
            req.payload = result;
            next();
        } else {
            req.payload = [];
            next();
        }
    }

    async function updateReason(req, res, next) {

        if (!req.error) {
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
                    name: req.body.name   //10762 audit event for reason
                };
                next();
            } else {
                req.error = "Error in Update";
                req.errorCode = 500;
                next();
            }
        } else {
            next();
        }
    }

    async function deleteReason(req, res, next) {
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
            next();
        } else {
            req.error = "Reason Not Found";
            req.errorCode = 400;
            next();
        }
    }

    async function getReasonForPrinting(req, res, next) {
        const query = { isDeleted: false };
        if (req.query && req.query.type === 'print') {
            query.print = true;
        } else {
            query.reprint = true;
        }
        const db = dbClient.db(dbName);
        const result = await db
            .collection(reasonCollectionName)
            .find(query, { _id: 1, name: 1 }).toArray();
        if (result) {
            req.payload = result.map(re => {
                return { label: re.name, value: re.name };
            });
            next();
        } else {
            req.payload = [];
            next();
        }

    }

    async function getReasonForRecall(req, res, next) {
        const query = { isDeleted: false, recall: true };
        const db = dbClient.db(dbName);
        const result = await db
            .collection(reasonCollectionName)
            .find(query, { _id: 1, name: 1 }).toArray();
        if (result) {
            req.payload = result.map(re => {
                return { label: re.name, value: re.name };
            });
            next();
        } else {
            req.payload = [];
            next();
        }
    }


    async function getReasonForRePrinting(req, res, next) {
        const query = { isDeleted: false, reprint: true };
        const db = dbClient.db(dbName);
        const result = await db
            .collection(reasonCollectionName)
            .find(query, { _id: 1, name: 1 }).toArray();
        if (result) {
            req.payload = result.map(re => {
                return { label: re.name, value: re.name };
            });
            next();
        } else {
            req.payload = [];
            next();
        }
    }


    async function getReasonForReconcile(req, res, next) {
        const query = { isDeleted: false, reconcile: true };
        const db = dbClient.db(dbName);
        const result = await db
            .collection(reasonCollectionName)
            .find(query, { _id: 1, name: 1 }).toArray();
        if (result) {
            req.payload = result.map(re => {
                return { label: re.name, value: re.name };
            });
            next();
        } else {
            req.payload = [];
            next();
        }
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
