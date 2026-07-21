const express = require("express");
const comparisonController = require("../controllers/comparison.controller");

const router = express.Router();

router.post("/compare", comparisonController.compareRoutes);

module.exports = router;
