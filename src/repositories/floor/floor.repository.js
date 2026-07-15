const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.floor.create({ data });
}

function findAllByBuildingId(buildingId) {
  return prisma.floor.findMany({
    where: { buildingId },
    orderBy: { level: "asc" },
  });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.floor.findUnique({ where: { id } });
}

module.exports = {
  create,
  findAllByBuildingId,
  findById,
};
