const objectService = require("../services/object.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

function createObject(req, res, next) {
  try {
    const object = objectService.createObject(
      req.params.blueprintId,
      req.body
    );
    return successResponse(res, {
      statusCode: 201,
      message: "Spatial Object created successfully",
      data: object,
    });
  } catch (error) {
    next(error);
  }
}

function getObjectsByBlueprint(req, res, next) {
  try {
    const objects = objectService.getObjectsByBlueprintId(
      req.params.blueprintId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Spatial Objects fetched successfully",
      data: objects,
    });
  } catch (error) {
    next(error);
  }
}

function getObjectById(req, res, next) {
  try {
    const object = objectService.getObjectById(req.params.objectId);
    return successResponse(res, {
      statusCode: 200,
      message: "Spatial Object fetched successfully",
      data: object,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createObject,
  getObjectsByBlueprint,
  getObjectById,
};
