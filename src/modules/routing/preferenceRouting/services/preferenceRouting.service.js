const loader = require("../pipeline/loader");
const policyStage = require("../pipeline/policy-stage");
const graphPreparation = require("../pipeline/graph-preparation");
const dijkstraStage = require("../pipeline/dijkstra-stage");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 08 Story 03 — Preference-Aware Routing. Orchestration only.
// Dijkstra remains completely unaware that a preference or policy exists —
// it only ever consumes {neighbor, effectiveCost}. Nothing is persisted
// anywhere in this call; no Route/RouteSegment/RouteStatistics is created.
async function computeRoute(contextId, graphId, originNodeId, destinationNodeId) {
  const { routingContext, nodes, edges } = await loader.load(
    graphId,
    contextId,
    originNodeId,
    destinationNodeId
  );

  const effectiveCosts = policyStage.computeEffectiveCosts(edges, routingContext.preference);

  const adjacency = graphPreparation.prepareGraph(nodes, edges, effectiveCosts);

  const result = dijkstraStage.computeShortestPath(adjacency, originNodeId, destinationNodeId);

  if (!result) {
    const error = new Error("No route exists between the origin and destination");
    error.statusCode = 404;
    throw error;
  }

  return responseBuilder.build(
    graphId,
    contextId,
    routingContext.preference,
    result.path,
    result.totalCost
  );
}

module.exports = { computeRoute };
