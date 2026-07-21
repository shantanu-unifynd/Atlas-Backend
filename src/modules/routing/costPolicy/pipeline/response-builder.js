// Stage 4 — Response Builder. Pure function: assembles the final payload
// from the Policy Engine's output. No persistence.
function build(graphId, routingContextId, preference, effectiveCosts) {
  const totalEdges = effectiveCosts.length;

  const summary = {
    totalEdges,
    minimumEffectiveCost: null,
    maximumEffectiveCost: null,
    averageEffectiveCost: null,
  };

  if (totalEdges > 0) {
    const values = effectiveCosts.map((entry) => entry.effectiveCost);
    summary.minimumEffectiveCost = Math.min(...values);
    summary.maximumEffectiveCost = Math.max(...values);
    summary.averageEffectiveCost = values.reduce((sum, value) => sum + value, 0) / totalEdges;
  }

  return {
    graphId,
    routingContextId,
    preference,
    summary,
    effectiveCosts,
  };
}

module.exports = { build };
