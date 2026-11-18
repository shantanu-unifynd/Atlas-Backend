// M3 Stage — Building Graph Assembler. Pure transformation, no persistence:
// joins every floor's published navigation graph with the building's
// transition-graph connectors into ONE directed weighted graph that the
// existing Dijkstra stages can route over.
//
// Three edge families:
//   1. Floor edges — each floor's walkway edges, used as-is (already stored
//      as directed pairs in source units).
//   2. Access edges — synthesized here, both directions, connector ↔ the
//      NEAREST node of its own floor's graph. Connector positions are
//      text-label anchors (not shaft centres) and are NOT part of the floor
//      walkway network, so without this join a route could never reach a
//      lift. Cost = euclidean distance (same source units as floor edges).
//   3. Vertical edges — the admin-confirmed cross-floor pairs. Cost is a
//      flat per-ride constant (floor plans carry no vertical distance),
//      scaled by the visitor's routing preference.
//
// BASE_VERTICAL_COST is deliberately high relative to typical walkway hops
// so routes never "bounce" through another floor to shortcut — changing
// floors must cost more than any plausible same-floor detour.
const BASE_VERTICAL_COST = 400;
// AVOID_STAIRS: stairs become a last resort but stay routable (a building
// whose only connector is a staircase still gets a route).
const AVOID_STAIRS_MULTIPLIER = 8;
// PREFER_ELEVATORS: anything that is not a lift is penalised.
const PREFER_ELEVATORS_MULTIPLIER = 4;

function verticalCost(baseCost, connectorType, preference) {
  const base = baseCost || BASE_VERTICAL_COST;
  if (preference === "AVOID_STAIRS" && connectorType === "STAIR") {
    return base * AVOID_STAIRS_MULTIPLIER;
  }
  if (preference === "PREFER_ELEVATORS" && connectorType !== "ELEVATOR") {
    return base * PREFER_ELEVATORS_MULTIPLIER;
  }
  return base;
}

function isFinitePosition(position) {
  return (
    position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
  );
}

// floorEntries: [{ floorId, graph: {nodes:[{id,type,position,label}],
//   edges:[{id,source,target,cost}]} | null }]
// connectors:   [{ id, floorId, nodeType, position, label }]  (tombstones
//   already filtered out by the loader)
// transitions:  [{ id, sourceNodeId, targetNodeId, traversalCost }] —
//   directed VERTICAL rows (both directions stored by the pair endpoint).
// Returns { nodes, edges, meta } where nodes/edges feed
// graphPreparation.buildAdjacencyList unchanged and meta maps every node id
// to { floorId, kind: 'floor'|'connector', nodeType, label, position }.
function assembleBuildingGraph({ floorEntries, connectors, transitions, preference }) {
  const nodes = [];
  const edges = [];
  const meta = new Map();
  const floorNodesByFloor = new Map();

  for (const entry of floorEntries) {
    if (!entry.graph) continue;
    const list = [];
    for (const node of entry.graph.nodes || []) {
      nodes.push({ id: node.id });
      meta.set(node.id, {
        floorId: entry.floorId,
        kind: "floor",
        nodeType: node.type || null,
        label: node.label || null,
        position: node.position || null,
      });
      if (isFinitePosition(node.position)) list.push(node);
    }
    floorNodesByFloor.set(entry.floorId, list);
    for (const edge of entry.graph.edges || []) {
      if (!meta.has(edge.source) || !meta.has(edge.target)) continue;
      edges.push({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        traversalCost: edge.cost ?? 1,
      });
    }
  }

  for (const connector of connectors) {
    nodes.push({ id: connector.id });
    meta.set(connector.id, {
      floorId: connector.floorId,
      kind: "connector",
      nodeType: connector.nodeType,
      label: connector.label || null,
      position: connector.position || null,
    });

    // Access join: connector ↔ nearest node of its own floor's graph. A
    // connector on a floor with no published graph stays isolated — a route
    // simply never uses it.
    if (!isFinitePosition(connector.position)) continue;
    const candidates = floorNodesByFloor.get(connector.floorId) || [];
    let nearest = null;
    let nearestDistance = Infinity;
    for (const node of candidates) {
      const d = Math.hypot(
        node.position.x - connector.position.x,
        node.position.y - connector.position.y
      );
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = node;
      }
    }
    if (!nearest) continue;
    const cost = Math.max(1, Math.round(nearestDistance));
    edges.push({
      id: `access:${connector.id}:out`,
      sourceNodeId: connector.id,
      targetNodeId: nearest.id,
      traversalCost: cost,
    });
    edges.push({
      id: `access:${connector.id}:in`,
      sourceNodeId: nearest.id,
      targetNodeId: connector.id,
      traversalCost: cost,
    });
  }

  for (const transition of transitions) {
    const from = meta.get(transition.sourceNodeId);
    if (!from || !meta.has(transition.targetNodeId)) continue;
    edges.push({
      id: transition.id,
      sourceNodeId: transition.sourceNodeId,
      targetNodeId: transition.targetNodeId,
      traversalCost: verticalCost(null, from.nodeType, preference),
    });
  }

  return { nodes, edges, meta };
}

module.exports = {
  assembleBuildingGraph,
  BASE_VERTICAL_COST,
  AVOID_STAIRS_MULTIPLIER,
  PREFER_ELEVATORS_MULTIPLIER,
};
