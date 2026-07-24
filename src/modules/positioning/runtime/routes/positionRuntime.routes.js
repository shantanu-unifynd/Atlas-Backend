const express = require("express");
const positionRuntimeController = require("../controllers/positionRuntime.controller");

const router = express.Router();

router.post("/:id/runtime", positionRuntimeController.getRuntimeSnapshot);

module.exports = router;
