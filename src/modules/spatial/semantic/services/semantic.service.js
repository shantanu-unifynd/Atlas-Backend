const { prisma } = require("../../../../config/database");
const semanticModelRepository = require("../../../../repositories/semanticModel/semanticModel.repository");
const SemanticModel = require("../models/semanticModel.model");
const { loadUsoModel } = require("../pipeline/semantic-loader");
const { validateSemanticInput } = require("../pipeline/semantic-validator");
const { collectEvidence } = require("../pipeline/evidence-collector");
const { executeRules, ENGINE_VERSION } = require("../pipeline/rule-engine");
const { CLASSIFICATION_VERSION } = require("../pipeline/rules/deterministic-rules");
const { resolveConflicts } = require("../pipeline/conflict-resolver");
const { computeConfidence } = require("../pipeline/confidence-engine");
const { buildSemanticModels } = require("../pipeline/semantic-model-builder");
const { persistSemanticModels } = require("../pipeline/semantic-repository-stage");
const { validateSemanticProduction } = require("../pipeline/semantic-production-validator");

// Phase C: transactional persistence, production validation, lifecycle,
// and version/provenance metadata. Pipeline stage order is unchanged
// (USO Model -> Semantic Loader -> Semantic Validator -> Evidence Collector
// -> Rule Engine -> Conflict Resolver -> Confidence Engine -> Semantic
// Model Builder -> Repository -> Diagnostics). Classification logic itself
// (the 5 rules, confidence values) is untouched from Phase B.
const PIPELINE_VERSION = "1.2.0";

function toSemanticModel(record) {
  return new SemanticModel(record);
}

function conflictError() {
  const error = new Error("Semantic Models have already been generated for this USO Model");
  error.statusCode = 409;
  return error;
}

// Orchestration only — every transformation lives in its own pipeline stage
// module. MUST consume only the USO Model (never SVG/DXF/ACSM/Blueprint
// Imports/Geometry Model); MUST produce only Semantic Models (never a
// navigation graph, routes, AI classifications, or business metadata).
async function generateSemanticModels(usoModelId) {
  const existing = await semanticModelRepository.findAllByGeometryModelId(usoModelId);

  if (existing.length > 0) {
    throw conflictError();
  }

  const processingStarted = new Date();

  const loaded = await loadUsoModel(usoModelId);
  const validated = validateSemanticInput(loaded, []);

  const evidenceList = collectEvidence(validated.usos, validated.relationshipsByUsoId);
  const { executions, rulesExecuted } = executeRules(evidenceList);
  const resolutions = resolveConflicts(executions);
  const resolutionsByUsoId = new Map(resolutions.map((resolution) => [resolution.usoId, resolution]));
  const confidenceByUsoId = new Map(
    validated.usos.map((uso) => [uso.id, computeConfidence(resolutionsByUsoId.get(uso.id))])
  );

  const versions = {
    classificationVersion: CLASSIFICATION_VERSION,
    pipelineVersion: PIPELINE_VERSION,
    engineVersion: ENGINE_VERSION,
  };

  const semanticModels = buildSemanticModels(validated.usos, resolutionsByUsoId, confidenceByUsoId, versions);

  // Repository stage runs inside a single transaction: no partial
  // persistence is allowed if any step fails. Today this covers one write
  // (Semantic Models), but the transaction boundary is drawn around the
  // whole persistence step so a future addition (e.g. semantic
  // relationships) is automatically covered without touching this function
  // again.
  let persisted;

  try {
    persisted = await prisma.$transaction(async (tx) => {
      return persistSemanticModels(semanticModels, tx);
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflictError();
    }

    throw error;
  }

  // Production Validator: runs over what was actually persisted. Per Phase
  // C's explicit instruction, no automatic lifecycle transition happens
  // here — every row stays GENERATED regardless of validation outcome.
  const productionReport = validateSemanticProduction({ usos: validated.usos, semanticModels: persisted });

  const processingFinished = new Date();

  const rulesMatched = executions.reduce((sum, execution) => sum + execution.matches.length, 0);
  const discardedRules = resolutions.reduce((sum, resolution) => sum + resolution.discardedMatches.length, 0);
  const conflictsDetected = resolutions.filter((resolution) => resolution.conflictDetected).length;
  const semanticObjectsClassified = resolutions.filter((resolution) => resolution.winningMatch).length;
  const unclassifiedObjects = resolutions.length - semanticObjectsClassified;

  const winningRule = {};
  for (const resolution of resolutions) {
    if (resolution.winningMatch) {
      const { ruleId } = resolution.winningMatch;
      winningRule[ruleId] = (winningRule[ruleId] || 0) + 1;
    }
  }

  const diagnostics = {
    lifecycleState: "GENERATED",
    semanticVersion: 1,
    classificationVersion: CLASSIFICATION_VERSION,
    pipelineVersion: PIPELINE_VERSION,
    engineVersion: ENGINE_VERSION,
    processingStarted: processingStarted.toISOString(),
    processingFinished: processingFinished.toISOString(),
    processingDuration: processingFinished.getTime() - processingStarted.getTime(),
    generatedCount: persisted.length,
    skippedCount: validated.errors.length,
    rulesExecuted,
    rulesMatched,
    winningRule,
    discardedRules,
    conflictsDetected,
    semanticObjectsClassified,
    unclassifiedObjects,
    warnings: [...validated.warnings, ...productionReport.warnings],
    errors: [...validated.errors, ...productionReport.errors],
  };

  return {
    semanticModels: persisted.map(toSemanticModel),
    diagnostics,
  };
}

async function getSemanticModels(usoModelId) {
  const loaded = await loadUsoModel(usoModelId);

  if (loaded.usos.length === 0) {
    const error = new Error(`No USOs found for USO Model '${usoModelId}'`);
    error.statusCode = 404;
    throw error;
  }

  const records = await semanticModelRepository.findAllByGeometryModelId(usoModelId);

  return records.map(toSemanticModel);
}

module.exports = {
  generateSemanticModels,
  getSemanticModels,
};
