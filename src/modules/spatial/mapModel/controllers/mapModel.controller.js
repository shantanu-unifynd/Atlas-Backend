const mapModelService = require("../services/mapModel.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function generateMapModel(req, res, next) {
  try {
    const model = await mapModelService.generate(req.params.floorId);
    return successResponse(res, {
      statusCode: 201,
      message: "Map presentation model generated successfully",
      data: model,
    });
  } catch (error) {
    next(error);
  }
}

async function getMapModel(req, res, next) {
  try {
    const model = await mapModelService.getByFloorId(req.params.floorId);
    return successResponse(res, {
      statusCode: 200,
      message: "Map presentation model fetched successfully",
      data: model,
    });
  } catch (error) {
    next(error);
  }
}

async function listRoomOverrides(req, res, next) {
  try {
    const overrides = await mapModelService.listRoomOverrides(req.params.floorId);
    return successResponse(res, { statusCode: 200, message: "Room overrides fetched successfully", data: overrides });
  } catch (error) {
    next(error);
  }
}

async function createRoomOverride(req, res, next) {
  try {
    const result = await mapModelService.createRoomOverride(req.params.floorId, req.body);
    return successResponse(res, { statusCode: 201, message: "Room override created successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function updateRoomOverride(req, res, next) {
  try {
    const result = await mapModelService.updateRoomOverride(req.params.floorId, req.params.overrideId, req.body);
    return successResponse(res, { statusCode: 200, message: "Room override updated successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function deleteRoomOverride(req, res, next) {
  try {
    const result = await mapModelService.deleteRoomOverride(req.params.floorId, req.params.overrideId);
    return successResponse(res, { statusCode: 200, message: "Room override deleted successfully", data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateMapModel,
  getMapModel,
  listRoomOverrides,
  createRoomOverride,
  updateRoomOverride,
  deleteRoomOverride,
};
