const schedule = require('node-schedule');
const nodemailer = require('nodemailer');
const httpReq = require("../mc/http")(null, null);
const httpPy = require("../py/http")(null, null);         //
const printCollectionName = process.env.PRINT_COLLECTION_NAME;
const dbName = process.env.BASE_DB_NAME;
const autorecalltime = process.env.AUTO_RECALL_TIME;
const adminToken = process.env.MC_ADMIN_TOKEN;
const lifeCycleStatus = process.env.LIFE_CYCLE_STATUS.split(',');
const apiKey = process.env.MC_API_KEY;
const validateLicenseCollectionName = process.env.VALIDATE_LICENSE   //
module.exports = (dbClient, liveUsers) => {
  const mail = require("../controller/mail")();
  const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages");
  const notification = require("../controller/notification")(dbClient, liveUsers);

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

  function getMailOption(to) {
    let mailOption = {};
    switch (process.env.environment) {
      case 'development':
        mailOption = {
          from: `"printer-app-dev" <${process.env.MAIL_FROM}>`,
          to: ["vikas@zogato.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
        }
        break;
      case 'test':
        mailOption = {
          from: `"printer-app-test" <${process.env.MAIL_FROM}>`,
          to: ["aniket.raje@impactsystems.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
        }
        break;
      case 'demo':
        mailOption = {
          from: `"printer-app-demo" <${process.env.MAIL_FROM}>`,
          to: ["aniket.raje@impactsystems.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
        }
        break;
      case 'prod':
        mailOption = {
          from: `"printer-app" <${process.env.MAIL_FROM}>`,
          to: to,
        }
        break;
      default:
        mailOption = {
          from: `"printer-app-default" <${process.env.MAIL_FROM}>`,
          to: ["aniket.raje@impactsystems.com", "nupura.deshmukh@impactsystems.com", "bhushan.deore@impactsystems.com"],
        }
        break;
    }
    return mailOption;
  }

  function sendOverdueMailBulk(mailOptions, next) {
    mailOptions.forEach((mailOption, index) => {
      const to = mailOption['to'];
      const sendMailOption = getMailOption(to);
      sendMailOption.subject = `Overdue-Docs Notification`;
      sendMailOption.html = getTable(mailOption);
      transporter.sendMail(sendMailOption, (error, info) => {
        if (index === mailOptions.length - 1) {
          next();
        }
      });
      next();
    });
  }

  function getTable(mailOption) {
    let mailText = '<!DOCTYPE html><html><head><meta charset="ISO-8859-1"><title>Insert title here</title></head><style>table, td, th {	border: 1px solid black;}table {	width: 100%;	border-collapse: collapse;}</style><body>';
    mailText = mailText + '<span> Reconciliation is overdue for following PCS prints. Please login in the PCS system and complete the reconciliation process.</span>';
    mailText = mailText + '<table style="width: 60%; border: 1px solid black; border-collapse: collapse;"><thead> <tr>  <th style="border: 1px solid black; border-collapse: collapse;">#NO</th>  <th style="border: 1px solid black; border-collapse: collapse;">Document Name</th> <th style="border: 1px solid black; border-collapse: collapse;">Due Date</th>  </tr></thead><tbody>';
    mailOption.docIds.map((doc, index) => {
      mailText = mailText + `<tr> <td	style="border: 1px solid black; border-collapse: collapse; text-align: center;">${index + 1}</td>	<td	style="border: 1px solid black; border-collapse: collapse; text-align: center;">${doc.docId}</td>	<td	style="border: 1px solid black; border-collapse: collapse; text-align: center;">${formatDate(doc.dueDate)}</td></tr>`
    });
    mailText = mailText + '</tbody></table></body></html>';
    return mailText;
  }

  function formatDate(date) {
    var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

    if (month.length < 2)
      month = '0' + month;
    if (day.length < 2)
      day = '0' + day;

    return [year, month, day].join('-');
  }




  function getDate(date, type) {
    if (date) {
      const dateArray = date.split("-");
      let month =
        type === "add" ? Number(dateArray[2]) + 1 : Number(dateArray[2]);
      return new Date(Date.UTC(dateArray[0], dateArray[1] - 1, month, 0, 0, 0));
    }
  }

  function getUTCDate(date) {
    return `${date.getFullYear()}-${padDate(date.getMonth() + 1, 2)}-${date.getDate()}`;
  }

  function padDate(num, size) {
    var s = "00" + num;
    return s.substr(s.length - size);
  }

  async function reconcileOverdueEmailFun() {
    const log = logger("reconcileOverdueEmailFun")
    const db = dbClient.db(dbName);
    const currentDate = getUTCDate(new Date());
    const findQ = {
      '#type': "IP",
      '#dueDate': { '$lt': getDate(currentDate, "") },
      'isOverdue': null,
      '#printStatus': 'Successful'
    };
    const result = await db.collection(printCollectionName).find(findQ).toArray();
    if (result) {
      const users = {};
      result.forEach(doc => {
        const user = doc['#userId'].userName;
        if (users[user] === undefined) {
          users[user] = [{
            "userName": doc["#userId"].name,
            "email": doc["#recipient"].email,
            "docID": doc["#printCopyNo"],
            "dueDate": doc["#dueDate"]
          }];
          if (doc.rePrintInfo && doc.rePrintInfo.length > 0) {
            doc.rePrintInfo.map(reDoc => {
              if (reDoc["#printStatus"] === 'Successful') {
                users[user].push({
                  "userName": doc["#userId"].name,
                  "docID": reDoc["#printCopyNo"],
                  "dueDate": doc["#dueDate"]
                });
              }
            });
          }
        } else {
          users[user].push({
            "userName": doc["#userId"].name,
            "email": doc["#recipient"].email,
            "docID": doc["#printCopyNo"],
            "dueDate": doc["#dueDate"]
          });
          if (doc.rePrintInfo && doc.rePrintInfo.length > 0) {
            doc.rePrintInfo.map(reDoc => {
              if (reDoc["#printStatus"] === 'Successful') {
                users[user].push({
                  "userName": doc["#userId"].name,
                  "docID": reDoc["#printCopyNo"],
                  "dueDate": doc["#dueDate"]
                });
              }
            });
          }
        }
      });
      const mailOptions = [];
      Object.keys(users).map(key => {
        if (users[key][0].email !== undefined && users[key][0].email.length > 0) {
          const mailOption = {
            to: users[key][0].email,
            name: users[key][0].userName,
            dueDate: users[key][0].dueDate,
            docIds: users[key].map(d => {
              return { docId: d.docID, dueDate: d.dueDate }
            }
            )
          };
          mailOptions.push(mailOption);
        } else {
          log.warn(CONSTANTS.EMAIL_MISSING + " " +  users[key][0].userName )
        }
      });
      if (mailOptions) {
        sendOverdueMailBulk(mailOptions, async () => {
          updateQ = {
            $set: {
              'isOverdue': true
            }
          };
          const updateDocsR = await db.collection(printCollectionName).updateMany(findQ, updateQ);
        });
      }
    }
  }

  async function autoRecallFun() {
    const today = new Date()
    today.setDate(today.getDate() - 1)
    const query = `documents/search/infoCardVaultChange?startDate=${formatDate(today)}T${autorecalltime}`;
    const recalledDocs = await httpReq.get(query, adminToken);
    if (recalledDocs && recalledDocs.length > 0) {
      const db = dbClient.db(dbName);
      const findQ = { $and: [{ "#type": "CP" }, { "recallInfo": { $exists: false } }] };
      const returnF = { "#recipient": 1, "#printCopyNo": 1, "@infocardNumber": 1, "@revision": 1, "#type": 1, "@infocardId": 1 };
      const docs = await db.collection(printCollectionName).find(findQ, returnF).toArray();
      if (docs && docs.length > 0) {
        const intersection = docs.filter(doc => recalledDocs.includes(doc["@infocardId"]));
        const revisionUpdated = [];
        for (let i = 0; i < intersection.length; i++) {
          const getDocQ = `document/${intersection[i]["@infocardId"]}/`;
          const docInfo = await httpReq.get(getDocQ, adminToken);
          if (docInfo && lifeCycleStatus.includes(docInfo.lifecycleStatus)) {
            revisionUpdated.push(intersection[i]);
          }
        }
        if (revisionUpdated.length > 0) {
          const updateQ = { _id: { $in: revisionUpdated.map(d => d._id) } };
          const recallInfo = {
            "recallReason": "Auto Recall",
            "recallStatus": "In-Progress",
            "recallInitiationDate": new Date(new Date().toUTCString()),
            "MigratedPrints": true
          };
          const result = await db.collection(printCollectionName).updateMany(updateQ, { $set: { "recallInfo": recallInfo } },
            { returnOriginal: false });
          if (result.result.ok == 1) {
            const mailR = await mail.recallInit(revisionUpdated);
            const notiR = await notification.sendImmediateNoti(revisionUpdated);
          }
        }
      }
    }
  }


  //validate license database
  async function validateLicenseFun() {
    const log = logger("validateLicenseFun")
    try {
      const value = await httpPy.post('/pyApi/validateLicense');
      const db = dbClient.db(dbName);
      const result = await db.collection(validateLicenseCollectionName).findOneAndUpdate({
        organization: "pcs"
      }, {
        $set: {
          isExpired: value
        }
      });
    } catch (error) {
      log.error("Error Occured::" + error)
    }
  }

  const reconcileOverdueEmailJob = schedule.scheduleJob('* 12 * * * *', reconcileOverdueEmailFun);
  const autoRecallJob = schedule.scheduleJob('0 5 * * *', autoRecallFun);
  const validateLicenseJob = schedule.scheduleJob('0 5 * * *', validateLicenseFun);

  return {
    reconcileOverdueEmailJob,
    autoRecallJob,
    validateLicenseJob
  };
};
