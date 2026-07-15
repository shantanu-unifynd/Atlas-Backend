const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.asset.create({ data });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.asset.findUnique({ where: { id } });
}

module.exports = {
  create,
  findById,
};
