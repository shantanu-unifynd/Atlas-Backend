const { prisma } = require("../../config/database");

function createMany(records, client = prisma) {
  return client.universalSpatialObjectRelationship.createMany({ data: records });
}

function findAllByGeometryModelId(geometryModelId, client = prisma) {
  return client.universalSpatialObjectRelationship.findMany({
    where: { geometryModelId },
    orderBy: { createdAt: "asc" },
  });
}

module.exports = {
  createMany,
  findAllByGeometryModelId,
};
