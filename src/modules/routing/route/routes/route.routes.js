const express = require("express");
const routeController = require("../controllers/route.controller");

const router = express.Router();

router.post("/", routeController.createRoute);
router.get("/", routeController.getRoutes);
router.get("/:id", routeController.getRouteById);
router.delete("/:id", routeController.deleteRoute);

module.exports = router;
