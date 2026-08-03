const express = require("express");
const navigationNodeController = require("../controllers/navigationNode.controller");

const router = express.Router({ mergeParams: true });

router.post("/", navigationNodeController.generateNodes);
router.post("/manual", navigationNodeController.createManualNode);
router.post("/import-from-labels", navigationNodeController.importFromLabels);
router.get("/", navigationNodeController.getNodes);
router.patch("/:nodeId", navigationNodeController.updateManualNode);
router.delete("/:nodeId", navigationNodeController.deleteManualNode);

module.exports = router;
