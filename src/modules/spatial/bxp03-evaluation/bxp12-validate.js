// BXP-12 -- READ-ONLY validation of the multi-subpath SVG path parsing fix.
// Recomputes the FULL pipeline (cleanGeometry -> buildTopology ->
// classifyGeometry -> normalizeGeometry -> assembleRooms) from each floor's
// already-persisted RAW primitives, using the real, now-patched production
// functions -- not a reimplementation. Zero writes, no regeneration calls,
// no production code touched by this script.
const { prisma } = require("../../../config/database");
const { cleanGeometry } = require("../processing/geometry/pipeline/geometry-cleaner");
const { buildTopology } = require("../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../mapModel/pipeline/coordinate-normalizer");
const { assembleRooms, hasSelfIntersection } = require("../mapModel/pipeline/room-assembler");

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

async function evaluate(label, buildingName, floorPredicateOrName, expectedBefore) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = typeof floorPredicateOrName === "function" ? floors.find(floorPredicateOrName) : floors.find((f) => f.name === floorPredicateOrName);
  const found = await findImportWithGeometry(building.id, floor.id);
  const { normalizedBlueprint, geometryModel } = found;

  const t0 = Date.now();
  // Fresh recompute from RAW primitives using the real, now-patched
  // cleanGeometry -- this is the only way to actually exercise the fix,
  // since geometryModel.cleanedGeometry is whatever was persisted before.
  const { cleaned: freshCleaned, removed } = cleanGeometry(geometryModel.primitives);
  const topology = buildTopology(freshCleaned);
  const { candidateObjects } = classifyGeometry(freshCleaned, topology);
  const normalized = normalizeGeometry({ cleanedGeometry: freshCleaned }, normalizedBlueprint);
  const result = assembleRooms({
    primitives: normalized.primitives,
    boundaries: candidateObjects.candidateBoundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const t1 = Date.now();

  const acceptedRooms = result.rooms.filter((r) => r.polygon);
  const selfIntersecting = acceptedRooms.filter((r) => hasSelfIntersection(r.polygon)).length;

  console.log(`${label}:`);
  console.log(`  raw primitives=${geometryModel.primitives.length}, freshCleanedPrimitives=${freshCleaned.length} (was ${geometryModel.cleanedGeometry.length} persisted)`);
  console.log(`  candidateBoundaries=${candidateObjects.candidateBoundaries.length}`);
  console.log(`  accepted rooms: before=${expectedBefore}, after=${acceptedRooms.length}`);
  console.log(`  self-intersecting accepted (should be 0): ${selfIntersecting}`);
  console.log(`  processing time: ${t1 - t0}ms`);
  console.log("");

  return { label, freshCleaned, candidateObjects, acceptedRooms };
}

async function main() {
  await evaluate("BuildingSVG/1stFloor", "BuildingSVG", "1stFloor", 54);
  await evaluate("UnifyndTech/Ground", "Unifynd tech", "Ground Floor", 15);
  await evaluate("BXP-08/isolated", "BXP-08 Isolated Test Building", (f) => true, 8);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
