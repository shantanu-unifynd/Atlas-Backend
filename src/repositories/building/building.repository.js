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

function update(id, data) {
  return prisma.building.update({ where: { id }, data });
}

function remove(id) {
  return prisma.building.delete({ where: { id } });
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  remove,
};
