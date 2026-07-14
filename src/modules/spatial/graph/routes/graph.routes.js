const express = require("express");
const graphController = require("../controllers/graph.controller");

const router = express.Router({ mergeParams: true });

router.post("/", graphController.createGraph);
router.get("/", graphController.getGraph);

module.exports = router;
