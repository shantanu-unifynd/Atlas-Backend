const { RULES } = require("./rule-registry");

const DETERMINISTIC_CONFIDENCE = 1.0;

// Stage 2 — Candidate Detection. Pure, deterministic: the same evidence
// always produces the same result. No probabilistic or AI-based scoring.
function buildEvidence(semanticModel, neighborsByUsoId) {
  return {
    semanticModelId: semanticModel.id,
    semanticCategory: semanticModel.semanticCategory,
    spatialCategory: semanticModel.uso.spatialCategory,
    neighbors: neighborsByUsoId.get(semanticModel.usoId) || [],
  };
}

function detectCandidateType(evidence) {
  const matchedRule = RULES.find((rule) => rule.evaluate(evidence));
  return matchedRule || null;
}

function detectCandidates(semanticModels, neighborsByUsoId) {
  const detections = [];

  for (const semanticModel of semanticModels) {
    const evidence = buildEvidence(semanticModel, neighborsByUsoId);
    const matchedRule = detectCandidateType(evidence);

    if (!matchedRule) {
      continue;
    }

    detections.push({
      semanticModelId: semanticModel.id,
      candidateType: matchedRule.candidateType,
      confidence: DETERMINISTIC_CONFIDENCE,
      metadata: {
        ruleId: matchedRule.ruleId,
        ruleName: matchedRule.ruleName,
        neighborCount: evidence.neighbors.length,
      },
    });
  }

  return detections;
}

module.exports = {
  detectCandidates,
};
