const express = require("express");
const navigationEdgeController = require("../controllers/navigationEdge.controller");

const router = express.Router({ mergeParams: true });

router.post("/", navigationEdgeController.generateEdges);
router.get("/", navigationEdgeController.getEdges);

module.exports = router;
