const navigationSessionRepository = require("../../../../../repositories/navigationSession/navigationSession.repository");
const routeRepository = require("../../../../../repositories/route/route.repository");
const routeSegmentRepository = require("../../../../../repositories/routeSegment/routeSegment.repository");
const routeStatisticsRepository = require("../../../../../repositories/routeStatistics/routeStatistics.repository");

// Stage 1 — Loader. Read-only: loads NavigationSession, Route,
// RouteSegments, RouteStatistics. No writes — this story never mutates
// any of them. Rejects a session that isn't ACTIVE (409) and a route with
// zero segments (400), mirroring the precondition-check pattern used by
// every prior pipeline loader in this project.
function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function loadProgressContext(sessionId) {
  const session = await navigationSessionRepository.findById(sessionId);

  if (!session) {
    throw notFoundError("Navigation Session not found");
  }

  if (session.state !== "ACTIVE") {
    throw conflictError(`Navigation Session is not ACTIVE (current state: '${session.state}')`);
  }

  const route = await routeRepository.findById(session.routeId);

  if (!route) {
    throw notFoundError("Route not found");
  }

  const segments = await routeSegmentRepository.findAllByRouteId(session.routeId);

  if (segments.length === 0) {
    throw validationError("Route contains zero segments");
  }

  const statistics = await routeStatisticsRepository.findByRouteId(session.routeId);

  return { session, route, segments, statistics };
}

module.exports = { loadProgressContext };
