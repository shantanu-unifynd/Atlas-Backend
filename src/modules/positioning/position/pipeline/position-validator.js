// Stage 2 — Validator. Validates request integrity only — graph existence
// (checked by the loader), presence of required fields. Never validates
// runtime consistency, provider behavior, movement, or routing — none of
// that exists yet at this stage of the pipeline (those are Stories 02-05).
function validateCreateRequest(data) {
  const errors = [];

  if (!data.graphId) {
    errors.push("graphId is required");
  }

  if (!data.source) {
    errors.push("source is required");
  }

  if (
    data.coordinates === undefined ||
    data.coordinates === null ||
    typeof data.coordinates !== "object" ||
    Array.isArray(data.coordinates) ||
    Object.keys(data.coordinates).length === 0
  ) {
    errors.push("coordinates is required and must be a non-empty object");
  }

  return { errors };
}

module.exports = { validateCreateRequest };
