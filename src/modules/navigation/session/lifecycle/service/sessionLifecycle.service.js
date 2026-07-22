const loader = require("../pipeline/loader");
const transitionValidator = require("../pipeline/transition-validator");
const transitionEngine = require("../pipeline/transition-engine");
const repositoryStage = require("../pipeline/repository-stage");

// Sprint 09 Story 02 — Session Lifecycle Engine. Orchestration only: load
// -> validate -> resolve -> persist. No progress, no events, no
// positioning, no writes to Route/NavigationGraph/RoutingContext.

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function performTransition(id, requestedTransition) {
  const session = await loader.loadSession(id);

  const { valid, error } = transitionValidator.validateTransition(session.state, requestedTransition);

  if (!valid) {
    throw validationError(error);
  }

  const nextState = transitionEngine.computeNextState(requestedTransition);
  const updated = await repositoryStage.persistState(id, nextState);

  return {
    id: updated.id,
    state: updated.state,
    updatedAt: updated.updatedAt,
  };
}

module.exports = { performTransition };
