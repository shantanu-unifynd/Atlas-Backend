// Production Validator — Phase C.
// Runs after persistence (Repository stage), over the actually-persisted
// USOs and relationships for this generation batch. This is an integrity
// check, not a re-run of Candidate Validator's pre-generation checks: it
// verifies the WRITTEN data is internally consistent, and never silently
// discards anything it finds wrong — every issue becomes a warning or an
// error in the returned report.

const VALID_LIFECYCLE_STATUSES = ["GENERATED", "VALIDATED", "PUBLISHED", "DEPRECATED"];
const VALID_RELATIONSHIP_TYPES = ["ADJACENT_TO", "CONTAINS", "WITHIN", "BOUNDED_BY", "CONNECTS", "TOUCHES", "INTERSECTS"];

// Only forward transitions this phase actually performs are GENERATED ->
// VALIDATED; PUBLISHED/DEPRECATED are declared destinations for a future
// phase's publishing/approval workflow, not reachable from here yet.
const ALLOWED_TRANSITIONS = {
  GENERATED: ["VALIDATED"],
  VALIDATED: ["PUBLISHED"],
  PUBLISHED: ["DEPRECATED"],
  DEPRECATED: [],
};

function canTransition(fromStatus, toStatus) {
  return (ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function validateProduction({ geometryModel, usos, relationships }) {
  const warnings = [];
  const errors = [];

  const usoIds = new Set();
  const usoIdentityKeys = new Set();

  for (const uso of usos) {
    if (uso.geometryModelId !== geometryModel.id) {
      errors.push(`Orphan USO '${uso.id}': geometryModelId does not match this generation batch`);
      continue;
    }

    if (usoIds.has(uso.id)) {
      errors.push(`Duplicate USO identity '${uso.id}'`);
    }
    usoIds.add(uso.id);

    const identityKey = `${uso.geometryModelId}|${uso.candidateId}`;
    if (usoIdentityKeys.has(identityKey)) {
      errors.push(`Duplicate USO identity for candidate '${uso.candidateId}'`);
    }
    usoIdentityKeys.add(identityKey);

    if (!uso.geometryReference || Object.keys(uso.geometryReference).length === 0) {
      errors.push(`USO '${uso.id}' is missing its geometry reference`);
    }

    const candidateCollection = geometryModel.candidateObjects?.[uso.candidateType];
    const candidateExists = Array.isArray(candidateCollection) && candidateCollection.some((c) => c.id === uso.candidateId);

    if (!candidateExists) {
      errors.push(`USO '${uso.id}' references candidate '${uso.candidateId}' which no longer exists in the geometry model`);
    }

    if (!VALID_LIFECYCLE_STATUSES.includes(uso.status)) {
      errors.push(`USO '${uso.id}' has an invalid lifecycle status '${uso.status}'`);
    }
  }

  for (const relationship of relationships) {
    if (relationship.sourceUsoId === relationship.targetUsoId) {
      errors.push(`Self-referencing relationship '${relationship.id}' on USO '${relationship.sourceUsoId}'`);
    }

    if (!usoIds.has(relationship.sourceUsoId) || !usoIds.has(relationship.targetUsoId)) {
      errors.push(`Orphan relationship '${relationship.id}': source or target USO is not part of this batch`);
    }

    if (!VALID_RELATIONSHIP_TYPES.includes(relationship.relationshipType)) {
      errors.push(`Relationship '${relationship.id}' has an invalid relationship type '${relationship.relationshipType}'`);
    }
  }

  return { warnings, errors, isValid: errors.length === 0 };
}

module.exports = {
  validateProduction,
  canTransition,
};
