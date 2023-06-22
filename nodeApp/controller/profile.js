const httpMc = require("../mc/http")(null, null);
const httpPy = require("../py/http")(null, null);
const fs = require('fs');
const os = require("os");
const exception = require('../utils/exception');
const {
    spawnSync
} = require("child_process");
const dbName = process.env.BASE_DB_NAME;
const profileTemplateCollectionName = process.env.PROFILE_TEMPLATE_COLLECTION_NAME;
const profileCollectionName = process.env.PROFILE_COLLECTION_NAME;
const profileDocumentsCollectionName = process.env.PROFILE_DOCUMENTS_COLLECTION_NAME;
const ObjectId = require("mongodb").ObjectId;
const logger = require('../utils/logger');
const CONSTANTS = require("../constants/messages")
module.exports = (dbClient, passport) => {

    async function validateProfile(req, res, next) {
        const log = logger("validateProfile")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            if (!req.body.name) {
                req.error = "Profile Name Required";
                req.errorCode = 400;
                next();
            } else if (!req.body.applicableFor) {
                req.error = CONSTANTS.APPLICABLE_REQUIRED;
                req.errorCode = 400;
                next();
            } else if (!req.body.usedIn) {
                req.error = CONSTANTS.USEDIN_REQUIRED;
                req.errorCode = 400;
                next();
            } else if (!req.body.templates) {
                req.error = CONSTANTS.LAYER_REQUIRED;
                req.errorCode = 400;
                next();
            } else {
                const applicableForLength = req.body.applicableFor.length;
                const usedInLength = req.body.usedIn.length;
                const templatesLength = req.body.templates.length;
                if (applicableForLength === 0) {
                    req.error = CONSTANTS.APPLICABLE_REQUIRED;
                    req.errorCode = 400;
                    next();
                } else if (usedInLength === 0) {
                    req.error = CONSTANTS.USEDIN_REQUIRED;
                    req.errorCode = 400;
                    next();
                } else if (templatesLength === 0) {
                    req.error = CONSTANTS.LAYER_REQUIRED;
                    req.errorCode = 400;
                    next();
                } else {
                    let profileError = "Failed to Add a Profile"
                    const query = {
                        // isDeleted: false,
                        //name: new RegExp(req.body.name.trim(), 'i')
                        name: req.body.name
                    };
                    if (req.body._id) {
                        profileError = "Failed to Update a Profile"
                        query._id = { $ne: ObjectId(req.body._id) };
                    }
                    log.debug(`Query for ${profileCollectionName} :: ${JSON.stringify(query)}`)
                    const db = dbClient.db(dbName);
                    const result = await db
                        .collection(profileCollectionName)
                        .find(query).toArray();
                    log.debug(`Result for ${profileCollectionName} :: ${JSON.stringify(result)}`)
                    if (result[0]) {
                        log.warn(CONSTANTS.PROFILE_NAME_EXIST + profileError)
                        req.error = CONSTANTS.PROFILE_NAME_EXIST + profileError;
                        req.errorCode = 400;
                        next();
                    }
                    else {
                        const body = {
                            name: req.body.name,
                            applicableFor: req.body.applicableFor,
                            usedIn: req.body.usedIn,
                            templates: req.body.templates,
                            isDeleted: false,
                            userInputFields: req.body.userInputFields,
                            isBatchNumberApplicable: req.body.isBatchNumberApplicable,
                            saveName: req.body.name.trim().toLowerCase()
                        };
                        if (req.body._id) {
                            body._id = req.body._id;
                        }
                        req.body = body;
                        log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
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

    async function saveProfile(req, res, next) {
        const log = logger("saveProfile")
        log.info(CONSTANTS.SOF)
        try {
            if (!req.error) {
                log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
                const db = dbClient.db(dbName);
                const result = await db
                    .collection(profileCollectionName)
                    .insertOne(req.body);
                if (result && result.ops[0]) {
                    req.payload = result.ops[0];
                    req.audit = {
                        eventType: 'Add Profile',
                        name: req.payload.name
                    };
                    req.msg = "Profile created and saved successfully"
                    log.info("Profile created and saved successfully")
                    log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                    next();
                } else {
                    log.warn("Failed to create and save a Profile")
                    req.error = "Failed to create and save a Profile";
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

    async function getProfileList(req, res, next) {
        const log = logger("getProfileList")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const query = { isDeleted: false };
            if (req.body.applicableFor) {
                query.applicableFor = req.body.applicableFor;
            }
            if (req.body.usedIn) {
                query.usedIn = req.body.usedIn;
            }
            if (req.body.name) {
                query.name = new RegExp(req.body.name, 'i');
            }
            log.debug(`Query for ${profileCollectionName} :: ${JSON.stringify(query)}`)
            const db = dbClient.db(dbName);
            const result = await db
                .collection(profileCollectionName)
                .find(query).toArray();
            if (result) {
                req.payload = result;
                req.msg = "profileList fetched successfully"
                log.info("profileList fetched successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
                next();
            } else {
                log.warn(CONSTANTS.PROFILE_GET_ERROR)
                req.error = CONSTANTS.PROFILE_GET_ERROR;
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

    async function saveProfileTemplate(req, res, next) {
        const log = logger("saveProfileTemplate")
        log.info(CONSTANTS.SOF)
        try {
            if (!req.error) {
                log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
                if (req.body.name && req.files) {
                    const templateObj = {
                        name: req.body.name,
                        url: req.files.data.name,
                        isDeleted: false,
                        fields: req.body.fields.split(',').map(filed => filed.trim())
                    };
                    const db = dbClient.db(dbName);
                    const result = await db
                        .collection(profileTemplateCollectionName).insert(templateObj);
                    if (result && result.ops && result.ops[0]) {
                        fs.writeFile(`./../resources/templates/${result.ops[0]._id}.pdf`, req.files.data.data, (err) => {
                            if (err) {
                                log.error(CONSTANTS.ERROR_OCCURED + err)
                                req.error = err;
                                req.errorCode = 500;
                                next();
                            } else {
                                req.payload = result.ops[0];
                                req.audit = {
                                    eventType: 'Add Profile Layer',
                                    name: req.payload.name
                                };
                                req.msg = "Profile template saved successfully"
                                log.info("Profile template saved successfully")
                                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                                next();
                            }
                        });
                    } else {
                        log.warn(CONSTANTS.TEMPLATE_SAVE_ERROR)
                        req.errorCode = 400;
                        req.error = CONSTANTS.TEMPLATE_SAVE_ERROR;
                        next();
                    }
                } else {
                    log.warn(CONSTANTS.TEMPLATE_NAME_REQUIRED)
                    req.error = CONSTANTS.TEMPLATE_NAME_REQUIRED;
                    req.errorCode = 400;
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

    async function saveProfileDocumentMapping(req, res, next) {
        const log = logger("saveProfileDocumentMapping")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const db = dbClient.db(dbName);
            const body = req.body;
            body.isDeleted = false;
            const result = await db
                .collection(profileDocumentsCollectionName)
                .insertOne(body);
            if (result && result.ops) {
                req.payload = result.ops[0];
                req.audit = {
                    eventType: 'New Document Mapped',
                    name: req.payload.name
                };
                req.msg = "Profile Mapped successfully"
                log.info("Profile Mapped successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                log.warn("Profile Mapping failed")
                req.error = "Profile Mapping failed";
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

    async function updateProfileDocumentMapping(req, res, next) {
        const log = logger("updateProfileDocumentMapping")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const query = { _id: ObjectId(req.body._id) };
            log.debug(`Query for ${profileDocumentsCollectionName} :: ${JSON.stringify(query)}`)
            const db = dbClient.db(dbName);
            const result = await db
                .collection(profileDocumentsCollectionName)
                .findOneAndUpdate(query, {
                    $set: {
                        documents: req.body.documents
                    }
                }, { returnOriginal: false }
                );
            if (result && result.value) {
                req.payload = result.value;
                req.audit = {
                    eventType: 'Document-Profile mapping Updated',
                    name: req.payload.name
                };
                req.msg = "Profile Mapping updated successfully"
                log.info("Profile Mapping updated successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                log.warn("Profile Mapping update failed")
                req.error = "Profile Mapping update failed";
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

    async function updateProfile(req, res, next) {
        const log = logger("updateProfile")
        log.info(CONSTANTS.SOF)
        if (!req.error) {
            try {
                log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
                const query = { _id: ObjectId(req.body._id) };
                log.debug(`Query for ${profileCollectionName} :: ${query}`)
                const db = dbClient.db(dbName);
                const result = await db
                    .collection(profileCollectionName)
                    .findOneAndUpdate(query, {
                        $set: {
                            name: req.body.name,
                            applicableFor: req.body.applicableFor,
                            usedIn: req.body.usedIn,
                            templates: req.body.templates,
                            isDeleted: false,
                            userInputFields: req.body.userInputFields,
                            isBatchNumberApplicable: req.body.isBatchNumberApplicable,
                            saveName: req.body.saveName
                        }
                    }, { returnOriginal: false });
                if (result && result.ok) {
                    req.payload = result.value;
                    req.audit = {
                        eventType: 'Update Profile',
                        name: req.payload.name
                    };
                    req.msg = "Profile Updated and saved successfully"
                    log.info("Profile Updated and saved successfully")
                    log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                    next();
                } else {
                    log.warn("Failed to update and saved Profile")
                    req.error = "Failed to update and saved Profile";
                    req.errorCode = 500;
                    next();
                }
            } catch (e) {
                log.error(CONSTANTS.ERROR_OCCURED + e)
                req.error = CONSTANTS.SERVER_ERROR;
                req.errorCode = 500;
                next();
            }
        } else {
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function getDocumentTypes(req, res, next) {
        const log = logger("getDocumentTypes")
        log.info(CONSTANTS.SOF)
        try {
            let query = 'document/types';
            log.debug(`Query for resData :: ${query}`)
            const resData = await httpMc.get(query, req.user.mcToken, false);
            log.debug(`Result for ${query} :: ${JSON.stringify(resData)}`)
            if (resData && !resData.success) {
                req.payload = resData;
                req.msg = "Getting DocumentTypes"
                log.info("Getting DocumentTypes")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                return exception.raiseError(req, res, next, 'PA001', '401', CONSTANTS.SESSION_EXPIRED);
            }
        } catch (err) {
            log.error(CONSTANTS.ERROR_OCCURED + err)
            req.error = CONSTANTS.SERVER_ERROR
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function getProfileTemplateList(req, res, next) {
        const log = logger("getProfileTemplateList")
        log.info(CONSTANTS.SOF)
        try {
            const query = { isDeleted: false };
            log.debug(`Query for ${profileTemplateCollectionName} :: ${query}`)
            const db = dbClient.db(dbName);
            const result = await db.collection(profileTemplateCollectionName)
                .find(query).toArray();
            if (result) {
                req.payload = result;
                req.msg = "Getting profileTemplatesList"
                log.info("Getting profileTemplatesList")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                req.payload = [];
                req.msg = "Error in getting profileTemplatesList"
                log.info("Error in getting profileTemplatesList")
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

    async function getProfile(req, res, next) {
        const log = logger("getProfile")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const query = { isDeleted: false, _id: ObjectId(req.body._id) };
            const db = dbClient.db(dbName);
            log.debug(`Query for ${profileCollectionName} :: ${JSON.stringify(query)}`)
            const result = await db.collection(profileCollectionName)
                .find(query).toArray();
            if (result) {
                req.payload = result;
                req.msg = "Get Profile of request ID"
                log.info("Get Profile of request ID")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                req.payload = [];
                req.msg = "Unable to get Profile of request ID"
                log.info("Unable to get Profile of request ID")
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

    async function getProfileDocumentList(req, res, next) {
        const log = logger("getProfileDocumentList")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const query = { isDeleted: false };
            if (req.body.profileId) {
                query.profileId = req.body.profileId
            }
            if (req.body.documentName) {
                query['documents.name'] = new RegExp(req.body.documentName, 'i');
            }
            if (req.body.profileName) {
                query['profileName'] = new RegExp(req.body.profileName, 'i');
            }
            log.debug(`Query for ${profileDocumentsCollectionName} :: ${JSON.stringify(query)}`)
            const db = dbClient.db(dbName);
            const result = await db.collection(profileDocumentsCollectionName)
                .find(query).toArray();
            if (result) {
                req.payload = result;
                req.msg = "Fetching ProfileDocument mapping list"
                log.info("Fetching ProfileDocument mapping list")
                log.debug(CONSTANTS.REQ_PAYLOAD + req.payload)
                next();
            } else {
                req.payload = [];
                req.msg = "Error in fetching ProfileDocument mapping list"
                log.info("Error in fetching ProfileDocument mapping list")
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

    async function updateProfileTemplate(req, res, next) {
        const log = logger("updateProfileTemplate")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            if (!req.error) {
                const updateData = {
                    name: req.body.name,
                    isDeleted: false
                }
                if (req.files && req.files.data && req.body.fields) {
                    updateData.url = req.files.data.name;
                    updateData.fields = req.body.fields.split(',').map(filed => filed.trim());
                }
                if (req.body.name) {
                    const db = dbClient.db(dbName);
                    const result = await db.collection(profileTemplateCollectionName).findOneAndUpdate({
                        _id: ObjectId(req.body._id)
                    }, {
                        $set: updateData
                    }, { returnOriginal: false });
                    if (result && result.lastErrorObject && result.lastErrorObject.updatedExisting) {
                        if (req.files && req.files.data && req.body.fields) {
                            fs.writeFile(`./../resources/templates/${result.value._id}.pdf`, req.files.data.data, (err) => {
                                if (err) {
                                    log.error(CONSTANTS.ERROR_OCCURED + err)
                                    req.error = err;
                                    req.errorCode = 500;
                                    next();
                                } else {
                                    req.payload = result.value;
                                    req.audit = {
                                        eventType: 'Update Profile Layer',
                                        name: req.body.name
                                    };
                                    req.msg = "Profile template updated successfully"
                                    log.info("Profile template updated successfully")
                                    next();
                                }
                            });
                        } else {
                            req.payload = result.value;
                            req.audit = {
                                eventType: 'Update Profile Layer',
                                name: req.body.name
                            };
                            log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                            next();
                        }
                    } else {
                        req.errorCode = 400;
                        req.error = CONSTANTS.TEMPLATE_UPDATE_ERROR;
                        next();
                    }
                } else {
                    req.errorCode = 400;
                    req.error = CONSTANTS.TEMPLATE_NAME_REQUIRED;
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

    async function getFormFields(req, res, next) {
        const log = logger("getFormFields")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.files.data))
            const filepath = new Date().getTime();
            fs.writeFile(`./../resources/formFiledTemplate/${filepath}.pdf`, req.files.data.data, async (err) => {
                if (err) {
                    log.error(CONSTANTS.ERROR_OCCURED + err)
                    req.error = err;
                    req.errorCode = 500;
                    next();
                } else {
                    const resData = await httpPy.post('/pyApi/getFormFields', JSON.stringify({ path: `${filepath}.pdf` }));
                    if (resData && !resData.success) {
                        fs.unlinkSync(`./../resources/formFiledTemplate/${filepath}.pdf`);
                        req.payload = resData;
                        req.msg = "Getting FormFields for the selected template"
                        log.info("Getting FormFields for the selected template")
                        log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                        next();
                    } else {
                        fs.unlinkSync(`./../resources/formFiledTemplate/${filepath}.pdf`);
                        req.error = r.stderr;
                        req.errorCode = 500;
                        next();
                    }
                }
            });
        } catch (error) {
            log.error(CONSTANTS.ERROR_OCCURED + error)
            req.error = CONSTANTS.SERVER_ERROR;
            req.errorCode = 500;
            next();
        }
        log.info(CONSTANTS.EOF)
    }

    async function deleteProfile(req, res, next) {
        const log = logger("deleteProfile")
        log.info(CONSTANTS.SOF)
        try {
            const db = dbClient.db(dbName);
            const result = await db.collection(profileCollectionName).findOneAndUpdate({
                _id: ObjectId(req.body._id)
            }, {
                $set: {
                    isDeleted: true
                }
            }, { returnOriginal: false });
            if (result && result.lastErrorObject && result.lastErrorObject.updatedExisting) {
                req.payload = result.value;
                req.audit = {
                    eventType: 'Delete Profile',
                    name: req.payload.name
                };
                req.msg = "Profile Deleted successfully"
                log.info("Profile Deleted successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                log.error("Failed to delete a Profile")
                req.error = "Failed to delete a Profile";
                req.errorCode = 400;
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

    async function deleteProfileMapping(req, res, next) {
        const log = logger("deleteProfileMapping")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const db = dbClient.db(dbName);
            const result = await db.collection(profileDocumentsCollectionName).findOneAndUpdate({
                _id: ObjectId(req.body._id)
            }, {
                $set: {
                    isDeleted: true
                }
            }, { returnOriginal: false });
            if (result && result.lastErrorObject && result.lastErrorObject.updatedExisting) {
                req.payload = result.value;
                req.audit = {
                    eventType: 'Delete Profile Mapping',
                    name: req.payload.profileName
                };
                req.msg = "Profile - Document Infocard Type mapping deleted successfully"
                log.info("Profile Document Infocard Type mapping deleted successfully")
                log.debug(CONSTANTS.REQ_PAYLOAD + JSON.stringify(req.payload))
                next();
            } else {
                log.error("Failed to delete a Profile Document Infocard Type Mapping")
                req.error = "Failed to delete a Profile-Document Infocard Type Mapping";
                req.errorCode = 400;
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

    async function markProfileMapped(req, res, next) {
        const log = logger("markProfileMapped")
        log.info(CONSTANTS.SOF)
        try {
            const db = dbClient.db(dbName);
            const result = await db.collection(profileCollectionName).findOneAndUpdate({
                _id: ObjectId(req.body.profileId)
            }, {
                $set: {
                    isDocumentMapped: true
                }
            }, { returnOriginal: false });
            if (result && result.ok) {
                req.msg = "Profile Mapped successfully"
                next();
            } else {
                log.warn(CONSTANTS.PROFILE_MAPPING_ERROR)
                req.error = CONSTANTS.PROFILE_MAPPING_ERROR;
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

    async function markProfileUnMapped(req, res, next) {
        const log = logger("markProfileUnMapped")
        log.info(CONSTANTS.SOF)
        try {
            const db = dbClient.db(dbName);
            const result = await db.collection(profileCollectionName).findOneAndUpdate({
                _id: ObjectId(req.body.profileId)
            }, {
                $set: {
                    isDocumentMapped: false
                }
            }, { returnOriginal: false });
            if (result && result.ok) {
                next();
            } else {
                log.warn("Failed to update profile unmapped");
                req.error = "Failed to update profile unmapped";
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

    async function updateProfileName(req, res, next) {
        const log = logger("updateProfileName")
        log.info(CONSTANTS.SOF)
        try {
            log.debug(CONSTANTS.REQ_BODY + JSON.stringify(req.body))
            const db = dbClient.db(dbName);
            const result = await db.collection(profileDocumentsCollectionName).findOneAndUpdate({
                profileId: req.body._id,
                isDeleted: false
            }, {
                $set: {
                    profileName: req.body.name
                }
            });
            if (result && result.ok) {
                next();
            } else {
                log.warn(CONSTANTS.PROFILE_UPDATE_ERROR)
                req.error = CONSTANTS.PROFILE_UPDATE_ERROR;
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

    return {
        validateProfile,
        saveProfileTemplate,
        updateProfileTemplate,
        saveProfile,
        getProfileList,
        updateProfile,
        getDocumentTypes,
        getProfileTemplateList,
        getProfile,
        getProfileDocumentList,
        saveProfileDocumentMapping,
        updateProfileDocumentMapping,
        deleteProfileMapping,
        getFormFields,
        deleteProfile,
        markProfileMapped,
        updateProfileName,
        markProfileUnMapped
    };
};
