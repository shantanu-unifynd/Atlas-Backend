// BXP-11A -- READ-ONLY calibration. Prisma find* only, zero writes, no
// candidate regeneration, no MPM generation, no production code touched.
// Calls the real, unmodified production pipeline functions (buildTopology,
// classifyGeometry, normalizeGeometry, regularizeRing, hasSelfIntersection)
// to recompute each floor's ACCEPTED assembled rooms exactly as the real
// pipeline would, then measures three candidate junk-shape signals against
// them: aspect ratio, vertex density, and exact-duplicate detection.
const { prisma } = require("../../../config/database");
const { buildTopology } = require("../processing/geometry/pipeline/topology-builder");
const { classifyGeometry } = require("../processing/geometry/pipeline/geometry-classifier");
const { normalizeGeometry } = require("../mapModel/pipeline/coordinate-normalizer");
const { regularizeRing } = require("../mapModel/pipeline/polygon-regularizer");
const { hasSelfIntersection } = require("../mapModel/pipeline/room-assembler");

const MIN_AREA = 25, EPS = 0.05, ENVELOPE_POLY_AREA_PERCENT = 50;

function samePoint(a, b) { return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS; }
function shoelaceArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}
function bboxOf(pts) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
function overallGeometryBbox(primitives) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const primitive of primitives) {
    for (const s of primitive.segments || []) {
      minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2);
    }
  }
  if (!Number.isFinite(minX)) return 0;
  return (maxX - minX) * (maxY - minY);
}
function primitiveOwnPoints(primitive) {
  const pts = [];
  const push = (p) => { const last = pts[pts.length - 1]; if (!last || !samePoint(last, p)) pts.push({ x: p.x, y: p.y }); };
  for (const s of primitive.segments) { push({ x: s.x1, y: s.y1 }); push({ x: s.x2, y: s.y2 }); }
  return pts;
}
function ringFromBoundary(boundary, primitivesById) {
  const ids = Array.isArray(boundary.primitiveIds) ? boundary.primitiveIds : [];
  const ring = [];
  const append = (piece) => { for (const p of piece) { const last = ring[ring.length - 1]; if (!last || !samePoint(last, p)) ring.push(p); } };
  function firstNonEmptyPieceFrom(startIndex) {
    for (let i = startIndex; i < ids.length; i += 1) {
      const p = primitivesById.get(ids[i]);
      if (p && Array.isArray(p.segments) && p.segments.length > 0) return primitiveOwnPoints(p);
    }
    return null;
  }
  for (let idx = 0; idx < ids.length; idx += 1) {
    const prim = primitivesById.get(ids[idx]);
    if (!prim || !Array.isArray(prim.segments) || prim.segments.length === 0) continue;
    const piece = primitiveOwnPoints(prim);
    if (piece.length === 0) continue;
    const cursor = ring[ring.length - 1];
    if (!cursor) {
      const nextPiece = firstNonEmptyPieceFrom(idx + 1);
      const nextEndpoints = nextPiece ? [nextPiece[0], nextPiece[nextPiece.length - 1]] : [];
      const endsAtNext = nextEndpoints.some((p) => samePoint(p, piece[piece.length - 1]));
      const startsAtNext = nextEndpoints.some((p) => samePoint(p, piece[0]));
      if (!endsAtNext && startsAtNext) append([...piece].reverse()); else append(piece);
    } else if (samePoint(cursor, piece[0])) append(piece);
    else if (samePoint(cursor, piece[piece.length - 1])) append([...piece].reverse());
    else append(piece);
  }
  if (ring.length >= 2 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();
  return ring;
}

// Canonicalize for exact-duplicate detection: rotate so the ring starts at
// its lexicographically-smallest point (x then y). Winding is already
// normalized by regularizeRing itself, so this only removes start-index
// ambiguity. No fuzzy matching -- direct float equality on already-
// regularized (and therefore already-deduped/collinear-cleaned) points.
function canonicalizeRing(ring) {
  if (ring.length === 0) return ring;
  let minIdx = 0;
  for (let i = 1; i < ring.length; i += 1) {
    if (ring[i].x < ring[minIdx].x || (ring[i].x === ring[minIdx].x && ring[i].y < ring[minIdx].y)) minIdx = i;
  }
  return [...ring.slice(minIdx), ...ring.slice(0, minIdx)];
}
function ringsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

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

// Recompute accepted rooms exactly as the real pipeline would, from
// whatever candidateObjects are ALREADY persisted for this floor (does not
// regenerate anything). For BuildingSVG/Unifynd tech/BXP-08 these are
// current-algorithm candidates; for Phoenix these are the BXP-09 fresh ones.
async function acceptedRoomsForFloor(label, buildingName, floorPredicateOrName) {
  const building = await prisma.building.findFirst({ where: { name: buildingName } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = typeof floorPredicateOrName === "function" ? floors.find(floorPredicateOrName) : floors.find((f) => f.name === floorPredicateOrName);
  const found = await findImportWithGeometry(building.id, floor.id);
  const { normalizedBlueprint, geometryModel } = found;

  const boundaries = geometryModel.candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);
  const primitivesById = new Map(normalized.primitives.map((p) => [p.id, p]));
  const floorBboxArea = overallGeometryBbox(normalized.primitives);

  const rooms = [];
  for (const boundary of boundaries) {
    const rawRing = ringFromBoundary(boundary, primitivesById);
    const ring = regularizeRing(rawRing);
    if (ring.length < 3) continue;
    if (hasSelfIntersection(ring)) continue;
    const area = shoelaceArea(ring);
    if (area < MIN_AREA) continue;
    if (boundary.source === "primitive" && floorBboxArea > 0 && (area / floorBboxArea) * 100 > ENVELOPE_POLY_AREA_PERCENT) continue;

    const bb = bboxOf(ring);
    const width = bb.maxX - bb.minX, height = bb.maxY - bb.minY;
    const aspectRatio = Math.max(width, height) / Math.max(Math.min(width, height), 0.001);
    const canon = canonicalizeRing(ring);
    rooms.push({
      floor: label, id: boundary.id, source: boundary.source,
      area: Math.round(area * 100) / 100, vertices: ring.length,
      width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100,
      aspectRatio: Math.round(aspectRatio * 100) / 100,
      vertexDensityPerArea: Math.round((ring.length / area) * 1e6) / 1e6,
      vertexDensityPerBboxArea: Math.round((ring.length / Math.max(width * height, 0.001)) * 1e6) / 1e6,
      canonRing: canon,
    });
  }
  return rooms;
}

function printDistribution(label, rooms, field) {
  const vals = rooms.map((r) => r[field]).sort((a, b) => a - b);
  if (vals.length === 0) { console.log(`  ${label}: (no rooms)`); return; }
  const min = vals[0], max = vals[vals.length - 1];
  const median = vals[Math.floor(vals.length / 2)];
  console.log(`  ${label}: n=${vals.length} min=${min} median=${median} max=${max}`);
}

async function main() {
  console.log("Recomputing accepted rooms for each floor (real pipeline, already-persisted candidates)...\n");

  const buildingSvg = await acceptedRoomsForFloor("BuildingSVG/1stFloor", "BuildingSVG", "1stFloor");
  const unifyndTech = await acceptedRoomsForFloor("UnifyndTech/Ground", "Unifynd tech", "Ground Floor");
  const bxp08 = await acceptedRoomsForFloor("BXP-08/isolated", "BXP-08 Isolated Test Building", (f) => true);
  const phoenix = await acceptedRoomsForFloor("Phoenix/Ground(v13-candidates)", "Phoenix Palassio", "Ground Floor");

  const knownGood = [...buildingSvg, ...unifyndTech, ...bxp08];

  console.log(`Known-good rooms: BuildingSVG=${buildingSvg.length}, UnifyndTech=${unifyndTech.length}, BXP-08=${bxp08.length}, total=${knownGood.length}`);
  console.log(`Phoenix accepted rooms: ${phoenix.length}`);
  console.log("");

  console.log("=== SIGNAL 1: Aspect ratio (max(w,h)/min(w,h)) ===");
  printDistribution("Known-good (all)", knownGood, "aspectRatio");
  printDistribution("BuildingSVG only", buildingSvg, "aspectRatio");
  printDistribution("UnifyndTech only", unifyndTech, "aspectRatio");
  printDistribution("BXP-08 only", bxp08, "aspectRatio");
  printDistribution("Phoenix (all 22)", phoenix, "aspectRatio");
  console.log("  Known-good full sorted list:", knownGood.map((r) => r.aspectRatio).sort((a, b) => a - b));
  console.log("  Phoenix full sorted list:", phoenix.map((r) => r.aspectRatio).sort((a, b) => a - b));
  console.log("  Phoenix detail (sorted desc):");
  [...phoenix].sort((a, b) => b.aspectRatio - a.aspectRatio).forEach((r) => console.log(`    ${r.id} aspect=${r.aspectRatio} (${r.width}x${r.height}) area=${r.area}`));
  console.log("");

  console.log("=== SIGNAL 2: Vertex density (vertices / polygon area, and vertices / bbox area) ===");
  printDistribution("Known-good vertices/area", knownGood, "vertexDensityPerArea");
  printDistribution("Phoenix vertices/area", phoenix, "vertexDensityPerArea");
  printDistribution("Known-good vertices/bboxArea", knownGood, "vertexDensityPerBboxArea");
  printDistribution("Phoenix vertices/bboxArea", phoenix, "vertexDensityPerBboxArea");
  console.log("  Known-good full sorted (vertices/area):", knownGood.map((r) => r.vertexDensityPerArea).sort((a, b) => a - b));
  console.log("  Phoenix full sorted (vertices/area):", phoenix.map((r) => r.vertexDensityPerArea).sort((a, b) => a - b));
  console.log("  Phoenix detail (sorted desc by vertices/area):");
  [...phoenix].sort((a, b) => b.vertexDensityPerArea - a.vertexDensityPerArea).forEach((r) => console.log(`    ${r.id} vertices=${r.vertices} area=${r.area} v/area=${r.vertexDensityPerArea} v/bboxArea=${r.vertexDensityPerBboxArea}`));
  console.log("");

  console.log("=== SIGNAL 3: Exact duplicate polygons (canonicalized ring equality) ===");
  const allRooms = [...knownGood, ...phoenix];
  const groups = [];
  const used = new Set();
  for (let i = 0; i < allRooms.length; i += 1) {
    if (used.has(i)) continue;
    const group = [allRooms[i]];
    for (let j = i + 1; j < allRooms.length; j += 1) {
      if (used.has(j)) continue;
      if (ringsEqual(allRooms[i].canonRing, allRooms[j].canonRing)) { group.push(allRooms[j]); used.add(j); }
    }
    if (group.length > 1) { groups.push(group); used.add(i); }
  }
  if (groups.length === 0) {
    console.log("  No exact duplicate groups found across any evaluated floor.");
  } else {
    for (const group of groups) {
      console.log(`  DUPLICATE GROUP (n=${group.length}): ${group.map((r) => `${r.floor}/${r.id}`).join(", ")} -- area=${group[0].area}, vertices=${group[0].vertices}`);
    }
  }
  console.log("");

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
