const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const routingContextRepository = require("../../../../repositories/routingContext/routingContext.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

// Stage 1 — Loader. Loads the NavigationGraph, RoutingContext, and
// NavigationEdges the Policy Engine needs — never mutates anything, never
// touches Route/RouteSegment/RouteStatistics/NavigationNode at all.
async function load(graphId, contextId) {
  if (!graphId) {
    throw validationError("graphId is required");
  }

  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  if (graph.status !== "READY") {
    throw conflictError("Navigation Graph is not READY");
  }

  const routingContext = await routingContextRepository.findById(contextId);

  if (!routingContext) {
    throw notFoundError("Routing Context not found");
  }

  if (routingContext.graphId !== graphId) {
    throw validationError("Routing Context belongs to a different Navigation Graph");
  }

  const edges = await navigationEdgeRepository.findAllByGraphId(graphId);

  return { graph, routingContext, edges };
}

module.exports = { load };
