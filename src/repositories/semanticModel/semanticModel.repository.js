const { prisma } = require("../../config/database");

function createMany(records, client = prisma) {
  return client.semanticModel.createMany({ data: records });
}

function findAllByUsoIds(usoIds, client = prisma) {
  return client.semanticModel.findMany({ where: { usoId: { in: usoIds } } });
}

function findAllByGeometryModelId(geometryModelId, client = prisma) {
  return client.semanticModel.findMany({
    where: { geometryModelId },
    orderBy: { createdAt: "asc" },
  });
}

module.exports = {
  createMany,
  findAllByUsoIds,
  findAllByGeometryModelId,
};
