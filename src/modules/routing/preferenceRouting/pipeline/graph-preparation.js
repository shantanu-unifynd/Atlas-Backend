const { buildAdjacencyList } = require("../../../navigation/routing/pipeline/graph-preparation");

// Stage 3 — Graph Preparation. Reuses Sprint 07 Story 03's
// buildAdjacencyList UNCHANGED — that function reads edge.traversalCost,
// so this stage's only job is to hand it synthetic edge objects whose
// traversalCost IS the effective cost. No adjacency-building logic is
// duplicated; only the cost source is substituted.
function prepareGraph(nodes, edges, effectiveCosts) {
  const effectiveCostByEdgeId = new Map(
    effectiveCosts.map((entry) => [entry.edgeId, entry.effectiveCost])
  );

  const effectiveEdges = edges.map((edge) => ({
    ...edge,
    traversalCost: effectiveCostByEdgeId.get(edge.id),
  }));

  return buildAdjacencyList(nodes, effectiveEdges);
}

module.exports = { prepareGraph };
