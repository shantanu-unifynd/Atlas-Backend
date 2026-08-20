// BXP-02 validation harness. Not production code, not wired into any route.
// Run directly: node validate-bxp02.js
//
// Part A: unit-level coverage of regularizeRing() for the 5 required
//         scenarios, plus idempotence.
// Part B: full-pipeline validation reusing BXP-01's own fixtures (simple
//         isolated boxes -> 2 rooms, complex shared-wall mesh -> 4 rooms),
//         comparing room count / vertex count / area / validity before vs
//         after regularization, and confirming idempotence end to end.

const fs = require("fs");
const path = require("path");

const { parseSvg } = require("../../../normalization/parsers/svg.parser");
const { normalizeToAcsm } = require("../../../normalization/normalizers/acsm.normalizer");
const { collectPrimitives } = require("../../../processing/geometry/pipeline/primitive-collector");
const { cleanGeometry } = require("../../../processing/geometry/pipeline/geometry-cleaner");
const { buildTopology } = require("../../../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../../../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../coordinate-normalizer");
const { assembleRooms } = require("../room-assembler");
const { regularizeRing } = require("../polygon-regularizer");

let failures = 0;

function check(label, condition) {
  const status = condition ? "PASS" : "FAIL";
  if (!condition) failures += 1;
  console.log(`  [${status}] ${label}`);
}

