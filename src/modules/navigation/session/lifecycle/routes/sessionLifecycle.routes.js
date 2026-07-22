const express = require("express");
const sessionLifecycleController = require("../controller/sessionLifecycle.controller");

const router = express.Router();

router.post("/:id/start", sessionLifecycleController.start);
router.post("/:id/pause", sessionLifecycleController.pause);
router.post("/:id/resume", sessionLifecycleController.resume);
router.post("/:id/cancel", sessionLifecycleController.cancel);
router.post("/:id/complete", sessionLifecycleController.complete);

module.exports = router;
