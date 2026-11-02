// Auto-extract integration — sends a floor's current blueprint file to the
// Atlas Extract service (separate Python/FastAPI app) and persists the result
// (rooms as a Map Presentation Model + nodes/edges as a navigation graph) so
// the admin only has to verify, not author. The extractor returns coordinates
// already in the blueprint's own units, so the shapes drop straight into the
// MPM/graph the client renders.
const { prisma } = require("../../../../config/database");
const blueprintImportRepo = require("../../../../repositories/blueprintImport/blueprintImport.repository");
const mpmRepo = require("../../../../repositories/mapPresentationModel/mapPresentationModel.repository");
const storage = require("../../processing/storage/storage");
const floorRepository = require("../../../../repositories/floor/floor.repository");

const EXTRACT_URL = process.env.EXTRACT_URL || "http://localhost:5600";
const PIPELINE_VERSION = "auto-extract-0.1";

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Ask the Python extractor to process a blueprint file buffer.
async function callExtractor(buffer, filename) {
  const form = new FormData();
  form.append("file", new Blob([buffer]), filename);
  let res;
  try {
    res = await fetch(`${EXTRACT_URL}/extract`, { method: "POST", body: form });
  } catch (cause) {
    throw httpError(
      `Atlas Extract service is unreachable at ${EXTRACT_URL} — is it running?`,
      503
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw httpError(`Extractor failed (${res.status}): ${detail}`.trim(), 502);
  }
  return res.json();
}

// Persist the extractor's atlas payload: a new map model (rooms/labels) and a
// navigation graph with positioned nodes + distance-weighted edges.
async function persist(buildingId, floorId, atlas) {
  const nextVersion =
    ((await mpmRepo.findMaxVersion(floorId))?._max?.version ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    const mpm = await tx.mapPresentationModel.create({
      data: {
        floorId,
        version: nextVersion,
        status: "GENERATED",
        data: {
          coordinateSystem: atlas.coordinateSystem,
          rooms: atlas.rooms,
          labels: atlas.labels,
          source: "auto-extract",
        },
      },
    });

    const graph = await tx.navigationGraph.create({
      data: {
        buildingId,
        floorId,
        status: "READY",
        pipelineVersion: PIPELINE_VERSION,
      },
    });

    // Create nodes and capture their real ids so edges can be remapped from the
    // extractor's temporary ids (n1, n2, …).
    const idMap = new Map();
    for (const node of atlas.graph.nodes) {
      const created = await tx.navigationNode.create({
        data: {
          graphId: graph.id,
          source: "MANUAL",
          nodeType: node.nodeType,
          position: node.position,
          metadata: node.label ? { label: node.label } : {},
        },
      });
      idMap.set(node.id, created.id);
    }

    // Walkways are two-way: persist both directed rows (as the manual authoring
    // does) so routing can traverse them in either direction.
    const edgeRows = [];
    for (const edge of atlas.graph.edges) {
      const s = idMap.get(edge.sourceNodeId);
      const t = idMap.get(edge.targetNodeId);
      if (!s || !t) continue;
      const cost = edge.traversalCost ?? 1;
      const type = edge.edgeType || "WALKWAY";
      edgeRows.push({ graphId: graph.id, sourceNodeId: s, targetNodeId: t, edgeType: type, traversalCost: cost });
      edgeRows.push({ graphId: graph.id, sourceNodeId: t, targetNodeId: s, edgeType: type, traversalCost: cost });
    }
    if (edgeRows.length) {
      await tx.navigationEdge.createMany({ data: edgeRows });
    }

    return { mapModelId: mpm.id, mapModelVersion: nextVersion, graphId: graph.id };
  });
}

async function autoExtractFloor(buildingId, floorId) {
  const floor = await floorRepository.findById(floorId);
  if (!floor || floor.buildingId !== buildingId) {
    throw httpError("Floor not found", 404);
  }

  const imports = await blueprintImportRepo.findAllByFloorId(floorId);
  if (!imports || imports.length === 0) {
    throw httpError("No blueprint uploaded for this floor yet", 400);
  }
  const current = imports.reduce((a, b) => (b.version > a.version ? b : a));

  const buffer = await storage.read(current.storageKey);
  const { report, flags, atlas } = await callExtractor(
    buffer,
    current.originalFilename
  );

  const persisted = await persist(buildingId, floorId, atlas);

  return { report, flags, ...persisted };
}

module.exports = { autoExtractFloor };
