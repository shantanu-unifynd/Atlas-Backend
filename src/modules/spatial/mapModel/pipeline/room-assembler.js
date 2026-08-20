// MPM-03 — assemble renderable room polygons from normalized geometry, then
// associate each with its USO/Semantic data where available. Graceful by
// design: a boundary that cannot form a valid polygon is simply skipped, and
// any labeled navigation node not covered by a polygon is emitted as a point
// room — generation never fails.

const { regularizeRing } = require("./polygon-regularizer");

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

// BXP-01.3 — a primitive's own segments are in the order the SVG author
// happened to draw them, which is NOT guaranteed to run head-to-tail
// around the room (topology-builder.js's boundary.primitiveIds is in
// correct face-walk order — deduped from face.edgeIds, which IS built one
// half-edge at a time in walk order — but each individual primitive can
// still be authored backwards relative to that walk). Returns this
// primitive's own point sequence, EVERY intermediate point included (not
// just first/last), in its native authored direction; the caller decides
// whether to use it forward or reversed against the ring built so far.
function primitiveOwnPoints(primitive) {
  const pts = [];
  const push = (p) => {
    const last = pts[pts.length - 1];
    if (!last || !samePoint(last, p)) pts.push({ x: p.x, y: p.y });
  };
  for (const s of primitive.segments) {
    push({ x: s.x1, y: s.y1 });
    push({ x: s.x2, y: s.y2 });
  }
  return pts;
}

// Chain a boundary's primitives into one continuous ring, in the order
// boundary.primitiveIds already provides (topology's face-walk order — see
// topology-builder.js), orienting each primitive's own points forward or
// reversed by matching against the ring's current end point rather than
// trusting the primitive's authored direction. This is the ONLY place that
// decides ring point order — it reads the ordering/connectivity topology
// already computed, it does not re-derive connectivity independently.
function ringFromBoundary(boundary, primitivesById) {
  const ids = Array.isArray(boundary.primitiveIds) ? boundary.primitiveIds : [];
  const ring = [];

  const append = (piece) => {
    for (const p of piece) {
      const last = ring[ring.length - 1];
      if (!last || !samePoint(last, p)) ring.push(p);
    }
  };

  function firstNonEmptyPieceFrom(startIndex) {
    for (let i = startIndex; i < ids.length; i += 1) {
      const p = primitivesById.get(ids[i]);
      if (p && Array.isArray(p.segments) && p.segments.length > 0) {
        return primitiveOwnPoints(p);
      }
    }
    return null;
  }

  for (let idx = 0; idx < ids.length; idx += 1) {
    const prim = primitivesById.get(ids[idx]);
    if (!prim || !Array.isArray(prim.segments) || prim.segments.length === 0) continue;

    const piece = primitiveOwnPoints(prim);
    if (piece.length === 0) continue;

    const cursor = ring[ring.length - 1];

    if (!cursor) {
      // First piece in the boundary: there's no running cursor yet to
      // match against, but the primitive's OWN authored direction isn't
      // guaranteed to be the one that continues into the next piece
      // either (e.g. two walls sharing corner (0,0), each independently
      // authored starting from a different end). Orient by checking which
      // end connects to the NEXT piece instead of assuming authored order.
      const nextPiece = firstNonEmptyPieceFrom(idx + 1);
      const nextEndpoints = nextPiece ? [nextPiece[0], nextPiece[nextPiece.length - 1]] : [];
      const endsAtNext = nextEndpoints.some((p) => samePoint(p, piece[piece.length - 1]));
      const startsAtNext = nextEndpoints.some((p) => samePoint(p, piece[0]));

      if (!endsAtNext && startsAtNext) {
        append([...piece].reverse());
      } else {
        // Either the authored direction already ends at the next piece,
        // or connectivity couldn't be determined (single-primitive
        // boundary, or a genuine gap) — authored order is as good a
        // starting orientation as any for a closed ring.
        append(piece);
      }
    } else if (samePoint(cursor, piece[0])) {
      append(piece);
    } else if (samePoint(cursor, piece[piece.length - 1])) {
      append([...piece].reverse());
    } else {
      // Neither end connects to the current point — this piece doesn't
      // chain as topology said it should. Append as authored rather than
      // silently dropping geometry; the resulting ring's own area/validity
      // checks downstream will catch a genuinely bad result instead of
      // this failing silently or guessing further.
      append(piece);
    }
  }

  if (ring.length >= 2 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();
  return ring;
}

function assembleRooms({ primitives, boundaries, nodes, usoByCandidateId, semanticByUsoId }) {
  const primitivesById = new Map(primitives.map((p) => [p.id, p]));
  const labeledNodes = nodes.filter((n) => n && n.label);
  const rooms = [];
  const usedNodeIds = new Set();
  let polygonCount = 0;

  for (const boundary of boundaries) {
    // BXP-02: regularize immediately after the ring is assembled and before
    // anything downstream (area/centroid/point-in-polygon, or the room's
    // stored polygon) uses it — the narrowest point after a valid ring is
    // extracted, and before room/MPM assembly consumes it.
    const ring = regularizeRing(ringFromBoundary(boundary, primitivesById));
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
