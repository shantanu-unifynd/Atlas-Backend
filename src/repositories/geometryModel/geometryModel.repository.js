const { prisma } = require("../../config/database");

function create(data) {
  return prisma.geometryModel.create({ data });
}

function findByNormalizedBlueprintId(normalizedBlueprintId) {
  return prisma.geometryModel.findUnique({ where: { normalizedBlueprintId } });
}

function update(id, data) {
  return prisma.geometryModel.update({ where: { id }, data });
}

module.exports = {
  create,
  findByNormalizedBlueprintId,
  update,
};
