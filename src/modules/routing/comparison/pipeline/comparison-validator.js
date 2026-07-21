// Stage 3 — Comparison Validator. Only validates comparison-result
// consistency — never re-validates the graph or the Dijkstra algorithm
// itself (both already validated/executed upstream). Duplicate-preference
// detection is deliberately NOT here — it's a caller-correctable request
// issue (400), handled separately in the service, rather than an internal
// invariant violation (these checks are "shouldn't happen given correct
// upstream logic" defensive checks, matching Sprint 06/07 precedent).
function validate(comparisons, originNodeId, destinationNodeId) {
  const errors = [];

  for (const entry of comparisons) {
    if (!entry.preference) {
      errors.push(`Comparison entry for context ${entry.routingContextId} is missing preference`);
    }

    if (!Array.isArray(entry.path) || entry.path.length === 0) {
      errors.push(`Comparison entry for context ${entry.routingContextId} is missing a path`);
    }

    if (typeof entry.totalCost !== "number" || Number.isNaN(entry.totalCost) || !Number.isFinite(entry.totalCost)) {
      errors.push(`Comparison entry for context ${entry.routingContextId} has an invalid totalCost`);
    }

    if (Array.isArray(entry.path) && entry.path.length > 0) {
      if (entry.path[0] !== originNodeId) {
        errors.push(`Route for context ${entry.routingContextId} does not begin at the origin node`);
      }

      if (entry.path[entry.path.length - 1] !== destinationNodeId) {
        errors.push(`Route for context ${entry.routingContextId} does not end at the destination node`);
      }

      if (entry.hopCount !== entry.path.length - 1) {
        errors.push(`Route for context ${entry.routingContextId} has an inconsistent hopCount`);
      }
    }
  }

  return { errors };
}

module.exports = { validate };
