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
const roomTombstoneRepository = require("../../../../repositories/roomTombstone/roomTombstone.repository");
const { suppressedRoomIds, filterMpmData, roomCentroid, roomArea, matchTombstone } = require("../pipeline/room-tombstones");
const { tombstoneMatchTolerances, SYSTEM_ACTOR } = require("../../../../config/roomRemoval");

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

  // Option A — on a floor with no blueprint-geometry sources (e.g. shop-gap
  // auto-extract), fall back to the latest auto-extract MPM as the base. Without
  // this, a re-generate on every override save produces an empty, coordinate-less
  // map and the editor blanks. With it, the coordinate system + polygon rooms are
  // carried forward and the manual-override merge below layers edits on top.
  const baseMpm = sources
    ? null
    : await mapPresentationModelRepository.findLatestAutoExtractByFloorId(floorId);
  const baseData = baseMpm && baseMpm.data ? baseMpm.data : null;

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
  } else if (baseData && Array.isArray(baseData.rooms) && baseData.rooms.length) {
    // Option A — seed the generated rooms from the auto-extract base. Keeping the
    // base rooms (with their original ids) means the manual-override merge below
    // (replacesRoomId / suppressesRoomIds) resolves exactly as it would over
    // freshly generated rooms, so edits layer on top instead of a blank map.
    const baseRooms = baseData.rooms;
    roomResult = {
      rooms: baseRooms,
      stats: {
        roomCount: baseRooms.length,
        polygonRooms: baseRooms.filter((r) => r.polygon).length,
        pointRooms: baseRooms.filter((r) => !r.polygon).length,
      },
    };
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
  // Dropped generated rooms = every replacesRoomId plus every id listed in an
  // override's suppressesRoomIds (MME-06 merge: the merged room replaces one
  // source room and suppresses the other).
  const replacedRoomIds = new Set(overrides.filter((o) => o.replacesRoomId).map((o) => o.replacesRoomId));
  for (const o of overrides) {
    if (Array.isArray(o.suppressesRoomIds)) {
      for (const id of o.suppressesRoomIds) replacedRoomIds.add(id);
    }
  }
  roomResult.rooms = roomResult.rooms.filter((r) => !replacedRoomIds.has(r.id)).concat(manualRooms);
  roomResult.stats.manualRooms = manualRooms.length;
  roomResult.stats.roomCount = roomResult.rooms.length;

  // "Remove room" tombstones — drop removed rooms via the shared predicate (exact
  // id, else best-effort geometry match). Applied on every rebuild so removal
  // survives re-generate/re-extraction. Labels derive from the filtered set
  // below, so a removed room's label disappears automatically. Unmatched
  // tombstones are logged (never silent) and surfaced by the removed-rooms API.
  let tombstoneMeta = null;
  const activeTombstones = await roomTombstoneRepository.findActiveByFloorId(floorId);
  if (activeTombstones.length) {
    const { ids, unmatched } = suppressedRoomIds(roomResult.rooms, activeTombstones, tombstoneMatchTolerances);
    if (ids.size) roomResult.rooms = roomResult.rooms.filter((r) => !ids.has(r.id));
    roomResult.stats.roomCount = roomResult.rooms.length;
    roomResult.stats.tombstonedRooms = ids.size;
    tombstoneMeta = {
      suppressed: ids.size,
      unmatched: unmatched.map((u) => ({ roomId: u.roomId, reason: u.reason })),
    };
    if (unmatched.length) {
      console.warn(
        `[room-tombstones] floor ${floorId}: ${unmatched.length} tombstone(s) could not be matched`,
        tombstoneMeta.unmatched,
      );
    }
  }

  // MPM-04: walls, openings, labels (all in the canonical world space).
  const primitivesById = new Map(normalizedGeometry.primitives.map((p) => [p.id, p]));
  const candidateObjects = sources ? sources.geometry.candidateObjects || {} : {};
  const walls = sources
    ? extractWalls(primitivesById, candidateObjects.candidateWalls)
    : baseData && Array.isArray(baseData.walls)
      ? baseData.walls
      : [];
  const openings = sources
    ? extractOpenings(primitivesById, candidateObjects.candidateOpenings, candidateObjects.candidatePassages)
    : baseData && Array.isArray(baseData.openings)
      ? baseData.openings
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
      ...(tombstoneMeta ? { tombstones: tombstoneMeta } : {}), // "Remove room" audit of this bake
    },
    // MPM-02: one canonical world coordinate system (ACSM bounds) + geometry
    // primitives transformed into it. Only normalized coordinates are stored.
    coordinateSystem:
      normalizedGeometry.coordinateSystem || (baseData ? baseData.coordinateSystem : null),
    geometry: { primitives: normalizedGeometry.primitives },
    rooms: roomResult.rooms, // MPM-03 — polygons (SEMANTIC) + point fallbacks
    walls, // MPM-04 — normalized polylines
    openings, // MPM-04 — doors/passages as points
    labels, // MPM-04 — room-derived labels (world coords, associated to rooms)
    graph: graphData || (baseData ? baseData.graph : null), // nav graph output, or carried from base
  };

  const record = await mapPresentationModelRepository.create({
    floorId,
    version,
    status: "GENERATED",
    navigationGraphId: (graph ? graph.id : null) || (baseMpm ? baseMpm.navigationGraphId : null),
    data,
  });

  return toModel(record);
}

