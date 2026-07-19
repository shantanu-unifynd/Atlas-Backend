// Merges node-generation statistics into the graph's existing statistics
// JSON (populated by Story 02 Phase A's candidate detection) rather than
// replacing it — candidateCount and the candidate-level breakdown are
// carried forward unchanged.
function buildStatistics(existingStatistics, nodes) {
  const countByType = (nodeType) => nodes.filter((node) => node.nodeType === nodeType).length;

  return {
    ...existingStatistics,
    candidateCount: existingStatistics.candidateCount ?? nodes.length,
    nodeCount: nodes.length,
    roomEntryNodes: countByType("ROOM_ENTRY"),
    corridorIntersectionNodes: countByType("CORRIDOR_INTERSECTION"),
    deadEndNodes: countByType("DEAD_END"),
    verticalConnectorNodes: countByType("VERTICAL_CONNECTOR"),
    buildingEntryNodes: countByType("BUILDING_ENTRY"),
  };
}

module.exports = { buildStatistics };
