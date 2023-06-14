const PDF = require("pdf-lib");
const ObjectId = require("mongodb").ObjectId;
const fs = require("fs");
const dbName = process.env.BASE_DB_NAME;
const printCollectionName = process.env.PRINT_COLLECTION_NAME;
const profileCollectionName = process.env.PROFILE_COLLECTION_NAME;
const httpPy = require("../py/http")(null, null);
const httpReq = require("../mc/http")(null, null);
const exception = require('../utils/exception');
const auditCollectionName = process.env.AUDIT_COLLECTION_NAME;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")

module.exports = (dbClient, passport) => {

  async function getNumPages(file) {
    const log = logger("getNumPages")
    log.info(CONSTANTS.SOF)
    try {
      const resData = await httpPy.post('/pyApi/getPDFPageCount', JSON.stringify({ path: file }));
      log.debug("Inside resData (returning pageCount of selected document) ::"  +JSON.stringify(resData))
      if (resData && resData.pageCount) {
        return resData.pageCount;
      } else {
        return 1;
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
    }
    log.info(CONSTANTS.EOF)
  }

  function getDate(date, type) {
    if (date) {
      const dateArray = date.split("-");
      let month =
        type === "add" ? Number(dateArray[2]) + 1 : Number(dateArray[2]);
      return new Date(Date.UTC(dateArray[0], dateArray[1] - 1, month, 0, 0, 0));
    }
  }

  async function getDocumentList(req, res, next) {
    const log = logger("getDocumentList")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const {
        imp_issued_print_coordinator,
        imp_reconciliation,
        imp_controlled_print_coordinator,
        imp_admin,
        imp_issued_print_reprint,
        imp_issued_print_only,
        imp_controlled_print_reprint,
        imp_controlled_print_only,
        imp_recipient
      } = req.body.roles;

      const db = dbClient.db(dbName);
      const query = {};
      if (req.body.printCopyNo) {
        query["#printCopyNo"] = req.body.printCopyNo;
      }
      if (req.body && req.body.userId) {
        query["#userId.name"] = req.body.userId;
      }
      if (req.body && req.body.type) {
        query["#type"] = req.body.type;
      }
      if (req.body.recipient) {
        query["#recipient.name"] = req.body.recipient;
      }
      if (req.body.printStatus) {
        query["#printStatus"] = req.body.printStatus;
      }
      if (req.body.recallStatus) {
        query["recallInfo.recallStatus"] = req.body.recallStatus;
      }
      if (req.body.printStartDate && req.body.printEndDate) {
        query["#printRequestDateTime"] = {
          $gte: getDate(req.body.printStartDate, ""),
          $lt: getDate(req.body.printEndDate, "add"),
        };
      }
      if (req.body.reconciliationDueDate) {
        query["#dueDate"] = getDate(req.body.reconciliationDueDate, "");
      }
      if (req.body.reconciliationStatus) {
        query["reconciliationInfo.outcome"] = req.body.reconciliationStatus;
      }
      if (req.body.isOverdue === 'true') {
        query['isOverdue'] = true;
      }
      if (req.body.isOverdue === 'false') {
        query['$or'] = [{ 'isOverdue': { '$exists': false } }, { 'isOverdue': false }];
      }
      if (req.body.documentName) {
        query["@infocardNumber"] = req.body.documentName;
      }
      if (req.body.revision) {
        query["@revision"] = req.body.revision;
      }
      if (req.body.printNumber) {
        query["#printNo"] = req.body.printNumber;
      }
      if (req.body.profile) {
        query["#profile"] = req.body.profile;
      }

      let sortObj = {
        '@infocardNumber': 1,
        '@revision': -1,
        '#printNo': -1
      };
      if (req.body.reprintDashboardType) {
        if (req.body.reprintDashboardType === 'Reconciliation') {
          switch (true) {
            case imp_reconciliation || imp_admin:
              // query["$or"] = [{"#recipient.userName": req.body.username},{"#printOwner.userName": req.body.username}];
              break;
            case imp_issued_print_coordinator || imp_controlled_print_coordinator || imp_issued_print_reprint || imp_issued_print_only || imp_controlled_print_reprint || imp_controlled_print_only || imp_recipient:
              log.error(CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ACCESS, "user with imp_reconciliation and imp_admin role can access this page");
              req.error = CONSTANTS.NO_ACCESS;
              req.errorCode = 400;
              break;
            default:
              log.error(CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ROLE_PROVIDED);
              req.error = CONSTANTS.NO_ROLE_PROVIDED;
              req.errorCode = 400;
          }
          if (!req.error) {
            const agg = [
              {
                '$match': query
              }, {
                '$addFields': {
                  'order': {
                    '$cond': {
                      'if': {
                        '$eq': [
                          '$isOverdue', true
                        ]
                      },
                      'then': 1,
                      'else': {
                        '$cond': {
                          'if': {
                            '$eq': [
                              '$isOverdue', false
                            ]
                          },
                          'then': 3,
                          'else': 2
                        }
                      }
                    }
                  }
                }
              }, {
                '$sort': {
                  'order': 1,
                  '@infocardNumber': 1,
                  '@revision': 1,
                  '#printNo': 1
                }
              },
              {
                '$skip': req.body.pageNumber > 0 ? req.body.pageNumber * req.body.pageSize : 0
              }, {
                '$limit': req.body.pageSize
              }
            ];
            log.debug(`Query for ${printCollectionName} (Reconciliation) :: ${JSON.stringify(query)}`)
            const result = await db
              .collection(printCollectionName)
              .aggregate(agg).toArray();
            const count = await db.collection(printCollectionName).countDocuments(query);
            req.payload = result;
            req.count = count;
            req.msg = "Fetching document list for reconciliation dashboard"
            log.info("Fetching document list for reconciliation dashboard")
            log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
            log.debug(CONSTANTS.REQ_COUNT + req.count)
          }
          next();
        } else {
          switch (true) {
            case imp_controlled_print_coordinator || imp_admin:
              // query["$or"] = [{"#recipient.userName": req.body.username},{"#printOwner.userName": req.body.username}];
              break;
            case imp_controlled_print_reprint || imp_controlled_print_only:
              query["#userId.userName"] = req.body.username;
              break;
            case imp_reconciliation || imp_controlled_print_coordinator || imp_issued_print_reprint || imp_issued_print_only || imp_recipient:
              log.error(CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ACCESS, "user with imp_reconciliation || imp_controlled_print_coordinator || imp_issued_print_reprint || imp_issued_print_only || imp_recipient don't have access this page");
              req.error = CONSTANTS.NO_ACCESS;
              req.errorCode = 400;
              break;
            default:
              log.error(CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ROLE_PROVIDED);
              req.error = CONSTANTS.NO_ROLE_PROVIDED;
              req.errorCode = 400;
          }
          if (!req.error) {
            log.debug(`Query for ${printCollectionName} (Recall):: ${JSON.stringify(query)}`)
            const result = await db
              .collection(printCollectionName)
              .find(query)
              .sort(sortObj)
              .skip(
                req.body.pageNumber > 0 ? req.body.pageNumber * req.body.pageSize : 0
              )
              //    .limit(req.body.pageSize)
              .toArray();
            const count = await db.collection(printCollectionName).countDocuments(query);
            req.payload = result;
            req.count = count;
            req.msg = "Fetching document list for recall dashboard"
            log.info("Fetching document list for recall dashboard")
            log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
            log.debug(CONSTANTS.REQ_COUNT + req.count)
          }
          next();
        }
      } else {
        switch (true) {
          case imp_issued_print_coordinator || imp_controlled_print_coordinator || imp_admin:
            // query["$or"] = [{"#recipient.userName": req.body.username},{"#printOwner.userName": req.body.username}];
            break;
          case imp_issued_print_reprint || imp_controlled_print_reprint:
            query["#userId.userName"] = req.body.username;
            break;
          case imp_recipient:
            query["#recipient.userName"] = req.body.username;
            break;
          case imp_reconciliation || imp_issued_print_only || imp_controlled_print_only:
            log.error(CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ACCESS, "user with imp_reconciliation || imp_issued_print_only || imp_controlled_print_only don't have access this page");
            req.error = CONSTANTS.NO_ACCESS;
            req.errorCode = 400;
            break;
          default:
            log.error(CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ROLE_PROVIDED);
            req.error = CONSTANTS.ERROR_OCCURED + CONSTANTS.NO_ROLE_PROVIDED;
            req.errorCode = 400;
        }
        if (!req.error) {
          log.debug(`Query for ${printCollectionName} (Reprint):: ${JSON.stringify(query)}`)
          const result = await db
            .collection(printCollectionName)
            .find(query)
            .sort(sortObj)
            .skip(
              req.body.pageNumber > 0 ? req.body.pageNumber * req.body.pageSize : 0
            )
            // .limit(req.body.pageSize)
            .toArray();
          const count = await db.collection(printCollectionName).countDocuments(query);
          console.log("Count :: " + count)
          req.payload = result;
          req.count = count;
          req.msg = "Fetching document list for reprint dashboard"
          log.info("Fetching document list for reprint dashboard")
          log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
          log.debug(CONSTANTS.REQ_COUNT + req.count)
        }
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

  async function verifyPrintRecipient(req, res, next) {
    const log = logger("verifyPrintRecipient")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const query = {};
      if (req.body && req.body["#type"]) {
        query["#type"] = req.body["#type"];
      }
      if (req.body && req.body["@revision"]) {
        query["@revision"] = req.body["@revision"];
      }
      const recipient = req.body["#internalRecipient"].concat(req.body["#externalRecipient"]).map(re => re.name);
      query["#recipient.name"] = {
        "$in": recipient
      };
      if (req.body["@infocardNumber"]) {
        query["@infocardNumber"] = req.body["@infocardNumber"];
      }
      query["#printStatus"] = 'Successful';
      log.debug(`Query for ${printCollectionName} :: ${JSON.stringify(query)}`)

      const result = await db
        .collection(printCollectionName)
        .find(query).toArray();
      let resultArr = [];
      recipient.map((item) => {
        if (result.find(x => x['#recipient'].name === item)) {
          resultArr.push(item);
        }
      });
      req.payload = resultArr.length ? resultArr : null;
      req.msg = "PrintRecipient verified successfully"
      log.info("PrintRecipient verified successfully")
      log.debug(CONSTANTS.REQ_PAYLOAD + (req.payload))
      next();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  function pad(num, size) {
    const s = "0000" + num;
    return s.substr(s.length - size);
  }

  async function rePrint(req, res, next) {
    const log = logger("rePrint")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const overlayDocPath = await db.collection(profileCollectionName)
        .find({ _id: ObjectId(req.body.profileId) }).toArray();
      const query = `document/${req.body['@infocardId']}/altered-fully-published-main-file`;
      log.debug(`Query for result1 :: ${query}`)
      const result1 =
        await httpReq.downloadDoc(query, req.user.mcToken, `./../resources/docs/${req.body['@infocardId']}.pdf`);
      if (result1 && overlayDocPath) {
        let query = {};
        if (req.body && req.body._id) {
          query = {
            _id: ObjectId(req.body._id),
          };
        }
        log.debug(`Query for ${printCollectionName} :: ${JSON.stringify(query)}`)
        let rePrintInfo = [];
        const pdf = `${req.body['@infocardId']}.pdf`;

        const doc = await db.collection(printCollectionName).find(query).toArray();

        const resultDocument = JSON.parse(JSON.stringify(doc[0]));
        const reprintId = "R" + Number(resultDocument.rePrintInfo.length + 1);
        let date = new Date().getTime();
        date += ((-(new Date().getTimezoneOffset() / 60)) * 60 * 60 * 1000);

        const obj = JSON.stringify({
          "#userId": resultDocument["#userId"],
          "controlled_copy": resultDocument["#type"] +
            "-" +
            resultDocument["@infocardNumber"] +
            "-" +
            resultDocument["@revision"] +
            "-" +
            resultDocument["#printNo"] +
            reprintId,
          "#printCopyNo": resultDocument["#type"] +
            "-" +
            resultDocument["@infocardNumber"] +
            "-" +
            resultDocument["@revision"] +
            "-" +
            resultDocument["#printNo"] +
            reprintId,
          "#printedDateTime": new Date(new Date().toUTCString()),
          "#printRequestDateTime": new Date(date),
          "#printNo": resultDocument["#printNo"],
          "#recipient": resultDocument["#recipient"],
          "#printReason": req.body["#printReason"],
          "#pagesToPrint": req.body["#pagesToPrint"],
          "#pages": req.body["#pages"],
          "#profile": req.body["#profile"],
          "#batchNumber": req.body["#batchNumber"],        //10820 batchid req.body
          "profileFields": req.body['profileFields'],
          "#printStatus": 'Requested'                      //10977
        });

        const overlayObj = {
          "#pagesToPrint": req.body["#pagesToPrint"],
          "#pages": req.body["#pages"]
        };
        req.body.profileFields.map(field => {
          if (field.key && field.key !== '' && field.key !== undefined && field.key !== null) {
            if (field.key.startsWith('#')) {
              switch (field.key) {
                case '#printRequestDateTime':
                  overlayObj[field.key] = new Date(date);
                  break;
                case '#userId':
                  overlayObj[field.key] = resultDocument['#userId'].name;
                  break;
                case '#recipient':
                  overlayObj[field.key] = resultDocument['#recipient'].name;
                  break;
                case '#printReason':
                  overlayObj[field.key] = req.body["#printReason"];
                  break;
                case '#noOfPrint':
                  overlayObj[field.key] = resultDocument[field.key];
                  break;
                case '#printCopyNo':
                  overlayObj[field.key] = resultDocument[field.key] + reprintId;
                  break;
                case '#profile':
                  overlayObj[field.key] = resultDocument[field.key];
                  break;
                case '#batchNumber':
                  overlayObj[field.key] = req.body["#batchNumber"]; //11163: BatchNumber is not getting updated
                  break;
              }
            }
            else if (field.key.startsWith('@')) {
              overlayObj[field.key] = resultDocument[field.key];
            }
            else if (field.key.startsWith('^')) {
              overlayObj[field.key] = field.value;
            } else {
              overlayObj[field.key] = field.value;
            }
          } else {
            overlayObj[field.name] = field.value;
          }
        });

        const overlay = {
          formFields: overlayObj,
          name: resultDocument._id,
          templatePath: overlayDocPath[0].templates.map(tmp => `${tmp._id}.pdf`),
          basePath: pdf
        }
        log.debug("overlay for reprinting document :: " +JSON.stringify(overlay))
        const resData = await httpPy.post('/pyApi/overlayDocument', JSON.stringify(overlay));
        log.debug("Java response when doc send for reprinting" + JSON.stringify(resData))
        if (resData && resData.success) {
          JSON.parse(obj).overlayStatus = "success";
        } else {
          JSON.parse(obj).overlayStatus = "error";
        }

        rePrintInfo = resultDocument.rePrintInfo.concat([JSON.parse(obj)]);
        const result = await db.collection(printCollectionName).findOneAndUpdate(query, {
          $set: {
            rePrintInfo: rePrintInfo,
          },
        });
        log.debug("Inside Result (reprint document stored inside print_info) ::" + result)
        let auditLogObj = {
          "#type": "Reprint",
          "#printDateTime": new Date(new Date().toUTCString()),
          "#printer": resultDocument["#printer"],
          "#printOwner": resultDocument["#userId"],
          "#printReason": req.body["#printReason"],
          "#recipient": resultDocument["#recipient"],
          "#overdueUpdateDate": resultDocument['#dueDate'],
          "#printStatus": 'Requested',
          "#printType": resultDocument["#type"],
          "#profile": req.body["#profile"],
          "#pagesToPrint": req.body["#pagesToPrint"],
          "#pages": req.body["#pages"],
          "#batchNumber": req.body["#batchNumber"],            //10820 batchid req.body
          "documentName": resultDocument['@infocardNumber'],
          "revision": resultDocument['@revision'],
          "printNumber": resultDocument['#printNo'],
          "profileFields": resultDocument["profileFields"],
          "#controlled_copy": resultDocument["#type"] +
            "-" +
            resultDocument["@infocardNumber"] +
            "-" +
            resultDocument["@revision"] +
            "-" +
            resultDocument["#printNo"] +
            reprintId
        };
        db.collection(auditCollectionName).insertOne(auditLogObj);
        req.payload = JSON.parse(obj);
        req.msg = "Document reprinted Successfully"
        log.info("Document reprinted Successfully")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        return exception.raiseError(req, res, next, 'PA001', '401', CONSTANTS.SESSION_EXPIRED);
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  async function updatePrintStatus(req, res, next) {
    const log = logger("updatePrintStatus")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      if (req.body && req.body.docIds && req.body.docIds.length) {
        const docList = req.body.docIds;
        if (docList && docList.length > 0) {
          const db = dbClient.db(dbName);
          let result;
          for (let i = 0; i < docList.length; i++) {
            let printStatus = (docList[i].status) ? docList[i].status : 'Successful';
            if (req.body.reprintId) {
              query = {
                _id: ObjectId(docList[i]._id),
                "rePrintInfo.controlled_copy": req.body.reprintId,
              };
              log.debug(`Query for ${printCollectionName} :: ${JSON.stringify(query)}`)
              if (docList[i].status) {
                printStatus = docList[i].status;
              }
              result = await db.collection(printCollectionName).findOneAndUpdate(query, {
                $set: {
                  "rePrintInfo.$.#printStatus": printStatus,
                },
              }, {
                returnOriginal: false
              });
              log.debug("Inside Result (updated reprint status)" + JSON.stringify(result))
            } else {
              query = {
                _id: ObjectId(docList[i]._id),
              };
              result = await db.collection(printCollectionName).findOneAndUpdate(query, {
                $set: {
                  "#printStatus": printStatus,
                },
              }, {
                returnOriginal: false
              });
              log.debug("Inside Result (updated print status)" + JSON.stringify(result))
            }
            if (req.body.reprintId && result && result.value && result.value.rePrintInfo &&
              result.value.rePrintInfo.length) {
              let auditLogObj = {};
              let rePrintInfo = result.value.rePrintInfo;
              for (let i = 0; i < rePrintInfo.length; i++) {
                if (rePrintInfo[i].controlled_copy === req.body.reprintId) {
                  auditLogObj = {
                    "#type": req.body.reprintId ? "Reprint" : "Print",
                    "#printDateTime": new Date(new Date().toUTCString()),
                    "#printOwner": result.value["#userId"],
                    "#printer": result.value["#printer"],
                    "#printReason": rePrintInfo[i]["#printReason"],
                    "#recipient": result.value["#recipient"],
                    "#printStatus": printStatus,
                    "#printType": result.value["#type"],
                    "#overdueUpdateDate": result.value['#dueDate'],
                    "#profile": rePrintInfo[i]["#profile"],
                    "#batchNumber": rePrintInfo[i]["#batchNumber"],         //10820 batchnumber
                    "profileFields": rePrintInfo[i]["profileFields"],
                    "#pagesToPrint": rePrintInfo[i]["#pagesToPrint"],
                    "#pages": rePrintInfo[i]["#pages"],
                    "#controlled_copy": req.body.reprintId,
                    "documentName": result.value['@infocardNumber'],
                    "revision": result.value['@revision'],
                    "printNumber": rePrintInfo[i]['#printNo']
                  };
                  break;
                }
              }
              log.debug("auditLogObj for reprint" + auditLogObj)
              if (auditLogObj) {
                db.collection(auditCollectionName).insertOne(auditLogObj);
              }
            } else if (result && result.value) {
              auditLogObj = {
                "#type": req.body.reprintId ? "Reprint" : "Print",
                "#printDateTime": new Date(new Date().toUTCString()),
                "#printOwner": result.value["#userId"],
                "#printer": result.value["#printer"],
                "#printReason": result.value["#printReason"],
                "#recipient": result.value["#recipient"],
                "#printStatus": printStatus,
                "#printType": result.value["#type"],
                "#profile": result.value["#profile"],
                "#batchNumber": result.value["#batchNumber"],       //10820 batchnumber
                "profileFields": result.value["profileFields"],
                "#overdueUpdateDate": result.value['#dueDate'],
                "#pagesToPrint": result.value["#pagesToPrint"],
                "#pages": result.value["#pages"],
                "#controlled_copy": result.value["#type"] +
                  "-" +
                  result.value["@infocardNumber"] +
                  "-" +
                  result.value["@revision"] +
                  "-" +
                  result.value["#printNo"],
                "documentName": result.value['@infocardNumber'],
                "revision": result.value['@revision'],
                "printNumber": result.value['#printNo']
              };
              log.debug("auditLogObj for print" + auditLogObj)
              db.collection(auditCollectionName).insertOne(auditLogObj);
            }
          }
          req.payload = "Success";
          req.msg = "Print/reprint status updated successfully"
          log.info("Print/reprint status updated successfully")
          next();
        }
      } else {
        req.payload = "Error";
        req.msg = "Unable to update Print/reprint status"
        log.info("Unable to update Print/reprint status")
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

  async function print(req, res, next) {
    const log = logger("print")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      let noOfPrint = 1;
      if (req.body.noOfPrint) {
        noOfPrint = req.body.noOfPrint;
      }
      const overlayDocPath = await db.collection(profileCollectionName)
        .find({ _id: ObjectId(req.body.profileId) }).toArray();
      const query = `document/${req.body['@infocardId']}/altered-fully-published-main-file`;
      log.debug(`Query for mcResult :: ${query}`)
      const mcResult = await httpReq.downloadDoc(query, req.user.mcToken, `./../resources/docs/${req.body['@infocardId']}.pdf`);

      if (mcResult && overlayDocPath.length) {
        const printDocs = [];
        const sourcePdf = `${req.body['@infocardId']}.pdf`;
        const sourcePdfPageCount = await getNumPages(sourcePdf);
        const printCopyNumberQuery = {
          '@infocardNumber': req.body["@infocardNumber"],
          '@revision': req.body["@revision"],
          '#type': req.body['#type']
        };
        let printVersionNumber = "0001";
        let maxCount = 1;
        const printVersion = await db
          .collection(printCollectionName)
          .find(printCopyNumberQuery, {
            "#printNo": 1,
          })
          .sort({
            "#printNo": -1
          })
          .limit(1)
          .toArray();
        if (printVersion && printVersion.length > 0) {
          maxCount = Number(printVersion[0]['#printNo']) + 1;
          printVersionNumber = pad(maxCount, 4);
        }
        let recipients = [];
        if (req.body["#internalRecipient"] && req.body["#externalRecipient"]) {
          recipients = req.body["#internalRecipient"].concat(req.body["#externalRecipient"]);
        }
        if (recipients) {
          for (let i = 0; i < recipients.length; i++) {
            for (let j = 0; j < noOfPrint; j++) {
              const obj = JSON.parse(JSON.stringify(req.body));
              if (req.body['#dueDate']) {
                const datearr = req.body['#dueDate'].split('/');
                const date = new Date();
                date.setUTCDate(datearr[0]);
                date.setUTCMonth(datearr[1]);
                date.setUTCFullYear(datearr[2]);
                date.setUTCHours(0);
                date.setUTCMinutes(0);
                date.setUTCSeconds(0);
                obj["#dueDate"] = new Date(date.toUTCString());
              }
              obj["#recipient"] = recipients[i];
              obj["#printNo"] = printVersionNumber;
              obj["#pageCount"] = sourcePdfPageCount;
              obj["#printRequestDateTime"] = new Date(new Date().toUTCString());
              obj["#printStatus"] = 'Requested';
              obj["#printCopyNo"] =
                req.body["#type"] +
                "-" +
                req.body["@infocardNumber"] +
                "-" +
                req.body["@revision"] +
                "-" +
                printVersionNumber
              obj.rePrintInfo = [];
              obj['#batchNumber'] = req.body["#batchNumber"];
              printDocs.push(obj);
              maxCount = maxCount + 1;
              printVersionNumber = pad(maxCount, 4);
            }
          }
        }
        const re = await db.collection(printCollectionName).insertMany(printDocs);
        log.debug(`Saved document inside ${printCollectionName} + ${JSON.stringify(re)}`)
        const insertedIds = [];
        Object.keys(re.insertedIds).map((key) => {
          insertedIds.push(re.insertedIds[key]);
        });
        const query = {
          _id: {
            $in: insertedIds
          }
        };
        log.debug(`Query for ${printCollectionName} :: ${JSON.stringify(query)}`)
        const profiles = await db.collection(printCollectionName).find(query).toArray();
        let date = new Date().getTime();
        date += ((-(new Date().getTimezoneOffset() / 60)) * 60 * 60 * 1000);
        for (let i = 0; i < profiles.length; i++) {
          const resultDocument = profiles[i];
          const obj = {
            '#pagesToPrint': []
          };
          req.body.profileFields.map(field => {
            if (field.key && field.key !== '' && field.key !== undefined && field.key !== null) {
              if (field.key.startsWith('#')) {
                switch (field.key) {
                  case '#printRequestDateTime':
                    obj[field.key] = new Date(date);
                    break;
                  case '#userId':
                    obj[field.key] = resultDocument['#userId'].name;
                    break;
                  case '#recipient':
                    obj[field.key] = resultDocument['#recipient'].name;
                    break;
                  case '#printReason':
                    obj[field.key] = resultDocument[field.key];
                    break;
                  case '#noOfPrint':
                    obj[field.key] = resultDocument[field.key];
                    break;
                  case '#printCopyNo':
                    obj[field.key] = resultDocument[field.key];
                    break;
                  case '#profile':
                    obj[field.key] = resultDocument[field.key];
                    break;
                  case '#batchNumber':
                    obj[field.key] = resultDocument["#batchNumber"];
                    break;
                }
              } else if (field.key.startsWith('@')) {
                obj[field.key] = resultDocument[field.key];
              } else if (field.key.startsWith('^')) {
                obj[field.key] = field.value;
              } else {
                obj[field.key] = field.value;
              }
            } else {
              obj[field.name] = field.value;
            }
          });
          const overlay = {
            formFields: obj,
            name: profiles[i]._id,
            templatePath: overlayDocPath[0].templates.map(tmp => `${tmp._id}.pdf`),
            basePath: `${req.body['@infocardId']}.pdf`
          }
          log.debug("overlay for printing documents :: " +JSON.stringify(overlay))
          let auditLogObj = {
            '#type': "Print",
            '#printDateTime': new Date(new Date().toUTCString()),
            '#printOwner': resultDocument['#userId'],
            "#printer": resultDocument["#printer"],
            '#printReason': resultDocument['#printReason'],
            '#recipient': resultDocument['#recipient'],
            '#printStatus': resultDocument['#printStatus'],
            "#printType": resultDocument["#type"],
            "#profile": resultDocument["#profile"],
            '#batchNumber': resultDocument['#batchNumber'],
            "profileFields": obj,
            "#overdueUpdateDate": resultDocument['#dueDate'],
            "#pagesToPrint": resultDocument["#pagesToPrint"],
            "#pages": resultDocument["#pages"],
            '#controlled_copy': resultDocument["#printCopyNo"],
            "documentName": resultDocument['@infocardNumber'],
            "revision": resultDocument['@revision'],
            "printNumber": resultDocument['#printNo']
          };
          db.collection(auditCollectionName).insertOne(auditLogObj);
          const resData = await httpPy.post('/pyApi/overlayDocument', JSON.stringify(overlay));
          log.debug("Javaservice response when doc send for printing" + JSON.stringify(resData))
          if (resData.success == true || resData.success == "true") {
            profiles[i].overlayStatus = "success";
            profiles[i].overlayMessage = "printed successfull";
            req.msg = "Document printed Successfully"
            log.info("Document printed Successfully")
          } else {
            profiles[i].overlayStatus = "fail";
            profiles[i].overlayMessage = resData.message;
            req.msg = "Error occured in printing document"
            log.info("Error occured in printing document")
            req.error = resData.message;
            req.errorCode = 400;
            //  next();
          }
        }
        req.payload = profiles;
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      }
      else {
        return exception.raiseError(req, res, next, 'PA001', '401', CONSTANTS.SESSION_EXPIRED);
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
    print,
    rePrint,
    updatePrintStatus,
    getDocumentList,
    verifyPrintRecipient
  };
};
