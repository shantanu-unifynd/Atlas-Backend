const navigationCandidateRepository = require("../../../../repositories/navigationCandidate/navigationCandidate.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Stage 4 — Candidate Persistence. Runs inside a single transaction: the
// candidate rows and the graph's CREATED -> GENERATING lifecycle transition
// either both persist or neither does.
async function persistCandidates(graphId, detections, statistics, tx) {
  if (detections.length > 0) {
    await navigationCandidateRepository.createMany(
      detections.map((detection) => ({
        graphId,
        semanticObjectId: detection.semanticModelId,
        candidateType: detection.candidateType,
        confidence: detection.confidence,
        metadata: detection.metadata,
      })),
      tx
    );
  }

  const updatedGraph = await navigationGraphRepository.update(
    graphId,
    { status: "GENERATING", statistics },
    tx
  );

  return updatedGraph;
}

module.exports = { persistCandidates };
