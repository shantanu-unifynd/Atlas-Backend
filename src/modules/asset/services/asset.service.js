const crypto = require("crypto");
const Asset = require("../models/asset.model");
const floorService = require("../../floor/services/floor.service");

const assets = [];

function createAsset(floorId, file) {
  floorService.getFloorByIdOnly(floorId);

  if (!file) {
    const error = new Error("file is required");
    error.statusCode = 400;
    throw error;
  }

  const asset = new Asset({
    id: crypto.randomUUID(),
    floorId,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    type: "blueprint",
  });

  assets.push(asset);

  return asset;
}

function getAssetById(assetId) {
  const asset = assets.find((a) => a.id === assetId);

  if (!asset) {
    const error = new Error("Asset not found");
    error.statusCode = 404;
    throw error;
  }

  return asset;
}

module.exports = {
  createAsset,
  getAssetById,
};
