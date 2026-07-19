const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationCandidateRepository = require("../../../../repositories/navigationCandidate/navigationCandidate.repository");

// Stage 1 — Candidate Loader. Loads the NavigationGraph and its
// NavigationCandidates, and rejects requests where the pipeline
// preconditions aren't met.
async function loadCandidatesForGraph(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  if (graph.status === "CREATED") {
    const error = new Error(
      "Navigation candidates have not been generated for this graph yet"
    );
    error.statusCode = 409;
    throw error;
  }

  const candidates = await navigationCandidateRepository.findAllByGraphId(graphId);

  for (const candidate of candidates) {
    if (candidate.graphId !== graphId) {
      throw new Error(`Candidate ${candidate.id} does not belong to graph ${graphId}`);
    }
  }

  return { graph, candidates };
}

module.exports = { loadCandidatesForGraph };
