const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Stage 1 — Loader. Loads the NavigationGraph a RoutingContext would
// belong to. No routing logic, no cost/policy/Dijkstra inspection — this
// story only needs to confirm the graph exists.
async function loadGraph(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  return { graph };
}

module.exports = { loadGraph };
