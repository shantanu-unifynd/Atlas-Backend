const Route = require("../../../../routing/route/models/route.model");
const routeLoader = require("../pipeline/route-loader");
const routeValidator = require("../pipeline/route-validator");
const validationReport = require("../pipeline/validation-report");
const publicationStage = require("../pipeline/publication-stage");

// Sprint 07 Story 05 — Route Validation & Production Publication.
// Orchestration only. Validation is read-only and deterministic — running
// it twice on an unchanged Route produces an identical result. This is
// the ONLY place in the pipeline permitted to write Route.status, and it
// writes nothing else.

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

async function validateRoute(routeId) {
  const { route, segments, statistics, nodes, edges } = await routeLoader.loadRouteForValidation(
    routeId
  );

  const errors = routeValidator.validateRoute({ route, segments, statistics, nodes, edges });
  const report = validationReport.buildReport(errors, statistics);

  const updatedRoute = await publicationStage.publish(routeId, report.validationStatus);

  return {
    route: toRoute(updatedRoute, segments, statistics),
    report,
  };
}

// GET — a pure "peek": re-runs Stages 1-3 live and returns the current
// result without ever writing Route.status. Read-only in every sense.
async function getValidation(routeId) {
  const { route, segments, statistics, nodes, edges } = await routeLoader.loadRouteForValidation(
    routeId
  );

  const errors = routeValidator.validateRoute({ route, segments, statistics, nodes, edges });
  const report = validationReport.buildReport(errors, statistics);

  return {
    route: toRoute(route, segments, statistics),
    report,
  };
}

module.exports = {
  validateRoute,
  getValidation,
};
