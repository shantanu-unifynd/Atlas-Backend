const express = require("express");
const graphValidationController = require("../controllers/graphValidation.controller");

const router = express.Router({ mergeParams: true });

router.post("/validate", graphValidationController.validateGraph);
router.get("/validation", graphValidationController.getValidation);

module.exports = router;
