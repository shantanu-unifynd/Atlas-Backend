// BXP-08 — read-only search for a floor eligible for a genuine end-to-end
// BXP-01 face-extraction validation. STRICTLY READ-ONLY: Prisma finds only,
// zero writes, no generation calls, no production code touched.
//
// Eligibility:
//   1. Has a valid GeometryModel (cleanedGeometry present, non-empty).
//   2. candidatesGeneratedAt is NOT set (geometry.diagnostics) -- i.e.
//      generateCandidates() has never run for this floor, so the one-shot
//      guard would not block a fresh, legitimate candidate-generation call.
//   3. Reports whether the floor's cleanedGeometry contains open (non-closed)
//      primitives that share endpoints with other open primitives (the
//      "shared-wall" signature BXP-01's face-tracing exists to resolve),
//      as a secondary desirability signal, not a hard filter.
const { prisma } = require("../../../config/database");
const { buildTopology } = require("../processing/geometry/pipeline/topology-builder");

function samePoint(a, b, eps = 0.05) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

function analyzeSharedWalls(cleanedGeometry) {
  const openPrimitives = cleanedGeometry.filter((p) => !p.closed && Array.isArray(p.segments) && p.segments.length > 0);
  if (openPrimitives.length < 2) {
    return { openPrimitiveCount: openPrimitives.length, sharedEndpointPairs: 0 };
  }
  const endpoints = [];
  for (const p of openPrimitives) {
    const segs = p.segments;
    endpoints.push({ primitiveId: p.id, pt: { x: segs[0].x1, y: segs[0].y1 } });
    endpoints.push({ primitiveId: p.id, pt: { x: segs[segs.length - 1].x2, y: segs[segs.length - 1].y2 } });
  }
  let sharedPairs = 0;
  for (let i = 0; i < endpoints.length; i += 1) {
    for (let j = i + 1; j < endpoints.length; j += 1) {
      if (endpoints[i].primitiveId === endpoints[j].primitiveId) continue;
      if (samePoint(endpoints[i].pt, endpoints[j].pt)) sharedPairs += 1;
    }
  }
  return { openPrimitiveCount: openPrimitives.length, sharedEndpointPairs: sharedPairs };
}

async function findImportsWithGeometry(buildingId, floorId) {
  const imports = await prisma.blueprintImport.findMany({ where: { buildingId, floorId }, orderBy: { version: "desc" } });
  const results = [];
  for (const imp of imports) {
    // eslint-disable-next-line no-await-in-loop
    const normalized = await prisma.normalizedBlueprint.findUnique({ where: { blueprintImportId: imp.id } });
    if (!normalized) continue;
    // eslint-disable-next-line no-await-in-loop
    const geometry = await prisma.geometryModel.findUnique({ where: { normalizedBlueprintId: normalized.id } });
    if (geometry) results.push({ blueprintImport: imp, normalizedBlueprint: normalized, geometry });
  }
  return results;
}

async function main() {
  const buildings = await prisma.building.findMany({});
  console.log(`Scanning ${buildings.length} building(s)...\n`);

  const eligible = [];
  const ineligible = [];

  for (const building of buildings) {
    // eslint-disable-next-line no-await-in-loop
    const floors = await prisma.floor.findMany({ where: { buildingId: building.id } });
    for (const floor of floors) {
      // eslint-disable-next-line no-await-in-loop
      const found = await findImportsWithGeometry(building.id, floor.id);
      if (found.length === 0) {
        ineligible.push({ building: building.name, floor: floor.name, reason: "no GeometryModel at all" });
        continue;
      }
      // Use the newest import that has geometry (mirrors production loadGeometrySources order)
      const { geometry } = found[0];
      const diag = geometry.diagnostics || {};
      const candidatesGenerated = !!diag.candidatesGeneratedAt;
      const cleanedGeometry = geometry.cleanedGeometry;
      const hasCleaned = Array.isArray(cleanedGeometry) && cleanedGeometry.length > 0;

      if (!hasCleaned) {
        ineligible.push({ building: building.name, floor: floor.name, reason: "GeometryModel present but cleanedGeometry empty/invalid" });
        continue;
      }
      if (candidatesGenerated) {
        ineligible.push({ building: building.name, floor: floor.name, reason: `candidatesGeneratedAt already set (${diag.candidatesGeneratedAt})` });
        continue;
      }

      const wallAnalysis = analyzeSharedWalls(cleanedGeometry);
      let topologyNote = "n/a";
      try {
        const topo = buildTopology(cleanedGeometry);
        topologyNote = `${topo.connectedComponents.length} connected component(s)`;
      } catch (e) {
        topologyNote = `buildTopology error: ${e.message}`;
      }

      eligible.push({
        building: building.name,
        floor: floor.name,
        floorId: floor.id,
        geometryModelId: geometry.id,
        primitiveCount: cleanedGeometry.length,
        closedCount: cleanedGeometry.filter((p) => p.closed).length,
        openCount: cleanedGeometry.filter((p) => !p.closed).length,
        sharedEndpointPairs: wallAnalysis.sharedEndpointPairs,
        topologyNote,
      });
    }
  }

  console.log("=== ELIGIBLE (valid GeometryModel, candidates never generated) ===");
  if (eligible.length === 0) {
    console.log("  NONE FOUND");
  } else {
    for (const e of eligible) {
      console.log(
        `\n  ${e.building} / ${e.floor}\n` +
        `    floorId=${e.floorId} geometryModelId=${e.geometryModelId}\n` +
        `    primitives: ${e.primitiveCount} total (${e.closedCount} closed, ${e.openCount} open)\n` +
        `    open-primitive shared endpoint pairs (shared-wall signature): ${e.sharedEndpointPairs}\n` +
        `    topology: ${e.topologyNote}`
      );
    }
  }

  console.log("\n\n=== INELIGIBLE / SKIPPED (for transparency) ===");
  for (const i of ineligible) {
    console.log(`  ${i.building} / ${i.floor} -- ${i.reason}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
