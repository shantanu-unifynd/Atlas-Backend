const { deriveCoordinates } = require("../utils/deterministicHash");

// Stage 3 — Position Generator. Pure: given the current step's resolved
// NavigationNode, derives the coordinates representing the simulated
// walker's current location.
//
// Prefers the node's own real {x,y} position data when present. No story
// prior to Sprint 10 ever populates real node coordinates in the actual
// generation pipeline (`position` defaults to `{}`), so in real
// production data this falls back to a deterministic hash of the node's
// own id — stable and reproducible, though (like Sprint 10 Story 03's own
// documented limitation) it cannot correctly drive Runtime resolution
// until real geometry populates node coordinates, since the Runtime's
// node-resolver compares against that same (still-empty) node.position
// data, not against the Position's coordinates in isolation.
function hasUsableCoordinates(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function deriveCoordinatesForNode(node) {
  if (hasUsableCoordinates(node.position)) {
    return { x: node.position.x, y: node.position.y };
  }

  return deriveCoordinates(node.id);
}

module.exports = { deriveCoordinatesForNode };
