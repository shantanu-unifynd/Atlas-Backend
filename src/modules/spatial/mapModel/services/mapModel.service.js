const MapPresentationModel = require("../models/mapPresentationModel.model");
const floorRepository = require("../../../../repositories/floor/floor.repository");
const mapPresentationModelRepository = require("../../../../repositories/mapPresentationModel/mapPresentationModel.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");
const blueprintImportRepository = require("../../../../repositories/blueprintImport/blueprintImport.repository");
const normalizedBlueprintRepository = require("../../../../repositories/normalizedBlueprint/normalizedBlueprint.repository");
const geometryModelRepository = require("../../../../repositories/geometryModel/geometryModel.repository");
const universalSpatialObjectRepository = require("../../../../repositories/universalSpatialObject/universalSpatialObject.repository");
const semanticModelRepository = require("../../../../repositories/semanticModel/semanticModel.repository");
const { normalizeGeometry } = require("../pipeline/coordinate-normalizer");
const { assembleRooms } = require("../pipeline/room-assembler");
const { extractWalls, extractOpenings, extractLabels } = require("../pipeline/feature-extractor");
const mapRoomOverrideRepository = require("../../../../repositories/mapRoomOverride/mapRoomOverride.repository");
const { canTransition, GENERATED, PUBLISHED } = require("../pipeline/lifecycle");

// MPM-01 — framework only. Assembles the model envelope: metadata + version +
// floor reference + placeholders (rooms/walls/labels) + the existing navigation
// graph output (reference + node/edge data). No coordinate normalization, no
// room/wall/label generation — those are MPM-02+.

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function toModel(record) {
  return new MapPresentationModel({
    id: record.id,
    floorId: record.floorId,
    version: record.version,
    status: record.status,
    navigationGraphId: record.navigationGraphId,
    data: record.data,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

async function ensureFloorExists(floorId) {
  const floor = await floorRepository.findById(floorId);
  if (!floor) {
    throw notFoundError("Floor not found");
  }
  return floor;
}

// Uses the floor's newest navigation graph (existing pipeline output) where
// present — the walkable network the client will overlay a route on.
async function loadGraphOutput(floorId) {
  const graphs = await navigationGraphRepository.findAll({ floorId });
  const graph = graphs.length ? graphs[graphs.length - 1] : null;
  if (!graph) {
    return { graph: null, graphData: null };
  }

  const [nodes, edges] = await Promise.all([
    navigationNodeRepository.findAllByGraphId(graph.id),
    navigationEdgeRepository.findAllByGraphId(graph.id),
  ]);

  const graphData = {
    navigationGraphId: graph.id,
    status: graph.status,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.nodeType,
      position: n.position,
      label: (n.metadata && n.metadata.label) || null,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      cost: e.traversalCost,
    })),
  };

  return { graph, graphData };
}

// Finds the floor's newest blueprint import that has a geometry model, and
// returns its geometry + ACSM (normalized blueprint) so transforms can be
// applied. Returns null when no geometry has been extracted for the floor.
async function loadGeometrySources(floorId) {
  const imports = await blueprintImportRepository.findAllByFloorId(floorId);
  for (let i = imports.length - 1; i >= 0; i -= 1) {
    // eslint-disable-next-line no-await-in-loop
    const normalized = await normalizedBlueprintRepository.findByBlueprintImportId(imports[i].id);
    if (!normalized) continue;
    // eslint-disable-next-line no-await-in-loop
    const geometry = await geometryModelRepository.findByNormalizedBlueprintId(normalized.id);
    if (geometry) {
      return { normalized, geometry };
    }
  }
  return null;
}

