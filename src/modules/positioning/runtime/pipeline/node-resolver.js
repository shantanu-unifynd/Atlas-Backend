// Stage 2 — Node Resolver. Pure: given Position coordinates and a
// NavigationGraph's nodes, determines the nearest NavigationNode by
// straight-line (Euclidean) distance. Performs ONLY node resolution — no
// progress computation, no segment logic.
//
// No story prior to this one ever populates real coordinates on
// NavigationNode.position (Sprint 06's node-generation pipeline inherits
// `position: candidate.position`, which candidate-detector.js never sets
// beyond the schema default `{}`). Nodes without usable {x,y} data are
// therefore excluded from consideration rather than treated as a crash —
// "nearest node cannot be determined" is a legitimate, expected outcome
// against real production data today.
function hasUsableCoordinates(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function euclideanDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function resolveNearestNode(coordinates, nodes) {
  if (!hasUsableCoordinates(coordinates)) {
    return null;
  }

  const candidates = nodes.filter((node) => hasUsableCoordinates(node.position));

  if (candidates.length === 0) {
    return null;
  }

  let nearestNode = null;
  let nearestDistance = Infinity;

  for (const node of candidates) {
    const distance = euclideanDistance(coordinates, node.position);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestNode = node;
    }
  }

  return { node: nearestNode, distance: nearestDistance };
}

module.exports = { resolveNearestNode, euclideanDistance, hasUsableCoordinates };
