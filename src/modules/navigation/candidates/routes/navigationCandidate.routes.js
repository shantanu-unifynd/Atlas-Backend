const express = require("express");
const navigationCandidateController = require("../controllers/navigationCandidate.controller");

const router = express.Router({ mergeParams: true });

router.post("/", navigationCandidateController.generateCandidates);
router.get("/", navigationCandidateController.getCandidates);

module.exports = router;
