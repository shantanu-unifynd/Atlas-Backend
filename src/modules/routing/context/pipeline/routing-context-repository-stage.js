const routingContextRepository = require("../../../../repositories/routingContext/routingContext.repository");

// Stage 3 — Repository Stage. Persists only the RoutingContext itself.
// No NavigationGraph/NavigationNode/NavigationEdge/Route/RouteSegment/
// RouteStatistics write ever happens here or anywhere in this pipeline —
// no lifecycle transitions, no metadata/statistics updates on any other
// domain.
function persistRoutingContext(data) {
  return routingContextRepository.create(data);
}

module.exports = { persistRoutingContext };
