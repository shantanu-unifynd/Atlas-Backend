// Stage 4 — Simulation Response Builder. Pure assembly of the Position
// object the Walking Engine produces — reuses Sprint 10 Story 02's exact
// normalized Position shape {graphId, source, coordinates, recordedAt,
// metadata}, never inventing a different contract.
function build(graphId, node, coordinates) {
  return {
    graphId,
    source: "MOCK",
    coordinates,
    recordedAt: new Date().toISOString(),
    metadata: { simulatedNodeId: node.id },
  };
}

module.exports = { build };
