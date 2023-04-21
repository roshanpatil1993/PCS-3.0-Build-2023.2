const dbName = process.env.BASE_DB_NAME;
const notificationCollectionName = process.env.NOTIFICATION_COLLECTION_NAME;
const ObjectId = require("mongodb").ObjectId;
module.exports = (dbClient, liveUsers) => {

  async function sendImmediateNoti(docs) {
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
      notiList.push(notification);
    });
    notiList.map(noti => {
      const sio = liveUsers[noti.to.userName];
      if (sio) {
        sio.emit('new_notification', [noti]);
      }
    });
    const result = await db.collection(notificationCollectionName).insertMany(notiList);
    return result;
  }
  async function sendImmediateNotification(req, res, next) {
    const re = await sendImmediateNoti(req.payload);

    if (re) {
      next();
    }else{
      next();
    }
  }

  async function getNotificationList(req, res, next) {
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

    const result = await db
      .collection(notificationCollectionName)
      .aggregate(agg).toArray();

    req.payload = result;
    next();
  }

  async function updateNotification(req, res, next) {
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
    const count = await db.collection(notificationCollectionName).countDocuments(query);
    const sio = liveUsers[result.value.to.userName];
    if (sio) {
      sio.emit('notification_count', count);
    }
    next();
  }

  async function getNotificationCount(req, res, next) {
    const db = dbClient.db(dbName);
    const query = { 'isSeen': false };
    if (req.body && req.body.userName) {
      query["to.userName"] = req.body.userName;
    }
    const count = await db.collection(notificationCollectionName).countDocuments(query);
    req.payload = { count: count };
    next();

  }

  return {
    sendImmediateNotification,
    sendImmediateNoti,
    getNotificationList,
    updateNotification,
    getNotificationCount,
  };
};
