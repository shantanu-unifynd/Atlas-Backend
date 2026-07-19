const { prisma } = require("../../../../config/database");
const NavigationCandidate = require("../models/navigationCandidate.model");
const NavigationGraph = require("../../graph/models/navigationGraph.model");
const candidateLoader = require("../pipeline/candidate-loader");
const candidateDetector = require("../pipeline/candidate-detector");
const candidateValidator = require("../pipeline/candidate-validator");
const candidateStatistics = require("../pipeline/candidate-statistics");
const candidateRepositoryStage = require("../pipeline/candidate-repository-stage");
const navigationCandidateRepository = require("../../../../repositories/navigationCandidate/navigationCandidate.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");

// Sprint 06 Story 02 Phase A — Navigation Candidate Detection. Orchestration
// only: every transformation lives in its own pipeline stage module. Detects
// WHERE navigation nodes should eventually exist — does not create
// NavigationNode or NavigationEdge rows (Story 03/04), and does not perform
// graph validation, optimization, or routing (Story 05 / Sprint 07).

function toNavigationCandidate(record) {
  return new NavigationCandidate({
    id: record.id,
    graphId: record.graphId,
    semanticObjectId: record.semanticObjectId,
    candidateType: record.candidateType,
    position: record.position,
    confidence: record.confidence,
    metadata: record.metadata,
    createdAt: record.createdAt,
  });
}

function conflictError() {
  const error = new Error("Navigation candidates have already been generated for this graph");
  error.statusCode = 409;
  return error;
}

function validationError(errors) {
  const error = new Error(errors.join(", "));
  error.statusCode = 400;
  return error;
}

async function generateCandidates(graphId) {
  const { graph, semanticModels, neighborsByUsoId } =
    await candidateLoader.loadSemanticModelsForGraph(graphId);

  if (graph.status !== "CREATED") {
    throw conflictError();
  }

  const inputValidation = candidateValidator.validateInput(semanticModels);

  if (inputValidation.errors.length > 0) {
    throw validationError(inputValidation.errors);
  }

  const detections = candidateDetector.detectCandidates(semanticModels, neighborsByUsoId);

  const detectionValidation = candidateValidator.validateDetections(detections);

  if (detectionValidation.errors.length > 0) {
    throw validationError(detectionValidation.errors);
  }

  const statistics = candidateStatistics.buildStatistics(semanticModels.length, detections);

  let updatedGraph;

  try {
    updatedGraph = await prisma.$transaction((tx) =>
      candidateRepositoryStage.persistCandidates(graphId, detections, statistics, tx)
    );
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError();
    }

    throw error;
  }

  const persistedCandidates = await navigationCandidateRepository.findAllByGraphId(graphId);

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
    candidates: persistedCandidates.map(toNavigationCandidate),
    statistics,
    warnings: [...inputValidation.warnings, ...detectionValidation.warnings],
  };
}

async function getCandidates(graphId) {
  const graph = await navigationGraphRepository.findById(graphId);

  if (!graph) {
    const error = new Error("Navigation Graph not found");
    error.statusCode = 404;
    throw error;
  }

  const records = await navigationCandidateRepository.findAllByGraphId(graphId);

  return records.map(toNavigationCandidate);
}

module.exports = {
  generateCandidates,
  getCandidates,
};
