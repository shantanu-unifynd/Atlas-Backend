// Stage 6 — USO Model Builder.
// Pure assembly: confirms every USO carries exactly the fields the
// repository expects. Computes nothing — every value was already produced
// by an earlier stage.

function buildUsoModels(usos) {
  return usos.map((uso) => ({
    geometryModelId: uso.geometryModelId,
    candidateId: uso.candidateId,
    candidateType: uso.candidateType,
    spatialCategory: uso.spatialCategory,
    version: uso.version,
    status: uso.status,
    generatedAt: uso.generatedAt,
    generatedFrom: uso.generatedFrom,
    geometryReference: uso.geometryReference,
    accessibility: uso.accessibility,
    relationships: uso.relationships,
    metadata: {},
  }));
}

module.exports = {
  buildUsoModels,
};