async function generate(floorId) {
  await ensureFloorExists(floorId);

  const { graph, graphData } = await loadGraphOutput(floorId);

  // MPM-02: normalize all geometry into one canonical world coordinate system.
  const sources = await loadGeometrySources(floorId);
  const normalizedGeometry = sources
    ? normalizeGeometry(sources.geometry, sources.normalized)
    : { coordinateSystem: null, primitives: [], stats: { primitiveCount: 0, matchedTransforms: 0 } };

  const aggregate = await mapPresentationModelRepository.findMaxVersion(floorId);
  const version = ((aggregate && aggregate._max && aggregate._max.version) || 0) + 1;

  // MPM-03: assemble room polygons from normalized geometry, associated with
  // USO/Semantic where available; labeled nodes without a polygon fall back to
  // points so generation never fails on noisy geometry.
  let roomResult = { rooms: [], stats: { roomCount: 0, polygonRooms: 0, pointRooms: 0 } };
  if (sources) {
    const geometryId = sources.geometry.id;
    const [usos, semantics] = await Promise.all([
      universalSpatialObjectRepository.findAllByGeometryModelId(geometryId),
      semanticModelRepository.findAllByGeometryModelId(geometryId),
    ]);
    const semanticByUsoId = new Map(semantics.map((s) => [s.usoId, s]));
    const usoByCandidateId = new Map(usos.map((u) => [u.candidateId, u]));
    const boundaries =
      (sources.geometry.candidateObjects && sources.geometry.candidateObjects.candidateBoundaries) || [];
    roomResult = assembleRooms({
      primitives: normalizedGeometry.primitives,
      boundaries,
      nodes: graphData ? graphData.nodes : [],
      usoByCandidateId,
      semanticByUsoId,
    });
  } else if (graphData) {
    // No geometry available — pure point fallback from the navigation nodes.
    roomResult = assembleRooms({
      primitives: [],
      boundaries: [],
      nodes: graphData.nodes,
      usoByCandidateId: new Map(),
      semanticByUsoId: new Map(),
    });
  }

  // MPM-05: merge admin room overrides (source=MANUAL) with generated rooms.
  // A MANUAL room takes precedence: if it names a generated room via
  // replacesRoomId, that generated room is dropped in favour of the override.
  const overrides = await mapRoomOverrideRepository.findAllByFloorId(floorId);
  const manualRooms = overrides.map(toManualRoom);
  const replacedRoomIds = new Set(overrides.filter((o) => o.replacesRoomId).map((o) => o.replacesRoomId));
  roomResult.rooms = roomResult.rooms.filter((r) => !replacedRoomIds.has(r.id)).concat(manualRooms);
  roomResult.stats.manualRooms = manualRooms.length;
  roomResult.stats.roomCount = roomResult.rooms.length;

  // MPM-04: walls, openings, labels (all in the canonical world space).
  const primitivesById = new Map(normalizedGeometry.primitives.map((p) => [p.id, p]));
  const candidateObjects = sources ? sources.geometry.candidateObjects || {} : {};
  const walls = sources ? extractWalls(primitivesById, candidateObjects.candidateWalls) : [];
  const openings = sources
    ? extractOpenings(primitivesById, candidateObjects.candidateOpenings, candidateObjects.candidatePassages)
    : [];
  const labels = extractLabels(roomResult.rooms);

  const data = {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "FEATURES_V4",
      counts: {
        rooms: roomResult.stats.roomCount,
        walls: walls.length,
        openings: openings.length,
        labels: labels.length,
        primitives: normalizedGeometry.stats.primitiveCount,
        nodes: graphData ? graphData.nodes.length : 0,
        edges: graphData ? graphData.edges.length : 0,
      },
      normalization: normalizedGeometry.stats, // primitiveCount + matchedTransforms
      rooms: roomResult.stats, // roomCount + polygonRooms + pointRooms
    },
    // MPM-02: one canonical world coordinate system (ACSM bounds) + geometry
    // primitives transformed into it. Only normalized coordinates are stored.
    coordinateSystem: normalizedGeometry.coordinateSystem,
    geometry: { primitives: normalizedGeometry.primitives },
    rooms: roomResult.rooms, // MPM-03 — polygons (SEMANTIC) + point fallbacks
    walls, // MPM-04 — normalized polylines
    openings, // MPM-04 — doors/passages as points
    labels, // MPM-04 — room-derived labels (world coords, associated to rooms)
    graph: graphData, // existing navigation graph output (reference + data), or null
  };

  const record = await mapPresentationModelRepository.create({
    floorId,
    version,
    status: "GENERATED",
    navigationGraphId: graph ? graph.id : null,
    data,
  });

  return toModel(record);
}

async function getByFloorId(floorId, { published = false } = {}) {
  await ensureFloorExists(floorId);

  // Default (backward compatible): the latest version, whatever its status.
  // published=true: the floor's single live (published) version.
  const record = published
    ? await mapPresentationModelRepository.findLatestPublishedByFloorId(floorId)
    : await mapPresentationModelRepository.findLatestByFloorId(floorId);
  if (!record) {
    throw notFoundError(
      published
        ? "No published map presentation model for this floor"
        : "Map presentation model has not been generated for this floor"
    );
  }

  return toModel(record);
}

// --- Sprint 07A: publish workflow ---

