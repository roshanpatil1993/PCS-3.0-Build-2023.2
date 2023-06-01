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
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")
module.exports = (dbClient, passport) => {

  async function validateUser(req, res, next) {
    const log = logger("validateUser")
    log.info(CONSTANTS.SOF)
    try {
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
        req.error = CONSTANTS.USER_NOT_EXIST;
        req.errorCode = 400;
        next();
      } else if (req.body.userName.length === 0) {
        req.error = CONSTANTS.USER_NOT_EXIST;
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
          log.info("User already present inside PCS database")
          req.error = CONSTANTS.USER_EXIST;
          req.errorCode = 400;
          next();
        } else {
          let query = 'scim/v0/Users';
          if (req.body && req.body.userName) {
            query = query + '?filter=username eq ' + req.body.userName;
          }
          log.debug(`Query for resData :: ${query}`)
          const resData = await httpReq.get(query, req.user.mcToken, true);
          log.debug("Result of resData (Internaluser details getting from mastercontrol) :: " + JSON.stringify(resData))
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
            log.debug("req.body giving Internal-user details :: " + JSON.stringify(req.body))
            next();
          } else {
            log.error(CONSTANTS.SESSION_EXPIRED)
            req.error = CONSTANTS.SESSION_EXPIRED;
            req.errorCode = 400;
            next();
          }
        }
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  async function validateExternalUser(req, res, next) {
    const log = logger("validateExternalUser")
    log.info(CONSTANTS.SOF)
    try {
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
          log.info("User already present inside PCS database")
          req.error = CONSTANTS.USER_EXIST;
          req.errorCode = 400;
          next();
        } else {
          let query = 'scim/v0/Users';
          if (req.body && req.body.userName) {
            query = query + '?filter=username eq ' + req.body.userName;
          }
          log.debug(`Query for resData :: ${query}`)
          const resData = await httpReq.get(query, req.user.mcToken, true);
          log.debug("Details of user getting from mastercontrol side :: " + JSON.stringify(resData))
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
            log.debug("req.body which is giving External-user details :: " + JSON.stringify(req.body))
            next();
          } else {
            log.error(CONSTANTS.SESSION_EXPIRED);
            req.error = CONSTANTS.SESSION_EXPIRED;
            req.errorCode = 400;
            next();
          }
        }
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  async function addInternalUser(req, res, next) {
    const log = logger("addInternalUser")
    log.info(CONSTANTS.SOF)
    try {
      if (!req.error) {
        const db = dbClient.db(dbName);
        const result = await db.collection(internalUserCollectionName).insertOne(req.body);
        if (result && result.ops[0]) {
          req.payload = result.ops[0];
          req.audit = {
            eventType: 'Add Internal User',
            name: req.payload.formattedName
          };
          req.msg = CONSTANTS.INTERNAL_USER_ADDED_SUCCESSFULLY
          log.info("Internal user added successfully")
          log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
          next();
        } else {
          req.error = CONSTANTS.INTERNAL_USER_ADDED_FAILED;
          req.errorCode = 500;
          next();
        }
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

  async function updateInternalUser(req, res, next) {
    const log = logger("updateInternalUser")
    log.info(CONSTANTS.SOF)
    try {
      let roles = {};
      let isRoleAssigned = false;
      rolesMaster.map(role => {
        if (req.body.roles[role]) {
          isRoleAssigned = true;
        }
        roles[role] = req.body.roles[role] != null ? req.body.roles[role] : false;
      });
      if (!isRoleAssigned) {
        req.error = CONSTANTS.ROLE_REQUIRED;
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
          req.msg = "Internal User updated successfully"
          log.info("Internal user updated successfully")
          log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
          next();
        } else {
          req.error = "Failed to update an Internal User";
          req.errorCode = 500;
          next();
        }
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  async function deleteInternalUser(req, res, next) {
    const log = logger("deleteInternalUser")
    log.info(CONSTANTS.SOF)
    try {
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
          req.msg = "Internal User deleted successfully"
          log.info("Internal user deleted successfully")
          log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
          next();
        } else {
          req.error = "Failed to delete an Internal User";
          req.errorCode = 500;
          next();
        }
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

  async function getInternalUsersList(req, res, next) {
    const log = logger("getInternalUsersList")
    log.info(CONSTANTS.SOF)
    try {
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
      log.debug(`Query for resData :: ${query}`)
      const resData = await httpReq.get(query, req.user.mcToken, true);
      //log.debug("Result of resData (Internalusers getting from mastercontrol) :: " + resData)
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
        req.msg ="Fetching list of InternalUsers"
        log.info("Fetching list of InternalUsers")
        log.debug(`${CONSTANTS.REQ_PAYLOAD}(list of Internalusers getting from mastercontrol) :: ${req.payload}`)
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

  async function getInternalUsers(req, res, next) {
    const log = logger("getInternalUsers")
    log.info(CONSTANTS.SOF)
    try {
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
      log.debug(`Query for ${internalUserCollectionName} :: ${JSON.stringify(query)}`)
      const db = dbClient.db(dbName);
      const result = await db
        .collection(internalUserCollectionName)
        .find(query).toArray();
      if (result) {
        req.payload = result;
        for (let item of result) {
          item.isDocument = await checkedDocumentassignorNot(item.userName)
        }
        req.msg = "Fetching InternalUsers"
        log.info("Fetching InternalUsers")
        log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
        next();
      } else {
        req.payload = [];
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

  async function checkedDocumentassignorNot(userName) {
    const log = logger("checkedDocumentassignorNot")
    //log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      const result = await db
        .collection("print_info")
        .count({
          '#userId.userName': userName
        })
      //log.info(CONSTANTS.EOF)
      return result > 0 ? true : false
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
  }

  async function updateUserCount(req, res, next) {
    const log = logger("updateUserCount")
    log.info(CONSTANTS.SOF)
    try {
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
      log.debug("Inside result :: " + JSON.stringify(result))
      if (result) {
        req.msg = "User count updated"
        log.info("User count updated")
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

  async function getUserCount(req, res, next) {
    const log = logger("getUserCount")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      const result = await db
        .collection(masterCollectionName)
        .find({
          type: "ActiveUserCount"
        }).toArray();
      if (result) {
        req.payload = result;
        req.msg = "Fetching count of active users"
        log.info("Fetching count of active users")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        req.payload = [];
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

  async function assignUser(req, res, next) {
    const log = logger("assignUser")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      const deletedUser = await db.collection(internalUserCollectionName).findOne({ _id: ObjectId(req.body._id) });
      const assignedUser = await db.collection(internalUserCollectionName).findOne({ _id: ObjectId(req.body.newUserId) });
      const deletedUserInfo = {
        name: deletedUser.formattedName,
        userName: deletedUser.userName
      };
      log.debug("UserInfo which will be deleted" + JSON.stringify(deletedUserInfo))
      const assignedUserInfo = {
        name: assignedUser.formattedName,
        userName: assignedUser.userName
      };
      log.debug("assignedUserInfo to which documents assigned ::" + JSON.stringify(assignedUserInfo))
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
      log.debug(`Inside Result :: ${JSON.stringify(result)}`)
      if (result.ok === 1) {
        next();
      } else {
        log.error("Unable to delete internal user")
        req.error = "Unable to delete internal user";
        req.errorCode = 500;
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

  async function getExternalUsers(req, res, next) {
    const log = logger("getExternalUsers")
    log.info(CONSTANTS.SOF)
    try {
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
        req.msg = "Fetching ExternalUsers"
        log.info("Fetching ExternalUsers")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        req.payload = [];
        req.msg = "Unable to fetch ExternalUsers"
        log.info("Unable to fetch ExternalUsers")
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

  async function addExternalUser(req, res, next) {
    const log = logger("addExternalUser")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      if (!req.error) {
        const db = dbClient.db(dbName);
        const result = await db.collection(externalUserCollectionName).insertOne(req.body);
        if (result && result.ops[0]) {
          req.payload = result.ops[0];
          req.audit = {
            eventType: 'Add External User',
            name: req.payload.formattedName
          };
          req.msg = "External User added successfully"
          log.info("External user added successfully")
          log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
          next();
        } else {
          req.error = "Failed to add an External User";
          req.errorCode = 500;
          next();
        }
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

  async function assignExternalUsers(req, res, next) {
    next();
  }

  async function deleteExternalUser(req, res, next) {
    const log = logger("deleteExternalUser")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      const user = await db.collection(externalUserCollectionName).findOne({ _id: ObjectId(req.body._id) });
      const result = await db.collection(externalUserCollectionName).deleteOne({ _id: ObjectId(req.body._id) });
      if (result) {
        req.payload = user;
        req.audit = {
          eventType: 'Delete External User',
          name: user.formattedName
        };
        req.msg = "External User deleted successfully"
        log.info("External user deleted successfully")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        log.warn("Failed to delete an External User")
        req.error = "Failed to delete an External User";
        req.errorCode = 500;
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

  async function getExternalUsersList(req, res, next) {
    const log = logger("getExternalUsersList")
    log.info(CONSTANTS.SOF)
    try {
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
      log.debug(`Query for resData :: ${query}`)
      const resData = await httpReq.get(query, req.user.mcToken, true);
      //log.debug("Inside resData (list of Externalusers getting from mastercontrol) :: " + resData)
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
        req.msg = "Fetching list of ExternalUsers"
        log.info("Fetching list of ExternalUsers")
        log.debug(`${CONSTANTS.REQ_PAYLOAD}(list of Externalusers getting from mastercontrol) :: ${req.payload}`)
        next();
      } else {
        return exception.raiseError(req, res, next, 'PA0001', '401', CONSTANTS.SESSION_EXPIRED);
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
  }

  async function getInternalRecipient(req, res, next) {
    const log = logger("getInternalRecipient")
    log.info(CONSTANTS.SOF)
    try {
      let query = { isDeleted: false };
      const db = dbClient.db(dbName);
      const result = await db
        .collection(internalUserCollectionName)
        .find(query).toArray();
      if (result) {
        req.payload = result.map(re => {
          return { label: re.formattedName, value: re.formattedName, userName: re.userName, email: re.email };
        });
        req.msg = "Fetching list of InternalUsers"
        log.info("Fetching list of InternalUsers")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        req.payload = [];
        req.msg = "Unable to fetch list of InternalUsers"
        log.info("Unable to fetch list of InternalUsers")
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

  async function getExternalRecipient(req, res, next) {
    const log = logger("getExternalRecipient")
    log.info(CONSTANTS.SOF)
    try {
      let query = { isDeleted: false };
      const db = dbClient.db(dbName);
      const result = await db
        .collection(externalUserCollectionName)
        .find(query).toArray();
      if (result) {
        req.payload = result.map(re => {
          return { label: re.formattedName, value: re.formattedName, userName: re.userName, email: re.email };
        });
        req.msg = "Fetching list of ExternalUsers"
        log.info("Fetching list of ExternalUsers")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        req.payload = [];
        req.msg = "Unable to fetch list of ExternalUsers"
        log.info("Unable to fetch list of ExternalUsers")
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

  async function login(req, res, next) {
    const log = logger("login")
    log.info(CONSTANTS.SOF)
    try {
      passport.authenticate('local', { session: false }, async (err, user) => {
        const db = dbClient.db(dbName);
        const result = await db.collection(validateLicenseCollectionName)
          .find({ isExpired: 0 }).toArray();
        if (user == "NO_USER_FOUND") {
          req.errorCode = 403;
          req.error = CONSTANTS.UNAUTHORIZED_ERROR;
          next();
        } else if (!user || err) {
          req.errorCode = 401;
          req.error = CONSTANTS.SESSION_EXPIRED;
          next();
        }
        else if (result.length == 0) {
          req.errorCode = 403;
          req.error = CONSTANTS.LICENSE_EXPIRED
          next();
        } else {
          req.payload = user;
          req.msg = "Fetching details of the login user"
          log.info("Fetching details of the login user")
          log.debug(CONSTANTS.REQ_PAYLOAD +JSON.stringify(req.payload))
          next();
        }
      })(req, res, next);
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next();
    }
    log.info(CONSTANTS.EOF)
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