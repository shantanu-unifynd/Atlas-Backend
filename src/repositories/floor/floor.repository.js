const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.floor.create({ data });
}

// Both reads count the floor's PUBLISHED map presentation models so the
// service can derive the floor's effective status ("published" once a live
// map exists — Figma 2.5) without a second query per floor.
const PUBLISHED_MAP_COUNT = {
  _count: { select: { mapPresentationModels: { where: { status: "PUBLISHED" } } } },
};

function findAllByBuildingId(buildingId) {
  return prisma.floor.findMany({
    where: { buildingId },
    orderBy: { level: "asc" },
    include: PUBLISHED_MAP_COUNT,
  });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return prisma.floor.findUnique({ where: { id }, include: PUBLISHED_MAP_COUNT });
}

// Deleting a floor relies on the schema's onDelete: Cascade from every
// floor-scoped table (blueprint imports, map models, navigation graphs, …),
// so one delete removes the floor and all its pipeline data.
function remove(id) {
  return prisma.floor.delete({ where: { id } });
}

module.exports = {
  create,
  findAllByBuildingId,
  findById,
  remove,
};
