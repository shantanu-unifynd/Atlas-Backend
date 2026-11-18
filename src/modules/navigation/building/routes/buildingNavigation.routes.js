const express = require("express");
const buildingNavigationController = require("../controllers/buildingNavigation.controller");

// Mounted at /api/buildings/:buildingId/navigation (mergeParams carries
// :buildingId down from the mount path).
const router = express.Router({ mergeParams: true });

router.get("/", buildingNavigationController.getBuildingNavigation);
router.post("/route", buildingNavigationController.computeBuildingRoute);

module.exports = router;
