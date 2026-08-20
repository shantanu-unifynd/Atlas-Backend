// BXP-02 real-data validation — STRICTLY READ-ONLY, same guarantees as
// BXP-01's real-data script: only Prisma finds, no writes, no
// generateCandidates/map-model generate/publish calls. Runs the real
// persisted GeometryModel through normalizeGeometry + assembleRooms
// (which now regularizes) in memory only, and separately computes the
// pre-regularization baseline for comparison.

const { prisma } = require("../../../../../config/database");
const { buildTopology } = require("../../../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../../../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../coordinate-normalizer");
const { assembleRooms } = require("../room-assembler");
const { regularizeRing } = require("../polygon-regularizer");

function samePointRaw(a, b) {
  return Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05;
}
function ringFromBoundaryRaw(boundary, primitivesById) {
  const ids = Array.isArray(boundary.primitiveIds) ? boundary.primitiveIds : [];
  const pts = [];
  const push = (p) => {
    const last = pts[pts.length - 1];
    if (!last || !samePointRaw(last, p)) pts.push({ x: p.x, y: p.y });
  };
  for (const pid of ids) {
    const prim = primitivesById.get(pid);
    if (!prim || !Array.isArray(prim.segments)) continue;
    for (const s of prim.segments) {
      push({ x: s.x1, y: s.y1 });
      push({ x: s.x2, y: s.y2 });
    }
  }
  if (pts.length >= 2 && samePointRaw(pts[0], pts[pts.length - 1])) pts.pop();
  return pts;
}
function unsignedShoelace(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(sum) / 2;
}
function deepEqualPoints(a, b) {
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
}

async function main() {
  const building = await prisma.building.findFirst({ where: { name: "BuildingSVG" } });
  const floor = await prisma.floor.findFirst({ where: { buildingId: building.id } });
  const blueprintImport = await prisma.blueprintImport.findFirst({
    where: { buildingId: building.id, floorId: floor.id },
    orderBy: { version: "desc" },
  });
  const normalizedBlueprint = await prisma.normalizedBlueprint.findUnique({
    where: { blueprintImportId: blueprintImport.id },
  });
  const geometryModel = await prisma.geometryModel.findUnique({
    where: { normalizedBlueprintId: normalizedBlueprint.id },
  });

  console.log(`Building: ${building.name}, Floor: ${floor.name}, Import: ${blueprintImport.originalFilename} v${blueprintImport.version}`);

  // Recompute boundaries FRESH from the fixed (BXP-01/BXP-01.1) topology
  // builder against the persisted cleanedGeometry, rather than reading
  // geometryModel.candidateObjects — that field is stale, persisted from
  // before the BXP-01 fix existed (58 boundaries, including one bad
  // whole-mesh cycle attempt from the old algorithm), never regenerated
  // since (regenerating would require generateCandidates, a write, which
  // this read-only script must not call).
  const topology = buildTopology(geometryModel.cleanedGeometry);
  const { candidateObjects } = classifyGeometry(geometryModel.cleanedGeometry, topology);
  const boundaries = candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);
  const primitivesById = new Map(normalized.primitives.map((p) => [p.id, p]));

  const beforeRooms = [];
  for (const boundary of boundaries) {
    const ring = ringFromBoundaryRaw(boundary, primitivesById);
    if (ring.length < 3) continue;
    const area = unsignedShoelace(ring);
    if (area < 25) continue;
    beforeRooms.push({ ring, area });
  }

  const afterResult = assembleRooms({
    primitives: normalized.primitives,
    boundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const afterRooms = afterResult.rooms.filter((r) => r.polygon);

  const beforeVertexTotal = beforeRooms.reduce((s, r) => s + r.ring.length, 0);
  const afterVertexTotal = afterRooms.reduce((s, r) => s + r.polygon.length, 0);

  let changedCount = 0;
  let maxAreaDeltaPct = 0;
  for (let i = 0; i < beforeRooms.length; i += 1) {
    const b = beforeRooms[i];
    const a = afterRooms[i];
    if (!a) continue;
    if (b.ring.length !== a.polygon.length || !deepEqualPoints(b.ring, a.polygon)) changedCount += 1;
    const deltaPct = b.area > 0 ? (Math.abs(a.area - b.area) / b.area) * 100 : 0;
    maxAreaDeltaPct = Math.max(maxAreaDeltaPct, deltaPct);
  }

  const idempotent = afterRooms.every((r) => deepEqualPoints(r.polygon, regularizeRing(r.polygon)));

  console.log(`\nRoom count: before=${beforeRooms.length} after=${afterRooms.length} (expected 57/57)`);
  console.log(`Total vertices: before=${beforeVertexTotal} after=${afterVertexTotal}`);
  console.log(`Invalid polygons: before=${beforeRooms.filter((r) => r.ring.length < 3).length} after=${afterRooms.filter((r) => r.polygon.length < 3).length}`);
  console.log(`Polygons changed: ${changedCount} / ${beforeRooms.length}`);
  console.log(`Max area delta: ${maxAreaDeltaPct.toFixed(4)}%`);
  console.log(`Idempotent: ${idempotent}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
