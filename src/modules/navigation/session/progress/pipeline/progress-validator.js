const COST_EPSILON = 1e-9;

// Stage 3 — Validator. Pure function: no Prisma, no writes. Validates the
// Progress Engine's own output against Route/RouteSegments/RouteStatistics
// — defense in depth, exactly like every previous sprint's pure validator
// stage.
function validate(route, segments, statistics, progress) {
  const errors = [];

  const orderedSegments = [...segments].sort((a, b) => a.sequence - b.sequence);
  const totalSegments = orderedSegments.length;

  // Rule — route continuity preserved (segments themselves chain
  // correctly, independent of how far progress has advanced).
  if (orderedSegments[0].sourceNodeId !== route.originNodeId) {
    errors.push("First segment does not begin at the Route's origin node");
  }

  if (orderedSegments[totalSegments - 1].targetNodeId !== route.destinationNodeId) {
    errors.push("Last segment does not end at the Route's destination node");
  }

  for (let i = 0; i < totalSegments - 1; i += 1) {
    if (orderedSegments[i].targetNodeId !== orderedSegments[i + 1].sourceNodeId) {
      errors.push(`Route continuity broken between segment ${i + 1} and segment ${i + 2}`);
    }
  }

  // Rule — current segment exists.
  if (!progress.currentSegment) {
    errors.push("Current segment does not exist");
  }

  // Rule — current node belongs to route.
  const routeNodeIds = new Set([
    route.originNodeId,
    route.destinationNodeId,
    ...orderedSegments.map((segment) => segment.sourceNodeId),
    ...orderedSegments.map((segment) => segment.targetNodeId),
  ]);

  if (!routeNodeIds.has(progress.currentNode)) {
    errors.push(`Current node '${progress.currentNode}' does not belong to the Route`);
  }

  // Rule — visited nodes are continuous, and route origin anchoring.
  if (progress.visitedNodes[0] !== route.originNodeId) {
    errors.push("Visited nodes do not begin at the Route's origin node");
  }

  for (let i = 0; i < progress.visitedNodes.length - 1; i += 1) {
    const expectedNext = orderedSegments[i] ? orderedSegments[i].targetNodeId : undefined;

    if (progress.visitedNodes[i + 1] !== expectedNext) {
      errors.push(`Visited nodes are not continuous at position ${i + 1}`);
    }
  }

  // Rule — no duplicate visited nodes.
  const uniqueVisited = new Set(progress.visitedNodes);

  if (uniqueVisited.size !== progress.visitedNodes.length) {
    errors.push("Visited nodes contain duplicates");
  }

  // Rule — remaining segments are correct.
  const expectedRemainingSegments = totalSegments - progress.completedSegmentCount;

  if (progress.remainingSegments !== expectedRemainingSegments) {
    errors.push(
      `remainingSegments (${progress.remainingSegments}) does not match expected value (${expectedRemainingSegments})`
    );
  }

  // Rule — remaining cost equals remaining segment costs. Re-derives the
  // expected value independently from RouteStatistics (the same source
  // the engine used) rather than trusting the engine's own arithmetic.
  const totalCost =
    statistics && statistics.statistics && typeof statistics.statistics.totalCost === "number"
      ? statistics.statistics.totalCost
      : 0;
  const costPerSegment = totalSegments > 0 ? totalCost / totalSegments : 0;
  const expectedRemainingCost = costPerSegment * expectedRemainingSegments;

  if (Math.abs(progress.remainingCost - expectedRemainingCost) > COST_EPSILON) {
    errors.push(
      `remainingCost (${progress.remainingCost}) does not match expected value (${expectedRemainingCost})`
    );
  }

  // Rule — progress percentage is between 0 and 100.
  if (progress.progressPercentage < 0 || progress.progressPercentage > 100) {
    errors.push(`progressPercentage (${progress.progressPercentage}) is out of range [0, 100]`);
  }

  // Rule — completed routes report 100%.
  if (progress.completed && Math.abs(progress.progressPercentage - 100) > COST_EPSILON) {
    errors.push(`Completed route does not report 100% progress (got ${progress.progressPercentage})`);
  }

  if (!progress.completed && Math.abs(progress.progressPercentage - 100) < COST_EPSILON) {
    errors.push("Route reports 100% progress but is not marked completed");
  }

  return { errors };
}

module.exports = { validate };
