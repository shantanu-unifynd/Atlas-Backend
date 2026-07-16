const usoService = require("../services/uso.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function generateUsos(req, res, next) {
  try {
    const result = await usoService.generateUniversalSpatialObjects(req.params.geometryId);
    return successResponse(res, {
      statusCode: 201,
      message: "Universal Spatial Objects generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getUsos(req, res, next) {
  try {
    const usos = await usoService.getUniversalSpatialObjects(req.params.geometryId);
    return successResponse(res, {
      statusCode: 200,
      message: "Universal Spatial Objects fetched successfully",
      data: usos,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateUsos,
  getUsos,
};
