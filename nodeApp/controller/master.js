const httpReq = require("../mc/http")(null, null);
const dbName = process.env.BASE_DB_NAME;
const reasonCollectionName = process.env.REASONS_COLLECTION_NAME;
const profileCollectionName = process.env.PROFILE_COLLECTION_NAME;
const profileDocumentsCollectionName = process.env.PROFILE_DOCUMENTS_COLLECTION_NAME;
const masterCollectionName = process.env.MASTER_COLLECTION_NAME;



module.exports = (dbClient, passport) => {

  async function getProfile(applicableFor, usedIn) {
    const db = dbClient.db(dbName);
    return await db
      .collection(profileCollectionName)
      .find({ applicableFor: { $in: ['Both', applicableFor] }, usedIn: { $in: ['Both', usedIn] }, isDeleted: false }).toArray();
  }

  async function getProfileM(documentTypeName) {
    const db = dbClient.db(dbName);
    return await db
      .collection(profileDocumentsCollectionName)
      .find({ 'documents.name': documentTypeName, isDeleted: false }).toArray();
  }

  async function getPrintProfile(req, res, next) {
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
    next();
  }

  async function getProfileList(req, res, next) {
    const db = dbClient.db(dbName);
    const applicableFor = req.body.applicableFor;
    const result = await db
      .collection(profileCollectionName)
      .find({ applicableFor: { $in: ['Both', applicableFor] } }, { projection: { name: 1, isDeleted: 1 } }).toArray();
    req.payload = result;
    req.payload = req.payload.sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    next();
  }

  async function getReconciliationReasons(req, res, next) {
    const query = { isDeleted: false, reconcile: true };
    const db = dbClient.db(dbName);
    const result = await db
      .collection(reasonCollectionName)
      .find(query, { _id: 1, name: 1 }).toArray();
    if (result) {
      req.payload = result.map(re => {
        return { label: re.name, value: re.name };
      });
      next();
    } else {
      req.payload = [];
      next();
    }
  }

  async function getUserInfo(req, res, next) {
    let query = 'users/current-user';
    const db = dbClient.db(dbName);
    const resData = await httpReq.get(query, req.user.mcToken, true);
    if (resData && (resData.status || resData.username)) {
      const dbRes = await db
        .collection(userCollectionName)
        .findOne({ userName: resData.username, isDeleted: false });
      if (dbRes) {
        req.payload = {
          userInfo: dbRes
        };
        next();
      } else {
        req.error = "No User Found";
        req.errorCode = 404;
        next();
      }
      next();
    } else {
      req.error = resData.message;;
      req.errorCode = 404;
      next();
    }

  }

  async function getDocumentInfo(req, res, next) {
    const query = `document/${req.body.documentNumber}/${req.body.revision}`;
    const resData = await httpReq.get(query, req.user.mcToken);
    if (resData && (resData.success || resData.infocardId)) {
      req.payload = resData;
      next();
    } else {
      req.error = "Your session has expired. Please login again";
      req.errorCode = 401;
      next();
    }
  }

  //creating getCustomDocInfo for 10960
  async function getCustomDocInfo(req, res, next) {
    try {
      const query = `infocard/${req.body.infocardId}/customfield`;
      const resData = await httpReq.get(query, req.user.mcToken);
      if (resData) {
        req.payload = resData;
        next();
      } else {
        req.error = "Your session has expired. Please login again";
        req.errorCode = 401;
        next();
      }
    } catch (error) {
      req.error = "internal server error";
      req.errorCode = 500;
      next();
    }
  }

  async function getOutcomeStatus(req, res, next) {
    const db = dbClient.db(dbName);
    const result = await db
      .collection(masterCollectionName)
      .findOne({ Type: "OutcomeStatus" });
    if (result) {
      req.payload = result.Data;
    }
    next();
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
