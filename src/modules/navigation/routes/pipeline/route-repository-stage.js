const routeRepository = require("../../../../repositories/route/route.repository");
const routeSegmentRepository = require("../../../../repositories/routeSegment/routeSegment.repository");
const routeStatisticsRepository = require("../../../../repositories/routeStatistics/routeStatistics.repository");

// Stage 4 — Route Repository Stage. Persists the Route, its RouteSegments,
// and its RouteStatistics in a single transaction, then marks the Route
// READY. Either all four writes commit or none do.
async function persistRoute(routeData, segmentsData, statisticsData, tx) {
  const route = await routeRepository.create(routeData, tx);

  if (segmentsData.length > 0) {
    await routeSegmentRepository.createMany(
      segmentsData.map((segment) => ({ ...segment, routeId: route.id })),
      tx
    );
  }

  await routeStatisticsRepository.create({ routeId: route.id, statistics: statisticsData }, tx);

  const readyRoute = await routeRepository.update(route.id, { status: "READY" }, tx);

  return readyRoute;
}

module.exports = { persistRoute };
