// BXP-01 real-data validation — STRICTLY READ-ONLY. Uses only Prisma
// findFirst/findUnique reads against the already-persisted rows for the
// real "BuildingSVG" building. Never calls create/update/delete, never
// calls generateCandidates/map-model generate/publish, never writes
// anything back. Computes the NEW algorithm's result purely in memory from
// the persisted cleanedGeometry (Stage 2 output, unchanged by BXP-01) and
// compares it against the ALREADY-PERSISTED OLD candidateObjects (computed
// before this fix, when candidates were generated for this real floor) —
// so "old" here is real historical output, not a re-derivation.

const { prisma } = require("../../../../../../config/database");

const { buildTopology: buildTopologyNew } = require("../topology-builder");
const { traceRing: traceRingNew } = require("../candidate-geometry.util");
const { buildTopology: buildTopologyLegacy } = require("./legacy-topology-builder");
const { traceRing: traceRingLegacy } = require("./legacy-candidate-geometry.util");

function unsignedShoelace(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(sum) / 2;
}

function extractRoomsFromTopology(topology, cleanedGeometry, traceRing) {
  const nodesById = new Map(topology.nodes.map((n) => [n.id, n]));
  const byId = new Map(cleanedGeometry.map((p) => [p.id, p]));
  let succeeded = 0;
  let failed = 0;
  const areas = [];

  for (const boundary of topology.closedBoundaries) {
    if (boundary.type === "primitive") {
      const primitive = byId.get(boundary.primitiveId);
      const g = primitive.geometry;
      if (primitive.type === "rect") areas.push(g.width * g.height);
      succeeded += 1;
      continue;
    }

    const ring = traceRing(boundary.nodeIds, topology.edges, nodesById);

    if (!ring) {
      failed += 1;
      continue;
    }

    areas.push(unsignedShoelace(ring));
    succeeded += 1;
  }

  return { succeeded, failed, areas };
}

