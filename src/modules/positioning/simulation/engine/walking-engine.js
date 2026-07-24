// Stage 2 — Walking Engine. Owns ALL simulation-step logic: no Prisma, no
// repositories. Determines the current simulation index, advances exactly
// one logical step per call, never moves backwards, clamps at the
// destination, deterministic progression (no Math.random, no random
// coordinates, no current-timestamp influence on the step itself).
//
// The in-memory step map is deliberately isolated inside this module only
// — it never leaks into Runtime, Progress, or NavigationSession. It is
// conceptually similar to (but architecturally distinct from) Sprint 09's
// removed progress counter: THAT counter simulated RUNTIME PROGRESS
// directly, which Sprint 10 Story 03 correctly forbade. THIS one simulates
// realistic PHYSICAL MOVEMENT for the Mock Position Provider only — the
// Runtime never sees it and independently re-derives progress from
// whatever position this engine reports, via its own unchanged Story 03
// node/segment resolvers.
//
// Returns the CURRENT step (the one to report THIS call) and advances the
// stored value for the NEXT call — so the very first call for a session
// reflects the starting position (step 0, at the route's origin), not an
// already-advanced one.
const stepBySourceId = new Map();

function advanceStep(sourceId, totalSegments) {
  const currentStep = stepBySourceId.get(sourceId) || 0;
  const nextStep = Math.min(currentStep + 1, totalSegments);

  stepBySourceId.set(sourceId, nextStep);

  return currentStep;
}

module.exports = { advanceStep };
