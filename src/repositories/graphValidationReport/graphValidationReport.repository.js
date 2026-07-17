const { prisma } = require("../../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function create(data, client = prisma) {
  return client.graphValidationReport.create({ data });
}

function findAllByGraphId(graphId, client = prisma) {
  return client.graphValidationReport.findMany({
    where: { graphId },
    orderBy: { createdAt: "asc" },
  });
}

function findById(id, client = prisma) {
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  return client.graphValidationReport.findUnique({ where: { id } });
}

function deleteById(id, client = prisma) {
  return client.graphValidationReport.delete({ where: { id } });
}

module.exports = {
  create,
  findAllByGraphId,
  findById,
  deleteById,
};
