const express = require("express");
const router = express.Router();
const parallel = require('parallel-express-middleware');

module.exports = (dbClient, passport, liveUsers) => {
    const user = require("../controller/user")(dbClient, passport);
    const printer = require("../controller/printer")(dbClient, passport);
    const reason = require("../controller/reasons")(dbClient, passport);
    const profile = require("../controller/profile")(dbClient, passport);
    const buildResponse = require("../utils/buildResponse");
    const audit = require("../controller/audit")(dbClient, passport);

    router.get("/ping", function (req, res, next) {
        res.send({
            message: "document server admin is running",
        });
    });

    router.route("/addInternalUser")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.validateUser, user.addInternalUser, audit.saveAdminAudit, buildResponse.send]);

    router.route("/updateInternalUser")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.updateInternalUser, audit.saveAdminAudit, buildResponse.send]);

    router.route("/assignInternalUsers")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.assignUser, user.deleteInternalUser, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getInternalUsersList")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.getInternalUsersList, buildResponse.send]);

    router.route("/getInternalUsers")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.getInternalUsers, buildResponse.send]);

    router.route("/updateUserCount")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.updateUserCount, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getUserCount")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.getUserCount, buildResponse.send]);

    router.route("/addPrinter")
        .post([passport.authenticate('jwt', {
            session: false,
        }), printer.validatePrinter, printer.addPrinter, audit.saveAdminAudit, buildResponse.send]);

    router.route("/updatePrinter")
        .post([passport.authenticate('jwt', {
            session: false,
        }), printer.validatePrinter, printer.updatePrinter, audit.saveAdminAudit, buildResponse.send]);

    router.route("/deletePrinter")
        .post([passport.authenticate('jwt', {
            session: false,
        }), printer.deletePrinter, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getPrinterList")
        .post([passport.authenticate('jwt', {
            session: false,
        }), printer.getPrinterList, buildResponse.send]);

    router.route("/updatePrinterConfiguration")
        .post([passport.authenticate('jwt', {
            session: false,
        }), printer.updatePrinterConfiguration, audit.saveAdminAudit, buildResponse.send]);

    router.route("/addReason")
        .post([passport.authenticate('jwt', {
            session: false,
        }), reason.validateReason, reason.addReason, audit.saveAdminAudit, buildResponse.send]);

    router.route("/updateReason")
        .post([passport.authenticate('jwt', {
            session: false,
        }), reason.validateReason, reason.updateReason, audit.saveAdminAudit, buildResponse.send]);

    router.route("/deleteReason")
        .post([passport.authenticate('jwt', {
            session: false,
        }), reason.deleteReason, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getReasonList")
        .post([passport.authenticate('jwt', {
            session: false,
        }), reason.getReasonList, buildResponse.send]);

    router.route("/saveProfileTemplate")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.saveProfileTemplate, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getFormFields")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.getFormFields, buildResponse.send]);

    router.route("/updateProfileTemplate")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.updateProfileTemplate, audit.saveAdminAudit, buildResponse.send]);

    router.route("/saveProfile")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.validateProfile, profile.saveProfile, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getProfileList")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.getProfileList, buildResponse.send]);

    router.route("/saveProfileDocumentMapping")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.saveProfileDocumentMapping, profile.markProfileMapped, audit.saveAdminAudit, buildResponse.send]);

    router.route("/updateProfileDocumentMapping")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.updateProfileDocumentMapping, audit.saveAdminAudit, buildResponse.send]);

    router.route("/updateProfile")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.validateProfile, profile.updateProfile, profile.updateProfileName, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getDocumentTypes")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.getDocumentTypes, buildResponse.send]);

    router.route("/deleteProfileMapping")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.deleteProfileMapping, profile.markProfileUnMapped, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getProfileTemplateList")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.getProfileTemplateList, buildResponse.send]);

    router.route("/getProfile")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.getProfile, buildResponse.send]);

    router.route("/deleteProfile")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.deleteProfile, audit.saveAdminAudit, buildResponse.send]);

    router.route("/getProfileDocumentList")
        .post([passport.authenticate('jwt', {
            session: false,
        }), profile.getProfileDocumentList, buildResponse.send]);

    router.route("/getAdminAudit")
        .post([passport.authenticate('jwt', {
            session: false,
        }), audit.getAdminAudit, buildResponse.send]);

    router.route("/getExternalUsers")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.getExternalUsers, buildResponse.send]);

    router.route("/getExternalUsersList")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.getExternalUsersList, buildResponse.send]);

    router.route("/addExternalUser")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.validateExternalUser, user.addExternalUser, audit.saveAdminAudit, buildResponse.send]);

    router.route("/assignExternalUsers")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.assignExternalUsers, audit.saveAdminAudit, buildResponse.send]);

    router.route("/deleteExternalUser")
        .post([passport.authenticate('jwt', {
            session: false,
        }), user.deleteExternalUser, audit.saveAdminAudit, buildResponse.send]);

    return router;

};