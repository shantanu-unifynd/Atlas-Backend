// BXP-02 — Polygon Regularization. Cleans a room ring's POINT
// REPRESENTATION only: it never changes which face/room a ring represents,
// never merges or splits rooms, and never invents geometry. Applied at the
// narrowest point after a valid ring has been assembled (ringFromBoundary in
// room-assembler.js) and before it is used for area/centroid/point-in-
// polygon or returned as a room's polygon.
//
// EPS reuses room-assembler.js's own existing samePoint() epsilon (0.05
// world units) rather than inventing a new tolerance — that value is
// already established and proven appropriate for this coordinate system
// (e.g. the real BuildingSVG floor spans ~650x904 units; 0.05 is a small
// fraction of a percent of that span).
const EPS = 0.05;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Perpendicular distance from `point` to the infinite line through
// `lineStart`/`lineEnd`. Used to decide whether `point` adds any real shape
// information versus just lying on an already-straight run between its
// neighbors.
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distance(point, lineStart);
  }

  const cross = Math.abs(dx * (lineStart.y - point.y) - (lineStart.x - point.x) * dy);
  return cross / Math.sqrt(lengthSquared);
}

function signedArea(points) {
  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    sum += p.x * q.y - q.x * p.y;
  }

  return sum / 2;
}

// Drops consecutive (including wraparound last->first) duplicate/near-
// duplicate points — rounding noise from concatenating adjacent primitives'
// segments, not real shape information.
function dedupeConsecutive(points) {
  const deduped = [];

  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (!last || distance(last, point) >= EPS) {
      deduped.push(point);
    }
  }

  if (deduped.length > 1 && distance(deduped[0], deduped[deduped.length - 1]) < EPS) {
    deduped.pop();
  }

  return deduped;
}

// Repeatedly drops any vertex lying within EPS of the straight line through
// its two neighbors, to a fixpoint — removing one collinear vertex can
// reveal the next one now also being collinear with its new neighbors
// (e.g. three or more points strung along one straight wall run).
function dropRedundantCollinear(points) {
  let current = points;
  let changed = true;

  while (changed && current.length > 3) {
    changed = false;
    const next = [];

    for (let i = 0; i < current.length; i += 1) {
      const prev = current[(i - 1 + current.length) % current.length];
      const point = current[i];
      const after = current[(i + 1) % current.length];

      if (perpendicularDistance(point, prev, after) < EPS) {
        changed = true;
        continue;
      }

      next.push(point);
    }

    current = next;
  }

  return current;
}

// Regularizes a ring's point representation without changing its topology:
// only ever removes points that are redundant given their neighbors. Never
// adds, moves, or reinterprets a vertex, never changes area beyond the
// negligible amount contributed by truly-collinear (already-straight)
// points, and never changes which room this ring represents. Idempotent by
// construction: a ring with no consecutive duplicates and no collinear
// vertices left is returned unchanged by a second call.
//
// Axis-snapping (regularizing near-horizontal/vertical edges to exactly
// horizontal/vertical) is intentionally NOT implemented here — see
// bxp02-validation's snapping-must-not-occur test and the BXP-02 report for
// why it's deferred rather than attempted unsafely.
function regularizeRing(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return points;
  }

  const deduped = dedupeConsecutive(points);

  if (deduped.length < 3) {
    // Couldn't safely simplify without risking losing the shape entirely —
    // return the original, unmodified, rather than guess.
    return points;
  }

  const simplified = dropRedundantCollinear(deduped);

  if (simplified.length < 3) {
    // Collinear removal collapsed too far (a degenerate sliver) — fall back
    // to the deduped-but-not-collinear-simplified ring rather than lose the
    // room entirely.
    return deduped;
  }

  // Normalize winding to one consistent orientation (counter-clockwise, i.e.
  // positive signed area) — reorders points only, never changes shape/area.
  return signedArea(simplified) < 0 ? [...simplified].reverse() : simplified;
}

module.exports = { regularizeRing, EPS, dedupeConsecutive, dropRedundantCollinear, perpendicularDistance, distance, signedArea };
