const express = require("express");
const costPolicyController = require("../controllers/costPolicy.controller");

const router = express.Router({ mergeParams: true });

router.post("/", costPolicyController.computeEffectiveCosts);

module.exports = router;
