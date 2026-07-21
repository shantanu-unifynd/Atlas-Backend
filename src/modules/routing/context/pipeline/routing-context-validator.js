const VALID_PREFERENCES = ["SHORTEST", "FASTEST", "ACCESSIBLE", "AVOID_STAIRS", "PREFER_ELEVATORS"];

// Stage 2 — Validator. Validates request integrity only — graph existence
// (checked by the loader), presence of required fields, and that the
// requested preference is one of the five defined values. Never validates
// routes, costs, policies, the Navigation Graph itself, or Dijkstra input
// — none of that exists yet at this stage of the pipeline.
function validateCreateRequest(data) {
  const errors = [];

  if (!data.graphId) {
    errors.push("graphId is required");
  }

  if (!data.preference) {
    errors.push("preference is required");
  } else if (!VALID_PREFERENCES.includes(data.preference)) {
    errors.push(
      `preference must be one of: ${VALID_PREFERENCES.join(", ")} (received '${data.preference}')`
    );
  }

  return { errors };
}

module.exports = { validateCreateRequest, VALID_PREFERENCES };
