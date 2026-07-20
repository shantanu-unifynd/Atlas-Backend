// Merges edge-generation statistics into the graph's existing statistics
// JSON (populated by Story 02/03) rather than replacing it. Node degree is
// computed from outgoing edges only — since every undirected connection
// produces exactly one A->B edge plus its B->A mirror, counting outgoing
// edges per node yields the correct (non-doubled) undirected degree.
function buildStatistics(existingStatistics, nodes, edges) {
  const outgoingDegreeByNodeId = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    outgoingDegreeByNodeId.set(
      edge.sourceNodeId,
      (outgoingDegreeByNodeId.get(edge.sourceNodeId) || 0) + 1
    );
  }

  const degrees = [...outgoingDegreeByNodeId.values()];
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const totalDegree = degrees.reduce((sum, degree) => sum + degree, 0);
  const averageNodeDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
  const isolatedNodeCount = degrees.filter((degree) => degree === 0).length;

  return {
    ...existingStatistics,
    nodeCount,
    edgeCount,
    averageNodeDegree,
    isolatedNodeCount,
  };
}

module.exports = { buildStatistics };
