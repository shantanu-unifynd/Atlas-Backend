const crypto = require("crypto");
const Floor = require("../models/floor.model");
const buildingService = require("../../building/services/building.service");

const floors = [];

function validateFloorInput(data) {
  const errors = [];

  if (!data.name) errors.push("name is required");
  if (data.level === undefined || data.level === null || data.level === "") {
    errors.push("level is required");
  }

  return errors;
}

function createFloor(buildingId, data) {
  buildingService.getBuildingById(buildingId);

  const errors = validateFloorInput(data);

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const floor = new Floor({
    id: crypto.randomUUID(),
    buildingId,
    name: data.name,
    level: data.level,
    blueprint: null,
    status: "draft",
    createdAt: new Date().toISOString(),
  });

  floors.push(floor);

  return floor;
}

function getFloorsByBuildingId(buildingId) {
  buildingService.getBuildingById(buildingId);

  return floors.filter((floor) => floor.buildingId === buildingId);
}

function getFloorById(buildingId, floorId) {
  buildingService.getBuildingById(buildingId);

  const floor = floors.find(
    (f) => f.buildingId === buildingId && f.id === floorId
  );

  if (!floor) {
    const error = new Error("Floor not found");
    error.statusCode = 404;
    throw error;
  }

  return floor;
}

function getFloorByIdOnly(floorId) {
  const floor = floors.find((f) => f.id === floorId);

  if (!floor) {
    const error = new Error("Floor not found");
    error.statusCode = 404;
    throw error;
  }

  return floor;
}

module.exports = {
  createFloor,
  getFloorsByBuildingId,
  getFloorById,
  getFloorByIdOnly,
};
