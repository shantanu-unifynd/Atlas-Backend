// Stage 3 — Topology Construction.
// Builds a topology GRAPH from cleaned, segment-decomposed geometry: nodes
// at shared endpoints, edges between them, primitive-to-primitive touching
// (beyond exact shared endpoints), connected components across primitives,
// and closed-boundary detection. This is purely structural — it says
// nothing about walls, rooms or openings (that is a later phase's job).

const TOUCH_EPSILON = 0.5; // SVG user units

function pointKey(x, y) {
  return `${x},${y}`;
}

function buildNodesAndEdges(cleanedGeometry) {
  const nodeMap = new Map();
  const edges = [];

  function getOrCreateNode(x, y) {
    const key = pointKey(x, y);

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

// Cycle detection via the node-edge graph ALONE (never via touching pairs):
// touching connects two primitives spatially without necessarily sharing a
// graph node, so mixing it into the edges-vs-nodes cycle test would produce
// false negatives (a real cycle diluted by an unrelated dangling touch).
// For a connected graph, edges >= nodes is a standard sufficient condition
// for a cycle to exist (a spanning tree has exactly nodes - 1 edges).
function computeNodeGraphCycles(nodes, edges) {
  const parent = new Map(nodes.map((n) => [n.id, n.id]));

  function find(id) {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)));
    return parent.get(id);
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  for (const edge of edges) {
    union(edge.fromNodeId, edge.toNodeId);
  }

  const groups = new Map();

  for (const node of nodes) {
    const root = find(node.id);
    if (!groups.has(root)) groups.set(root, { nodeIds: new Set(), edgeCount: 0, primitiveIds: new Set() });
    groups.get(root).nodeIds.add(node.id);
  }

  for (const edge of edges) {
    const group = groups.get(find(edge.fromNodeId));
    group.edgeCount += 1;
    group.primitiveIds.add(edge.primitiveId);
  }

  const cycles = [];
  let index = 0;

  for (const group of groups.values()) {
    // primitiveIds.size > 1 excludes a single closed primitive (rect,
    // polygon, ...) re-reporting itself — that's already captured below as
    // a "primitive" boundary. This branch is specifically for a cycle
    // formed by several distinct open primitives sharing endpoints.
    if (group.primitiveIds.size > 1 && group.edgeCount >= group.nodeIds.size) {
      cycles.push({
        type: "component-cycle",
        componentId: `node-component-${index}`,
        primitiveIds: [...group.primitiveIds],
        nodeIds: [...group.nodeIds],
      });
    }

    index += 1;
  }

  return cycles;
}

// Closed boundaries come from two sources: primitives that are inherently
// closed (rect, polygon, circle, ellipse, a path ending in Z), and cycles
// found in the node-edge graph, i.e. several separate open primitives
// (e.g. 4 lines) forming a closed loop by sharing endpoints.
function computeClosedBoundaries(cleanedGeometry, nodes, edges) {
  const closedBoundaries = [];

  for (const primitive of cleanedGeometry) {
    if (primitive.closed) {
      closedBoundaries.push({ type: "primitive", primitiveId: primitive.id, primitiveType: primitive.type });
    }
  }

  closedBoundaries.push(...computeNodeGraphCycles(nodes, edges));

  return closedBoundaries;
}

function buildTopology(cleanedGeometry) {
  const { nodes, edges } = buildNodesAndEdges(cleanedGeometry);
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
