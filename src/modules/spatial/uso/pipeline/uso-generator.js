// Stage 3 — USO Generator.
// Generates stable Universal Spatial Objects from validated candidates.
// Purely geometric categorization (Boundary/Wall/Enclosure/Opening/Passage/
// VerticalConnection) — no semantic labels (no Store/Restaurant/Office/...).
//
// Identity: the id assigned here is the USO's permanent identity. Later
// phases that enrich a USO (semantic classification, navigation linkage)
// must update this same row rather than create a new one — geometry
// changing later must not require a new identity.

const CANDIDATE_TYPE_TO_SPATIAL_CATEGORY = {
  candidateBoundaries: "BOUNDARY",
  candidateEnclosures: "ENCLOSURE",
  candidateOpenings: "OPENING",
  candidateWalls: "WALL",
  candidatePassages: "PASSAGE",
  candidateVerticalConnections: "VERTICAL_CONNECTION",
};

function geometryReferenceFor(candidate) {
  return {
    primitiveIds: candidate.primitiveIds || (candidate.primitiveId ? [candidate.primitiveId] : []),
    gapNodeIds: candidate.gapNodeIds || null,
    nodeIds: candidate.nodeIds || null,
  };
}

function generateUsos(geometryModelId, validatedCandidates, pipelineVersion) {
  const generatedAt = new Date().toISOString();
  const usos = [];

  for (const [collectionKey, spatialCategory] of Object.entries(CANDIDATE_TYPE_TO_SPATIAL_CATEGORY)) {
    for (const candidate of validatedCandidates.candidateObjects[collectionKey] || []) {
      usos.push({
        geometryModelId,
        candidateId: candidate.id,
        candidateType: collectionKey,
        spatialCategory,
        version: 1,
        status: "GENERATED",
        generatedAt,
        generatedFrom: pipelineVersion,
        geometryReference: {
          geometryModelId,
          candidateId: candidate.id,
          candidateType: collectionKey,
          ...geometryReferenceFor(candidate),
        },
      });
    }
  }

  return usos;
}

module.exports = {
  generateUsos,
};
