// Stage 3 — Edge Validator. Validates the pipeline's own input/output shape
// — not full graph connectivity/routing readiness (Story 05 owns that).
function validateEdges(graphId, nodes, edges) {
  const warnings = [];
  const errors = [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenDirectedPairs = new Set();

  for (const edge of edges) {
    if (edge.graphId !== graphId) {
      errors.push(`Edge references a different graph (${edge.graphId})`);
    }

    if (!nodeIds.has(edge.sourceNodeId)) {
      errors.push(`Edge references a non-existent source node ${edge.sourceNodeId}`);
    }

    if (!nodeIds.has(edge.targetNodeId)) {
      errors.push(`Edge references a non-existent target node ${edge.targetNodeId}`);
    }

    if (edge.sourceNodeId === edge.targetNodeId) {
      errors.push(`Edge has identical source and target node ${edge.sourceNodeId}`);
    }

    const directedKey = `${edge.sourceNodeId}->${edge.targetNodeId}`;

    if (seenDirectedPairs.has(directedKey)) {
      errors.push(`Duplicate edge ${directedKey}`);
    }

    seenDirectedPairs.add(directedKey);
  }

  if (edges.length === 0 && nodes.length > 0) {
    warnings.push("No Navigation Edges were generated for this Navigation Graph");
  }

  return { warnings, errors };
}

module.exports = { validateEdges };
