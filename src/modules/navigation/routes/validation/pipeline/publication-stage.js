const routeRepository = require("../../../../../repositories/route/route.repository");

// Stage 4 — Publication. The ONLY stage that writes anything, and the
// ONLY thing it writes is Route.status. VALID -> READY, INVALID -> FAILED.
// No RouteSegment, RouteStatistics, or NavigationGraph write ever happens
// here or anywhere else in this pipeline.
async function publish(routeId, validationStatus) {
  const status = validationStatus === "VALID" ? "READY" : "FAILED";

  return routeRepository.update(routeId, { status });
}

module.exports = { publish };
