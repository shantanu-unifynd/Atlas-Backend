const validationLoader = require("../pipeline/validation-loader");
const runtimeValidator = require("../pipeline/runtime-validator");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 10 Story 05 — Positioning Runtime Validation. Orchestration
// only: load -> validate -> build response. Nothing is stored, nothing is
// published — every stage is read-only or pure. Business validation
// findings always surface inside errors[]/warnings[] with HTTP 200 —
// only request-level failures (missing session, wrong lifecycle state)
// use HTTP status codes.
async function validatePositioning(sessionId) {
  const { session, runtimeSnapshot, runtimeError, eventsResult } = await validationLoader.loadValidationContext(
    sessionId
  );

  const { errors, warnings, statistics } = runtimeValidator.validate(
    session,
    runtimeSnapshot,
    runtimeError,
    eventsResult
  );

  return responseBuilder.build(errors, warnings, statistics);
}

module.exports = { validatePositioning };
