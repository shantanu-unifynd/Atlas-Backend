const { buildStatistics } = require("./graph-statistics");

// Stage 2 — Graph Validator. Deterministic, read-only: given the same
// nodes/edges/graph.statistics, always produces the same report. Never
// mutates NavigationNode/NavigationEdge/NavigationCandidate/SemanticModel/
// UniversalSpatialObject/Geometry.
//
// Severity split: structural integrity violations (an edge pointing at a
// node that isn't in this graph, a self-loop, a duplicate directed edge, or
// a statistics mismatch) are ERRORS — the graph is corrupt and cannot
// safely route, so it becomes INVALID. Connectivity-completeness concerns
// (an isolated node, a graph split across multiple components) are
// WARNINGS — the graph is still structurally sound and usable for the
// parts that ARE connected, so it becomes VALID_WITH_WARNINGS rather than
// INVALID.
function validateStructure(graphId, graph, nodes, edges) {
  const errors = [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenDirectedPairs = new Set();

  for (const node of nodes) {
    if (node.graphId !== graphId) {
      errors.push(`Node ${node.id} does not belong to graph ${graphId}`);
    }
  }

  for (const edge of edges) {
    if (edge.graphId !== graphId) {
      errors.push(`Edge ${edge.id} does not belong to graph ${graphId}`);
    }

    if (!nodeIds.has(edge.sourceNodeId)) {
      errors.push(`Edge ${edge.id} is an orphan edge — source node ${edge.sourceNodeId} does not exist in this graph`);
    }

    if (!nodeIds.has(edge.targetNodeId)) {
      errors.push(`Edge ${edge.id} is an orphan edge — target node ${edge.targetNodeId} does not exist in this graph`);
    }

    if (edge.sourceNodeId === edge.targetNodeId) {
      errors.push(`Edge ${edge.id} is a self-loop on node ${edge.sourceNodeId}`);
    }

    const directedKey = `${edge.sourceNodeId}->${edge.targetNodeId}`;

    if (seenDirectedPairs.has(directedKey)) {
      errors.push(`Duplicate directed edge ${directedKey}`);
    }

    seenDirectedPairs.add(directedKey);
  }

  if (graph.statistics?.nodeCount !== undefined && graph.statistics.nodeCount !== nodes.length) {
    errors.push(
      `Graph statistics are inconsistent: stored nodeCount (${graph.statistics.nodeCount}) does not match actual node count (${nodes.length})`
    );
  }

  if (graph.statistics?.edgeCount !== undefined && graph.statistics.edgeCount !== edges.length) {
    errors.push(
      `Graph statistics are inconsistent: stored edgeCount (${graph.statistics.edgeCount}) does not match actual edge count (${edges.length})`
    );
  }

  return errors;
}

function validateGraph(graphId, graph, nodes, edges) {
  const errors = validateStructure(graphId, graph, nodes, edges);
  const statistics = buildStatistics(nodes, edges);
  const warnings = [];

  if (statistics.isolatedNodeCount > 0) {
    warnings.push(
      `${statistics.isolatedNodeCount} isolated node(s) detected with no connections`
    );
  }

  if (nodes.length > 0 && statistics.connectedComponentCount > 1) {
    warnings.push(
      `Graph is split across ${statistics.connectedComponentCount} disconnected components`
    );
  }

  let validationStatus;

  if (errors.length > 0) {
    validationStatus = "INVALID";
  } else if (warnings.length > 0) {
    validationStatus = "VALID_WITH_WARNINGS";
  } else {
    validationStatus = "VALID";
  }

  return { validationStatus, warnings, errors, statistics };
}

module.exports = { validateGraph };
