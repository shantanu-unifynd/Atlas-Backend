const SpatialObject = require("../models/object.model");
const blueprintService = require("../../blueprint/services/blueprint.service");
const floorRepository = require("../../../../repositories/floor/floor.repository");
const spatialRepository = require("../../../../repositories/spatial.repository");

const SUPPORTED_TYPES = [
  "wall",
  "door",
  "room",
  "store",
  "stairs",
  "elevator",
  "escalator",
  "washroom",
  "fire-exit",
  "atm",
  "parking",
  "poi",
];

const SUPPORTED_LAYERS = [
  "Architecture",
  "Navigation",
  "Accessibility",
  "Emergency",
  "Annotation",
  "Events",
  "Maintenance",
];

const SUPPORTED_STATES = ["enabled", "disabled"];

const SUPPORTED_GEOMETRY_TYPES = ["Point", "Line", "Polygon"];

// Bridges the API's long-established vocabulary (lowercase/hyphenated type,
// Title-case layer) to the Prisma enums introduced by the spatial schema.
// Kept here (not in the repository) because the mapping is a business/domain
// decision about what old values mean in the new type system.
const TYPE_TO_PRISMA_TYPE = {
  wall: "WALL",
  door: "DOOR",
  room: "ROOM",
  store: "STORE",
  stairs: "STAIR",
  elevator: "ELEVATOR",
  escalator: "ESCALATOR",
  washroom: "WASHROOM",
  "fire-exit": "FIRE_EXIT",
  atm: "ATM",
  parking: "PARKING_SPACE",
  poi: "POI",
};

const PRISMA_TYPE_TO_TYPE = Object.fromEntries(
  Object.entries(TYPE_TO_PRISMA_TYPE).map(([type, prismaType]) => [prismaType, type])
);

function toTitleCase(value) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidPoint(point) {
  return (
    point &&
    typeof point === "object" &&
    isFiniteNumber(point.x) &&
    isFiniteNumber(point.y)
  );
}

function validateGeometry(geometry) {
  if (!geometry || typeof geometry !== "object") {
    return "geometry is required";
  }

  if (!SUPPORTED_GEOMETRY_TYPES.includes(geometry.type)) {
    return `geometry.type must be one of: ${SUPPORTED_GEOMETRY_TYPES.join(", ")}`;
  }

  if (geometry.type === "Point" && !isValidPoint(geometry.coordinates)) {
    return "Point geometry requires coordinates: { x: number, y: number }";
  }

  if (
    geometry.type === "Line" &&
    (!Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2 ||
      !geometry.coordinates.every(isValidPoint))
  ) {
    return "Line geometry requires coordinates as an array of at least 2 { x, y } points";
  }

  if (
    geometry.type === "Polygon" &&
    (!Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 3 ||
      !geometry.coordinates.every(isValidPoint))
  ) {
    return "Polygon geometry requires coordinates as an array of at least 3 { x, y } points";
  }

  return null;
}

function validateObjectInput(data) {
  const errors = [];

  if (!SUPPORTED_TYPES.includes(data.type)) {
    errors.push(`type must be one of: ${SUPPORTED_TYPES.join(", ")}`);
  }

  if (!SUPPORTED_LAYERS.includes(data.layer)) {
    errors.push(`layer must be one of: ${SUPPORTED_LAYERS.join(", ")}`);
  }

  if (!SUPPORTED_STATES.includes(data.state)) {
    errors.push(`state must be one of: ${SUPPORTED_STATES.join(", ")}`);
  }

  if (data.relationships !== undefined && !Array.isArray(data.relationships)) {
    errors.push("relationships must be an array");
  }

  const geometryError = validateGeometry(data.geometry);
  if (geometryError) {
    errors.push(geometryError);
  }

  return errors;
}

function toSpatialObject(record) {
  return new SpatialObject({
    id: record.id,
    blueprintId: record.blueprintId,
    type: PRISMA_TYPE_TO_TYPE[record.type],
    name: record.name,
    geometry: record.geometry,
    layer: toTitleCase(record.category),
    properties: record.properties,
    relationships: record.relationships,
    state: record.state,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

async function createObject(blueprintId, data) {
  const blueprint = await blueprintService.getBlueprintById(blueprintId);

  const errors = validateObjectInput(data);

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const floor = await floorRepository.findById(blueprint.floorId);

  const record = await spatialRepository.createObject({
    blueprintId,
    category: data.layer.toUpperCase(),
    type: TYPE_TO_PRISMA_TYPE[data.type],
    geometry: data.geometry,
    geometryType: data.geometry.type.toUpperCase(),
    level: floor.level,
    name: data.name || null,
    properties: data.properties || {},
    relationships: data.relationships || [],
    state: data.state,
    metadata: data.metadata || {},
  });

  return toSpatialObject(record);
}

async function getObjectsByBlueprintId(blueprintId) {
  await blueprintService.getBlueprintById(blueprintId);

  const records = await spatialRepository.findObjectsByBlueprintId(blueprintId);

  return records.map(toSpatialObject);
}

async function getObjectById(objectId) {
  const record = await spatialRepository.findObjectById(objectId);

  if (!record) {
    const error = new Error("Spatial Object not found");
    error.statusCode = 404;
    throw error;
  }

  return toSpatialObject(record);
}

module.exports = {
  createObject,
  getObjectsByBlueprintId,
  getObjectById,
};
