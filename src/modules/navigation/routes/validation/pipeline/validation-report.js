// Stage 3 — Validation Report. Pure function: no VALID_WITH_WARNINGS state
// — only VALID or INVALID, per this story's explicit two-state result.
function buildReport(errors, statistics) {
  return {
    errors,
    statistics: statistics ? statistics.statistics : null,
    validatedAt: new Date().toISOString(),
    validationStatus: errors.length > 0 ? "INVALID" : "VALID",
  };
}

module.exports = { buildReport };
