const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const routingContextRepository = require("../../../../repositories/routingContext/routingContext.repository");

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

// Stage 1 — Loader. Loads the NavigationGraph and every supplied
// RoutingContext, validating everything up front before Stage 2 delegates
// to Story 03 N times. Read-only.
async function load(graphId, originNodeId, destinationNodeId, routingContextIds) {
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

  if (!originNodeId) {
    throw validationError("originNodeId is required");
  }

  if (!destinationNodeId) {
    throw validationError("destinationNodeId is required");
  }

  if (!Array.isArray(routingContextIds) || routingContextIds.length === 0) {
    throw validationError("routingContextIds must be a non-empty array");
  }

  const uniqueIds = new Set(routingContextIds);

  if (uniqueIds.size !== routingContextIds.length) {
    throw validationError("routingContextIds must not contain duplicate IDs");
  }

  const routingContexts = [];

  for (const contextId of routingContextIds) {
    const routingContext = await routingContextRepository.findById(contextId);

    if (!routingContext) {
      throw notFoundError(`Routing Context ${contextId} not found`);
    }

    if (routingContext.graphId !== graphId) {
      throw validationError(`Routing Context ${contextId} belongs to a different Navigation Graph`);
    }

    routingContexts.push(routingContext);
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(graphId);
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (!nodeIds.has(originNodeId)) {
    throw validationError("Origin node not found in this graph");
  }

  if (!nodeIds.has(destinationNodeId)) {
    throw validationError("Destination node not found in this graph");
  }

  return { graph, routingContexts };
}

module.exports = { load };
