const DEFAULT_TRAVERSAL_COST = 1.0;

// Stage 2 — Cost Calculator. Deliberately trivial and constant: every
// traversable edge receives the same cost. No branching, no heuristics, no
// inspection of semantic categories, node types, or edge types. Distance,
// accessibility, congestion, and preference-based costs are explicitly
// future-story boundaries (see route-optimization.md).
function calculateCosts(edges) {
  return edges.map((edge) => ({
    edgeId: edge.id,
    traversalCost: DEFAULT_TRAVERSAL_COST,
  }));
}

module.exports = { calculateCosts };
