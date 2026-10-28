const graphLoader = require("../pipeline/graph-loader");
const graphPreparation = require("../pipeline/graph-preparation");
const dijkstraEngine = require("../pipeline/dijkstra-engine");
const pathValidator = require("../pipeline/path-validator");

const ALGORITHM_NAME = "dijkstra";

// Sprint 07 Story 03 — Dijkstra Routing Engine. Orchestration only: every
// transformation lives in its own pipeline stage module. Pure computation
// — no persistence, no Route/RouteSegment/RouteStatistics, no graph
// mutation anywhere in this file. Treats the Navigation Graph as a generic
// weighted directed graph: only Nodes, Edges, and traversalCost are ever
// inspected.
async function computeShortestPath(graphId, originNodeId, destinationNodeId) {
  const { nodes, edges } = await graphLoader.loadGraphForRouting(
    graphId,
    originNodeId,
    destinationNodeId
  );

  const adjacency = graphPreparation.buildAdjacencyList(nodes, edges);

  const result = dijkstraEngine.computeShortestPath(adjacency, originNodeId, destinationNodeId);

  // "No route" is a VALID computation result (two disconnected points), not a
  // missing resource — answer 200 with an empty path instead of a 404 so the
  // browser stops logging a red error for a handled state (ui-bug-sweep #7).
  // Invalid graph/node ids still fail earlier in loadGraphForRouting.
  if (!result) {
    return {
      graphId,
      originNodeId,
      destinationNodeId,
      path: [],
      totalCost: null,
      algorithm: ALGORITHM_NAME,
      computedAt: new Date().toISOString(),
    };
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const { errors } = pathValidator.validatePath(
    nodeIds,
    edges,
    originNodeId,
    destinationNodeId,
    result.path,
    result.totalCost
  );

  if (errors.length > 0) {
    throw new Error(`Dijkstra engine produced an invalid path: ${errors.join(", ")}`);
  }

  return {
    graphId,
    originNodeId,
    destinationNodeId,
    path: result.path,
    totalCost: result.totalCost,
    algorithm: ALGORITHM_NAME,
    computedAt: new Date().toISOString(),
  };
}

module.exports = { computeShortestPath };
