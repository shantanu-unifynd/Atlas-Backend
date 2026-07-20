const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data, client = prisma) {
  return client.routeSegment.create({ data });
}

function createMany(records, client = prisma) {
  return client.routeSegment.createMany({ data: records });
}

function findAllByRouteId(routeId, client = prisma) {
  return client.routeSegment.findMany({
    where: { routeId },
    orderBy: { sequence: "asc" },
  });
}

function findById(id, client = prisma) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return client.routeSegment.findUnique({ where: { id } });
}

function deleteById(id, client = prisma) {
  return client.routeSegment.delete({ where: { id } });
}

module.exports = {
  create,
  createMany,
  findAllByRouteId,
  findById,
  deleteById,
};
