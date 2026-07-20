const express = require("express");
const costModelController = require("../controllers/costModel.controller");

const router = express.Router({ mergeParams: true });

router.post("/", costModelController.generateCostModel);
router.get("/", costModelController.getCostSummary);

module.exports = router;
