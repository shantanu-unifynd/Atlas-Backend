const express = require("express");
const routingController = require("../controllers/routing.controller");

const router = express.Router({ mergeParams: true });

router.post("/compute", routingController.computeShortestPath);

module.exports = router;
