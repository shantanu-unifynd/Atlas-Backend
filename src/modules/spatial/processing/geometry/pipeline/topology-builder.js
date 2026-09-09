// Stage 3 — Topology Construction.
// Builds a topology GRAPH from cleaned, segment-decomposed geometry: nodes
// at shared endpoints, edges between them, primitive-to-primitive touching
// (beyond exact shared endpoints), connected components across primitives,
// and closed-boundary detection. This is purely structural — it says
// nothing about walls, rooms or openings (that is a later phase's job).

const TOUCH_EPSILON = 0.5; // SVG user units

// snapTolerance = 0 means exact-coordinate matching (the original behaviour,
// which the SVG path relies on). A positive tolerance quantizes each endpoint
// onto a grid of that cell size before keying, so near-miss corners that a CAD
// tool left a fraction of a unit apart collapse onto one shared node instead of
// fragmenting the wall graph. The stored node keeps its first-seen real
// coordinate; only the bucket used for matching is snapped.
function pointKey(x, y, snapTolerance = 0) {
  if (snapTolerance > 0) {
    const qx = Math.round(x / snapTolerance) * snapTolerance;
    const qy = Math.round(y / snapTolerance) * snapTolerance;
    return `${qx},${qy}`;
  }
  return `${x},${y}`;
}

function buildNodesAndEdges(cleanedGeometry, snapTolerance = 0) {
  const nodeMap = new Map();
  const edges = [];

  function getOrCreateNode(x, y) {
    const key = pointKey(x, y, snapTolerance);

    if (!nodeMap.has(key)) {
      nodeMap.set(key, { id: `node-${nodeMap.size}`, x, y, sharedBy: [] });
    }

    return nodeMap.get(key);
  }

  for (const primitive of cleanedGeometry) {
    for (const segment of primitive.segments) {
      const fromNode = getOrCreateNode(segment.x1, segment.y1);
      const toNode = getOrCreateNode(segment.x2, segment.y2);

      if (!fromNode.sharedBy.includes(primitive.id)) fromNode.sharedBy.push(primitive.id);
      if (!toNode.sharedBy.includes(primitive.id)) toNode.sharedBy.push(primitive.id);

      edges.push({
        id: `edge-${edges.length}`,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        primitiveId: primitive.id,
        primitiveType: primitive.type,
      });
    }
  }

  const degreeByNodeId = new Map();

  for (const edge of edges) {
    degreeByNodeId.set(edge.fromNodeId, (degreeByNodeId.get(edge.fromNodeId) || 0) + 1);
    degreeByNodeId.set(edge.toNodeId, (degreeByNodeId.get(edge.toNodeId) || 0) + 1);
  }

  const nodes = [...nodeMap.values()].map((node) => ({
    ...node,
    degree: degreeByNodeId.get(node.id) || 0,
  }));

  return { nodes, edges };
}

// Distance from point p to segment [a,b]; used to detect a primitive's
// endpoint touching another primitive's segment interior (a T-junction),
// which a shared-endpoint check alone would miss.
function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.hypot(p.x - projX, p.y - projY);
}

// Segment-segment touching: exact shared endpoints are already captured as
// topology nodes; this additionally catches endpoint-on-interior touches
// and mid-segment crossings, only for primitives that decompose into
// segments (circle/ellipse/text are out of scope for touching in this phase).
function segmentsTouch(segA, segB) {
  const points = [
    { p: { x: segA.x1, y: segA.y1 }, seg: segB },
    { p: { x: segA.x2, y: segA.y2 }, seg: segB },
    { p: { x: segB.x1, y: segB.y1 }, seg: segA },
    { p: { x: segB.x2, y: segB.y2 }, seg: segA },
  ];

  return points.some(
    ({ p, seg }) => distanceToSegment(p, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }) <= TOUCH_EPSILON
  );
}

function computeTouchingPairs(cleanedGeometry) {
  const segmentPrimitives = cleanedGeometry.filter((p) => p.segments.length > 0);
  const touchingPairs = [];

  for (let i = 0; i < segmentPrimitives.length; i += 1) {
    for (let j = i + 1; j < segmentPrimitives.length; j += 1) {
      const a = segmentPrimitives[i];
      const b = segmentPrimitives[j];

      if (a.id === b.id) continue;

      const touches = a.segments.some((segA) => b.segments.some((segB) => segmentsTouch(segA, segB)));

      if (touches) {
        touchingPairs.push({ primitiveIdA: a.id, primitiveIdB: b.id });
      }
    }
  }

  return touchingPairs;
}

