const buildingNavigationService = require("../services/buildingNavigation.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function getBuildingNavigation(req, res, next) {
  try {
    const result = await buildingNavigationService.getBuildingNavigation(
      req.params.buildingId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Building navigation fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function computeBuildingRoute(req, res, next) {
  try {
    const result = await buildingNavigationService.computeBuildingRoute(
      req.params.buildingId,
      req.body
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Building route computed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getBuildingNavigation, computeBuildingRoute };
