const { Prisma } = require("@prisma/client");
const { prisma } = require("../../../../config/database");
const geometryModelRepository = require("../../../../repositories/geometryModel/geometryModel.repository");
const universalSpatialObjectRepository = require("../../../../repositories/universalSpatialObject/universalSpatialObject.repository");
const usoRelationshipRepository = require("../../../../repositories/usoRelationship/usoRelationship.repository");
const UniversalSpatialObject = require("../models/universalSpatialObject.model");
const { loadCandidates } = require("../pipeline/candidate-loader");
const { validateCandidates } = require("../pipeline/candidate-validator");
const { generateUsos } = require("../pipeline/uso-generator");
const { resolveRelationships } = require("../pipeline/relationship-resolver");
const { analyzeAccessibility } = require("../pipeline/accessibility-analyzer");
const { buildUsoModels } = require("../pipeline/uso-model-builder");
const { validateProduction, canTransition } = require("../pipeline/production-validator");

// Bumped in Phase C for transactional persistence + production validation +
// lifecycle. Pipeline stage order is unchanged from Phase A/B.
const PIPELINE_VERSION = "1.2.0";

const RELATIONSHIP_TYPES = ["ADJACENT_TO", "CONTAINS", "WITHIN", "BOUNDED_BY", "CONNECTS", "TOUCHES", "INTERSECTS"];

function toUniversalSpatialObject(record, relationshipsByUsoId) {
  return new UniversalSpatialObject({
    ...record,
    relationships: relationshipsByUsoId.get(record.id) || [],
  });
}

function buildRelationshipsByUsoId(relationships) {
  const map = new Map();

  for (const relationship of relationships) {
    const shaped = {
      relationshipId: relationship.id,
      sourceUsoId: relationship.sourceUsoId,
      targetUsoId: relationship.targetUsoId,
      relationshipType: relationship.relationshipType,
      confidence: relationship.confidence,
      createdAt: relationship.createdAt,
    };

    for (const usoId of [relationship.sourceUsoId, relationship.targetUsoId]) {
      if (!map.has(usoId)) map.set(usoId, []);
      map.get(usoId).push(shaped);
    }
  }

  return map;
}

async function ensureGeometryModelExists(geometryId) {
  const geometryModel = await geometryModelRepository.findById(geometryId);

  if (!geometryModel) {
    const error = new Error("Geometry model not found");
    error.statusCode = 404;
    throw error;
  }

  return geometryModel;
}

function countAccessibility(records, field) {
  return records.filter((record) => record.accessibility[field] === true).length;
}

function conflictError() {
  const error = new Error("Universal Spatial Objects have already been generated for this geometry model");
  error.statusCode = 409;
  return error;
}

