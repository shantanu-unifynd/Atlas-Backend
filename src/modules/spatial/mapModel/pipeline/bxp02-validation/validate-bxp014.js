// BXP-01.4 validation harness. Not production code. STRICTLY READ-ONLY
// against real data (Prisma finds only, zero writes, no generation/
// regeneration calls). Calls the REAL, unmodified production functions
// (assembleRooms, hasSelfIntersection — the actual thing being validated —
// buildTopology, classifyGeometry, normalizeGeometry). The only local
// logic is ring reconstruction (not exported from room-assembler.js),
// reused verbatim from the same accepted pattern in BXP-02/03's scripts,
// used ONLY to report the "assembled before self-intersection filtering"
// stage separately from the real assembleRooms()'s final accepted output.

const { prisma } = require("../../../../../config/database");
const { buildTopology } = require("../../../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../../../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../coordinate-normalizer");
const { assembleRooms, hasSelfIntersection } = require("../room-assembler");
const { regularizeRing } = require("../polygon-regularizer");

let failures = 0;
function check(label, condition) {
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${label}`);
  if (!condition) failures += 1;
}

// --- Part A: 6 focused cases -------------------------------------------
console.log("=== Part A: focused self-intersection cases ===");

check("Case 1 — Rectangle: not self-intersecting", !hasSelfIntersection([
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
]));

check("Case 2 — Bow-tie: self-intersecting", hasSelfIntersection([
  { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 },
]));

// Concave "L" shape — no crossing edges, must NOT be flagged.
check("Case 3 — Valid concave (L-shape): not self-intersecting", !hasSelfIntersection([
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 10 },
]));

// Adjacent edges (e.g. edge 0 and edge 1) share vertex (10,0) — must not be
// treated as an intersection just because they touch there.
check("Case 4 — Adjacent edges sharing endpoint: no false positive", !hasSelfIntersection([
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
]));

// Same rectangle again, explicitly to confirm the closing edge (last ->
// first) and the first edge are treated as adjacent, not compared.
check("Case 5 — First/last closing-edge adjacency: no false positive", !hasSelfIntersection([
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
]));

// --- Case 6: BXP-01 complex shared-wall fixture, full real pipeline -----
const fs = require("fs");
const path = require("path");
const { parseSvg } = require("../../../normalization/parsers/svg.parser");
const { normalizeToAcsm } = require("../../../normalization/normalizers/acsm.normalizer");
const { collectPrimitives } = require("../../../processing/geometry/pipeline/primitive-collector");
const { cleanGeometry } = require("../../../processing/geometry/pipeline/geometry-cleaner");

{
  const rawText = fs.readFileSync(
    path.join(__dirname, "../../../processing/geometry/pipeline/bxp01-validation/fixtures/complex-connected-mesh.svg"),
    "utf8"
  );
  const parsed = parseSvg(rawText);
  const acsm = normalizeToAcsm(parsed);
  const { primitives } = collectPrimitives(acsm);
  const { cleaned } = cleanGeometry(primitives);
  const topology = buildTopology(cleaned);
  const { candidateObjects } = classifyGeometry(cleaned, topology);
  const normalized = normalizeGeometry({ cleanedGeometry: cleaned }, acsm);
  const result = assembleRooms({
    primitives: normalized.primitives,
    boundaries: candidateObjects.candidateBoundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const rooms = result.rooms.filter((r) => r.polygon);
  console.log("\nCase 6 — Complex shared-wall fixture (full real pipeline):");
  console.log(`  rooms: ${rooms.length}, areas: ${rooms.map((r) => r.area).join(", ")}`);
  check("4 rooms produced", rooms.length === 4);
  check("all 4 valid (>=3 points)", rooms.every((r) => r.polygon.length >= 3));
  check("0 self-intersecting among accepted", rooms.every((r) => !hasSelfIntersection(r.polygon)));
  check("each room area ~= 10000", rooms.every((r) => Math.abs(r.area - 10000) < 1));
}

// --- Part B: real-floor regression --------------------------------------
console.log("\n=== Part B: real-floor regression ===");

const EPS = 0.05;
function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}
function primitiveOwnPoints(primitive) {
  const pts = [];
  const push = (p) => {
    const last = pts[pts.length - 1];
    if (!last || !samePoint(last, p)) pts.push({ x: p.x, y: p.y });
  };
  for (const s of primitive.segments) {
    push({ x: s.x1, y: s.y1 });
    push({ x: s.x2, y: s.y2 });
  }
  return pts;
}
function ringFromBoundaryLocal(boundary, primitivesById) {
  const ids = Array.isArray(boundary.primitiveIds) ? boundary.primitiveIds : [];
  const ring = [];
  const append = (piece) => {
    for (const p of piece) {
      const last = ring[ring.length - 1];
      if (!last || !samePoint(last, p)) ring.push(p);
    }
  };
  function firstNonEmptyFrom(i) {
    for (; i < ids.length; i += 1) {
      const p = primitivesById.get(ids[i]);
      if (p && p.segments && p.segments.length) return primitiveOwnPoints(p);
    }
    return null;
  }
  for (let idx = 0; idx < ids.length; idx += 1) {
    const prim = primitivesById.get(ids[idx]);
    if (!prim || !prim.segments || !prim.segments.length) continue;
    const piece = primitiveOwnPoints(prim);
    if (!piece.length) continue;
    const cursor = ring[ring.length - 1];
    if (!cursor) {
      const nextPiece = firstNonEmptyFrom(idx + 1);
      const nextEnds = nextPiece ? [nextPiece[0], nextPiece[nextPiece.length - 1]] : [];
      const endsAtNext = nextEnds.some((p) => samePoint(p, piece[piece.length - 1]));
      const startsAtNext = nextEnds.some((p) => samePoint(p, piece[0]));
      append(!endsAtNext && startsAtNext ? [...piece].reverse() : piece);
    } else if (samePoint(cursor, piece[0])) {
      append(piece);
    } else if (samePoint(cursor, piece[piece.length - 1])) {
      append([...piece].reverse());
    } else {
      append(piece);
    }
  }
  if (ring.length >= 2 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();
  return ring;
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
function median(sorted) {
  const n = sorted.length;
  if (!n) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

async function findImportWithGeometry(buildingId, floorId) {
  const imports = await prisma.blueprintImport.findMany({ where: { buildingId, floorId }, orderBy: { version: "desc" } });
  for (const imp of imports) {
    // eslint-disable-next-line no-await-in-loop
    const normalized = await prisma.normalizedBlueprint.findUnique({ where: { blueprintImportId: imp.id } });
    if (!normalized) continue;
    // eslint-disable-next-line no-await-in-loop
    const geometryModel = await prisma.geometryModel.findUnique({ where: { normalizedBlueprintId: normalized.id } });
    if (geometryModel) return { blueprintImport: imp, normalizedBlueprint: normalized, geometryModel };
  }
  return null;
}

async function evaluateFloor(label, buildingName, floorPredicate) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = floorPredicate ? floors.find(floorPredicate) : floors[0];
  const found = await findImportWithGeometry(building.id, floor.id);
  const { normalizedBlueprint, geometryModel } = found;

  const cleanedGeometry = geometryModel.cleanedGeometry;
  const topology = buildTopology(cleanedGeometry);
  const { candidateObjects } = classifyGeometry(cleanedGeometry, topology);
  const boundaries = candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);
  const primitivesById = new Map(normalized.primitives.map((p) => [p.id, p]));

  // "Assembled" (before self-intersection filtering): passes point-count
  // and area, using the SAME regularizeRing() the real pipeline uses.
  let assembled = 0;
  let selfIntersectingCount = 0;
  const beforeAreas = [];
  for (const b of boundaries) {
    const ring = regularizeRing(ringFromBoundaryLocal(b, primitivesById));
    if (ring.length < 3) continue;
    const area = unsignedShoelace(ring);
    if (area < 25) continue;
    assembled += 1;
    beforeAreas.push(area);
    if (hasSelfIntersection(ring)) selfIntersectingCount += 1;
  }

  // "Accepted" — the REAL, unmodified assembleRooms(), authoritative.
  const result = assembleRooms({
    primitives: normalized.primitives,
    boundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const accepted = result.rooms.filter((r) => r.polygon);
  const acceptedSelfIntersecting = accepted.filter((r) => hasSelfIntersection(r.polygon)).length;

  const afterAreas = accepted.map((r) => r.area).sort((a, b) => a - b);
  const beforeSorted = [...beforeAreas].sort((a, b) => a - b);

  console.log(`\n--- ${label} ---`);
  console.log(`  assembled (pre-self-intersection-filter): ${assembled}`);
  console.log(`  self-intersecting detected: ${selfIntersectingCount}`);
  console.log(`  accepted (final): ${accepted.length}`);
  console.log(`  accepted rooms still self-intersecting: ${acceptedSelfIntersecting}`);
  console.log(`  before-filter area: min=${beforeSorted[0]?.toFixed(1)} median=${median(beforeSorted).toFixed(1)} max=${beforeSorted[beforeSorted.length - 1]?.toFixed(1)}`);
  console.log(`  after-filter  area: min=${afterAreas[0]?.toFixed(1)} median=${median(afterAreas).toFixed(1)} mean=${(afterAreas.reduce((a, b) => a + b, 0) / (afterAreas.length || 1)).toFixed(1)} max=${afterAreas[afterAreas.length - 1]?.toFixed(1)}`);
  console.log(`  largest/median ratio after filtering: ${(afterAreas[afterAreas.length - 1] / (median(afterAreas) || 1)).toFixed(2)}x`);
  console.log(`  max area changed by filtering: ${beforeSorted[beforeSorted.length - 1] !== afterAreas[afterAreas.length - 1] ? "YES" : "no"} (before=${beforeSorted[beforeSorted.length - 1]?.toFixed(1)}, after=${afterAreas[afterAreas.length - 1]?.toFixed(1)})`);

  check(`${label}: accepted = assembled - self-intersecting`, accepted.length === assembled - selfIntersectingCount);
  check(`${label}: 0 accepted rooms are self-intersecting`, acceptedSelfIntersecting === 0);

  return { assembled, selfIntersectingCount, accepted: accepted.length };
}

async function main() {
  const b = await evaluateFloor("BuildingSVG / 1stFloor", "BuildingSVG");
  check("BuildingSVG: assembled=57", b.assembled === 57);
  check("BuildingSVG: self-intersecting=2", b.selfIntersectingCount === 2);
  check("BuildingSVG: accepted=55", b.accepted === 55);

  const p = await evaluateFloor("Phoenix Palassio / Ground Floor", "Phoenix Palassio");
  check("Phoenix: assembled=30", p.assembled === 30);
  check("Phoenix: self-intersecting=7", p.selfIntersectingCount === 7);
  check("Phoenix: accepted=23", p.accepted === 23);

  const u = await evaluateFloor("Unifynd tech / Ground Floor", "Unifynd tech", (f) => f.name === "Ground Floor");
  check("Unifynd tech: assembled=13", u.assembled === 13);
  check("Unifynd tech: self-intersecting=0", u.selfIntersectingCount === 0);
  check("Unifynd tech: accepted=13", u.accepted === 13);

  console.log(`\nTotal failed checks: ${failures}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
