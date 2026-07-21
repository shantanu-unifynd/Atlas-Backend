const express = require("express");
const preferenceRoutingController = require("../controllers/preferenceRouting.controller");

const router = express.Router({ mergeParams: true });

router.post("/", preferenceRoutingController.computeRoute);

module.exports = router;
