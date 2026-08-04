const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.mapPresentationModel.create({ data });
}

// Latest version wins — the floor's current map presentation model.
function findLatestByFloorId(floorId) {
  if (!UUID_REGEX.test(floorId)) {
    return null;
  }

  return prisma.mapPresentationModel.findFirst({
    where: { floorId },
    orderBy: { version: "desc" },
  });
}

function findMaxVersion(floorId) {
  return prisma.mapPresentationModel.aggregate({
    where: { floorId },
    _max: { version: true },
  });
}

module.exports = {
  create,
  findLatestByFloorId,
  findMaxVersion,
};
