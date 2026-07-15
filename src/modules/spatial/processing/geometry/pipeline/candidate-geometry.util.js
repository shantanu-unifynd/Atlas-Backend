// Shared geometric helpers for candidate classification and relationship
// derivation: bounding boxes, area, and closed-loop ring tracing. Kept
// separate from svg-geometry.util.js (Phase B's primitive-level parsing) —
// these operate on already-cleaned geometry and topology, never on raw SVG.

function boundingBoxOfPoints(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function boundingBoxOfPrimitive(primitive) {
  const g = primitive.geometry;

  switch (primitive.type) {
    case "line":
      return boundingBoxOfPoints([
        { x: g.x1, y: g.y1 },
        { x: g.x2, y: g.y2 },
      ]);
    case "rect":
      return { minX: g.x, minY: g.y, maxX: g.x + g.width, maxY: g.y + g.height };
    case "circle":
      return { minX: g.cx - g.r, minY: g.cy - g.r, maxX: g.cx + g.r, maxY: g.cy + g.r };
    case "ellipse":
      return { minX: g.cx - g.rx, minY: g.cy - g.ry, maxX: g.cx + g.rx, maxY: g.cy + g.ry };
    case "polyline":
    case "polygon":
      return boundingBoxOfPoints(g.points);
    case "path":
      return boundingBoxOfPoints(primitive.segments.flatMap((s) => [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]));
    case "text":
      return { minX: g.x, minY: g.y, maxX: g.x, maxY: g.y };
    default:
      return null;
  }
}

function unionBoundingBox(boxes) {
  const valid = boxes.filter(Boolean);

  if (valid.length === 0) return null;

  return {
    minX: Math.min(...valid.map((b) => b.minX)),
    minY: Math.min(...valid.map((b) => b.minY)),
    maxX: Math.max(...valid.map((b) => b.maxX)),
    maxY: Math.max(...valid.map((b) => b.maxY)),
  };
}

function bboxWidth(box) {
  return box.maxX - box.minX;
}

function bboxHeight(box) {
  return box.maxY - box.minY;
}

function bboxOverlap(a, b) {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

function bboxContains(outer, inner) {
  return (
    outer.minX <= inner.minX && outer.minY <= inner.minY && outer.maxX >= inner.maxX && outer.maxY >= inner.maxY
  );
}

function bboxGap(a, b) {
  const dx = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
  const dy = Math.max(a.minY - b.maxY, b.minY - a.maxY, 0);

  return Math.hypot(dx, dy);
}

function shoelaceArea(points) {
  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }

  return Math.abs(sum) / 2;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Traces a simple closed ring through a set of node ids using only the
// given edges. Returns null (rather than guessing) if any node in the set
// doesn't have exactly degree 2 within the induced subgraph — i.e. the
// topology branches, and there's no single unambiguous ring to trace.
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

module.exports = {
  boundingBoxOfPrimitive,
  unionBoundingBox,
  bboxWidth,
  bboxHeight,
  bboxOverlap,
  bboxContains,
  bboxGap,
  shoelaceArea,
  distance,
  traceRing,
};
