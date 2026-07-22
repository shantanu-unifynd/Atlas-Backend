const validationLoader = require("../pipeline/validation-loader");
const runtimeValidator = require("../pipeline/runtime-validator");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 09 Story 05 — Session Validation. Orchestration only: load ->
// validate -> build response. Nothing is stored, nothing is published —
// every stage is read-only or pure. Business validation findings always
// surface inside errors[]/warnings[] with HTTP 200 — only request-level
// failures (missing session, wrong lifecycle state) use HTTP status codes.
async function validateSession(sessionId) {
  const { session, progress, eventsResult } = await validationLoader.loadValidationContext(sessionId);

  const { errors, warnings, statistics } = runtimeValidator.validate(session, progress, eventsResult);

  return responseBuilder.build(errors, warnings, statistics);
}

module.exports = { validateSession };
