const progressEngine = require("../../../navigation/session/progress/pipeline/progress-engine");

// Stage 4 — Progress Integration. Reuses Sprint 09 Story 03's Progress
// Engine completely unchanged — not one line of progress-engine.js is
// touched by this story.
//
// That engine's `completedSegmentCount` parameter is, by its own existing
// (unchanged) internal arithmetic, always advanced by exactly one before
// use (`Math.min(completedSegmentCount + 1, total)`) — a leftover of
// Sprint 09's "advance one segment per call" simulation. To make the
// engine's OUTPUT equal the Position-resolved completed count exactly,
// this adapter passes (positionDerivedCompletedCount - 1) as input, so
// the engine's own built-in +1 lands on the correct value. This is the
// only way to reuse the engine's exact existing arithmetic without
// modifying it.
function integrateProgress(session, route, segments, statistics, positionDerivedCompletedCount) {
  return progressEngine.computeProgress(
    session,
    route,
    segments,
    statistics,
    positionDerivedCompletedCount - 1
  );
}

module.exports = { integrateProgress };
