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

// Sprint 07A — the floor's single live (published) version, if any. The publish
// workflow keeps at most one PUBLISHED row per floor, so the highest-version
// PUBLISHED row is the active one.
function findLatestPublishedByFloorId(floorId) {
  if (!UUID_REGEX.test(floorId)) {
    return null;
  }

  return prisma.mapPresentationModel.findFirst({
    where: { floorId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
}

function updateStatus(id, status) {
  return prisma.mapPresentationModel.update({ where: { id }, data: { status } });
}

// Supersede whatever is currently published for a floor (there should be at most
// one). Returns Prisma's batch payload; version history is preserved — only the
// status changes to ARCHIVED.
function archivePublishedByFloorId(floorId) {
  return prisma.mapPresentationModel.updateMany({
    where: { floorId, status: "PUBLISHED" },
    data: { status: "ARCHIVED" },
  });
}

module.exports = {
  create,
  findLatestByFloorId,
  findMaxVersion,
  findLatestPublishedByFloorId,
  updateStatus,
  archivePublishedByFloorId,
};
