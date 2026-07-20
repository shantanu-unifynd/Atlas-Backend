const routeRepository = require("../../../../../repositories/route/route.repository");
const routeSegmentRepository = require("../../../../../repositories/routeSegment/routeSegment.repository");
const routeStatisticsRepository = require("../../../../../repositories/routeStatistics/routeStatistics.repository");
const navigationGraphRepository = require("../../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../../repositories/navigationNode/navigationNode.repository");
const navigationEdgeRepository = require("../../../../../repositories/navigationEdge/navigationEdge.repository");

// Stage 1 — Route Loader. Loads the Route and everything needed to
// validate it — never mutates anything.
async function loadRouteForValidation(routeId) {
  const route = await routeRepository.findById(routeId);

  if (!route) {
    const error = new Error("Route not found");
    error.statusCode = 404;
    throw error;
  }

  // GENERATING means Story 04's build never finished — nothing to validate
  // yet. READY and FAILED are both valid inputs: a previously FAILED route
  // must be re-validatable once its underlying data is fixed.
  if (route.status === "GENERATING") {
    const error = new Error("Route has not finished building yet");
    error.statusCode = 409;
    throw error;
  }

  const segments = await routeSegmentRepository.findAllByRouteId(routeId);
  const statistics = await routeStatisticsRepository.findByRouteId(routeId);
  const graph = await navigationGraphRepository.findById(route.graphId);
  const nodes = await navigationNodeRepository.findAllByGraphId(route.graphId);
  const edges = await navigationEdgeRepository.findAllByGraphId(route.graphId);

  return { route, segments, statistics, graph, nodes, edges };
}

module.exports = { loadRouteForValidation };
