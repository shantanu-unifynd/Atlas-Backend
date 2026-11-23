// Repeatable DB-integration check for the "Remove room" service + controller.
// Run from the backend root:  node scripts/remove-restore.check.js
//
// Verifies removeRoom/restoreRoom/listRemovedRooms behavior (create, idempotent,
// list, restore, not-removed, 400 on a missing room) and the controller flag
// gate (404 when ROOM_REMOVAL_ENABLED is off). Throwaway building only; always
// cleaned up. SKIPS (exit 0) if no fixture floor exists.
delete process.env.ROOM_REMOVAL_ENABLED; // flag OFF (default) for the controller-gate assertion
const { PrismaClient } = require("@prisma/client");
const svc = require("../src/modules/spatial/mapModel/services/mapModel.service");
const ctrl = require("../src/modules/spatial/mapModel/controllers/mapModel.controller");

const p = new PrismaClient();
let fails = 0;
const ok = (l, c) => { console.log((c ? "ok  - " : "FAIL- ") + l); if (!c) fails += 1; };
const has = (mpm, id) => (mpm && mpm.data && mpm.data.rooms || []).some((r) => r.id === id);
const NAME = "RemoveCheck (throwaway)";

async function cleanupByName(name) {
  for (const b of await p.building.findMany({ where: { name }, select: { id: true } })) {
    const fs = await p.floor.findMany({ where: { buildingId: b.id }, select: { id: true } });
    const ids = fs.map((f) => f.id);
    await p.roomTombstone.deleteMany({ where: { floorId: { in: ids } } });
    await p.mapPresentationModel.deleteMany({ where: { floorId: { in: ids } } });
    await p.floor.deleteMany({ where: { buildingId: b.id } });
    await p.building.delete({ where: { id: b.id } });
  }
}

(async () => {
  await cleanupByName(NAME);

  const src = await p.mapPresentationModel.findFirst({ where: { status: "PUBLISHED" }, orderBy: { version: "desc" } });
  const withPoly0 = src && src.data && Array.isArray(src.data.rooms)
    ? src.data.rooms.filter((r) => Array.isArray(r.polygon) && r.polygon.length >= 3)
    : [];
  if (!withPoly0.length) {
    console.log("SKIP: no published floor with polygon rooms to use as a fixture");
    await p.$disconnect();
    process.exit(0);
  }

  const data = JSON.parse(JSON.stringify(src.data));
  data.source = "auto-extract";
  const target = data.rooms.filter((r) => Array.isArray(r.polygon) && r.polygon.length >= 3)[0];

  const bldg = await p.building.create({ data: { code: "RMCHK-" + Date.now(), name: NAME, country: "IN", city: "NA", address: "safe to delete", timezone: "Asia/Kolkata", status: "ACTIVE" } });
  const fl = await p.floor.create({ data: { buildingId: bldg.id, level: 0, name: "G", status: "ACTIVE" } });
  await p.mapPresentationModel.create({ data: { floorId: fl.id, version: 1, status: "PUBLISHED", data } });

  // service behavior (flag-independent)
  const r1 = await svc.removeRoom(fl.id, target.id, { reason: "test" });
  ok("removeRoom creates a tombstone + regenerates", !!r1.tombstone && typeof r1.mpmVersion === "number");
  ok("removed room is gone from the latest map", !has(await svc.getByFloorId(fl.id), target.id));

  const r1b = await svc.removeRoom(fl.id, target.id);
  ok("removeRoom is idempotent (alreadyRemoved)", r1b.alreadyRemoved === true);

  const listed = await svc.listRemovedRooms(fl.id);
  ok("listRemovedRooms returns the removed room, matched", listed.length === 1 && listed[0].roomId === target.id && listed[0].unmatched === false);

  const r2 = await svc.restoreRoom(fl.id, target.id);
  ok("restoreRoom returns restored:true", r2.restored === true);
  ok("restored room is back in the latest map", has(await svc.getByFloorId(fl.id), target.id));

  const r2b = await svc.restoreRoom(fl.id, target.id);
  ok("restoreRoom idempotent -> restored:false, not_removed", r2b.restored === false && r2b.reason === "not_removed");

  let threw = false;
  try { await svc.removeRoom(fl.id, "room-does-not-exist"); } catch (e) { threw = e.statusCode === 400; }
  ok("removeRoom on a missing room throws 400", threw);

  // controller flag gate (flag OFF -> 404)
  await new Promise((resolve) => {
    ctrl.removeRoom({ params: { floorId: fl.id, roomId: target.id }, body: {} }, {}, (err) => {
      ok("controller removeRoom 404 when flag off", err && err.statusCode === 404);
      resolve();
    });
  });

  await cleanupByName(NAME);
  console.log("cleaned up throwaway");
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL REMOVE/RESTORE CHECKS PASSED");
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("ERR", e.stack || e.message); p.$disconnect(); process.exit(1); });
