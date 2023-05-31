const dbName = process.env.BASE_DB_NAME;
const auditCollectionName = process.env.AUDIT_COLLECTION_NAME;
const printCollectionName = process.env.PRINT_COLLECTION_NAME;
const adminAuditCollectionName = process.env.ADMIN_AUDIT_COLLECTION_NAME;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages");
const user = require('./user');

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
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
    }
    log.info(CONSTANTS.EOF)
  }

  function getCurrentUTCDate() {
    return new Date(new Date().toUTCString())
  }

  async function getAuditData(req, res, next) {
    const log = logger("getAuditData")
    log.info(CONSTANTS.SOF)
    try {
      const {
        imp_issued_print_coordinator,
        imp_reconciliation,
        imp_controlled_print_coordinator,
        imp_admin,
        imp_issued_print_reprint,
        imp_issued_print_only,
        imp_controlled_print_reprint,
        imp_controlled_print_only,
        imp_recipient_only
      } = req.body.roles;

      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const query = {};
      if (req.body.printStartDate && req.body.printEndDate) {
        query["#printDateTime"] = {
          $gte: getDate(req.body.printStartDate, ""),
          $lt: getDate(req.body.printEndDate, "add"),
        };
      }
      if (req.body.controlled_copy) {
        query["#controlled_copy"] = req.body.controlled_copy;
      }
      if (req.body.documentName) {
        query["documentName"] = req.body.documentName;
      }
      if (req.body.revision) {
        query["revision"] = req.body.revision;
      }
      if (req.body.printNumber) {
        query["printNumber"] = req.body.printNumber;
      }
      if (req.body.printOwner) {
        query["#printOwner.name"] = req.body.printOwner;
      }
      if (req.body.userName) {
        query["#printOwner.userName"] = req.body.userName;
      }
      if (req.body.type) {
        query["#type"] = req.body.type;
      }
      if (req.body.printType) {
        query["#printType"] = req.body.printType;
      }
      if (req.body.recipient) {
        query["#recipient.name"] = req.body.recipient;
      }
      if (req.body.printStatus) {
        query["#printStatus"] = req.body.printStatus;
      }
      else {
        query["#printStatus"] = { $ne: null };
      }

      switch (true) {
        case imp_issued_print_coordinator || imp_reconciliation || imp_controlled_print_coordinator || imp_admin:
          // query["$or"] = [{"#recipient.userName": req.body.username},{"#printOwner.userName": req.body.username}];
          break;
        case imp_issued_print_reprint || imp_issued_print_only || imp_controlled_print_reprint || imp_controlled_print_only:
          query["#printOwner.userName"] = req.body.username;
          break;
        case imp_recipient_only:
          query["#recipient.userName"] = req.body.username;
          break;
        default:
          log.error(CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ROLE_PROVIDED);
          req.error = CONSTANTS.NO_ROLE_PROVIDED;
          req.errorCode = 400;
          break;
      }
      if (!req.error) {
        log.debug(`Query for ${auditCollectionName} :: ${JSON.stringify(query)}`)
        const result = await db
          .collection(auditCollectionName)
          .find(query)
          .skip(
            req.body.pageNumber > 0 ? req.body.pageNumber * req.body.pageSize : 0
          )
          .limit(req.body.pageSize)
          .sort({ "#printDateTime": -1 })
          .toArray();
        const count = await db.collection(auditCollectionName).countDocuments(query);
        req.payload = result;
        req.count = count;
        req.msg = "Audit data fetch successfully"
        log.info("Audit data fetch successfully")
        log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
        log.debug(CONSTANTS.REQ_COUNT + req.count)
      }
      next();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  async function saveRecallAudit(req, res, next) {
    const log = logger("saveRecallAudit")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      if (req.payload && !req.error) {
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        const recall = req.payload;
        const auditLogObjs = [];
        const auditLogObj = {
          "#type": "Recall",
          "#printDateTime": getCurrentUTCDate(),
          "#printOwner": recall["#userId"],
          "#printer": recall["#printer"],
          "#printReason": recall.recallInfo.recallReason,
          "#recipient": recall["#recipient"],
          "#printStatus": recall.recallInfo.recallStatus,
          "#printType": recall["#type"],
          "#profile": recall["#profile"],
          "#pagesToPrint": recall["#pagesToPrint"],
          "#pages": recall["#pages"],
          "#controlled_copy": recall['#printCopyNo'],
          "documentName": recall['@infocardNumber'],
          "revision": recall['@revision'],
          "printNumber": recall['#printNo'],
          "comment": recall.recallInfo.completionComment
        };
        auditLogObjs.push(auditLogObj);
        log.debug("Inside auditLogObjs :: " + JSON.stringify(auditLogObjs))
        if (recall.rePrintInfo) {
          recall.rePrintInfo.map(reprint => {
            if (reprint['#printStatus'] === 'Successful') {
              const auditLogObj = {
                "#type": "Recall",
                "#printDateTime": recall.recallInfo.recallCompletionDate,
                "#printOwner": recall["#userId"],
                "#printer": reprint["#printer"] ? reprint["#printer"] : recall["#printer"],
                "#printReason": recall.recallInfo.recallReason,
                "#recipient": recall["#recipient"],
                "#printStatus": recall.recallInfo.recallStatus,
                "#printType": recall["#type"],
                "#profile": recall["#profile"],
                "#pagesToPrint": reprint["#pagesToPrint"],
                "#pages": reprint["#pages"],
                "#controlled_copy": reprint['#printCopyNo'],
                "documentName": recall['@infocardNumber'],
                "revision": recall['@revision'],
                "printNumber": recall['#printNo'],
                "comment": recall.recallInfo.completionComment
              };
              auditLogObjs.push(auditLogObj);
              log.debug("Inside auditLogObjs :: " + JSON.stringify(auditLogObjs))
            }
          });
        }
        db.collection(auditCollectionName).insertMany(auditLogObjs);
        req.msg = "Recall Audit saved successfully"
        log.info("Recall Audit saved successfully")
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

  async function saveReconcileAudit(req, res, next) {
    const log = logger("saveReconcileAudit")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      if (req.payload && !req.error) {
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        const result = await db.collection(printCollectionName).find({ _id: { '$in': req.payload } }).toArray();
        const auditLogObjs = [];
        for (let i = 0; i < result.length; i++) {
          const recall = result[i];
          const auditLogObj = {
            "#type": "Reconcile",
            "#printDateTime": getCurrentUTCDate(),
            "#printOwner": recall["#userId"],
            "#printer": recall["#printer"],
            "#printReason": '--',
            "#recipient": recall["#recipient"],
            "#printStatus": recall.reconciliationInfo.outcome === 'Complete' ? 'Reconciled' : 'Partial Reconciliation',
            "#printType": recall["#type"],
            "#profile": recall["#profile"],
            "#pagesToPrint": recall["#pagesToPrint"],
            "#pages": recall["#pages"],
            "#controlled_copy": recall['#printCopyNo'],
            "documentName": recall['@infocardNumber'],
            "revision": recall['@revision'],
            "printNumber": recall['#printNo'],
            "comment": recall.reconciliationInfo.comment,
            "printReturned": recall.reconciliationInfo.printReturned,
            "deviationNumber": recall.reconciliationInfo.deviationNumber,
            "outcomeStatus": recall.reconciliationInfo.outcomeStatus
          };
          auditLogObjs.push(auditLogObj);
          log.debug("Inside auditLogObjs for reconcile of print document :: " + JSON.stringify(auditLogObjs))
          if (recall.rePrintInfo) {
            recall.rePrintInfo.map(reprint => {
              if (reprint['#printStatus'] === 'Successful') {
                const auditLogObj = {
                  "#type": "Reconcile",
                  "#printDateTime": getCurrentUTCDate(),
                  "#printOwner": recall["#userId"],
                  "#printer": reprint["#printer"] ? reprint["#printer"] : recall["#printer"],
                  "#printReason": '--',
                  "#recipient": recall["#recipient"],
                  "#printStatus": reprint.reconciliationInfo.outcome === 'Complete' ? 'Reconciled' : 'Partial Reconciliation',
                  "#printType": recall["#type"],
                  "#profile": recall["#profile"],
                  "#pagesToPrint": reprint["#pagesToPrint"],
                  "#pages": reprint["#pages"],
                  "#controlled_copy": reprint['#printCopyNo'],
                  "documentName": recall['@infocardNumber'],
                  "revision": recall['@revision'],
                  "printNumber": recall['#printNo'],
                  "comment": reprint.reconciliationInfo.comment,
                  "printReturned": reprint.reconciliationInfo.printReturned,
                  "deviationNumber": reprint.reconciliationInfo.deviationNumber,
                  "outcomeStatus": reprint.reconciliationInfo.outcomeStatus
                };
                auditLogObjs.push(auditLogObj);
                log.debug("Inside auditLogObjs for reconcile of reprint document :: " + JSON.stringify(auditLogObjs))
              }
            });
          }
        }
        db.collection(auditCollectionName).insertMany(auditLogObjs);
        req.msg = "Reconcile Audit saved successfully"
        log.info("Reconcile Audit saved successfully")
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

  async function saveUpdateDueDateAudit(req, res, next) {
    const log = logger("saveUpdateDueDateAudit")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      if (req.payload && !req.error) {
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        const reconcile = req.payload;
        const auditLogObj = {
          "#type": "Due Date Update",
          "#printDateTime": getCurrentUTCDate(),
          "#overdueUpdateDate": reconcile['#dueDate'],
          "#printOwner": reconcile["#userId"],
          "#printer": reconcile["#printer"],
          "#printReason": reconcile["#dueDateReason"], // 10797 resolved
          "#recipient": reconcile["#recipient"],
          "#printStatus": 'Successful',
          "#printType": reconcile["#type"],
          "#profile": reconcile["#profile"],
          "#pagesToPrint": reconcile["#pagesToPrint"],
          "#pages": reconcile["#pages"],
          "#controlled_copy": reconcile['#printCopyNo'],
          "documentName": reconcile['@infocardNumber'],
          "revision": reconcile['@revision'],
          "printNumber": reconcile['#printNo'],
          "comment": "--"
        };
        db.collection(auditCollectionName).insert(auditLogObj);
        req.msg = "UpdateDueDate Audit saved successfully"
        log.info("UpdateDueDate Audit saved successfully")
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

  async function saveAdminAudit(req, res, next) {
    const log = logger("saveAdminAudit")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      if (req.audit && req.audit.eventType && !req.error) {
        const auditLogObj = {
          type: req.audit.eventType,
          updatedAt: getCurrentUTCDate(),
          updatedBy: "Admin",
          name: req.audit.name
        };
        log.debug("Inside auditLogObj :: " + JSON.stringify(auditLogObj))
        const db = dbClient.db(dbName);
        await db.collection(adminAuditCollectionName).insert(auditLogObj);
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

  async function getAdminAudit(req, res, next) {
    const log = logger("getAdminAudit")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      let query = {};
      if (req.body.type) {
        query.type = new RegExp(req.body.type, 'i')
      }
      log.debug(`Query for ${adminAuditCollectionName} :: ${JSON.stringify(query)}`)
      const sortBy = { "updatedAt": -1 };
      const db = dbClient.db(dbName);
      const result = await db.collection(adminAuditCollectionName).find(query).sort(sortBy).toArray();
      req.payload = result;
      req.msg = "Fetching documents in AdminAudit"
      log.info("Fetching documents in AdminAudit")
      log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
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
    getAuditData,
    saveRecallAudit,
    saveReconcileAudit,
    saveUpdateDueDateAudit,
    saveAdminAudit,
    getAdminAudit
  };
};
