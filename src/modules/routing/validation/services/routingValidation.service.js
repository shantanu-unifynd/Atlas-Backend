const loader = require("../pipeline/loader");
const validator = require("../pipeline/validator");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 08 Story 05 — Routing Validation & Publication. Orchestration
// only. Validates that the PREFERENCE LAYER (RoutingContext -> Policy
// Engine -> Preference-Aware Routing -> Comparison) behaved correctly —
// never re-validates the Navigation Graph or the Route domain, both
// already complete. Validation is transient: nothing is ever persisted,
// and this endpoint always returns 200 once the underlying comparison
// succeeds — HTTP-level rejections (404/400/409) come only from Stage 1
// reusing Story 04's own preconditions, never from validation findings.
async function validateRouting(graphId, originNodeId, destinationNodeId, routingContextIds) {
  const { comparisonResult, edges, requestedContextIds } = await loader.load(
    graphId,
    originNodeId,
    destinationNodeId,
    routingContextIds
  );

  const { errors, warnings, routeOutcomes } = validator.validate(
    comparisonResult,
    edges,
    requestedContextIds
  );

  return responseBuilder.build(comparisonResult, errors, warnings, routeOutcomes);
}

module.exports = { validateRouting };
