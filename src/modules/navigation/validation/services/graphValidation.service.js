const { prisma } = require("../../../../config/database");
const GraphValidationReport = require("../models/graphValidationReport.model");
const NavigationGraph = require("../../graph/models/navigationGraph.model");
const graphLoader = require("../pipeline/graph-loader");
const graphValidator = require("../pipeline/graph-validator");
const validationRepositoryStage = require("../pipeline/validation-repository-stage");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const graphValidationReportRepository = require("../../../../repositories/graphValidationReport/graphValidationReport.repository");

// Sprint 06 Story 05 — Navigation Graph Validation & Publication.
// Orchestration only: every transformation lives in its own pipeline stage
// module. This is the ONLY stage allowed to transition a NavigationGraph
// from GENERATING to READY or FAILED. Validation is read-only and
// deterministic — running it twice on an unchanged graph produces an
// identical validationStatus/warnings/errors/statistics every time, though
// each run persists its own GraphValidationReport row (an append-only
// audit trail, not a single mutable status).

function toGraphValidationReport(record) {
  return new GraphValidationReport({
    id: record.id,
    graphId: record.graphId,
    validationStatus: record.validationStatus,
    warnings: record.warnings,
    errors: record.errors,
    statistics: record.statistics,
    validatedAt: record.validatedAt,
    createdAt: record.createdAt,
  });
}

function toNavigationGraph(record) {
  return new NavigationGraph({
    id: record.id,
    buildingId: record.buildingId,
    floorId: record.floorId,
    status: record.status,
    pipelineVersion: record.pipelineVersion,
    metadata: record.metadata,
    statistics: record.statistics,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

async function validateGraph(graphId) {
  const { graph, nodes, edges } = await graphLoader.loadGraphForValidation(graphId);

  const report = graphValidator.validateGraph(graphId, graph, nodes, edges);

  const { persistedReport, updatedGraph } = await prisma.$transaction((tx) =>
    validationRepositoryStage.persistValidationReport(graphId, report, tx)
  );

  return {
    graph: toNavigationGraph(updatedGraph),
    report: toGraphValidationReport(persistedReport),
  };
}

async function getLatestValidation(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  const record = await graphValidationReportRepository.findLatestByGraphId(graphId);

  if (!record) {
    const error = new Error("This graph has not been validated yet");
    error.statusCode = 404;
    throw error;
  }

  return toGraphValidationReport(record);
}

module.exports = {
  validateGraph,
  getLatestValidation,
};
