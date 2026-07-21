const express = require("express");
const routingContextController = require("../controllers/routingContext.controller");

const router = express.Router();

router.post("/", routingContextController.createRoutingContext);
router.get("/", routingContextController.getRoutingContexts);
router.get("/:id", routingContextController.getRoutingContextById);
router.delete("/:id", routingContextController.deleteRoutingContext);

module.exports = router;
