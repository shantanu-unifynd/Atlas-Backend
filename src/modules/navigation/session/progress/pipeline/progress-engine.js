// Stage 2 — Progress Engine. Pure: no Prisma, no repositories, no HTTP.
// Deterministic simulated movement: given the same (route, segments,
// statistics, completedSegmentCount), always produces the same output.
// `completedSegmentCount` is the one input beyond the documented
// {session, route, segments, statistics} tuple — it is resolved by the
// service layer from a non-persistent, in-memory counter (see
// sessionProgress.service.js), never from Prisma, so this stage remains a
// pure function of its arguments.
//
// No real per-segment cost/distance exists anywhere in the schema
// (RouteSegment carries no cost column, and NavigationEdge.length is never
// populated by any existing pipeline stage). Rather than inventing a
// number, remainingCost is derived from RouteStatistics.totalCost split
// evenly across segments — a real, persisted aggregate. remainingDistance
// mirrors remainingCost until a future story populates real edge lengths.
function computeProgress(session, route, segments, statistics, completedSegmentCount) {
  const orderedSegments = [...segments].sort((a, b) => a.sequence - b.sequence);
  const totalSegments = orderedSegments.length;

  const completedCount = Math.min(completedSegmentCount + 1, totalSegments);

  const totalCost =
    statistics && statistics.statistics && typeof statistics.statistics.totalCost === "number"
      ? statistics.statistics.totalCost
      : 0;
  const costPerSegment = totalSegments > 0 ? totalCost / totalSegments : 0;

  const remainingSegments = totalSegments - completedCount;
  const remainingCost = costPerSegment * remainingSegments;
  const remainingDistance = remainingCost;

  const progressPercentage = (completedCount / totalSegments) * 100;
  const completed = completedCount >= totalSegments;

  const currentSegment = orderedSegments[completedCount - 1];
  const currentNode = completedCount === 0 ? route.originNodeId : currentSegment.targetNodeId;

  const visitedNodes = [
    route.originNodeId,
    ...orderedSegments.slice(0, completedCount).map((segment) => segment.targetNodeId),
  ];

  return {
    completedSegmentCount: completedCount,
    currentSegment,
    currentNode,
    visitedNodes,
    remainingSegments,
    remainingCost,
    remainingDistance,
    progressPercentage,
    completed,
  };
}

module.exports = { computeProgress };
