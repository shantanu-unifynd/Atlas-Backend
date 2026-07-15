const buildingService = require("../services/building.service");
const { successResponse } = require("../../../common/utils/apiResponse");

async function createBuilding(req, res, next) {
  try {
    const building = await buildingService.createBuilding(req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Building created successfully",
      data: building,
    });
  } catch (error) {
    next(error);
  }
}

async function getBuildings(req, res, next) {
  try {
    const buildings = await buildingService.getAllBuildings();
    return successResponse(res, {
      statusCode: 200,
      message: "Buildings fetched successfully",
      data: buildings,
    });
  } catch (error) {
    next(error);
  }
}

async function getBuildingById(req, res, next) {
  try {
    const building = await buildingService.getBuildingById(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Building fetched successfully",
      data: building,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBuilding,
  getBuildings,
  getBuildingById,
};
