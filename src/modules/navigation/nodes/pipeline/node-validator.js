// Stage 3 — Node Validator. Validates the pipeline's own input/output shape
// — not graph connectivity or routing readiness (Story 05).
function validateNodes(candidates, nodes) {
  const warnings = [];
  const errors = [];

  if (nodes.length !== candidates.length) {
    errors.push(
      `Node count (${nodes.length}) does not match candidate count (${candidates.length}) — 1:1 mapping violated`
    );
  }

  const seenCandidateIds = new Set();
  const seenSemanticObjectIds = new Set();

  for (const node of nodes) {
    if (!node.nodeType) {
      errors.push(`Node for candidate ${node.candidateId} has no nodeType`);
    }

    if (seenCandidateIds.has(node.candidateId)) {
      errors.push(`Duplicate node generated for candidate ${node.candidateId}`);
    }

    if (seenSemanticObjectIds.has(node.semanticObjectId)) {
      errors.push(`Duplicate node generated for Semantic Object ${node.semanticObjectId}`);
    }

    seenCandidateIds.add(node.candidateId);
    seenSemanticObjectIds.add(node.semanticObjectId);
  }

  if (nodes.length === 0) {
    warnings.push("No Navigation Nodes were generated for this Navigation Graph");
  }

  return { warnings, errors };
}

module.exports = { validateNodes };
