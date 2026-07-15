// Stage 5 — Geometry Relationships.
// Phase C: builds relationships between classified candidates using only
// geometry already computed — topology's touching pairs (for TOUCHES) and
// bounding-box comparison (for CONTAINS/INTERSECTS/ADJACENT). No semantic
// reasoning; every relationship is directly derivable from geometry alone.
//
// Invoked only by the candidate-generation enrichment step, mirroring
// geometry-classifier.js's split from the unchanged extraction pipeline.

const {
  boundingBoxOfPrimitive,
  unionBoundingBox,
  bboxOverlap,
  bboxContains,
  bboxGap,
} = require("./candidate-geometry.util");

const ADJACENCY_EPSILON = 5;

// Explicit lookup, not regex-based singularization — "candidateBoundaries"
// does not naively singularize to "Boundary" by stripping a trailing "s".
const CANDIDATE_TYPE_LABELS = {
  candidateBoundaries: "BOUNDARY",
  candidateEnclosures: "ENCLOSURE",
  candidateOpenings: "OPENING",
  candidateWalls: "WALL",
  candidatePassages: "PASSAGE",
  candidateVerticalConnections: "VERTICAL_CONNECTION",
};

function candidateTypeFor(collectionKey) {
  return CANDIDATE_TYPE_LABELS[collectionKey] || collectionKey.toUpperCase();
}

function flattenCandidates(candidateObjects, primitivesById) {
  const flattened = [];

  for (const [collectionKey, candidates] of Object.entries(candidateObjects)) {
    for (const candidate of candidates) {
      const primitiveIds = candidate.primitiveIds || (candidate.primitiveId ? [candidate.primitiveId] : []);
      const bbox = unionBoundingBox(
        primitiveIds.map((id) => (primitivesById.has(id) ? boundingBoxOfPrimitive(primitivesById.get(id)) : null))
      );

      flattened.push({
        id: candidate.id,
        candidateType: candidateTypeFor(collectionKey),
        primitiveIds,
        bbox,
      });
    }
  }

  return flattened;
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join("|");
}

function buildTouchesRelationships(candidates, touchingPairs) {
  const candidatesByPrimitiveId = new Map();

  for (const candidate of candidates) {
    for (const primitiveId of candidate.primitiveIds) {
      if (!candidatesByPrimitiveId.has(primitiveId)) candidatesByPrimitiveId.set(primitiveId, []);
      candidatesByPrimitiveId.get(primitiveId).push(candidate);
    }
  }

  const relationships = [];
  const touchingCandidatePairs = new Set();

  for (const pair of touchingPairs) {
    const fromCandidates = candidatesByPrimitiveId.get(pair.primitiveIdA) || [];
    const toCandidates = candidatesByPrimitiveId.get(pair.primitiveIdB) || [];

    for (const from of fromCandidates) {
      for (const to of toCandidates) {
        if (from.id === to.id) continue;

        relationships.push({
          type: "TOUCHES",
          from: from.id,
          to: to.id,
          fromType: from.candidateType,
          toType: to.candidateType,
        });
        touchingCandidatePairs.add(pairKey(from.id, to.id));
      }
    }
  }

  return { relationships, touchingCandidatePairs };
}

function samePrimitiveSet(a, b) {
  if (a.primitiveIds.length !== b.primitiveIds.length) return false;

  const setB = new Set(b.primitiveIds);

  return a.primitiveIds.every((id) => setB.has(id));
}

// CONTAINS/INTERSECTS/ADJACENT are a coarser, bounding-box-based signal than
// TOUCHES (which comes from real segment geometry) — skipping pairs already
// reported as TOUCHES avoids reporting the same relationship twice at
// different fidelities (two segments meeting at a point trivially have
// overlapping bounding boxes at that point). Pairs referencing the exact
// same underlying primitive(s) (e.g. a rect classified as both a boundary
// and an enclosure) are also skipped — "X contains X" under a different
// candidate label isn't a new spatial fact.
function buildBoundingBoxRelationships(candidates, touchingCandidatePairs) {
  const relationships = [];
  const withBbox = candidates.filter((c) => c.bbox);

  for (let i = 0; i < withBbox.length; i += 1) {
    for (let j = i + 1; j < withBbox.length; j += 1) {
      const a = withBbox[i];
      const b = withBbox[j];

      if (touchingCandidatePairs.has(pairKey(a.id, b.id))) continue;
      if (samePrimitiveSet(a, b)) continue;

      if (bboxContains(a.bbox, b.bbox)) {
        relationships.push({ type: "CONTAINS", from: a.id, to: b.id, fromType: a.candidateType, toType: b.candidateType });
      } else if (bboxContains(b.bbox, a.bbox)) {
        relationships.push({ type: "CONTAINS", from: b.id, to: a.id, fromType: b.candidateType, toType: a.candidateType });
      } else if (bboxOverlap(a.bbox, b.bbox)) {
        relationships.push({ type: "INTERSECTS", from: a.id, to: b.id, fromType: a.candidateType, toType: b.candidateType });
      } else if (bboxGap(a.bbox, b.bbox) <= ADJACENCY_EPSILON) {
        relationships.push({ type: "ADJACENT", from: a.id, to: b.id, fromType: a.candidateType, toType: b.candidateType });
      }
    }
  }

  return relationships;
}

function buildRelationships(candidateObjects, cleanedGeometry, topology) {
  const primitivesById = new Map(cleanedGeometry.map((p) => [p.id, p]));
  const candidates = flattenCandidates(candidateObjects, primitivesById);

  const { relationships: touchesRelationships, touchingCandidatePairs } = buildTouchesRelationships(
    candidates,
    topology.touchingPairs
  );

  return [...touchesRelationships, ...buildBoundingBoxRelationships(candidates, touchingCandidatePairs)];
}

module.exports = {
  buildRelationships,
};
