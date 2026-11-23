// Self-asserting check for the room-tombstone shared predicate (no JS runner on
// the backend). Run: node src/modules/spatial/mapModel/pipeline/room-tombstones.check.js
const { suppressedRoomIds, matchTombstone, roomArea, roomCentroid } = require("./room-tombstones");

let passed = 0;
const ok = (l, c) => { if (!c) { console.error("FAIL:", l); process.exit(1); } passed += 1; console.log("ok  -", l); };

const sq = (x0, y0, x1, y1, id) => ({ id, polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
const TOL = { centroid: 8, areaRatio: 0.1 };

const rooms = [sq(0, 0, 100, 100, "room-1"), sq(200, 0, 300, 100, "room-2"), { id: "room-manual-x", polygon: [{ x: 500, y: 500 }, { x: 540, y: 500 }, { x: 520, y: 540 }] }];

// exact id match
ok("exact id match suppresses that room", suppressedRoomIds(rooms, [{ id: "t1", roomId: "room-1" }], TOL).ids.has("room-1"));

// geometry match after id renumber (re-extraction): tombstone kept room-1's
// centroid (50,50)/area 10000 but id is now 'room-99'
const tReext = { id: "t2", roomId: "room-99", centroidX: 50, centroidY: 50, area: 10000 };
const g = suppressedRoomIds(rooms, [tReext], TOL);
ok("geometry match re-finds a renumbered room", g.ids.has("room-1") && g.unmatched.length === 0);

// area mismatch rejects the geometry match
const tAreaBad = { id: "t3", roomId: "x", centroidX: 50, centroidY: 50, area: 50000 };
ok("area outside tolerance -> unmatched (no_match)", suppressedRoomIds(rooms, [tAreaBad], TOL).unmatched[0].reason === "no_match");

// ambiguous: two identical-geometry candidates -> unmatched, suppress nothing
const dupRooms = [sq(0, 0, 100, 100, "a"), sq(0, 0, 100, 100, "b")];
const amb = suppressedRoomIds(dupRooms, [{ id: "t4", roomId: "gone", centroidX: 50, centroidY: 50, area: 10000 }], TOL);
ok("ambiguous match suppresses NOTHING", amb.ids.size === 0);
ok("ambiguous match is reported (never silent)", amb.unmatched[0].reason === "ambiguous_match" && amb.unmatched[0].candidates.length === 2);

// no geometry + id gone -> unmatched
ok("no-geometry + missing id -> unmatched", suppressedRoomIds(rooms, [{ id: "t5", roomId: "gone" }], TOL).unmatched[0].reason === "no_geometry");

// helpers
ok("roomArea of 100x100 square = 10000", roomArea(rooms[0]) === 10000);
ok("roomCentroid of 100x100 square = (50,50)", roomCentroid(rooms[0]).x === 50 && roomCentroid(rooms[0]).y === 50);

// mixed batch: one matched + one unmatched returned together
const mix = suppressedRoomIds(rooms, [{ id: "t6", roomId: "room-2" }, { id: "t7", roomId: "ghost" }], TOL);
ok("batch returns matched ids AND unmatched list", mix.ids.has("room-2") && mix.unmatched.length === 1);

console.log(`\n${passed} checks passed`);
