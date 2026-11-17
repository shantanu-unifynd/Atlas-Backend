const { prisma } = require("../../../../config/database");
const NavigationEdge = require("../models/navigationEdge.model");
const NavigationGraph = require("../../graph/models/navigationGraph.model");
const nodeLoader = require("../pipeline/node-loader");
const edgeGenerator = require("../pipeline/edge-generator");
const edgeValidator = require("../pipeline/edge-validator");
const edgeStatistics = require("../pipeline/edge-statistics");
const edgeRepositoryStage = require("../pipeline/edge-repository-stage");
const statisticsSync = require("../../graph/pipeline/graph-statistics-sync");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Sprint 06 Story 04 — Navigation Edge Generation. Orchestration only: every
// transformation lives in its own pipeline stage module. Establishes graph
// connectivity from existing Semantic-layer relationships between
// NavigationNodes — no routing, no shortest-path computation, no
// accessibility optimization, no graph validation/publication (Story 05 /
// Sprint 07).

function toNavigationEdge(record) {
  return new NavigationEdge({
    id: record.id,
    graphId: record.graphId,
    sourceNodeId: record.sourceNodeId,
    targetNodeId: record.targetNodeId,
    edgeType: record.edgeType,
    length: record.length,
    traversalCost: record.traversalCost,
    accessibility: record.accessibility,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function validationError(errors) {
  const error = new Error(errors.join(", "));
  error.statusCode = 400;
  return error;
}

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

async function generateEdges(graphId) {
  const { graph, nodes, usoIdToNode, connections } = await nodeLoader.loadNodesForGraph(graphId);

  if (graph.statistics?.edgeCount !== undefined) {
    throw conflictError("Navigation edges have already been generated for this graph");
  }

  const edges = edgeGenerator.generateEdges(graphId, connections, usoIdToNode);

  const validation = edgeValidator.validateEdges(graphId, nodes, edges);

  if (validation.errors.length > 0) {
    throw validationError(validation.errors);
  }

  const statistics = edgeStatistics.buildStatistics(graph.statistics, nodes, edges);

  let updatedGraph;

  try {
    updatedGraph = await prisma.$transaction((tx) =>
      edgeRepositoryStage.persistEdges(graphId, edges, statistics, tx)
    );
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError("Navigation edges have already been generated for this graph");
    }

    throw error;
  }

  const persistedEdges = await navigationEdgeRepository.findAllByGraphId(graphId);

  return {
    graph: new NavigationGraph({
      id: updatedGraph.id,
      buildingId: updatedGraph.buildingId,
      floorId: updatedGraph.floorId,
      status: updatedGraph.status,
      pipelineVersion: updatedGraph.pipelineVersion,
      metadata: updatedGraph.metadata,
      statistics: updatedGraph.statistics,
      createdAt: updatedGraph.createdAt,
      updatedAt: updatedGraph.updatedAt,
    }),
    edges: persistedEdges.map(toNavigationEdge),
    statistics,
    warnings: validation.warnings,
  };
}

async function getEdges(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  const records = await navigationEdgeRepository.findAllByGraphId(graphId);

  return records.map(toNavigationEdge);
}

// Human-assisted authoring (MANUAL-03). Connects two existing nodes of the
// same graph with a single directed edge. Bidirectional walkability is the
// caller's choice — draw the reverse edge with a second call. Tagged
// metadata.source = "MANUAL" so deleteManualEdge can refuse to remove
// auto-generated edges. Statistics are resynced in the same transaction.
async function createManualEdge(graphId, body = {}) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  const { sourceNodeId, targetNodeId, edgeType, length, traversalCost, accessibility, metadata } = body;
  const errors = [];

  if (!sourceNodeId) errors.push("sourceNodeId is required");
  if (!targetNodeId) errors.push("targetNodeId is required");

  if (errors.length > 0) {
    throw validationError(errors);
  }

  if (sourceNodeId === targetNodeId) {
    throw validationError(["An edge cannot connect a node to itself (self-loop)"]);
  }

  if (
    traversalCost !== undefined &&
    (typeof traversalCost !== "number" || !Number.isFinite(traversalCost) || traversalCost < 0)
  ) {
    throw validationError(["traversalCost must be a non-negative number"]);
  }

  if (length !== undefined && length !== null && (typeof length !== "number" || !Number.isFinite(length) || length < 0)) {
    throw validationError(["length must be a non-negative number"]);
  }

  const [sourceNode, targetNode] = await Promise.all([
    navigationNodeRepository.findById(sourceNodeId),
    navigationNodeRepository.findById(targetNodeId),
  ]);

  if (!sourceNode || sourceNode.graphId !== graphId) {
    throw validationError(["sourceNodeId does not reference a node in this graph"]);
  }

  if (!targetNode || targetNode.graphId !== graphId) {
    throw validationError(["targetNodeId does not reference a node in this graph"]);
  }

  let record;

  try {
    record = await prisma.$transaction(async (tx) => {
      const created = await navigationEdgeRepository.create(
        {
          graphId,
          sourceNodeId,
          targetNodeId,
          edgeType: edgeType || "MANUAL",
          length: typeof length === "number" ? length : null,
          traversalCost: typeof traversalCost === "number" ? traversalCost : 1,
          accessibility: accessibility || {},
          metadata: { ...(metadata || {}), source: "MANUAL" },
        },
        tx
      );

      await statisticsSync.resyncGraphStatistics(graphId, tx);

      return created;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError("An edge already exists between these two nodes in this direction");
    }
    throw error;
  }

  return toNavigationEdge(record);
}

// Delete a manual edge. Refuses (409) to remove auto-generated edges so the
// generated edge set stays intact.
async function deleteManualEdge(graphId, edgeId) {
  const edge = await navigationEdgeRepository.findById(edgeId);

  if (!edge || edge.graphId !== graphId) {
    throw notFoundError("Navigation edge not found");
  }

  if (edge.metadata?.source !== "MANUAL") {
    throw conflictError("Only manually authored edges can be deleted");
  }

  await prisma.$transaction(async (tx) => {
    await navigationEdgeRepository.deleteById(edgeId, tx);

    await statisticsSync.resyncGraphStatistics(graphId, tx);
  });
}

// Assisted authoring — "spine" auto-connect. Given the admin-drawn spine nodes
// (waypoints along real corridors), attach every other node to its nearest
// spine node and chain the spine together, all two-way. Edges that already
// exist are skipped, so it's safe to re-run. Statistics resync once.
function distance(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

async function autoConnectEdges(graphId, body = {}) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  const { strategy = "spine", spineNodeIds = [] } = body;

  if (strategy !== "spine") {
    throw validationError(['Only the "spine" strategy is supported']);
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(graphId);
  const spineSet = new Set(spineNodeIds);
  const spine = nodes.filter((node) => spineSet.has(node.id));
  const rest = nodes.filter((node) => !spineSet.has(node.id));

  if (spine.length < 1) {
    throw validationError(["Provide at least one spine node in spineNodeIds"]);
  }

  const directed = new Set();
  const addBoth = (a, b) => {
    if (a === b) return;
    directed.add(`${a}|${b}`);
    directed.add(`${b}|${a}`);
  };

  // Attach each non-spine node to its nearest spine node.
  for (const node of rest) {
    let nearest = null;
    let best = Infinity;
    for (const s of spine) {
      const d = distance(node, s);
      if (d < best) { best = d; nearest = s; }
    }
    if (nearest) addBoth(node.id, nearest.id);
  }

  // Chain the spine itself via greedy nearest-neighbour so the corridors connect.
  if (spine.length > 1) {
    const remaining = spine.slice();
    let current = remaining.shift();
    while (remaining.length) {
      let bi = 0;
      let best = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = distance(current, remaining[i]);
        if (d < best) { best = d; bi = i; }
      }
      const next = remaining.splice(bi, 1)[0];
      addBoth(current.id, next.id);
      current = next;
    }
  }

  const existing = await navigationEdgeRepository.findAllByGraphId(graphId);
  const existingSet = new Set(existing.map((e) => `${e.sourceNodeId}|${e.targetNodeId}`));

  const rows = [...directed]
    .filter((key) => !existingSet.has(key))
    .map((key) => {
      const [sourceNodeId, targetNodeId] = key.split("|");
      return {
        graphId,
        sourceNodeId,
        targetNodeId,
        edgeType: "WALKWAY",
        traversalCost: 1,
        accessibility: {},
        metadata: { source: "MANUAL", auto: "spine" },
      };
    });

  if (rows.length > 0) {
    await prisma.$transaction(async (tx) => {
      await navigationEdgeRepository.createMany(rows, tx);
      await statisticsSync.resyncGraphStatistics(graphId, tx);
    });
  }

  return { created: rows.length, spineCount: spine.length, attachedNodes: rest.length };
}

// Multi-floor pairing (M2'b). Admin-confirmed cross-floor pairing of two
// vertical-connector nodes (e.g. "this lift on F1 is the same shaft as that
// lift on F2") in the building transition graph. Fully automatic pairing was
// prototyped and proved unreliable (floors don't co-register, connector counts
// differ), so this is a deliberate human confirmation, not a guess.
//
// Creates BOTH directed VERTICAL edges (a shaft is walkable up and down) in one
// transaction, tagged metadata.source = "MANUAL" so deleteManualEdge can unpair
// them. Guards reject the mistakes a human can make: same node, cross-graph,
// non-connector node, SAME floor (not a cross-floor link), or mismatched type
// (a lift should pair with a lift, not a staircase).
const CONNECTOR_NODE_TYPES = new Set(["ELEVATOR", "STAIR", "ESCALATOR"]);

async function pairConnectors(graphId, body = {}) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  const { sourceNodeId, targetNodeId, traversalCost, metadata } = body;
  const errors = [];

  if (!sourceNodeId) errors.push("sourceNodeId is required");
  if (!targetNodeId) errors.push("targetNodeId is required");

  if (errors.length > 0) {
    throw validationError(errors);
  }

  if (sourceNodeId === targetNodeId) {
    throw validationError(["A connector cannot be paired with itself"]);
  }

  if (
    traversalCost !== undefined &&
    (typeof traversalCost !== "number" || !Number.isFinite(traversalCost) || traversalCost < 0)
  ) {
    throw validationError(["traversalCost must be a non-negative number"]);
  }

  const [sourceNode, targetNode] = await Promise.all([
    navigationNodeRepository.findById(sourceNodeId),
    navigationNodeRepository.findById(targetNodeId),
  ]);

  if (!sourceNode || sourceNode.graphId !== graphId) {
    throw validationError(["sourceNodeId does not reference a node in this graph"]);
  }

  if (!targetNode || targetNode.graphId !== graphId) {
    throw validationError(["targetNodeId does not reference a node in this graph"]);
  }

  if (!CONNECTOR_NODE_TYPES.has(sourceNode.nodeType) || !CONNECTOR_NODE_TYPES.has(targetNode.nodeType)) {
    throw validationError(["Both nodes must be vertical connectors (ELEVATOR, STAIR, or ESCALATOR)"]);
  }

  if (sourceNode.nodeType !== targetNode.nodeType) {
    throw validationError([
      `Connector types must match to pair (${sourceNode.nodeType} vs ${targetNode.nodeType})`,
    ]);
  }

  // The whole point is to link DIFFERENT floors. Same-floor (or both-null) pairs
  // are a mistake, not a vertical transition.
  if (!sourceNode.floorId || !targetNode.floorId) {
    throw validationError(["Both connector nodes must be assigned to a floor to be paired"]);
  }

  if (sourceNode.floorId === targetNode.floorId) {
    throw validationError(["A vertical connector must link two different floors"]);
  }

  // A shaft is traversable both ways; cost is symmetric. traversalCost defaults
  // to 1 here — preference-aware costs (AVOID_STAIRS / PREFER_ELEVATORS) are
  // applied by the routing cost policy in M3, not baked in at pairing time.
  const cost = typeof traversalCost === "number" ? traversalCost : 1;
  const edgeMeta = { ...(metadata || {}), source: "MANUAL", transition: "VERTICAL" };
  const rows = [
    { graphId, sourceNodeId, targetNodeId, edgeType: "VERTICAL", traversalCost: cost, accessibility: {}, metadata: edgeMeta },
    { graphId, sourceNodeId: targetNodeId, targetNodeId: sourceNodeId, edgeType: "VERTICAL", traversalCost: cost, accessibility: {}, metadata: edgeMeta },
  ];

  try {
    await prisma.$transaction(async (tx) => {
      await navigationEdgeRepository.createMany(rows, tx);
      await statisticsSync.resyncGraphStatistics(graphId, tx);
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError("These two connectors are already paired");
    }
    throw error;
  }

  const persisted = await navigationEdgeRepository.findAllByGraphId(graphId);
  const pairEdges = persisted.filter(
    (e) =>
      e.edgeType === "VERTICAL" &&
      ((e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId) ||
        (e.sourceNodeId === targetNodeId && e.targetNodeId === sourceNodeId))
  );

  return { paired: true, nodeType: sourceNode.nodeType, edges: pairEdges.map(toNavigationEdge) };
}

module.exports = {
  generateEdges,
  getEdges,
  createManualEdge,
  deleteManualEdge,
  autoConnectEdges,
  pairConnectors,
};
