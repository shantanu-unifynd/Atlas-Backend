// Stage 2 — Semantic Validator.
// Structural validation only — does this USO Model exist, is accessibility
// data present, are there duplicate/invalid references. No classification
// of any kind happens here.

function validateSemanticInput(loaded, existingSemanticModelUsoIds) {
  const warnings = [];
  const errors = [];

  if (!loaded.usos || loaded.usos.length === 0) {
    const error = new Error(`No USOs found for USO Model '${loaded.usoModelId}'`);
    error.statusCode = 404;
    throw error;
  }

  if (loaded.relationships.length === 0) {
    warnings.push("No relationships found for this USO Model");
  }

  const existingIds = new Set(existingSemanticModelUsoIds);
  const seenUsoIds = new Set();
  const validUsos = [];

  for (const uso of loaded.usos) {
    if (!uso.id) {
      errors.push("Encountered a USO with a missing id; skipped");
      continue;
    }

    if (seenUsoIds.has(uso.id)) {
      errors.push(`Duplicate USO reference '${uso.id}' in USO Model; skipped`);
      continue;
    }
    seenUsoIds.add(uso.id);

    if (!uso.accessibility || typeof uso.accessibility !== "object") {
      errors.push(`USO '${uso.id}' is missing accessibility data; skipped`);
      continue;
    }

    if (existingIds.has(uso.id)) {
      errors.push(`USO '${uso.id}' already has a Semantic Model (duplicate semantic identity); skipped`);
      continue;
    }

    validUsos.push(uso);
  }

  return { usoModelId: loaded.usoModelId, usos: validUsos, relationshipsByUsoId: loaded.relationshipsByUsoId, warnings, errors };
}

module.exports = {
  validateSemanticInput,
};
