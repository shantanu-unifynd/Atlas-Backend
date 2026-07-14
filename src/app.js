const express = require("express");
const cors = require("cors");
const buildingRoutes = require("./modules/building/routes/building.routes");
const floorRoutes = require("./modules/floor/routes/floor.routes");
const assetRoutes = require("./modules/asset/routes/asset.routes");
const blueprintRoutes = require("./modules/spatial/blueprint/routes/blueprint.routes");
const objectRoutes = require("./modules/spatial/object/routes/object.routes");
const graphRoutes = require("./modules/spatial/graph/routes/graph.routes");
const errorHandler = require("./common/middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/buildings", buildingRoutes);
app.use("/api/buildings/:buildingId/floors", floorRoutes);
app.use("/api/floors/:floorId/assets", assetRoutes);
app.use("/api/floors/:floorId/blueprint", blueprintRoutes);
app.use("/api/blueprints/:blueprintId/objects", objectRoutes.nestedRouter);
app.use("/api/objects", objectRoutes.standaloneRouter);
app.use("/api/blueprints/:blueprintId/graph", graphRoutes);

app.use(errorHandler);

module.exports = app;