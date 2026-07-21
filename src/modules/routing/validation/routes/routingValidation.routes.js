const express = require("express");
const routingValidationController = require("../controllers/routingValidation.controller");

const router = express.Router();

router.post("/validate", routingValidationController.validateRouting);

module.exports = router;
