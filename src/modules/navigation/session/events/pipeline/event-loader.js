const navigationSessionRepository = require("../../../../../repositories/navigationSession/navigationSession.repository");
const sessionProgressService = require("../../progress/service/sessionProgress.service");

// Stage 1 — Loader. Loads NavigationSession and reuses Story 03's Progress
// Engine completely unchanged (sessionProgressService.computeProgress) to
// obtain Route/RouteSegments/RouteStatistics-derived progress — this story
// never recomputes segment/node/cost progress itself.
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

async function loadEventContext(sessionId) {
  const session = await navigationSessionRepository.findById(sessionId);

  if (!session) {
    throw notFoundError("Navigation Session not found");
  }

  if (session.state !== "ACTIVE") {
    throw conflictError(`Navigation Session is not ACTIVE (current state: '${session.state}')`);
  }

  const progress = await sessionProgressService.computeProgress(sessionId);

  return { session, progress };
}

module.exports = { loadEventContext };
