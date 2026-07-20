const express = require("express");
const routeBuilderController = require("../controllers/routeBuilder.controller");

const router = express.Router();

router.post("/build", routeBuilderController.buildRoute);

module.exports = router;
