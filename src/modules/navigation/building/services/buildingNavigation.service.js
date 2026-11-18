// M3 — Building-level navigation. Two reads, no writes:
//   getBuildingNavigation — aggregate the whole building for the client in one
//     payload: every floor's PUBLISHED graph (visitors never see drafts) plus
//     the transition graph's connectors and confirmed VERTICAL pairs. Storage
//     stays one MPM per floor — this is read-time aggregation only.
//   computeBuildingRoute — Dijkstra over the joined floors (assembler links
//     connectors into each floor's walkway net), answering with the path split
//     into per-floor segments and explicit "take the lift up" transition steps.
const buildingRepository = require("../../../../repositories/building/building.repository");
const floorRepository = require("../../../../repositories/floor/floor.repository");
const mpmRepository = require("../../../../repositories/mapPresentationModel/mapPresentationModel.repository");
const navigationGraphRepository = require("../../../../repositories/navigationGraph/navigationGraph.repository");
const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const navigationEdgeRepository = require("../../../../repositories/navigationEdge/navigationEdge.repository");
const graphPreparation = require("../../routing/pipeline/graph-preparation");
const dijkstraEngine = require("../../routing/pipeline/dijkstra-engine");
const { assembleBuildingGraph } = require("../pipeline/building-graph-assembler");

const ALGORITHM_NAME = "dijkstra";
// Discriminator of the per-building transition graph (M2'a).
const TRANSITION_PIPELINE_VERSION = "multi-floor-transition-0.1";
const PREFERENCES = new Set(["AVOID_STAIRS", "PREFER_ELEVATORS"]);

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Load everything route/bundle needs. Floors keep their level order; a floor
// without a published map model contributes graph: null (listed so the client
// can show it exists, but unroutable). Tombstoned connectors (admin removed a
// detection — metadata.hidden) are filtered here so no consumer sees them.
async function loadBuilding(buildingId) {
  const building = await buildingRepository.findById(buildingId);
  if (!building) {
    throw httpError("Building not found", 404);
  }

  const floors = await floorRepository.findAllByBuildingId(buildingId);
  const floorEntries = [];
  for (const floor of [...floors].sort((a, b) => (a.level ?? 0) - (b.level ?? 0))) {
    const mpm = await mpmRepository.findLatestPublishedByFloorId(floor.id);
    const graph = mpm?.data?.graph || null;
    floorEntries.push({
      floorId: floor.id,
      level: floor.level ?? null,
      name: floor.name || null,
      mapModelId: mpm?.id ?? null,
      mapModelVersion: mpm?.version ?? null,
      navigationGraphId: graph?.navigationGraphId ?? null,
      graph,
    });
  }

  let connectors = [];
  let transitions = [];
  const graphs = await navigationGraphRepository.findAll({
    buildingId,
    floorId: null,
    pipelineVersion: TRANSITION_PIPELINE_VERSION,
  });
  const transitionGraph = graphs[0] || null;
  if (transitionGraph) {
    const nodes = await navigationNodeRepository.findAllByGraphId(transitionGraph.id);
    const visible = nodes.filter((n) => !(n.metadata && n.metadata.hidden));
    const visibleIds = new Set(visible.map((n) => n.id));
    connectors = visible.map((n) => ({
      id: n.id,
      floorId: n.floorId,
      nodeType: n.nodeType,
      position: n.position,
      label: (n.metadata && n.metadata.label) || null,
      source: n.source,
    }));
    const edges = await navigationEdgeRepository.findAllByGraphId(transitionGraph.id);
    transitions = edges
      .filter(
        (e) =>
          e.edgeType === "VERTICAL" &&
          visibleIds.has(e.sourceNodeId) &&
          visibleIds.has(e.targetNodeId)
      )
      .map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        traversalCost: e.traversalCost,
      }));
  }

  return { building, floorEntries, connectors, transitions };
}

