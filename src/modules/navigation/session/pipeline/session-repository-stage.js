const navigationSessionRepository = require("../../../../repositories/navigationSession/navigationSession.repository");

// Stage 3 — Repository Stage. Persists only the NavigationSession itself.
// No Route/RouteSegment/RouteStatistics write ever happens here or
// anywhere in this pipeline — no lifecycle transitions, no progress or
// event writes on any domain.
function persistNavigationSession(data) {
  return navigationSessionRepository.create(data);
}

module.exports = { persistNavigationSession };
