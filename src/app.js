const express = require("express");
const cors = require("cors");
const buildingRoutes = require("./features/building/routes/building.routes");
const errorHandler = require("./common/middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/buildings", buildingRoutes);

app.use(errorHandler);

module.exports = app;