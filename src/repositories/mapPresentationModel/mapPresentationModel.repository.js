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

// The floor's latest shop-gap auto-extract map. autoExtract tags its MPM with a
// top-level data.source = "auto-extract" (generate() puts its own source under
// data.metadata.source), so that top-level key uniquely identifies the rich
// extracted base — the one carrying coordinateSystem + polygon rooms. Used as
// the fallback base when the blueprint-geometry pipeline has no sources for the
// floor, so editing never regenerates an empty, coordinate-less map.
function findLatestAutoExtractByFloorId(floorId) {
  if (!UUID_REGEX.test(floorId)) {
    return null;
  }

  return prisma.mapPresentationModel.findFirst({
    where: { floorId, data: { path: ["source"], equals: "auto-extract" } },
    orderBy: { version: "desc" },
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
  findLatestAutoExtractByFloorId,
  findLatestPublishedByFloorId,
  updateStatus,
  archivePublishedByFloorId,
};
