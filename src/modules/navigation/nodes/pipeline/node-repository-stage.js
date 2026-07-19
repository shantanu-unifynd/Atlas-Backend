const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Stage 4 — Repository Stage. Persists nodes and updates the graph's
// statistics in a single transaction: either both persist or neither does.
// Lifecycle stays GENERATING — node generation is one sub-stage of graph
// generation, not a terminal state (Story 05 owns the VALIDATING/READY
// transition).
async function persistNodes(graphId, nodes, statistics, tx) {
  if (nodes.length > 0) {
    await navigationNodeRepository.createMany(nodes, tx);
  }

  const updatedGraph = await navigationGraphRepository.update(
    graphId,
    { status: "GENERATING", statistics },
    tx
  );

  return updatedGraph;
}

module.exports = { persistNodes };
