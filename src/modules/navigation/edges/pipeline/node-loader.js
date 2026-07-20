const { prisma } = require("../../../../config/database");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");

// Stage 1 — Node Loader. Loads the NavigationGraph and its NavigationNodes,
// then resolves only the Semantic-layer CONNECTS relationships needed to
// determine connectivity between nodes — never touches Geometry primitives,
// ACSM, or Blueprint data. `statistics.nodeCount` (always written by Story
// 03's node generation, even when 0) is the reliable "has node generation
// run yet" signal — node ROW COUNT alone can't distinguish "not run" from
// "ran and legitimately produced zero nodes".
async function loadNodesForGraph(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  if (graph.statistics?.nodeCount === undefined) {
    const error = new Error("Navigation nodes have not been generated for this graph yet");
    error.statusCode = 409;
    throw error;
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(graphId);

  const semanticModelIds = nodes.map((node) => node.semanticObjectId);

  const semanticModels = semanticModelIds.length
    ? await prisma.semanticModel.findMany({
        where: { id: { in: semanticModelIds } },
        select: { id: true, usoId: true },
      })
    : [];

  const usoIdBySemanticModelId = new Map(
    semanticModels.map((semanticModel) => [semanticModel.id, semanticModel.usoId])
  );

  const usoIdToNode = new Map();

  for (const node of nodes) {
    const usoId = usoIdBySemanticModelId.get(node.semanticObjectId);
    usoIdToNode.set(usoId, node);
  }

  const usoIds = [...usoIdToNode.keys()];

  const connections = usoIds.length
    ? await prisma.universalSpatialObjectRelationship.findMany({
        where: {
          relationshipType: "CONNECTS",
          sourceUsoId: { in: usoIds },
          targetUsoId: { in: usoIds },
        },
      })
    : [];

  return { graph, nodes, usoIdToNode, connections };
}

module.exports = { loadNodesForGraph };
