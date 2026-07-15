const { Prisma } = require("@prisma/client");
const Floor = require("../models/floor.model");
const floorRepository = require("../../../repositories/floor/floor.repository");
const buildingRepository = require("../../../repositories/building/building.repository");

function validateFloorInput(data) {
  const errors = [];

  if (!data.name) errors.push("name is required");
  if (data.level === undefined || data.level === null || data.level === "") {
    errors.push("level is required");
  }

  return errors;
}

function toFloor(record) {
  return new Floor({
    id: record.id,
    buildingId: record.buildingId,
    name: record.name,
    level: record.level,
    blueprint: null,
    status: record.status,
    createdAt: record.createdAt,
  });
}

async function ensureBuildingExists(buildingId) {
  const building = await buildingRepository.findById(buildingId);

  if (!building) {
    const error = new Error("Building not found");
    error.statusCode = 404;
    throw error;
  }

  return building;
}

async function createFloor(buildingId, data) {
  await ensureBuildingExists(buildingId);

  const errors = validateFloorInput(data);

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  try {
    const record = await floorRepository.create({
      buildingId,
      name: data.name,
      level: data.level,
    });

    return toFloor(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const conflict = new Error("A floor with this level already exists for this building");
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
}

async function getFloorsByBuildingId(buildingId) {
  await ensureBuildingExists(buildingId);

  const records = await floorRepository.findAllByBuildingId(buildingId);

  return records.map(toFloor);
}

async function getFloorById(buildingId, floorId) {
  await ensureBuildingExists(buildingId);

  const record = await floorRepository.findById(floorId);

  if (!record || record.buildingId !== buildingId) {
    const error = new Error("Floor not found");
    error.statusCode = 404;
    throw error;
  }

  return toFloor(record);
}

async function getFloorByIdOnly(floorId) {
  const record = await floorRepository.findById(floorId);

  if (!record) {
    const error = new Error("Floor not found");
    error.statusCode = 404;
    throw error;
  }

  return toFloor(record);
}

module.exports = {
  createFloor,
  getFloorsByBuildingId,
  getFloorById,
  getFloorByIdOnly,
};
