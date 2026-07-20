const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

// Stage 1 — Graph Loader. Loads the NavigationGraph and its Nodes/Edges and
// validates every routing precondition before any traversal is attempted.
// Read-only — never mutates anything the Navigation Graph pipeline owns.
async function loadGraphForRouting(graphId, originNodeId, destinationNodeId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  if (graph.status !== "READY") {
    const error = new Error("Navigation Graph is not READY");
    error.statusCode = 409;
    throw error;
  }

  if (!originNodeId) {
    throw badRequest("originNodeId is required");
  }

  if (!destinationNodeId) {
    throw badRequest("destinationNodeId is required");
  }

  if (originNodeId === destinationNodeId) {
    throw badRequest("Origin and Destination must not be the same node");
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(graphId);
  const edges = await navigationEdgeRepository.findAllByGraphId(graphId);

  const nodeIds = new Set(nodes.map((node) => node.id));

  if (!nodeIds.has(originNodeId)) {
    throw badRequest("Origin node not found in this graph");
  }

  if (!nodeIds.has(destinationNodeId)) {
    throw badRequest("Destination node not found in this graph");
  }

  return { graph, nodes, edges };
}

module.exports = { loadGraphForRouting };
