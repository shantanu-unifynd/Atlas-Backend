const { Prisma } = require("@prisma/client");
const GeometryModel = require("../models/geometryModel.model");
const geometryModelRepository = require("../../../../../repositories/geometryModel/geometryModel.repository");
const normalizationService = require("../../../normalization/services/normalization.service");
const { collectPrimitives } = require("../pipeline/primitive-collector");
const { cleanGeometry } = require("../pipeline/geometry-cleaner");
const { buildTopology } = require("../pipeline/topology-builder");
const { classifyGeometry, emptyCandidateSkeleton } = require("../pipeline/geometry-classifier");
const { buildRelationships } = require("../pipeline/relationship-builder");
const { buildGeometryModel } = require("../pipeline/geometry-model-builder");

// Bumped whenever a pipeline stage gains real logic in a later phase, so
// persisted GeometryModels stay traceable to the algorithm version that
// produced them. Phase B added real logic to Collector/Cleaner/Topology.
// Phase C added real Classifier/Relationship Builder logic, but only for
// the separate candidate-generation step (see generateCandidates below) —
// extraction itself still produces the empty candidate skeleton, unchanged
// from Phase A/B.
const PIPELINE_VERSION = "1.1.0";

// SVG blueprints are authored in exact pixel coordinates, so their topology is
// built with exact node matching (snap = 0). CAD formats (DXF) carry real-world
// coordinates where a tool commonly leaves adjacent wall corners a fraction of
// a unit apart; without snapping, those near-miss endpoints become separate
// nodes and the wall graph fragments, so no room face can close. We snap CAD
// coordinates onto a grid sized as a small fraction of the drawing's diagonal
// (measured safe zone on real floorplans: well under the ~0.5-unit wall-
// thickness spacing, so genuine parallel walls are never merged).
const CAD_SNAP_FACTOR = 0.00025;

function snapToleranceFor(acsm) {
  if (!acsm || acsm.sourceFormat === "svg") return 0;
  const b = acsm.bounds;
  if (!b || ![b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite)) return 0;
  const diagonal = Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
  return diagonal * CAD_SNAP_FACTOR;
}

