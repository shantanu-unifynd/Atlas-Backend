const express = require("express");
const usoController = require("../controllers/uso.controller");

const router = express.Router({ mergeParams: true });

router.post("/generate-usos", usoController.generateUsos);
router.get("/usos", usoController.getUsos);

module.exports = router;
