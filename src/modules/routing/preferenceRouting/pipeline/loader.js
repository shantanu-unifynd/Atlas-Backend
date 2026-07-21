const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const costPolicyLoader = require("../../costPolicy/pipeline/loader");

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

// Stage 1 — Loader. Reuses Sprint 08 Story 02's loader UNCHANGED for
// graph/context loading and validation (graph exists, graph READY,
// context exists, context belongs to graph) — not duplicated here. Adds
// only what Story 02 never needed: NavigationNodes, plus origin/
// destination validation, mirroring the exact checks Sprint 07 Story 03's
// own graph-loader.js performs.
async function load(graphId, contextId, originNodeId, destinationNodeId) {
  const { graph, routingContext, edges } = await costPolicyLoader.load(graphId, contextId);

  if (!originNodeId) {
    throw badRequest("originNodeId is required");
  }

  if (!destinationNodeId) {
    throw badRequest("destinationNodeId is required");
  }

  if (originNodeId === destinationNodeId) {
    throw badRequest("Origin and Destination must not be the same node");
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(graphId);
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (!nodeIds.has(originNodeId)) {
    throw badRequest("Origin node not found in this graph");
  }

  if (!nodeIds.has(destinationNodeId)) {
    throw badRequest("Destination node not found in this graph");
  }

  return { graph, routingContext, nodes, edges };
}

module.exports = { load };
