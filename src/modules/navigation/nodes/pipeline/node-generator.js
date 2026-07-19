// Stage 2 — Node Generation. Strict 1:1 with NavigationCandidates: every
// candidate produces exactly one node, candidates are never merged or
// split. nodeType/position/metadata are inherited verbatim — no additional
// semantic classification, no new node categories, no coordinate
// computation, no Geometry access.
function generateNodes(graphId, candidates) {
  return candidates.map((candidate) => ({
    graphId,
    candidateId: candidate.id,
    semanticObjectId: candidate.semanticObjectId,
    nodeType: candidate.candidateType,
    position: candidate.position,
    metadata: candidate.metadata,
  }));
}

module.exports = { generateNodes };
