// Stage 7 — Semantic Model Builder.
// Pure assembly of the canonical Semantic Model shape from every prior
// stage's output. Computes nothing itself. References the USO by id —
// never touches or duplicates the USO's own fields (geometry, spatial
// category, accessibility all stay exclusively on the USO).
//
// Phase C: every row is created GENERATED regardless of whether a rule
// matched — lifecycle is now a production-readiness concern (has this row
// passed integrity validation, is it published), separate from whether a
// semantic category was actually assigned (visible via semanticCategory
// being null or not). No automatic transition beyond GENERATED happens here.

function buildSemanticModels(usos, resolutionsByUsoId, confidenceByUsoId, versions) {
  const now = new Date().toISOString();

  return usos.map((uso) => {
    const resolution = resolutionsByUsoId.get(uso.id);
    const confidence = confidenceByUsoId.get(uso.id);
    const winningMatch = resolution?.winningMatch || null;

    return {
      usoId: uso.id,
      geometryModelId: uso.geometryModelId,
      semanticVersion: 1,
      classificationVersion: versions.classificationVersion,
      pipelineVersion: versions.pipelineVersion,
      engineVersion: versions.engineVersion,
      lifecycle: "GENERATED",
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
