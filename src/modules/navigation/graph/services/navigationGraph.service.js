const NavigationGraph = require("../models/navigationGraph.model");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const buildingRepository = require("../../../../repositories/building/building.repository");
const floorRepository = require("../../../../repositories/floor/floor.repository");

// Sprint 06 Story 01 — Navigation Graph Domain Model. CRUD only: no graph
// generation, candidate detection, validation, optimization, or routing
// logic belongs here. Every graph is created CREATED and stays there — no
// lifecycle transitions are implemented in this story.
const PIPELINE_VERSION = "1.0.0";

function toNavigationGraph(record) {
  return new NavigationGraph({
    id: record.id,
    buildingId: record.buildingId,
    floorId: record.floorId,
    status: record.status,
    pipelineVersion: record.pipelineVersion,
    metadata: record.metadata,
    statistics: record.statistics,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

async function ensureBuildingExists(buildingId) {
  const building = await buildingRepository.findById(buildingId);

  if (!building) {
    const error = new Error("Building not found");
    error.statusCode = 404;
    throw error;
  }

  return building;
}

async function ensureFloorExists(buildingId, floorId) {
  const floor = await floorRepository.findById(floorId);

  if (!floor || floor.buildingId !== buildingId) {
    const error = new Error("Floor not found");
    error.statusCode = 404;
    throw error;
  }

  return floor;
}

function notFoundError() {
  const error = new Error("Navigation Graph not found");
  error.statusCode = 404;
  return error;
}

async function createNavigationGraph(data) {
  const { buildingId, floorId, metadata } = data;

  if (!buildingId) {
    const error = new Error("buildingId is required");
    error.statusCode = 400;
    throw error;
  }

  await ensureBuildingExists(buildingId);

  if (floorId) {
    await ensureFloorExists(buildingId, floorId);
  }

  const record = await navigationGraphRepository.create({
    buildingId,
    floorId: floorId || null,
    pipelineVersion: PIPELINE_VERSION,
    metadata: metadata || {},
  });

  return toNavigationGraph(record);
}

async function getAllNavigationGraphs(filters = {}) {
  const where = {};

  if (filters.buildingId) where.buildingId = filters.buildingId;
  if (filters.floorId) where.floorId = filters.floorId;
  if (filters.status) where.status = filters.status;

  const records = await navigationGraphRepository.findAll(where);

  return records.map(toNavigationGraph);
}

async function getNavigationGraphById(id) {
  const record = await navigationGraphRepository.findById(id);

  if (!record) {
    throw notFoundError();
  }

  return toNavigationGraph(record);
}

async function deleteNavigationGraph(id) {
  const record = await navigationGraphRepository.findById(id);

  if (!record) {
    throw notFoundError();
  }

  await navigationGraphRepository.deleteById(id);
}

module.exports = {
  createNavigationGraph,
  getAllNavigationGraphs,
  getNavigationGraphById,
  deleteNavigationGraph,
};
