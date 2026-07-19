const { prisma } = require("../../config/database");

function createMany(records, client = prisma) {
  return client.navigationCandidate.createMany({ data: records });
}

function findAllByGraphId(graphId, client = prisma) {
  return client.navigationCandidate.findMany({
    where: { graphId },
    orderBy: { createdAt: "asc" },
  });
}

module.exports = {
  createMany,
  findAllByGraphId,
};
