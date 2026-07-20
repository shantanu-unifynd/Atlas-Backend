const { prisma } = require("../../../../config/database");
const Route = require("../../../routing/route/models/route.model");
const routeLoader = require("../pipeline/route-loader");
const routeBuilderStage = require("../pipeline/route-builder");
const routeValidator = require("../pipeline/route-validator");
const routeRepositoryStage = require("../pipeline/route-repository-stage");
const routeSegmentRepository = require("../../../../repositories/routeSegment/routeSegment.repository");
const routeStatisticsRepository = require("../../../../repositories/routeStatistics/routeStatistics.repository");

// Sprint 07 Story 04 — Route Builder. Orchestration only: every
// transformation lives in its own pipeline stage module. Reuses Story 03's
// Dijkstra engine unchanged (via route-loader.js) — this file never
// computes a path itself, only converts an already-computed path into a
// persisted Route.

function internalError(errors) {
  return new Error(`Route Builder produced an invalid route: ${errors.join(", ")}`);
}

function toRoute(record, segments, statistics) {
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

async function buildRoute(graphId, originNodeId, destinationNodeId) {
  const { result } = await routeLoader.loadAndComputeRoute(graphId, originNodeId, destinationNodeId);

  const { routeData, segmentsData, statisticsData } = routeBuilderStage.buildRoute(
    graphId,
    originNodeId,
    destinationNodeId,
    result
  );

  const { errors } = routeValidator.validateRoute(
    originNodeId,
    destinationNodeId,
    result.path,
    segmentsData,
    statisticsData
  );

  if (errors.length > 0) {
    throw internalError(errors);
  }

  const route = await prisma.$transaction((tx) =>
    routeRepositoryStage.persistRoute(routeData, segmentsData, statisticsData, tx)
  );

  const segments = await routeSegmentRepository.findAllByRouteId(route.id);
  const statistics = await routeStatisticsRepository.findByRouteId(route.id);

  return toRoute(route, segments, statistics);
}

module.exports = { buildRoute };
