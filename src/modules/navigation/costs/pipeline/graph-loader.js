const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");

// Stage 1 — Graph Loader. Loads the NavigationGraph and its Nodes/Edges;
// never mutates anything. Only a graph that has passed Sprint 06 Story 05
// validation (status READY) with at least one edge is eligible for cost
// assignment.
async function loadGraphForCosting(graphId) {
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

  const nodes = await navigationNodeRepository.findAllByGraphId(graphId);
  const edges = await navigationEdgeRepository.findAllByGraphId(graphId);

  if (edges.length === 0) {
    const error = new Error("Navigation Graph contains zero edges");
    error.statusCode = 400;
    throw error;
  }

  return { graph, nodes, edges };
}

module.exports = { loadGraphForCosting };
