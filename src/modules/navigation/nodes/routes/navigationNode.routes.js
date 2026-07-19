const express = require("express");
const navigationNodeController = require("../controllers/navigationNode.controller");

const router = express.Router({ mergeParams: true });

router.post("/", navigationNodeController.generateNodes);
router.get("/", navigationNodeController.getNodes);

module.exports = router;
