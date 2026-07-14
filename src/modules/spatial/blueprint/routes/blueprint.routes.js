const express = require("express");
const blueprintController = require("../controllers/blueprint.controller");

const router = express.Router({ mergeParams: true });

router.post("/", blueprintController.createBlueprint);
router.get("/", blueprintController.getBlueprint);

module.exports = router;
