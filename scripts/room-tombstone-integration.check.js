// Repeatable DB-integration check for "Remove room" (soft-delete tombstone).
// No JS test runner on the backend, and this needs a real DB + a floor with a
// published MPM, so it is a standalone node script. Run from the backend root:
//   node scripts/room-tombstone-integration.check.js
//
// It creates a THROWAWAY building (copying one published floor's geometry),
// tombstones a room, and asserts it is hidden BEFORE republish (read-time
// filter) AND AFTER republish (generate bake), then that restore brings it back
// on regenerate. The throwaway is always cleaned up. If no suitable fixture
// floor exists the check SKIPS (exit 0).
const { PrismaClient } = require("@prisma/client");
const svc = require("../src/modules/spatial/mapModel/services/mapModel.service");
const tombRepo = require("../src/repositories/roomTombstone/roomTombstone.repository");

const p = new PrismaClient();
let fails = 0;
const ok = (l, c) => { console.log((c ? "ok  - " : "FAIL- ") + l); if (!c) fails += 1; };
const has = (mpm, id) => (mpm && mpm.data && mpm.data.rooms || []).some((r) => r.id === id);
const area = (poly) => { let a = 0; for (let i = 0; i < poly.length; i++) { const q = poly[i], w = poly[(i + 1) % poly.length]; a += q.x * w.y - w.x * q.y; } return Math.abs(a) / 2; };
const cen = (poly) => { let x = 0, y = 0; for (const q of poly) { x += q.x; y += q.y; } return { x: x / poly.length, y: y / poly.length }; };
const NAME = "Tombstone IT (throwaway)";

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

  // Any published MPM with >= 2 polygon rooms makes a usable fixture.
  const src = await p.mapPresentationModel.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  const withPoly0 = src && src.data && Array.isArray(src.data.rooms)
    ? src.data.rooms.filter((r) => Array.isArray(r.polygon) && r.polygon.length >= 3)
    : [];
  if (withPoly0.length < 2) {
    console.log("SKIP: no published floor with >=2 polygon rooms to use as a fixture");
    await p.$disconnect();
    process.exit(0);
  }

  const data = JSON.parse(JSON.stringify(src.data));
  data.source = "auto-extract"; // so generate()'s Option A seeds from this base
  const withPoly = data.rooms.filter((r) => Array.isArray(r.polygon) && r.polygon.length >= 3);
  const target = withPoly[0];
  const control = withPoly[1];

  const bldg = await p.building.create({ data: { code: "TOMB-IT-" + withPoly.length, name: NAME, country: "IN", city: "NA", address: "safe to delete", timezone: "Asia/Kolkata", status: "ACTIVE" } });
  const fl = await p.floor.create({ data: { buildingId: bldg.id, level: 0, name: "Ground (IT)", status: "ACTIVE" } });
  await p.mapPresentationModel.create({ data: { floorId: fl.id, version: 1, status: "PUBLISHED", data } });

  const c = cen(target.polygon);
  const tomb = await tombRepo.create({ floorId: fl.id, roomId: target.id, roomKind: "AUTO", centroidX: c.x, centroidY: c.y, area: area(target.polygon), roomSnapshot: target, deletedBy: "test", reason: "integration" });

  const before = await svc.getByFloorId(fl.id, { published: true });
  ok("BEFORE republish: tombstoned room hidden at read time", !has(before, target.id));
  ok("BEFORE republish: a different room is untouched", has(before, control.id));

  const draft = await svc.generate(fl.id);
  ok("bake: regenerated draft excludes the tombstoned room", !has(draft, target.id));
  await svc.publish(fl.id);
  const after = await svc.getByFloorId(fl.id, { published: true });
  ok("AFTER republish: published MPM excludes the tombstoned room", !has(after, target.id));
  ok("AFTER republish: the control room still present", has(after, control.id));

  await tombRepo.restore(tomb.id, "test", new Date());
  const restored = await svc.generate(fl.id);
  ok("RESTORE: room returns after clearing the tombstone + regenerate", has(restored, target.id));

  await cleanupByName(NAME);
  console.log("cleaned up throwaway");
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL INTEGRATION CHECKS PASSED");
  await p.$disconnect();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("ERR", e.stack || e.message); p.$disconnect(); process.exit(1); });
