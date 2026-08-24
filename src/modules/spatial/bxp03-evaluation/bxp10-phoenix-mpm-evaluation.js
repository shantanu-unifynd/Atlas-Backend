// BXP-10 -- READ-ONLY evaluation of the real MPM v13 generated from BXP-09's
// fresh Phoenix candidates. Reproduces exactly what assembleRooms() did
// (same production functions, same persisted candidateObjects) but with
// per-boundary instrumentation: rejection reason, accepted-by-source
// breakdown, and full accepted-room diagnostics for suspicious-geometry
// review. Zero writes; calls only real, unmodified production functions.
const { prisma } = require("../../../config/database");
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

async function main() {
  const building = await prisma.building.findFirst({ where: { name: "Phoenix Palassio" } });
  const floor = await prisma.floor.findFirst({ where: { buildingId: building.id, name: "Ground Floor" } });
  const imports = await prisma.blueprintImport.findMany({ where: { buildingId: building.id, floorId: floor.id }, orderBy: { version: "desc" } });
  let normalizedBlueprint = null, geometryModel = null;
  for (const imp of imports) {
    const n = await prisma.normalizedBlueprint.findUnique({ where: { blueprintImportId: imp.id } });
    if (!n) continue;
    const g = await prisma.geometryModel.findUnique({ where: { normalizedBlueprintId: n.id } });
    if (g) { normalizedBlueprint = n; geometryModel = g; break; }
  }

  const boundaries = geometryModel.candidateObjects.candidateBoundaries;
  const normalized = normalizeGeometry(geometryModel, normalizedBlueprint);
  const primitivesById = new Map(normalized.primitives.map((p) => [p.id, p]));
  const floorBboxArea = overallGeometryBbox(normalized.primitives);

  console.log(`Total persisted boundaries: ${boundaries.length}`);
  const bySourceTotal = {};
  for (const b of boundaries) bySourceTotal[b.source] = (bySourceTotal[b.source] || 0) + 1;
  console.log(`By source (all candidates): ${JSON.stringify(bySourceTotal)}`);
  console.log("");

  let tooFewPoints = 0, selfIntersecting = 0, tooSmall = 0, envelopeExcluded = 0;
  const acceptedBySource = {};
  const acceptedRooms = [];
  let idempotenceMismatches = 0;

  for (const boundary of boundaries) {
    const rawRing = ringFromBoundary(boundary, primitivesById);
    const ring = regularizeRing(rawRing);
    const ring2 = regularizeRing(ring);
    if (JSON.stringify(ring) !== JSON.stringify(ring2)) idempotenceMismatches += 1;

    if (ring.length < 3) { tooFewPoints += 1; continue; }
    if (hasSelfIntersection(ring)) { selfIntersecting += 1; continue; }
    const area = shoelaceArea(ring);
    if (area < MIN_AREA) { tooSmall += 1; continue; }
    if (boundary.source === "primitive" && floorBboxArea > 0 && (area / floorBboxArea) * 100 > ENVELOPE_POLY_AREA_PERCENT) {
      envelopeExcluded += 1; continue;
    }

    acceptedBySource[boundary.source] = (acceptedBySource[boundary.source] || 0) + 1;
    const bb = bboxOf(ring);
    const width = bb.maxX - bb.minX, height = bb.maxY - bb.minY;
    const aspect = Math.max(width, height) / Math.max(Math.min(width, height), 0.001);
    acceptedRooms.push({
      id: boundary.id, source: boundary.source, area: Math.round(area * 100) / 100,
      vertices: ring.length, width: Math.round(width * 10) / 10, height: Math.round(height * 10) / 10,
      aspectRatio: Math.round(aspect * 10) / 10, primCount: boundary.primitiveIds.length,
    });
  }

  console.log(`Rejected - too few points: ${tooFewPoints}`);
  console.log(`Rejected - self-intersecting: ${selfIntersecting}`);
  console.log(`Rejected - too small (<${MIN_AREA}): ${tooSmall}`);
  console.log(`Rejected - envelope: ${envelopeExcluded}`);
  console.log(`Accepted total: ${acceptedRooms.length}`);
  console.log(`Accepted by source: ${JSON.stringify(acceptedBySource)}`);
  console.log(`Component-cycle candidates total: ${bySourceTotal["component-cycle"] || 0}, survived to accepted: ${acceptedBySource["component-cycle"] || 0}`);
  console.log(`Regularization idempotence mismatches: ${idempotenceMismatches}`);
  console.log("");
  console.log("=== ALL ACCEPTED ROOMS (sorted by area desc) ===");
  acceptedRooms.sort((a, b) => b.area - a.area);
  for (const r of acceptedRooms) {
    console.log(`  ${r.id} | source=${r.source} | area=${r.area} | vertices=${r.vertices} | ${r.width}x${r.height} | aspect=${r.aspectRatio} | primCount=${r.primCount}`);
  }

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
