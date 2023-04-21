const httpReq = require("../mc/http")(null, null);
const dbName = process.env.BASE_DB_NAME;
const masterCollectionName = process.env.MASTER_COLLECTION_NAME;
const printerCollectionName = process.env.PRINTERS_COLLECTION_NAME;
const ObjectId = require("mongodb").ObjectId;
module.exports = (dbClient, passport) => {

    async function validatePrinter(req, res, next) {
        if (!req.body.name) {
            req.error = "Printer Name Required";
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
                req.error = "Printer Name Exists";
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
                next();
            }
        }
    }

    async function addPrinter(req, res, next) {
        if (!req.error) {
            const db = dbClient.db(dbName);
            const result = await db.collection(printerCollectionName).insertOne(req.body);
            if (result) {
                req.payload = result.ops[0];
                req.audit = {
                    eventType: 'Add Printer',
                    name: req.payload.name
                };
                next();
            }
        } else {
            next();
        }
    }

    async function getPrinterList(req, res, next) {
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
        } else {
            req.payload.printerFlag = true;
        }
        query.isWhiteList = req.payload.printerFlag;
        const result = await db
            .collection(printerCollectionName)
            .find(query).toArray();
        if (result) {
            req.payload.printerList = result;
            next();
        } else {
            req.payload.printerList = [];
            next();
        }
    }

    async function updatePrinter(req, res, next) {

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

    async function deletePrinter(req, res, next) {
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
            next();
        } else {
            req.error = "Printer Not Found";
            req.errorCode = 400;
            next();
        }
    }

    async function updatePrinterConfiguration(req, res, next) {
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
            next();
        }
    }

    async function deleteAllPrinter(req, res, next) {
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
    }


    async function validatePrinterList(req, res, next) {
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
            next();
        } else {
            const printerList = await db
                .collection(printerCollectionName)
                .find({ isDeleted: false, isWhiteList: printerApproach.isWhiteList, name: { $in: req.body.printerList } }, { name: 1 }).toArray();
            const blackList = printerList.map(printer => printer.name);
            req.payload = req.body.printerList.filter(pri => !blackList.includes(pri));
            next();
        }
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