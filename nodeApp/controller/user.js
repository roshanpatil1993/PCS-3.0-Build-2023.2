const httpReq = require("../mc/http")(null, null);
const exception = require('../utils/exception');
const dbName = process.env.BASE_DB_NAME;
const masterCollectionName = process.env.MASTER_COLLECTION_NAME;
const internalUserCollectionName = process.env.INTERNAL_USER_COLLECTION_NAME;
const externalUserCollectionName = process.env.EXTERNAL_USER_COLLECTION_NAME;
const printCollectionName = process.env.PRINT_COLLECTION_NAME;
const validateLicenseCollectionName = process.env.VALIDATE_LICENSE;
const rolesMaster = require('../constants/roles');
const ObjectId = require("mongodb").ObjectId;
module.exports = (dbClient, passport) => {

  async function validateUser(req, res, next) {
    let roles = {};
    let isRoleAssigned = false;
    rolesMaster.map(role => {
      if (req.body.roles[role]) {
        isRoleAssigned = true;
      }
      roles[role] = req.body.roles[role] != null ? req.body.roles[role] : false;
    });
    if (!isRoleAssigned) {
      req.error = "At Least one role required";
      req.errorCode = 400;
      next();
    } else if (req.body.userName === undefined) {
      req.error = "User Name not found";
      req.errorCode = 400;
      next();
    } else if (req.body.userName.length === 0) {
      req.error = "User Name not found";
      req.errorCode = 400;
      next();
    } else {
      const db = dbClient.db(dbName);
      const result = await db
        .collection(internalUserCollectionName)
        .findOne({
          userName: req.body.userName
        });
      if (result) {
        req.error = "User Name Exists";
        req.errorCode = 400;
        next();
      } else {
        let query = 'scim/v0/Users';
        if (req.body && req.body.userName) {
          query = query + '?filter=username eq ' + req.body.userName;
        }
        const resData = await httpReq.get(query, req.user.mcToken, true);
        if (resData && resData.resources && resData.resources[0]) {
          const masterObj = resData.resources[0];
          const userObj = {
            firstName: masterObj.name.givenName,
            lastName: masterObj.name.familyName,
            formattedName: masterObj.name.formatted,
            userName: masterObj.userName,
            roles: roles,
            email: masterObj.emails ? masterObj.emails[0].value : '',
            isDeleted: false
          };
          req.body = userObj;
          next();
        } else {
          req.error = "User Name Not Found";
          req.errorCode = 400;
          next();
        }
      }
    }

  }

  async function validateExternalUser(req, res, next) {
    if (req.body.userName === undefined) {
      req.error = "User Name not found";
      req.errorCode = 400;
      next();
    } else if (req.body.userName.length === 0) {
      req.error = "User Name not found";
      req.errorCode = 400;
      next();
    } else {
      const db = dbClient.db(dbName);
      const result = await db
        .collection(externalUserCollectionName)
        .findOne({
          userName: req.body.userName
        });
      if (result) {
        req.error = "User Name Exists";
        req.errorCode = 400;
        next();
      } else {
        let query = 'scim/v0/Users';
        if (req.body && req.body.userName) {
          query = query + '?filter=username eq ' + req.body.userName;
        }
        const resData = await httpReq.get(query, req.user.mcToken, true);
        if (resData && resData.resources && resData.resources[0]) {
          const masterObj = resData.resources[0];
          const userObj = {
            firstName: masterObj.name.givenName,
            lastName: masterObj.name.familyName,
            formattedName: masterObj.name.formatted,
            userName: masterObj.userName,
            email: masterObj.emails ? masterObj.emails[0].value : '',
            isDeleted: false
          };
          req.body = userObj;
          next();
        } else {
          req.error = "User Name Not Found";
          req.errorCode = 400;
          next();
        }
      }
    }
  }

  async function addInternalUser(req, res, next) {
    if (!req.error) {
      const db = dbClient.db(dbName);
      const result = await db.collection(internalUserCollectionName).insertOne(req.body);
      if (result && result.ops[0]) {
        req.payload = result.ops[0];
        req.audit = {
          eventType: 'Add Internal User',
          name: req.payload.formattedName
        };
        next();
      } else {
        req.error = "Error in save user";
        req.errorCode = 500;
        next();
      }
    } else {
      next();
    }
  }

  async function updateInternalUser(req, res, next) {
    let roles = {};
    let isRoleAssigned = false;
    rolesMaster.map(role => {
      if (req.body.roles[role]) {
        isRoleAssigned = true;
      }
      roles[role] = req.body.roles[role] != null ? req.body.roles[role] : false;
    });
    if (!isRoleAssigned) {
      req.error = "At Least one role required";
      req.errorCode = 400;
      next();
    } else {
      const db = dbClient.db(dbName);
      const result = await db.collection(internalUserCollectionName).findOneAndUpdate({
        _id: ObjectId(req.body._id)
      }, {
        $set: {
          roles: roles
        }
      });
      if (result) {
        req.payload = result.value;
        req.audit = {
          eventType: 'Update Internal User',
          name: req.payload.formattedName
        };
        next();
      } else {
        req.error = "Error in Update";
        req.errorCode = 500;
        next();
      }
    }
  }

  async function deleteInternalUser(req, res, next) {
    if (!req.error) {
      const db = dbClient.db(dbName);
      const user = await db.collection(internalUserCollectionName).findOne({ _id: ObjectId(req.body._id) });
      const result = await db.collection(internalUserCollectionName).deleteOne({ _id: ObjectId(req.body._id) });
      if (result) {
        req.payload = user;
        req.audit = {
          eventType: 'Delete Internal User',
          name: user.formattedName
        };
        next();
      } else {
        req.error = "User Not Found";
        req.errorCode = 400;
        next();
      }
    } else {
      next();
    }
  }

  async function getInternalUsersList(req, res, next) {
    let activeUserCount = 100;
    const db = dbClient.db(dbName);
    const result = await db
      .collection(masterCollectionName)
      .findOne({
        type: "ActiveUserCount"
      });

    if (result && result.count) {
      activeUserCount = result.count;
    }

    let query = 'scim/v0/Users?pageNumber=0&count=' + activeUserCount;
    const resData = await httpReq.get(query, req.user.mcToken, true);
    if (resData && (resData.status || resData.resources)) {
      req.payload = [];
      resData.resources.map(re => {
        if (re.externalUser === false) {
          req.payload.push({
            ...re,
            label: re.name.formatted,
            value: re.name.formatted,
            userName: re.userName,
            email: re.emails ? re.emails[0].value : ''
          });
        }
      });
      next();
    } else {
      return exception.raiseError(req, res, next, 'PA001', '401', 'Unauthorized');
    }
  }

  async function getInternalUsers(req, res, next) {
    const query = {
      "isDeleted": false
    };
    if (req.body.isDeleted !== undefined) {
      query.isDeleted = req.body.isDeleted
    }
    if (req.body.user && req.body.user.userName) {
      query.userName = new RegExp(req.body.user.userName, 'i');
    }
    if (req.body.user && typeof req.body.user === 'string') {
      query.userName = new RegExp(req.body.user, 'i');
    }
    if (req.body.name) {
      query.userName = new RegExp(req.body.name, 'i');
    }
    if (req.body.roles) {
      req.body.roles.map(role => {
        query[`roles.${role}`] = true
      });
    }
    const db = dbClient.db(dbName);
    const result = await db
      .collection(internalUserCollectionName)
      .find(query).toArray();
    if (result) {
      req.payload = result;
      for (let item of result) {
        item.isDocument = await checkedDocumentassignorNot(item.userName)
      }
      next();
    } else {
      req.payload = [];
      next();
    }
  }

  async function checkedDocumentassignorNot(userName) {
    const db = dbClient.db(dbName);
    const result = await db
      .collection("print_info")
      .count({
        '#userId.userName': userName
      })

    return result > 0 ? true : false
  }

  async function updateUserCount(req, res, next) {
    const db = dbClient.db(dbName);
    const result = await db
      .collection(masterCollectionName)
      .updateOne({
        type: "ActiveUserCount"
      }, {
        $set: {
          count: req.body.count
        }
      });
    if (result) {
      next();
    }
  }

  async function getUserCount(req, res, next) {
    const db = dbClient.db(dbName);
    const result = await db
      .collection(masterCollectionName)
      .find({
        type: "ActiveUserCount"
      }).toArray();
    if (result) {
      req.payload = result;
      next();
    } else {
      req.payload = [];
      next();
    }
  }

  async function assignUser(req, res, next) {
    const db = dbClient.db(dbName);
    const deletedUser = await db.collection(internalUserCollectionName).findOne({ _id: ObjectId(req.body._id) });
    const assignedUser = await db.collection(internalUserCollectionName).findOne({ _id: ObjectId(req.body.newUserId) });
    const deletedUserInfo = {
      name: deletedUser.formattedName,
      userName: deletedUser.userName
    };
    const assignedUserInfo = {
      name: assignedUser.formattedName,
      userName: assignedUser.userName
    };
    const bulkUpdateOps = [{
      "updateMany": {
        "filter": { "#userId.userName": deletedUserInfo.userName },
        "update": {
          "$set": {
            '#userId': assignedUserInfo
          }
        }
      }
    },
    {
      "updateMany": {
        "filter": { "#recipient.userName": deletedUserInfo.userName },
        "update": {
          "$set": {
            '#recipient': assignedUserInfo
          }
        }
      }
    }];
    const result = await db.collection(printCollectionName).bulkWrite(bulkUpdateOps, { "ordered": false });
    if (result.ok === 1) {
      next();
    } else {
      req.error = "Error in delete internal user";
      req.errorCode = 500;
      next();
    }

  }

  async function getExternalUsers(req, res, next) {
    const query = {
      "isDeleted": false
    };
    if (req.body.isDeleted !== undefined) {
      query.isDeleted = req.body.isDeleted
    }
    if (req.body.user && req.body.user.userName) {
      query.userName = new RegExp(req.body.user.userName, 'i');
    }
    if (req.body.name) {
      query.userName = new RegExp(req.body.name, 'i');
    }
    const db = dbClient.db(dbName);
    const result = await db
      .collection(externalUserCollectionName)
      .find(query).toArray();
    if (result) {
      req.payload = result;
      next();
    } else {
      req.payload = [];
      next();
    }
  }

  async function addExternalUser(req, res, next) {
    if (!req.error) {
      const db = dbClient.db(dbName);
      const result = await db.collection(externalUserCollectionName).insertOne(req.body);
      if (result && result.ops[0]) {
        req.payload = result.ops[0];
        req.audit = {
          eventType: 'Add External User',
          name: req.payload.formattedName
        };
        next();
      } else {
        req.error = "Error in save external user";
        req.errorCode = 500;
        next();
      }
    } else {
      next();
    }
  }

  async function assignExternalUsers(req, res, next) {
    next();
  }

  async function deleteExternalUser(req, res, next) {
    const db = dbClient.db(dbName);
    const user = await db.collection(externalUserCollectionName).findOne({ _id: ObjectId(req.body._id) });
    const result = await db.collection(externalUserCollectionName).deleteOne({ _id: ObjectId(req.body._id) });
    if (result) {
      req.payload = user;
      req.audit = {
        eventType: 'Delete External User',
        name: user.formattedName
      };
      next();
    } else {
      req.error = "User Not Found";
      req.errorCode = 400;
      next();
    }
  }

  async function getExternalUsersList(req, res, next) {
    let activeUserCount = 100;
    const db = dbClient.db(dbName);
    const result = await db
      .collection(masterCollectionName)
      .findOne({
        type: "ActiveUserCount"
      });
    if (result && result.count) {
      activeUserCount = result.count;
    }
    let query = 'scim/v0/Users?pageNumber=0&count=' + activeUserCount;
    const resData = await httpReq.get(query, req.user.mcToken, true);
    if (resData && (resData.success || resData.resources)) {
      req.payload = [];
      resData.resources.map(re => {
        if (re.externalUser === true) {
          req.payload.push({
            ...re,
            label: re.name.formatted,
            value: re.name.formatted,
            userName: re.userName,
            email: re.emails ? re.emails[0].value : ''
          });
        }
      });
      next();
    } else {
      return exception.raiseError(req, res, next, 'PA0001', '401', 'Unauthorized');
    }
  }

  async function getInternalRecipient(req, res, next) {
    let query = { isDeleted: false };
    const db = dbClient.db(dbName);
    const result = await db
      .collection(internalUserCollectionName)
      .find(query).toArray();
    if (result) {
      req.payload = result.map(re => {
        return { label: re.formattedName, value: re.formattedName, userName: re.userName, email: re.email };
      });
      next();
    } else {
      req.payload = [];
      next();
    }
  }

  async function getExternalRecipient(req, res, next) {
    let query = { isDeleted: false };
    const db = dbClient.db(dbName);
    const result = await db
      .collection(externalUserCollectionName)
      .find(query).toArray();
    if (result) {
      req.payload = result.map(re => {
        return { label: re.formattedName, value: re.formattedName, userName: re.userName, email: re.email };
      });
      next();
    } else {
      req.payload = [];
      next();
    }
  }

  async function login(req, res, next) {
    passport.authenticate('local', { session: false }, async (err, user) => {
      const db = dbClient.db(dbName);
      const result = await db.collection(validateLicenseCollectionName)
        .find({ isExpired: 0 }).toArray();
      if (user == "NO_USER_FOUND") {
        req.errorCode = 403;
        req.error = "User not authorized to access this application. Please contact administrator.";
        next();
      } else if (!user || err) {
        req.errorCode = 401;
        req.error = "Your session has expired. Please login again.";
        next();
      } 
      else if (result.length == 0) {
        req.errorCode = 403;
        req.error = "Your License Has Expired. Please Contact Your System Administrator."
        next();
      } else {
        req.payload = user;
        next();
      }
    })(req, res, next);
  }

  return {
    validateUser,
    validateExternalUser,
    addInternalUser,
    updateInternalUser,
    deleteInternalUser,
    getInternalUsersList,
    getInternalUsers,
    updateUserCount,
    getUserCount,
    assignUser,
    getExternalUsers,
    getExternalUsersList,
    addExternalUser,
    assignExternalUsers,
    deleteExternalUser,
    getInternalRecipient,
    getExternalRecipient,
    login
  };
};