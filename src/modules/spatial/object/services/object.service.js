const crypto = require("crypto");
const SpatialObject = require("../models/object.model");
const blueprintService = require("../../blueprint/services/blueprint.service");

const objects = [];

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

async function createObject(blueprintId, data) {
  await blueprintService.getBlueprintById(blueprintId);

  const errors = validateObjectInput(data);

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();

  const object = new SpatialObject({
    id: crypto.randomUUID(),
    blueprintId,
    type: data.type,
    name: data.name || null,
    geometry: data.geometry,
    layer: data.layer,
    properties: data.properties || {},
    relationships: data.relationships || [],
    state: data.state,
    metadata: data.metadata || {},
    createdAt: now,
    updatedAt: now,
  });

  objects.push(object);

  return object;
}

async function getObjectsByBlueprintId(blueprintId) {
  await blueprintService.getBlueprintById(blueprintId);

  return objects.filter((object) => object.blueprintId === blueprintId);
}

function getObjectById(objectId) {
  const object = objects.find((o) => o.id === objectId);

  if (!object) {
    const error = new Error("Spatial Object not found");
    error.statusCode = 404;
    throw error;
  }

  return object;
}

module.exports = {
  createObject,
  getObjectsByBlueprintId,
  getObjectById,
};
