const { prisma } = require("../../config/database");

// Every function accepts an optional Prisma client, defaulting to the
// global singleton. Passing a transaction client (from prisma.$transaction)
// makes these same functions participate in that transaction — additive,
// not a redesign of the repository's own shape or behavior.

function createMany(records, client = prisma) {
  return client.universalSpatialObject.createMany({ data: records });
}

function findAllByGeometryModelId(geometryModelId, client = prisma) {
  return client.universalSpatialObject.findMany({
    where: { geometryModelId },
    orderBy: { generatedAt: "asc" },
  });
}

function updateManyStatus(ids, status, client = prisma) {
  return client.universalSpatialObject.updateMany({
    where: { id: { in: ids } },
    data: { status, revision: { increment: 1 } },
  });
}

module.exports = {
  createMany,
  findAllByGeometryModelId,
  updateManyStatus,
};
