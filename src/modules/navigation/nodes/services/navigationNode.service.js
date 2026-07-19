const { prisma } = require("../../../../config/database");
const NavigationNode = require("../models/navigationNode.model");
const NavigationGraph = require("../../graph/models/navigationGraph.model");
const candidateLoader = require("../pipeline/candidate-loader");
const nodeGenerator = require("../pipeline/node-generator");
const nodeValidator = require("../pipeline/node-validator");
const nodeStatistics = require("../pipeline/node-statistics");
const nodeRepositoryStage = require("../pipeline/node-repository-stage");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Sprint 06 Story 03 — Navigation Node Generation. Orchestration only: every
// transformation lives in its own pipeline stage module. Transforms
// previously generated NavigationCandidates into canonical NavigationNodes
// — a deterministic 1:1 mapping, never edges, never routing, never
// connectivity/graph validation (those belong to Story 04/05).

function toNavigationNode(record) {
  return new NavigationNode({
    id: record.id,
    graphId: record.graphId,
    candidateId: record.candidateId,
    semanticObjectId: record.semanticObjectId,
    nodeType: record.nodeType,
    position: record.position,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

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

async function generateNodes(graphId) {
  const { candidates } = await candidateLoader.loadCandidatesForGraph(graphId);

  const existingNodes = await navigationNodeRepository.findAllByGraphId(graphId);

  if (existingNodes.length > 0) {
    throw conflictError("Navigation nodes have already been generated for this graph");
  }

  const nodes = nodeGenerator.generateNodes(graphId, candidates);

  const validation = nodeValidator.validateNodes(candidates, nodes);

  if (validation.errors.length > 0) {
    throw validationError(validation.errors);
  }

  const graph = await navigationGraphRepository.findById(graphId);
  const statistics = nodeStatistics.buildStatistics(graph.statistics, nodes);

  let updatedGraph;

  try {
    updatedGraph = await prisma.$transaction((tx) =>
      nodeRepositoryStage.persistNodes(graphId, nodes, statistics, tx)
    );
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError("Navigation nodes have already been generated for this graph");
    }

    throw error;
  }

  const persistedNodes = await navigationNodeRepository.findAllByGraphId(graphId);

  return {
    graph: new NavigationGraph({
      id: updatedGraph.id,
      buildingId: updatedGraph.buildingId,
      floorId: updatedGraph.floorId,
      status: updatedGraph.status,
      pipelineVersion: updatedGraph.pipelineVersion,
      metadata: updatedGraph.metadata,
      statistics: updatedGraph.statistics,
      createdAt: updatedGraph.createdAt,
      updatedAt: updatedGraph.updatedAt,
    }),
    nodes: persistedNodes.map(toNavigationNode),
    statistics,
    warnings: validation.warnings,
  };
}

async function getNodes(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  const records = await navigationNodeRepository.findAllByGraphId(graphId);

  return records.map(toNavigationNode);
}

module.exports = {
  generateNodes,
  getNodes,
};
