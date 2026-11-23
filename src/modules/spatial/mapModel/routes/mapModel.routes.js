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
// "Remove room" (soft-delete + undo). Flag-gated in the controller (404 when off).
// `removed` is registered before the :overrideId routes so it is not shadowed.
router.get("/rooms/removed", mapModelController.listRemovedRooms);
router.get("/rooms/:roomId/contained", mapModelController.listContainedRooms);
router.post("/rooms/:roomId/remove-contained", mapModelController.removeContainedRooms);
router.post("/rooms/:roomId/remove", mapModelController.removeRoom);
router.post("/rooms/:roomId/restore", mapModelController.restoreRoom);
router.patch("/rooms/:overrideId", mapModelController.updateRoomOverride);
router.delete("/rooms/:overrideId", mapModelController.deleteRoomOverride);

module.exports = router;
