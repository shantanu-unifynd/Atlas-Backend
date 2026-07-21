// Stage 4 — Response Builder. Assembles the final payload. No persistence.
function build(graphId, originNodeId, destinationNodeId, comparisons) {
  return {
    graphId,
    originNodeId,
    destinationNodeId,
    routes: comparisons,
    computedAt: new Date().toISOString(),
  };
}

module.exports = { build };
