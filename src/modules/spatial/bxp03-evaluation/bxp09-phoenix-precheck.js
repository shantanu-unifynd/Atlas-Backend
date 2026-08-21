// BXP-09 (Phase B) pre-check -- STRICTLY READ-ONLY (Prisma find* only, zero
// writes). Inspects Phoenix Palassio / Ground Floor's current persisted
// state before any real regeneration call, so existing published MPM
// versions and manual overrides are known and protected before Phase B
// proceeds.
const { prisma } = require("../../../config/database");

async function main() {
  const building = await prisma.building.findFirst({ where: { name: "Phoenix Palassio" } });
  console.log(`Building: ${building.name} (${building.id})`);

  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  for (const floor of floors) {
    console.log(`\nFloor: ${floor.name} (${floor.id}) status=${floor.status}`);

    const imports = await prisma.blueprintImport.findMany({ where: { buildingId: building.id, floorId: floor.id }, orderBy: { version: "desc" } });
    console.log(`  BlueprintImports: ${imports.length}`);
    for (const imp of imports) {
      const normalized = await prisma.normalizedBlueprint.findUnique({ where: { blueprintImportId: imp.id } });
      const geometry = normalized ? await prisma.geometryModel.findUnique({ where: { normalizedBlueprintId: normalized.id } }) : null;
      console.log(`    import v${imp.version} (${imp.originalFilename}) status=${imp.status} -> normalized=${!!normalized} geometryModel=${!!geometry}`);
      if (geometry) {
        const diag = geometry.diagnostics || {};
        const boundaries = (geometry.candidateObjects && geometry.candidateObjects.candidateBoundaries) || [];
        console.log(`      geometryModelId=${geometry.id}`);
        console.log(`      candidatesGeneratedAt=${diag.candidatesGeneratedAt}`);
        console.log(`      persisted candidateBoundaries.length=${boundaries.length}`);
        console.log(`      primitiveCount=${diag.primitiveCount} connectedComponents=${diag.connectedComponents}`);
      }
    }

    const mpms = await prisma.mapPresentationModel.findMany({ where: { floorId: floor.id }, orderBy: { version: "asc" } });
    console.log(`  MapPresentationModel records: ${mpms.length}`);
    for (const m of mpms) {
      console.log(`    v${m.version} status=${m.status} id=${m.id} createdAt=${m.createdAt.toISOString()}`);
    }

    const overrides = await prisma.mapRoomOverride.findMany({ where: { floorId: floor.id } });
    console.log(`  MapRoomOverride records: ${overrides.length}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
