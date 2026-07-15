const Asset = require("../models/asset.model");
const assetRepository = require("../../../repositories/asset/asset.repository");
const floorRepository = require("../../../repositories/floor/floor.repository");

function toAsset(record) {
  return new Asset({
    id: record.id,
    floorId: record.floorId,
    originalName: record.originalFilename,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    uploadedAt: record.uploadedAt,
    type: record.type,
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

async function createAsset(floorId, file) {
  await ensureFloorExists(floorId);

  if (!file) {
    const error = new Error("file is required");
    error.statusCode = 400;
    throw error;
  }

  const record = await assetRepository.create({
    floorId,
    type: "blueprint",
    filename: file.filename,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    objectKey: file.filename,
  });

  return toAsset(record);
}

async function getAssetById(assetId) {
  const record = await assetRepository.findById(assetId);

  if (!record) {
    const error = new Error("Asset not found");
    error.statusCode = 404;
    throw error;
  }

  return toAsset(record);
}

module.exports = {
  createAsset,
  getAssetById,
};
