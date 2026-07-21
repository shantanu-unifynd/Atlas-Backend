const loader = require("../pipeline/loader");
const comparisonBuilder = require("../pipeline/comparison-builder");
const comparisonValidator = require("../pipeline/comparison-validator");
const responseBuilder = require("../pipeline/response-builder");

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

// Sprint 08 Story 04 — Route Comparison Engine. Orchestration only. Never
// computes a path itself — every route comes from Sprint 08 Story 03's
// computeRoute, called once per RoutingContext. Nothing is persisted.
async function compareRoutes(graphId, originNodeId, destinationNodeId, routingContextIds) {
  const { routingContexts } = await loader.load(
    graphId,
    originNodeId,
    destinationNodeId,
    routingContextIds
  );

  const comparisons = await comparisonBuilder.buildComparisons(
    graphId,
    routingContexts,
    originNodeId,
    destinationNodeId
  );

  if (comparisons.length === 0) {
    throw notFoundError(
      "No successful routes were found for any of the supplied routing contexts"
    );
  }

  const seenPreferences = new Set();

  for (const entry of comparisons) {
    if (seenPreferences.has(entry.preference)) {
      throw validationError(
        `Duplicate preference '${entry.preference}' among the supplied routing contexts`
      );
    }

    seenPreferences.add(entry.preference);
  }

  const { errors } = comparisonValidator.validate(comparisons, originNodeId, destinationNodeId);

  if (errors.length > 0) {
    throw new Error(`Route Comparison produced invalid output: ${errors.join(", ")}`);
  }

  return responseBuilder.build(graphId, originNodeId, destinationNodeId, comparisons);
}

module.exports = { compareRoutes };
