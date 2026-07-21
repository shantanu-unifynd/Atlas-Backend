const policyEngine = require("../../costPolicy/pipeline/policy-engine");

// Stage 2 — Policy Stage. Pure delegation to Sprint 08 Story 02's Policy
// Engine, unmodified — this file exists only to give the stage its own
// name in this pipeline, not to reimplement or wrap any logic.
function computeEffectiveCosts(edges, preference) {
  return policyEngine.computeEffectiveCosts(edges, preference);
}

module.exports = { computeEffectiveCosts };
