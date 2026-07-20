const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const routingService = require("../../routing/services/routing.service");

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

// Stage 1 — Route Loader. Validates every precondition, then delegates the
// actual path computation to Story 03's routing service UNCHANGED — this
// file never reimplements Dijkstra or touches adjacency/graph-traversal
// logic itself. No persistence happens here.
async function loadAndComputeRoute(graphId, originNodeId, destinationNodeId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  if (graph.status !== "READY") {
    throw conflictError("Navigation Graph is not READY");
  }

  const originNode = originNodeId ? await navigationNodeRepository.findById(originNodeId) : null;

  if (!originNode) {
    throw notFoundError("Origin node not found");
  }

  const destinationNode = destinationNodeId
    ? await navigationNodeRepository.findById(destinationNodeId)
    : null;

  if (!destinationNode) {
    throw notFoundError("Destination node not found");
  }

  if (originNode.graphId !== graphId || destinationNode.graphId !== graphId) {
    throw validationError("Origin/Destination node does not belong to this Navigation Graph");
  }

  if (originNodeId === destinationNodeId) {
    throw validationError("Origin and Destination must not be the same node");
  }

  // Story 03's engine throws its own 404 "No route exists..." if the
  // destination is unreachable — propagated as-is, not re-wrapped.
  const result = await routingService.computeShortestPath(graphId, originNodeId, destinationNodeId);

  return { graph, result };
}

module.exports = { loadAndComputeRoute };
