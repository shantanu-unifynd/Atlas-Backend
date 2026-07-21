const RoutingContext = require("../models/routingContext.model");
const routingContextRepository = require("../../../../repositories/routingContext/routingContext.repository");
const routingContextLoader = require("../pipeline/routing-context-loader");
const routingContextValidator = require("../pipeline/routing-context-validator");
const routingContextRepositoryStage = require("../pipeline/routing-context-repository-stage");

// Sprint 08 Story 01 — Routing Context Domain. CRUD only: no policy
// engine, no effective-cost computation, no routing. Establishes the
// runtime context (graph + requested preference) that Stories 02-05 will
// later consume by reference — this story never reads or acts on that
// consumption itself.

function toRoutingContext(record) {
  return new RoutingContext({
    id: record.id,
    graphId: record.graphId,
    preference: record.preference,
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

async function createRoutingContext(data) {
  const { graphId, preference, metadata } = data;

  const { errors } = routingContextValidator.validateCreateRequest({ graphId, preference });

  if (errors.length > 0) {
    throw validationError(errors);
  }

  await routingContextLoader.loadGraph(graphId);

  const record = await routingContextRepositoryStage.persistRoutingContext({
    graphId,
    preference,
    metadata: metadata || {},
  });

  return toRoutingContext(record);
}

async function getRoutingContext(id) {
  const record = await routingContextRepository.findById(id);

  if (!record) {
    throw notFoundError("Routing Context not found");
  }

  return toRoutingContext(record);
}

async function listRoutingContexts(filters = {}) {
  const where = {};

  if (filters.graphId) where.graphId = filters.graphId;
  if (filters.preference) where.preference = filters.preference;

  const records = await routingContextRepository.findAll(where);

  return records.map(toRoutingContext);
}

async function deleteRoutingContext(id) {
  const record = await routingContextRepository.findById(id);

  if (!record) {
    throw notFoundError("Routing Context not found");
  }

  await routingContextRepository.deleteById(id);
}

module.exports = {
  createRoutingContext,
  getRoutingContext,
  listRoutingContexts,
  deleteRoutingContext,
};
