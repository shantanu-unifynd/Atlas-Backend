const eventLoader = require("../pipeline/event-loader");
const eventEngine = require("../pipeline/event-engine");
const eventValidator = require("../pipeline/event-validator");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 09 Story 04 — Navigation Event Engine. Orchestration only: load
// -> generate events -> validate -> build response. Nothing is stored,
// nothing is published — every stage is read-only or pure.
function internalError(message) {
  return new Error(message);
}

async function generateSessionEvents(sessionId) {
  const { session, progress } = await eventLoader.loadEventContext(sessionId);

  const generatedAt = new Date().toISOString();
  const events = eventEngine.generateEvents(session, progress, generatedAt);

  const { errors } = eventValidator.validate(events, progress, session);

  if (errors.length > 0) {
    throw internalError(`Navigation Event Engine produced invalid output: ${errors.join(", ")}`);
  }

  return responseBuilder.build(events, generatedAt);
}

module.exports = { generateSessionEvents };
