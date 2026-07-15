const { prisma } = require("../config/database");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return UUID_REGEX.test(id);
}

// -- Geometry <-> WKT/GeoJSON -----------------------------------------------
// SpatialObject/GraphNode/GraphEdge geometry columns are PostGIS-native
// (Unsupported("geometry...") in schema.prisma), so Prisma's typed client
// can never read or write them. Every geometry-bearing table is therefore
// persisted via raw SQL, translating to/from WKT and GeoJSON at the
// boundary so nothing outside this repository ever sees SQL, WKT or GeoJSON.

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

// -- NavigationGraph ---------------------------------------------------------
// No geometry column on this table, so plain Prisma Client is sufficient.

function createGraph(data) {
  return prisma.navigationGraph.create({ data });
}

function findGraphByBlueprintId(blueprintId) {
  return prisma.navigationGraph.findUnique({ where: { blueprintId } });
}

function findGraphById(id) {
  if (!isValidUuid(id)) {
    return null;
  }

  return prisma.navigationGraph.findUnique({ where: { id } });
}

// -- GraphNode ---------------------------------------------------------------
// No dedicated endpoint exists yet (graph generation is a future story); these
// exist so the repository fully owns GraphNode persistence as required, ready
// for that future story to call.

function mapNodeRow(row) {
  return {
    id: row.id,
    graphId: row.graph_id,
    spatialObjectId: row.spatial_object_id,
    geometry: geoJsonToGeometry(JSON.parse(row.geometry_geojson)),
    nodeType: row.node_type,
    floorLevel: row.floor_level,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createNode(data) {
  const wkt = pointToWKT(data.geometry.coordinates);
  const metadata = JSON.stringify(data.metadata || {});

  const rows = await prisma.$queryRaw`
    INSERT INTO graph_nodes (
      id, graph_id, spatial_object_id, geometry, node_type, floor_level,
      metadata, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), ${data.graphId}::uuid, ${data.spatialObjectId || null}::uuid,
      ST_GeomFromText(${wkt}, 0), ${data.nodeType}, ${data.floorLevel},
      ${metadata}::jsonb, now(), now()
    )
    RETURNING
      id, graph_id, spatial_object_id, ST_AsGeoJSON(geometry) AS geometry_geojson,
      node_type, floor_level, metadata, created_at, updated_at
  `;

  return mapNodeRow(rows[0]);
}

async function findNodesByGraphId(graphId) {
  const rows = await prisma.$queryRaw`
    SELECT
      id, graph_id, spatial_object_id, ST_AsGeoJSON(geometry) AS geometry_geojson,
      node_type, floor_level, metadata, created_at, updated_at
    FROM graph_nodes
    WHERE graph_id = ${graphId}::uuid
    ORDER BY created_at ASC
  `;

  return rows.map(mapNodeRow);
}

async function findNodeById(id) {
  if (!isValidUuid(id)) {
    return null;
  }

  const rows = await prisma.$queryRaw`
    SELECT
      id, graph_id, spatial_object_id, ST_AsGeoJSON(geometry) AS geometry_geojson,
      node_type, floor_level, metadata, created_at, updated_at
    FROM graph_nodes
    WHERE id = ${id}::uuid
  `;

  return rows[0] ? mapNodeRow(rows[0]) : null;
}

// -- GraphEdge ----------------------------------------------------------------
// Same rationale as GraphNode: no endpoint yet, persistence owned here.

function mapEdgeRow(row) {
  return {
    id: row.id,
    graphId: row.graph_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    geometry: geoJsonToGeometry(JSON.parse(row.geometry_geojson)),
    length: row.length,
    estimatedTime: row.estimated_time,
    edgeType: row.edge_type,
    accessible: row.accessible,
    oneWay: row.one_way,
    stairs: row.stairs,
    elevator: row.elevator,
    weight: row.weight,
    cost: row.cost,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createEdge(data) {
  const wkt = lineToWKT(data.geometry.coordinates);
  const metadata = JSON.stringify(data.metadata || {});

  const rows = await prisma.$queryRaw`
    INSERT INTO graph_edges (
      id, graph_id, from_node_id, to_node_id, geometry, length, estimated_time,
      edge_type, accessible, one_way, stairs, elevator, weight, cost,
      metadata, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), ${data.graphId}::uuid, ${data.fromNodeId}::uuid, ${data.toNodeId}::uuid,
      ST_GeomFromText(${wkt}, 0), ${data.length ?? null}, ${data.estimatedTime ?? null},
      ${data.edgeType}, ${data.accessible ?? true}, ${data.oneWay ?? false},
      ${data.stairs ?? false}, ${data.elevator ?? false}, ${data.weight ?? 1}, ${data.cost ?? null},
      ${metadata}::jsonb, now(), now()
    )
    RETURNING
      id, graph_id, from_node_id, to_node_id, ST_AsGeoJSON(geometry) AS geometry_geojson,
      length, estimated_time, edge_type, accessible, one_way, stairs, elevator,
      weight, cost, metadata, created_at, updated_at
  `;

  return mapEdgeRow(rows[0]);
}

async function findEdgesByGraphId(graphId) {
  const rows = await prisma.$queryRaw`
    SELECT
      id, graph_id, from_node_id, to_node_id, ST_AsGeoJSON(geometry) AS geometry_geojson,
      length, estimated_time, edge_type, accessible, one_way, stairs, elevator,
      weight, cost, metadata, created_at, updated_at
    FROM graph_edges
    WHERE graph_id = ${graphId}::uuid
    ORDER BY created_at ASC
  `;

  return rows.map(mapEdgeRow);
}

async function findEdgeById(id) {
  if (!isValidUuid(id)) {
    return null;
  }

  const rows = await prisma.$queryRaw`
    SELECT
      id, graph_id, from_node_id, to_node_id, ST_AsGeoJSON(geometry) AS geometry_geojson,
      length, estimated_time, edge_type, accessible, one_way, stairs, elevator,
      weight, cost, metadata, created_at, updated_at
    FROM graph_edges
    WHERE id = ${id}::uuid
  `;

  return rows[0] ? mapEdgeRow(rows[0]) : null;
}

module.exports = {
  createObject,
  findObjectById,
  findObjectsByBlueprintId,
  createGraph,
  findGraphByBlueprintId,
  findGraphById,
  createNode,
  findNodesByGraphId,
  findNodeById,
  createEdge,
  findEdgesByGraphId,
  findEdgeById,
};
