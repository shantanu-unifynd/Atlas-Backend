const VALID_CANDIDATE_TYPES = [
  "ROOM_ENTRY",
  "CORRIDOR_INTERSECTION",
  "DEAD_END",
  "VERTICAL_CONNECTOR",
  "BUILDING_ENTRY",
];

// Stage 3 — Candidate Validation. Validates the pipeline's own input and
// output shape before persistence; this is NOT graph validation (Story 05)
// — no connectivity, routing, or graph-wide checks belong here.
function validateInput(semanticModels) {
  const warnings = [];
  const errors = [];

  if (semanticModels.length === 0) {
    warnings.push("No Semantic Objects found in this Navigation Graph's building/floor scope");
  }

  for (const semanticModel of semanticModels) {
    if (!semanticModel.uso) {
      errors.push(`Semantic Model ${semanticModel.id} has no associated Universal Spatial Object`);
    }
  }

  return { warnings, errors };
}

function validateDetections(detections) {
  const warnings = [];
  const errors = [];

  const seenSemanticModelIds = new Set();

  for (const detection of detections) {
    if (!VALID_CANDIDATE_TYPES.includes(detection.candidateType)) {
      errors.push(`Unknown candidate type '${detection.candidateType}'`);
    }

    if (seenSemanticModelIds.has(detection.semanticModelId)) {
      errors.push(`Duplicate candidate detected for Semantic Model ${detection.semanticModelId}`);
    }

    seenSemanticModelIds.add(detection.semanticModelId);
  }

  if (detections.length === 0) {
    warnings.push("No navigation candidates were detected for this Navigation Graph");
  }

  return { warnings, errors };
}

module.exports = {
  validateInput,
  validateDetections,
};
