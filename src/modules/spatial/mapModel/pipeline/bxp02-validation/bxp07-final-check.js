const { prisma } = require("../../../../../config/database");
async function main() {
  const building = await prisma.building.findFirst({ where: { name: "Unifynd tech" } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  for (const f of floors) {
    const mpms = await prisma.mapPresentationModel.findMany({ where: { floorId: f.id } });
    console.log(`${f.name} (${f.id}): ${mpms.length} MPM record(s) -> ${mpms.map(m => `v${m.version}/${m.status}`).join(", ") || "none"}`);
  }
  const overrides = await prisma.mapRoomOverride.findMany({ where: { floorId: "e0f64f9e-79be-4c8f-b073-27d74166f6f4" } });
  console.log(`\nManual overrides for Ground Floor: ${overrides.length}`);
  await prisma.$disconnect();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
