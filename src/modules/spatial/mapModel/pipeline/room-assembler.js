// MPM-03 — assemble renderable room polygons from normalized geometry, then
// associate each with its USO/Semantic data where available. Graceful by
// design: a boundary that cannot form a valid polygon is simply skipped, and
// any labeled navigation node not covered by a polygon is emitted as a point
// room — generation never fails.

const MIN_AREA = 25; // world-unit^2 — drop specks/degenerate rings
const EPS = 0.05;

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

function shoelaceArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function centroidOf(pts) {
  const c = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: Math.round((c.x / pts.length) * 100) / 100, y: Math.round((c.y / pts.length) * 100) / 100 };
}

function pointInPolygon(pt, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const a = pts[i];
    const b = pts[j];
    const intersect = a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Chain a boundary's primitive segments into an ordered ring of points.
function ringFromBoundary(boundary, primitivesById) {
  const ids = Array.isArray(boundary.primitiveIds) ? boundary.primitiveIds : [];
  const pts = [];
  const push = (p) => {
    const last = pts[pts.length - 1];
    if (!last || !samePoint(last, p)) pts.push({ x: p.x, y: p.y });
  };
  for (const pid of ids) {
    const prim = primitivesById.get(pid);
    if (!prim || !Array.isArray(prim.segments)) continue;
    for (const s of prim.segments) {
      push({ x: s.x1, y: s.y1 });
      push({ x: s.x2, y: s.y2 });
    }
  }
  if (pts.length >= 2 && samePoint(pts[0], pts[pts.length - 1])) pts.pop();
  return pts;
}

function assembleRooms({ primitives, boundaries, nodes, usoByCandidateId, semanticByUsoId }) {
  const primitivesById = new Map(primitives.map((p) => [p.id, p]));
  const labeledNodes = nodes.filter((n) => n && n.label);
  const rooms = [];
  const usedNodeIds = new Set();
  let polygonCount = 0;

  for (const boundary of boundaries) {
    const ring = ringFromBoundary(boundary, primitivesById);
    if (ring.length < 3) continue;
    const area = shoelaceArea(ring);
    if (area < MIN_AREA) continue;
    polygonCount += 1;

    const uso = usoByCandidateId.get(boundary.id) || null;
    const semantic = uso ? semanticByUsoId.get(uso.id) : null;
    const category = (semantic && semantic.semanticCategory) || (uso && uso.spatialCategory) || null;

    let name = null;
    for (const n of labeledNodes) {
      if (!usedNodeIds.has(n.id) && pointInPolygon(n.position, ring)) {
        name = n.label;
        usedNodeIds.add(n.id);
        break;
      }
    }

    rooms.push({
      id: `room-${boundary.id}`,
      polygon: ring,
      centroid: centroidOf(ring),
      area: Math.round(area * 100) / 100,
      category,
      name,
      source: "SEMANTIC",
    });
  }

  // Graceful fallback: every labeled node not inside a polygon becomes a point room.
  for (const n of labeledNodes) {
    if (usedNodeIds.has(n.id)) continue;
    rooms.push({
      id: `room-node-${n.id}`,
      polygon: null,
      point: n.position,
      area: null,
      category: null,
      name: n.label,
      source: "SEMANTIC",
    });
  }

  return {
    rooms,
    stats: {
      roomCount: rooms.length,
      polygonRooms: polygonCount,
      pointRooms: rooms.length - polygonCount,
    },
  };
}

module.exports = { assembleRooms };
