// Stage 6 — Geometry Model Generation.
// Assembles the final GeometryModel shape from every prior stage's output.
// Does not compute anything itself — pure assembly, so this stage's shape
// stays stable even as earlier stages grow real algorithms in later phases.

function buildGeometryModel({
  metadata,
  primitives,
  cleanedGeometry,
  topology,
  candidateObjects,
  relationships,
  diagnostics,
}) {
  return {
    metadata,
    primitives,
    cleanedGeometry,
    topology,
    candidateObjects,
    relationships,
    diagnostics,
  };
}

module.exports = {
  buildGeometryModel,
};
