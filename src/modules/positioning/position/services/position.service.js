const Position = require("../models/position.model");
const positionRepository = require("../../../../repositories/position/position.repository");
const positionLoader = require("../pipeline/position-loader");
const positionValidator = require("../pipeline/position-validator");
const positionRepositoryStage = require("../pipeline/position-repository-stage");

// Sprint 10 Story 01 — Position Domain. CRUD only: no provider framework,
// no movement, no runtime integration, no routing. Establishes the
// normalized position record that Stories 02-05 will later produce and
// consume by reference — this story never reads or acts on that
// consumption itself.

function toPosition(record) {
  return new Position({
    id: record.id,
    graphId: record.graphId,
    source: record.source,
    coordinates: record.coordinates,
    recordedAt: record.recordedAt,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function validationError(errors) {
  const error = new Error(errors.join(", "));
  error.statusCode = 400;
  return error;
}

async function createPosition(data) {
  const { graphId, source, coordinates, recordedAt, metadata } = data;

  const { errors } = positionValidator.validateCreateRequest({ graphId, source, coordinates });

  if (errors.length > 0) {
    throw validationError(errors);
  }

  await positionLoader.loadGraph(graphId);

  const record = await positionRepositoryStage.persistPosition({
    graphId,
    source,
    coordinates,
    recordedAt: recordedAt ? new Date(recordedAt) : undefined,
    metadata: metadata || {},
  });

  return toPosition(record);
}

async function getPosition(id) {
  const record = await positionRepository.findById(id);

  if (!record) {
    throw notFoundError("Position not found");
  }

  return toPosition(record);
}

async function listPositions(filters = {}) {
  const where = {};

  if (filters.graphId) where.graphId = filters.graphId;
  if (filters.source) where.source = filters.source;

  const records = await positionRepository.findAll(where);

  return records.map(toPosition);
}

async function deletePosition(id) {
  const record = await positionRepository.findById(id);

  if (!record) {
    throw notFoundError("Position not found");
  }

  await positionRepository.deleteById(id);
}

module.exports = {
  createPosition,
  getPosition,
  listPositions,
  deletePosition,
};
