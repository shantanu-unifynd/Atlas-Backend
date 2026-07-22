const NavigationSession = require("../models/navigationSession.model");
const navigationSessionRepository = require("../../../../repositories/navigationSession/navigationSession.repository");
const sessionLoader = require("../pipeline/session-loader");
const sessionValidator = require("../pipeline/session-validator");
const sessionRepositoryStage = require("../pipeline/session-repository-stage");

// Sprint 09 Story 01 — Navigation Session Domain. CRUD only: no lifecycle
// engine, no progress engine, no event engine, no positioning. Establishes
// the runtime entity (a Route's execution instance) that Stories 02-05
// will later consume by reference — this story never reads or acts on
// that consumption itself.

function toNavigationSession(record) {
  return new NavigationSession({
    id: record.id,
    routeId: record.routeId,
    state: record.state,
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

async function createNavigationSession(data) {
  const { routeId, metadata } = data;

  const { errors } = sessionValidator.validateCreateRequest({ routeId });

  if (errors.length > 0) {
    throw validationError(errors);
  }

  await sessionLoader.loadRoute(routeId);

  const record = await sessionRepositoryStage.persistNavigationSession({
    routeId,
    metadata: metadata || {},
  });

  return toNavigationSession(record);
}

async function getNavigationSession(id) {
  const record = await navigationSessionRepository.findById(id);

  if (!record) {
    throw notFoundError("Navigation Session not found");
  }

  return toNavigationSession(record);
}

async function listNavigationSessions(filters = {}) {
  const where = {};

  if (filters.routeId) where.routeId = filters.routeId;
  if (filters.state) where.state = filters.state;

  const records = await navigationSessionRepository.findAll(where);

  return records.map(toNavigationSession);
}

async function deleteNavigationSession(id) {
  const record = await navigationSessionRepository.findById(id);

  if (!record) {
    throw notFoundError("Navigation Session not found");
  }

  await navigationSessionRepository.deleteById(id);
}

module.exports = {
  createNavigationSession,
  getNavigationSession,
  listNavigationSessions,
  deleteNavigationSession,
};
