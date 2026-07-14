const crypto = require("crypto");
const NavigationGraph = require("../models/graph.model");
const blueprintService = require("../../blueprint/services/blueprint.service");

const graphs = [];

function createGraph(blueprintId) {
  blueprintService.getBlueprintById(blueprintId);

  const existing = graphs.find((g) => g.blueprintId === blueprintId);

  if (existing) {
    const error = new Error("Blueprint already has a navigation graph");
    error.statusCode = 409;
    throw error;
  }

  const now = new Date().toISOString();

  const graph = new NavigationGraph({
    id: crypto.randomUUID(),
    blueprintId,
    version: 1,
    status: "draft",
    nodes: [],
    edges: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  graphs.push(graph);

  return graph;
}

function getGraphByBlueprintId(blueprintId) {
  blueprintService.getBlueprintById(blueprintId);

  const graph = graphs.find((g) => g.blueprintId === blueprintId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  return graph;
}

function getGraphById(graphId) {
  const graph = graphs.find((g) => g.id === graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  return graph;
}

module.exports = {
  createGraph,
  getGraphByBlueprintId,
  getGraphById,
};
