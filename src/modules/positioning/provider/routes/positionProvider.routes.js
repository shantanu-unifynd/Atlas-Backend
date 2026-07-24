const express = require("express");
const positionProviderController = require("../controllers/positionProvider.controller");

const router = express.Router();

router.get("/current", positionProviderController.getCurrentPosition);

module.exports = router;
