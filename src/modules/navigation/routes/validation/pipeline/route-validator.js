const COST_EPSILON = 1e-9;

// Stage 2 — Route Validator. Pure, read-only: given everything Stage 1
// loaded, returns every structural defect found. Never computes another
// route, never modifies RouteSegments/NavigationGraph — this only reports.
function validateRoute({ route, segments, statistics, nodes, edges }) {
  const errors = [];

  if (segments.length === 0) {
    errors.push("Route has no segments");
    return errors;
  }

  // Rule 10 — no self-loop segments.
  for (const segment of segments) {
    if (segment.sourceNodeId === segment.targetNodeId) {
      errors.push(`Segment ${segment.id} is a self-loop on node ${segment.sourceNodeId}`);
    }
  }

  // Rule 3 — segment ordering: begins at 1, no gaps, no duplicates.
  const sequences = segments.map((segment) => segment.sequence).sort((a, b) => a - b);
  const seenSequences = new Set();

  for (const segment of segments) {
    if (seenSequences.has(segment.sequence)) {
      errors.push(`Duplicate segment sequence number ${segment.sequence}`);
    }

    seenSequences.add(segment.sequence);
  }

  for (let i = 0; i < sequences.length; i += 1) {
    if (sequences[i] !== i + 1) {
      errors.push("Segment sequence numbers are not continuous starting at 1");
      break;
    }
  }

  const ordered = [...segments].sort((a, b) => a.sequence - b.sequence);

  // Rule 5 — endpoints.
  if (ordered[0].sourceNodeId !== route.originNodeId) {
    errors.push("First segment does not start at the route's origin node");
  }

  if (ordered[ordered.length - 1].targetNodeId !== route.destinationNodeId) {
    errors.push("Last segment does not end at the route's destination node");
  }

  // Rule 4 — chain continuity.
  for (let i = 0; i < ordered.length - 1; i += 1) {
    if (ordered[i].targetNodeId !== ordered[i + 1].sourceNodeId) {
      errors.push(
        `Segment chain is discontinuous between sequence ${ordered[i].sequence} and ${ordered[i + 1].sequence}`
      );
    }
  }

  // Rule 9 — graph consistency: every segment node belongs to this graph.
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const segment of segments) {
    if (!nodeIds.has(segment.sourceNodeId)) {
      errors.push(`Segment ${segment.id} source node does not belong to this Navigation Graph`);
    }

    if (!nodeIds.has(segment.targetNodeId)) {
      errors.push(`Segment ${segment.id} target node does not belong to this Navigation Graph`);
    }
  }

  // Rule 6 — every segment must correspond to a real NavigationEdge, and
  // Rule 7 — cost consistency (sum of those real edge costs).
  const edgeCostByPair = new Map();

  for (const edge of edges) {
    edgeCostByPair.set(`${edge.sourceNodeId}->${edge.targetNodeId}`, edge.traversalCost);
  }

  let recalculatedCost = 0;

  for (const segment of segments) {
    const key = `${segment.sourceNodeId}->${segment.targetNodeId}`;
    const edgeCost = edgeCostByPair.get(key);

    if (edgeCost === undefined) {
      errors.push(
        `Segment ${segment.id} has no corresponding NavigationEdge (${segment.sourceNodeId} -> ${segment.targetNodeId})`
      );
      continue;
    }

    recalculatedCost += edgeCost;
  }

  const statedTotalCost = statistics?.statistics?.totalCost;

  if (typeof statedTotalCost !== "number" || Number.isNaN(statedTotalCost)) {
    errors.push("RouteStatistics.totalCost is missing or not a valid number");
  } else if (Math.abs(recalculatedCost - statedTotalCost) > COST_EPSILON) {
    errors.push(
      `Recalculated cost (${recalculatedCost}) does not match RouteStatistics.totalCost (${statedTotalCost})`
    );
  }

  // Rule 8 — statistics consistency: segment count matches totalSegments.
  const statedTotalSegments = statistics?.statistics?.totalSegments;

  if (statedTotalSegments !== segments.length) {
    errors.push(
      `Segment count (${segments.length}) does not match RouteStatistics.totalSegments (${statedTotalSegments})`
    );
  }

  return errors;
}

module.exports = { validateRoute };
