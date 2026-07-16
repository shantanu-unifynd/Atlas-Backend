const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.geometryModel.create({ data });
}

function findByNormalizedBlueprintId(normalizedBlueprintId) {
  return prisma.geometryModel.findUnique({ where: { normalizedBlueprintId } });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.geometryModel.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.geometryModel.update({ where: { id }, data });
}

module.exports = {
  create,
  findByNormalizedBlueprintId,
  findById,
  update,
};
