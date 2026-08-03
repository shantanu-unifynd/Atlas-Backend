const { prisma } = require("../../../../config/database");
const NavigationNode = require("../models/navigationNode.model");
const NavigationGraph = require("../../graph/models/navigationGraph.model");
const candidateLoader = require("../pipeline/candidate-loader");
const nodeGenerator = require("../pipeline/node-generator");
const nodeValidator = require("../pipeline/node-validator");
const nodeStatistics = require("../pipeline/node-statistics");
const nodeRepositoryStage = require("../pipeline/node-repository-stage");
const statisticsSync = require("../../graph/pipeline/graph-statistics-sync");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const normalizedBlueprintRepository = require("../../../../repositories/normalizedBlueprint/normalizedBlueprint.repository");

// Default: shop/unit codes like "SH/118", "K/12" — a 1–4 letter prefix, a
// slash, digits, optional trailing letter. Overridable per request.
const DEFAULT_LABEL_PATTERN = "^[A-Za-z]{1,4}\\/\\d+[A-Za-z]?$";

// An SVG element's transform "matrix(a,b,c,d,e,f)" maps its local origin (0,0)
// to (e,f); for a label anchored at its origin that IS the label's position.
function positionFromTransform(transform) {
  const match = String(transform || "").match(/matrix\(([^)]+)\)/);
  if (!match) return null;
  const n = match[1].split(/[\s,]+/).map(Number);
  if (n.length < 6 || !Number.isFinite(n[4]) || !Number.isFinite(n[5])) return null;
  return { x: Math.round(n[4]), y: Math.round(n[5]) };
}

// Sprint 06 Story 03 — Navigation Node Generation. Orchestration only: every
// transformation lives in its own pipeline stage module. Transforms
// previously generated NavigationCandidates into canonical NavigationNodes
// — a deterministic 1:1 mapping, never edges, never routing, never
// connectivity/graph validation (those belong to Story 04/05).

function toNavigationNode(record) {
  return new NavigationNode({
    id: record.id,
    graphId: record.graphId,
    candidateId: record.candidateId,
    semanticObjectId: record.semanticObjectId,
    source: record.source,
    nodeType: record.nodeType,
    position: record.position,
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

function isValidPosition(position) {
  return (
    position !== null &&
    typeof position === "object" &&
    !Array.isArray(position) &&
    typeof position.x === "number" &&
    Number.isFinite(position.x) &&
    typeof position.y === "number" &&
    Number.isFinite(position.y)
  );
}

async function generateNodes(graphId) {
  const { candidates } = await candidateLoader.loadCandidatesForGraph(graphId);

  const existingNodes = await navigationNodeRepository.findAllByGraphId(graphId);

  if (existingNodes.length > 0) {
    throw conflictError("Navigation nodes have already been generated for this graph");
  }

  const nodes = nodeGenerator.generateNodes(graphId, candidates);

  const validation = nodeValidator.validateNodes(candidates, nodes);

  if (validation.errors.length > 0) {
    throw validationError(validation.errors);
  }

  const graph = await navigationGraphRepository.findById(graphId);
  const statistics = nodeStatistics.buildStatistics(graph.statistics, nodes);

  let updatedGraph;

  try {
    updatedGraph = await prisma.$transaction((tx) =>
      nodeRepositoryStage.persistNodes(graphId, nodes, statistics, tx)
    );
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError("Navigation nodes have already been generated for this graph");
    }

    throw error;
  }

  const persistedNodes = await navigationNodeRepository.findAllByGraphId(graphId);

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
    nodes: persistedNodes.map(toNavigationNode),
    statistics,
    warnings: validation.warnings,
  };
}

async function getNodes(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  const records = await navigationNodeRepository.findAllByGraphId(graphId);

  return records.map(toNavigationNode);
}

// Human-assisted authoring (MANUAL-02). Persists a hand-placed node that has
// no candidate/semantic backing — only a position and type the admin chose.
// Distinct from generateNodes (the deterministic candidate→node pipeline),
// which is left entirely untouched. Statistics are resynced in the same
// transaction so the graph still validates.
async function createManualNode(graphId, body = {}) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  const { nodeType, position, label, metadata } = body;
  const errors = [];

  if (!nodeType || typeof nodeType !== "string") {
    errors.push("nodeType is required and must be a string");
  }

  if (!isValidPosition(position)) {
    errors.push("position is required and must be an object with numeric x and y");
  }

  if (errors.length > 0) {
    throw validationError(errors);
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await navigationNodeRepository.create(
      {
        graphId,
        candidateId: null,
        semanticObjectId: null,
        source: "MANUAL",
        nodeType,
        position,
        metadata: {
          ...(metadata || {}),
          ...(label !== undefined ? { label } : {}),
        },
      },
      tx
    );

    await statisticsSync.resyncGraphStatistics(graphId, tx);

    return created;
  });

  return toNavigationNode(record);
}

