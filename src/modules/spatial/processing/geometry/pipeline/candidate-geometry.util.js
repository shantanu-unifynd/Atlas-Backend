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

// BXP-01 — nodeIds now arrives already ordered into a valid closed ring,
// traced upstream by topology-builder.js's real planar face extraction
// (see traceInteriorFaces there). The old version here re-derived ring
// order itself from an unordered node set and gave up the instant any node
// had degree != 2 in that induced subgraph — i.e. any T-junction or shared
// wall — which is exactly why a connected multi-room mesh used to produce
// zero rooms. There's nothing left to re-derive; this just materializes the
// known-ordered ids into points, still defensively confirming (rather than
// assuming) that each consecutive pair really is connected by a real edge,
// so a malformed upstream ring is caught here instead of silently rendered.
function traceRing(nodeIds, edges, nodesById) {
  if (!Array.isArray(nodeIds) || nodeIds.length < 3) {
    return null;
  }

  const ring = nodeIds.map((id) => nodesById.get(id));

  if (ring.some((node) => !node)) {
    return null;
  }

  const connected = new Set(edges.map((edge) => `${edge.fromNodeId}|${edge.toNodeId}`));
  const isEdge = (a, b) => connected.has(`${a}|${b}`) || connected.has(`${b}|${a}`);

  for (let i = 0; i < nodeIds.length; i += 1) {
    const next = nodeIds[(i + 1) % nodeIds.length];
    if (!isEdge(nodeIds[i], next)) {
      return null;
    }
  }

  return ring;
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
