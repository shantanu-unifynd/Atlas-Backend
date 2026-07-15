const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.building.create({ data });
}

function findAll() {
  return prisma.building.findMany({ orderBy: { createdAt: "asc" } });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.building.findUnique({ where: { id } });
}

module.exports = {
  create,
  findAll,
  findById,
};
