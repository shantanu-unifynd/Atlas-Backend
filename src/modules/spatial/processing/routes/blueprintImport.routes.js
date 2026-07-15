const express = require("express");
const upload = require("../middlewares/upload.middleware");
const blueprintImportController = require("../controllers/blueprintImport.controller");

const router = express.Router({ mergeParams: true });

router.post("/", upload.single("file"), blueprintImportController.importBlueprint);
router.get("/", blueprintImportController.getImports);
router.get("/:importId", blueprintImportController.getImportById);

module.exports = router;
