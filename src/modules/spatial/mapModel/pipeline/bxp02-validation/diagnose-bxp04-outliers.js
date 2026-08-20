// BXP-04 — read-only outlier diagnosis. STRICTLY READ-ONLY: Prisma finds
// only, zero writes, no generation calls, no production code changed.
// Calls the real production pipeline to find each floor's largest accepted
// room, then traces it back to its source boundary/primitives to diagnose
// whether it's a legitimate large space, a merged-rooms artifact, a non-
// room architectural/decorative region, or something else -- from evidence.

const { prisma } = require("../../../../../config/database");
const { buildTopology } = require("../../../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../../../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../coordinate-normalizer");
const { assembleRooms } = require("../room-assembler");

function median(sorted) {
  const n = sorted.length;
  if (!n) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function bbox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
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

async function diagnose(buildingName) {
  console.log(`\n${"=".repeat(70)}\n${buildingName}\n${"=".repeat(70)}`);
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floor = await prisma.floor.findFirst({ where: { buildingId: building.id } });
  const { normalizedBlueprint, geometryModel } = await findImportWithGeometry(building.id, floor.id);

  const cleanedGeometry = geometryModel.cleanedGeometry;
  const topology = buildTopology(cleanedGeometry);
  const { candidateObjects } = classifyGeometry(cleanedGeometry, topology);
  const boundaries = candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);
  const primitivesById = new Map(normalized.primitives.map((p) => [p.id, p]));
  const rawPrimitivesById = new Map(cleanedGeometry.map((p) => [p.id, p]));

  const result = assembleRooms({
    primitives: normalized.primitives,
    boundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const rooms = result.rooms.filter((r) => r.polygon);
  const areas = rooms.map((r) => r.area).sort((a, b) => a - b);
  const med = median(areas);

  const outlier = rooms.reduce((max, r) => (r.area > (max ? max.area : -1) ? r : max), null);
  const boundaryId = outlier.id.replace(/^room-/, "");
  const boundary = boundaries.find((b) => b.id === boundaryId);
  if (!boundary) {
    console.log(`DEBUG: outlier.id=${outlier.id} boundaryId=${boundaryId} boundaries.length=${boundaries.length} sample ids=${boundaries.slice(0, 5).map((b) => b.id).join(",")}`);
  }

  // Overall floor extent, for comparison (does the outlier span ~the whole
  // floor, suggesting a building-envelope/outer-boundary path rather than
  // a room?).
  const allPoints = normalized.primitives.flatMap((p) => p.segments.flatMap((s) => [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]));
  const floorBbox = bbox(allPoints);
  const floorWidth = floorBbox.maxX - floorBbox.minX;
  const floorHeight = floorBbox.maxY - floorBbox.minY;
  const floorArea = floorWidth * floorHeight;

  const outlierBbox = bbox(outlier.polygon);
  const outlierWidth = outlierBbox.maxX - outlierBbox.minX;
  const outlierHeight = outlierBbox.maxY - outlierBbox.minY;

  console.log(`Median room area: ${med.toFixed(1)}`);
  console.log(`Outlier area: ${outlier.area}, ratio: ${(outlier.area / (med || 1)).toFixed(2)}x`);
  console.log(`Outlier vertex count: ${outlier.polygon.length}`);
  console.log(`Source type: ${boundary.source}`);
  console.log(`primitiveIds count: ${boundary.primitiveIds.length}`);
  console.log(`Outlier bbox: (${outlierBbox.minX.toFixed(1)},${outlierBbox.minY.toFixed(1)}) - (${outlierBbox.maxX.toFixed(1)},${outlierBbox.maxY.toFixed(1)}), size ${outlierWidth.toFixed(1)} x ${outlierHeight.toFixed(1)}`);
  console.log(`Floor overall bbox: (${floorBbox.minX.toFixed(1)},${floorBbox.minY.toFixed(1)}) - (${floorBbox.maxX.toFixed(1)},${floorBbox.maxY.toFixed(1)}), size ${floorWidth.toFixed(1)} x ${floorHeight.toFixed(1)}, area ${floorArea.toFixed(1)}`);
  console.log(`Outlier bbox covers ${((outlierWidth / floorWidth) * 100).toFixed(1)}% of floor width, ${((outlierHeight / floorHeight) * 100).toFixed(1)}% of floor height`);
  console.log(`Outlier area / floor bbox area: ${((outlier.area / floorArea) * 100).toFixed(1)}%`);

  if (boundary.source === "primitive") {
    const prim = rawPrimitivesById.get(boundary.primitiveIds[0]);
    console.log(`\nSource primitive: id=${prim.id} type=${prim.type} layer=${prim.layer || "(none)"} segments=${prim.segments.length} closed=${prim.closed}`);
  } else {
    console.log(`\nFace-extracted from ${boundary.primitiveIds.length} primitives:`);
    for (const pid of boundary.primitiveIds.slice(0, 15)) {
      const prim = rawPrimitivesById.get(pid);
      if (prim) console.log(`  - ${pid}: type=${prim.type} layer=${prim.layer || "(none)"} segments=${prim.segments.length}`);
    }
    // Which connected component(s) contributed these primitives?
    const compIndexByPrimitive = new Map();
    topology.connectedComponents.forEach((c, idx) => c.primitiveIds.forEach((pid) => compIndexByPrimitive.set(pid, idx)));
    const compIndices = new Set(boundary.primitiveIds.map((pid) => compIndexByPrimitive.get(pid)));
    console.log(`  contributing connected component(s): ${[...compIndices].join(", ")}`);
    for (const idx of compIndices) {
      console.log(`  component ${idx} total primitive count: ${topology.connectedComponents[idx].primitiveIds.length}`);
    }
  }

  return { buildingName, area: outlier.area, median: med, ratio: outlier.area / (med || 1), vertexCount: outlier.polygon.length, source: boundary.source, primitiveCount: boundary.primitiveIds.length };
}

async function main() {
  const a = await diagnose("BuildingSVG");
  const b = await diagnose("Phoenix Palassio");
  console.log(`\n${"=".repeat(70)}\nSUMMARY\n${"=".repeat(70)}`);
  console.log(JSON.stringify([a, b], null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
