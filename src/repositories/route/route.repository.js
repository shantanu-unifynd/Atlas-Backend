const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data, client = prisma) {
  return client.route.create({ data });
}

function findAll(where = {}, client = prisma) {
  return client.route.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
}

function findById(id, client = prisma) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return client.route.findUnique({ where: { id } });
}

function update(id, data, client = prisma) {
  return client.route.update({ where: { id }, data });
}

function deleteById(id, client = prisma) {
  return client.route.delete({ where: { id } });
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  deleteById,
};
