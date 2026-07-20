const COST_EPSILON = 1e-9;

// Stage 4 — Path Validator. Read-only: verifies the Dijkstra engine's own
// output against the same edge set it traversed. This is an algorithm
// invariant check, not graph validation (Sprint 06 Story 05) or route
// validation (Sprint 07 Story 05) — it never touches the database.
function validatePath(nodeIds, edges, originNodeId, destinationNodeId, path, totalCost) {
  const errors = [];

  if (path[0] !== originNodeId) {
    errors.push("Path does not start at the origin node");
  }

  if (path[path.length - 1] !== destinationNodeId) {
    errors.push("Path does not end at the destination node");
  }

  for (const nodeId of path) {
    if (!nodeIds.has(nodeId)) {
      errors.push(`Path references node ${nodeId}, which does not exist in this graph`);
    }
  }

  const edgeCostByPair = new Map();

  for (const edge of edges) {
    edgeCostByPair.set(`${edge.sourceNodeId}->${edge.targetNodeId}`, edge.traversalCost);
  }

  let accumulatedCost = 0;

  for (let i = 0; i < path.length - 1; i += 1) {
    const key = `${path[i]}->${path[i + 1]}`;
    const edgeCost = edgeCostByPair.get(key);

    if (edgeCost === undefined) {
      errors.push(`No directed edge connects ${path[i]} -> ${path[i + 1]}`);
      continue;
    }

    accumulatedCost += edgeCost;
  }

  if (Math.abs(accumulatedCost - totalCost) > COST_EPSILON) {
    errors.push(
      `Total cost (${totalCost}) does not match the sum of traversed edge costs (${accumulatedCost})`
    );
  }

  return { errors };
}

module.exports = { validatePath };
