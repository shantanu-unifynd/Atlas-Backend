const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");
const comparisonService = require("../../comparison/services/comparison.service");

// Stage 1 — Loader. Executes Sprint 08 Story 04's comparison UNCHANGED —
// every 404/400/409 this story can produce (graph missing, graph not
// READY, context missing, duplicate context IDs, duplicate preferences,
// no successful routes, malformed request) is Story 04's own error,
// propagated as-is, not reimplemented here. The only thing this stage adds
// is loading NavigationEdges, which Story 04's comparison result doesn't
// include but Stage 2 needs to recompute effective costs (Rule 6). Read-only.
async function load(graphId, originNodeId, destinationNodeId, routingContextIds) {
  const comparisonResult = await comparisonService.compareRoutes(
    graphId,
    originNodeId,
    destinationNodeId,
    routingContextIds
  );

  const edges = await navigationEdgeRepository.findAllByGraphId(graphId);

  return { comparisonResult, edges, requestedContextIds: routingContextIds };
}

module.exports = { load };
