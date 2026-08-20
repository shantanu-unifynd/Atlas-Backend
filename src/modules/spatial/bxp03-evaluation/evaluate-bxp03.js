// BXP-03 — read-only evaluation of the current extraction pipeline
// (BXP-01 + BXP-01.1 + BXP-01.3 + BXP-02) against real, already-persisted
// GeometryModel data. STRICTLY READ-ONLY: only Prisma finds, zero writes,
// no generation/regeneration endpoints called anywhere in this file.
//
// Calls the REAL production functions for every stage except one: the
// pre-regularization ring itself isn't exported from room-assembler.js
// (only assembleRooms() is, and BXP-02's regularizeRing() call is baked
// inside its loop). To report a before/after vertex count, this file keeps
// a local copy of the CURRENT (BXP-01.3-fixed) ring-assembly logic —
// identical in spirit to the same accepted pattern in the already-
// committed bxp02-validation/ scripts — used ONLY to produce a
// pre-regularization baseline for comparison. Every other number (room
// counts, validity, areas, topology breakdown, final regularized
// polygons, idempotence) comes directly from calling the real, unmodified
// production functions.

const { prisma } = require("../../../config/database");
const { buildTopology } = require("../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../mapModel/pipeline/coordinate-normalizer");
const { assembleRooms } = require("../mapModel/pipeline/room-assembler");
const { regularizeRing } = require("../mapModel/pipeline/polygon-regularizer");

const EPS = 0.05;

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

