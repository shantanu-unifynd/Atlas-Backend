// Stage 2 — Transition Validator. Pure function: no Prisma, no HTTP.
// Validates ONLY whether the requested transition is legal from the
// session's current state — never resolves the resulting state (that is
// Stage 3's job) and never touches the database.
//
// This is the legality half of the state machine: which actions are
// permitted FROM which current states. Deliberately a separate table from
// Stage 3's action -> resulting-state table (they answer different
// questions), so neither stage duplicates or depends on the other.
const ALLOWED_FROM_STATES = {
  START: ["CREATED", "READY"],
  PAUSE: ["ACTIVE"],
  RESUME: ["PAUSED"],
  CANCEL: ["ACTIVE", "PAUSED"],
  COMPLETE: ["ACTIVE"],
};

function validateTransition(currentState, requestedTransition) {
  const allowedFrom = ALLOWED_FROM_STATES[requestedTransition];

  if (!allowedFrom) {
    return { valid: false, error: `Unknown transition '${requestedTransition}'` };
  }

  if (!allowedFrom.includes(currentState)) {
    return {
      valid: false,
      error: `Cannot perform '${requestedTransition}' on a session in state '${currentState}'`,
    };
  }

  return { valid: true };
}

module.exports = { validateTransition, ALLOWED_FROM_STATES };
