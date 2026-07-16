// Stage 6 — Confidence Engine.
// Computes confidence independently of the Rule Engine and Conflict
// Resolver — rules never assign their own confidence. For this phase, any
// USO with a winning deterministic rule match gets confidence 1.0 (the
// rule matched or it didn't; there is no partial credit for a deterministic
// rule). A USO with no winning match gets an honest zero — nothing was
// actually classified for it.

const UNCLASSIFIED_CONFIDENCE = Object.freeze({
  value: 0,
  source: "UNCLASSIFIED",
  reason: "No deterministic rule matched this USO",
});

function computeConfidence(resolution) {
  if (!resolution.winningMatch) {
    return { ...UNCLASSIFIED_CONFIDENCE };
  }

  return {
    value: 1.0,
    source: "DETERMINISTIC_RULE",
    reason: resolution.winningMatch.ruleId,
  };
}

module.exports = {
  computeConfidence,
  UNCLASSIFIED_CONFIDENCE,
};
