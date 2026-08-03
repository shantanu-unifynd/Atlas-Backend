const express = require("express");
const navigationEdgeController = require("../controllers/navigationEdge.controller");

const router = express.Router({ mergeParams: true });

router.post("/", navigationEdgeController.generateEdges);
router.post("/manual", navigationEdgeController.createManualEdge);
router.post("/auto-connect", navigationEdgeController.autoConnect);
router.get("/", navigationEdgeController.getEdges);
router.delete("/:edgeId", navigationEdgeController.deleteManualEdge);

module.exports = router;