// Move / rename / retype a manual node. AUTO nodes are rejected (409): they
// are deterministic products of the pipeline and must stay verbatim copies of
// their candidate.
async function updateManualNode(graphId, nodeId, body = {}) {
  const node = await navigationNodeRepository.findById(nodeId);

  if (!node || node.graphId !== graphId) {
    throw notFoundError("Navigation node not found");
  }

  if (node.source !== "MANUAL") {
    throw conflictError("Only manually authored nodes can be edited");
  }

  const { position, nodeType, label, metadata } = body;
  const data = {};

  if (position !== undefined) {
    if (!isValidPosition(position)) {
      throw validationError(["position must be an object with numeric x and y"]);
    }
    data.position = position;
  }

  if (nodeType !== undefined) {
    if (!nodeType || typeof nodeType !== "string") {
      throw validationError(["nodeType must be a non-empty string"]);
    }
    data.nodeType = nodeType;
  }

  if (metadata !== undefined || label !== undefined) {
    data.metadata = {
      ...(node.metadata || {}),
      ...(metadata || {}),
      ...(label !== undefined ? { label } : {}),
    };
  }

  if (Object.keys(data).length === 0) {
    throw validationError(["No updatable fields provided (position, nodeType, label, metadata)"]);
  }

  const record = await prisma.$transaction(async (tx) => {
    const updated = await navigationNodeRepository.update(nodeId, data, tx);

    await statisticsSync.resyncGraphStatistics(graphId, tx);

    return updated;
  });

  return toNavigationNode(record);
}

// Delete a manual node. Its edges are removed by the DB-level ON DELETE
// CASCADE on navigation_edges. AUTO nodes are rejected (409) to keep the
// generated node set intact.
async function deleteManualNode(graphId, nodeId) {
  const node = await navigationNodeRepository.findById(nodeId);

  if (!node || node.graphId !== graphId) {
    throw notFoundError("Navigation node not found");
  }

  if (node.source !== "MANUAL") {
    throw conflictError("Only manually authored nodes can be deleted");
  }

  await prisma.$transaction(async (tx) => {
    await navigationNodeRepository.deleteById(nodeId, tx);

    await statisticsSync.resyncGraphStatistics(graphId, tx);
  });
}

// Assisted authoring: create one MANUAL node per matching label in the floor's
// normalized blueprint (ACSM). Reuses the pipeline's own stored output — no SVG
// re-parsing. Positions come from each label's transform. Statistics resync once.
async function importNodesFromLabels(graphId, body = {}) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    throw notFoundError("Navigation Graph not found");
  }

  const { importId, pattern } = body;

  if (!importId) {
    throw validationError(["importId is required"]);
  }

  const normalized = await normalizedBlueprintRepository.findByBlueprintImportId(importId);

  if (!normalized) {
    const error = new Error("Blueprint has not been normalized yet — run normalization first");
    error.statusCode = 400;
    throw error;
  }

  let regex;
  try {
    regex = new RegExp(pattern || DEFAULT_LABEL_PATTERN);
  } catch {
    throw validationError(["pattern is not a valid regular expression"]);
  }

  const elements = Array.isArray(normalized.elements) ? normalized.elements : [];
  const rows = [];

  for (const element of elements) {
    if (element.type !== "text") continue;
    const label = String(element.text || "").trim();
    if (!label || !regex.test(label)) continue;
    const position = positionFromTransform(element.attributes && element.attributes.transform);
    if (!position) continue;
    rows.push({
      graphId,
      candidateId: null,
      semanticObjectId: null,
      source: "MANUAL",
      nodeType: "ROOM_ENTRY",
      position,
      metadata: { label },
    });
  }

  if (rows.length === 0) {
    return { created: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await navigationNodeRepository.createMany(rows, tx);
    await statisticsSync.resyncGraphStatistics(graphId, tx);
  });

  return { created: rows.length };
}

module.exports = {
  generateNodes,
  getNodes,
  createManualNode,
  updateManualNode,
  deleteManualNode,
  importNodesFromLabels,
};
