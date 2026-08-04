const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data) {
  return prisma.mapRoomOverride.create({ data });
}

function findAllByFloorId(floorId) {
  return prisma.mapRoomOverride.findMany({ where: { floorId }, orderBy: { createdAt: "asc" } });
}

function findById(id) {
  if (!UUID_REGEX.test(id)) return null;
  return prisma.mapRoomOverride.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.mapRoomOverride.update({ where: { id }, data });
}

function deleteById(id) {
  return prisma.mapRoomOverride.delete({ where: { id } });
}

module.exports = { create, findAllByFloorId, findById, update, deleteById };
