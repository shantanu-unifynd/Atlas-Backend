// Computes read-only structural statistics from the loaded nodes/edges.
// Node degree uses outgoing-edge count only, matching Story 04's
// convention: every undirected connection already yields exactly one
// outgoing edge per endpoint (bidirectional pairs), so counting outgoing
// edges avoids double-counting. Connected components are computed over the
// undirected adjacency implied by those same edges.
function buildStatistics(nodes, edges) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const outgoingDegreeByNodeId = new Map(nodes.map((node) => [node.id, 0]));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));

  for (const edge of edges) {
    if (nodeIds.has(edge.sourceNodeId)) {
      outgoingDegreeByNodeId.set(
        edge.sourceNodeId,
        (outgoingDegreeByNodeId.get(edge.sourceNodeId) || 0) + 1
      );
    }

    if (nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)) {
      adjacency.get(edge.sourceNodeId).add(edge.targetNodeId);
      adjacency.get(edge.targetNodeId).add(edge.sourceNodeId);
    }
  }

  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  const degrees = [...outgoingDegreeByNodeId.values()];
  const totalDegree = degrees.reduce((sum, degree) => sum + degree, 0);
  const averageNodeDegree = totalNodes > 0 ? totalDegree / totalNodes : 0;
  const isolatedNodeCount = degrees.filter((degree) => degree === 0).length;

  const visited = new Set();
  let connectedComponentCount = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    connectedComponentCount += 1;
    const stack = [node.id];
    visited.add(node.id);

    while (stack.length > 0) {
      const current = stack.pop();

      for (const neighbor of adjacency.get(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
  }

  return {
    totalNodes,
    totalEdges,
    isolatedNodeCount,
    connectedComponentCount,
    averageNodeDegree,
  };
}

module.exports = { buildStatistics };
