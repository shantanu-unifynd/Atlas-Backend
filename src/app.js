const express = require("express");
const cors = require("cors");
const buildingRoutes = require("./modules/building/routes/building.routes");
const floorRoutes = require("./modules/floor/routes/floor.routes");
const assetRoutes = require("./modules/asset/routes/asset.routes");
const blueprintRoutes = require("./modules/spatial/blueprint/routes/blueprint.routes");
const objectRoutes = require("./modules/spatial/object/routes/object.routes");
const graphRoutes = require("./modules/spatial/graph/routes/graph.routes");
const blueprintImportRoutes = require("./modules/spatial/processing/routes/blueprintImport.routes");
const normalizationRoutes = require("./modules/spatial/normalization/routes/normalization.routes");
const geometryRoutes = require("./modules/spatial/processing/geometry/routes/geometry.routes");
const usoRoutes = require("./modules/spatial/uso/routes/uso.routes");
const semanticRoutes = require("./modules/spatial/semantic/routes/semantic.routes");
const navigationGraphRoutes = require("./modules/navigation/graph/routes/navigationGraph.routes");
const navigationCandidateRoutes = require("./modules/navigation/candidates/routes/navigationCandidate.routes");
const navigationNodeRoutes = require("./modules/navigation/nodes/routes/navigationNode.routes");
const navigationEdgeRoutes = require("./modules/navigation/edges/routes/navigationEdge.routes");
const graphValidationRoutes = require("./modules/navigation/validation/routes/graphValidation.routes");
const routeRoutes = require("./modules/routing/route/routes/route.routes");
const costModelRoutes = require("./modules/navigation/costs/routes/costModel.routes");
const routingRoutes = require("./modules/navigation/routing/routes/routing.routes");
const routeBuilderRoutes = require("./modules/navigation/routes/routes/routeBuilder.routes");
const routeValidationRoutes = require("./modules/navigation/routes/validation/routes/routeValidation.routes");
const routingContextRoutes = require("./modules/routing/context/routes/routingContext.routes");
const costPolicyRoutes = require("./modules/routing/costPolicy/routes/costPolicy.routes");
const preferenceRoutingRoutes = require("./modules/routing/preferenceRouting/routes/preferenceRouting.routes");
const comparisonRoutes = require("./modules/routing/comparison/routes/comparison.routes");
const routingValidationRoutes = require("./modules/routing/validation/routes/routingValidation.routes");
const navigationSessionRoutes = require("./modules/navigation/session/routes/navigationSession.routes");
const sessionLifecycleRoutes = require("./modules/navigation/session/lifecycle/routes/sessionLifecycle.routes");
const sessionProgressRoutes = require("./modules/navigation/session/progress/routes/sessionProgress.routes");
const navigationEventRoutes = require("./modules/navigation/session/events/routes/navigationEvent.routes");
const navigationSessionValidationRoutes = require("./modules/navigation/session/validation/routes/navigationSessionValidation.routes");
const healthRoutes = require("./modules/health/routes/health.routes");
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
app.use(
  "/api/buildings/:buildingId/floors/:floorId/blueprint-imports",
  blueprintImportRoutes
);
app.use(
  "/api/buildings/:buildingId/floors/:floorId/blueprint-imports/:importId",
  normalizationRoutes
);
app.use(
  "/api/buildings/:buildingId/floors/:floorId/blueprint-imports/:importId",
  geometryRoutes
);
app.use("/api/geometry/:geometryId", usoRoutes);
app.use("/api/usos/:usoModelId", semanticRoutes);
app.use("/api/navigation-graphs", navigationGraphRoutes);
app.use("/api/navigation-graphs/:graphId/candidates", navigationCandidateRoutes);
app.use("/api/navigation-graphs/:graphId/nodes", navigationNodeRoutes);
app.use("/api/navigation-graphs/:graphId/edges", navigationEdgeRoutes);
app.use("/api/navigation-graphs/:graphId", graphValidationRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/routes", routeBuilderRoutes);
app.use("/api/routes", routeValidationRoutes);
app.use("/api/navigation-graphs/:graphId/costs", costModelRoutes);
app.use("/api/navigation-graphs/:graphId/routes", routingRoutes);
app.use("/api/routing-contexts", routingContextRoutes);
app.use("/api/routing-contexts/:contextId/costs", costPolicyRoutes);
app.use("/api/routing-contexts/:contextId/route", preferenceRoutingRoutes);
app.use("/api/routing", comparisonRoutes);
app.use("/api/routing", routingValidationRoutes);
app.use("/api/navigation-sessions", navigationSessionRoutes);
app.use("/api/navigation-sessions", sessionLifecycleRoutes);
app.use("/api/navigation-sessions", sessionProgressRoutes);
app.use("/api/navigation-sessions", navigationEventRoutes);
app.use("/api/navigation-sessions", navigationSessionValidationRoutes);
app.use("/health", healthRoutes);

app.use(errorHandler);

module.exports = app;