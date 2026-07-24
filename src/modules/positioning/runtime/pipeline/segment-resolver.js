// Stage 3 — Segment Resolver. Pure: given the nearest resolved Node,
// determines the current Route Segment. No progress percentages, no
// remaining distance — those belong to Stage 4 (Progress Integration).
//
// Mirrors Sprint 09 Story 03's own existing semantics exactly (so its
// unchanged Progress Engine arithmetic lines up): the "current segment" is
// the segment whose TARGET is the nearest node — reaching a node means the
// segment leading to it is complete. Standing at the Route's origin (no
// segment targets it yet) means zero segments completed, which is valid,
// not an error. A node that doesn't belong to this route's segment chain
// at all means the segment genuinely cannot be resolved.
function resolveCurrentSegment(nearestNodeId, route, segments) {
  const orderedSegments = [...segments].sort((a, b) => a.sequence - b.sequence);

  if (nearestNodeId === route.originNodeId) {
    return { segment: null, completedSegmentCount: 0 };
  }

  const matchedSegment = orderedSegments.find((segment) => segment.targetNodeId === nearestNodeId);

  if (!matchedSegment) {
    return { segment: null, completedSegmentCount: null };
  }

  return { segment: matchedSegment, completedSegmentCount: matchedSegment.sequence };
}

module.exports = { resolveCurrentSegment };
