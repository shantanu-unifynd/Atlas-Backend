const navigationSessionRepository = require("../../../../../repositories/navigationSession/navigationSession.repository");

// Stage 4 — Repository Stage. Persists only `state`. No metadata/route
// writes, no writes to any other domain — reuses NavigationSessionRepository
// unchanged.
function persistState(id, nextState) {
  return navigationSessionRepository.update(id, { state: nextState });
}

module.exports = { persistState };
