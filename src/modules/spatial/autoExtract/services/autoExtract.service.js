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
// Multi-floor (M2'a): one graph per building, floorId = null, holds the
// vertical-connector nodes from every floor plus the VERTICAL edges that link
// them across floors (per-floor graphs can't hold a cross-floor edge). This
// pipelineVersion is the discriminator that identifies it.
const TRANSITION_PIPELINE_VERSION = "multi-floor-transition-0.1";

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

// Persist the floor's detected vertical connectors (stairs/lifts/escalators)
// into the building's transition graph so they can later be paired across
// floors. Detection-only here: each node's position is the TEXT-LABEL anchor
// (not the shaft centre) and no VERTICAL edges are created — pairing is the
// admin-confirmed step M2'b (fully automatic pairing proved unreliable).
//
// Idempotent per floor: a re-extraction drops this floor's existing connector
// nodes (cascade removes any VERTICAL edges on them) and re-inserts from the
// fresh result. NOTE for M2'b: that wipes admin pairings for the re-extracted
// floor — M2'b must re-pair or preserve unmoved connectors on re-extract.
async function persistConnectors(tx, buildingId, floorId, connectors) {
  if (!connectors || connectors.length === 0) {
    return { connectorGraphId: null, connectorsPersisted: 0 };
  }

  let graph = await tx.navigationGraph.findFirst({
    where: {
      buildingId,
      floorId: null,
      pipelineVersion: TRANSITION_PIPELINE_VERSION,
    },
  });
  if (!graph) {
    graph = await tx.navigationGraph.create({
      data: {
        buildingId,
        floorId: null,
        status: "READY",
        pipelineVersion: TRANSITION_PIPELINE_VERSION,
        metadata: { kind: "transition" },
      },
    });
  }

  // Preserve anything the admin authored or corrected on this floor across a
  // re-extraction: manually added connectors (source MANUAL), retyped ones, and
  // tombstoned removals (both carry metadata.adminEdited). Only the untouched
  // AUTO connectors are refreshed from the new extraction.
  const existing = await tx.navigationNode.findMany({
    where: { graphId: graph.id, floorId },
  });
  const isAdminTouched = (n) =>
    n.source === "MANUAL" || (n.metadata && n.metadata.adminEdited);
  const preserved = existing.filter(isAdminTouched);
  const refreshableIds = existing.filter((n) => !isAdminTouched(n)).map((n) => n.id);
  if (refreshableIds.length > 0) {
    await tx.navigationNode.deleteMany({ where: { id: { in: refreshableIds } } });
  }

  // Skip a freshly detected connector that coincides with a preserved node: it
  // is already represented (a retype at that spot) or was deliberately removed
  // (a tombstone), so re-adding it would duplicate or resurrect it. Same-shaft
  // connectors land within a few px; 40 source units is a generous radius.
  const COINCIDE_RADIUS = 40;
  const coincidesWithPreserved = (c) =>
    preserved.some(
      (p) =>
        p.position &&
        Math.hypot(p.position.x - c.position.x, p.position.y - c.position.y) <=
          COINCIDE_RADIUS
    );

  const rows = connectors
    .filter((c) => !coincidesWithPreserved(c))
    .map((c) => ({
      graphId: graph.id,
      floorId,
      source: "AUTO",
      nodeType: c.type,
      position: c.position,
      metadata: {
        label: c.label || null,
        connectorId: c.id,
        detection: "label-anchor",
      },
    }));
  if (rows.length > 0) {
    await tx.navigationNode.createMany({ data: rows });
  }

  return { connectorGraphId: graph.id, connectorsPersisted: rows.length };
}

// Persist the extractor's atlas payload: a new map model (rooms/labels) and a
// navigation graph with positioned nodes + distance-weighted edges.
async function persist(buildingId, floorId, atlas) {
  const nextVersion =
    ((await mpmRepo.findMaxVersion(floorId))?._max?.version ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    // Graph first so the map model can link to it — a published MPM without
    // navigationGraphId makes the client show "Wayfinding isn't available".
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
    const createdNodes = [];
    for (const node of atlas.graph.nodes) {
      const created = await tx.navigationNode.create({
        data: {
          graphId: graph.id,
          source: "AUTO",
          nodeType: node.nodeType,
          position: node.position,
          metadata: node.label ? { label: node.label } : {},
        },
      });
      idMap.set(node.id, created.id);
      createdNodes.push(created);
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
    const createdEdges = await tx.navigationEdge.findMany({ where: { graphId: graph.id } });

    // The client renders ENTIRELY from the MPM payload, so the graph must be
    // embedded in data.graph in the same shape mapModel.service emits —
    // without it WayfindingPage shows "Wayfinding isn't available".
    const graphData = {
      navigationGraphId: graph.id,
      status: graph.status,
      nodes: createdNodes.map((n) => ({
        id: n.id,
        type: n.nodeType,
        position: n.position,
        label: (n.metadata && n.metadata.label) || null,
      })),
      edges: createdEdges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        cost: e.traversalCost,
      })),
    };

    const mpm = await tx.mapPresentationModel.create({
      data: {
        floorId,
        version: nextVersion,
        status: "GENERATED",
        navigationGraphId: graph.id,
        data: {
          coordinateSystem: atlas.coordinateSystem,
          rooms: atlas.rooms,
          labels: atlas.labels,
          graph: graphData,
          source: "auto-extract",
        },
      },
    });

    // Same transaction as the floor graph/MPM so a floor never lands half
    // persisted. atlas.connectors is the M0 extractor output (may be empty).
    const connResult = await persistConnectors(
      tx,
      buildingId,
      floorId,
      atlas.connectors
    );

    return {
      mapModelId: mpm.id,
      mapModelVersion: nextVersion,
      graphId: graph.id,
      ...connResult,
    };
  });
}

