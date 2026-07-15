const express = require("express");
const normalizationController = require("../controllers/normalization.controller");

const router = express.Router({ mergeParams: true });

router.post("/normalize", normalizationController.normalize);
router.get("/acsm", normalizationController.getAcsm);

module.exports = router;
