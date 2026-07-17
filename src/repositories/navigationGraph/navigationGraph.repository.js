const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data, client = prisma) {
  return client.navigationGraph.create({ data });
}

function findAll(where = {}, client = prisma) {
  return client.navigationGraph.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
}

function findById(id, client = prisma) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return client.navigationGraph.findUnique({ where: { id } });
}

function deleteById(id, client = prisma) {
  return client.navigationGraph.delete({ where: { id } });
}

module.exports = {
  create,
  findAll,
  findById,
  deleteById,
};
