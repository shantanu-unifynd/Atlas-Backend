const ALGORITHM_NAME = "dijkstra";

// Stage 5 — Response Builder. Assembles the final payload. No persistence.
function build(graphId, routingContextId, preference, path, totalCost) {
  return {
    graphId,
    routingContextId,
    preference,
    algorithm: ALGORITHM_NAME,
    path,
    totalCost,
    computedAt: new Date().toISOString(),
  };
}

module.exports = { build };
