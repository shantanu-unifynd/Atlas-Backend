const positionService = require("../services/position.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function createPosition(req, res, next) {
  try {
    const position = await positionService.createPosition(req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Position created successfully",
      data: position,
    });
  } catch (error) {
    next(error);
  }
}

async function getPositions(req, res, next) {
  try {
    const positions = await positionService.listPositions(req.query);
    return successResponse(res, {
      statusCode: 200,
      message: "Positions fetched successfully",
      data: positions,
    });
  } catch (error) {
    next(error);
  }
}

async function getPositionById(req, res, next) {
  try {
    const position = await positionService.getPosition(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Position fetched successfully",
      data: position,
    });
  } catch (error) {
    next(error);
  }
}

async function deletePosition(req, res, next) {
  try {
    await positionService.deletePosition(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Position deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createPosition,
  getPositions,
  getPositionById,
  deletePosition,
};
