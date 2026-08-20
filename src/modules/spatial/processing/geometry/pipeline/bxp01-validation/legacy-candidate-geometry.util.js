// BXP-01 — frozen, verbatim copy of the PRE-fix traceRing()/shoelaceArea()
// from candidate-geometry.util.js, kept only for the old-vs-new comparison
// script. Not imported by any production code.

function shoelaceArea(points) {
  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }

  return Math.abs(sum) / 2;
}

function traceRing(nodeIds, edges, nodesById) {
  const nodeIdSet = new Set(nodeIds);
  const adjacency = new Map(nodeIds.map((id) => [id, []]));

  for (const edge of edges) {
    if (nodeIdSet.has(edge.fromNodeId) && nodeIdSet.has(edge.toNodeId)) {
      adjacency.get(edge.fromNodeId).push(edge.toNodeId);
      adjacency.get(edge.toNodeId).push(edge.fromNodeId);
    }
  }

  if ([...adjacency.values()].some((neighbors) => neighbors.length !== 2)) {
    return null;
  }

  const start = nodeIds[0];
  const ring = [start];
  let previous = null;
  let current = start;

  do {
    const neighbors = adjacency.get(current);
    const next = neighbors[0] === previous ? neighbors[1] : neighbors[0];

    if (next === start) break;

    ring.push(next);
    previous = current;
    current = next;
  } while (ring.length <= nodeIds.length);

  if (ring.length !== nodeIds.length) {
    return null;
  }

  return ring.map((id) => nodesById.get(id));
}

module.exports = { traceRing, shoelaceArea };
