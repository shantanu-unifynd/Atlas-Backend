const { prisma } = require("../../config/database");

// "Remove room" tombstones. active = restoredAt IS NULL.
function create(data) {
  return prisma.roomTombstone.create({ data });
}

function findActiveByFloorId(floorId) {
  return prisma.roomTombstone.findMany({
    where: { floorId, restoredAt: null },
    orderBy: { deletedAt: "asc" },
  });
}

function findAllByFloorId(floorId) {
  return prisma.roomTombstone.findMany({ where: { floorId }, orderBy: { deletedAt: "desc" } });
}

function findActiveByFloorAndRoom(floorId, roomId) {
  return prisma.roomTombstone.findFirst({ where: { floorId, roomId, restoredAt: null } });
}

function restore(id, restoredBy, restoredAt) {
  return prisma.roomTombstone.update({ where: { id }, data: { restoredBy, restoredAt } });
}

module.exports = {
  create,
  findActiveByFloorId,
  findAllByFloorId,
  findActiveByFloorAndRoom,
  restore,
};
