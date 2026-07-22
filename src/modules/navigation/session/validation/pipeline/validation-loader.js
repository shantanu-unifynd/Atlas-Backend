const navigationSessionRepository = require("../../../../../repositories/navigationSession/navigationSession.repository");
const sessionProgressService = require("../../progress/service/sessionProgress.service");
const eventEngine = require("../../events/pipeline/event-engine");
const eventResponseBuilder = require("../../events/pipeline/response-builder");

// Stage 1 — Loader. Loads NavigationSession and reuses Story 02's
// lifecycle state, Story 03's Progress Engine, and Story 04's Event
// Engine completely unchanged — this story never recomputes progress or
// events itself, only validates what they already produced.
//
// Deliberately calls Story 04's pure event-engine.js/response-builder.js
// (Stages 2 and 4) directly rather than its full service — Story 04's own
// service re-invokes Story 03's computeProgress() internally, and since
// that call advances Story 03's in-memory segment counter, calling both
// services independently would advance the counter TWICE per /validate
// call and desynchronize `progress` from `events` (each describing a
// different segment). Calling the same progress object into Story 04's
// unchanged pure stages keeps exactly one advancement per call and
// guarantees progress/events describe the identical segment.
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

async function loadValidationContext(sessionId) {
  const session = await navigationSessionRepository.findById(sessionId);

  if (!session) {
    throw notFoundError("Navigation Session not found");
  }

  if (session.state !== "ACTIVE") {
    throw conflictError(`Navigation Session is not ACTIVE (current state: '${session.state}')`);
  }

  const progress = await sessionProgressService.computeProgress(sessionId);

  const generatedAt = new Date().toISOString();
  const events = eventEngine.generateEvents(session, progress, generatedAt);
  const eventsResult = eventResponseBuilder.build(events, generatedAt);

  return { session, progress, eventsResult };
}

module.exports = { loadValidationContext };
