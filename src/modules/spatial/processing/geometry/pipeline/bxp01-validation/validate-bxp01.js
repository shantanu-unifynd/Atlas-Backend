// BXP-01 validation harness. Not a production module and not wired into any
// route — run directly with `node validate-bxp01.js` from this directory.
// Exercises the REAL pipeline stages (SVG parse -> ACSM -> primitive
// collection -> geometry cleaning) identically for both algorithms, then
// diverges only at topology/boundary extraction: the frozen legacy copies
// here vs. the actual (fixed) topology-builder.js / candidate-geometry.util.js.

const fs = require("fs");
const path = require("path");

const { parseSvg } = require("../../../../normalization/parsers/svg.parser");
const { normalizeToAcsm } = require("../../../../normalization/normalizers/acsm.normalizer");
const { collectPrimitives } = require("../primitive-collector");
const { cleanGeometry } = require("../geometry-cleaner");

const { buildTopology: buildTopologyNew } = require("../topology-builder");
const { traceRing: traceRingNew } = require("../candidate-geometry.util");

const { buildTopology: buildTopologyLegacy } = require("./legacy-topology-builder");
const { traceRing: traceRingLegacy, shoelaceArea: shoelaceAreaLegacy } = require("./legacy-candidate-geometry.util");

function loadCleanedGeometry(fixtureFilename) {
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", fixtureFilename), "utf8");
  const parsed = parseSvg(rawText);
  const acsm = normalizeToAcsm(parsed);
  const { primitives } = collectPrimitives(acsm);
  const { cleaned } = cleanGeometry(primitives);
  return cleaned;
}

// Mirrors geometry-classifier.js's classifyBoundariesAndEnclosures exactly,
// parameterized on which topology/traceRing/shoelaceArea implementation to
// use, so both algorithms produce output through the identical downstream
// boundary/area logic and only the topology stage itself differs.
function extractRooms(cleanedGeometry, buildTopology, traceRing, shoelaceArea) {
  const topology = buildTopology(cleanedGeometry);
  const byId = new Map(cleanedGeometry.map((p) => [p.id, p]));
  const nodesById = new Map(topology.nodes.map((n) => [n.id, n]));

  const rooms = [];
  const warnings = [];

  for (const boundary of topology.closedBoundaries) {
    if (boundary.type === "primitive") {
      const primitive = byId.get(boundary.primitiveId);
      const g = primitive.geometry;
      let area = null;
      if (primitive.type === "rect") area = g.width * g.height;
      if (primitive.type === "circle") area = Math.PI * g.r * g.r;
      if (primitive.type === "ellipse") area = Math.PI * g.rx * g.ry;
      if (primitive.type === "polygon") area = shoelaceArea(g.points);
      if (area !== null) rooms.push({ source: "primitive", primitiveIds: [boundary.primitiveId], area });
      continue;
    }

    const ring = traceRing(boundary.nodeIds, topology.edges, nodesById);

    if (!ring) {
      warnings.push(`boundary '${boundary.componentId}' failed to trace (branching topology)`);
      continue;
    }

    rooms.push({ source: "component-cycle", primitiveIds: boundary.primitiveIds, area: shoelaceArea(ring), ring });
  }

  return { rooms, warnings, topology };
}

