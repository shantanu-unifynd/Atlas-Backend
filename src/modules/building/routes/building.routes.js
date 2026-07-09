const express = require("express");
const buildingController = require("../controllers/building.controller");

const router = express.Router();

router.post("/", buildingController.createBuilding);
router.get("/", buildingController.getBuildings);
router.get("/:id", buildingController.getBuildingById);

module.exports = router;