function toGeometryModel(record, metadata) {
  return new GeometryModel({
    id: record.id,
    normalizedBlueprintId: record.normalizedBlueprintId,
    metadata,
    primitives: record.primitives,
    cleanedGeometry: record.cleanedGeometry,
    topology: record.topology,
    candidateObjects: record.candidateObjects,
    relationships: record.relationships,
    diagnostics: record.diagnostics,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function countCandidates(candidateObjects) {
  return Object.values(candidateObjects).reduce((sum, collection) => sum + collection.length, 0);
}

function buildRemovalWarnings(removed) {
  return [...removed.invalid, ...removed.duplicates].map(
    (entry) => `${entry.type} '${entry.id}' removed: ${entry.reason}`
  );
}

// Orchestration only — every transformation lives in its own pipeline stage
// module. This function's job is solely: fetch ACSM, run stages in order,
// assemble diagnostics, persist, return. No geometry logic belongs here.
// Unchanged since Phase B: candidateObjects/relationships are still the
// empty skeleton here — real candidate generation is a separate step below.
async function extractGeometry(buildingId, floorId, importId) {
  const acsm = await normalizationService.getAcsm(buildingId, floorId, importId);

  const existing = await geometryModelRepository.findByNormalizedBlueprintId(acsm.id);

  if (existing) {
    const error = new Error("Geometry has already been extracted for this blueprint");
    error.statusCode = 409;
    throw error;
  }

  const processingStarted = new Date();

  const { primitives, statistics: primitiveStatistics } = collectPrimitives(acsm);
  const { cleaned: cleanedGeometry, removed } = cleanGeometry(primitives);
  const topology = buildTopology(cleanedGeometry, snapToleranceFor(acsm));
  const candidateObjects = emptyCandidateSkeleton();
  const relationships = [];

  const processingFinished = new Date();

  const diagnostics = {
    pipelineVersion: PIPELINE_VERSION,
    processingStarted: processingStarted.toISOString(),
    processingFinished: processingFinished.toISOString(),
    primitiveCount: primitives.length,
    primitiveCountsByType: primitiveStatistics.countsByType,
    cleanedPrimitiveCount: cleanedGeometry.length,
    removedDuplicates: removed.duplicates.length,
    removedInvalidGeometry: removed.invalid.length,
    topologyNodeCount: topology.nodes.length,
    topologyEdgeCount: topology.edges.length,
    connectedComponents: topology.connectedComponents.length,
    closedBoundaries: topology.closedBoundaries.length,
    candidateCount: countCandidates(candidateObjects),
    relationshipCount: relationships.length,
    boundaryCount: 0,
    enclosureCount: 0,
    wallCount: 0,
    openingCount: 0,
    passageCount: 0,
    verticalConnectionCount: 0,
    candidatesGeneratedAt: null,
    warnings: buildRemovalWarnings(removed),
    errors: [],
  };

  const geometryModel = buildGeometryModel({
    metadata: acsm.metadata,
    primitives,
    cleanedGeometry,
    topology,
    candidateObjects,
    relationships,
    diagnostics,
  });

  try {
    const record = await geometryModelRepository.create({
      normalizedBlueprintId: acsm.id,
      primitives: geometryModel.primitives,
      cleanedGeometry: geometryModel.cleanedGeometry,
      topology: geometryModel.topology,
      candidateObjects: geometryModel.candidateObjects,
      relationships: geometryModel.relationships,
      diagnostics: geometryModel.diagnostics,
    });

    return toGeometryModel(record, geometryModel.metadata);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const conflict = new Error("Geometry has already been extracted for this blueprint");
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
}

async function getGeometryModel(buildingId, floorId, importId) {
  const acsm = await normalizationService.getAcsm(buildingId, floorId, importId);

  const record = await geometryModelRepository.findByNormalizedBlueprintId(acsm.id);

  if (!record) {
    const error = new Error("Geometry model not found for this blueprint import");
    error.statusCode = 404;
    throw error;
  }

  return toGeometryModel(record, acsm.metadata);
}

// Separate enrichment step (Phase C): consumes ONLY the already-persisted
// GeometryModel — never the ACSM, never SVG, never re-runs Collection/
// Cleaning/Topology. Classifies candidates and derives relationships from
// the stored cleanedGeometry/topology, then updates the same row in place.
async function generateCandidates(buildingId, floorId, importId) {
  const acsm = await normalizationService.getAcsm(buildingId, floorId, importId);

  const record = await geometryModelRepository.findByNormalizedBlueprintId(acsm.id);

  if (!record) {
    const error = new Error("Geometry model not found for this blueprint import");
    error.statusCode = 404;
    throw error;
  }

  if (record.diagnostics.candidatesGeneratedAt) {
    const error = new Error("Candidates have already been generated for this geometry model");
    error.statusCode = 409;
    throw error;
  }

  const { candidateObjects, warnings } = classifyGeometry(record.cleanedGeometry, record.topology);
  const relationships = buildRelationships(candidateObjects, record.cleanedGeometry, record.topology);

  const diagnostics = {
    ...record.diagnostics,
    candidateCount: countCandidates(candidateObjects),
    relationshipCount: relationships.length,
    boundaryCount: candidateObjects.candidateBoundaries.length,
    enclosureCount: candidateObjects.candidateEnclosures.length,
    wallCount: candidateObjects.candidateWalls.length,
    openingCount: candidateObjects.candidateOpenings.length,
    passageCount: candidateObjects.candidatePassages.length,
    verticalConnectionCount: candidateObjects.candidateVerticalConnections.length,
    candidatesGeneratedAt: new Date().toISOString(),
    warnings: [...record.diagnostics.warnings, ...warnings],
  };

  const updated = await geometryModelRepository.update(record.id, {
    candidateObjects,
    relationships,
    diagnostics,
  });

  return toGeometryModel(updated, acsm.metadata);
}

// BXP-09 — explicit, narrowly-scoped regeneration. Unlike generateCandidates
// (Phase C's one-shot enrichment, which reclassifies the ALREADY-PERSISTED
// record.topology and refuses to run twice), this rebuilds topology itself
// from the already-persisted cleanedGeometry using the CURRENT topology-
// builder before reclassifying — the only way an existing GeometryModel can
// benefit from later extraction-algorithm fixes (e.g. BXP-01's face
// extraction) without weakening generateCandidates()'s guard for normal
// first-time callers. Never touches primitives/cleanedGeometry (Phase B
// output), never re-reads the ACSM/SVG, never touches any other floor's
// records, and has no effect on MapPresentationModel/MapRoomOverride rows.
// Reachable only via its own explicit route — normal generateCandidates()
// behavior is completely unchanged by this addition.
async function regenerateCandidates(buildingId, floorId, importId) {
  const acsm = await normalizationService.getAcsm(buildingId, floorId, importId);

  const record = await geometryModelRepository.findByNormalizedBlueprintId(acsm.id);

  if (!record) {
    const error = new Error("Geometry model not found for this blueprint import");
    error.statusCode = 404;
    throw error;
  }

  const topology = buildTopology(record.cleanedGeometry, snapToleranceFor(acsm));
  const { candidateObjects, warnings } = classifyGeometry(record.cleanedGeometry, topology);
  const relationships = buildRelationships(candidateObjects, record.cleanedGeometry, topology);

  const regeneratedAt = new Date().toISOString();

  const diagnostics = {
    ...record.diagnostics,
    topologyNodeCount: topology.nodes.length,
    topologyEdgeCount: topology.edges.length,
    connectedComponents: topology.connectedComponents.length,
    closedBoundaries: topology.closedBoundaries.length,
    candidateCount: countCandidates(candidateObjects),
    relationshipCount: relationships.length,
    boundaryCount: candidateObjects.candidateBoundaries.length,
    enclosureCount: candidateObjects.candidateEnclosures.length,
    wallCount: candidateObjects.candidateWalls.length,
    openingCount: candidateObjects.candidateOpenings.length,
    passageCount: candidateObjects.candidatePassages.length,
    verticalConnectionCount: candidateObjects.candidateVerticalConnections.length,
    candidatesGeneratedAt: regeneratedAt,
    // Audit trail distinct from candidatesGeneratedAt (which always reflects
    // only the CURRENT candidates' timestamp) -- this accumulates every
    // explicit regeneration this GeometryModel has ever gone through.
    regenerationHistory: [...(record.diagnostics.regenerationHistory || []), regeneratedAt],
    warnings: [...record.diagnostics.warnings, ...warnings],
  };

  const updated = await geometryModelRepository.update(record.id, {
    topology,
    candidateObjects,
    relationships,
    diagnostics,
  });

  return toGeometryModel(updated, acsm.metadata);
}

module.exports = {
  extractGeometry,
  getGeometryModel,
  generateCandidates,
  regenerateCandidates,
};