// Orchestration only — every transformation lives in its own pipeline stage
// module. MUST consume only the Geometry Model (never SVG/DXF/ACSM/Blueprint
// Imports); MUST produce only USOs (never semantic entities, never a graph).
async function generateUniversalSpatialObjects(geometryId) {
  const geometryModel = await ensureGeometryModelExists(geometryId);

  const existing = await universalSpatialObjectRepository.findAllByGeometryModelId(geometryId);

  if (existing.length > 0) {
    throw conflictError();
  }

  const processingStarted = new Date();

  const loaded = loadCandidates(geometryModel);
  const validated = validateCandidates(loaded);
  const generated = generateUsos(geometryModel.id, validated, PIPELINE_VERSION);
  const { pendingRelationships, warnings: relationshipWarnings } = resolveRelationships(
    generated,
    geometryModel.relationships
  );
  const withAccessibility = analyzeAccessibility(generated);
  const usoModels = buildUsoModels(withAccessibility);

  // Repository stage: USOs and their relationships are written atomically.
  // Without this, a failure partway through (as observed in Phase B testing,
  // when a relationship insert violated a unique constraint after USOs had
  // already been committed) leaves orphan USOs with no relationships and no
  // way to retry — the 409 "already generated" guard would block it forever.
  let duplicateRelationshipsCollapsed = 0;

  let records;
  let relationshipRecords;

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (usoModels.length > 0) {
        await universalSpatialObjectRepository.createMany(usoModels, tx);
      }

      const insertedUsos = await universalSpatialObjectRepository.findAllByGeometryModelId(geometryId, tx);
      const usoIdByCandidateId = new Map(insertedUsos.map((record) => [record.candidateId, record.id]));

      // Dedupe on (source, target, type): a candidate spanning several
      // primitives (e.g. a multi-line boundary) can be evaluated against
      // more than one underlying touching pair, which would otherwise
      // attempt to persist the same USO-level relationship twice.
      const seenRelationshipKeys = new Set();

      const txRelationshipRecords = pendingRelationships
        .map((pending) => {
          const sourceUsoId = usoIdByCandidateId.get(pending.sourceCandidateId);
          const targetUsoId = usoIdByCandidateId.get(pending.targetCandidateId);

          if (!sourceUsoId || !targetUsoId) return null;

          const key = `${sourceUsoId}|${targetUsoId}|${pending.relationshipType}`;

          if (seenRelationshipKeys.has(key)) {
            duplicateRelationshipsCollapsed += 1;
            return null;
          }

          seenRelationshipKeys.add(key);

          return {
            geometryModelId: geometryModel.id,
            sourceUsoId,
            targetUsoId,
            relationshipType: pending.relationshipType,
            confidence: pending.confidence,
          };
        })
        .filter(Boolean);

      if (txRelationshipRecords.length > 0) {
        await usoRelationshipRepository.createMany(txRelationshipRecords, tx);
      }

      return { insertedUsos, txRelationshipRecords };
    });

    records = result.insertedUsos;
    relationshipRecords = result.txRelationshipRecords;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflictError();
    }

    throw error;
  }

  const persistedRelationships = await usoRelationshipRepository.findAllByGeometryModelId(geometryId);

  // Production Validator: runs over what was actually persisted. Only on a
  // clean pass (no errors) do USOs transition GENERATED -> VALIDATED; any
  // error leaves them at GENERATED rather than promoting invalid data.
  const productionReport = validateProduction({
    geometryModel,
    usos: records,
    relationships: persistedRelationships,
  });

  let lifecycleTransitions = 0;

  if (productionReport.isValid && records.length > 0 && canTransition("GENERATED", "VALIDATED")) {
    const usoIds = records.map((record) => record.id);
    await universalSpatialObjectRepository.updateManyStatus(usoIds, "VALIDATED");
    lifecycleTransitions = usoIds.length;
    // Re-fetch rather than patch in-memory: @updatedAt is set by Postgres at
    // write time, so the response must reflect the real persisted row, not
    // a stale timestamp from before this transition.
    records = await universalSpatialObjectRepository.findAllByGeometryModelId(geometryId);
  }

  const relationshipsByUsoId = buildRelationshipsByUsoId(persistedRelationships);

  const processingFinished = new Date();

  const candidateCount = Object.values(loaded.candidateObjects || {}).reduce(
    (sum, collection) => sum + (Array.isArray(collection) ? collection.length : 0),
    0
  );

  const relationshipCountsByType = Object.fromEntries(
    RELATIONSHIP_TYPES.map((type) => [
      type,
      persistedRelationships.filter((r) => r.relationshipType === type).length,
    ])
  );

  const diagnostics = {
    pipelineVersion: PIPELINE_VERSION,
    processingStarted: processingStarted.toISOString(),
    processingFinished: processingFinished.toISOString(),
    processingDuration: processingFinished.getTime() - processingStarted.getTime(),
    candidateCount,
    generatedUSOs: records.length,
    generatedRelationships: persistedRelationships.length,
    duplicateRelationshipsCollapsed,
    skippedCandidates: validated.skippedCandidates,
    lifecycleTransitions,
    adjacentCount: relationshipCountsByType.ADJACENT_TO,
    containsCount: relationshipCountsByType.CONTAINS,
    withinCount: relationshipCountsByType.WITHIN,
    boundedByCount: relationshipCountsByType.BOUNDED_BY,
    connectsCount: relationshipCountsByType.CONNECTS,
    touchesCount: relationshipCountsByType.TOUCHES,
    intersectsCount: relationshipCountsByType.INTERSECTS,
    traversableCount: countAccessibility(records, "traversable"),
    obstacleCount: countAccessibility(records, "obstacle"),
    verticalConnectorCount: countAccessibility(records, "verticalConnector"),
    validationWarnings: [...validated.warnings, ...relationshipWarnings, ...productionReport.warnings],
    validationErrors: [...validated.errors, ...productionReport.errors],
  };

  return {
    usos: records.map((record) => toUniversalSpatialObject(record, relationshipsByUsoId)),
    diagnostics,
  };
}

async function getUniversalSpatialObjects(geometryId) {
  await ensureGeometryModelExists(geometryId);

  const records = await universalSpatialObjectRepository.findAllByGeometryModelId(geometryId);
  const persistedRelationships = await usoRelationshipRepository.findAllByGeometryModelId(geometryId);
  const relationshipsByUsoId = buildRelationshipsByUsoId(persistedRelationships);

  return records.map((record) => toUniversalSpatialObject(record, relationshipsByUsoId));
}

module.exports = {
  generateUniversalSpatialObjects,
  getUniversalSpatialObjects,
};
