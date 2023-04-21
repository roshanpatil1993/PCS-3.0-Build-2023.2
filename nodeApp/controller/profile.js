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
module.exports = (dbClient, passport) => {

    async function validateProfile(req, res, next) {
        if (!req.body.name) {
            req.error = "Profile Name Required";
            req.errorCode = 400;
            next();
        } else if (!req.body.applicableFor) {
            req.error = "At Least one Applicable for required";
            req.errorCode = 400;
            next();
        } else if (!req.body.usedIn) {
            req.error = "At Least one Used In required";
            req.errorCode = 400;
            next();
        } else if (!req.body.templates) {
            req.error = "At Least one layer required";
            req.errorCode = 400;
            next();
        } else {
            const applicableForLength = req.body.applicableFor.length;
            const usedInLength = req.body.usedIn.length;
            const templatesLength = req.body.templates.length;
            if (applicableForLength === 0) {
                req.error = "At Least one Applicable for required";
                req.errorCode = 400;
                next();
            } else if (usedInLength === 0) {
                req.error = "At Least one Used In required";
                req.errorCode = 400;
                next();
            } else if (templatesLength === 0) {
                req.error = "At Least one layer required";
                req.errorCode = 400;
                next();
            } else {     
                let profileError = "Failed to Add a Profile"                                         
                const query = {
                    // isDeleted: false,
                    name: new RegExp(req.body.name.trim(), 'i')
                };
                if (req.body._id) {
                    profileError = "Failed to Update a Profile"
                    query._id = { $ne: ObjectId(req.body._id) };
                }
                const db = dbClient.db(dbName);
                const result = await db
                    .collection(profileCollectionName)
                    .find(query).toArray();
                if (result[0]) {
                    req.error = "Profile Name Already Exists, "+profileError;
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
                    next();
                }
            }                                                            ////////
        }
    }

    async function saveProfile(req, res, next) {
        if (!req.error) {
            try {
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
                    next();
                } else {
                    req.error = "Error in save profile";
                    req.errorCode = 500;
                    next();
                }
            } catch (e) {
                req.error = "Error in Save profile " + JSON.stringify(e.keyValue);
                req.errorCode = 500;
                next();
            }
        } else {
            next();
        }
    }

    async function getProfileList(req, res, next) {
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
        const db = dbClient.db(dbName);
        const result = await db
            .collection(profileCollectionName)
            .find(query).toArray();
        if (result) {
            req.payload = result;
            next();
        } else {
            req.error = "Error in get profile list";
            req.errorCode = 500;
            next();
        }
    }

    async function saveProfileTemplate(req, res, next) {
        if (!req.error) {
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
                            req.error = err;
                            req.errorCode = 500;
                            next();
                        } else {
                            req.payload = result.ops[0];
                            req.audit = {
                                eventType: 'Add Profile Layer',
                                name: req.payload.name
                            };
                            next();
                        }
                    });
                } else {
                    req.errorCode = 400;
                    req.error = "Template save error";
                    next();
                }
            } else {
                req.errorCode = 400;
                req.error = "Template name required";
                next();
            }
        } else {
            next();
        }
    }

    async function saveProfileDocumentMapping(req, res, next) {
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
            next();
        } else {
            req.error = "Profile mapping not saved";
            req.errorCode = 500;
            next();
        }
    }
    async function updateProfileDocumentMapping(req, res, next) {
        const query = { _id: ObjectId(req.body._id) };
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
            next();
        } else {
            req.error = "Profile mapping not updated";
            req.errorCode = 500;
            next();
        }
    }

    async function updateProfile(req, res, next) {
        if (!req.error) {
            try {
                const query = { _id: ObjectId(req.body._id) };
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
                    next();
                } else {
                    req.error = "Error in update profile";
                    req.errorCode = 500;
                    next();
                }
            } catch (e) {
                req.error = "Error in update profile " + JSON.stringify(e.keyValue);
                req.errorCode = 500;
                next();
            }
        } else {
            next();
        }

    }

    async function getDocumentTypes(req, res, next) {
        let query = 'document/types';
        const resData = await httpMc.get(query, req.user.mcToken, false);
        if (resData && !resData.success) {
            req.payload = resData;
            next();
        } else {
            return exception.raiseError(req, res, next, 'PA001', '401', 'Your session has expired. Please login again');
        }
    }

    async function getProfileTemplateList(req, res, next) {
        const query = { isDeleted: false };
        const db = dbClient.db(dbName);
        const result = await db.collection(profileTemplateCollectionName)
            .find(query).toArray();
        if (result) {
            req.payload = result;
            next();
        } else {
            req.payload = [];
            next();
        }
    }

    async function getProfile(req, res, next) {
        const query = { isDeleted: false, _id: ObjectId(req.body._id) };
        const db = dbClient.db(dbName);
        const result = await db.collection(profileCollectionName)
            .find(query).toArray();
        if (result) {
            req.payload = result;
            next();
        } else {
            req.payload = [];
            next();
        }
    }

    async function getProfileDocumentList(req, res, next) {
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
        const db = dbClient.db(dbName);
        const result = await db.collection(profileDocumentsCollectionName)
            .find(query).toArray();
        if (result) {
            req.payload = result;
            next();
        } else {
            req.payload = [];
            next();
        }
    }

    async function updateProfileTemplate(req, res, next) {
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
                                req.error = err;
                                req.errorCode = 500;
                                next();
                            } else {
                                req.payload = result.value;
                                req.audit = {
                                    eventType: 'Update Profile Layer',
                                    name: req.body.name
                                };
                                next();
                            }
                        });
                    } else {
                        req.payload = result.value;
                        req.audit = {
                            eventType: 'Update Profile Layer',
                            name: req.body.name
                        };
                        next();
                    }
                } else {
                    req.errorCode = 400;
                    req.error = "Template update error";
                    next();
                }
            } else {
                req.errorCode = 400;
                req.error = "Template name required";
                next();
            }
        } else {
            next();
        }
    }

    async function getFormFields(req, res, next) {
        const filepath = new Date().getTime();
        fs.writeFile(`./../resources/formFiledTemplate/${filepath}.pdf`, req.files.data.data, async (err) => {
            if (err) {
                req.error = err;
                req.errorCode = 500;
                next();
            } else {

                const resData = await httpPy.post('/pyApi/getFormFields', JSON.stringify({ path: `${filepath}.pdf` }));
                if (resData && !resData.success) {
                    fs.unlinkSync(`./../resources/formFiledTemplate/${filepath}.pdf`);
                    req.payload = resData;
                    next();
                } else {
                    fs.unlinkSync(`./../resources/formFiledTemplate/${filepath}.pdf`);
                    req.error = r.stderr;
                    req.errorCode = 500;
                    next();
                }
            }
        });
    }
    async function deleteProfile(req, res, next) {
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
            next();
        } else {
            req.error = "Profile Not Found";
            req.errorCode = 400;
            next();
        }
    }

    async function deleteProfileMapping(req, res, next) {
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
            next();
        } else {
            req.error = "Profile Mapping Not Found";
            req.errorCode = 400;
            next();
        }
    }

    async function markProfileMapped(req, res, next) {
        const db = dbClient.db(dbName);
        const result = await db.collection(profileCollectionName).findOneAndUpdate({
            _id: ObjectId(req.body.profileId)
        }, {
            $set: {
                isDocumentMapped: true
            }
        }, { returnOriginal: false });
        if (result && result.ok) {
            next();
        } else {
            req.error = "Error in update profile document mapping";
            req.errorCode = 500;
            next();
        }
    }

    async function markProfileUnMapped(req, res, next) {
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
            req.error = "Error in update profile document mapping";
            req.errorCode = 500;
            next();
        }
    }

    async function updateProfileName(req, res, next) {
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
            req.error = "Error in update profile name";
            req.errorCode = 500;
            next();
        }
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
