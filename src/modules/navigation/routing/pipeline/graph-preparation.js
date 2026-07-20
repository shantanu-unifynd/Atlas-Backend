// Stage 2 — Graph Preparation. Pure transformation, no persistence: turns
// loaded NavigationNodes/NavigationEdges into a generic directed, weighted
// adjacency list — Node -> [{ neighborId, cost, edgeId }]. The algorithm
// stage never sees NavigationNode/NavigationEdge shapes again after this,
// only this generic structure (per the architectural principle that
// routing must understand only Nodes/Edges/Cost).
function buildAdjacencyList(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    adjacency.get(edge.sourceNodeId).push({
      neighborId: edge.targetNodeId,
      cost: edge.traversalCost,
      edgeId: edge.id,
    });
  }

  return adjacency;
}

module.exports = { buildAdjacencyList };
