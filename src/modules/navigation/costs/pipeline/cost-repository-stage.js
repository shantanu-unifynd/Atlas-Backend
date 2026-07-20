const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

const COST_MODEL_PIPELINE_VERSION = "1.0.0";

// Stage 4 — Repository Stage. Persists the traversal cost onto every edge
// and records a minimal "cost model generated" marker on the graph, in one
// transaction. Since every edge in this story's constant cost model
// receives the identical value, a single bulk updateMany is both correct
// and far cheaper than N individual updates. Only NavigationEdge.
// traversalCost and NavigationGraph.metadata.costModel are written — nodes,
// topology, semantic data, and USOs are never touched.
async function persistCosts(graphId, existingMetadata, traversalCost, generatedAt, tx) {
  await navigationEdgeRepository.updateManyByGraphId(graphId, { traversalCost }, tx);

  const updatedGraph = await navigationGraphRepository.update(
    graphId,
    {
      metadata: {
        ...existingMetadata,
        costModel: {
          pipelineVersion: COST_MODEL_PIPELINE_VERSION,
          generatedAt,
        },
      },
    },
    tx
  );

  return updatedGraph;
}

module.exports = { persistCosts, COST_MODEL_PIPELINE_VERSION };
