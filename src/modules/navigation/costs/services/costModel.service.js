const { prisma } = require("../../../../config/database");
const graphLoader = require("../pipeline/graph-loader");
const costCalculator = require("../pipeline/cost-calculator");
const costValidator = require("../pipeline/cost-validator");
const costRepositoryStage = require("../pipeline/cost-repository-stage");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");

// Sprint 07 Story 02 — Graph Cost Model. Orchestration only: every
// transformation lives in its own pipeline stage module. Assigns a constant
// traversal cost to every edge of a validated (READY) Navigation Graph —
// nothing more. No routing algorithm, no graph traversal, no Route domain
// involvement anywhere in this file.

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function validationError(errors) {
  const error = new Error(errors.join(", "));
  error.statusCode = 400;
  return error;
}

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

async function buildCostSummary(graphId, costModelMetadata) {
  const aggregate = await navigationEdgeRepository.aggregateCostsByGraphId(graphId);

  return {
    graphId,
    totalEdges: aggregate._count._all,
    minCost: aggregate._min.traversalCost,
    maxCost: aggregate._max.traversalCost,
    averageCost: aggregate._avg.traversalCost,
    pipelineVersion: costModelMetadata.pipelineVersion,
    generatedAt: costModelMetadata.generatedAt,
  };
}

async function generateCostModel(graphId) {
  const { graph, edges } = await graphLoader.loadGraphForCosting(graphId);

  if (graph.metadata?.costModel) {
    throw conflictError("Cost model has already been generated for this graph");
  }

  const costAssignments = costCalculator.calculateCosts(edges);

  const { errors } = costValidator.validateCosts(edges, costAssignments);

  if (errors.length > 0) {
    throw validationError(errors);
  }

  const generatedAt = new Date().toISOString();

  const updatedGraph = await prisma.$transaction((tx) =>
    costRepositoryStage.persistCosts(graphId, graph.metadata, 1.0, generatedAt, tx)
  );

  return buildCostSummary(graphId, updatedGraph.metadata.costModel);
}

async function getCostSummary(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  if (!graph.metadata?.costModel) {
    throw notFoundError("Cost model has not been generated for this graph yet");
  }

  return buildCostSummary(graphId, graph.metadata.costModel);
}

module.exports = {
  generateCostModel,
  getCostSummary,
};
