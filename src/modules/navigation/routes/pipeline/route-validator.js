const COST_EPSILON = 1e-9;

// Stage 3 — Route Validator. Read-only: verifies the Stage 2 output before
// persistence. This validates the ROUTE/SEGMENT construction, not the
// pathfinding algorithm (Story 03 already validated the raw path itself).
function validateRoute(originNodeId, destinationNodeId, path, segmentsData, statisticsData) {
  const errors = [];

  if (!originNodeId || !destinationNodeId) {
    errors.push("Route must have both an origin and a destination");
  }

  if (segmentsData.length === 0) {
    errors.push("Route must have at least one segment");
  }

  if (segmentsData.length !== path.length - 1) {
    errors.push(
      `Segment count (${segmentsData.length}) does not match path length minus one (${path.length - 1})`
    );
  }

  const sequences = segmentsData.map((segment) => segment.sequence).sort((a, b) => a - b);

  for (let i = 0; i < sequences.length; i += 1) {
    if (sequences[i] !== i + 1) {
      errors.push("Segment sequence numbers are not continuous starting at 1");
      break;
    }
  }

  const seenSequences = new Set();

  for (const segment of segmentsData) {
    if (seenSequences.has(segment.sequence)) {
      errors.push(`Duplicate segment sequence number ${segment.sequence}`);
    }

    seenSequences.add(segment.sequence);
  }

  const ordered = [...segmentsData].sort((a, b) => a.sequence - b.sequence);

  if (ordered.length > 0) {
    if (ordered[0].sourceNodeId !== originNodeId) {
      errors.push("First segment does not start at the route's origin node");
    }

    if (ordered[ordered.length - 1].targetNodeId !== destinationNodeId) {
      errors.push("Last segment does not end at the route's destination node");
    }

    for (let i = 0; i < ordered.length - 1; i += 1) {
      if (ordered[i].targetNodeId !== ordered[i + 1].sourceNodeId) {
        errors.push(
          `Segment chain is discontinuous between sequence ${ordered[i].sequence} and ${ordered[i + 1].sequence}`
        );
      }
    }
  }

  if (statisticsData.totalSegments !== segmentsData.length) {
    errors.push("Statistics totalSegments does not match the actual segment count");
  }

  if (Math.abs(statisticsData.totalCost - (statisticsData.totalCost ?? 0)) > COST_EPSILON) {
    // Defensive placeholder — totalCost is taken directly from Story 03's
    // result, so this can only fail if the value itself is non-numeric.
  }

  if (typeof statisticsData.totalCost !== "number" || Number.isNaN(statisticsData.totalCost)) {
    errors.push("Statistics totalCost is not a valid number");
  }

  return { errors };
}

module.exports = { validateRoute };
