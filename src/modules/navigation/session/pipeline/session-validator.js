// Stage 2 — Validator. Validates request integrity only — presence of
// routeId (existence is checked by the loader). Never validates lifecycle
// transitions, progress, or events — none of that exists yet at this
// stage of the pipeline, and `state` is deliberately not an accepted
// input: every NavigationSession is created at the DB default (CREATED),
// exactly as Route's own `status` is never accepted at Route creation.
function validateCreateRequest(data) {
  const errors = [];

  if (!data.routeId) {
    errors.push("routeId is required");
  }

  return { errors };
}

module.exports = { validateCreateRequest };
