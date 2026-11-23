// Bulk "remove rooms inside this one" (engulfed cleanup). Pure geometry so it is
// unit-testable. A room R is ENGULFED by container C when EVERY vertex of R is
// inside C's polygon and R is smaller than C. Strictly-inside only: a room that
// pokes even one vertex outside C (or merely touches the boundary) is NOT
// engulfed, so partial overlaps are never swept up. Point-fallback rooms (no
// polygon) count as engulfed when their single point is inside C.

function pointInPolygon(pt, poly) {
  if (!pt || !Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const denom = yj - yi || 1e-12;
    const hit = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / denom + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// The points that must all be inside the container for the room to be engulfed.
function roomPoints(room) {
  if (Array.isArray(room.polygon) && room.polygon.length >= 3) return room.polygon;
  if (room.point && Number.isFinite(room.point.x)) return [room.point];
  if (room.centroid && Number.isFinite(room.centroid.x)) return [room.centroid];
  return [];
}

function roomArea(room) {
  if (typeof room.area === 'number') return room.area;
  if (Array.isArray(room.polygon) && room.polygon.length >= 3) return polygonArea(room.polygon);
  return 0; // point rooms have no area -> always smaller than a real container
}

function isEngulfed(container, room) {
  if (!container || !room || room.id === container.id) return false;
  const cpoly = Array.isArray(container.polygon) && container.polygon.length >= 3 ? container.polygon : null;
  if (!cpoly) return false;
  const pts = roomPoints(room);
  if (!pts.length) return false;
  if (!pts.every((p) => pointInPolygon(p, cpoly))) return false;
  return roomArea(room) < polygonArea(cpoly);
}

// Ids of every room engulfed by the container room.
function containedRoomIds(container, rooms) {
  return (rooms || []).filter((r) => isEngulfed(container, r)).map((r) => r.id);
}

module.exports = { pointInPolygon, isEngulfed, containedRoomIds };