// Publish the floor's latest MPM version. Enforces the lifecycle guard (only a
// GENERATED draft can be published) and the single-published invariant (any
// previously published version is archived first). Version history is untouched
// — publishing only flips statuses, it never regenerates or deletes rows.
async function publish(floorId) {
  await ensureFloorExists(floorId);

  const target = await mapPresentationModelRepository.findLatestByFloorId(floorId);
  if (!target) {
    throw notFoundError("Map presentation model has not been generated for this floor");
  }

  if (!canTransition(target.status, PUBLISHED)) {
    throw validationError(
      `Cannot publish version ${target.version}: a map model in status '${target.status}' cannot transition to ${PUBLISHED}. ` +
        `Only a ${GENERATED} draft can be published — regenerate to create a new draft first.`
    );
  }

  // Single-published invariant: supersede the current live version (if any),
  // then promote the target. Superseded rows stay as history (status ARCHIVED).
  await mapPresentationModelRepository.archivePublishedByFloorId(floorId);
  const record = await mapPresentationModelRepository.updateStatus(target.id, PUBLISHED);

  return toModel(record);
}

// --- MPM-05 manual room overrides ---

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function isValidPolygon(polygon) {
  return (
    Array.isArray(polygon) &&
    polygon.length >= 3 &&
    polygon.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
  );
}

function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.round((Math.abs(a) / 2) * 100) / 100;
}

function polygonCentroid(pts) {
  const c = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: Math.round((c.x / pts.length) * 100) / 100, y: Math.round((c.y / pts.length) * 100) / 100 };
}

function toManualRoom(o) {
  const polygon = Array.isArray(o.polygon) ? o.polygon : [];
  return {
    id: `room-manual-${o.id}`,
    overrideId: o.id,
    polygon,
    centroid: polygon.length ? polygonCentroid(polygon) : null,
    area: o.area != null ? o.area : polygon.length >= 3 ? polygonArea(polygon) : null,
    category: o.category || null,
    name: o.name || null,
    source: "MANUAL",
  };
}

async function createRoomOverride(floorId, body = {}) {
  await ensureFloorExists(floorId);
  const { name, category, polygon, area, replacesRoomId } = body;
  if (!isValidPolygon(polygon)) {
    throw validationError("polygon must be an array of >= 3 points with numeric x and y");
  }
  const override = await mapRoomOverrideRepository.create({
    floorId,
    name: name || null,
    category: category || null,
    polygon,
    area: area != null ? area : polygonArea(polygon),
    replacesRoomId: replacesRoomId || null,
  });
  const mpm = await generate(floorId); // apply overrides -> new MPM version
  return { override, mpmVersion: mpm.version };
}

async function updateRoomOverride(floorId, overrideId, body = {}) {
  await ensureFloorExists(floorId);
  const existing = await mapRoomOverrideRepository.findById(overrideId);
  if (!existing || existing.floorId !== floorId) {
    throw notFoundError("Room override not found");
  }
  const data = {};
  if (body.polygon !== undefined) {
    if (!isValidPolygon(body.polygon)) throw validationError("polygon must be an array of >= 3 points");
    data.polygon = body.polygon;
    data.area = body.area != null ? body.area : polygonArea(body.polygon);
  } else if (body.area !== undefined) {
    data.area = body.area;
  }
  if (body.name !== undefined) data.name = body.name;
  if (body.category !== undefined) data.category = body.category;
  if (body.replacesRoomId !== undefined) data.replacesRoomId = body.replacesRoomId || null;
  if (Object.keys(data).length === 0) throw validationError("No updatable fields provided");

  const override = await mapRoomOverrideRepository.update(overrideId, data);
  const mpm = await generate(floorId);
  return { override, mpmVersion: mpm.version };
}

async function deleteRoomOverride(floorId, overrideId) {
  await ensureFloorExists(floorId);
  const existing = await mapRoomOverrideRepository.findById(overrideId);
  if (!existing || existing.floorId !== floorId) {
    throw notFoundError("Room override not found");
  }
  await mapRoomOverrideRepository.deleteById(overrideId);
  const mpm = await generate(floorId);
  return { mpmVersion: mpm.version };
}

async function listRoomOverrides(floorId) {
  await ensureFloorExists(floorId);
  return mapRoomOverrideRepository.findAllByFloorId(floorId);
}

module.exports = {
  generate,
  getByFloorId,
  publish,
  createRoomOverride,
  updateRoomOverride,
  deleteRoomOverride,
  listRoomOverrides,
};
