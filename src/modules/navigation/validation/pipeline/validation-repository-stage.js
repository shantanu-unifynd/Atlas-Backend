const graphValidationReportRepository = require("../../../../repositories/graphValidationReport/graphValidationReport.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const { determineGraphStatus } = require("./publication-stage");

// Stage 3 — Validation Repository Stage. Persists the GraphValidationReport
// and applies the Stage 4 publication decision to the graph's lifecycle, in
// a single transaction. Never touches NavigationNode/NavigationEdge/
// NavigationCandidate/SemanticModel/UniversalSpatialObject/Geometry — the
// only "graph content" this touches is the graph's own status field.
async function persistValidationReport(graphId, report, tx) {
  const persistedReport = await graphValidationReportRepository.create(
    {
      graphId,
      validationStatus: report.validationStatus,
      warnings: report.warnings,
      errors: report.errors,
      statistics: report.statistics,
      validatedAt: new Date(),
    },
    tx
  );

  const graphStatus = determineGraphStatus(report.validationStatus);

  const updatedGraph = await navigationGraphRepository.update(graphId, { status: graphStatus }, tx);

  return { persistedReport, updatedGraph };
}

module.exports = { persistValidationReport };