async function getBuildingNavigation(buildingId) {
  const { building, floorEntries, connectors, transitions } = await loadBuilding(buildingId);
  return {
    buildingId: building.id,
    buildingName: building.name || null,
    floors: floorEntries,
    connectors,
    transitions,
  };
}

// Group the flat node-id path into consecutive same-floor runs, and emit one
// transition step per confirmed VERTICAL hop (consecutive connector nodes on
// different floors).
function splitPathByFloor(path, meta, floorEntries) {
  const levelByFloor = new Map(floorEntries.map((f) => [f.floorId, f.level]));
  const segments = [];
  const transitions = [];
  for (let i = 0; i < path.length; i += 1) {
    const info = meta.get(path[i]);
    const floorId = info?.floorId ?? null;
    const last = segments[segments.length - 1];
    if (!last || last.floorId !== floorId) {
      segments.push({ floorId, path: [path[i]] });
    } else {
      last.path.push(path[i]);
    }

    if (i === 0) continue;
    const prev = meta.get(path[i - 1]);
    if (
      prev?.kind === "connector" &&
      info?.kind === "connector" &&
      prev.floorId !== info.floorId
    ) {
      const fromLevel = levelByFloor.get(prev.floorId) ?? null;
      const toLevel = levelByFloor.get(info.floorId) ?? null;
      transitions.push({
        fromFloorId: prev.floorId,
        toFloorId: info.floorId,
        fromLevel,
        toLevel,
        connectorType: prev.nodeType,
        label: prev.label || info.label || null,
        direction:
          fromLevel != null && toLevel != null
            ? toLevel > fromLevel
              ? "up"
              : "down"
            : null,
        levels:
          fromLevel != null && toLevel != null ? Math.abs(toLevel - fromLevel) : null,
      });
    }
  }
  return { segments, transitions };
}

async function computeBuildingRoute(buildingId, body = {}) {
  const { originNodeId, destinationNodeId, preference = null } = body;
  if (!originNodeId || !destinationNodeId) {
    throw httpError("originNodeId and destinationNodeId are required", 400);
  }
  if (originNodeId === destinationNodeId) {
    throw httpError("Origin and Destination must not be the same node", 400);
  }
  if (preference !== null && !PREFERENCES.has(preference)) {
    throw httpError(
      "preference must be AVOID_STAIRS or PREFER_ELEVATORS when provided",
      400
    );
  }

  const { floorEntries, connectors, transitions } = await loadBuilding(buildingId);
  const { nodes, edges, meta } = assembleBuildingGraph({
    floorEntries,
    connectors,
    transitions,
    preference,
  });

  if (!meta.has(originNodeId)) {
    throw httpError("Origin node not found in this building's published maps", 400);
  }
  if (!meta.has(destinationNodeId)) {
    throw httpError("Destination node not found in this building's published maps", 400);
  }

  const adjacency = graphPreparation.buildAdjacencyList(nodes, edges);
  const result = dijkstraEngine.computeShortestPath(
    adjacency,
    originNodeId,
    destinationNodeId
  );

  // No route is a valid answer (e.g. floors not linked yet) — 200 with an
  // empty path, consistent with the per-floor compute endpoint.
  if (!result) {
    return {
      buildingId,
      originNodeId,
      destinationNodeId,
      preference,
      path: [],
      totalCost: null,
      segments: [],
      transitions: [],
      algorithm: ALGORITHM_NAME,
      computedAt: new Date().toISOString(),
    };
  }

  const split = splitPathByFloor(result.path, meta, floorEntries);
  return {
    buildingId,
    originNodeId,
    destinationNodeId,
    preference,
    path: result.path,
    totalCost: result.totalCost,
    segments: split.segments,
    transitions: split.transitions,
    algorithm: ALGORITHM_NAME,
    computedAt: new Date().toISOString(),
  };
}

module.exports = { getBuildingNavigation, computeBuildingRoute };
