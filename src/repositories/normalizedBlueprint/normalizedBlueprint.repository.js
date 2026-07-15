const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.normalizedBlueprint.create({ data });
}

function findByBlueprintImportId(blueprintImportId) {
  if (!UUID_REGEX.test(blueprintImportId)) {
    return null;
  }

  return prisma.normalizedBlueprint.findUnique({ where: { blueprintImportId } });
}

module.exports = {
  create,
  findByBlueprintImportId,
};
