const express = require("express");
const navigationSessionValidationController = require("../controller/navigationSessionValidation.controller");

const router = express.Router();

router.post("/:id/validate", navigationSessionValidationController.validateSession);

module.exports = router;
