const dbName = process.env.BASE_DB_NAME;
const printCollectionName = process.env.PRINT_COLLECTION_NAME;
const ObjectId = require("mongodb").ObjectId;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")

module.exports = (dbClient, passport) => {

  function getDate(date, type) {
    const log = logger("getDate")
    log.info(CONSTANTS.SOF)
    try {
      if (date) {
        const dateArray = date.split("-");
        let month =
          type === "add" ? Number(dateArray[2]) + 1 : Number(dateArray[2]);
        return new Date(Date.UTC(dateArray[0], dateArray[1] - 1, month, 0, 0, 0));
      }
      log.info(CONSTANTS.EOF)
    } catch (err) {
      log.error(CONSTANTS.ERROR_OCCURED + err)
    }
  }

  async function saveRecall(req, res, next) {
    const log = logger("saveRecall")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      if (req.body && req.body._id && req.body.recallInfo && req.body.recallInfo.recallReason) {
        const objIds = req.body._id.map(id => ObjectId(id));
        const query = { _id: { $in: objIds } };
        log.debug(`Query for ${printCollectionName} :: ${JSON.stringify(query)}`)
        const recallInfo = {
          "recallReason": req.body.recallInfo.recallReason,
          "recallStatus": "In-Progress",
          "recallInitiationDate": new Date(new Date().toUTCString()),
          "MigratedPrints": req.body.recallInfo.MigratedPrints ? req.body.recallInfo.MigratedPrints : false
        };
        log.debug(`Recall info ${JSON.stringify(recallInfo)}`)
        const db = dbClient.db(dbName);
        const result = await db.collection(printCollectionName).updateMany(query, { $set: { "recallInfo": recallInfo } },
          { returnOriginal: false });
        log.debug(`Result for ${printCollectionName} :: ${JSON.stringify(result)}`)
        if (result.result.ok == 1) {
          const docs = await db.collection(printCollectionName).find(query, { "#recipient": 1, "#printCopyNo": 1, "@infocardNumber": 1, "@revision": 1, "#type": 1 }).toArray();
          req.payload = docs;
          req.msg = "Recall info updated successfully"
          log.info("Recall info updated successfully")
          log.debug(`Request payload :: ${req.payload}`)
          next();
        }
        else {
          log.error(CONSTANTS.INCORRECT_DATA)
          req.error = CONSTANTS.INCORRECT_DATA;
          req.errorCode = 400;
          next();
        }
      } else {
        log.error(CONSTANTS.INCORRECT_DATA)
        req.error = CONSTANTS.INCORRECT_DATA;
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

  async function getRecallDocList(req, res, next) {
    const log = logger("getRecallDocList")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const query = {};
      if (req.body.printCopyNo) {
        query["#printCopyNo"] = req.body.printCopyNo;
      }
      if (req.body && req.body.userId) {
        query["#userId"] = req.body.userId;
      }
      if (req.body && req.body.type) {
        query["#type"] = req.body.type;
      }
      if (req.body && req.body.revision) {
        query["@revision"] = Number(req.body.revision);
      }
      if (req.body && req.body.printNo) {
        query["#printNo"] = req.body.printNo;
      }
      if (req.body.recipient) {
        query["#recipient"] = req.body.recipient;
      }
      if (req.body.printStatus) {
        query["#printStatus"] = req.body.printStatus;
      }
      if (req.body.printStartDate && req.body.printEndDate) {
        query["#printRequestDateTime"] = {
          $gte: getDate(req.body.printStartDate, ""),
          $lt: getDate(req.body.printEndDate, "add"),
        };
      }
      if (req.body.documentId) {
        query["@infocardNumber"] = req.body.documentId;
      }
      query["recallInfo.recallStatus"] = 'In-Progress';
      log.debug(`Query for ${printCollectionName} :: ${query}`)
      const result = await db
        .collection(printCollectionName)
        .find(query)
        .skip(
          req.body.pageNumber > 0 ? req.body.pageNumber * req.body.pageSize : 0
        )
        .limit(req.body.pageSize)
        .sort({
          "#printRequestDateTime": -1
        })
        .toArray();
      const count = await db.collection(printCollectionName).countDocuments(query);
      req.payload = result;
      req.count = count;
      req.msg = "Fetching recall document list"
      log.info("Fetching recall document list")
      log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
      next();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  async function completeRecall(req, res, next) {
    const log = logger("completeRecall")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const query = {};
      const updateQ = {};
      if (req.body && req.body.type) {
        query._id = ObjectId(req.body.docInfo._id);
        const recallCompletionDate = new Date(new Date().toUTCString());
        updateQ['$set'] = {
          'recallInfo.recallCompletionDate': recallCompletionDate,
          'recallInfo.recallStatus': 'Complete',
          'recallInfo.completionComment': req.body.completionComment
        };
        log.debug(`Query for ${printCollectionName} :: ${query}`)
        log.debug(`Update query for ${printCollectionName} :: ${updateQ}`)
        const result = await db.collection(printCollectionName).findOneAndUpdate(query, updateQ, {
          returnOriginal: false
        });
        log.debug(`Result of ${printCollectionName} :: ${JSON.stringify(result)}`)
        req.payload = result.value;
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        log.debug(`Request payload :: ${JSON.stringify(req.payload)}`)
        next();
      } else {
        req.payload = {};
        req.error = CONSTANTS.INCORRECT_DATA;
        log.warn(CONSTANTS.INCORRECT_DATA)
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

  async function saveReconcile(req, res, next) {
    const log = logger("saveReconcile")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const reconcileCompletionDate = new Date(new Date().toUTCString());
      const updatedIdArr = [];
      const bulkUpdateOps = req.body.map(doc => {
        const data = {
          'printReturned': doc.reconciliationInfo.printReturned,
          'outcome': doc.reconciliationInfo.outcome,
          'outcomeStatus': doc.reconciliationInfo.outcomeStatus,
          'comment': doc.reconciliationInfo.comment,
          'deviationNumber': doc.reconciliationInfo.deviationNumber,
          'reconcileCompletionDate': reconcileCompletionDate,
        }
        if (doc.type == 'Print') {
          updatedIdArr.push(ObjectId(doc._id));
          return {
            "updateOne": {
              "filter": { _id: ObjectId(doc._id) },
              "update": {
                "$set": {
                  'reconciliationInfo': data,
                  'isOverdue': false
                }
              }
            }
          }
        } else {
          return {
            "updateOne": {
              "filter": { _id: ObjectId(doc._id) },
              "arrayFilters": [{ 'element.controlled_copy': doc["#printCopyNo"] }],
              "update": {
                "$set": {
                  "rePrintInfo.$[element].reconciliationInfo": data,
                  "rePrintInfo.$[element].isOverdue": false,
                }

              },
              "upsert": true
            }
          }
        }
      });
      const results = await db.collection(printCollectionName).bulkWrite(bulkUpdateOps, { "ordered": false });
      log.debug(`Inside results :: ${JSON.stringify(results)}`)
      if (results.nMatched >= 1 && results.nModified >= 1) {
        req.payload = updatedIdArr;
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        req.payload = [];
        req.error = CONSTANTS.INCORRECT_DATA;
        req.errorCode = 400;
        log.warn(CONSTANTS.INCORRECT_DATA)
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

  async function updateDueDate(req, res, next) {
    const log = logger("updateDueDate")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const date = getDate(req.body.newDueDate, "");
      const findQ = {
        _id: ObjectId(req.body._id)
      };
      const updateQ = {
        $set: {
          '#dueDate': date,
          '#dueDateReason': req.body.newDueDateReason,
          'isOverdue': false
        }
      };
      log.debug(`findQ for ${printCollectionName} :: ${findQ}`)
      log.debug(`updateQ for ${printCollectionName} :: ${updateQ}`)
      const result = await db.collection(printCollectionName).findOneAndUpdate(findQ, updateQ, {
        returnOriginal: false
      });
      req.payload = result.value;
      log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
      next();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  return {
    saveRecall,
    completeRecall,
    getRecallDocList,
    saveReconcile,
    updateDueDate,
  };
};