function deepEqualPoints(a, b) {
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
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

// --- Part A: unit tests -----------------------------------------------

console.log("=== Part A: regularizeRing() unit coverage ===");

// 1. Consecutive duplicate vertices
{
  const input = [
    { x: 0, y: 0 },
    { x: 0, y: 0 }, // exact duplicate
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const result = regularizeRing(input);
  console.log("\n1. Consecutive duplicate vertices:", JSON.stringify(result));
  check("duplicate removed (5 -> 4 points)", result.length === 4);
  check("area unchanged (100)", Math.abs(unsignedShoelace(result) - 100) < 1e-6);
}

// 2. Near-duplicate vertices (within EPS = 0.05)
{
  const input = [
    { x: 0, y: 0 },
    { x: 0.01, y: 0.01 }, // near-duplicate, distance ~0.014 < 0.05
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const result = regularizeRing(input);
  console.log("\n2. Near-duplicate vertices:", JSON.stringify(result));
  check("near-duplicate merged (5 -> 4 points)", result.length === 4);
  check("area within tolerance of 100", Math.abs(unsignedShoelace(result) - 100) < 0.5);
}

// 3. Collinear intermediate vertex
{
  const input = [
    { x: 0, y: 0 },
    { x: 5, y: 0 }, // exactly on the line from (0,0) to (10,0)
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const result = regularizeRing(input);
  console.log("\n3. Collinear intermediate vertex:", JSON.stringify(result));
  check("collinear point removed (5 -> 4 points)", result.length === 4);
  check("area unchanged (100)", Math.abs(unsignedShoelace(result) - 100) < 1e-6);
}

// 4. A polygon where conservative cleanup SHOULD occur (mix of the above,
//    as would come from a real multi-segment wall run)
{
  const input = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 6, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 10.0001, y: 10 }, // near-duplicate
    { x: 0, y: 10 },
    { x: 0, y: 0.02 }, // near-duplicate of the start on the wrap
  ];
  const result = regularizeRing(input);
  console.log("\n4. Conservative cleanup case:", JSON.stringify(result));
  check("reduces to the 4 real corners", result.length === 4);
  check("area within tolerance of 100", Math.abs(unsignedShoelace(result) - 100) < 0.5);
}

// 5. A polygon where aggressive snapping must NOT occur — an irregular,
//    genuinely non-rectangular quadrilateral with no duplicate/collinear
//    points. regularizeRing must return it geometrically unchanged.
{
  const input = [
    { x: 0, y: 0 },
    { x: 10, y: 0.4 }, // deliberately not axis-aligned
    { x: 9.6, y: 7.2 },
    { x: 3.1, y: 10 },
  ];
  const result = regularizeRing(input);
  console.log("\n5. Non-rectangular room (must be preserved exactly):", JSON.stringify(result));
  check("vertex count unchanged (4 -> 4)", result.length === 4);
  const startIndex = result.findIndex((p) => p.x === input[0].x && p.y === input[0].y);
  const rotated = startIndex >= 0 ? [...result.slice(startIndex), ...result.slice(0, startIndex)] : result;
  const matchesForward = deepEqualPoints(rotated, input);
  const matchesReversed = deepEqualPoints(rotated, [input[0], ...input.slice(1).reverse()]);
  check("coordinates byte-for-byte unchanged (no snapping)", matchesForward || matchesReversed);
}

// Idempotence, all 5 cases
console.log("\n6. Idempotence (run twice, same result) across all 5 cases:");
for (const [label, input] of [
  ["dup", [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
  ["near-dup", [{ x: 0, y: 0 }, { x: 0.01, y: 0.01 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
  ["collinear", [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
  ["irregular", [{ x: 0, y: 0 }, { x: 10, y: 0.4 }, { x: 9.6, y: 7.2 }, { x: 3.1, y: 10 }]],
]) {
  const once = regularizeRing(input);
  const twice = regularizeRing(once);
  check(`${label}: regularize(regularize(x)) === regularize(x)`, deepEqualPoints(once, twice));
}

// --- Part B: full-pipeline fixture validation --------------------------

console.log("\n=== Part B: full-pipeline fixture validation ===");

const FIXTURES_DIR = path.join(
  __dirname,
  "../../../processing/geometry/pipeline/bxp01-validation/fixtures"
);

// Local, throwaway replica of room-assembler.js's private ringFromBoundary,
// used ONLY to compute the "before regularization" baseline for comparison
// — production room-assembler.js is unchanged except for the one-line
// regularizeRing() call already reviewed in BXP-02.
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

function runFixture(name, filename, expectedRoomCount) {
  console.log(`\n--- Fixture: ${name} (expected ${expectedRoomCount} rooms) ---`);

  const rawText = fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf8");
  const parsed = parseSvg(rawText);
  const acsm = normalizeToAcsm(parsed);
  const { primitives } = collectPrimitives(acsm);
  const { cleaned: cleanedGeometry } = cleanGeometry(primitives);

  const topology = buildTopology(cleanedGeometry);
  const { candidateObjects } = classifyGeometry(cleanedGeometry, topology);
  const boundaries = candidateObjects.candidateBoundaries;

  const normalized = normalizeGeometry({ cleanedGeometry }, acsm);
  const primitivesById = new Map(normalized.primitives.map((p) => [p.id, p]));

  // BEFORE: raw rings, no regularization.
  const beforeRooms = [];
  for (const boundary of boundaries) {
    const ring = ringFromBoundaryRaw(boundary, primitivesById);
    if (ring.length < 3) continue;
    const area = unsignedShoelace(ring);
    if (area < 25) continue;
    beforeRooms.push({ ring, area });
  }

  // AFTER: the real (patched) assembleRooms, which now regularizes.
  const afterResult = assembleRooms({
    primitives: normalized.primitives,
    boundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const afterRooms = afterResult.rooms.filter((r) => r.polygon);

  const beforeVertexTotal = beforeRooms.reduce((sum, r) => sum + r.ring.length, 0);
  const afterVertexTotal = afterRooms.reduce((sum, r) => sum + r.polygon.length, 0);
  const beforeInvalid = beforeRooms.filter((r) => r.ring.length < 3).length;
  const afterInvalid = afterRooms.filter((r) => r.polygon.length < 3).length;

  console.log(`  room count: before=${beforeRooms.length} after=${afterRooms.length}`);
  console.log(`  total vertices: before=${beforeVertexTotal} after=${afterVertexTotal}`);
  console.log(`  invalid polygons: before=${beforeInvalid} after=${afterInvalid}`);

  let changedCount = 0;
  let maxAreaDeltaPct = 0;
  for (let i = 0; i < beforeRooms.length; i += 1) {
    const b = beforeRooms[i];
    const a = afterRooms[i];
    if (!a) continue;
    if (b.ring.length !== a.polygon.length || !deepEqualPoints(b.ring, a.polygon)) {
      changedCount += 1;
    }
    const deltaPct = b.area > 0 ? (Math.abs(a.area - b.area) / b.area) * 100 : 0;
    maxAreaDeltaPct = Math.max(maxAreaDeltaPct, deltaPct);
  }
  console.log(`  polygons whose geometry changed: ${changedCount} / ${beforeRooms.length}`);
  console.log(`  max area delta: ${maxAreaDeltaPct.toFixed(4)}%`);

  // Idempotence at the full-pipeline level: regularizing an already-
  // regularized ring again must be a no-op.
  const idempotent = afterRooms.every((r) => deepEqualPoints(r.polygon, regularizeRing(r.polygon)));
  console.log(`  idempotent (regularize(after) === after): ${idempotent}`);

  check(`${name}: room count is ${expectedRoomCount} both before and after`, beforeRooms.length === expectedRoomCount && afterRooms.length === expectedRoomCount);
  check(`${name}: 0 invalid polygons before and after`, beforeInvalid === 0 && afterInvalid === 0);
  check(`${name}: max area delta stays under 1%`, maxAreaDeltaPct < 1);
  check(`${name}: idempotent`, idempotent);

  return { before: beforeRooms.length, after: afterRooms.length };
}

const simple = runFixture("Simple isolated boxes", "simple-isolated-boxes.svg", 2);
const complex = runFixture("Complex shared-wall mesh", "complex-connected-mesh.svg", 4);

console.log("\n=== SUMMARY ===");
console.log(`Simple fixture: ${simple.before} -> ${simple.after} rooms`);
console.log(`Complex fixture: ${complex.before} -> ${complex.after} rooms`);
console.log(`\nTotal failed checks: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
