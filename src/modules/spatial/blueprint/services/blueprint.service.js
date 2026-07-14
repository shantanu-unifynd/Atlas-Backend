const crypto = require("crypto");
const Blueprint = require("../models/blueprint.model");
const floorService = require("../../../floor/services/floor.service");
const assetService = require("../../../asset/services/asset.service");

const blueprints = [];

function createBlueprint(floorId, data) {
  floorService.getFloorByIdOnly(floorId);

  if (!data.assetId) {
    const error = new Error("assetId is required");
    error.statusCode = 400;
    throw error;
  }

  const asset = assetService.getAssetById(data.assetId);

  if (asset.floorId !== floorId) {
    const error = new Error("Asset does not belong to this floor");
    error.statusCode = 400;
    throw error;
  }

  const existing = blueprints.find((b) => b.floorId === floorId);

  if (existing) {
    const error = new Error("Floor already has a blueprint");
    error.statusCode = 409;
    throw error;
  }

  const now = new Date().toISOString();

  const blueprint = new Blueprint({
    id: crypto.randomUUID(),
    floorId,
    assetId: data.assetId,
    status: "pending",
    dimensions: { width: null, height: null },
    calibration: { scale: null, rotation: 0, origin: { x: 0, y: 0 } },
    coordinateSystem: { type: "local" },
    layers: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  blueprints.push(blueprint);

  return blueprint;
}

function getBlueprintByFloorId(floorId) {
  floorService.getFloorByIdOnly(floorId);

  const blueprint = blueprints.find((b) => b.floorId === floorId);

  if (!blueprint) {
    const error = new Error("Blueprint not found");
    error.statusCode = 404;
    throw error;
  }

  return blueprint;
}

function getBlueprintById(blueprintId) {
  const blueprint = blueprints.find((b) => b.id === blueprintId);

  if (!blueprint) {
    const error = new Error("Blueprint not found");
    error.statusCode = 404;
    throw error;
  }

  return blueprint;
}

module.exports = {
  createBlueprint,
  getBlueprintByFloorId,
  getBlueprintById,
};
