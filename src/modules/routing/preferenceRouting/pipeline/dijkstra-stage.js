const dijkstraEngine = require("../../../navigation/routing/pipeline/dijkstra-engine");

// Stage 4 — Dijkstra Stage. Reuses Sprint 07 Story 03's dijkstra-engine.js
// with ZERO modifications — no new tie-breaking, no preference awareness.
// It only ever sees an adjacency list of {neighborId, cost, edgeId}; it
// has no idea a "preference" or "policy" exists anywhere in the system.
function computeShortestPath(adjacency, originNodeId, destinationNodeId) {
  return dijkstraEngine.computeShortestPath(adjacency, originNodeId, destinationNodeId);
}

module.exports = { computeShortestPath };
