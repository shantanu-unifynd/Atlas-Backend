// Stage 2 — Provider Engine. Calls the loaded provider and validates
// both the request and the provider's response shape. No database, no
// runtime, no movement, no progress — this stage never queries Postgres,
// mirroring the provider contract itself.
function validateRequest(request) {
  const errors = [];

  if (!request.graphId) {
    errors.push("graphId is required");
  }

  return { errors };
}

function validatePositionShape(position) {
  const errors = [];

  if (!position || typeof position !== "object") {
    errors.push("Provider returned a malformed position");
    return { errors };
  }

  if (!position.graphId) {
    errors.push("Provider response is missing graphId");
  }

  if (!position.source) {
    errors.push("Provider response is missing source");
  }

  if (
    !position.coordinates ||
    typeof position.coordinates !== "object" ||
    Array.isArray(position.coordinates) ||
    Object.keys(position.coordinates).length === 0
  ) {
    errors.push("Provider response is missing valid coordinates");
  }

  if (!position.recordedAt) {
    errors.push("Provider response is missing recordedAt");
  }

  return { errors };
}

async function callProvider(provider, request) {
  return provider.getCurrentPosition(request);
}

module.exports = { validateRequest, validatePositionShape, callProvider };
