const buildingService = require("../services/building.service");
const { successResponse } = require("../../../common/utils/apiResponse");

function createBuilding(req, res, next) {
  try {
    const building = buildingService.createBuilding(req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Building created successfully",
      data: building,
    });
  } catch (error) {
    next(error);
  }
}

function getBuildings(req, res, next) {
  try {
    const buildings = buildingService.getAllBuildings();
    return successResponse(res, {
      statusCode: 200,
      message: "Buildings fetched successfully",
      data: buildings,
    });
  } catch (error) {
    next(error);
  }
}

function getBuildingById(req, res, next) {
  try {
    const building = buildingService.getBuildingById(req.params.id);
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
