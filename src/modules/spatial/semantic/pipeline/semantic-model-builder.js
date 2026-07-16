// Stage 7 — Semantic Model Builder.
// Pure assembly of the canonical Semantic Model shape from every prior
// stage's output. Computes nothing itself. References the USO by id —
// never touches or duplicates the USO's own fields (geometry, spatial
// category, accessibility all stay exclusively on the USO).

function buildSemanticModels(usos, resolutionsByUsoId, confidenceByUsoId) {
  const now = new Date().toISOString();

  return usos.map((uso) => {
    const resolution = resolutionsByUsoId.get(uso.id);
    const confidence = confidenceByUsoId.get(uso.id);
    const winningMatch = resolution?.winningMatch || null;

    return {
      usoId: uso.id,
      geometryModelId: uso.geometryModelId,
      semanticVersion: 1,
      lifecycle: winningMatch ? "CLASSIFIED" : "UNCLASSIFIED",
      semanticCategory: winningMatch?.classification.category || null,
      semanticSubCategory: winningMatch?.classification.subCategory || null,
      classificationSource: winningMatch ? "RULE_ENGINE" : null,
      ruleId: winningMatch?.ruleId || null,
      ruleVersion: winningMatch?.version || null,
      confidenceValue: confidence.value,
      confidenceSource: confidence.source,
      confidenceReason: confidence.reason,
      classifiedAt: winningMatch ? now : null,
      metadata: {
        evidence: winningMatch?.evidence || null,
        discardedMatches: resolution?.discardedMatches || [],
      },
    };
  });
}

module.exports = {
  buildSemanticModels,
};
