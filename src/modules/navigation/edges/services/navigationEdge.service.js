const { prisma } = require("../../../../config/database");
const NavigationEdge = require("../models/navigationEdge.model");
const NavigationGraph = require("../../graph/models/navigationGraph.model");
const nodeLoader = require("../pipeline/node-loader");
const edgeGenerator = require("../pipeline/edge-generator");
const edgeValidator = require("../pipeline/edge-validator");
const edgeStatistics = require("../pipeline/edge-statistics");
const edgeRepositoryStage = require("../pipeline/edge-repository-stage");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Sprint 06 Story 04 — Navigation Edge Generation. Orchestration only: every
// transformation lives in its own pipeline stage module. Establishes graph
// connectivity from existing Semantic-layer relationships between
// NavigationNodes — no routing, no shortest-path computation, no
// accessibility optimization, no graph validation/publication (Story 05 /
// Sprint 07).

function toNavigationEdge(record) {
  return new NavigationEdge({
    id: record.id,
    graphId: record.graphId,
    sourceNodeId: record.sourceNodeId,
    targetNodeId: record.targetNodeId,
    edgeType: record.edgeType,
    length: record.length,
    traversalCost: record.traversalCost,
    accessibility: record.accessibility,
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

async function generateEdges(graphId) {
  const { graph, nodes, usoIdToNode, connections } = await nodeLoader.loadNodesForGraph(graphId);

  if (graph.statistics?.edgeCount !== undefined) {
    throw conflictError("Navigation edges have already been generated for this graph");
  }

  const edges = edgeGenerator.generateEdges(graphId, connections, usoIdToNode);

  const validation = edgeValidator.validateEdges(graphId, nodes, edges);

  if (validation.errors.length > 0) {
    throw validationError(validation.errors);
  }

  const statistics = edgeStatistics.buildStatistics(graph.statistics, nodes, edges);

  let updatedGraph;

  try {
    updatedGraph = await prisma.$transaction((tx) =>
      edgeRepositoryStage.persistEdges(graphId, edges, statistics, tx)
    );
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError("Navigation edges have already been generated for this graph");
    }

    throw error;
  }

  const persistedEdges = await navigationEdgeRepository.findAllByGraphId(graphId);

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
    edges: persistedEdges.map(toNavigationEdge),
    statistics,
    warnings: validation.warnings,
  };
}

async function getEdges(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  const records = await navigationEdgeRepository.findAllByGraphId(graphId);

  return records.map(toNavigationEdge);
}

module.exports = {
  generateEdges,
  getEdges,
};
