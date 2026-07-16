const express = require("express");
const semanticController = require("../controllers/semantic.controller");

const router = express.Router({ mergeParams: true });

router.post("/generate-semantics", semanticController.generateSemantics);
router.get("/semantics", semanticController.getSemantics);

module.exports = router;
