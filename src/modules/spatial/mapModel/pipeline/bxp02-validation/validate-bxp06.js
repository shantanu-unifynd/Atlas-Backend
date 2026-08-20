// BXP-06 validation. Read-only against real data (Prisma finds only, zero
// writes). Calls the real, unmodified production functions.
const fs = require("fs");
const path = require("path");
const { prisma } = require("../../../../../config/database");
const { buildTopology } = require("../../../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../../../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../coordinate-normalizer");
const { assembleRooms, hasSelfIntersection } = require("../room-assembler");
const { parseSvg } = require("../../../normalization/parsers/svg.parser");
const { normalizeToAcsm } = require("../../../normalization/normalizers/acsm.normalizer");
const { collectPrimitives } = require("../../../processing/geometry/pipeline/primitive-collector");
const { cleanGeometry } = require("../../../processing/geometry/pipeline/geometry-cleaner");

let failures = 0;
function check(label, cond) { console.log(`  [${cond ? "PASS" : "FAIL"}] ${label}`); if (!cond) failures++; }

function runFixture(name, filePath) {
  const rawText = fs.readFileSync(filePath, "utf8");
  const acsm = normalizeToAcsm(parseSvg(rawText));
  const { primitives } = collectPrimitives(acsm);
  const { cleaned } = cleanGeometry(primitives);
  const topology = buildTopology(cleaned);
  const { candidateObjects } = classifyGeometry(cleaned, topology);
  const normalized = normalizeGeometry({ cleanedGeometry: cleaned }, acsm);
  const result = assembleRooms({ primitives: normalized.primitives, boundaries: candidateObjects.candidateBoundaries, nodes: [], usoByCandidateId: new Map(), semanticByUsoId: new Map() });
  const rooms = result.rooms.filter((r) => r.polygon);
  console.log(`\n--- ${name} ---`);
  console.log(`  rooms: ${rooms.length}, areas: ${rooms.map((r) => r.area).join(", ")}`);
  return rooms;
}

async function findImportWithGeometry(buildingId, floorId) {
  const imports = await prisma.blueprintImport.findMany({ where: { buildingId, floorId }, orderBy: { version: "desc" } });
  for (const imp of imports) {
    const n = await prisma.normalizedBlueprint.findUnique({ where: { blueprintImportId: imp.id } });
    if (!n) continue;
    const g = await prisma.geometryModel.findUnique({ where: { normalizedBlueprintId: n.id } });
    if (g) return { blueprintImport: imp, normalizedBlueprint: n, geometryModel: g };
  }
  return null;
}

async function runReal(buildingName, floorPredicate) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = floorPredicate ? floors.find(floorPredicate) : floors[0];
  const { normalizedBlueprint, geometryModel } = await findImportWithGeometry(building.id, floor.id);
  const cleanedGeometry = geometryModel.cleanedGeometry;
  const topology = buildTopology(cleanedGeometry);
  const { candidateObjects } = classifyGeometry(cleanedGeometry, topology);
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);
  const result = assembleRooms({ primitives: normalized.primitives, boundaries: candidateObjects.candidateBoundaries, nodes: [], usoByCandidateId: new Map(), semanticByUsoId: new Map() });
  const rooms = result.rooms.filter((r) => r.polygon);
  console.log(`\n--- ${buildingName} / ${floor.name} ---`);
  console.log(`  accepted rooms: ${rooms.length}`);
  console.log(`  max area: ${Math.max(...rooms.map((r) => r.area)).toFixed(1)}`);
  console.log(`  self-intersecting among accepted: ${rooms.filter((r) => hasSelfIntersection(r.polygon)).length}`);
  return rooms;
}

async function main() {
  console.log("=== BuildingSVG / 1stFloor ===");
  const b = await runReal("BuildingSVG");
  check("BuildingSVG: 56 accepted (was 57, envelope rejected)", b.length === 56);
  check("BuildingSVG: no room has area ~587600 (the envelope)", !b.some((r) => Math.abs(r.area - 587600) < 1));
  check("BuildingSVG: 0 self-intersecting", b.filter((r) => hasSelfIntersection(r.polygon)).length === 0);

  console.log("\n=== Phoenix Palassio / Ground Floor ===");
  const p = await runReal("Phoenix Palassio");
  check("Phoenix: no room has area ~3,136,794 (the envelope)", !p.some((r) => Math.abs(r.area - 3136794.09) < 5));
  check("Phoenix: 0 self-intersecting", p.filter((r) => hasSelfIntersection(r.polygon)).length === 0);
  console.log(`  (Phoenix accepted count: ${p.length} -- reported, not asserted to an exact prior value)`);

  console.log("\n=== Unifynd tech / Ground Floor (no regression) ===");
  const u = await runReal("Unifynd tech", (f) => f.name === "Ground Floor");
  check("Unifynd tech: 13 accepted (unchanged)", u.length === 13);
  check("Unifynd tech: 0 self-intersecting", u.filter((r) => hasSelfIntersection(r.polygon)).length === 0);

  const anchorRooms = runFixture(
    "BXP-05.1 anchor-store fixture",
    path.join(__dirname, "fixtures/anchor-store-mall.svg")
  );
  check("Anchor fixture: 6 rooms (anchor store preserved)", anchorRooms.length === 6);
  check("Anchor fixture: anchor store (area 21000, 40.38%) still accepted", anchorRooms.some((r) => Math.abs(r.area - 21000) < 1));

  const sharedWallRooms = runFixture(
    "BXP-01 shared-wall fixture (face-extracted, envelope rule must not apply)",
    path.join(__dirname, "../../../processing/geometry/pipeline/bxp01-validation/fixtures/complex-connected-mesh.svg")
  );
  check("Shared-wall fixture: 4 rooms (unaffected by envelope rule)", sharedWallRooms.length === 4);
  check("Shared-wall fixture: each room area ~10000", sharedWallRooms.every((r) => Math.abs(r.area - 10000) < 1));

  console.log(`\nTotal failed checks: ${failures}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
