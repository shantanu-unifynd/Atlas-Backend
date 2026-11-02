const express = require("express");
const autoExtractController = require("../controllers/autoExtract.controller");

const router = express.Router({ mergeParams: true });

// One-click automatic extraction for a floor's current blueprint.
router.post("/", autoExtractController.autoExtract);

module.exports = router;
