// Repeatable DB-integration check for bulk "remove rooms inside this one".
//   node scripts/remove-contained.check.js
// Builds a THROWAWAY floor with a big container room, rooms inside it, and one
// room poking outside, then verifies listContainedRooms counts only the inside
// ones and removeContainedRooms removes exactly those (one regenerate). Always
// cleaned up.
const { PrismaClient } = require("@prisma/client");
const svc = require("../src/modules/spatial/mapModel/services/mapModel.service");

const p = new PrismaClient();
let fails = 0;
const ok = (l, c) => { console.log((c ? "ok  - " : "FAIL- ") + l); if (!c) fails += 1; };
const has = (mpm, id) => (mpm && mpm.data && mpm.data.rooms || []).some((r) => r.id === id);
const NAME = "ContainedCheck (throwaway)";
const sq = (x0, y0, x1, y1, id, name) => ({ id, name, source: "SEMANTIC", polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });

async function cleanup() {
  for (const b of await p.building.findMany({ where: { name: NAME }, select: { id: true } })) {
    const fs = await p.floor.findMany({ where: { buildingId: b.id }, select: { id: true } });
    const ids = fs.map((f) => f.id);
    await p.roomTombstone.deleteMany({ where: { floorId: { in: ids } } });
    await p.mapPresentationModel.deleteMany({ where: { floorId: { in: ids } } });
    await p.floor.deleteMany({ where: { buildingId: b.id } });
    await p.building.delete({ where: { id: b.id } });
  }
}

(async () => {
  await cleanup();
  const data = {
    source: "auto-extract",
    coordinateSystem: { bounds: { minX: 0, minY: 0, maxX: 1100, maxY: 1100 } },
    rooms: [
      sq(0, 0, 1000, 1000, "room-C", "CONTAINER"),
      sq(100, 100, 200, 200, "room-1", "in-1"),
      sq(300, 300, 400, 400, "room-2", "in-2"),
      { id: "room-3", name: "in-point", source: "SEMANTIC", point: { x: 500, y: 500 } },
      sq(950, 950, 1100, 1100, "room-4", "pokes-out"),
    ],
    walls: [],
    graph: null,
  };

  const bldg = await p.building.create({ data: { code: "CTD-" + Date.now(), name: NAME, country: "IN", city: "NA", address: "safe to delete", timezone: "Asia/Kolkata", status: "ACTIVE" } });
  const fl = await p.floor.create({ data: { buildingId: bldg.id, level: 0, name: "G", status: "ACTIVE" } });
  await p.mapPresentationModel.create({ data: { floorId: fl.id, version: 1, status: "PUBLISHED", data } });

  const preview = await svc.listContainedRooms(fl.id, "room-C");
  ok("listContainedRooms counts the 3 inside rooms", preview.count === 3);
  ok("preview excludes the container + the room poking outside", !preview.rooms.some((r) => r.roomId === "room-C" || r.roomId === "room-4"));

  const res = await svc.removeContainedRooms(fl.id, "room-C");
  ok("removeContainedRooms removes exactly 3", res.count === 3 && res.removedRoomIds.length === 3);

  const after = await svc.getByFloorId(fl.id);
  ok("the 3 inside rooms are gone", !has(after, "room-1") && !has(after, "room-2") && !has(after, "room-3"));
  ok("the container stays", has(after, "room-C"));
  ok("the room poking outside stays (partial overlap untouched)", has(after, "room-4"));

  const second = await svc.removeContainedRooms(fl.id, "room-C");
  ok("idempotent: a second call finds nothing new to remove", second.count === 0);

  await cleanup();
  console.log("cleaned up throwaway");
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL REMOVE-CONTAINED CHECKS PASSED");
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("ERR", e.stack || e.message); p.$disconnect(); process.exit(1); });
