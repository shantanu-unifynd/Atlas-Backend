// Single source of truth for the "Remove room" feature (Part 3 follow-up).
//
// Flag OFF (default): the write endpoints are disabled and the admin UI is
// hidden, but read-filtering + generate-suppression STAY ON so any tombstones
// already created keep being respected. This is a deliberate rollback posture:
// turning the flag off stops NEW removals without resurrecting removed rooms.
function isRoomRemovalEnabled() {
  return String(process.env.ROOM_REMOVAL_ENABLED || "").toLowerCase() === "true";
}

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Best-effort re-match of an AUTO room after a re-extraction (ids renumber).
// Tolerances live here, not as inline magic numbers.
//   centroid   — max distance (world units) between tombstone + candidate centroids
//   areaRatio  — max fractional area difference, e.g. 0.1 = within ±10%
const tombstoneMatchTolerances = {
  centroid: num(process.env.ROOM_TOMBSTONE_CENTROID_TOL, 8),
  areaRatio: num(process.env.ROOM_TOMBSTONE_AREA_RATIO_TOL, 0.1),
};

// Stamped on tombstones until real auth/user context exists. TODO(auth): replace
// with the authenticated admin identity once the admin endpoints have one.
const SYSTEM_ACTOR = "system:admin";

module.exports = { isRoomRemovalEnabled, tombstoneMatchTolerances, SYSTEM_ACTOR };
