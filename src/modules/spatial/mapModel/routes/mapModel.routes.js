const express = require("express");
const mapModelController = require("../controllers/mapModel.controller");

const router = express.Router({ mergeParams: true });

router.post("/generate", mapModelController.generateMapModel);
router.get("/", mapModelController.getMapModel);

// Sprint 07A — publish the latest MPM version (GENERATED -> PUBLISHED).
router.post("/publish", mapModelController.publishMapModel);

// MPM-05 — manual room overrides (persisted separately; merged on generation).
router.get("/rooms", mapModelController.listRoomOverrides);
router.post("/rooms", mapModelController.createRoomOverride);
router.patch("/rooms/:overrideId", mapModelController.updateRoomOverride);
router.delete("/rooms/:overrideId", mapModelController.deleteRoomOverride);

module.exports = router;
