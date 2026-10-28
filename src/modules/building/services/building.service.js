const crypto = require("crypto");
const Building = require("../models/building.model");
const buildingRepository = require("../../../repositories/building/building.repository");

function validateBuildingInput(data) {
  const errors = [];

  if (!data.name) errors.push("name is required");
  if (!data.city) errors.push("city is required");
  if (!data.country) errors.push("country is required");
  if (!data.timezone) errors.push("timezone is required");

  return errors;
}

function toBuilding(record) {
  return new Building({
    id: record.id,
    name: record.name,
    address: record.address || undefined,
    city: record.city,
    country: record.country,
    timezone: record.timezone,
    status: record.status,
    floorCount: record._count ? record._count.floors : undefined,
    createdAt: record.createdAt,
  });
}

async function createBuilding(data) {
  const errors = validateBuildingInput(data);

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const record = await buildingRepository.create({
    code: crypto.randomUUID(),
    name: data.name,
    address: data.address || "",
    city: data.city,
    country: data.country,
    timezone: data.timezone,
  });

  return toBuilding(record);
}

async function getAllBuildings() {
  const records = await buildingRepository.findAll();

  return records.map(toBuilding);
}

async function getBuildingById(id) {
  const record = await buildingRepository.findById(id);

  if (!record) {
    const error = new Error("Building not found");
    error.statusCode = 404;
    throw error;
  }

  return toBuilding(record);
}

async function updateBuilding(id, data) {
  const existing = await buildingRepository.findById(id);

  if (!existing) {
    const error = new Error("Building not found");
    error.statusCode = 404;
    throw error;
  }

  const merged = {
    name: data.name !== undefined ? data.name : existing.name,
    address: data.address !== undefined ? data.address : existing.address,
    city: data.city !== undefined ? data.city : existing.city,
    country: data.country !== undefined ? data.country : existing.country,
    timezone: data.timezone !== undefined ? data.timezone : existing.timezone,
  };

  const errors = validateBuildingInput(merged);

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const record = await buildingRepository.update(id, {
    name: merged.name,
    address: merged.address || "",
    city: merged.city,
    country: merged.country,
    timezone: merged.timezone,
  });

  return toBuilding(record);
}

async function deleteBuilding(id) {
  const existing = await buildingRepository.findById(id);

  if (!existing) {
    const error = new Error("Building not found");
    error.statusCode = 404;
    throw error;
  }

  await buildingRepository.remove(id);
}

module.exports = {
  createBuilding,
  getAllBuildings,
  getBuildingById,
  updateBuilding,
  deleteBuilding,
};
