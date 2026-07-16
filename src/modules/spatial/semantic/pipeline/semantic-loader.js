// Stage 1 — Semantic Loader.
// Loads persisted USOs, their relationships, and their accessibility
// metadata — the USO Model is the only input. Never touches SVG, ACSM,
// Geometry Model, or Blueprint Imports; never transforms anything.

const universalSpatialObjectRepository = require("../../../../repositories/universalSpatialObject/universalSpatialObject.repository");
const usoRelationshipRepository = require("../../../../repositories/usoRelationship/usoRelationship.repository");

async function loadUsoModel(usoModelId) {
  const usos = await universalSpatialObjectRepository.findAllByGeometryModelId(usoModelId);
  const relationships = await usoRelationshipRepository.findAllByGeometryModelId(usoModelId);

  const relationshipsByUsoId = new Map();

  for (const relationship of relationships) {
    for (const usoId of [relationship.sourceUsoId, relationship.targetUsoId]) {
      if (!relationshipsByUsoId.has(usoId)) relationshipsByUsoId.set(usoId, []);
      relationshipsByUsoId.get(usoId).push(relationship);
    }
  }

  return { usoModelId, usos, relationships, relationshipsByUsoId };
}

module.exports = {
  loadUsoModel,
};
