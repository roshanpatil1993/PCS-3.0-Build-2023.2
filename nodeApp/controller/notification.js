const dbName = process.env.BASE_DB_NAME;
const notificationCollectionName = process.env.NOTIFICATION_COLLECTION_NAME;
const ObjectId = require("mongodb").ObjectId;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")
module.exports = (dbClient, liveUsers) => {

  async function sendImmediateNoti(docs) {
    const log = logger("sendImmediateNoti")
    log.info(CONSTANTS.SOF)
    try {
      log.debug("Inside Docs :: " + JSON.stringify(docs))
      const db = dbClient.db(dbName);
      const notiList = [];
      docs.map(doc => {
        const notification = {
          "to": doc["#recipient"],
          "createdAt": new Date(new Date().toUTCString()),
          "updatedAt": new Date(new Date().toUTCString()),
          "isSeen": false,
          "type": doc['#type'],
          "printCopyNo": doc['#printCopyNo'],
          "notificationText": "Recall task of " + doc['#printCopyNo'],
          "docId": doc._id.toString(),
        };
        log.debug("Inside notification :: " + JSON.stringify(notification))
        notiList.push(notification);
      });
      notiList.map(noti => {
        const sio = liveUsers[noti.to.userName];
        log.debug("this is sio (returning username if match with login user) :: " + sio)
        if (sio) {
          sio.emit('new_notification', [noti]);
        }
      });
      const result = await db.collection(notificationCollectionName).insertMany(notiList);
      log.debug("Inside Result :: " + JSON.stringify(result))
      log.info(CONSTANTS.EOF)
      return result;
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
    }
  }


  async function sendImmediateNotification(req, res, next) {
    const log = logger("sendImmediateNotification")
    log.info(CONSTANTS.SOF)
    try {
      const re = await sendImmediateNoti(req.payload);
      if (re) {
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

  async function getNotificationList(req, res, next) {
    const log = logger("getNotificationList")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const agg = [
        {
          '$match': {
            'to.userName': req.body.userName,
            'isSeen': false
          }
        }, {
          '$project': {
            'docId': {
              '$toObjectId': '$docId'
            },
            'to': 1,
            'isSeen': 1,
            'notificationText': 1,
            '_id': 1,
            'createdAt': 1,
            'type': 1,
            'printCopyNo': 1
          }
        }, {
          '$lookup': {
            'from': 'print_info',
            'localField': 'docId',
            'foreignField': '_id',
            'as': 'docInfo'
          }
        }, {
          '$unset': [
            'docId'
          ]
        }, {
          '$unwind': {
            'path': '$docInfo'
          }
        }
      ];
      log.debug("Inside agg :: " + JSON.stringify(agg))
      const result = await db
        .collection(notificationCollectionName)
        .aggregate(agg).toArray();
      req.payload = result;
      req.msg = "Fetching notification list of login user"
      log.info("Fetching notification list of login user")
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

  async function updateNotification(req, res, next) {
    const log = logger("updateNotification")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const result = await db
        .collection(notificationCollectionName)
        .findOneAndUpdate({ '_id': ObjectId(req.body._id) }, { '$set': { 'isSeen': true, updatedAt: new Date(new Date().toUTCString()) } }, {
          returnOriginal: false
        });
      const query = { 'isSeen': false };
      if (req.body && req.body.userName) {
        query["to.userName"] = result.value.to.userName;
      }
      log.debug(`Query for ${notificationCollectionName} :: ${JSON.stringify(query)}`)
      const count = await db.collection(notificationCollectionName).countDocuments(query);
      log.debug("Total count of documents :: " + JSON.stringify(count))
      const sio = liveUsers[result.value.to.userName];
      log.debug("Result of sio (returning username if match with login user) :: " + JSON.stringify(sio))
      if (sio) {
        sio.emit('notification_count', count);
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

  async function getNotificationCount(req, res, next) {
    const log = logger("getNotificationCount")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const query = { 'isSeen': false };
      if (req.body && req.body.userName) {
        query["to.userName"] = req.body.userName;
      }
      log.debug(`Query for ${notificationCollectionName} :: ${JSON.stringify(query)}`)
      const count = await db.collection(notificationCollectionName).countDocuments(query);
      req.payload = { count: count };
      req.msg = "Fetching notification count of login user"
      log.info("Fetching notification count of login user")
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
    sendImmediateNotification,
    sendImmediateNoti,
    getNotificationList,
    updateNotification,
    getNotificationCount,
  };
};