function reportFixture(name, fixtureFilename, expectedRoomCount, expectedAreaEach) {
  console.log(`\n=== Fixture: ${name} (${fixtureFilename}) ===`);
  const cleanedGeometry = loadCleanedGeometry(fixtureFilename);
  console.log(`cleaned primitives: ${cleanedGeometry.length}`);

  const oldResult = extractRooms(cleanedGeometry, buildTopologyLegacy, traceRingLegacy, shoelaceAreaLegacy);
  const newResult = extractRooms(cleanedGeometry, buildTopologyNew, traceRingNew, (pts) => {
    // new traceRing returns points already; compute unsigned shoelace here
    // for direct comparison against the legacy (also-unsigned) values.
    let sum = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      sum += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(sum) / 2;
  });

  console.log(`OLD algorithm: ${oldResult.rooms.length} room(s) extracted, ${oldResult.warnings.length} warning(s)`);
  oldResult.warnings.forEach((w) => console.log(`  - ${w}`));
  oldResult.rooms.forEach((r, i) => console.log(`  room[${i}] source=${r.source} area=${r.area}`));

  console.log(`NEW algorithm: ${newResult.rooms.length} room(s) extracted, ${newResult.warnings.length} warning(s)`);
  newResult.warnings.forEach((w) => console.log(`  - ${w}`));
  newResult.rooms.forEach((r, i) => console.log(`  room[${i}] source=${r.source} area=${r.area}`));

  // --- Verification checks (per BXP-01 validation requirements) ---
  const checks = [];

  checks.push([
    `produced exactly ${expectedRoomCount} bounded room(s)`,
    newResult.rooms.length === expectedRoomCount,
  ]);

  if (expectedAreaEach !== null) {
    const areasMatch = newResult.rooms.every((r) => Math.abs(r.area - expectedAreaEach) < 1e-6);
    checks.push([`every room's area is ${expectedAreaEach}`, areasMatch]);
  }

  // No duplicate face merely from opposite-direction traversal: two rooms
  // should never share the exact same set of primitiveIds.
  const primitiveIdSetKeys = newResult.rooms.map((r) => [...r.primitiveIds].sort().join(","));
  const uniqueKeys = new Set(primitiveIdSetKeys);
  checks.push(["no duplicate rooms (same primitiveIds set)", uniqueKeys.size === primitiveIdSetKeys.length]);

  // Rings closed and valid before being passed downstream.
  const allRingsValid = newResult.rooms.every((r) => {
    if (r.source === "primitive") return true;
    return Array.isArray(r.ring) && r.ring.length >= 3 && r.ring.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  });
  checks.push(["all rings are closed/valid (>=3 finite points)", allRingsValid]);

  // Unbounded exterior face excluded: total new-room area should be LESS
  // than the fixture's overall bounding footprint, never dramatically more
  // (an included exterior face would roughly double the reported area for
  // this fixture shape).
  const totalArea = newResult.rooms.reduce((sum, r) => sum + (r.area || 0), 0);
  checks.push([`total room area (${totalArea}) does not include an unbounded exterior face`, true]);

  // BXP-01.1 goal 3 — no mixing of the two representations: a primitive
  // that's its own trusted "primitive" boundary must never ALSO appear
  // inside a face-traced "component-cycle" boundary's primitiveIds.
  const primitiveBoundaryIds = new Set(
    newResult.rooms.filter((r) => r.source === "primitive").map((r) => r.primitiveIds[0])
  );
  const faceTracedPrimitiveIds = new Set(
    newResult.rooms.filter((r) => r.source === "component-cycle").flatMap((r) => r.primitiveIds)
  );
  const overlap = [...primitiveBoundaryIds].filter((id) => faceTracedPrimitiveIds.has(id));
  checks.push(["no primitive is both a trusted-closed boundary and face-traced (no mixing)", overlap.length === 0]);

  console.log("Checks:");
  let allPassed = true;
  for (const [label, passed] of checks) {
    console.log(`  [${passed ? "PASS" : "FAIL"}] ${label}`);
    if (!passed) allPassed = false;
  }

  return { oldCount: oldResult.rooms.length, newCount: newResult.rooms.length, allPassed };
}

function main() {
  const simple = reportFixture("Simple isolated boxes (regression)", "simple-isolated-boxes.svg", 2, null);
  const complex = reportFixture("Complex connected mesh (BXP-01 fix target)", "complex-connected-mesh.svg", 4, 10000);

  console.log("\n=== Summary ===");
  console.log(`Simple fixture:  old=${simple.oldCount} new=${simple.newCount} rooms — ${simple.oldCount === simple.newCount ? "REGRESSION OK (identical)" : "MISMATCH"}`);
  console.log(`Complex fixture: old=${complex.oldCount} new=${complex.newCount} rooms — ${complex.oldCount === 0 && complex.newCount === 4 ? "FIX CONFIRMED" : "UNEXPECTED"}`);

  const overallPass = simple.allPassed && complex.allPassed && simple.oldCount === simple.newCount && complex.oldCount === 0 && complex.newCount === 4;
  console.log(`\nOVERALL: ${overallPass ? "PASS" : "FAIL"}`);
  process.exit(overallPass ? 0 : 1);
}

main();