// Union-Find over primitive ids: two primitives are connected if they share
// a topology node (an edge endpoint) or are in a touching pair.
function computeConnectedComponents(cleanedGeometry, nodes, touchingPairs) {
  const parent = new Map(cleanedGeometry.map((p) => [p.id, p.id]));

  function find(id) {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)));
    }
    return parent.get(id);
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  for (const node of nodes) {
    for (let i = 1; i < node.sharedBy.length; i += 1) {
      union(node.sharedBy[0], node.sharedBy[i]);
    }
  }

  for (const pair of touchingPairs) {
    union(pair.primitiveIdA, pair.primitiveIdB);
  }

  const groups = new Map();

  for (const primitive of cleanedGeometry) {
    const root = find(primitive.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(primitive.id);
  }

  return [...groups.values()].map((primitiveIds, index) => ({
    id: `component-${index}`,
    primitiveIds,
  }));
}

// BXP-01 — planar face extraction, replacing the old whole-component cycle
// check. The old computeNodeGraphCycles() treated an ENTIRE connected wall
// mesh as one single boundary candidate the moment it contained a cycle
// anywhere, then handed it to a ring-tracer that gave up completely the
// instant any node had degree != 2 — which is every T-junction and every
// wall shared between two rooms. A real building's walls are one big
// connected mesh full of exactly that, so the whole mesh produced zero
// rooms. This is a classical planar-graph face-walk instead: build directed
// half-edges, and at each vertex always take the next edge in a fixed
// angular rotation order relative to the one just arrived on. Every
// directed half-edge belongs to exactly one face this way, so it correctly
// decomposes a connected mesh into one bounded face per enclosed room —
// including at T-junctions and higher-degree junctions — instead of
// bailing on them.
function angleBetween(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// For every node, its neighbors sorted by angle (ascending). Kept per-edge
// (not per-neighbor-id) so two parallel edges between the same pair of
// nodes — e.g. two overlapping wall primitives — are each their own
// half-edge rather than being collapsed into one.
function buildSortedAdjacency(nodes, edges) {
  const adjacency = new Map(nodes.map((n) => [n.id, []]));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    const from = nodesById.get(edge.fromNodeId);
    const to = nodesById.get(edge.toNodeId);

    if (!from || !to || from.id === to.id) continue;

    adjacency.get(from.id).push({ neighborId: to.id, edgeId: edge.id, angle: angleBetween(from, to) });
    adjacency.get(to.id).push({ neighborId: from.id, edgeId: edge.id, angle: angleBetween(to, from) });
  }

  for (const list of adjacency.values()) {
    list.sort((a, b) => a.angle - b.angle);
  }

  return adjacency;
}

function signedShoelaceArea(points) {
  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }

  return sum / 2;
}

// Walks every directed half-edge exactly once, grouping them into closed
// face cycles. A vertex with only one neighbor (a dangling wall stub, or an
// unpaired doorway-gap end) simply reflects the walk straight back the way
// it came, rather than blocking it — that naturally produces a degenerate
// zero-area "face" for the stub instead of a crash or a stuck trace, and
// traceInteriorFaces() below filters those out by area, not by special-
// casing dead ends here.
function traceAllFaces(nodes, edges) {
  const adjacency = buildSortedAdjacency(nodes, edges);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set();
  const halfEdgeKey = (fromId, toId, edgeId) => `${fromId}=>${toId}#${edgeId}`;
  const maxSteps = edges.length * 2 + 4;

  const faces = [];

  for (const startEdge of edges) {
    for (const [startFrom, startTo] of [
      [startEdge.fromNodeId, startEdge.toNodeId],
      [startEdge.toNodeId, startEdge.fromNodeId],
    ]) {
      if (startFrom === startTo || visited.has(halfEdgeKey(startFrom, startTo, startEdge.id))) continue;

      const nodeIds = [];
      const edgeIds = [];
      let fromId = startFrom;
      let toId = startTo;
      let edgeId = startEdge.id;
      let steps = 0;
      let closedProperly = false;

      while (steps < maxSteps) {
        visited.add(halfEdgeKey(fromId, toId, edgeId));
        nodeIds.push(fromId);
        edgeIds.push(edgeId);
        steps += 1;

        const neighborsAtTo = adjacency.get(toId) || [];
        const reverseIndex = neighborsAtTo.findIndex((n) => n.neighborId === fromId && n.edgeId === edgeId);

        if (reverseIndex === -1 || neighborsAtTo.length === 0) break;

        const next = neighborsAtTo[(reverseIndex + 1) % neighborsAtTo.length];
        const nextFrom = toId;
        const nextTo = next.neighborId;
        const nextEdgeId = next.edgeId;

        if (nextFrom === startFrom && nextTo === startTo && nextEdgeId === startEdge.id) {
          closedProperly = true;
          break;
        }

        fromId = nextFrom;
        toId = nextTo;
        edgeId = nextEdgeId;
      }

      if (!closedProperly || nodeIds.length < 3) continue;

      const points = nodeIds.map((id) => nodesById.get(id));

      faces.push({ nodeIds, edgeIds, points, signedArea: signedShoelaceArea(points) });
    }
  }

  return faces;
}

