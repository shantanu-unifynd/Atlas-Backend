const geometryService = require("../services/geometry.service");
const { successResponse } = require("../../../../../common/utils/apiResponse");

async function extractGeometry(req, res, next) {
  try {
    const geometryModel = await geometryService.extractGeometry(
      req.params.buildingId,
      req.params.floorId,
      req.params.importId
    );
    return successResponse(res, {
      statusCode: 201,
      message: "Geometry extracted successfully",
      data: geometryModel,
    });
  } catch (error) {
    next(error);
  }
}

async function getGeometryModel(req, res, next) {
  try {
    const geometryModel = await geometryService.getGeometryModel(
      req.params.buildingId,
      req.params.floorId,
      req.params.importId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Geometry model fetched successfully",
      data: geometryModel,
    });
  } catch (error) {
    next(error);
  }
}

async function generateCandidates(req, res, next) {
  try {
    const geometryModel = await geometryService.generateCandidates(
      req.params.buildingId,
      req.params.floorId,
      req.params.importId
    );
    return successResponse(res, {
      statusCode: 201,
      message: "Candidate geometry generated successfully",
      data: geometryModel,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  extractGeometry,
  getGeometryModel,
  generateCandidates,
};
