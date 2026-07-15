const express = require("express");
const geometryController = require("../controllers/geometry.controller");

const router = express.Router({ mergeParams: true });

router.post("/geometry", geometryController.extractGeometry);
router.get("/geometry", geometryController.getGeometryModel);
router.post("/geometry/candidates", geometryController.generateCandidates);

module.exports = router;
