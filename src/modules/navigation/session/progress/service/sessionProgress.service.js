const progressLoader = require("../pipeline/progress-loader");
const progressEngine = require("../pipeline/progress-engine");
const progressValidator = require("../pipeline/progress-validator");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 09 Story 03 — Route Progress Engine. Orchestration only: load ->
// compute -> validate -> respond. No writes to NavigationSession, Route,
// RouteSegment, RouteStatistics, NavigationGraph, or NavigationNode/Edge —
// every stage above is read-only or pure.
//
// `segmentProgressBySessionId` is the ONE piece of state this story needs
// ("advance exactly one segment per invocation") that has no legal home
// in the persisted schema (NavigationSession must not be modified; no new
// table is permitted). It is deliberately process-local, in-memory only —
// never written to Postgres, so it does not appear in, and cannot violate,
// the zero-mutation PostgreSQL verification. It is NOT durable (lost on
// restart, not shared across multiple server instances) — an explicit,
// documented limitation acceptable for Sprint 09's simulated movement.
// Sprint 10 replaces this entirely: a real Position Provider reports
// actual position on every request, and this counter disappears without
// any change to the pure engine/validator/response-builder stages.
const segmentProgressBySessionId = new Map();

function internalError(message) {
  const error = new Error(message);
  return error;
}

async function computeProgress(sessionId) {
  const { session, route, segments, statistics } = await progressLoader.loadProgressContext(sessionId);

  const previousCompletedCount = segmentProgressBySessionId.get(sessionId) || 0;

  const progress = progressEngine.computeProgress(
    session,
    route,
    segments,
    statistics,
    previousCompletedCount
  );

  const { errors } = progressValidator.validate(route, segments, statistics, progress);

  if (errors.length > 0) {
    throw internalError(`Route Progress Engine produced invalid output: ${errors.join(", ")}`);
  }

  segmentProgressBySessionId.set(sessionId, progress.completedSegmentCount);

  return responseBuilder.build(sessionId, route.id, progress);
}

module.exports = { computeProgress };
