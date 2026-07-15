const { Prisma } = require("@prisma/client");
const NavigationGraph = require("../models/graph.model");
const blueprintService = require("../../blueprint/services/blueprint.service");
const spatialRepository = require("../../../../repositories/spatial.repository");

function toNavigationGraph(record) {
  return new NavigationGraph({
    id: record.id,
    blueprintId: record.blueprintId,
    version: record.version,
    status: record.status.toLowerCase(),
    nodes: [],
    edges: [],
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

async function createGraph(blueprintId) {
  await blueprintService.getBlueprintById(blueprintId);

  const existing = await spatialRepository.findGraphByBlueprintId(blueprintId);

  if (existing) {
    const error = new Error("Blueprint already has a navigation graph");
    error.statusCode = 409;
    throw error;
  }

  try {
    const record = await spatialRepository.createGraph({ blueprintId });
    return toNavigationGraph(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const conflict = new Error("Blueprint already has a navigation graph");
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
}

async function getGraphByBlueprintId(blueprintId) {
  await blueprintService.getBlueprintById(blueprintId);

  const record = await spatialRepository.findGraphByBlueprintId(blueprintId);

  if (!record) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  return toNavigationGraph(record);
}

async function getGraphById(graphId) {
  const record = await spatialRepository.findGraphById(graphId);

  if (!record) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  return toNavigationGraph(record);
}

module.exports = {
  createGraph,
  getGraphByBlueprintId,
  getGraphById,
};
