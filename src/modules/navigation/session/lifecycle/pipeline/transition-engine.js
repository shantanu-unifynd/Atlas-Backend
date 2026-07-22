// Stage 3 — Transition Engine. Pure function: no database, no writes.
// Converts a requested action into its resulting NavigationSessionState —
// e.g. START conceptually passes CREATED through READY on its way to
// ACTIVE, but only the final state is ever persisted (Stage 4 writes
// exactly one field, once). Deliberately independent of Stage 2's
// legality table: by the time this runs, legality has already been
// confirmed, so this stage only answers "what state does this action
// produce," never "is this allowed right now."
function computeNextState(requestedTransition) {
  switch (requestedTransition) {
    case "START":
      // CREATED|READY -> READY -> ACTIVE (single persisted hop to ACTIVE)
      return "ACTIVE";
    case "PAUSE":
      return "PAUSED";
    case "RESUME":
      return "ACTIVE";
    case "CANCEL":
      return "CANCELLED";
    case "COMPLETE":
      return "COMPLETED";
    default:
      return null;
  }
}

module.exports = { computeNextState };
