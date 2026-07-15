const { Prisma } = require("@prisma/client");
const Blueprint = require("../models/blueprint.model");
const blueprintRepository = require("../../../../repositories/blueprint/blueprint.repository");
const floorRepository = require("../../../../repositories/floor/floor.repository");
const assetRepository = require("../../../../repositories/asset/asset.repository");

function toBlueprint(record) {
  return new Blueprint({
    id: record.id,
    floorId: record.floorId,
    assetId: record.assetId,
    status: record.status,
    dimensions: { width: record.width, height: record.height },
    calibration: {
      scale: record.scale,
      rotation: record.rotation,
      origin: { x: record.originX, y: record.originY },
    },
    coordinateSystem: { type: "local" },
    layers: [],
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

async function ensureFloorExists(floorId) {
  const floor = await floorRepository.findById(floorId);

  if (!floor) {
    const error = new Error("Floor not found");
    error.statusCode = 404;
    throw error;
  }

  return floor;
}

async function ensureAssetExists(assetId) {
  const asset = await assetRepository.findById(assetId);

  if (!asset) {
    const error = new Error("Asset not found");
    error.statusCode = 404;
    throw error;
  }

  return asset;
}

async function createBlueprint(floorId, data) {
  await ensureFloorExists(floorId);

  if (!data.assetId) {
    const error = new Error("assetId is required");
    error.statusCode = 400;
    throw error;
  }

  const asset = await ensureAssetExists(data.assetId);

  if (asset.floorId !== floorId) {
    const error = new Error("Asset does not belong to this floor");
    error.statusCode = 400;
    throw error;
  }

  const existing = await blueprintRepository.findByFloorId(floorId);

  if (existing) {
    const error = new Error("Floor already has a blueprint");
    error.statusCode = 409;
    throw error;
  }

  try {
    const record = await blueprintRepository.create({
      floorId,
      assetId: data.assetId,
    });

    return toBlueprint(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const conflict = new Error("Floor already has a blueprint");
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
}

async function getBlueprintByFloorId(floorId) {
  await ensureFloorExists(floorId);

  const record = await blueprintRepository.findByFloorId(floorId);

  if (!record) {
    const error = new Error("Blueprint not found");
    error.statusCode = 404;
    throw error;
  }

  return toBlueprint(record);
}

async function getBlueprintById(blueprintId) {
  const record = await blueprintRepository.findById(blueprintId);

  if (!record) {
    const error = new Error("Blueprint not found");
    error.statusCode = 404;
    throw error;
  }

  return toBlueprint(record);
}

module.exports = {
  createBlueprint,
  getBlueprintByFloorId,
  getBlueprintById,
};
