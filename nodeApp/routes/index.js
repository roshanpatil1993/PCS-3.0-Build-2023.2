const express = require("express");
const router = express.Router();
const parallel = require('parallel-express-middleware');

module.exports = (dbClient, passport, liveUsers) => {
  const print = require("../controller/print")(dbClient, passport);
  const master = require("../controller/master")(dbClient, passport);
  const user = require("../controller/user")(dbClient, passport);
  const audit = require("../controller/audit")(dbClient, passport);
  const recall = require("../controller/recall")(dbClient, passport);
  const reason = require("../controller/reasons")(dbClient, passport);
  const printer = require("../controller/printer")(dbClient, passport);
  const mail = require("../controller/mail")();
  const notification = require("../controller/notification")(dbClient, liveUsers);
  const buildResponse = require("../utils/buildResponse");
  const schedule = require('../utils/schedule')(dbClient, liveUsers);
  const runScript = require('../utils/modelChange')(dbClient, passport);

  router.get("/ping", function (req, res, next) {
    res.send({
      message: "document server is running",
    });
  });

  router
    .route("/getPrintProfile")
    .post([passport.authenticate('jwt', {
      session: false,
    }), master.getPrintProfile, buildResponse.send]);

  router.route("/getProfileList")
    .post([passport.authenticate('jwt', {
      session: false,
    }), master.getProfileList, buildResponse.send]);

  router
    .route("/getOutcomeStatus")
    .get([master.getOutcomeStatus, buildResponse.send]);

  router
    .route("/getReconciliationReasons")
    .get([passport.authenticate('jwt', {
      session: false,
    }), master.getReconciliationReasons, buildResponse.send]);

  router
    .route("/getReasonForPrinting")
    .get([passport.authenticate('jwt', {
      session: false,
    }), reason.getReasonForPrinting, buildResponse.send]);

  router
    .route("/getReasonForRePrinting")
    .get([passport.authenticate('jwt', {
      session: false,
    }), reason.getReasonForRePrinting, buildResponse.send]);

  router
    .route("/getRecallReason")
    .get([passport.authenticate('jwt', {
      session: false,
    }), reason.getReasonForRecall, buildResponse.send]);

  router
    .route("/getInternalRecipient")
    .get([passport.authenticate('jwt', {
      session: false,
    }), user.getInternalRecipient, buildResponse.send]);

  router
    .route("/getExternalRecipient")
    .get([passport.authenticate('jwt', {
      session: false,
    }), user.getExternalRecipient, buildResponse.send]);

  router.route("/print").post([passport.authenticate('jwt', {
    session: false,
  }), print.print, buildResponse.send]);

  router.route("/rePrint").post([passport.authenticate('jwt', {
    session: false,
  }), print.rePrint, buildResponse.send]);

  router.route("/verifyPrintRecipient").post([passport.authenticate('jwt', {
    session: false,
  }), print.verifyPrintRecipient, buildResponse.send]);

  router
    .route("/updatePrintStatus")
    .post([passport.authenticate('jwt', {
      session: false,
    }), print.updatePrintStatus, buildResponse.send]);

  router
    .route("/getDocumentList")
    .post([passport.authenticate('jwt', {
      session: false,
    }), print.getDocumentList, buildResponse.send]);

  router
    .route("/getDocumentInfo")
    .post([passport.authenticate('jwt', {
      session: false,
    }), master.getDocumentInfo, buildResponse.send]);

  //creating /getCustomDocInfo for 10960
  router
    .route("/getCustomDocInfo")
    .post([passport.authenticate('jwt', {
      session: false,
    }), master.getCustomDocInfo, buildResponse.send]);


    //  creating /validateLicenseFun for 10996      //
  // router
  // .route("/validateLicenseFun")
  // .post([ master.validateLicenseFun, buildResponse.send]);



  router.route("/getUserInfo").post([passport.authenticate('jwt', {
    session: false,
  }), master.getUserInfo, buildResponse.send]);

  router.route("/getAuditData").post([passport.authenticate('jwt', {
    session: false,
  }), audit.getAuditData, buildResponse.send]);

  router
    .route("/saveRecall")
    .post([passport.authenticate('jwt', {
      session: false,
    }), recall.saveRecall, parallel(mail.recallInitMail, notification.sendImmediateNotification), buildResponse.send]);

  router
    .route("/getRecallDocList")
    .post([passport.authenticate('jwt', {
      session: false,
    }), recall.getRecallDocList, buildResponse.send]);

  router
    .route("/getNotificationList")
    .post([passport.authenticate('jwt', {
      session: false,
    }), notification.getNotificationList, buildResponse.send]);

  router
    .route("/getNotificationCount")
    .post([passport.authenticate('jwt', {
      session: false,
    }), notification.getNotificationCount, buildResponse.send]);

  router.route("/completeRecall")
    .post([passport.authenticate('jwt', {
      session: false,
    }), recall.completeRecall, audit.saveRecallAudit, notification.updateNotification, buildResponse.send])

  router.route("/saveReconcile")
    .post([passport.authenticate('jwt', {
      session: false,
    }), recall.saveReconcile, audit.saveReconcileAudit, buildResponse.send]);

  router.route("/updateDueDate")
    .post([passport.authenticate('jwt', {
      session: false,
    }), recall.updateDueDate, audit.saveUpdateDueDateAudit, buildResponse.send]);

  router.route("/validatePrinterList")
    .post([passport.authenticate('jwt', {
      session: false,
    }), printer.validatePrinterList, buildResponse.send]);

  router.route("/login")
    .post([user.login, buildResponse.send])

  router.route("/runScript")
    .post([runScript.runScript, buildResponse.send])
  return router;

};
