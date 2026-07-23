const express = require("express");
const positionController = require("../controllers/position.controller");

const router = express.Router();

router.post("/", positionController.createPosition);
router.get("/", positionController.getPositions);
router.get("/:id", positionController.getPositionById);
router.delete("/:id", positionController.deletePosition);

module.exports = router;
