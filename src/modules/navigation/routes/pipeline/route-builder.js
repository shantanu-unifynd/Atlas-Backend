// Stage 2 — Route Builder. Pure, in-memory transformation of Story 03's
// algorithm output ({path, totalCost}) into the shapes the Route domain
// (Story 01) persists. No persistence, no reimplementation of pathfinding
// — the path itself is taken verbatim from the Dijkstra result.
function buildRoute(graphId, originNodeId, destinationNodeId, dijkstraResult) {
  const { path, totalCost, algorithm, computedAt } = dijkstraResult;

  const routeData = {
    graphId,
    originNodeId,
    destinationNodeId,
    metadata: {},
  };

  const segmentsData = [];

  for (let i = 0; i < path.length - 1; i += 1) {
    segmentsData.push({
      sourceNodeId: path[i],
      targetNodeId: path[i + 1],
      sequence: i + 1,
      metadata: { algorithm },
    });
  }

  const statisticsData = {
    totalSegments: segmentsData.length,
    totalCost,
    algorithm,
    computedAt,
  };

  return { routeData, segmentsData, statisticsData };
}

module.exports = { buildRoute };
