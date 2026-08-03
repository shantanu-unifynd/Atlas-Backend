const DEFAULT_TRAVERSAL_COST = 1.0;
const EDGE_TYPE = "CONNECTS";

function canonicalPairKey(nodeIdA, nodeIdB) {
  return [nodeIdA, nodeIdB].sort().join(":");
}

// Stage 2 — Edge Generation. Deterministic: connectivity is derived only
// from existing Semantic-layer CONNECTS relationships — never invented,
// never computed from Geometry. Two sources of connectivity, both bidirectional
// (each becomes two directed edges A->B and B->A):
//   1. DIRECT     — a CONNECTS whose two ends both back NavigationNodes.
//   2. VIA_ROOM   — two NavigationNodes that each CONNECTS the same
//                   non-node object (a room). Nav nodes are doorways, which
//                   don't touch each other, so without this two doorways
//                   into one room would never connect. (edge Change 2)
// No distance, no travel time, no Geometry-derived weight.
function generateEdges(graphId, connections, usoIdToNode) {
  const edges = [];
  const seenPairs = new Set();

  function addEdges(sourceNode, targetNode, metadata) {
    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) return;

    const pairKey = canonicalPairKey(sourceNode.id, targetNode.id);
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    edges.push({
      graphId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      edgeType: EDGE_TYPE,
      traversalCost: DEFAULT_TRAVERSAL_COST,
      accessibility: {},
      metadata,
    });
    edges.push({
      graphId,
      sourceNodeId: targetNode.id,
      targetNodeId: sourceNode.id,
      edgeType: EDGE_TYPE,
      traversalCost: DEFAULT_TRAVERSAL_COST,
      accessibility: {},
      metadata,
    });
  }

  // Group the nodes that each non-node object (room) connects to, while
  // handling direct node-to-node connections inline.
  const nodesByIntermediaryUsoId = new Map();

  for (const connection of connections) {
    const sourceNode = usoIdToNode.get(connection.sourceUsoId);
    const targetNode = usoIdToNode.get(connection.targetUsoId);

    if (sourceNode && targetNode) {
      addEdges(sourceNode, targetNode, {
        connectivity: "DIRECT",
        relationshipId: connection.id,
        sourceNodeType: sourceNode.nodeType,
        targetNodeType: targetNode.nodeType,
      });
      continue;
    }

    // Exactly one side backs a node — the other side is the shared
    // intermediary (room). Record the node under that intermediary.
    const node = sourceNode || targetNode;
    const intermediaryUsoId = sourceNode ? connection.targetUsoId : connection.sourceUsoId;

    if (!nodesByIntermediaryUsoId.has(intermediaryUsoId)) {
      nodesByIntermediaryUsoId.set(intermediaryUsoId, []);
    }
    nodesByIntermediaryUsoId.get(intermediaryUsoId).push(node);
  }

  for (const [intermediaryUsoId, sharedNodes] of nodesByIntermediaryUsoId) {
    for (let i = 0; i < sharedNodes.length; i += 1) {
      for (let j = i + 1; j < sharedNodes.length; j += 1) {
        addEdges(sharedNodes[i], sharedNodes[j], {
          connectivity: "VIA_ROOM",
          viaUsoId: intermediaryUsoId,
          sourceNodeType: sharedNodes[i].nodeType,
          targetNodeType: sharedNodes[j].nodeType,
        });
      }
    }
  }

  return edges;
}

module.exports = { generateEdges };
