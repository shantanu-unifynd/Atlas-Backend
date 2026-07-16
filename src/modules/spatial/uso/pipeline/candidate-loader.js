// Stage 1 — Candidate Loader.
// Loads the persisted Geometry Model's candidate geometry. No transformation
// of any kind — that begins with the Candidate Validator. This stage exists
// so every later stage receives a stable, uniform shape regardless of how
// the Geometry Model happens to be stored.

function loadCandidates(geometryModel) {
  return {
    geometryModelId: geometryModel.id,
    candidateObjects: geometryModel.candidateObjects,
    candidatesGeneratedAt: geometryModel.diagnostics.candidatesGeneratedAt || null,
  };
}

module.exports = {
  loadCandidates,
};
