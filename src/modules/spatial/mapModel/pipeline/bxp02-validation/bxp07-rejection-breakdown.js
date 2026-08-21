// BXP-07 support script — READ-ONLY. Reproduces exactly what the real
// generate() call did for Unifynd tech / Ground Floor (same persisted,
// stale candidateObjects.candidateBoundaries — NOT recomputed), but with
// per-boundary instrumentation to report *why* each rejected boundary was
// rejected. Zero writes; calls only the real, unmodified room-assembler
// functions plus read-only Prisma finds.
const { prisma } = require("../../../../../config/database");
const { normalizeGeometry } = require("../coordinate-normalizer");
const { regularizeRing } = require("../polygon-regularizer");
const roomAssembler = require("../room-assembler");
const { hasSelfIntersection } = roomAssembler;

// Re-implement the same private helpers via a fresh require of internals is
// not possible (not exported), so we re-derive ring + area using the same
// exported building blocks plus local copies of the tiny pure functions
// that are not exported, kept IDENTICAL to room-assembler.js.
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
  const building = await prisma.building.findFirst({ where: { name: "Unifynd tech" } });
  const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
  const floor = floors.find((f) => f.name === "Ground Floor");
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
  const idempotenceMismatches = [];

  for (const boundary of boundaries) {
    const rawRing = ringFromBoundary(boundary, primitivesById);
    const ring = regularizeRing(rawRing);
    const ring2 = regularizeRing(ring); // idempotence check

    const idemMismatch = JSON.stringify(ring) !== JSON.stringify(ring2);
    if (idemMismatch) idempotenceMismatches.push(boundary.id);

    let reason = null;
    if (ring.length < 3) {
      reason = "too-few-points";
      tooFewPoints += 1;
    } else if (hasSelfIntersection(ring)) {
      reason = "self-intersecting";
      selfIntersecting += 1;
    } else {
      const area = shoelaceArea(ring);
      if (area < MIN_AREA) {
        reason = "too-small";
        tooSmall += 1;
      } else if (boundary.source === "primitive" && floorBboxArea > 0 && (area / floorBboxArea) * 100 > ENVELOPE_POLY_AREA_PERCENT) {
        reason = `envelope (${((area / floorBboxArea) * 100).toFixed(1)}% of floor)`;
        envelopeExcluded += 1;
      } else {
        reason = "ACCEPTED";
        accepted += 1;
      }
    }
    console.log(`  ${boundary.id} | source=${boundary.source} | primitiveIds=${boundary.primitiveIds.length} | rawRingPts=${rawRing.length} | area=${ring.length >= 3 ? shoelaceArea(ring).toFixed(1) : "n/a"} | ${reason}`);
  }

  console.log("");
  console.log(`Accepted: ${accepted}`);
  console.log(`Rejected - too few points (<3): ${tooFewPoints}`);
  console.log(`Rejected - self-intersecting: ${selfIntersecting}`);
  console.log(`Rejected - too small (<${MIN_AREA}): ${tooSmall}`);
  console.log(`Rejected - envelope (>${ENVELOPE_POLY_AREA_PERCENT}%): ${envelopeExcluded}`);
  console.log(`Regularization idempotence mismatches: ${idempotenceMismatches.length} ${idempotenceMismatches.join(",")}`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
