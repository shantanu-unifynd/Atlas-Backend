// "Remove room" — the ONE shared predicate used by both generate() (bake) and
// the read-time filters (getByFloorId, loadBuilding) so the two can never drift.
//
// A tombstone suppresses a room by EXACT id (stable across re-generate and for
// manual rooms) or, failing that, a best-effort GEOMETRY match (centroid + area)
// to survive a re-extraction that renumbers AUTO ids. An ambiguous geometry
// match (more than one candidate) is treated as UNMATCHED — we never suppress
// the wrong room. Unmatched tombstones are returned so callers can log/surface
// them (never a silent failure).

function roomCentroid(room) {
  if (Array.isArray(room.polygon) && room.polygon.length) {
    let x = 0;
    let y = 0;
    for (const p of room.polygon) {
      x += p.x;
      y += p.y;
    }
    return { x: x / room.polygon.length, y: y / room.polygon.length };
  }
  if (room.centroid && Number.isFinite(room.centroid.x)) return room.centroid;
  if (room.point && Number.isFinite(room.point.x)) return room.point;
  return null;
}

function roomArea(room) {
  if (typeof room.area === "number") return room.area;
  if (Array.isArray(room.polygon) && room.polygon.length >= 3) {
    let a = 0;
    for (let i = 0; i < room.polygon.length; i += 1) {
      const p = room.polygon[i];
      const q = room.polygon[(i + 1) % room.polygon.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  }
  return null;
}

// Status of one tombstone against the current room set.
// -> { status: 'matched', roomId } | { status: 'unmatched', reason } | { status: 'ambiguous', reason, candidates }
function matchTombstone(tombstone, rooms, tol) {
  if (rooms.some((r) => r.id === tombstone.roomId)) {
    return { status: "matched", roomId: tombstone.roomId };
  }
  const tc =
    tombstone.centroidX != null && tombstone.centroidY != null
      ? { x: tombstone.centroidX, y: tombstone.centroidY }
      : null;
  if (!tc) return { status: "unmatched", reason: "no_geometry" };

  const candidates = rooms.filter((r) => {
    const c = roomCentroid(r);
    if (!c) return false;
    if (Math.hypot(c.x - tc.x, c.y - tc.y) > tol.centroid) return false;
    const a = roomArea(r);
    if (tombstone.area != null && a != null) {
      const denom = Math.max(Math.abs(tombstone.area), 1e-9);
      if (Math.abs(a - tombstone.area) / denom > tol.areaRatio) return false;
    }
    return true;
  });
  if (candidates.length === 1) return { status: "matched", roomId: candidates[0].id };
  if (candidates.length === 0) return { status: "unmatched", reason: "no_match" };
  return { status: "ambiguous", reason: "ambiguous_match", candidates: candidates.map((c) => c.id) };
}

// The shared result: the set of room ids to drop + the tombstones that could not
// be resolved (for logging + the removed-rooms endpoint).
function suppressedRoomIds(rooms, tombstones, tol) {
  const ids = new Set();
  const unmatched = [];
  for (const t of tombstones || []) {
    const m = matchTombstone(t, rooms, tol);
    if (m.status === "matched") ids.add(m.roomId);
    else unmatched.push({ tombstoneId: t.id, roomId: t.roomId, reason: m.reason, candidates: m.candidates || [] });
  }
  return { ids, unmatched };
}

// Read-time wrapper: return a shallow-cloned MPM `data` with tombstoned rooms
// (and their derived labels) filtered out, plus the unmatched list. Uses the
// same suppressedRoomIds predicate as the generate() bake, so the two can't
// drift. Returns the original data untouched when there's nothing to drop.
function filterMpmData(data, tombstones, tol) {
  if (!data || !Array.isArray(data.rooms) || !tombstones || !tombstones.length) {
    return { data, unmatched: [] };
  }
  const { ids, unmatched } = suppressedRoomIds(data.rooms, tombstones, tol);
  if (!ids.size) return { data, unmatched };
  const rooms = data.rooms.filter((r) => !ids.has(r.id));
  const labels = Array.isArray(data.labels) ? data.labels.filter((l) => !ids.has(l.roomId)) : data.labels;
  return { data: { ...data, rooms, labels }, unmatched };
}

module.exports = { roomCentroid, roomArea, matchTombstone, suppressedRoomIds, filterMpmData };
