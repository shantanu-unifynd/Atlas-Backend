const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.blueprintImport.create({ data });
}

function findAllByFloorId(floorId) {
  return prisma.blueprintImport.findMany({
    where: { floorId },
    orderBy: { version: "asc" },
  });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.blueprintImport.findUnique({ where: { id } });
}

async function findLatestVersion(floorId) {
  const latest = await prisma.blueprintImport.findFirst({
    where: { floorId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return latest ? latest.version : 0;
}

function update(id, data) {
  return prisma.blueprintImport.update({ where: { id }, data });
}

module.exports = {
  create,
  findAllByFloorId,
  findById,
  findLatestVersion,
  update,
};
