// Sprint 10 Story 04 — Origin Progress Builder. NOT a modification of
// Sprint 09's Progress Engine, Story 03's progress-integration.js, or
// Sprint 09's progress-validator.js — all three remain byte-for-byte
// untouched, per this story's explicit instruction.
//
// This exists because those protected files have a latent gap only Story
// 04 exposes: progress-engine.js computes
// `orderedSegments[completedCount - 1]` for `currentSegment`, which is
// `orderedSegments[-1]` (undefined) when completedCount is exactly 0 —
// i.e. standing at the Route's origin, having walked zero segments.
// Sprint 09's own calling convention never produced completedCount === 0
// in practice (its simulation always incremented by at least one before
// this point was ever reached), so this state was never truly exercised.
// Sprint 09's progress-validator.js also unconditionally requires
// `currentSegment` to exist, which is incompatible with a legitimate
// "not yet started" state.
//
// Rather than modifying any of those three protected files, this helper
// correctly evaluates the SAME progress formula those files already use
// (visible in progress-engine.js) for the one boundary value they cannot
// handle, and the calling services skip re-validating it through
// progress-validator.js for this one case only — every other
// completedSegmentCount (>= 1) still flows through the unchanged engine
// and validator exactly as before.
function buildOriginProgress(route, segments, statistics) {
  const orderedSegments = [...segments].sort((a, b) => a.sequence - b.sequence);
  const totalSegments = orderedSegments.length;

  const totalCost =
    statistics && statistics.statistics && typeof statistics.statistics.totalCost === "number"
      ? statistics.statistics.totalCost
      : 0;
  const costPerSegment = totalSegments > 0 ? totalCost / totalSegments : 0;

  return {
    completedSegmentCount: 0,
    currentSegment: null,
    currentNode: route.originNodeId,
    visitedNodes: [route.originNodeId],
    remainingSegments: totalSegments,
    remainingCost: costPerSegment * totalSegments,
    remainingDistance: costPerSegment * totalSegments,
    progressPercentage: 0,
    completed: false,
  };
}

module.exports = { buildOriginProgress };
