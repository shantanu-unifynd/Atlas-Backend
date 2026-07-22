const express = require("express");
const navigationEventController = require("../controller/navigationEvent.controller");

const router = express.Router();

router.post("/:id/events", navigationEventController.getSessionEvents);

module.exports = router;
