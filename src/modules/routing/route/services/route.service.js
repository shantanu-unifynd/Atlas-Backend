const { prisma } = require("../../../../config/database");
const Route = require("../models/route.model");
const routeRepository = require("../../../../repositories/route/route.repository");
const routeSegmentRepository = require("../../../../repositories/routeSegment/routeSegment.repository");
const routeStatisticsRepository = require("../../../../repositories/routeStatistics/routeStatistics.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");

// Sprint 07 Story 01 — Route Domain. CRUD only: no graph traversal, no
// edge inspection, no path computation, no cost model. A Route is created
// as a container (GENERATING, empty segments, empty statistics) for later
// Sprint 07 stories (Cost Model, Dijkstra, Route Builder, Route Validation)
// to populate.

function toRoute(record, segments = [], statistics = null) {
  return new Route({
    id: record.id,
    graphId: record.graphId,
    originNodeId: record.originNodeId,
    destinationNodeId: record.destinationNodeId,
    status: record.status,
    metadata: record.metadata,
    segments,
    statistics: statistics ? statistics.statistics : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function createRoute(data) {
  const { graphId, originNodeId, destinationNodeId, metadata } = data;

  if (!graphId) {
    throw validationError("graphId is required");
  }

  if (!originNodeId) {
    throw validationError("originNodeId is required");
  }

  if (!destinationNodeId) {
    throw validationError("destinationNodeId is required");
  }

  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  const originNode = await navigationNodeRepository.findById(originNodeId);

  if (!originNode) {
    throw notFoundError("Origin node not found");
  }

  const destinationNode = await navigationNodeRepository.findById(destinationNodeId);

  if (!destinationNode) {
    throw notFoundError("Destination node not found");
  }

  if (originNode.graphId !== graphId || destinationNode.graphId !== graphId) {
    throw validationError("Origin and Destination must belong to the same Navigation Graph");
  }

  if (originNodeId === destinationNodeId) {
    throw validationError("Origin and Destination must not be the same node");
  }

  const { route, statistics } = await prisma.$transaction(async (tx) => {
    const createdRoute = await routeRepository.create(
      {
        graphId,
        originNodeId,
        destinationNodeId,
        metadata: metadata || {},
      },
      tx
    );

    const createdStatistics = await routeStatisticsRepository.create(
      { routeId: createdRoute.id, statistics: {} },
      tx
    );

    return { route: createdRoute, statistics: createdStatistics };
  });

  return toRoute(route, [], statistics);
}

async function getRouteById(id) {
  const route = await routeRepository.findById(id);

  if (!route) {
    throw notFoundError("Route not found");
  }

  const segments = await routeSegmentRepository.findAllByRouteId(id);
  const statistics = await routeStatisticsRepository.findByRouteId(id);

  return toRoute(route, segments, statistics);
}

async function getAllRoutes(filters = {}) {
  const where = {};

  if (filters.graphId) where.graphId = filters.graphId;
  if (filters.status) where.status = filters.status;

  const routes = await routeRepository.findAll(where);

  return routes.map((route) => toRoute(route));
}

async function deleteRoute(id) {
  const route = await routeRepository.findById(id);

  if (!route) {
    throw notFoundError("Route not found");
  }

  await routeRepository.deleteById(id);
}

module.exports = {
  createRoute,
  getRouteById,
  getAllRoutes,
  deleteRoute,
};
