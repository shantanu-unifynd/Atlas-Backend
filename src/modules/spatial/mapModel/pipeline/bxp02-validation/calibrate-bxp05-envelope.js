// BXP-05 — read-only envelope-heuristic calibration. STRICTLY READ-ONLY:
// Prisma finds only, zero writes, no generation calls, no production code
// touched. Calls the real production pipeline (buildTopology,
// classifyGeometry, normalizeGeometry, assembleRooms) against every real
// floor with a persisted GeometryModel, and for every authored-closed-
// primitive room candidate reports its bbox width/height/area coverage of
// the floor's overall geometry bbox, plus polygon-area/floor-bbox-area
// ratio, to look for a data-driven threshold that separates real building-
// envelope shapes from legitimate large rooms.

const { prisma } = require("../../../../../config/database");
const { buildTopology } = require("../../../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../../../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../coordinate-normalizer");
const { assembleRooms } = require("../room-assembler");

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

async function evaluateFloor(buildingName, floorName) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = floors.find((f) => f.name === floorName);
  if (!floor) return null;
  const found = await findImportWithGeometry(building.id, floor.id);
  if (!found) return null;
  const { normalizedBlueprint, geometryModel } = found;

  const cleanedGeometry = geometryModel.cleanedGeometry;
  const topology = buildTopology(cleanedGeometry);
  const { candidateObjects } = classifyGeometry(cleanedGeometry, topology);
  const boundaries = candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);

  const result = assembleRooms({
    primitives: normalized.primitives,
    boundaries,
    nodes: [],
    usoByCandidateId: new Map(),
    semanticByUsoId: new Map(),
  });
  const rooms = result.rooms.filter((r) => r.polygon);
  const boundaryById = new Map(boundaries.map((b) => [b.id, b]));

  const allPoints = normalized.primitives.flatMap((p) => p.segments.flatMap((s) => [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]));
  if (allPoints.length === 0) return { buildingName, floorName, candidates: [], floorArea: 0 };
  const floorBbox = bbox(allPoints);
  const floorWidth = floorBbox.maxX - floorBbox.minX || 1;
  const floorHeight = floorBbox.maxY - floorBbox.minY || 1;
  const floorArea = floorWidth * floorHeight;

  const candidates = [];
  for (const room of rooms) {
    const boundary = boundaryById.get(room.id.replace(/^room-/, ""));
    if (!boundary || boundary.source !== "primitive") continue; // authored-closed-primitive candidates only
    const rb = bbox(room.polygon);
    const w = rb.maxX - rb.minX;
    const h = rb.maxY - rb.minY;
    candidates.push({
      roomId: room.id,
      area: room.area,
      widthCoverage: (w / floorWidth) * 100,
      heightCoverage: (h / floorHeight) * 100,
      bboxAreaCoverage: ((w * h) / floorArea) * 100,
      polyAreaCoverage: (room.area / floorArea) * 100,
    });
  }

  return { buildingName, floorName, candidates, floorArea, totalRooms: rooms.length };
}

async function main() {
  const targets = [
    ["Atlas Demo Mall", "Level 1"],
    ["August", "Ground"],
    ["August", "Ground (auto-traced)"],
    ["BuildingSVG", "1stFloor"],
    ["Unifynd tech", "Ground Floor"],
    ["Unifynd tech", "First Floor"],
    ["Unifynd tech", "Second Floor"],
    ["Unifynd tech", "parking"],
    ["Unifynd tech", "Nav Lab"],
    ["Unifynd tech", "Nav Lab 2"],
    ["Unifynd tech", "Nav Lab 3"],
    ["Phoenix Palassio", "Ground Floor"],
  ];

  const allResults = [];
  for (const [b, f] of targets) {
    // eslint-disable-next-line no-await-in-loop
    const r = await evaluateFloor(b, f);
    if (r) allResults.push(r);
  }

  console.log("Floor | TotalRooms | ClosedPrimCandidates | Candidate coverage (width%/height%/bboxArea%/polyArea%)");
  for (const r of allResults) {
    console.log(`\n${r.buildingName} / ${r.floorName} — total rooms: ${r.totalRooms}, closed-primitive candidates: ${r.candidates.length}`);
    const sorted = [...r.candidates].sort((a, b) => b.polyAreaCoverage - a.polyAreaCoverage);
    for (const c of sorted) {
      console.log(
        `  ${c.roomId}: area=${c.area.toFixed(1)} width%=${c.widthCoverage.toFixed(1)} height%=${c.heightCoverage.toFixed(1)} bboxArea%=${c.bboxAreaCoverage.toFixed(1)} polyArea%=${c.polyAreaCoverage.toFixed(1)}`
      );
    }
  }

  console.log("\n\n=== ALL CANDIDATES SORTED BY polyArea% (top 20) ===");
  const flat = allResults.flatMap((r) => r.candidates.map((c) => ({ floor: `${r.buildingName}/${r.floorName}`, ...c })));
  flat.sort((a, b) => b.polyAreaCoverage - a.polyAreaCoverage);
  for (const c of flat.slice(0, 20)) {
    console.log(`${c.floor} | ${c.roomId} | area=${c.area.toFixed(1)} | width%=${c.widthCoverage.toFixed(1)} height%=${c.heightCoverage.toFixed(1)} bboxArea%=${c.bboxAreaCoverage.toFixed(1)} polyArea%=${c.polyAreaCoverage.toFixed(1)}`);
  }

  console.log("\n\n=== FULL DISTRIBUTION (all candidates, all floors) ===");
  flat.sort((a, b) => a.polyAreaCoverage - b.polyAreaCoverage);
  for (const c of flat) {
    console.log(`${c.floor} | polyArea%=${c.polyAreaCoverage.toFixed(2)} bboxArea%=${c.bboxAreaCoverage.toFixed(2)} width%=${c.widthCoverage.toFixed(1)} height%=${c.heightCoverage.toFixed(1)} area=${c.area.toFixed(1)}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
