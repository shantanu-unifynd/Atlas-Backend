const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data, client = prisma) {
  return client.routeStatistics.create({ data });
}

function findByRouteId(routeId, client = prisma) {
  return client.routeStatistics.findUnique({ where: { routeId } });
}

function findById(id, client = prisma) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return client.routeStatistics.findUnique({ where: { id } });
}

function update(routeId, data, client = prisma) {
  return client.routeStatistics.update({ where: { routeId }, data });
}

function deleteByRouteId(routeId, client = prisma) {
  return client.routeStatistics.delete({ where: { routeId } });
}

module.exports = {
  create,
  findByRouteId,
  findById,
  update,
  deleteByRouteId,
};
