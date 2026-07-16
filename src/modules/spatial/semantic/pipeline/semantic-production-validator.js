// Production Validator — Phase C.
// Runs after persistence, over what was actually written, checking
// referential integrity: orphan Semantic Models (usoId not part of this
// batch), duplicate semantic identities, invalid lifecycle values, invalid
// confidence values. Every issue becomes a warning or an error — nothing is
// silently ignored. Deliberately does NOT transition lifecycle state:
// "do not implement automatic transitions beyond initial creation."

const VALID_LIFECYCLE_STATES = ["GENERATED", "VALIDATED", "PUBLISHED", "DEPRECATED"];

function validateSemanticProduction({ usos, semanticModels }) {
  const warnings = [];
  const errors = [];

  const usoIds = new Set(usos.map((uso) => uso.id));
  const seenUsoIds = new Set();

  for (const model of semanticModels) {
    if (!usoIds.has(model.usoId)) {
      errors.push(`Orphan Semantic Model '${model.id}': USO '${model.usoId}' is not part of this batch`);
      continue;
    }

    if (seenUsoIds.has(model.usoId)) {
      errors.push(`Duplicate Semantic Model identity for USO '${model.usoId}'`);
    }
    seenUsoIds.add(model.usoId);

    if (!VALID_LIFECYCLE_STATES.includes(model.lifecycle)) {
      errors.push(`Semantic Model '${model.id}' has an invalid lifecycle state '${model.lifecycle}'`);
    }

    if (typeof model.confidenceValue !== "number" || model.confidenceValue < 0 || model.confidenceValue > 1) {
      errors.push(`Semantic Model '${model.id}' has an invalid confidence value '${model.confidenceValue}'`);
    }

    if (model.semanticCategory && model.confidenceValue === 0) {
      warnings.push(
        `Semantic Model '${model.id}' has a classification ('${model.semanticCategory}') but zero confidence`
      );
    }
  }

  return { warnings, errors, isValid: errors.length === 0 };
}

module.exports = {
  validateSemanticProduction,
};
