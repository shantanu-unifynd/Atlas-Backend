const express = require("express");
const objectController = require("../controllers/object.controller");

const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.post("/", objectController.createObject);
nestedRouter.get("/", objectController.getObjectsByBlueprint);

const standaloneRouter = express.Router();
standaloneRouter.get("/:objectId", objectController.getObjectById);

module.exports = {
  nestedRouter,
  standaloneRouter,
};
