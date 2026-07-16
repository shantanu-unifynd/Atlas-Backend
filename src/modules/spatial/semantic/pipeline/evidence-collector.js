// Stage 3 — Evidence Collector.
// Assembles, per USO, exactly the evidence a deterministic rule is allowed
// to reason over — all of it already persisted on the USO Model (spatial
// category, USO/candidate type, accessibility, relationships, geometry
// reference, lifecycle). Never touches SVG, ACSM, Geometry Model, Blueprint
// Imports, raw polygons, or any external source. Collects only — assigns
// no meaning itself.

function relationshipIdsFor(usoId, relationships, type, direction) {
  return relationships
    .filter((r) => r.relationshipType === type)
    .filter((r) => (direction === "from" ? r.sourceUsoId === usoId : r.targetUsoId === usoId))
    .map((r) => (direction === "from" ? r.targetUsoId : r.sourceUsoId));
}

function collectEvidence(usos, relationshipsByUsoId) {
  return usos.map((uso) => {
    const relationships = relationshipsByUsoId.get(uso.id) || [];

    return {
      usoId: uso.id,
      spatialCategory: uso.spatialCategory,
      candidateType: uso.candidateType,
      accessibility: uso.accessibility,
      relationships: {
        // CONTAINS/BOUNDED_BY are directional: this USO is a "parent" when it
        // is the source (it contains/bounds something), a "child" when it is
        // the target (it is contained/bounded by something).
        parentIds: [
          ...relationshipIdsFor(uso.id, relationships, "CONTAINS", "to"),
          ...relationshipIdsFor(uso.id, relationships, "BOUNDED_BY", "from"),
        ],
        childIds: [
          ...relationshipIdsFor(uso.id, relationships, "CONTAINS", "from"),
          ...relationshipIdsFor(uso.id, relationships, "BOUNDED_BY", "to"),
        ],
        adjacentIds: [
          ...relationshipIdsFor(uso.id, relationships, "ADJACENT_TO", "from"),
          ...relationshipIdsFor(uso.id, relationships, "ADJACENT_TO", "to"),
        ],
        connectedIds: [
          ...relationshipIdsFor(uso.id, relationships, "CONNECTS", "from"),
          ...relationshipIdsFor(uso.id, relationships, "CONNECTS", "to"),
        ],
      },
      geometryReference: uso.geometryReference,
      lifecycle: {
        status: uso.status,
        revision: uso.revision,
      },
    };
  });
}

module.exports = {
  collectEvidence,
};