// P4 Phase 3 — carry the admin's walkway nudges (P4) onto a freshly re-extracted
// graph so a re-extraction doesn't silently wipe them. Each re-extraction writes
// a NEW per-floor graph, so admin-touched edges on the previous graph must be
// re-applied here. The plan is identical on re-extract, so endpoints are remapped
// by POSITION: a nudge edge's endpoints map to the new graph's nearest nodes, a
// re-created manual node maps directly. Best-effort and isolated (own
// transaction, called inside a try/catch) so a failure can never break the
// extraction itself.
const CARRY_RADIUS = 50; // source units — endpoints should land near-exactly

async function preserveAdminWalkwayEdits(prevGraphId, newGraphId) {
  if (!prevGraphId || prevGraphId === newGraphId) return { carried: 0 };

  return prisma.$transaction(async (tx) => {
    const [prevNodes, prevEdges, newNodes] = await Promise.all([
      tx.navigationNode.findMany({ where: { graphId: prevGraphId } }),
      tx.navigationEdge.findMany({ where: { graphId: prevGraphId } }),
      tx.navigationNode.findMany({ where: { graphId: newGraphId } }),
    ]);

    const isAdminEdge = (e) =>
      (e.metadata && e.metadata.source === "MANUAL") || (e.metadata && e.metadata.hidden);
    const adminEdges = prevEdges.filter(isAdminEdge);
    if (adminEdges.length === 0) return { carried: 0 };

    const prevById = new Map(prevNodes.map((n) => [n.id, n]));
    const nearestNew = (pos) => {
      if (!pos) return null;
      let best = null;
      let bd = Infinity;
      for (const n of newNodes) {
        if (!n.position) continue;
        const d = Math.hypot(n.position.x - pos.x, n.position.y - pos.y);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      return best && bd <= CARRY_RADIUS ? best : null;
    };

    // Re-create any admin-authored MANUAL nodes on the new graph (the current
    // nudge tool only adds edges between existing nodes, but handle nodes too).
    const remap = new Map();
    for (const mn of prevNodes.filter((n) => n.source === "MANUAL")) {
      const created = await tx.navigationNode.create({
        data: {
          graphId: newGraphId,
          source: "MANUAL",
          nodeType: mn.nodeType,
          position: mn.position,
          floorId: mn.floorId ?? null,
          metadata: mn.metadata || {},
        },
      });
      remap.set(mn.id, created.id);
    }

    const resolve = (oldId) => {
      if (remap.has(oldId)) return remap.get(oldId);
      const near = nearestNew(prevById.get(oldId)?.position);
      return near ? near.id : null;
    };

    const newEdges = await tx.navigationEdge.findMany({ where: { graphId: newGraphId } });
    const newEdgeByPair = new Map(newEdges.map((e) => [`${e.sourceNodeId}->${e.targetNodeId}`, e]));

    let carried = 0;
    for (const e of adminEdges) {
      const s = resolve(e.sourceNodeId);
      const t = resolve(e.targetNodeId);
      if (!s || !t || s === t) continue;

      if (e.metadata && e.metadata.hidden) {
        // Admin removed this AUTO edge → re-hide the matching fresh AUTO edge so
        // the stray stays trimmed.
        const match = newEdgeByPair.get(`${s}->${t}`);
        if (match && !(match.metadata && match.metadata.hidden)) {
          await tx.navigationEdge.update({
            where: { id: match.id },
            data: { metadata: { ...(match.metadata || {}), hidden: true, adminEdited: true } },
          });
          carried += 1;
        }
      } else if (!newEdgeByPair.has(`${s}->${t}`)) {
        // Admin-added MANUAL walkway → re-create it (skip if already present).
        await tx.navigationEdge.create({
          data: {
            graphId: newGraphId,
            sourceNodeId: s,
            targetNodeId: t,
            edgeType: e.edgeType || "WALKWAY",
            length: e.length ?? null,
            traversalCost: e.traversalCost ?? 1,
            accessibility: e.accessibility || {},
            metadata: { ...(e.metadata || {}), source: "MANUAL", carriedForward: true },
          },
        });
        carried += 1;
      }
    }

    return { carried };
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

  // Capture the floor's current auto graph BEFORE persist creates the new one,
  // so we can carry the admin's nudges forward onto the fresh graph.
  const prevGraph = await prisma.navigationGraph.findFirst({
    where: { floorId, pipelineVersion: PIPELINE_VERSION },
    orderBy: { createdAt: "desc" },
  });

  const persisted = await persist(buildingId, floorId, atlas);

  let nudgesCarried = 0;
  try {
    const result = await preserveAdminWalkwayEdits(prevGraph?.id || null, persisted.graphId);
    nudgesCarried = result.carried;
  } catch (err) {
    // Non-fatal: extraction already succeeded; just log that preservation failed.
    // eslint-disable-next-line no-console
    console.error("preserveAdminWalkwayEdits failed (non-fatal):", err?.message);
  }

  return { report, flags, ...persisted, nudgesCarried };
}

module.exports = { autoExtractFloor };
