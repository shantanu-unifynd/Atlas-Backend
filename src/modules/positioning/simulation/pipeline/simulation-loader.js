const progressLoader = require("../../../navigation/session/progress/pipeline/progress-loader");

// Stage 1 — Simulation Loader. Reuses Sprint 09 Story 03's loader
// completely unchanged for NavigationSession/Route/RouteSegments (same
// 404/409/400 preconditions: missing session, not ACTIVE, zero segments)
// — no loading logic duplicated here. Read-only: no writes.
function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function loadSimulationContext(sessionId) {
  const { session, route, segments } = await progressLoader.loadProgressContext(sessionId);

  if (!route.originNodeId || !route.destinationNodeId || segments.length === 0) {
    throw validationError("Simulation cannot resolve this route");
  }

  return { session, route, segments };
}

module.exports = { loadSimulationContext };
