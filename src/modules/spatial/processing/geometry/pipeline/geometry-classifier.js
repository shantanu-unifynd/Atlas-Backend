// Stage 4 — Geometry Classification.
// Phase C: deterministic, geometry-only classification into the six
// candidate types. No business semantics (no elevators/escalators/stairs,
// no rooms, no stores) — only geometric pattern matching over already-
// cleaned geometry and already-built topology (both Phase B outputs).
//
// This function is invoked ONLY by the separate candidate-generation
// enrichment step (GeometryService.generateCandidates), not by the
// original extraction pipeline — extraction keeps producing the empty
// skeleton (see emptyCandidateSkeleton) so its behavior stays unchanged.

const { boundingBoxOfPrimitive, shoelaceArea, distance, traceRing } = require("./candidate-geometry.util");

const WALL_ASPECT_RATIO_THRESHOLD = 4;
const MIN_DIMENSION = 0.001;

function emptyCandidateSkeleton() {
  return {
    candidateBoundaries: [],
    candidateEnclosures: [],
    candidateOpenings: [],
    candidateWalls: [],
    candidatePassages: [],
    candidateVerticalConnections: [],
  };
}

function primitiveArea(primitive) {
  const g = primitive.geometry;

  if (primitive.type === "rect") return g.width * g.height;
  if (primitive.type === "circle") return Math.PI * g.r * g.r;
  if (primitive.type === "ellipse") return Math.PI * g.rx * g.ry;
  if (primitive.type === "polygon") return shoelaceArea(g.points);

  return null;
}

function classifyBoundariesAndEnclosures(cleanedGeometry, topology, warnings) {
  const byId = new Map(cleanedGeometry.map((p) => [p.id, p]));
  const nodesById = new Map(topology.nodes.map((n) => [n.id, n]));

  const candidateBoundaries = [];
  const candidateEnclosures = [];

  topology.closedBoundaries.forEach((boundary, index) => {
    const primitiveIds = boundary.type === "primitive" ? [boundary.primitiveId] : boundary.primitiveIds;

    candidateBoundaries.push({
      id: `boundary-${index}`,
      source: boundary.type,
      primitiveIds,
      nodeIds: boundary.nodeIds || null,
    });

    if (boundary.type === "primitive") {
      const primitive = byId.get(boundary.primitiveId);
      const area = primitiveArea(primitive);

      if (area !== null) {
        candidateEnclosures.push({
          id: `enclosure-${candidateEnclosures.length}`,
          source: "primitive",
          primitiveIds,
          area,
        });
      }

      return;
    }

    const ring = traceRing(boundary.nodeIds, topology.edges, nodesById);

    if (!ring) {
      warnings.push(
        `Closed boundary '${boundary.componentId}' has branching topology; enclosure area could not be confidently computed`
      );
      return;
    }

    candidateEnclosures.push({
      id: `enclosure-${candidateEnclosures.length}`,
      source: "component-cycle",
      primitiveIds,
      area: shoelaceArea(ring),
    });
  });

  return { candidateBoundaries, candidateEnclosures };
}

function classifyWallsAndPassages(cleanedGeometry, topology) {
  const wallCandidates = [];

  for (const primitive of cleanedGeometry) {
    if (["line", "polyline", "path"].includes(primitive.type)) {
      wallCandidates.push({ primitiveId: primitive.id, primitiveType: primitive.type });
      continue;
    }

    if (primitive.type === "rect") {
      const long = Math.max(primitive.geometry.width, primitive.geometry.height);
      const short = Math.max(Math.min(primitive.geometry.width, primitive.geometry.height), MIN_DIMENSION);
      const aspectRatio = long / short;

      if (aspectRatio >= WALL_ASPECT_RATIO_THRESHOLD) {
        wallCandidates.push({ primitiveId: primitive.id, primitiveType: "rect", aspectRatio });
      }
    }
  }

  // A wall-shaped primitive that touches/shares nothing else (its own
  // singleton connected component) reads as a standalone traversable
  // marking rather than a structural wall — geometry only, no semantics.
  const singletonPrimitiveIds = new Set(
    topology.connectedComponents.filter((c) => c.primitiveIds.length === 1).flatMap((c) => c.primitiveIds)
  );

  const candidateWalls = wallCandidates
    .filter((w) => !singletonPrimitiveIds.has(w.primitiveId))
    .map((w, index) => ({ id: `wall-${index}`, ...w }));

  const candidatePassages = wallCandidates
    .filter((w) => singletonPrimitiveIds.has(w.primitiveId))
    .map((w, index) => ({ id: `passage-${index}`, ...w }));

  return { candidateWalls, candidatePassages };
}

function classifyOpenings(topology, candidateBoundaries) {
  const closedComponentKeys = new Set(
    candidateBoundaries
      .filter((b) => b.source === "component-cycle")
      .map((b) => [...b.primitiveIds].sort().join(","))
  );

  const candidateOpenings = [];

  for (const component of topology.connectedComponents) {
    if (component.primitiveIds.length < 2) continue;
    if (closedComponentKeys.has([...component.primitiveIds].sort().join(","))) continue;

    const componentNodes = topology.nodes.filter((node) =>
      node.sharedBy.some((primitiveId) => component.primitiveIds.includes(primitiveId))
    );
    const dangling = componentNodes.filter((node) => node.degree === 1);

    if (dangling.length === 2) {
      candidateOpenings.push({
        id: `opening-${candidateOpenings.length}`,
        componentId: component.id,
        gapNodeIds: [dangling[0].id, dangling[1].id],
        gapWidth: distance(dangling[0], dangling[1]),
      });
    }
  }

  return candidateOpenings;
}

function classifyGeometry(cleanedGeometry, topology) {
  const warnings = [];

  const { candidateBoundaries, candidateEnclosures } = classifyBoundariesAndEnclosures(
    cleanedGeometry,
    topology,
    warnings
  );
  const { candidateWalls, candidatePassages } = classifyWallsAndPassages(cleanedGeometry, topology);
  const candidateOpenings = classifyOpenings(topology, candidateBoundaries);

  // Elevators/escalators/stairs require semantic inference, out of scope
  // for this phase — the collection exists, deliberately unpopulated.
  warnings.push(
    "CandidateVerticalConnection is a geometric placeholder only; not classified in this phase."
  );

  return {
    candidateObjects: {
      candidateBoundaries,
      candidateEnclosures,
      candidateOpenings,
      candidateWalls,
      candidatePassages,
      candidateVerticalConnections: [],
    },
    warnings,
  };
}

module.exports = {
  classifyGeometry,
  emptyCandidateSkeleton,
  boundingBoxOfPrimitive,
};
