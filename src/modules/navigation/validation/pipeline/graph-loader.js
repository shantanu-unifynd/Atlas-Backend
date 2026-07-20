const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");

// Stage 1 — Graph Loader. Loads the NavigationGraph and its NavigationNodes
// and NavigationEdges only — never inspects Geometry or Blueprint data.
// `statistics.edgeCount` (always written by Story 04's edge generation,
// even when 0) is the reliable "has edge generation run yet" signal — row
// count alone can't distinguish "not run" from "ran and legitimately
// produced zero edges".
async function loadGraphForValidation(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  if (graph.statistics?.edgeCount === undefined) {
    const error = new Error("Navigation edges have not been generated for this graph yet");
    error.statusCode = 409;
    throw error;
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(graphId);
  const edges = await navigationEdgeRepository.findAllByGraphId(graphId);

  return { graph, nodes, edges };
}

module.exports = { loadGraphForValidation };
