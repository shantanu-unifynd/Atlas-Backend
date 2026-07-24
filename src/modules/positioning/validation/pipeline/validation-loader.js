const navigationSessionRepository = require("../../../../repositories/navigationSession/navigationSession.repository");
const positionRuntimeService = require("../../runtime/services/positionRuntime.service");
const eventEngine = require("../../../navigation/session/events/pipeline/event-engine");
const eventResponseBuilder = require("../../../navigation/session/events/pipeline/response-builder");

// Stage 1 — Validation Loader. Reuses Sprint 10 Story 03's full Runtime
// Snapshot service completely unchanged (which itself reuses Story 02's
// Position Provider and Story 04's Walking Engine unchanged) — this story
// never reimplements Runtime or the Walking Engine, and never duplicates
// Position Provider logic.
//
// Calls getRuntimeSnapshot() exactly ONCE per validation, then derives
// events by calling Sprint 09 Story 04's PURE event-engine.js directly
// against that SAME progress object — never navigationEventService's full
// service, which would independently re-invoke the Position Provider a
// second time. Since Sprint 10 Story 04 made the Mock provider a stateful
// Walking Engine, two independent provider calls per request would
// advance the walk by two steps instead of one, producing a Runtime
// snapshot and an Events list describing two different positions — the
// exact inconsistency this story's own "cross-module consistency" rule
// exists to catch. One snapshot, one advancement, one consistent state.
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

  let runtimeSnapshot = null;
  let runtimeError = null;

  try {
    runtimeSnapshot = await positionRuntimeService.getRuntimeSnapshot(sessionId);
  } catch (error) {
    if (error.statusCode === 400) {
      // A broken Positioning Runtime (nearest node/segment cannot be
      // resolved, position outside graph, etc.) is exactly what this
      // validation story exists to report — surfaced as a finding, not
      // an HTTP failure that would prevent the validation response
      // itself from returning.
      runtimeError = error.message;
    } else {
      throw error;
    }
  }

  if (!runtimeSnapshot) {
    return { session, runtimeSnapshot: null, runtimeError, eventsResult: null };
  }

  const progressForEvents = {
    sessionId: runtimeSnapshot.sessionId,
    routeId: runtimeSnapshot.routeId,
    ...runtimeSnapshot.progress,
  };

  const generatedAt = new Date().toISOString();
  const events = eventEngine.generateEvents(session, progressForEvents, generatedAt);
  const eventsResult = eventResponseBuilder.build(events, generatedAt);

  return { session, runtimeSnapshot, runtimeError: null, eventsResult };
}

module.exports = { loadValidationContext };
