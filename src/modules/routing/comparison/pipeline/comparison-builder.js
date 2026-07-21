const preferenceRoutingService = require("../../preferenceRouting/services/preferenceRouting.service");

// Stage 2 — Comparison Builder. Pure orchestration of Sprint 08 Story 03 —
// no routing/algorithm logic exists here at all. For each RoutingContext,
// calls Story 03's computeRoute UNCHANGED and collects the result.
//
// A per-context 404 ("no route exists") is a legitimate ROUTING outcome
// for that specific context — it is skipped, not fatal, since other
// contexts may still succeed (the top-level "no successful routes" check
// only fires if every context fails). Any other error (400/409/etc.)
// reflects a problem with the request/graph itself, identical across every
// context, so it is rethrown immediately rather than silently absorbed.
async function buildComparisons(graphId, routingContexts, originNodeId, destinationNodeId) {
  const comparisons = [];

  for (const routingContext of routingContexts) {
    let route;

    try {
      route = await preferenceRoutingService.computeRoute(
        routingContext.id,
        graphId,
        originNodeId,
        destinationNodeId
      );
    } catch (error) {
      if (error.statusCode === 404) {
        continue;
      }

      throw error;
    }

    comparisons.push({
      routingContextId: routingContext.id,
      preference: route.preference,
      totalCost: route.totalCost,
      hopCount: route.path.length - 1,
      path: route.path,
    });
  }

  return comparisons;
}

module.exports = { buildComparisons };
