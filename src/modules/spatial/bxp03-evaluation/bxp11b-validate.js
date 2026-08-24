// BXP-11B -- READ-ONLY validation of the just-added aspect-ratio + exact-
// duplicate rules in room-assembler.js. Calls the REAL, now-patched
// assembleRooms() (not a reimplementation) against each floor's already-
// persisted candidateObjects. Zero writes, no regeneration, no MPM
// generation, no production code touched by this script.
const { prisma } = require("../../../config/database");
const { normalizeGeometry } = require("../mapModel/pipeline/coordinate-normalizer");
const { assembleRooms, hasSelfIntersection } = require("../mapModel/pipeline/room-assembler");
const { regularizeRing } = require("../mapModel/pipeline/polygon-regularizer");

async function findImportWithGeometry(buildingId, floorId) {
  const imports = await prisma.blueprintImport.findMany({ where: { buildingId, floorId }, orderBy: { version: "desc" } });
  for (const imp of imports) {
    const n = await prisma.normalizedBlueprint.findUnique({ where: { blueprintImportId: imp.id } });
    if (!n) continue;
    const g = await prisma.geometryModel.findUnique({ where: { normalizedBlueprintId: n.id } });
    if (g) return { normalizedBlueprint: n, geometryModel: g };
  }
  return null;
}

async function evaluate(label, buildingName, floorPredicateOrName, beforeCount) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = typeof floorPredicateOrName === "function" ? floors.find(floorPredicateOrName) : floors.find((f) => f.name === floorPredicateOrName);
  const found = await findImportWithGeometry(building.id, floor.id);
  const { normalizedBlueprint, geometryModel } = found;

  const boundaries = geometryModel.candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);

  const result = assembleRooms({
    primitives: normalized.primitives,
    boundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const afterIds = result.rooms.filter((r) => r.polygon).map((r) => r.id.replace(/^room-/, ""));

  console.log(`${label}: before=${beforeCount} after=${afterIds.length}`);
  return { label, boundaries, afterIds, rooms: result.rooms.filter((r) => r.polygon) };
}

async function main() {
  // "before" counts are BXP-11A's/BXP-10's already-measured pre-BXP-11B
  // baselines (same persisted candidates, prior code version).
  const buildingSvg = await evaluate("BuildingSVG/1stFloor", "BuildingSVG", "1stFloor", 54);
  const unifyndTech = await evaluate("UnifyndTech/Ground", "Unifynd tech", "Ground Floor", 15);
  const bxp08 = await evaluate("BXP-08/isolated", "BXP-08 Isolated Test Building", (f) => true, 8);
  const phoenix = await evaluate("Phoenix/Ground", "Phoenix Palassio", "Ground Floor", 22);

  console.log("\n=== Phoenix before (22 known IDs from BXP-10) vs after ===");
  const before22 = ["boundary-9","boundary-158","boundary-147","boundary-146","boundary-154","boundary-145","boundary-143","boundary-148","boundary-149","boundary-160","boundary-196","boundary-197","boundary-207","boundary-208","boundary-142","boundary-144","boundary-191","boundary-192","boundary-206","boundary-189","boundary-204","boundary-165"];
  const afterSet = new Set(phoenix.afterIds);
  const removed = before22.filter((id) => !afterSet.has(id));
  console.log("Removed from accepted set:", removed);
  console.log("Remaining accepted (after):", phoenix.afterIds);

  console.log("\n=== Invalid-accepted check (self-intersection + idempotence) across all 4 floors ===");
  for (const set of [buildingSvg, unifyndTech, bxp08, phoenix]) {
    let selfInt = 0, idemMismatch = 0;
    for (const r of set.rooms) {
      if (hasSelfIntersection(r.polygon)) selfInt += 1;
      const again = regularizeRing(r.polygon);
      if (JSON.stringify(again) !== JSON.stringify(r.polygon)) idemMismatch += 1;
    }
    console.log(`  ${set.label}: self-intersecting accepted=${selfInt}, non-idempotent=${idemMismatch}`);
  }

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
