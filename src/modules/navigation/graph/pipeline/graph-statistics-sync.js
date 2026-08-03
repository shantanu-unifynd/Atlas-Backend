const nodeStatistics = require("../../nodes/pipeline/node-statistics");
const edgeStatistics = require("../../edges/pipeline/edge-statistics");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");

// Human-assisted authoring — statistics resync.
//
// After any manual node/edge mutation, recompute the graph.statistics JSON
// from the graph's FULL current node/edge set and persist it. This is not
// cosmetic: the Graph Validator (validation/pipeline/graph-validator.js)
// treats a mismatch between statistics.nodeCount/edgeCount and the actual row
// counts as a structural ERROR that flips the graph to INVALID. Keeping the
// counts in sync on every mutation is what lets a hand-drawn graph validate to
// READY exactly like a generated one.
//
// Reuses the same builders the auto-generation pipeline uses, so manual and
// auto graphs produce identically-shaped statistics. Must run inside the
// caller's transaction so the mutation and the stats update commit atomically.
async function resyncGraphStatistics(graphId, tx) {
  const graph = await navigationGraphRepository.findById(graphId, tx);
  const nodes = await navigationNodeRepository.findAllByGraphId(graphId, tx);
  const edges = await navigationEdgeRepository.findAllByGraphId(graphId, tx);

  const withNodeStats = nodeStatistics.buildStatistics(graph.statistics || {}, nodes);
  const statistics = edgeStatistics.buildStatistics(withNodeStats, nodes, edges);

  await navigationGraphRepository.update(graphId, { statistics }, tx);

  return statistics;
}

module.exports = { resyncGraphStatistics };
