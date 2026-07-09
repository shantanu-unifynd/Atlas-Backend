const express = require("express");
const cors = require("cors");
const buildingRoutes = require("./modules/building/routes/building.routes");
const floorRoutes = require("./modules/floor/routes/floor.routes");
const errorHandler = require("./common/middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/buildings", buildingRoutes);
app.use("/api/buildings/:buildingId/floors", floorRoutes);

app.use(errorHandler);

module.exports = app;