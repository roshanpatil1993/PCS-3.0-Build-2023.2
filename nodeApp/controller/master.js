const httpReq = require("../mc/http")(null, null);
const dbName = process.env.BASE_DB_NAME;
const reasonCollectionName = process.env.REASONS_COLLECTION_NAME;
const profileCollectionName = process.env.PROFILE_COLLECTION_NAME;
const profileDocumentsCollectionName = process.env.PROFILE_DOCUMENTS_COLLECTION_NAME;
const masterCollectionName = process.env.MASTER_COLLECTION_NAME;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")



module.exports = (dbClient, passport) => {

  async function getProfile(applicableFor, usedIn) {
    const log = logger("getProfile")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      return await db
        .collection(profileCollectionName)
        .find({ applicableFor: { $in: ['Both', applicableFor] }, usedIn: { $in: ['Both', usedIn] }, isDeleted: false }).toArray();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
    }
    log.info(CONSTANTS.EOF)
  }

  async function getProfileM(documentTypeName) {
    const log = logger("getProfileM")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      return await db
        .collection(profileDocumentsCollectionName)
        .find({ 'documents.name': documentTypeName, isDeleted: false }).toArray();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
    }
    log.info(CONSTANTS.EOF)
  }

  async function getPrintProfile(req, res, next) {
    const log = logger("getPrintProfile")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const profiles = await getProfile(req.body.printType, req.body.isReprint ? 'Reprint' : 'Print');
      const profilesM = await getProfileM(req.body.documentTypeName);
      req.payload = [];
      profiles.map(profile => {
        const found = profilesM.filter(pro => pro.profileId == profile._id);
        if (found && found.length > 0) {
          req.payload.push(profile);
        }
      });
      req.payload = req.payload.sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      req.msg = "Fetching list of profiles for printing"
      log.info("Fetching list of profiles for printing")
      log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
      next();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next()
    }
    log.info(CONSTANTS.EOF)
  }

  async function getProfileList(req, res, next) {
    const log = logger("getProfileList")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const db = dbClient.db(dbName);
      const applicableFor = req.body.applicableFor;
      const result = await db
        .collection(profileCollectionName)
        .find({ applicableFor: { $in: ['Both', applicableFor] } }, { projection: { name: 1, isDeleted: 1 } }).toArray();
      req.payload = result;
      req.payload = req.payload.sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      req.msg = "Fetching list of profiles"
      log.info("Fetching list of profiles")
      log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
      next();
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next()
    }
    log.info(CONSTANTS.EOF)
  }

  async function getReconciliationReasons(req, res, next) {
    const log = logger("getReconciliationReasons")
    log.info(CONSTANTS.SOF)
    try {
      const query = { isDeleted: false, reconcile: true };
      log.debug(`Query for ${reasonCollectionName} :: ${JSON.stringify(query)}`)
      const db = dbClient.db(dbName);
      const result = await db
        .collection(reasonCollectionName)
        .find(query, { _id: 1, name: 1 }).toArray();
      if (result) {
        req.payload = result.map(re => {
          return { label: re.name, value: re.name };
        });
        req.msg = "Fetching list of ReconciliationReasons"
        log.info("Fetching list of ReconciliationReasons")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        req.payload = [];
        req.msg = "Unable to get list of ReconciliationReasons"
        log.info("Unable to get list of ReconciliationReasons")
        next();
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next()
    }
    log.info(CONSTANTS.EOF)
  }

  async function getUserInfo(req, res, next) {
    const log = logger("getUserInfo")
    log.info(CONSTANTS.SOF)
    try {
      let query = 'users/current-user';
      const db = dbClient.db(dbName);
      const resData = await httpReq.get(query, req.user.mcToken, true);
      log.debug("Inside resData :: " + JSON.stringify(resData))
      if (resData && (resData.status || resData.username)) {
        const dbRes = await db
          .collection(userCollectionName)
          .findOne({ userName: resData.username, isDeleted: false });
        if (dbRes) {
          req.payload = {
            userInfo: dbRes
          };
          req.msg = "Fetching UserInfo of login user"
          log.info("Fetching UserInfo of login user")
          log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
          next();
        } else {
          req.error = "Unable to fetch UserInfo of login user";
          req.errorCode = 404;
          log.warn("Unable to fetch UserInfo of login user")
          next();
        }
        next();
      } else {
        log.warn(CONSTANTS.SESSION_EXPIRED)
        req.error = resData.message;;
        req.errorCode = 404;
        next();
      }
    } catch (error) {
      log.error(CONSTANTS.ERROR_OCCURED + error)
      req.error = CONSTANTS.SERVER_ERROR;
      req.errorCode = 500;
      next()
    }
    log.info(CONSTANTS.EOF)
  }

  async function getDocumentInfo(req, res, next) {
    const log = logger("getDocumentInfo")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const query = `document/${req.body.documentNumber}/${req.body.revision}`;
      log.debug(`Query for resData :: ${query}`)
      const resData = await httpReq.get(query, req.user.mcToken);
      if (resData && (resData.success || resData.infocardId)) {
        req.payload = resData;
        req.msg = "Fetching DocumentInfo of selected document for printing"
        log.info("Fetching DocumentInfo of selected document for printing")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        log.warn(CONSTANTS.SESSION_EXPIRED)
        req.error = CONSTANTS.SESSION_EXPIRED;
        req.errorCode = 401;
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

  //creating getCustomDocInfo for 10960
  async function getCustomDocInfo(req, res, next) {
    const log = logger("getCustomDocInfo")
    log.info(CONSTANTS.SOF)
    try {
      log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
      const query = `infocard/${req.body.infocardId}/customfield`;
      log.debug(`Query for resData :: ${query}`)
      const resData = await httpReq.get(query, req.user.mcToken);
      if (resData) {
        req.payload = resData;
        req.msg = "Fetching CustomDocInfo of selected document for printing"
        log.info("Fetching CustomDocInfo of selected document for printing")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
        next();
      } else {
        log.warn(CONSTANTS.SESSION_EXPIRED)
        req.error = CONSTANTS.SESSION_EXPIRED;
        req.errorCode = 401;
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

  async function getOutcomeStatus(req, res, next) {
    const log = logger("getOutcomeStatus")
    log.info(CONSTANTS.SOF)
    try {
      const db = dbClient.db(dbName);
      const result = await db
        .collection(masterCollectionName)
        .findOne({ Type: "OutcomeStatus" });
      if (result) {
        req.payload = result.Data;
        req.msg = "Fetching list of outcomeStatus"
        log.info("Fetching list of outcomeStatus")
        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
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

  return {
    getPrintProfile,
    getProfileList,
    getUserInfo,
    getReconciliationReasons,
    getDocumentInfo,
    getCustomDocInfo,
    getOutcomeStatus

  };
};
