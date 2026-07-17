const express = require("express");
const navigationGraphController = require("../controllers/navigationGraph.controller");

const router = express.Router();

router.post("/", navigationGraphController.createNavigationGraph);
router.get("/", navigationGraphController.getNavigationGraphs);
router.get("/:id", navigationGraphController.getNavigationGraphById);
router.delete("/:id", navigationGraphController.deleteNavigationGraph);

module.exports = router;
