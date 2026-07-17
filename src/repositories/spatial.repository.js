const { prisma } = require("../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return UUID_REGEX.test(id);
}

// -- Geometry <-> WKT/GeoJSON -----------------------------------------------
// SpatialObject's geometry column is PostGIS-native (Unsupported("geometry...")
// in schema.prisma), so Prisma's typed client can never read or write it.
// It is therefore persisted via raw SQL, translating to/from WKT and GeoJSON
// at the boundary so nothing outside this repository ever sees SQL, WKT or
// GeoJSON.

function pointToWKT(point) {
  return `POINT(${point.x} ${point.y})`;
}

function lineToWKT(points) {
  return `LINESTRING(${points.map((p) => `${p.x} ${p.y}`).join(", ")})`;
}

function polygonToWKT(points) {
  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first.x !== last.x || first.y !== last.y) {
    ring.push(first);
  }

  return `POLYGON((${ring.map((p) => `${p.x} ${p.y}`).join(", ")}))`;
}

function geometryToWKT(geometry) {
  if (geometry.type === "Point") return pointToWKT(geometry.coordinates);
  if (geometry.type === "Line") return lineToWKT(geometry.coordinates);
  if (geometry.type === "Polygon") return polygonToWKT(geometry.coordinates);
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

function geoJsonToGeometry(geoJson) {
  if (geoJson.type === "Point") {
    const [x, y] = geoJson.coordinates;
    return { type: "Point", coordinates: { x, y } };
  }

  if (geoJson.type === "LineString") {
    return {
      type: "Line",
      coordinates: geoJson.coordinates.map(([x, y]) => ({ x, y })),
    };
  }

  if (geoJson.type === "Polygon") {
    const ring = geoJson.coordinates[0].map(([x, y]) => ({ x, y }));
    const first = ring[0];
    const last = ring[ring.length - 1];

    if (ring.length > 1 && first.x === last.x && first.y === last.y) {
      ring.pop();
    }

    return { type: "Polygon", coordinates: ring };
  }

  throw new Error(`Unsupported GeoJSON type: ${geoJson.type}`);
}

// -- SpatialObject -----------------------------------------------------------
// metadata carries properties/relationships/state alongside the caller's own
// metadata, namespaced so they can never collide with it; this is purely an
// internal storage-format decision, invisible to callers.

function mapObjectRow(row) {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    category: row.category,
    type: row.type,
    subtype: row.subtype,
    name: row.name,
    code: row.code,
    geometry: geoJsonToGeometry(JSON.parse(row.geometry_geojson)),
    geometryType: row.geometry_type,
    level: row.level,
    properties: row.metadata.properties,
    relationships: row.metadata.relationships,
    state: row.metadata.state,
    metadata: row.metadata.custom,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createObject(data) {
  const wkt = geometryToWKT(data.geometry);
  const storedMetadata = JSON.stringify({
    properties: data.properties || {},
    relationships: data.relationships || [],
    state: data.state,
    custom: data.metadata || {},
  });

  const rows = await prisma.$queryRaw`
    INSERT INTO spatial_objects (
      id, blueprint_id, category, type, subtype, name, code,
      geometry, geometry_type, level, metadata, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), ${data.blueprintId}::uuid,
      ${data.category}::spatial_object_category, ${data.type}::spatial_object_type,
      ${data.subtype || null}, ${data.name || null}, ${data.code || null},
      ST_GeomFromText(${wkt}, 0), ${data.geometryType}::geometry_type, ${data.level},
      ${storedMetadata}::jsonb, now(), now()
    )
    RETURNING
      id, blueprint_id, category, type, subtype, name, code,
      ST_AsGeoJSON(geometry) AS geometry_geojson, geometry_type, level,
      metadata, created_at, updated_at
  `;

  return mapObjectRow(rows[0]);
}

async function findObjectById(id) {
  if (!isValidUuid(id)) {
    return null;
  }

  const rows = await prisma.$queryRaw`
    SELECT
      id, blueprint_id, category, type, subtype, name, code,
      ST_AsGeoJSON(geometry) AS geometry_geojson, geometry_type, level,
      metadata, created_at, updated_at
    FROM spatial_objects
    WHERE id = ${id}::uuid
  `;

  return rows[0] ? mapObjectRow(rows[0]) : null;
}

async function findObjectsByBlueprintId(blueprintId) {
  const rows = await prisma.$queryRaw`
    SELECT
      id, blueprint_id, category, type, subtype, name, code,
      ST_AsGeoJSON(geometry) AS geometry_geojson, geometry_type, level,
      metadata, created_at, updated_at
    FROM spatial_objects
    WHERE blueprint_id = ${blueprintId}::uuid
    ORDER BY created_at ASC
  `;

  return rows.map(mapObjectRow);
}

// -- LegacyNavigationGraph -----------------------------------------------------
// Sprint 03 Story 03's original graph container, kept only because it is
// still exposed live via POST/GET /api/blueprints/:blueprintId/graph. Its
// GraphNode/GraphEdge child tables were confirmed dead (no service,
// controller, or route ever created/read a row in either) and were dropped
// entirely in the Sprint 06 Story 01 architectural refactor — Atlas's
// canonical Navigation Graph domain now lives in
// src/repositories/navigationGraph|navigationNode|navigationEdge. No geometry
// column on this table, so plain Prisma Client is sufficient.

function createGraph(data) {
  return prisma.legacyNavigationGraph.create({ data });
}

function findGraphByBlueprintId(blueprintId) {
  return prisma.legacyNavigationGraph.findUnique({ where: { blueprintId } });
}

function findGraphById(id) {
  if (!isValidUuid(id)) {
    return null;
  }

  return prisma.legacyNavigationGraph.findUnique({ where: { id } });
}

module.exports = {
  createObject,
  findObjectById,
  findObjectsByBlueprintId,
  createGraph,
  findGraphByBlueprintId,
  findGraphById,
};
