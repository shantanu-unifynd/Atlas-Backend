class GraphValidationReport {
  constructor({
    id,
    graphId,
    validationStatus,
    warnings,
    errors,
    statistics,
    validatedAt,
    createdAt,
  }) {
    this.id = id;
    this.graphId = graphId;
    this.validationStatus = validationStatus;
    this.warnings = warnings;
    this.errors = errors;
    this.statistics = statistics;
    this.validatedAt = validatedAt;
    this.createdAt = createdAt;
  }
}

module.exports = GraphValidationReport;