async function getByFloorId(floorId, { published = false } = {}) {
  await ensureFloorExists(floorId);

  // Default: the latest version, whatever its status. published=true: the
  // floor's single live (published) version. "No model yet" is a VALID state
  // for an existing floor (not a missing resource), so it resolves to null —
  // the controller returns 200 with data:null and browsers stop logging a
  // red 404 on every fresh floor (ui-bug-sweep #6). An unknown floor still
  // 404s via ensureFloorExists above.
  const record = published
    ? await mapPresentationModelRepository.findLatestPublishedByFloorId(floorId)
    : await mapPresentationModelRepository.findLatestByFloorId(floorId);

  // Read-time tombstone filter (shared predicate). Kept even when the removal
  // flag is off so existing tombstones stay respected, and so a tombstone made
  // AFTER publish hides immediately — not only after the next republish.
  if (record && record.data) {
    const tombstones = await roomTombstoneRepository.findActiveByFloorId(floorId);
    const { data } = filterMpmData(record.data, tombstones, tombstoneMatchTolerances);
    record.data = data;
  }

  return record ? toModel(record) : null;
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
    inStoreConnectors: Array.isArray(o.inStoreConnectors) ? o.inStoreConnectors : [],
    // Part 3D — two-floor shop link. Null unitId = normal single-floor room.
    unitId: o.unitId || null,
    linkedRoomIds: Array.isArray(o.linkedRoomIds) ? o.linkedRoomIds : [],
  };
}

// Part 3D — validate a two-floor-shop link: linkedRoomIds is an array of room id
// strings (room ids the shop continues into on other floors).
function isValidLinkedRoomIds(list) {
  return Array.isArray(list) && list.every((id) => typeof id === "string" && id.length > 0);
}

// Part 3C — validate the in-store connector list: each { kind, ring }, kind one
// of stairs/escalator/lift, ring a polygon of >= 3 numeric points.
function isValidConnectors(list) {
  if (!Array.isArray(list)) return false;
  const kinds = new Set(["stairs", "escalator", "lift"]);
  return list.every(
    (c) =>
      c &&
      kinds.has(c.kind) &&
      Array.isArray(c.ring) &&
      c.ring.length >= 3 &&
      c.ring.every((p) => p && typeof p.x === "number" && typeof p.y === "number") &&
      // Part 3D — optional per-connector gate for public pass-through routing.
      (c.publicPassThrough === undefined || typeof c.publicPassThrough === "boolean")
  );
}

