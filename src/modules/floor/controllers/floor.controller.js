const floorService = require("../services/floor.service");
const { successResponse } = require("../../../common/utils/apiResponse");

function createFloor(req, res, next) {
  try {
    const floor = floorService.createFloor(req.params.buildingId, req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Floor created successfully",
      data: floor,
    });
  } catch (error) {
    next(error);
  }
}

function getFloors(req, res, next) {
  try {
    const floors = floorService.getFloorsByBuildingId(req.params.buildingId);
    return successResponse(res, {
      statusCode: 200,
      message: "Floors fetched successfully",
      data: floors,
    });
  } catch (error) {
    next(error);
  }
}

function getFloorById(req, res, next) {
  try {
    const floor = floorService.getFloorById(
      req.params.buildingId,
      req.params.floorId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Floor fetched successfully",
      data: floor,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createFloor,
  getFloors,
  getFloorById,
};
