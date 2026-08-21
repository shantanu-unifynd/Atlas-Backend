const express = require("express");
const geometryController = require("../controllers/geometry.controller");

const router = express.Router({ mergeParams: true });

router.post("/geometry", geometryController.extractGeometry);
router.get("/geometry", geometryController.getGeometryModel);
router.post("/geometry/candidates", geometryController.generateCandidates);
// BXP-09 — explicit, separate action. Requires the same buildingId/floorId/
// importId path targeting as every other route here; no generic "force"
// flag on the normal generate route above, and generateCandidates' one-shot
// guard is completely untouched.
router.post("/geometry/candidates/regenerate", geometryController.regenerateCandidates);

module.exports = router;
