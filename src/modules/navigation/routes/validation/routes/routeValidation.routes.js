const express = require("express");
const routeValidationController = require("../controllers/routeValidation.controller");

const router = express.Router();

router.post("/:routeId/validate", routeValidationController.validateRoute);
router.get("/:routeId/validation", routeValidationController.getValidation);

module.exports = router;
