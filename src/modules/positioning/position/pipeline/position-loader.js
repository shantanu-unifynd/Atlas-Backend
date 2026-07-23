const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Stage 1 — Loader. Loads the NavigationGraph a Position would belong to.
// No positioning logic, no provider logic, no movement — this story only
// needs to confirm the graph exists.
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
