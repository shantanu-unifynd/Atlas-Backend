// BXP-09 (Phase B) support script -- READ-ONLY. Reproduces exactly what the
// real generate() call did for Phoenix Palassio / Ground Floor (same
// persisted, stale candidateObjects.candidateBoundaries -- NOT recomputed),
// but with per-boundary instrumentation reporting *why* each rejected
// boundary was rejected. Zero writes; calls only the real, unmodified
// room-assembler functions plus read-only Prisma finds. Adapted from the
// BXP-07 rejection-breakdown script for this floor's much larger, messier
// real CAD data (196 persisted boundaries, 72024 primitives).
const { prisma } = require("../../../config/database");
const { normalizeGeometry } = require("../mapModel/pipeline/coordinate-normalizer");
const { regularizeRing } = require("../mapModel/pipeline/polygon-regularizer");
const roomAssembler = require("../mapModel/pipeline/room-assembler");
const { hasSelfIntersection } = roomAssembler;

const MIN_AREA = 25;
const EPS = 0.05;
const ENVELOPE_POLY_AREA_PERCENT = 50;

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}
function shoelaceArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}
function overallGeometryBbox(primitives) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const primitive of primitives) {
    for (const s of primitive.segments || []) {
      minX = Math.min(minX, s.x1, s.x2);
      maxX = Math.max(maxX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2);
      maxY = Math.max(maxY, s.y1, s.y2);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return 0;
  return (maxX - minX) * (maxY - minY);
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
function ringFromBoundary(boundary, primitivesById) {
  const ids = Array.isArray(boundary.primitiveIds) ? boundary.primitiveIds : [];
  const ring = [];
  const append = (piece) => {
    for (const p of piece) {
      const last = ring[ring.length - 1];
      if (!last || !samePoint(last, p)) ring.push(p);
    }
  };
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
      if (!endsAtNext && startsAtNext) append([...piece].reverse());
      else append(piece);
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
  console.log(`Floor bbox area: ${floorBboxArea.toFixed(1)}`);
  console.log(`candidatesGeneratedAt: ${geometryModel.diagnostics && geometryModel.diagnostics.candidatesGeneratedAt}`);
  console.log("");

  let accepted = 0, tooFewPoints = 0, selfIntersecting = 0, tooSmall = 0, envelopeExcluded = 0;
  const acceptedRooms = [];
  const rejectedSamples = { tooFewPoints: [], selfIntersecting: [], tooSmall: [], envelopeExcluded: [] };

  for (const boundary of boundaries) {
    const rawRing = ringFromBoundary(boundary, primitivesById);
    const ring = regularizeRing(rawRing);

    let reason = null;
    let area = null;
    if (ring.length < 3) {
      reason = "too-few-points";
      tooFewPoints += 1;
      if (rejectedSamples.tooFewPoints.length < 5) rejectedSamples.tooFewPoints.push({ id: boundary.id, source: boundary.source, primCount: boundary.primitiveIds.length, rawRingPts: rawRing.length });
    } else if (hasSelfIntersection(ring)) {
      reason = "self-intersecting";
      selfIntersecting += 1;
      area = shoelaceArea(ring);
      if (rejectedSamples.selfIntersecting.length < 5) rejectedSamples.selfIntersecting.push({ id: boundary.id, source: boundary.source, vertices: ring.length, area: area.toFixed(1) });
    } else {
      area = shoelaceArea(ring);
      if (area < MIN_AREA) {
        reason = "too-small";
        tooSmall += 1;
        if (rejectedSamples.tooSmall.length < 5) rejectedSamples.tooSmall.push({ id: boundary.id, area: area.toFixed(2) });
      } else if (boundary.source === "primitive" && floorBboxArea > 0 && (area / floorBboxArea) * 100 > ENVELOPE_POLY_AREA_PERCENT) {
        reason = "envelope";
        envelopeExcluded += 1;
        rejectedSamples.envelopeExcluded.push({ id: boundary.id, area: area.toFixed(1), pct: ((area / floorBboxArea) * 100).toFixed(1) });
      } else {
        reason = "ACCEPTED";
        accepted += 1;
        acceptedRooms.push({ id: boundary.id, source: boundary.source, area: area.toFixed(2), vertices: ring.length, primCount: boundary.primitiveIds.length });
      }
    }
  }

  console.log(`Accepted: ${accepted}`);
  console.log(`Rejected - too few points (<3): ${tooFewPoints}`);
  console.log(`Rejected - self-intersecting: ${selfIntersecting}`);
  console.log(`Rejected - too small (<${MIN_AREA}): ${tooSmall}`);
  console.log(`Rejected - envelope (>${ENVELOPE_POLY_AREA_PERCENT}%): ${envelopeExcluded}`);
  console.log("");
  console.log("Accepted rooms (all):");
  for (const r of acceptedRooms) console.log(`  ${r.id} | source=${r.source} | area=${r.area} | vertices=${r.vertices} | primCount=${r.primCount}`);
  console.log("");
  console.log("Sample rejections (up to 5 each):");
  console.log("  too-few-points:", JSON.stringify(rejectedSamples.tooFewPoints));
  console.log("  self-intersecting:", JSON.stringify(rejectedSamples.selfIntersecting));
  console.log("  too-small:", JSON.stringify(rejectedSamples.tooSmall));
  console.log("  envelope:", JSON.stringify(rejectedSamples.envelopeExcluded));

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
