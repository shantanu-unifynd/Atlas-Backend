const express = require("express");
const navigationSessionController = require("../controllers/navigationSession.controller");

const router = express.Router();

router.post("/", navigationSessionController.createNavigationSession);
router.get("/", navigationSessionController.getNavigationSessions);
router.get("/:id", navigationSessionController.getNavigationSessionById);
router.delete("/:id", navigationSessionController.deleteNavigationSession);

module.exports = router;
