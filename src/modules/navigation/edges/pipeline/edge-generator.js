const DEFAULT_TRAVERSAL_COST = 1.0;
const EDGE_TYPE = "CONNECTS";

function canonicalPairKey(nodeIdA, nodeIdB) {
  return [nodeIdA, nodeIdB].sort().join(":");
}

// Stage 2 — Edge Generation. Deterministic: connectivity is derived only
// from existing Semantic-layer CONNECTS relationships between the objects
// backing two NavigationNodes in this graph — never invented, never
// computed from Geometry. Every CONNECTS relationship becomes exactly two
// directed edges (A->B and B->A), representing explicit bidirectional
// traversal. No distance, no travel time, no Geometry-derived weight.
function generateEdges(graphId, connections, usoIdToNode) {
  const edges = [];
  const seenPairs = new Set();

  for (const connection of connections) {
    const sourceNode = usoIdToNode.get(connection.sourceUsoId);
    const targetNode = usoIdToNode.get(connection.targetUsoId);

    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
      continue;
    }

    const pairKey = canonicalPairKey(sourceNode.id, targetNode.id);

    if (seenPairs.has(pairKey)) {
      continue;
    }

    seenPairs.add(pairKey);

    const metadata = {
      relationshipId: connection.id,
      sourceNodeType: sourceNode.nodeType,
      targetNodeType: targetNode.nodeType,
    };

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

  return edges;
}

module.exports = { generateEdges };
