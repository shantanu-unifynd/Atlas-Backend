const { prisma } = require("../../../../config/database");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Stage 1 — Semantic Model Loading.
// Loads exactly the data candidate detection is allowed to see: the
// NavigationGraph itself, every SemanticModel in its building/floor scope,
// and the CONNECTS relationships between their Semantic Objects. Never
// touches GeometryModel primitives/topology or Blueprint/ACSM tables
// directly — only traverses through them as a scope filter (buildingId/
// floorId), the same way any other building/floor-scoped query would.
async function loadSemanticModelsForGraph(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  const blueprintImportScope = graph.floorId
    ? { floorId: graph.floorId }
    : { buildingId: graph.buildingId };

  const semanticModels = await prisma.semanticModel.findMany({
    where: {
      uso: {
        geometryModel: {
          normalizedBlueprint: {
            blueprintImport: blueprintImportScope,
          },
        },
      },
    },
    include: { uso: true },
    orderBy: { createdAt: "asc" },
  });

  const usoIds = semanticModels.map((semanticModel) => semanticModel.usoId);
  const categoryByUsoId = new Map(
    semanticModels.map((semanticModel) => [semanticModel.usoId, semanticModel.semanticCategory])
  );

  const connections = usoIds.length
    ? await prisma.universalSpatialObjectRelationship.findMany({
        where: {
          relationshipType: "CONNECTS",
          sourceUsoId: { in: usoIds },
          targetUsoId: { in: usoIds },
        },
      })
    : [];

  const neighborsByUsoId = new Map(usoIds.map((usoId) => [usoId, []]));

  for (const connection of connections) {
    neighborsByUsoId.get(connection.sourceUsoId).push({
      usoId: connection.targetUsoId,
      semanticCategory: categoryByUsoId.get(connection.targetUsoId),
    });
    neighborsByUsoId.get(connection.targetUsoId).push({
      usoId: connection.sourceUsoId,
      semanticCategory: categoryByUsoId.get(connection.sourceUsoId),
    });
  }

  return {
    graph,
    semanticModels,
    neighborsByUsoId,
  };
}

module.exports = {
  loadSemanticModelsForGraph,
};
