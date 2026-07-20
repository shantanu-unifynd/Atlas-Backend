const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Stage 4 — Repository Stage. Persists edges and updates the graph's
// statistics in a single transaction. Lifecycle stays GENERATING — edge
// generation is one sub-stage of graph generation; Story 05 (Graph
// Validation) owns the VALIDATING/READY transition.
async function persistEdges(graphId, edges, statistics, tx) {
  if (edges.length > 0) {
    await navigationEdgeRepository.createMany(edges, tx);
  }

  const updatedGraph = await navigationGraphRepository.update(
    graphId,
    { status: "GENERATING", statistics },
    tx
  );

  return updatedGraph;
}

module.exports = { persistEdges };
