const dbName = process.env.BASE_DB_NAME;
const auditCollectionName = process.env.AUDIT_COLLECTION_NAME;
const printCollectionName = process.env.PRINT_COLLECTION_NAME;
const adminAuditCollectionName = process.env.ADMIN_AUDIT_COLLECTION_NAME;

module.exports = (dbClient, passport) => {

  function getDate(date, type) {
    if (date) {
      const dateArray = date.split("-");
      let month =
        type === "add" ? Number(dateArray[2]) + 1 : Number(dateArray[2]);
      return new Date(Date.UTC(dateArray[0], dateArray[1] - 1, month, 0, 0, 0));
    }
  }

  function getCurrentUTCDate() {
    return new Date(new Date().toUTCString())
  }
  async function getAuditData(req, res, next) {
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
    next();
  }

  async function saveRecallAudit(req, res, next) {
    const db = dbClient.db(dbName);
    if (req.payload && !req.error) {
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
          }
        });
      }
      db.collection(auditCollectionName).insertMany(auditLogObjs);
      next();
    } else {
      next();
    }
  }

  async function saveReconcileAudit(req, res, next) {
    const db = dbClient.db(dbName);
    if (req.payload && !req.error) {
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
            }
          });
        }
      }
      db.collection(auditCollectionName).insertMany(auditLogObjs);
      next();
    } else {
      next();
    }
  }

  async function saveUpdateDueDateAudit(req, res, next) {
    const db = dbClient.db(dbName);
    if (req.payload && !req.error) {
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
      next();
    } else {
      next();
    }
  }

  async function saveAdminAudit(req, res, next) {
    if (req.audit && req.audit.eventType && !req.error) {
      const auditLogObj = {
        type: req.audit.eventType,
        updatedAt: getCurrentUTCDate(),
        updatedBy: "Admin",
        name: req.audit.name
      };
      const db = dbClient.db(dbName);
      await db.collection(adminAuditCollectionName).insert(auditLogObj);
      next();
    } else {
      next();
    }
  }

  async function getAdminAudit(req, res, next) {
    let query = {};
    if (req.body.type) {
      query.type = new RegExp(req.body.type, 'i')
    }
    const sortBy = { "updatedAt": -1 };
    const db = dbClient.db(dbName);
    const result = await db.collection(adminAuditCollectionName).find(query).sort(sortBy).toArray();
    req.payload = result;
    next();
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
