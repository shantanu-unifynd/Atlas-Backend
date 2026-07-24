const express = require("express");
const positionValidationController = require("../controllers/positionValidation.controller");

const router = express.Router();

router.post("/:id/position-validation", positionValidationController.validatePositioning);

module.exports = router;
