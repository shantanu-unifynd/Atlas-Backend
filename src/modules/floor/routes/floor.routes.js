const express = require("express");
const floorController = require("../controllers/floor.controller");

const router = express.Router({ mergeParams: true });

router.post("/", floorController.createFloor);
router.get("/", floorController.getFloors);
router.get("/:floorId", floorController.getFloorById);
router.delete("/:floorId", floorController.deleteFloor);

module.exports = router;
