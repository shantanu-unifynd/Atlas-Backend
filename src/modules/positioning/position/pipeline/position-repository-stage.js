const positionRepository = require("../../../../repositories/position/position.repository");

// Stage 3 — Repository Stage. Persists only the Position itself. No
// NavigationGraph/NavigationNode/NavigationEdge/Route/NavigationSession
// write ever happens here or anywhere in this pipeline — no positioning
// logic, no provider logic, no movement.
function persistPosition(data) {
  return positionRepository.create(data);
}

module.exports = { persistPosition };
