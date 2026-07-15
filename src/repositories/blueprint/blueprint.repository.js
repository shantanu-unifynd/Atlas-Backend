const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.blueprint.create({ data });
}

function findByFloorId(floorId) {
  return prisma.blueprint.findUnique({ where: { floorId } });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.blueprint.findUnique({ where: { id } });
}

module.exports = {
  create,
  findByFloorId,
  findById,
};