// Local copy of the CURRENT (fixed) ring-assembly logic, used only to
// establish a pre-regularization vertex-count baseline for comparison —
// see file header. Not a second algorithm: same direction-matching rule as
// production room-assembler.js's ringFromBoundary().
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
function ringBeforeRegularization(boundary, primitivesById) {
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
  if (n === 0) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
function hasSelfIntersection(points) {
  // Cheap, existing-utility-consistent check: any two non-adjacent edges
  // intersect. O(n^2), fine for room-sized polygons.
  const n = points.length;
  function segIntersect(p1, p2, p3, p4) {
    function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
    const d1 = cross(p3, p4, p1);
    const d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3);
    const d4 = cross(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

// Same "search newest to oldest, stop at the first import that actually has
// a persisted GeometryModel" logic as mapModel.service.js's own
// loadGeometrySources() -- reused, not reinvented, since not every
// blueprint version necessarily has geometry extracted for it.
async function findImportWithGeometry(buildingId, floorId) {
  const imports = await prisma.blueprintImport.findMany({
    where: { buildingId, floorId },
    orderBy: { version: "desc" },
  });
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

async function loadFloor(buildingName, floorNamePredicate) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = floorNamePredicate ? floors.find(floorNamePredicate) : floors[0];
  const found = await findImportWithGeometry(building.id, floor.id);
  if (!found) return { building, floor, blueprintImport: null, normalizedBlueprint: null, geometryModel: null };
  const { blueprintImport, normalizedBlueprint, geometryModel } = found;
  return { building, floor, blueprintImport, normalizedBlueprint, geometryModel };
}

// eslint-disable-next-line no-unused-vars
async function _unused_oldLoadFloor(buildingName, floorNamePredicate) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = floorNamePredicate ? floors.find(floorNamePredicate) : floors[0];
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
  return { building, floor, blueprintImport, normalizedBlueprint, geometryModel };
}

async function evaluate(label, buildingName, floorNamePredicate) {
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
  const { building, floor, blueprintImport, normalizedBlueprint, geometryModel } = await loadFloor(
    buildingName,
    floorNamePredicate
  );

  console.log(`Building: ${building.name} | Floor: ${floor.name} | File: ${blueprintImport.originalFilename} (v${blueprintImport.version}, ${blueprintImport.fileSize}B)`);

  const cleanedGeometry = geometryModel.cleanedGeometry;
  const closed = cleanedGeometry.filter((p) => p.closed);
  const open = cleanedGeometry.filter((p) => !p.closed);
  const totalSegments = cleanedGeometry.reduce((s, p) => s + (p.segments ? p.segments.length : 0), 0);

  // --- Real production pipeline, called directly ---
  const topology = buildTopology(cleanedGeometry);
  const { candidateObjects } = classifyGeometry(cleanedGeometry, topology);
  const boundaries = candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);
  const primitivesById = new Map(normalized.primitives.map((p) => [p.id, p]));

  const authoredRoomBoundaries = topology.closedBoundaries.filter((b) => b.type === "primitive");
  const faceRoomBoundaries = topology.closedBoundaries.filter((b) => b.type === "component-cycle");

  const afterResult = assembleRooms({
    primitives: normalized.primitives,
    boundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const afterRooms = afterResult.rooms.filter((r) => r.polygon);
  const invalidAfter = afterRooms.filter(
    (r) => !r.polygon || r.polygon.length < 3 || r.polygon.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  );
  const validAfter = afterRooms.length - invalidAfter.length;

  // Pre-regularization baseline (local reconstruction, see header).
  const beforeVertexTotal = boundaries.reduce((sum, b) => {
    const ring = ringBeforeRegularization(b, primitivesById);
    return ring.length >= 3 && unsignedShoelace(ring) >= 25 ? sum + ring.length : sum;
  }, 0);
  const afterVertexTotal = afterRooms.reduce((s, r) => s + r.polygon.length, 0);

  const areas = afterRooms.map((r) => r.area).filter((a) => Number.isFinite(a)).sort((a, b) => a - b);
  const selfIntersecting = afterRooms.filter((r) => hasSelfIntersection(r.polygon)).length;
  const idempotent = afterRooms.every((r) => {
    const once = regularizeRing(r.polygon);
    return once.length === r.polygon.length && once.every((p, i) => p.x === r.polygon[i].x && p.y === r.polygon[i].y);
  });

  console.log(`\n[1. Source complexity]`);
  console.log(`  primitives (raw): ${geometryModel.diagnostics.primitiveCount}, cleaned: ${cleanedGeometry.length}`);
  console.log(`  closed primitives: ${closed.length}, open primitives: ${open.length}`);
  console.log(`  total segments: ${totalSegments}`);
  console.log(`  connected components: ${topology.connectedComponents.length}`);

  console.log(`\n[2. Topology/extraction]`);
  console.log(`  authored (closed-primitive) boundaries: ${authoredRoomBoundaries.length}`);
  console.log(`  face-extracted (open/shared-wall) boundaries: ${faceRoomBoundaries.length}`);
  console.log(`  total boundaries: ${topology.closedBoundaries.length}`);
  console.log(`  = authored (${authoredRoomBoundaries.length}) + face-extracted (${faceRoomBoundaries.length}) = ${authoredRoomBoundaries.length + faceRoomBoundaries.length}`);
  console.log(`  candidate/assembled room count: ${afterRooms.length}`);

  console.log(`\n[3. Polygon quality]`);
  console.log(`  total rooms: ${afterRooms.length}, valid: ${validAfter}, invalid: ${invalidAfter.length} (${((validAfter / Math.max(afterRooms.length, 1)) * 100).toFixed(1)}% valid)`);
  console.log(`  self-intersecting rooms: ${selfIntersecting}`);

  console.log(`\n[4. Area distribution]`);
  if (areas.length) {
    const min = areas[0], max = areas[areas.length - 1];
    const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
    const med = median(areas);
    console.log(`  min=${min.toFixed(1)} median=${med.toFixed(1)} mean=${mean.toFixed(1)} max=${max.toFixed(1)}`);
    console.log(`  largest/median ratio: ${(max / (med || 1)).toFixed(2)}x`);
  } else {
    console.log("  (no valid-area rooms)");
  }

  console.log(`\n[5. Polygon complexity]`);
  console.log(`  total vertices: before=${beforeVertexTotal} after=${afterVertexTotal} (${beforeVertexTotal ? (((beforeVertexTotal - afterVertexTotal) / beforeVertexTotal) * 100).toFixed(1) : "0.0"}% reduction)`);
  console.log(`  avg vertices/room: before=${(beforeVertexTotal / Math.max(afterRooms.length, 1)).toFixed(2)} after=${(afterVertexTotal / Math.max(afterRooms.length, 1)).toFixed(2)}`);
  console.log(`  idempotent: ${idempotent}`);

  return {
    label, buildingName: building.name, floorName: floor.name,
    primitives: cleanedGeometry.length, closed: closed.length, open: open.length,
    components: topology.connectedComponents.length,
    authored: authoredRoomBoundaries.length, faceRooms: faceRoomBoundaries.length,
    total: afterRooms.length, valid: validAfter, invalid: invalidAfter.length,
    areas, beforeVertexTotal, afterVertexTotal, idempotent, selfIntersecting,
  };
}

async function main() {
  const results = [];
  results.push(await evaluate("Floor 1: BuildingSVG / 1stFloor (regression baseline)", "BuildingSVG"));
  results.push(
    await evaluate("Floor 2: Phoenix Palassio / Ground Floor (problem floor)", "Phoenix Palassio")
  );
  results.push(
    await evaluate(
      "Floor 3: Unifynd tech / Ground Floor (structurally different real floor)",
      "Unifynd tech",
      (f) => f.name === "Ground Floor"
    )
  );

  console.log(`\n${"=".repeat(70)}\nSUMMARY TABLE\n${"=".repeat(70)}`);
  console.log("Floor | Primitives | Closed | Open | Components | Authored | FaceRooms | Total | Valid | Invalid");
  for (const r of results) {
    console.log(
      `${r.buildingName}/${r.floorName} | ${r.primitives} | ${r.closed} | ${r.open} | ${r.components} | ${r.authored} | ${r.faceRooms} | ${r.total} | ${r.valid} | ${r.invalid}`
    );
  }

  const baseline = results[0];
  const baselinePass = baseline.total === 57 && baseline.valid === 57 && baseline.invalid === 0;
  console.log(`\nBuildingSVG regression: expected 57/57/0, actual ${baseline.total}/${baseline.valid}/${baseline.invalid} -> ${baselinePass ? "PASS" : "FAIL"}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
