const express = require("express");
const upload = require("../middlewares/upload.middleware");
const assetController = require("../controllers/asset.controller");

const router = express.Router({ mergeParams: true });

router.post("/", upload.single("file"), assetController.uploadAsset);

module.exports = router;