async function createRoomOverride(floorId, body = {}) {
  await ensureFloorExists(floorId);
  const { name, category, polygon, area, replacesRoomId, suppressesRoomIds, inStoreConnectors, unitId, linkedRoomIds } = body;
  if (!isValidPolygon(polygon)) {
    throw validationError("polygon must be an array of >= 3 points with numeric x and y");
  }
  if (unitId !== undefined && unitId !== null && typeof unitId !== "string") {
    throw validationError("unitId must be a string or null");
  }
  if (linkedRoomIds !== undefined && !isValidLinkedRoomIds(linkedRoomIds)) {
    throw validationError("linkedRoomIds must be an array of room id strings");
  }
  if (
    suppressesRoomIds !== undefined &&
    (!Array.isArray(suppressesRoomIds) || suppressesRoomIds.some((id) => typeof id !== "string"))
  ) {
    throw validationError("suppressesRoomIds must be an array of room id strings");
  }
  if (inStoreConnectors !== undefined && !isValidConnectors(inStoreConnectors)) {
    throw validationError(
      "inStoreConnectors must be an array of { kind: stairs|escalator|lift, ring: [>=3 points] }"
    );
  }
  const override = await mapRoomOverrideRepository.create({
    floorId,
    name: name || null,
    category: category || null,
    polygon,
    area: area != null ? area : polygonArea(polygon),
    replacesRoomId: replacesRoomId || null,
    suppressesRoomIds: suppressesRoomIds || [],
    inStoreConnectors: inStoreConnectors || [],
    unitId: unitId || null,
    linkedRoomIds: linkedRoomIds || [],
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
  if (body.inStoreConnectors !== undefined) {
    if (!isValidConnectors(body.inStoreConnectors)) {
      throw validationError("inStoreConnectors must be an array of { kind, ring }");
    }
    data.inStoreConnectors = body.inStoreConnectors;
  }
  if (body.unitId !== undefined) {
    if (body.unitId !== null && typeof body.unitId !== "string") {
      throw validationError("unitId must be a string or null");
    }
    data.unitId = body.unitId || null;
  }
  if (body.linkedRoomIds !== undefined) {
    if (!isValidLinkedRoomIds(body.linkedRoomIds)) {
      throw validationError("linkedRoomIds must be an array of room id strings");
    }
    data.linkedRoomIds = body.linkedRoomIds;
  }
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

// --- "Remove room" (soft-delete tombstone + undo) ---

// Soft-delete one room. Idempotent: a second call while already removed returns
// the existing tombstone. Snapshots the room (audit + restore display) and its
// geometry fingerprint, then regenerates so the draft reflects the removal.
// Single-room by design; a bulk caller can loop over this.
async function removeRoom(floorId, roomId, { reason = null, actor = SYSTEM_ACTOR } = {}) {
  await ensureFloorExists(floorId);
  const already = await roomTombstoneRepository.findActiveByFloorAndRoom(floorId, roomId);
  if (already) return { tombstone: already, alreadyRemoved: true };

  const latest = await mapPresentationModelRepository.findLatestByFloorId(floorId);
  const rooms = (latest && latest.data && Array.isArray(latest.data.rooms) && latest.data.rooms) || [];
  const room = rooms.find((r) => r.id === roomId);
  if (!room) throw validationError("Room not found in the current map model");

  const c = roomCentroid(room);
  const tombstone = await roomTombstoneRepository.create({
    floorId,
    roomId,
    roomKind: roomId.startsWith("room-manual-") ? "MANUAL" : "AUTO",
    centroidX: c ? c.x : null,
    centroidY: c ? c.y : null,
    area: roomArea(room),
    roomSnapshot: room,
    reason,
    deletedBy: actor,
  });
  const mpm = await generate(floorId);
  return { tombstone, mpmVersion: mpm.version };
}

// Undo a removal. Idempotent: returns { restored:false, reason:"not_removed" }
// if the room was not actively removed. After clearing the tombstone it
// regenerates; if the source room no longer exists (e.g. re-extracted away) the
// result says so explicitly rather than silently succeeding.
async function restoreRoom(floorId, roomId, { actor = SYSTEM_ACTOR } = {}) {
  await ensureFloorExists(floorId);
  const active = await roomTombstoneRepository.findActiveByFloorAndRoom(floorId, roomId);
  if (!active) return { restored: false, reason: "not_removed" };

  await roomTombstoneRepository.restore(active.id, actor, new Date());
  const mpm = await generate(floorId);
  const rooms = (mpm && mpm.data && mpm.data.rooms) || [];
  const back = matchTombstone(active, rooms, tombstoneMatchTolerances).status === "matched";
  return back
    ? { restored: true, mpmVersion: mpm.version }
    : { restored: false, reason: "source_room_no_longer_exists", mpmVersion: mpm.version };
}

// The removed-rooms list for the admin "undo" drawer. `unmatched` surfaces
// tombstones the last bake could not resolve (re-extraction renumber /
// ambiguous), so a removal never fails silently.
async function listRemovedRooms(floorId) {
  await ensureFloorExists(floorId);
  const tombstones = await roomTombstoneRepository.findActiveByFloorId(floorId);
  const latest = await mapPresentationModelRepository.findLatestByFloorId(floorId);
  const unmatched = (latest && latest.data && latest.data.metadata && latest.data.metadata.tombstones
    && latest.data.metadata.tombstones.unmatched) || [];
  const unmatchedById = new Map(unmatched.map((u) => [u.roomId, u.reason]));
  return tombstones.map((t) => ({
    id: t.id,
    roomId: t.roomId,
    roomKind: t.roomKind,
    name: (t.roomSnapshot && t.roomSnapshot.name) || null,
    reason: t.reason,
    deletedBy: t.deletedBy,
    deletedAt: t.deletedAt,
    unmatched: unmatchedById.has(t.roomId),
    matchReason: unmatchedById.get(t.roomId) || null,
  }));
}

module.exports = {
  generate,
  getByFloorId,
  publish,
  createRoomOverride,
  updateRoomOverride,
  deleteRoomOverride,
  listRoomOverrides,
  removeRoom,
  restoreRoom,
  listRemovedRooms,
};
