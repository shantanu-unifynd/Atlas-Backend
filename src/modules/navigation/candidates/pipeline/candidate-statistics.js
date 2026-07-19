function buildStatistics(totalSemanticObjects, detections) {
  const countByType = (candidateType) =>
    detections.filter((detection) => detection.candidateType === candidateType).length;

  return {
    totalSemanticObjects,
    candidateCount: detections.length,
    roomEntries: countByType("ROOM_ENTRY"),
    corridorIntersections: countByType("CORRIDOR_INTERSECTION"),
    deadEnds: countByType("DEAD_END"),
    verticalConnectors: countByType("VERTICAL_CONNECTOR"),
    buildingEntries: countByType("BUILDING_ENTRY"),
  };
}

module.exports = { buildStatistics };
