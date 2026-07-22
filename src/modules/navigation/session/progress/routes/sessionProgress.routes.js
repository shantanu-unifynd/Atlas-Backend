const express = require("express");
const sessionProgressController = require("../controller/sessionProgress.controller");

const router = express.Router();

router.post("/:id/progress", sessionProgressController.getSessionProgress);

module.exports = router;