async function main() {
  const building = await prisma.building.findFirst({ where: { name: "BuildingSVG" } });

  if (!building) {
    console.log("BuildingSVG not found — read-only lookup, nothing else to do.");
    return;
  }

  const floor = await prisma.floor.findFirst({ where: { buildingId: building.id } });
  const blueprintImport = await prisma.blueprintImport.findFirst({
    where: { buildingId: building.id, floorId: floor.id },
    orderBy: { version: "desc" },
  });
  const normalized = await prisma.normalizedBlueprint.findUnique({
    where: { blueprintImportId: blueprintImport.id },
  });
  const geometryModel = await prisma.geometryModel.findUnique({
    where: { normalizedBlueprintId: normalized.id },
  });

  console.log(`Building: ${building.name} (${building.id})`);
  console.log(`Floor: ${floor.name} (${floor.id})`);
  console.log(`BlueprintImport: ${blueprintImport.originalFilename} v${blueprintImport.version} (${blueprintImport.id})`);

  if (!geometryModel) {
    console.log("No persisted GeometryModel for this floor — nothing to validate against.");
    return;
  }

  const cleanedGeometry = geometryModel.cleanedGeometry;
  console.log(`\nPersisted cleanedGeometry primitive count: ${cleanedGeometry.length}`);
  const closedCount = cleanedGeometry.filter((p) => p.closed).length;
  const withSegmentsCount = cleanedGeometry.filter((p) => p.segments.length > 0).length;
  console.log(`  closed=true primitives: ${closedCount} / ${cleanedGeometry.length}`);
  console.log(`  primitives with segments: ${withSegmentsCount} / ${cleanedGeometry.length}`);

  const persistedOld = geometryModel.candidateObjects || {};
  const persistedOldBoundaryCount = (persistedOld.candidateBoundaries || []).length;
  const persistedOldEnclosureCount = (persistedOld.candidateEnclosures || []).length;
  console.log(`\n[Authoritative OLD — as persisted when candidates were last generated for this real floor]`);
  console.log(`  candidateBoundaries: ${persistedOldBoundaryCount}`);
  console.log(`  candidateEnclosures: ${persistedOldEnclosureCount}`);

  // Re-derive OLD topology/rooms too, purely in memory, for a topology-stage
  // comparison (closedBoundaries count) alongside the persisted candidate
  // counts above — both read from the same unchanged cleanedGeometry input.
  const topologyOld = buildTopologyLegacy(cleanedGeometry);
  const oldRooms = extractRoomsFromTopology(topologyOld, cleanedGeometry, traceRingLegacy);

  console.log(`\n[OLD algorithm, re-run in memory on the same persisted cleanedGeometry]`);
  console.log(`  topology.closedBoundaries: ${topologyOld.closedBoundaries.length}`);
  console.log(`  rooms traced successfully: ${oldRooms.succeeded}`);
  console.log(`  boundaries that FAILED to trace (branching topology): ${oldRooms.failed}`);

  const topologyNew = buildTopologyNew(cleanedGeometry);
  const newRooms = extractRoomsFromTopology(topologyNew, cleanedGeometry, traceRingNew);

  console.log(`\n[NEW algorithm (BXP-01), run in memory only — nothing written back]`);
  console.log(`  topology.closedBoundaries (faces): ${topologyNew.closedBoundaries.length}`);
  console.log(`  rooms traced successfully: ${newRooms.succeeded}`);
  console.log(`  boundaries that failed to trace: ${newRooms.failed}`);
  console.log(
    `  area stats: count=${newRooms.areas.length} min=${Math.min(...newRooms.areas).toFixed(2)} max=${Math.max(...newRooms.areas).toFixed(2)} mean=${(newRooms.areas.reduce((a, b) => a + b, 0) / newRooms.areas.length).toFixed(2)}`
  );

  console.log(`\n[Connected components — same computeConnectedComponents(), unaffected by BXP-01]`);
  console.log(`  connectedComponents: ${topologyNew.connectedComponents.length} (component sizes: ${topologyNew.connectedComponents.map((c) => c.primitiveIds.length).sort((a, b) => b - a).slice(0, 10).join(", ")}...)`);

  // --- Downstream validity: every NEW room's ring must be closed and
  // finite before it would ever reach room-assembler.js. ---
  const nodesByIdNew = new Map(topologyNew.nodes.map((n) => [n.id, n]));
  let invalidRings = 0;

  for (const boundary of topologyNew.closedBoundaries) {
    if (boundary.type === "primitive") continue;
    const ring = traceRingNew(boundary.nodeIds, topologyNew.edges, nodesByIdNew);
    if (!ring || ring.length < 3 || ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      invalidRings += 1;
    }
  }

  console.log(`\n[Downstream validity] boundaries with an invalid/non-finite ring: ${invalidRings}`);

  // --- Room-assembler multi-segment primitive risk check ---
  // room-assembler.js reconstructs a boundary's ring by dumping the FULL
  // segments list of every primitive in its primitiveIds, in order. That's
  // only safe if each primitive's segments belong entirely to ONE boundary.
  // If any primitive with >1 segment appears in TWO OR MORE different
  // component-cycle boundaries' primitiveIds, its segments were split
  // across two different real faces by BXP-01's fix — and room-assembler,
  // unmodified, would pull in the wrong segments for at least one of them.
  const primitiveById = new Map(cleanedGeometry.map((p) => [p.id, p]));
  const boundaryIndicesByPrimitiveId = new Map();

  topologyNew.closedBoundaries.forEach((boundary, index) => {
    if (boundary.type !== "component-cycle") return;
    for (const primitiveId of boundary.primitiveIds) {
      if (!boundaryIndicesByPrimitiveId.has(primitiveId)) boundaryIndicesByPrimitiveId.set(primitiveId, []);
      boundaryIndicesByPrimitiveId.get(primitiveId).push(index);
    }
  });

  const multiSegmentConflicts = [];

  for (const [primitiveId, boundaryIndices] of boundaryIndicesByPrimitiveId) {
    const primitive = primitiveById.get(primitiveId);
    if (!primitive || primitive.segments.length <= 1) continue;
    if (boundaryIndices.length > 1) {
      multiSegmentConflicts.push({
        primitiveId,
        primitiveType: primitive.type,
        segmentCount: primitive.segments.length,
        appearsInBoundaryIndices: boundaryIndices,
      });
    }
  }

  // BXP-01.1 goal 3 — no mixing: a primitive trusted as its own "primitive"
  // boundary must never also be face-traced into a component-cycle boundary.
  const closedPrimitiveIds = new Set(
    topologyNew.closedBoundaries.filter((b) => b.type === "primitive").map((b) => b.primitiveId)
  );
  const faceTracedIds = new Set(
    topologyNew.closedBoundaries.filter((b) => b.type === "component-cycle").flatMap((b) => b.primitiveIds)
  );
  const mixingOverlap = [...closedPrimitiveIds].filter((id) => faceTracedIds.has(id));
  console.log(`\n[No-mixing check] closed primitives also face-traced: ${mixingOverlap.length}`);

  console.log(`\n[Room-assembler multi-segment-primitive check]`);
  console.log(`  primitives with >1 segment shared across >1 boundary: ${multiSegmentConflicts.length}`);

  if (multiSegmentConflicts.length > 0) {
    console.log(`  EXAMPLE:`, JSON.stringify(multiSegmentConflicts[0], null, 2));
    console.log(`  (up to 5 shown)`, JSON.stringify(multiSegmentConflicts.slice(0, 5), null, 2));
  }

  console.log("\n=== SUMMARY ===");
  console.log(`OLD: ${oldRooms.succeeded} rooms traced, ${oldRooms.failed} boundaries failed (branching topology)`);
  console.log(`NEW: ${newRooms.succeeded} rooms traced, ${newRooms.failed} boundaries failed`);
  console.log(`Invalid downstream rings: ${invalidRings}`);
  console.log(`Multi-segment-primitive conflicts found: ${multiSegmentConflicts.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
