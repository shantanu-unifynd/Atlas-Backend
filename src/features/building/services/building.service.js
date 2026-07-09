const crypto = require("crypto");
const Building = require("../models/building.model");

const buildings = [];

function validateBuildingInput(data) {
  const errors = [];

  if (!data.name) errors.push("name is required");
  if (!data.city) errors.push("city is required");
  if (!data.country) errors.push("country is required");
  if (!data.timezone) errors.push("timezone is required");

  return errors;
}

function createBuilding(data) {
  const errors = validateBuildingInput(data);

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const building = new Building({
    id: crypto.randomUUID(),
    name: data.name,
    address: data.address,
    city: data.city,
    country: data.country,
    timezone: data.timezone,
    createdAt: new Date().toISOString(),
  });

  buildings.push(building);

  return building;
}

function getAllBuildings() {
  return buildings;
}

function getBuildingById(id) {
  const building = buildings.find((b) => b.id === id);

  if (!building) {
    const error = new Error("Building not found");
    error.statusCode = 404;
    throw error;
  }

  return building;
}

module.exports = {
  createBuilding,
  getAllBuildings,
  getBuildingById,
};