// The traversal rule above assigns a consistent winding to every face in
// the whole graph: empirically confirmed (bxp01-validation/validate-bxp01.js,
// run against a fixture with a known 4-room ground truth) every bounded
// (interior/room) face comes out with a NEGATIVE signed area under "always
// take the next neighbor in ascending-angle order" combined with SVG's
// y-down coordinate system, while the unbounded exterior face comes out
// positive — e.g. for a simple isolated square this rule traces the room
// itself as -10000 and the exterior as +10000. Degenerate dangling-stub
// walks land at (near) zero either way. Filtering on sign, rather than
// "largest area per component," needs no connected-component bookkeeping
// at all and still correctly handles multiple disconnected wall clusters
// on the same floor.
const MIN_INTERIOR_FACE_AREA = 1e-6;

function traceInteriorFaces(nodes, edges) {
  return traceAllFaces(nodes, edges).filter((face) => face.signedArea < -MIN_INTERIOR_FACE_AREA);
}

// Closed boundaries come from two sources: any primitive the author drew as
// its OWN closed shape (rect, polygon, circle, ellipse, or a path ending in
// Z) is trusted as its own room boundary unconditionally, regardless of
// what it touches — exactly as before BXP-01. Real floor plans are commonly
// authored this way: each room is its own independently-closed path, and
// adjacent rooms' paths often coincide exactly at shared walls, which used
// to make the whole floor one connected component. Face-tracing every
// closed primitive unconditionally (BXP-01's first cut) decomposed that
// merged mesh into a handful of wrong, oversized regions instead of the
// individually-authored rooms — a regression found validating against a
// real building (57 independently-closed rooms collapsed to 13 wrong
// faces). Face extraction is scoped to only the OPEN (non-self-closed)
// primitives' segments instead — the actual shared-wall-network case it was
// built to fix (T-junctions and multi-way junctions among walls that were
// never closed shapes to begin with) — leaving every independently-closed
// room exactly as authored, matching the old behavior for them.
function computeClosedBoundaries(cleanedGeometry, nodes, edges) {
  const closedBoundaries = [];

  for (const primitive of cleanedGeometry) {
    if (primitive.closed) {
      closedBoundaries.push({ type: "primitive", primitiveId: primitive.id, primitiveType: primitive.type });
    }
  }

  const primitiveById = new Map(cleanedGeometry.map((p) => [p.id, p]));
  const openEdges = edges.filter((edge) => {
    const primitive = primitiveById.get(edge.primitiveId);
    return primitive && !primitive.closed;
  });

  const edgeById = new Map(openEdges.map((e) => [e.id, e]));
  const faces = traceInteriorFaces(nodes, openEdges);

  faces.forEach((face, index) => {
    const primitiveIds = [...new Set(face.edgeIds.map((edgeId) => edgeById.get(edgeId).primitiveId))];

    closedBoundaries.push({
      type: "component-cycle",
      componentId: `face-${index}`,
      primitiveIds,
      nodeIds: face.nodeIds,
    });
  });

  return closedBoundaries;
}

function buildTopology(cleanedGeometry, snapTolerance = 0) {
  const { nodes, edges } = buildNodesAndEdges(cleanedGeometry, snapTolerance);
  const touchingPairs = computeTouchingPairs(cleanedGeometry);
  const connectedComponents = computeConnectedComponents(cleanedGeometry, nodes, touchingPairs);
  const closedBoundaries = computeClosedBoundaries(cleanedGeometry, nodes, edges);

  return {
    nodes,
    edges,
    touchingPairs,
    connectedComponents,
    closedBoundaries,
  };
}

module.exports = {
  buildTopology,
};
